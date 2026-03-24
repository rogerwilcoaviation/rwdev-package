import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getShopifyClient } from "./services/shopify-client.js";
import { calculateRetailPrice, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, CHARACTER_LIMIT } from "./constants.js";

const server = new McpServer({
  name: "shopify-mcp-server",
  version: "1.0.0",
});

// ─────────────────────────────────────────
// Helper: Extract edges from Shopify connection
// ─────────────────────────────────────────
function extractEdges<T>(connection: { edges: Array<{ node: T }> } | undefined): T[] {
  return connection?.edges?.map((e) => e.node) ?? [];
}

function truncateResponse(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[Response truncated. Use pagination to retrieve more results.]";
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ─────────────────────────────────────────
// TOOL: shopify_get_shop
// ─────────────────────────────────────────
server.registerTool(
  "shopify_get_shop",
  {
    title: "Get Shop Info",
    description: "Get RWAS Shopify store information including name, domain, plan, currency, and timezone.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async () => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{ shop: Record<string, unknown> }>(`
      query {
        shop {
          name
          primaryDomain { url host }
          plan { displayName }
          currencyCode
          timezoneAbbreviation
          email
          myshopifyDomain
        }
      }
    `);

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(result.data?.shop, null, 2) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_list_products
// ─────────────────────────────────────────
server.registerTool(
  "shopify_list_products",
  {
    title: "List/Search Products",
    description: `List or search products in the RWAS Shopify store. Supports filtering by title, vendor, product_type, tag, status, and collection. Returns product ID, title, handle, status, vendor, variant count, and price range. Use pagination with 'after' cursor for large catalogs (1,951+ Garmin parts).`,
    inputSchema: {
      query: z.string().optional().describe("Search query string (matches title, body, vendor, tag, etc.)"),
      status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional().describe("Filter by product status"),
      vendor: z.string().optional().describe("Filter by vendor (e.g., 'Garmin', 'RWAS')"),
      product_type: z.string().optional().describe("Filter by product type"),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page (max 100)"),
      after: z.string().optional().describe("Pagination cursor from previous response's endCursor"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();

    // Build query filter string
    const filters: string[] = [];
    if (params.query) filters.push(params.query);
    if (params.status) filters.push(`status:${params.status}`);
    if (params.vendor) filters.push(`vendor:"${params.vendor}"`);
    if (params.product_type) filters.push(`product_type:"${params.product_type}"`);
    const queryStr = filters.length > 0 ? filters.join(" AND ") : null;

    const result = await client.adminQuery<{
      products: {
        edges: Array<{ node: Record<string, unknown>; cursor: string }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    }>(`
      query ListProducts($first: Int!, $query: String, $after: String) {
        products(first: $first, query: $query, after: $after) {
          edges {
            node {
              id
              title
              handle
              status
              vendor
              productType
              tags
              totalInventory
              variantsCount { count }
              priceRangeV2 {
                minVariantPrice { amount currencyCode }
                maxVariantPrice { amount currencyCode }
              }
            }
            cursor
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, {
      first: params.limit,
      query: queryStr,
      after: params.after ?? null,
    });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    const products = result.data?.products;
    const output = {
      count: products?.edges?.length ?? 0,
      hasNextPage: products?.pageInfo?.hasNextPage ?? false,
      endCursor: products?.pageInfo?.endCursor ?? null,
      products: products?.edges?.map((e) => e.node) ?? [],
    };

    return { content: [{ type: "text" as const, text: truncateResponse(JSON.stringify(output, null, 2)) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_get_product
// ─────────────────────────────────────────
server.registerTool(
  "shopify_get_product",
  {
    title: "Get Product Detail",
    description: "Get full product details by Shopify global ID, including all variants, images, and metafields.",
    inputSchema: {
      id: z.string().describe("Shopify product global ID (e.g., 'gid://shopify/Product/123456789')"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{ product: Record<string, unknown> }>(`
      query GetProduct($id: ID!) {
        product(id: $id) {
          id title handle status vendor productType tags descriptionHtml
          variants(first: 100) {
            edges {
              node {
                id title sku price compareAtPrice inventoryQuantity
                selectedOptions { name value }
                inventoryItem { id }
              }
            }
          }
          images(first: 20) {
            edges { node { url altText width height } }
          }
          metafields(first: 20) {
            edges { node { id namespace key value type } }
          }
        }
      }
    `, { id: params.id });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: truncateResponse(JSON.stringify(result.data?.product, null, 2)) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_update_variant
// ─────────────────────────────────────────
server.registerTool(
  "shopify_update_variant",
  {
    title: "Update Product Variant",
    description: "Update a single product variant's price, compare_at_price, SKU, or other fields.",
    inputSchema: {
      id: z.string().describe("Variant global ID (e.g., 'gid://shopify/ProductVariant/123')"),
      price: z.string().optional().describe("New price as string (e.g., '299.99')"),
      compareAtPrice: z.string().optional().describe("Compare-at price (MSRP) as string"),
      sku: z.string().optional().describe("New SKU"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();

    const input: Record<string, unknown> = { id: params.id };
    if (params.price !== undefined) input.price = params.price;
    if (params.compareAtPrice !== undefined) input.compareAtPrice = params.compareAtPrice;
    if (params.sku !== undefined) input.sku = params.sku;

    const result = await client.adminQuery<{
      productVariantUpdate: {
        productVariant: Record<string, unknown>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(`
      mutation UpdateVariant($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant { id title sku price compareAtPrice }
          userErrors { field message }
        }
      }
    `, { input });

    const data = result.data?.productVariantUpdate;
    if (data?.userErrors?.length) {
      return { content: [{ type: "text" as const, text: `User errors: ${JSON.stringify(data.userErrors)}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(data?.productVariant, null, 2) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_bulk_update_prices
// ─────────────────────────────────────────
server.registerTool(
  "shopify_bulk_update_prices",
  {
    title: "Bulk Update Prices (RWAS Markup)",
    description: `Bulk update variant prices using RWAS tiered markup. Input an array of {sku, dealerCost, msrp} entries. Markup tiers: 30% ($1-$349), 20% ($350-$1,499), 15% ($1,500-$4,999), 10% ($5,000+). Sets retail price from markup and MSRP as compare_at_price. Designed for Garmin catalog price updates.`,
    inputSchema: {
      entries: z.array(z.object({
        sku: z.string().describe("Product SKU to match"),
        dealerCost: z.number().positive().describe("Dealer cost in USD"),
        msrp: z.number().positive().describe("Manufacturer suggested retail price"),
      })).min(1).max(500).describe("Array of pricing entries to update"),
      dryRun: z.boolean().default(false).describe("If true, calculate prices but don't update Shopify"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const results: Array<{
      sku: string;
      dealerCost: number;
      retailPrice: number;
      msrp: number;
      markupPercent: number;
      status: string;
      error?: string;
    }> = [];

    for (const entry of params.entries) {
      const retailPrice = calculateRetailPrice(entry.dealerCost);
      const markupPercent = Math.round(((retailPrice - entry.dealerCost) / entry.dealerCost) * 100);

      if (params.dryRun) {
        results.push({
          sku: entry.sku,
          dealerCost: entry.dealerCost,
          retailPrice,
          msrp: entry.msrp,
          markupPercent,
          status: "dry_run",
        });
        continue;
      }

      // Find variant by SKU
      try {
        const searchResult = await client.adminQuery<{
          productVariants: {
            edges: Array<{ node: { id: string; sku: string; price: string; product: { id: string } } }>;
          };
        }>(`
          query FindVariantBySku($query: String!) {
            productVariants(first: 1, query: $query) {
              edges { node { id sku price product { id } } }
            }
          }
        `, { query: `sku:${entry.sku}` });

        const variant = searchResult.data?.productVariants?.edges?.[0]?.node;
        if (!variant) {
          results.push({ sku: entry.sku, dealerCost: entry.dealerCost, retailPrice, msrp: entry.msrp, markupPercent, status: "not_found" });
          continue;
        }

        // Update the variant
        const updateResult = await client.adminQuery<{
          productVariantUpdate: {
            productVariant: { id: string; price: string; compareAtPrice: string };
            userErrors: Array<{ field: string[]; message: string }>;
          };
        }>(`
          mutation UpdateVariant($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant { id price compareAtPrice }
              userErrors { field message }
            }
          }
        `, {
          input: {
            id: variant.id,
            price: retailPrice.toFixed(2),
            compareAtPrice: entry.msrp.toFixed(2),
          },
        });

        const userErrors = updateResult.data?.productVariantUpdate?.userErrors;
        if (userErrors?.length) {
          results.push({ sku: entry.sku, dealerCost: entry.dealerCost, retailPrice, msrp: entry.msrp, markupPercent, status: "error", error: userErrors[0].message });
        } else {
          results.push({ sku: entry.sku, dealerCost: entry.dealerCost, retailPrice, msrp: entry.msrp, markupPercent, status: "updated" });
        }
      } catch (err) {
        results.push({ sku: entry.sku, dealerCost: entry.dealerCost, retailPrice, msrp: entry.msrp, markupPercent, status: "error", error: formatError(err) });
      }
    }

    const summary = {
      total: results.length,
      updated: results.filter(r => r.status === "updated").length,
      notFound: results.filter(r => r.status === "not_found").length,
      errors: results.filter(r => r.status === "error").length,
      dryRun: results.filter(r => r.status === "dry_run").length,
      results,
    };

    return { content: [{ type: "text" as const, text: truncateResponse(JSON.stringify(summary, null, 2)) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_list_orders
// ─────────────────────────────────────────
server.registerTool(
  "shopify_list_orders",
  {
    title: "List/Search Orders",
    description: "List or search orders. Filter by status, date range, customer email, or financial/fulfillment status.",
    inputSchema: {
      query: z.string().optional().describe("Search query (e.g., customer email, order name '#1234')"),
      status: z.enum(["open", "closed", "cancelled", "any"]).default("any").describe("Order status filter"),
      limit: z.number().int().min(1).max(50).default(25).describe("Results per page"),
      after: z.string().optional().describe("Pagination cursor"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const filters: string[] = [];
    if (params.query) filters.push(params.query);
    if (params.status !== "any") filters.push(`status:${params.status}`);
    const queryStr = filters.length > 0 ? filters.join(" AND ") : null;

    const result = await client.adminQuery<{
      orders: {
        edges: Array<{ node: Record<string, unknown> }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    }>(`
      query ListOrders($first: Int!, $query: String, $after: String) {
        orders(first: $first, query: $query, after: $after) {
          edges {
            node {
              id name createdAt
              displayFinancialStatus displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              customer { id displayName email }
              lineItems(first: 5) {
                edges { node { title quantity } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { first: params.limit, query: queryStr, after: params.after ?? null });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    const orders = result.data?.orders;
    const output = {
      count: orders?.edges?.length ?? 0,
      hasNextPage: orders?.pageInfo?.hasNextPage ?? false,
      endCursor: orders?.pageInfo?.endCursor ?? null,
      orders: orders?.edges?.map((e) => e.node) ?? [],
    };

    return { content: [{ type: "text" as const, text: truncateResponse(JSON.stringify(output, null, 2)) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_create_draft_order
// ─────────────────────────────────────────
server.registerTool(
  "shopify_create_draft_order",
  {
    title: "Create Draft Order",
    description: `Create a draft order for quote-based items (e.g., Garmin avionics installs). Generates an invoice URL the customer can use to pay. Use for $0.00 quote-only products where actual pricing is determined per-project.`,
    inputSchema: {
      customerEmail: z.string().email().optional().describe("Customer email for the draft order"),
      lineItems: z.array(z.object({
        title: z.string().describe("Line item title"),
        quantity: z.number().int().positive().default(1),
        originalUnitPrice: z.string().describe("Unit price as string (e.g., '17450.00')"),
        sku: z.string().optional().describe("Optional SKU reference"),
      })).min(1).describe("Line items for the draft order"),
      note: z.string().optional().describe("Internal note on the draft order"),
      tags: z.array(z.string()).optional().describe("Tags (e.g., ['garmin-install', 'quote'])"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();

    const input: Record<string, unknown> = {
      lineItems: params.lineItems.map((li) => ({
        title: li.title,
        quantity: li.quantity,
        originalUnitPrice: li.originalUnitPrice,
        ...(li.sku ? { sku: li.sku } : {}),
      })),
    };
    if (params.customerEmail) input.email = params.customerEmail;
    if (params.note) input.note = params.note;
    if (params.tags) input.tags = params.tags;

    const result = await client.adminQuery<{
      draftOrderCreate: {
        draftOrder: Record<string, unknown>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(`
      mutation CreateDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id name status totalPrice invoiceUrl
            customer { id displayName }
            lineItems(first: 20) {
              edges { node { title quantity originalUnitPrice } }
            }
          }
          userErrors { field message }
        }
      }
    `, { input });

    const data = result.data?.draftOrderCreate;
    if (data?.userErrors?.length) {
      return { content: [{ type: "text" as const, text: `User errors: ${JSON.stringify(data.userErrors)}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(data?.draftOrder, null, 2) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_list_customers
// ─────────────────────────────────────────
server.registerTool(
  "shopify_list_customers",
  {
    title: "List/Search Customers",
    description: "Search customers by name, email, phone, or tag.",
    inputSchema: {
      query: z.string().optional().describe("Search query (name, email, phone)"),
      limit: z.number().int().min(1).max(50).default(25),
      after: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{
      customers: {
        edges: Array<{ node: Record<string, unknown> }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    }>(`
      query ListCustomers($first: Int!, $query: String, $after: String) {
        customers(first: $first, query: $query, after: $after) {
          edges {
            node {
              id displayName firstName lastName email phone
              tags ordersCount totalSpent createdAt
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { first: params.limit, query: params.query ?? null, after: params.after ?? null });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    const customers = result.data?.customers;
    return {
      content: [{
        type: "text" as const,
        text: truncateResponse(JSON.stringify({
          count: customers?.edges?.length ?? 0,
          hasNextPage: customers?.pageInfo?.hasNextPage ?? false,
          endCursor: customers?.pageInfo?.endCursor ?? null,
          customers: customers?.edges?.map((e) => e.node) ?? [],
        }, null, 2)),
      }],
    };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_get_inventory_levels
// ─────────────────────────────────────────
server.registerTool(
  "shopify_get_inventory_levels",
  {
    title: "Get Inventory Levels",
    description: "Get inventory quantities for a specific inventory item or location. Use after getting variant's inventoryItem.id.",
    inputSchema: {
      inventoryItemId: z.string().describe("Inventory item global ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{
      inventoryItem: {
        id: string;
        sku: string;
        inventoryLevels: {
          edges: Array<{
            node: {
              id: string;
              quantities: Array<{ name: string; quantity: number }>;
              location: { id: string; name: string };
            };
          }>;
        };
      };
    }>(`
      query GetInventoryLevels($id: ID!) {
        inventoryItem(id: $id) {
          id sku
          inventoryLevels(first: 10) {
            edges {
              node {
                id
                quantities(names: ["available", "committed", "incoming", "on_hand"]) {
                  name quantity
                }
                location { id name }
              }
            }
          }
        }
      }
    `, { id: params.inventoryItemId });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(result.data?.inventoryItem, null, 2) }] };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_list_collections
// ─────────────────────────────────────────
server.registerTool(
  "shopify_list_collections",
  {
    title: "List Collections",
    description: "List all collections (smart and custom) in the store.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).default(25),
      query: z.string().optional().describe("Search by collection title"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{
      collections: {
        edges: Array<{ node: Record<string, unknown> }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    }>(`
      query ListCollections($first: Int!, $query: String) {
        collections(first: $first, query: $query) {
          edges {
            node {
              id title handle productsCount sortOrder
              image { url altText }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { first: params.limit, query: params.query ?? null });

    if (result.errors?.length) {
      return { content: [{ type: "text" as const, text: `Error: ${result.errors.map(e => e.message).join("; ")}` }], isError: true };
    }

    const collections = result.data?.collections;
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count: collections?.edges?.length ?? 0,
          hasNextPage: collections?.pageInfo?.hasNextPage ?? false,
          collections: collections?.edges?.map((e) => e.node) ?? [],
        }, null, 2),
      }],
    };
  }
);

// ─────────────────────────────────────────
// TOOL: shopify_set_metafield
// ─────────────────────────────────────────
server.registerTool(
  "shopify_set_metafield",
  {
    title: "Set Metafield",
    description: "Set a metafield value on any Shopify resource (product, collection, page, shop, etc.).",
    inputSchema: {
      ownerId: z.string().describe("Global ID of the resource owner (e.g., 'gid://shopify/Product/123')"),
      namespace: z.string().describe("Metafield namespace (e.g., 'rwas')"),
      key: z.string().describe("Metafield key (e.g., 'quote_only')"),
      value: z.string().describe("Metafield value"),
      type: z.string().default("single_line_text_field").describe("Metafield type (e.g., 'boolean', 'json', 'single_line_text_field')"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {
    const client = getShopifyClient();
    const result = await client.adminQuery<{
      metafieldsSet: {
        metafields: Array<{ id: string; namespace: string; key: string; value: string }>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(`
      mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id namespace key value }
          userErrors { field message }
        }
      }
    `, {
      metafields: [{
        ownerId: params.ownerId,
        namespace: params.namespace,
        key: params.key,
        value: params.value,
        type: params.type,
      }],
    });

    const data = result.data?.metafieldsSet;
    if (data?.userErrors?.length) {
      return { content: [{ type: "text" as const, text: `User errors: ${JSON.stringify(data.userErrors)}` }], isError: true };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(data?.metafields, null, 2) }] };
  }
);

// ─────────────────────────────────────────
// TRANSPORT: stdio for local OpenClaw
// ─────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[shopify-mcp-server] Connected via stdio. Ready for tool calls.");
}

main().catch((error) => {
  console.error("[shopify-mcp-server] Fatal error:", error);
  process.exit(1);
});
