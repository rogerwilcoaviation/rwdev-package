# shopify-mcp-server

MCP server for Captain Jerry to manage the RWAS Shopify store (rogerwilcoaviation.com).

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with actual tokens from Keeper vault

# 3. Build
npm run build

# 4. Test
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Register with OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "node",
      "args": ["/Users/rwas/projects/shopify-mcp-server/dist/index.js"],
      "env": {
        "SHOPIFY_STORE_DOMAIN": "rogerwilcoaviation.myshopify.com",
        "SHOPIFY_API_VERSION": "2026-01"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `shopify_get_shop` | Store info |
| `shopify_list_products` | Search/list products with filtering |
| `shopify_get_product` | Full product detail with variants |
| `shopify_update_variant` | Update variant price/SKU |
| `shopify_bulk_update_prices` | Bulk pricing with RWAS markup tiers |
| `shopify_list_orders` | Search/list orders |
| `shopify_create_draft_order` | Create quote-based draft orders |
| `shopify_list_customers` | Search/list customers |
| `shopify_get_inventory_levels` | Check inventory quantities |
| `shopify_list_collections` | List all collections |
| `shopify_set_metafield` | Set metafields on any resource |

## RWAS Markup Tiers

| Dealer Cost | Markup |
|------------|--------|
| $1 – $349 | 30% |
| $350 – $1,499 | 20% |
| $1,500 – $4,999 | 15% |
| $5,000+ | 10% |
