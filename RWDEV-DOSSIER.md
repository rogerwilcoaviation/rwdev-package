# RWDEV — Master Dossier

**Project**: Roger Wilco Aviation Services Website Rebuild  
**Codename**: RWDEV  
**Owner**: John Halsted  
**Domain**: rogerwilcoaviation.com  
**Shopify Store ID**: 76313067739  
**Last Updated**: 2026-03-22  

---

## 1. Executive Summary

RWDEV is the full rebuild of rogerwilcoaviation.com from a Shopify-Liquid-only site to a **headless architecture**: Next.js frontend on Cloudflare Pages, backed by Shopify's Storefront and Admin GraphQL APIs for commerce, with Captain Jerry as the operational AI layer for content management, product sync, and customer engagement.

The Shopify store is **retained** for product catalog, inventory, checkout, and order processing. The Liquid theme is **replaced** by a custom Next.js frontend with full design control.

---

## 2. Current Site Audit (2026-03-22)

### 2.1 Pages Inventoried

| Page | URL Path | Status | Notes |
|------|----------|--------|-------|
| Homepage | `/` | Live | Hero video, NDT section, fabrication, CTA, collapsible SEO content, mailing list signup |
| About | `/pages/about` | Live | 2,000+ word SEO wall, service table, NDT table, fabrication table — needs complete redesign |
| Shop Capabilities | `/pages/shop-capabilities` | Live | Clean bullet list of capabilities — good content, poor layout |
| Garmin Hub | `/pages/garmin-avionics-accessories` | Live | Collection links page — 5 sub-collections |
| Garmin Certified (Install Only) | `/collections/garmin-avionics` | Live | 14 products, several at $0.00 (quote-only) |
| Garmin Certified Retail | `/collections/garmin-avionics-certified-retail` | Live | Retail-purchasable Garmin |
| Garmin Experimental | `/collections/retail-experimental` | Live | Experimental aircraft avionics |
| Garmin Accessories | `/collections/garmin-avionics-accessories` | Live | Accessories collection |
| Garmin Watches | `/collections/garmin-watches` | Live | Consumer watches |
| On Sale | `/collections/on-sale` | Live | Time-limited sale items |
| Papa-Alpha Tools | `/collections/rigging-tools` | Live | 9 SKUs, $59.99–$303.42, international sales |
| Aircraft Management | `/collections/aircraft-management` | Live | Empty collection — placeholder |
| Financing | `/pages/financing` | **503 Error** | Broken page |
| Blog | `/pages/blog` | Live | NOT a blog — contains embedded Panel Planner app |
| Contact | `/pages/contact` | **Error** | Failed to load |

### 2.2 Key Problems

1. **Liquid fighting custom content**: The Panel Planner, chatbot, and interactive tools are shoehorned into Shopify page templates
2. **Quote-only products at $0.00**: Garmin install-only items don't fit Shopify's retail checkout model
3. **Broken pages**: Financing (503), Contact (fetch error)
4. **SEO keyword stuffing**: About page is a wall of repeated phrases, not human-readable content
5. **Empty sections**: Aircraft Management collection has no products
6. **No blog**: The "Blog" page is actually the Panel Planner tool
7. **No chatbot or Jerry integration**: The original RWDEV plan called for these
8. **Design constraints**: Liquid sections/blocks limit layout flexibility for service-business content

### 2.3 What's Working

- Hero video on homepage is visually strong
- NDT breakdown with SVG illustrations is clean and professional
- Papa-Alpha product line is well-presented with proper variants/pricing
- Garmin catalog structure (5 sub-collections) is logically organized
- Shopify cart/checkout/inventory infrastructure is functional
- Brand colors (black #111111, gold #C49A2A, warm off-white #f5f3ef) are established

---

## 3. Target Architecture

### 3.1 Layer Map

```
┌─────────────────────────────────────────────────────┐
│                   VISITORS / BROWSERS                │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Cloudflare CDN  │  DNS: rogerwilcoaviation.com
              │  + Edge Cache    │  Managed via Cloudflare
              └────────┬────────┘
                       │
         ┌─────────────▼──────────────┐
         │   Cloudflare Pages          │
         │   Next.js SSR/SSG Frontend  │
         │                             │
         │  • Marketing pages          │
         │  • Service pages            │
         │  • Blog (real)              │
         │  • Panel Planner app        │
         │  • Chatbot (Jerry-backed)   │
         │  • Customer portal          │
         │  • Product browsing         │
         └──┬──────────────┬──────────┘
            │              │
   ┌────────▼───┐   ┌─────▼──────────┐
   │ Shopify     │   │ Cloudflare      │
   │ Storefront  │   │ Workers         │
   │ API (GQL)   │   │                 │
   │             │   │ • API cache     │
   │ • Products  │   │ • Auth proxy    │
   │ • Cart      │   │ • Jerry relay   │
   │ • Checkout  │   │ • Webhooks      │
   └──────┬──────┘   └────────┬───────┘
          │                   │
   ┌──────▼──────┐     ┌──────▼──────┐
   │  Shopify     │     │ Jerry       │
   │  Admin API   │     │ (Mac Mini)  │
   │  (GQL)       │     │             │
   │              │     │ • Content   │
   │ • Orders     │     │ • Chat      │
   │ • Inventory  │     │ • Alerts    │
   │ • Customers  │     │ • QMX sync  │
   │ • Products   │     │ • QBO sync  │
   └──────────────┘     └─────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend Framework | Next.js 14+ (App Router) | SSR/SSG hybrid, React Server Components |
| Hosting | Cloudflare Pages | Already in John's Cloudflare ecosystem |
| Edge Logic | Cloudflare Workers | API caching, auth middleware, Jerry relay |
| CSS | Tailwind CSS | Utility-first, matches existing RWAS brand tokens |
| Commerce Data | Shopify Storefront API (GraphQL) | Products, cart, checkout |
| Commerce Admin | Shopify Admin API (GraphQL) | Orders, inventory, customers, product management |
| AI Agent | Captain Jerry (OpenClaw on Mac Mini) | Shopify MCP skill for product/order management |
| DNS/CDN/Tunnels | Cloudflare | Already manages rogerwilcoaviation.com |
| Auth Proxy | Cloudflare Access | jerry.rwas.team tunnel already configured |

### 3.3 Authentication Strategy

**Important**: As of January 1, 2026, Shopify no longer allows creating legacy custom apps with direct Admin API access tokens. New custom apps require OAuth flow via the Dev Dashboard.

**For Jerry (Admin API access)**:
- If existing custom app with access token exists → use it (grandfathered)
- If new app needed → create via Dev Dashboard with OAuth token exchange
- Store credentials in Keeper vault
- Jerry's Shopify MCP server authenticates using the stored token

**For Frontend (Storefront API access)**:
- Create Storefront API access token (public for client-side, private for SSR)
- Headless channel in Shopify admin generates both token types
- Public token used in Next.js client components
- Private token used in Next.js server components / Cloudflare Workers

---

## 4. RWDEV History

### 4.1 Phase 1: Shopify Website Planning (Feb 2026)

**Source**: `memory/2026-02-27.md`

- Detailed project plan locked
- Focus areas defined: chatbot, CTAs, templates
- Shopify skill built for Jerry
- Keeper auth script created
- Browser work stalled (mobile only, no desktop relay)
- Paused until computer access available
- **Explicit next manual step**: login → duplicate theme → share preview URL

### 4.2 Phase 2: Front-end Prototype (Mar 2026)

**Source**: `memory/2026-03-07.md`

- Built Roobin Mood dashboard prototype
- Route: `/dashboard`
- Local repo: `~/projects/vibe-coding-starter`
- Framework: Next.js (App Router)
- Key commits: `97be226`, `d967160`
- Remote: `https://github.com/rogerwilcoaviation/vibe-coding-starter`
- Deployed: `https://vibe-coding-starter-mnzncwcu4-johns-projects-022206dc.vercel.app`
- Files: `app/dashboard/page.tsx`, `components/dashboard/*`, `data/dashboard/roobinMood.ts`
- Upstream fork: `PageAI-Pro/vibe-coding-starter`

### 4.3 Phase 3: Headless Architecture + Jerry Integration (Current)

- Architecture decision: headless (Next.js + Cloudflare Pages + Shopify APIs)
- Jerry gets Shopify MCP skill for Admin API operations
- Jerry's existing Cloudflare skill handles deployment/DNS/Workers
- vibe-coding-starter becomes the seed repo for the production site

---

## 5. Jerry's Role in Production

### 5.1 Shopify MCP Server

Jerry needs an MCP server that gives him full Shopify Admin API access:

**Product Management**:
- List/search/create/update products and variants
- Manage pricing (including the tiered markup: 30%/20%/15%/10%)
- Sync Garmin catalog updates (1,951+ parts)
- Handle $0.00 quote-only items with proper metadata

**Order Operations**:
- View and search orders
- Create draft orders (for quote-based Garmin installs)
- Process fulfillments
- Manage customer records

**Inventory**:
- Track stock levels
- Adjust inventory counts
- Location-aware inventory (KYKN)

**Content**:
- Manage blog posts (real blog, not Panel Planner)
- Update page content via metafields
- Manage collection organization

**Integration Points**:
- QMX ↔ Shopify product/order sync
- QBO ↔ Shopify financial reconciliation
- Parts procurement workflow (SOP-PARTS-001) triggers

### 5.2 Cloudflare Skill (Existing)

Jerry already has a Cloudflare skill. For RWDEV it handles:
- Cloudflare Pages deployment management
- DNS record management for rogerwilcoaviation.com
- Worker script deployment (API cache, Jerry relay, webhooks)
- Tunnel management (jerry.rwas.team, jerry-api.rwas.team)
- Cache purging after content updates

### 5.3 Operational Workflows

**Product Price Update Flow**:
1. John provides new Garmin pricing CSV
2. Jerry ingests CSV via Shopify MCP → updates all variants
3. Jerry verifies against QMX pricing data
4. Jerry reports discrepancies

**New Customer Inquiry Flow**:
1. Visitor uses chatbot on rogerwilcoaviation.com
2. Chat routes through Cloudflare Worker to Jerry relay
3. Jerry responds using knowledge base (services, capabilities, scheduling)
4. If quote needed → Jerry creates draft order in Shopify
5. Jerry notifies John via WhatsApp/iMessage

**Content Update Flow**:
1. John tells Jerry to update a service page
2. Jerry updates content via Shopify metafields or headless CMS
3. Jerry triggers Cloudflare cache purge
4. Jerry confirms update with preview URL

---

## 6. Immediate Next Steps

### Step 0: Prerequisites (Manual — John)
- [ ] Verify existing Shopify custom app status (Settings → Apps → Develop apps)
- [ ] If existing app: note the Admin API access token and scopes
- [ ] If no existing app: create one via Dev Dashboard with OAuth
- [ ] Install Headless channel in Shopify admin for Storefront API tokens
- [ ] Store all tokens in Keeper vault

### Step 1: Shopify MCP Server for Jerry
- [ ] Build TypeScript MCP server (`shopify-mcp-server`)
- [ ] Implement core tools: products, orders, inventory, customers, content
- [ ] Deploy to Jerry's Mac Mini as stdio transport
- [ ] Register in Jerry's OpenClaw config
- [ ] Test with real store data

### Step 2: Seed the Next.js Project
- [ ] Fork/evolve `vibe-coding-starter` into `rwas-web`
- [ ] Configure Shopify Storefront API client
- [ ] Port brand tokens (colors, typography) into Tailwind config
- [ ] Build homepage with hero video, NDT section, fabrication showcase
- [ ] Build product browsing pages pulling from Storefront API
- [ ] Build cart/checkout flow routing to Shopify Checkout

### Step 3: Deploy to Cloudflare Pages
- [ ] Configure Cloudflare Pages project for `rwas-web`
- [ ] Set up build pipeline (Next.js → Cloudflare Pages adapter)
- [ ] Configure DNS: rogerwilcoaviation.com → Cloudflare Pages
- [ ] Deploy Cloudflare Workers for API caching and Jerry relay

### Step 4: Jerry Integration
- [ ] Build chatbot component in Next.js frontend
- [ ] Route chat through jerry-api.rwas.team
- [ ] Connect Jerry's Shopify MCP for draft order creation
- [ ] Enable content management workflows

### Step 5: Launch
- [ ] Migrate all content pages to Next.js
- [ ] Fix broken pages (Financing, Contact)
- [ ] Build actual blog with CMS
- [ ] Panel Planner as proper React app (not Liquid-embedded)
- [ ] QA pass across all pages
- [ ] DNS cutover from Shopify rendering to Cloudflare Pages
- [ ] Shopify checkout domain remains on Shopify infrastructure

---

## 7. Brand Tokens

```css
/* RWAS Brand Colors */
--rwas-black: #111111;
--rwas-gold: #C49A2A;
--rwas-cream: #f5f3ef;
--rwas-white: #ffffff;

/* Typography — to be confirmed from current theme */
/* Current site uses system fonts; recommend defining explicit stack */
```

---

## 8. Reference Links

| Resource | URL |
|----------|-----|
| Live site | https://rogerwilcoaviation.com |
| Shopify Admin | https://admin.shopify.com/store/rogerwilcoaviation |
| GitHub prototype | https://github.com/rogerwilcoaviation/vibe-coding-starter |
| Vercel prototype | https://vibe-coding-starter-mnzncwcu4-johns-projects-022206dc.vercel.app |
| Jerry tunnel | https://jerry.rwas.team |
| Jerry API relay | https://jerry-api.rwas.team |
| Shopify Storefront API docs | https://shopify.dev/docs/api/storefront/latest |
| Shopify Admin API docs | https://shopify.dev/docs/api/admin-graphql/latest |
| Cloudflare Pages docs | https://developers.cloudflare.com/pages |
