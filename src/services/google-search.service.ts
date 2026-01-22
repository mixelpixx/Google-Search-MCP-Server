import { SearchResult, SearchFilters, SearchPaginationInfo, CategoryInfo } from '../types.js';
import { ProviderFactory } from './providers/provider-factory.js';
import { BaseSearchProvider } from './providers/base-provider.js';

interface CacheEntry {
  timestamp: number;
  data: {
    results: SearchResult[];
    pagination?: SearchPaginationInfo;
    categories?: CategoryInfo[];
  };
}

export class GoogleSearchService {
  // Cache for search results (key: query string + filters, value: results)
  private searchCache: Map<string, CacheEntry> = new Map();
  // Cache expiration time in milliseconds (5 minutes)
  private cacheTTL: number = 5 * 60 * 1000;
  private provider: BaseSearchProvider;

  constructor() {
    // Get the configured search provider from the factory
    const factory = ProviderFactory.getInstance();
    this.provider = factory.getProvider();
  }

  /**
   * Generate a cache key from search parameters
   * Includes provider name to prevent cache pollution between providers
   */
  private generateCacheKey(query: string, numResults: number, filters?: SearchFilters): string {
    const providerInfo = this.provider.getProviderInfo();
    return JSON.stringify({
      provider: providerInfo.name,  // Prevents cross-provider cache collision
      query,
      numResults,
      filters
    });
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp < this.cacheTTL;
  }

  /**
   * Store search results in cache
   */
  private cacheSearchResults(
    cacheKey: string, 
    results: SearchResult[], 
    pagination?: SearchPaginationInfo, 
    categories?: CategoryInfo[]
  ): void {
    this.searchCache.set(cacheKey, {
      timestamp: Date.now(),
      data: { results, pagination, categories }
    });
    
    // Limit cache size to prevent memory issues (max 100 entries)
    if (this.searchCache.size > 100) {
      // Delete oldest entry
      const oldestKey = Array.from(this.searchCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.searchCache.delete(oldestKey);
    }
  }

  async search(query: string, numResults: number = 5, filters?: SearchFilters): Promise<{
    results: SearchResult[];
    pagination?: SearchPaginationInfo;
    categories?: CategoryInfo[];
  }> {
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(query, numResults, filters);

      // Check cache first
      const cachedResult = this.searchCache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        console.error('Using cached search results');
        return cachedResult.data;
      }

      // Delegate to the provider
      const providerResponse = await this.provider.search(query, numResults, filters);

      // Cache the results before returning
      this.cacheSearchResults(
        cacheKey,
        providerResponse.results,
        providerResponse.pagination,
        providerResponse.categories
      );

      return providerResponse;
    } catch (error: any) {
      // Re-throw errors from provider as-is
      throw error;
    }
  }
}
