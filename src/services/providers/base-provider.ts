import { SearchResult, SearchFilters, SearchPaginationInfo, CategoryInfo } from '../../types.js';

/**
 * Provider information
 */
export interface ProviderInfo {
  name: string;
  displayName: string;
  requiresApiKey: boolean;
  freeTierLimit?: string;
  paidPricing?: string;
  bestFor?: string;
}

/**
 * Provider-specific error with recovery steps
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public isConfigurationError: boolean = false,
    public recoverySuggestions: string[] = []
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Search response from provider
 */
export interface ProviderSearchResponse {
  results: SearchResult[];
  pagination?: SearchPaginationInfo;
  categories?: CategoryInfo[];
}

/**
 * Abstract base class for all search providers
 * Defines the contract that all providers must implement
 */
export abstract class BaseSearchProvider {
  /**
   * Get information about this provider
   */
  abstract getProviderInfo(): ProviderInfo;

  /**
   * Perform a search operation
   * @param query Search query string
   * @param numResults Number of results to return
   * @param filters Optional search filters
   * @returns Search results with pagination and category info
   */
  abstract search(
    query: string,
    numResults: number,
    filters?: SearchFilters
  ): Promise<ProviderSearchResponse>;

  /**
   * Validate provider configuration (API keys, etc.)
   * @throws ProviderError if configuration is invalid
   */
  abstract validateConfiguration(): void;

  /**
   * Categorizes a search result based on its content
   * Shared implementation that can be overridden by providers
   */
  protected categorizeResult(result: SearchResult): string {
    try {
      const url = new URL(result.link);
      const domain = url.hostname.replace(/^www\./, '');

      // Check if this is a social media site
      if (domain.match(/facebook\.com|twitter\.com|instagram\.com|linkedin\.com|pinterest\.com|tiktok\.com|reddit\.com/i)) {
        return 'Social Media';
      }

      // Check if this is a video site
      if (domain.match(/youtube\.com|vimeo\.com|dailymotion\.com|twitch\.tv/i)) {
        return 'Video';
      }

      // Check if this is a news site
      if (domain.match(/news|cnn\.com|bbc\.com|nytimes\.com|wsj\.com|reuters\.com|bloomberg\.com/i)) {
        return 'News';
      }

      // Check if this is an educational site
      if (domain.match(/\.edu$|wikipedia\.org|khan|course|learn|study|academic/i)) {
        return 'Educational';
      }

      // Check if this is a documentation site
      if (domain.match(/docs|documentation|developer|github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com/i) ||
          result.title.match(/docs|documentation|api|reference|manual/i)) {
        return 'Documentation';
      }

      // Check if this is a shopping site
      if (domain.match(/amazon\.com|ebay\.com|etsy\.com|walmart\.com|shop|store|buy/i)) {
        return 'Shopping';
      }

      // Default category based on domain
      return domain.split('.').slice(-2, -1)[0].charAt(0).toUpperCase() + domain.split('.').slice(-2, -1)[0].slice(1);

    } catch (error) {
      return 'Other';
    }
  }

  /**
   * Generates category statistics from search results
   * Shared implementation that can be overridden by providers
   */
  protected generateCategoryStats(results: SearchResult[]): CategoryInfo[] {
    const categoryCounts: Record<string, number> = {};

    results.forEach(result => {
      const category = result.category || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}
