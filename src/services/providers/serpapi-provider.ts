import { SearchResult, SearchFilters, SearchPaginationInfo } from '../../types.js';
import { BaseSearchProvider, ProviderInfo, ProviderError, ProviderSearchResponse } from './base-provider.js';

/**
 * SerpAPI provider implementation
 * Uses SerpAPI's Google Search engine: https://serpapi.com/search-api
 */
export class SerpAPIProvider extends BaseSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://serpapi.com/search';

  constructor() {
    super();
    this.validateConfiguration();
    this.apiKey = process.env.SERPAPI_KEY!;
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'serpapi',
      displayName: 'SerpAPI',
      requiresApiKey: true,
      freeTierLimit: '100 searches/month',
      paidPricing: '$50/month for 5,000 searches',
      bestFor: 'Reliable Google search results with good free tier'
    };
  }

  validateConfiguration(): void {
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      throw new ProviderError(
        'Missing required SerpAPI configuration',
        'serpapi',
        true,
        [
          'Set SERPAPI_KEY in your .env file',
          'Get API key: https://serpapi.com/manage-api-key',
          'Free tier: 100 searches/month',
          'Paid plans start at $50/month for 5,000 searches'
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

      // Apply site filter if provided
      if (filters?.site) {
        formattedQuery += ` site:${filters.site}`;
      }

      // Apply exact terms if provided
      if (filters?.exactTerms) {
        formattedQuery += ` "${filters.exactTerms}"`;
      }

      // Build URL parameters
      const params = new URLSearchParams({
        api_key: this.apiKey,
        engine: 'google',
        q: formattedQuery,
        num: Math.min(numResults, 100).toString() // SerpAPI max is 100
      });

      // Apply language filter if provided
      if (filters?.language) {
        params.append('hl', filters.language);
        params.append('gl', filters.language); // Also set country
      }

      // Apply date restriction if provided
      if (filters?.dateRestrict) {
        // Convert Google's dateRestrict format to SerpAPI's tbs format
        // Google: d7, w1, m6, y1 -> SerpAPI: qdr:d, qdr:w, qdr:m, qdr:y
        const match = filters.dateRestrict.match(/^([dwmy])(\d+)$/);
        if (match) {
          const [, unit, _value] = match;
          const tbsMap: Record<string, string> = {
            'd': 'qdr:d',
            'w': 'qdr:w', 
            'm': 'qdr:m',
            'y': 'qdr:y'
          };
          params.append('tbs', tbsMap[unit] || 'qdr:m');
        }
      }

      // Apply result type filter if provided
      if (filters?.resultType) {
        switch (filters.resultType.toLowerCase()) {
          case 'image':
          case 'images':
            params.set('engine', 'google_images');
            break;
          case 'news':
            params.set('engine', 'google_news');
            break;
          case 'video':
          case 'videos':
            params.set('engine', 'google_videos');
            break;
        }
      }

      // Handle pagination
      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const resultsPerPage = filters?.resultsPerPage ? Math.min(filters.resultsPerPage, 100) : Math.min(numResults, 100);
      
      if (page > 1) {
        const start = (page - 1) * resultsPerPage;
        params.append('start', start.toString());
      }
      params.set('num', resultsPerPage.toString());

      // Make API request
      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await fetch(url);

      // Handle errors
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Check for API errors in response body
      if (data.error) {
        throw new ProviderError(
          `SerpAPI Error: ${data.error}`,
          'serpapi',
          false,
          [data.error, 'Check your API key and usage limits at https://serpapi.com/account']
        );
      }

      // Extract results from SerpAPI response
      const organicResults = data.organic_results || [];
      
      if (organicResults.length === 0) {
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

      // Map SerpAPI results to SearchResult format
      const results: SearchResult[] = organicResults.map((item: any) => {
        const result: SearchResult = {
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
          pagemap: {
            // Try to preserve some metadata if available
            metatags: item.source ? [{ 'og:site_name': item.source }] : []
          },
          datePublished: item.date || '',
          source: 'serpapi'
        };

        result.category = this.categorizeResult(result);
        return result;
      });

      // Generate category statistics
      const categories = this.generateCategoryStats(results);

      // Create pagination information
      const searchInfo = data.search_information || {};
      const totalResults = parseInt(searchInfo.total_results || '0', 10);
      const totalPages = Math.ceil(totalResults / resultsPerPage);

      const pagination: SearchPaginationInfo = {
        currentPage: page,
        resultsPerPage,
        totalResults,
        totalPages,
        hasNextPage: page < totalPages && organicResults.length === resultsPerPage,
        hasPreviousPage: page > 1
      };

      return {
        results,
        pagination,
        categories
      };
    } catch (error: any) {
      // If it's already a ProviderError, re-throw it
      if (error instanceof ProviderError) {
        throw error;
      }

      // Handle fetch errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new ProviderError(
          'Network Error - Cannot Reach SerpAPI',
          'serpapi',
          false,
          [
            'Check your internet connection',
            'Verify firewall/proxy settings',
            'Check https://status.serpapi.com/ for outages'
          ]
        );
      }

      // Generic error
      throw new ProviderError(
        'SerpAPI Search Error',
        'serpapi',
        false,
        [error.message || 'Unknown error', 'Check logs for details']
      );
    }
  }

  /**
   * Handle HTTP error responses from SerpAPI
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    const errorMessage = errorData.error || response.statusText;

    // Rate limit / quota exceeded (429)
    if (response.status === 429) {
      throw new ProviderError(
        'SerpAPI Rate Limit Exceeded',
        'serpapi',
        false,
        [
          'Free tier: 100 searches/month (limit reached)',
          'Check usage: https://serpapi.com/account',
          'Upgrade plan: https://serpapi.com/pricing',
          'Current error: ' + errorMessage
        ]
      );
    }

    // Unauthorized (401) - invalid API key
    if (response.status === 401) {
      throw new ProviderError(
        'Invalid SerpAPI Key',
        'serpapi',
        true,
        [
          'Check SERPAPI_KEY in your .env file',
          'Get/verify API key: https://serpapi.com/manage-api-key',
          'Make sure you copied the key correctly'
        ]
      );
    }

    // Forbidden (403)
    if (response.status === 403) {
      throw new ProviderError(
        'SerpAPI Access Denied',
        'serpapi',
        false,
        [
          'Your account may be suspended or restricted',
          'Check account status: https://serpapi.com/account',
          'Contact support: https://serpapi.com/contact'
        ]
      );
    }

    // Bad request (400)
    if (response.status === 400) {
      throw new ProviderError(
        'Invalid SerpAPI Request',
        'serpapi',
        false,
        [
          'Check your search parameters',
          'Error: ' + errorMessage,
          'See docs: https://serpapi.com/search-api'
        ]
      );
    }

    // Server error (500+)
    if (response.status >= 500) {
      throw new ProviderError(
        'SerpAPI Server Error',
        'serpapi',
        false,
        [
          'SerpAPI is experiencing issues',
          'Check status: https://status.serpapi.com/',
          'Try again in a few minutes'
        ]
      );
    }

    // Unknown error
    throw new ProviderError(
      `SerpAPI HTTP Error ${response.status}`,
      'serpapi',
      false,
      [errorMessage, 'Check https://serpapi.com/search-api for details']
    );
  }
}
