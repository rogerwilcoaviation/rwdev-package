import {
  ADMIN_API_URL,
  STOREFRONT_API_URL,
  SHOPIFY_ADMIN_API_TOKEN,
  SHOPIFY_STOREFRONT_TOKEN,
  COST_RESTORE_RATE,
  MAX_QUERY_COST,
} from "../constants.js";

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

interface ShopifyClientOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export class ShopifyClient {
  private availablePoints: number = MAX_QUERY_COST;
  private lastRequestTime: number = Date.now();
  private maxRetries: number;
  private retryDelay: number;

  constructor(options: ShopifyClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;

    if (!SHOPIFY_ADMIN_API_TOKEN) {
      throw new Error(
        "SHOPIFY_ADMIN_API_TOKEN not set. Retrieve from Keeper vault: keeper search 'Shopify API'"
      );
    }
  }

  /**
   * Execute a GraphQL query against the Shopify Admin API.
   */
  async adminQuery<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    return this.executeWithRetry<T>(ADMIN_API_URL, {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN,
    }, query, variables);
  }

  /**
   * Execute a GraphQL query against the Shopify Storefront API.
   */
  async storefrontQuery<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    if (!SHOPIFY_STOREFRONT_TOKEN) {
      throw new Error(
        "SHOPIFY_STOREFRONT_TOKEN not set. Configure via Shopify Admin > Headless channel."
      );
    }
    return this.executeWithRetry<T>(STOREFRONT_API_URL, {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    }, query, variables);
  }

  private async executeWithRetry<T>(
    url: string,
    headers: Record<string, string>,
    query: string,
    variables?: Record<string, unknown>,
    attempt: number = 0
  ): Promise<GraphQLResponse<T>> {
    // Restore points based on elapsed time
    const now = Date.now();
    const elapsed = (now - this.lastRequestTime) / 1000;
    this.availablePoints = Math.min(
      MAX_QUERY_COST,
      this.availablePoints + elapsed * COST_RESTORE_RATE
    );
    this.lastRequestTime = now;

    // If low on points, wait for restore
    if (this.availablePoints < 100) {
      const waitMs = ((100 - this.availablePoints) / COST_RESTORE_RATE) * 1000;
      console.error(`[shopify-client] Rate limit: waiting ${Math.ceil(waitMs)}ms for point restore`);
      await this.sleep(waitMs);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.retryDelay * Math.pow(2, attempt);

        if (attempt < this.maxRetries) {
          console.error(`[shopify-client] Throttled (429). Retry ${attempt + 1}/${this.maxRetries} after ${waitMs}ms`);
          await this.sleep(waitMs);
          return this.executeWithRetry<T>(url, headers, query, variables, attempt + 1);
        }
        throw new Error(`Shopify rate limit exceeded after ${this.maxRetries} retries. Try again later.`);
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Shopify API error (${response.status}): ${body.slice(0, 500)}`);
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      // Update available points from response
      if (result.extensions?.cost?.throttleStatus) {
        this.availablePoints = result.extensions.cost.throttleStatus.currentlyAvailable;
      }

      // Check for GraphQL-level errors
      if (result.errors && result.errors.length > 0) {
        const throttled = result.errors.some(
          (e) => e.extensions?.code === "THROTTLED"
        );
        if (throttled && attempt < this.maxRetries) {
          const waitMs = this.retryDelay * Math.pow(2, attempt);
          console.error(`[shopify-client] GraphQL THROTTLED. Retry ${attempt + 1}/${this.maxRetries} after ${waitMs}ms`);
          await this.sleep(waitMs);
          return this.executeWithRetry<T>(url, headers, query, variables, attempt + 1);
        }
      }

      return result;
    } catch (error) {
      if (attempt < this.maxRetries && error instanceof TypeError) {
        // Network error — retry
        const waitMs = this.retryDelay * Math.pow(2, attempt);
        console.error(`[shopify-client] Network error. Retry ${attempt + 1}/${this.maxRetries} after ${waitMs}ms`);
        await this.sleep(waitMs);
        return this.executeWithRetry<T>(url, headers, query, variables, attempt + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let clientInstance: ShopifyClient | null = null;

export function getShopifyClient(): ShopifyClient {
  if (!clientInstance) {
    clientInstance = new ShopifyClient();
  }
  return clientInstance;
}
