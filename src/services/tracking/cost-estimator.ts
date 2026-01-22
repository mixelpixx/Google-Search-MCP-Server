/**
 * Cost estimation for different search providers
 * Based on published pricing as of implementation date
 */

export interface ProviderPricing {
  freeTierQueries: number;        // Free queries per billing period
  billingPeriod: 'day' | 'month';  // Billing period type
  costPerQuery: number;            // Cost per query after free tier (USD)
  currency: string;                // Currency (USD)
}

/**
 * Pricing information for each provider
 * Updated: 2025-01
 */
export const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  google: {
    freeTierQueries: 100,
    billingPeriod: 'day',
    costPerQuery: 0.005,  // $5 per 1,000 queries
    currency: 'USD'
  },
  brave: {
    freeTierQueries: 2000,
    billingPeriod: 'month',
    costPerQuery: 0.0006,  // $3 per 5,000 queries = $0.0006/query
    currency: 'USD'
  },
  tavily: {
    freeTierQueries: 1000,
    billingPeriod: 'month',
    costPerQuery: 0.0075,  // $30 per 4,000 queries = $0.0075/query
    currency: 'USD'
  }
};

/**
 * Calculate estimated cost for a provider based on usage
 */
export function estimateCost(provider: string, queryCount: number): number {
  const pricing = PROVIDER_PRICING[provider.toLowerCase()];

  if (!pricing) {
    // Unknown provider, estimate $0
    return 0;
  }

  // If within free tier, cost is $0
  if (queryCount <= pricing.freeTierQueries) {
    return 0;
  }

  // Calculate paid queries
  const paidQueries = queryCount - pricing.freeTierQueries;
  const cost = paidQueries * pricing.costPerQuery;

  // Round to 4 decimal places
  return Math.round(cost * 10000) / 10000;
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(cost);
}

/**
 * Get free tier information for a provider
 */
export function getFreeTierInfo(provider: string): { limit: number; period: string } | null {
  const pricing = PROVIDER_PRICING[provider.toLowerCase()];

  if (!pricing) {
    return null;
  }

  return {
    limit: pricing.freeTierQueries,
    period: pricing.billingPeriod
  };
}

/**
 * Calculate days in current billing period
 */
export function getDaysInBillingPeriod(provider: string): number {
  const pricing = PROVIDER_PRICING[provider.toLowerCase()];

  if (!pricing) {
    return 30; // Default to monthly
  }

  if (pricing.billingPeriod === 'day') {
    return 1;
  }

  // For monthly, calculate days in current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return daysInMonth;
}
