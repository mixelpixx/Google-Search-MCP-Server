import axios from 'axios';
import { SearchResult, SearchFilters, SearchPaginationInfo } from '../../types.js';
import { BaseSearchProvider, ProviderInfo, ProviderError, ProviderSearchResponse } from './base-provider.js';

/**
 * Brave Search API provider implementation
 * API Documentation: https://api.search.brave.com/app/documentation/web-search/get-started
 */
export class BraveSearchProvider extends BaseSearchProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.search.brave.com/res/v1/web/search';

  constructor() {
    super();
    this.validateConfiguration();
    this.apiKey = process.env.BRAVE_API_KEY!;
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'brave',
      displayName: 'Brave Search',
      requiresApiKey: true,
      freeTierLimit: '2,000 queries/month',
      paidPricing: '$3/month (5,000 queries)',
      bestFor: 'General use, privacy-focused'
    };
  }

  validateConfiguration(): void {
    const apiKey = process.env.BRAVE_API_KEY;

    if (!apiKey) {
      throw new ProviderError(
        'Missing required Brave configuration',
        'brave',
        true,
        [
          'Set BRAVE_API_KEY in your .env file',
          'Get API key: https://api.search.brave.com/app/keys',
          'Free tier: 2,000 queries/month (no credit card required)',
          'Paid tier: $3/month for 5,000 queries'
        ]
      );
    }
  }

  async search(
    query: string,
    numResults: number = 5,
    filters?: SearchFilters
  ): Promise<ProviderSearchResponse> {
    try {
      let formattedQuery = query;

      // Apply site filter if provided (Brave API doesn't have site parameter, use query syntax)
      if (filters?.site) {
        formattedQuery += ` site:${filters.site}`;
      }

      // Apply exact terms if provided
      if (filters?.exactTerms) {
        formattedQuery += ` "${filters.exactTerms}"`;
      }

      // Set default pagination values
      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const resultsPerPage = filters?.resultsPerPage ? Math.min(filters.resultsPerPage, 20) : Math.min(numResults, 20);

      // Calculate offset for pagination (0-based)
      const offset = (page - 1) * resultsPerPage;

      const params: any = {
        q: formattedQuery,
        count: resultsPerPage,
        offset: offset
      };

      // Apply language filter if provided
      // Brave uses country codes, we'll map common language codes
      if (filters?.language) {
        const langMap: Record<string, string> = {
          'en': 'en',
          'es': 'es',
          'fr': 'fr',
          'de': 'de',
          'it': 'it',
          'pt': 'pt',
          'ru': 'ru',
          'ja': 'ja',
          'ko': 'ko',
          'zh': 'zh'
        };
        const mappedLang = langMap[filters.language.toLowerCase()];
        if (mappedLang) {
          params.country = mappedLang;
        }
      }

      // Apply date restriction if provided (map Google format to Brave freshness)
      if (filters?.dateRestrict) {
        // Google: d[number], w[number], m[number], y[number]
        // Brave: pd (past day), pw (past week), pm (past month), py (past year)
        const dateMatch = filters.dateRestrict.match(/^([dwmy])(\d+)$/);
        if (dateMatch) {
          const [, unit, value] = dateMatch;
          const numValue = parseInt(value, 10);

          if (unit === 'd' && numValue <= 1) {
            params.freshness = 'pd';
          } else if (unit === 'd' && numValue <= 7 || unit === 'w' && numValue <= 1) {
            params.freshness = 'pw';
          } else if (unit === 'd' && numValue <= 30 || unit === 'w' && numValue <= 4 || unit === 'm' && numValue <= 1) {
            params.freshness = 'pm';
          } else if (unit === 'y' && numValue <= 1) {
            params.freshness = 'py';
          }
        }
      }

      // Brave API doesn't support image/video filters directly
      // resultType filter is ignored for Brave

      const response = await axios.get(this.baseUrl, {
        params,
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey
        },
        timeout: 10000
      });

      // Check if we got results
      if (!response.data.web?.results || response.data.web.results.length === 0) {
        return {
          results: [],
          pagination: {
            currentPage: page,
            resultsPerPage,
            totalResults: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: page > 1
          },
          categories: []
        };
      }

      // Map Brave results to our SearchResult format
      const results: SearchResult[] = response.data.web.results.map((item: any) => {
        const result: SearchResult = {
          title: item.title || '',
          link: item.url || '',
          snippet: item.description || '',
          pagemap: {},
          datePublished: item.age || '',
          source: 'google_search'  // Keep as 'google_search' for compatibility
        };

        result.category = this.categorizeResult(result);
        return result;
      });

      // Generate category statistics
      const categories = this.generateCategoryStats(results);

      // Create pagination information
      // Brave doesn't always provide total results, estimate based on response
      const totalResults = response.data.web.total_results || results.length;
      const totalPages = Math.ceil(totalResults / resultsPerPage);

      const pagination: SearchPaginationInfo = {
        currentPage: page,
        resultsPerPage,
        totalResults,
        totalPages,
        hasNextPage: results.length === resultsPerPage && page < totalPages,
        hasPreviousPage: page > 1
      };

      return {
        results,
        pagination,
        categories
      };
    } catch (error: any) {
      // Handle Brave API errors
      if (axios.isAxiosError(error)) {
        // Rate limit (429)
        if (error.response?.status === 429) {
          throw new ProviderError(
            'Brave API Rate Limit Exceeded',
            'brave',
            false,
            [
              'Free tier: 2,000 queries/month (limit reached)',
              'Solution 1: Wait until next month for reset',
              'Solution 2: Upgrade plan at https://api.search.brave.com/app/subscriptions',
              'Paid tier: $3/month for 5,000 queries',
              'Alternative: Switch to Google or Tavily provider'
            ]
          );
        }

        // Unauthorized (401)
        if (error.response?.status === 401) {
          throw new ProviderError(
            'Invalid Brave API Key',
            'brave',
            true,
            [
              'Check BRAVE_API_KEY in your .env file',
              'Get API key: https://api.search.brave.com/app/keys',
              'Ensure the key is active and not expired'
            ]
          );
        }

        // Forbidden (403)
        if (error.response?.status === 403) {
          throw new ProviderError(
            'Brave API Access Denied',
            'brave',
            true,
            [
              'Your API key may not have access to this endpoint',
              'Verify your subscription status: https://api.search.brave.com/app/subscriptions',
              'Contact Brave support if issue persists'
            ]
          );
        }

        // Bad Request (400)
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.message || 'Invalid request';
          throw new ProviderError(
            'Invalid Brave API Request',
            'brave',
            false,
            [
              `Error: ${errorMessage}`,
              'Check your search query and filters',
              'Ensure parameters are valid'
            ]
          );
        }

        // Generic API errors
        if (error.response) {
          throw new ProviderError(
            `Brave API Error (${error.response.status})`,
            'brave',
            false,
            [
              `Status: ${error.response.status}`,
              `Message: ${error.response?.data?.message || 'Unknown error'}`,
              'Check https://status.brave.com/ for service status'
            ]
          );
        }

        // Network errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new ProviderError(
            'Network Error - Cannot Reach Brave API',
            'brave',
            false,
            [
              'Check your internet connection',
              'Verify firewall/proxy settings',
              'Check https://status.brave.com/ for outages'
            ]
          );
        }
      }

      // Unknown errors
      if (error instanceof Error) {
        throw new ProviderError(
          'Brave Search Error',
          'brave',
          false,
          [error.message, 'Check logs for details']
        );
      }

      throw new ProviderError(
        'Unknown error during Brave search',
        'brave',
        false,
        ['Check logs for details']
      );
    }
  }
}
