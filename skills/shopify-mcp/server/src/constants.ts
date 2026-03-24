// RWAS Shopify MCP Server Constants

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";
export const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "rogerwilcoaviation.myshopify.com";
export const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || "";
export const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || "";

export const ADMIN_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
export const STOREFRONT_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

// Rate limiting
export const MAX_QUERY_COST = 1000;
export const COST_RESTORE_RATE = 50; // points per second
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const CHARACTER_LIMIT = 50000; // max response size

// RWAS tiered markup pricing
export const MARKUP_TIERS = [
  { minCost: 5000, markup: 0.10 },
  { minCost: 1500, markup: 0.15 },
  { minCost: 350,  markup: 0.20 },
  { minCost: 1,    markup: 0.30 },
] as const;

/**
 * Calculate RWAS retail price from dealer cost using tiered markup.
 * Tiers: 30% ($1-$349), 20% ($350-$1,499), 15% ($1,500-$4,999), 10% ($5,000+)
 */
export function calculateRetailPrice(dealerCost: number): number {
  for (const tier of MARKUP_TIERS) {
    if (dealerCost >= tier.minCost) {
      return Math.round((dealerCost * (1 + tier.markup)) * 100) / 100;
    }
  }
  return dealerCost;
}
