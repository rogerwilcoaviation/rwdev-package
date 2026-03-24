// Shopify resource types for the RWAS MCP server

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  vendor: string;
  productType: string;
  tags: string[];
  descriptionHtml: string;
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
  images: {
    edges: Array<{
      node: ShopifyImage;
    }>;
  };
  metafields?: {
    edges: Array<{
      node: ShopifyMetafield;
    }>;
  };
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number;
  inventoryItem: {
    id: string;
  };
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ShopifyMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  totalPriceSet: {
    shopMoney: { amount: string; currencyCode: string };
  };
  customer: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        title: string;
        quantity: number;
        variant: {
          id: string;
          sku: string;
          price: string;
        } | null;
      };
    }>;
  };
}

export interface ShopifyDraftOrder {
  id: string;
  name: string;
  status: string;
  totalPrice: string;
  invoiceUrl: string;
  customer: {
    id: string;
    displayName: string;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        title: string;
        quantity: number;
        originalUnitPrice: string;
      };
    }>;
  };
}

export interface ShopifyCustomer {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  tags: string[];
  ordersCount: string;
  totalSpent: string;
  createdAt: string;
}

export interface ShopifyLocation {
  id: string;
  name: string;
  isActive: boolean;
  address: {
    address1: string;
    city: string;
    provinceCode: string;
    zip: string;
    countryCode: string;
  };
}

export interface ShopifyInventoryLevel {
  id: string;
  quantities: Array<{
    name: string;
    quantity: number;
  }>;
  location: {
    id: string;
    name: string;
  };
  item: {
    id: string;
    sku: string;
    variant: {
      id: string;
      displayName: string;
    };
  };
}

export interface ShopifyArticle {
  id: string;
  title: string;
  handle: string;
  body: string;
  summary: string | null;
  publishedAt: string | null;
  tags: string[];
  blog: {
    id: string;
    title: string;
  };
  image: ShopifyImage | null;
}

export interface ShopifyPage {
  id: string;
  title: string;
  handle: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyShop {
  name: string;
  primaryDomain: {
    url: string;
    host: string;
  };
  plan: {
    displayName: string;
  };
  currencyCode: string;
  timezoneAbbreviation: string;
  email: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
}

export interface UserError {
  field: string[] | null;
  message: string;
}

// RWAS-specific types
export interface GarminPricingEntry {
  partNumber: string;
  description: string;
  dealerCost: number;
  msrp: number;
}

export interface PriceUpdateResult {
  sku: string;
  productId: string;
  variantId: string;
  oldPrice: string;
  newPrice: string;
  compareAtPrice: string;
  status: "updated" | "created" | "not_found" | "error";
  error?: string;
}
