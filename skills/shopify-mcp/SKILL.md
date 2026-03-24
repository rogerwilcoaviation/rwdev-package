---
name: shopify-mcp
description: >
  MCP server for Shopify Admin and Storefront API integration. Use this skill
  whenever Jerry needs to interact with the RWAS Shopify store — including
  managing products, variants, pricing, inventory, orders, draft orders,
  customers, collections, blog posts, pages, metafields, or any other
  Shopify resource. Also use when syncing data between Shopify and QMX/QBO,
  processing Garmin catalog updates, handling quote-based pricing, or
  managing the rogerwilcoaviation.com storefront. Trigger on any mention of
  "Shopify", "store", "products", "orders", "inventory", "collections",
  "Garmin catalog", "pricing update", "draft order", "checkout", or
  "storefront". This skill is critical for the RWDEV headless architecture.
---

# Shopify MCP Server for Captain Jerry

## Overview

This MCP server gives Jerry full programmatic access to the RWAS Shopify store
(ID: 76313067739, domain: rogerwilcoaviation.com) via the Shopify Admin GraphQL
API and Storefront GraphQL API.

**Transport**: stdio (runs locally on Jerry's Mac Mini)  
**Language**: TypeScript  
**Auth**: Admin API access token stored in Keeper vault  
**API Version**: 2026-01 (latest stable)

---

## Quick Start

### Prerequisites

1. Node.js 20+ on Jerry's Mac Mini
2. Shopify Admin API access token with these scopes:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_draft_orders`, `write_draft_orders`
   - `read_inventory`, `write_inventory`
   - `read_customers`, `write_customers`
   - `read_content`, `write_content`
   - `read_online_store_pages`, `write_online_store_pages`
   - `read_publications`, `write_publications`
   - `read_fulfillments`, `write_fulfillments`
3. Storefront API access token (for read-only public product queries)

### Installation

```bash
cd ~/projects
git clone <repo-url> shopify-mcp-server
cd shopify-mcp-server
npm install
npm run build
```

### Environment Variables

Create `.env` in the server root:

```bash
SHOPIFY_STORE_DOMAIN=rogerwilcoaviation.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxx
SHOPIFY_STOREFRONT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2026-01
```

**IMPORTANT**: Retrieve tokens from Keeper vault, never hardcode them.
Use the keeper-access skill: `keeper search "Shopify API"`.

### Register with OpenClaw

Add to Jerry's `~/.openclaw/openclaw.json` under `mcpServers`:

```json
{
  "shopify": {
    "command": "node",
    "args": ["/Users/rwas/projects/shopify-mcp-server/dist/index.js"],
    "env": {
      "SHOPIFY_STORE_DOMAIN": "rogerwilcoaviation.myshopify.com",
      "SHOPIFY_API_VERSION": "2026-01"
    }
  }
}
```

Tokens should be loaded from environment or Keeper at runtime, not stored
in the OpenClaw config file.

---

## Tool Reference

### Product Management

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_list_products` | List/search products with filtering by title, vendor, product_type, collection, status | readOnly |
| `shopify_get_product` | Get full product detail by ID including variants, images, metafields | readOnly |
| `shopify_create_product` | Create a new product with variants, images, pricing | destructive |
| `shopify_update_product` | Update product fields (title, description, tags, status, variants) | destructive |
| `shopify_update_variant` | Update a single variant (price, compare_at_price, sku, inventory) | destructive |
| `shopify_bulk_update_prices` | Bulk update variant prices from a structured input (for Garmin catalog syncs) | destructive |
| `shopify_list_collections` | List smart and custom collections | readOnly |
| `shopify_add_to_collection` | Add products to a collection | destructive |

### Order Operations

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_list_orders` | List/search orders with filtering by status, date range, customer | readOnly |
| `shopify_get_order` | Get full order detail including line items, fulfillments, transactions | readOnly |
| `shopify_create_draft_order` | Create a draft order (for quote-based Garmin installs) | destructive |
| `shopify_update_draft_order` | Update an existing draft order | destructive |
| `shopify_complete_draft_order` | Convert draft order to a real order | destructive |
| `shopify_cancel_order` | Cancel an order | destructive |

### Inventory

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_get_inventory_levels` | Get inventory levels for items at locations | readOnly |
| `shopify_adjust_inventory` | Adjust inventory quantity for an item at a location | destructive |
| `shopify_list_locations` | List inventory locations (KYKN facility) | readOnly |

### Customers

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_list_customers` | List/search customers by name, email, or tag | readOnly |
| `shopify_get_customer` | Get full customer detail including order history | readOnly |
| `shopify_create_customer` | Create a new customer record | destructive |
| `shopify_update_customer` | Update customer fields or tags | destructive |

### Content Management

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_list_blogs` | List blogs | readOnly |
| `shopify_list_articles` | List blog articles with filtering | readOnly |
| `shopify_create_article` | Create a blog post | destructive |
| `shopify_update_article` | Update a blog post | destructive |
| `shopify_list_pages` | List pages | readOnly |
| `shopify_update_page` | Update page content | destructive |
| `shopify_get_metafield` | Get metafield value for any resource | readOnly |
| `shopify_set_metafield` | Set metafield value on any resource | destructive |

### Store Info

| Tool | Description | Annotations |
|------|-------------|-------------|
| `shopify_get_shop` | Get store info (name, domain, plan, currency) | readOnly |
| `shopify_list_webhooks` | List registered webhooks | readOnly |
| `shopify_create_webhook` | Register a new webhook subscription | destructive |

---

## RWAS-Specific Patterns

### Tiered Markup Pricing

When Jerry updates pricing for parts, apply the RWAS markup tiers:

| Cost Range | Markup |
|-----------|--------|
| $1 – $349 | 30% |
| $350 – $1,499 | 20% |
| $1,500 – $4,999 | 15% |
| $5,000+ | 10% |

Example: A Garmin part with cost $2,400 → retail price = $2,400 × 1.15 = $2,760.

Use `shopify_bulk_update_prices` with the markup calculation built in.

### Quote-Only Products ($0.00 Items)

Several Garmin avionics are install-only and show $0.00 in the store. These
should be identified by a metafield or tag (`quote-only`). When a customer
inquires, Jerry creates a `shopify_create_draft_order` with the actual pricing.

### Garmin Catalog Sync

When John provides a Garmin pricing CSV update:

1. Parse CSV (part number, description, dealer cost, MSRP)
2. Match against existing Shopify products by SKU
3. Apply tiered markup to dealer cost → set as variant price
4. Set MSRP as compare_at_price
5. Report: new parts added, prices changed, parts not found
6. Cross-reference against QMX inventory data

### QMX ↔ Shopify Sync

Products in QMX (quantum-mx.com) should match Shopify SKUs. Jerry can:
- Pull QMX work order parts → verify they exist in Shopify catalog
- Compare QMX unit costs against Shopify variant prices
- Flag discrepancies for the QMX-QBO reconciliation pipeline

---

## GraphQL Patterns

### Product Query Example

```graphql
query GetProducts($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
        status
        vendor
        productType
        tags
        variants(first: 50) {
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              inventoryQuantity
            }
          }
        }
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Draft Order Creation Example

```graphql
mutation CreateDraftOrder($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      name
      totalPrice
      invoiceUrl
      customer {
        id
        displayName
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Bulk Variant Price Update

```graphql
mutation BulkUpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants {
      id
      price
    }
    userErrors {
      field
      message
    }
  }
}
```

---

## Error Handling

All tools should handle these Shopify-specific errors:

| Error | Action |
|-------|--------|
| `THROTTLED` (429) | Exponential backoff, respect `Retry-After` header. Admin API uses calculated query cost. |
| `UNAUTHORIZED` (401) | Log error, alert John. Token may need rotation. |
| `NOT_FOUND` (404) | Return clear message with the ID that wasn't found |
| `SHOP_INACTIVE` | Alert John — Shopify subscription issue |
| `userErrors` in mutations | Return the specific field + message to Jerry |

### Rate Limiting

The GraphQL Admin API uses a calculated query cost model:
- Each store gets 1,000 cost points per second
- Points restore at 50/second
- Check `extensions.cost` in every response
- If `throttleStatus.currentlyAvailable` < query cost → wait

---

## File Structure

```
shopify-mcp-server/
├── package.json
├── tsconfig.json
├── .env                    # Tokens (gitignored)
├── README.md
├── src/
│   ├── index.ts            # Server init, transport, tool registration
│   ├── types.ts            # TypeScript interfaces for Shopify resources
│   ├── constants.ts        # API version, endpoints, rate limits
│   ├── services/
│   │   ├── shopify-client.ts   # GraphQL client with auth + rate limiting
│   │   └── pricing.ts         # RWAS markup calculation logic
│   ├── schemas/
│   │   ├── products.ts     # Zod schemas for product tools
│   │   ├── orders.ts       # Zod schemas for order tools
│   │   ├── inventory.ts    # Zod schemas for inventory tools
│   │   ├── customers.ts    # Zod schemas for customer tools
│   │   └── content.ts      # Zod schemas for content tools
│   └── tools/
│       ├── products.ts     # Product management tools
│       ├── orders.ts       # Order operation tools
│       ├── inventory.ts    # Inventory tools
│       ├── customers.ts    # Customer tools
│       ├── content.ts      # Blog/page/metafield tools
│       └── store.ts        # Shop info and webhook tools
└── dist/                   # Compiled JS output
```

---

## Testing

After building, verify with:

```bash
# Build
npm run build

# Test basic connectivity
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Test a read-only tool
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"shopify_get_shop"}}' | node dist/index.js
```

For full testing, use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@shopify/shopify-api": "^11.0.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```
