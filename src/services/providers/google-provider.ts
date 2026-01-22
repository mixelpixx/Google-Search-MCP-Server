import { SearchResult, SearchFilters, SearchPaginationInfo } from '../../types.js';
import { BaseSearchProvider, ProviderInfo, ProviderError, ProviderSearchResponse } from './base-provider.js';

/**
 * Google Custom Search provider implementation
 * Wraps the googleapis library (optional dependency)
 */
export class GoogleSearchProvider extends BaseSearchProvider {
  private customSearch;
  private searchEngineId: string;

  constructor() {
    super();

    // Validate configuration on construction
    this.validateConfiguration();

    const apiKey = process.env.GOOGLE_API_KEY!;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID!;

    // Try to load googleapis (optional dependency)
    let google;
    try {
      // Use dynamic require for optional dependency
      const googleapis = require('googleapis');
      google = googleapis.google;
    } catch (error) {
      throw new ProviderError(
        'googleapis package not installed',
        'google',
        true,
        [
          'Install googleapis: npm install googleapis',
          'Or switch to Brave: Set SEARCH_PROVIDER=brave in .env',
          'Or switch to Tavily: Set SEARCH_PROVIDER=tavily in .env',
          'Note: Google API sunsets January 1, 2027 - consider migrating'
        ]
      );
    }

    // Initialize Google Custom Search API
    this.customSearch = google.customsearch('v1').cse;
    google.options({ auth: apiKey });

    // Show sunset warning
    console.warn('⚠️  Google Custom Search will sunset on January 1, 2027');
    console.warn('    Consider migrating to Brave Search: https://brave.com/search/api/');
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'google',
      displayName: 'Google Custom Search',
      requiresApiKey: true,
      freeTierLimit: '100 queries/day',
      paidPricing: '$5 per 1,000 queries',
      bestFor: 'Legacy (sunsets January 1, 2027)'
    };
  }

  validateConfiguration(): void {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new ProviderError(
        'Missing required Google configuration',
        'google',
        true,
        [
          'Set GOOGLE_API_KEY in your .env file',
          'Set GOOGLE_SEARCH_ENGINE_ID in your .env file',
          'Get API key: https://console.cloud.google.com/apis/credentials',
          'Get Search Engine ID: https://programmablesearchengine.google.com/'
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

      // Set default pagination values if not provided
      const page = filters?.page && filters.page > 0 ? filters.page : 1;
      const resultsPerPage = filters?.resultsPerPage ? Math.min(filters.resultsPerPage, 10) : Math.min(numResults, 10);

      // Calculate start index for pagination (Google uses 1-based indexing)
      const startIndex = (page - 1) * resultsPerPage + 1;

      const params: any = {
        cx: this.searchEngineId,
        q: formattedQuery,
        num: resultsPerPage,
        start: startIndex
      };

      // Apply language filter if provided
      if (filters?.language) {
        params.lr = `lang_${filters.language}`;
      }

      // Apply date restriction if provided
      if (filters?.dateRestrict) {
        params.dateRestrict = filters.dateRestrict;
      }

      // Apply result type filter if provided
      if (filters?.resultType) {
        switch (filters.resultType.toLowerCase()) {
          case 'image':
          case 'images':
            params.searchType = 'image';
            break;
          case 'news':
            formattedQuery += ' source:news';
            params.q = formattedQuery;
            break;
          case 'video':
          case 'videos':
            formattedQuery += ' filetype:video OR inurl:video OR inurl:watch';
            params.q = formattedQuery;
            break;
        }
      }

      // Apply sorting if provided
      if (filters?.sort) {
        switch (filters.sort.toLowerCase()) {
          case 'date':
            params.sort = 'date';
            break;
          case 'relevance':
          default:
            // Google's default sort is by relevance
            break;
        }
      }

      const response = await this.customSearch.list(params);

      // If no items are found, return empty results
      if (!response.data.items) {
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

      // Map the search results and categorize them
      const results = response.data.items.map((item: any) => {
        const result: SearchResult = {
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
          pagemap: item.pagemap || {},
          datePublished: item.pagemap?.metatags?.[0]?.['article:published_time'] || '',
          source: 'google_search'
        };

        result.category = this.categorizeResult(result);
        return result;
      });

      // Generate category statistics
      const categories = this.generateCategoryStats(results);

      // Create pagination information
      const totalResults = parseInt(response.data.searchInformation?.totalResults || '0', 10);
      const totalPages = Math.ceil(totalResults / resultsPerPage);

      const pagination: SearchPaginationInfo = {
        currentPage: page,
        resultsPerPage,
        totalResults,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      return {
        results,
        pagination,
        categories
      };
    } catch (error: any) {
      // Rate limit (429)
      if (error.response?.status === 429 || error.code === 429) {
        throw new ProviderError(
          'Google API Rate Limit Exceeded',
          'google',
          false,
          [
            'Free tier: 100 queries/day (limit reached)',
            'Solution 1: Wait until tomorrow for reset',
            'Solution 2: Enable billing at https://console.cloud.google.com/',
            'Cost: $5 per 1,000 queries after free tier',
            'Alternative: Switch to Brave Search (2,000 free/month)',
            'Monitor usage: https://console.cloud.google.com/apis/dashboard'
          ]
        );
      }

      // Forbidden (403)
      if (error.response?.status === 403 || error.code === 403) {
        const errorDetails = error.response?.data?.error?.message || error.message || '';

        if (errorDetails.includes('disabled') || errorDetails.includes('not been used') || errorDetails.includes('not enabled')) {
          throw new ProviderError(
            'Custom Search API Not Enabled',
            'google',
            true,
            [
              'Go to: https://console.cloud.google.com/apis/library/customsearch.googleapis.com',
              'Click "Enable" for Custom Search API',
              'Wait 2-3 minutes for activation'
            ]
          );
        }

        if (errorDetails.includes('quota') || errorDetails.includes('billing') || errorDetails.includes('exceeded')) {
          throw new ProviderError(
            'API Quota/Billing Issue',
            'google',
            false,
            [
              'You exceeded the free 100 queries/day',
              'Enable billing: https://console.cloud.google.com/billing',
              'Or wait until tomorrow for quota reset',
              'Alternative: Switch to Brave Search (2,000 free/month)'
            ]
          );
        }

        throw new ProviderError(
          'API Access Denied (403)',
          'google',
          true,
          [
            'Check your API key is correct in .env file',
            'Verify Custom Search API is enabled',
            'Check billing is enabled if over 100 queries/day',
            `Error details: ${errorDetails}`
          ]
        );
      }

      // Invalid API key (400)
      if (error.response?.status === 400 || error.code === 400) {
        throw new ProviderError(
          'Invalid API Request',
          'google',
          true,
          [
            'Check GOOGLE_API_KEY in your .env file',
            'Check GOOGLE_SEARCH_ENGINE_ID (cx parameter)',
            'Verify both are correctly formatted'
          ]
        );
      }

      // Generic API errors with response
      if (error.response) {
        throw new ProviderError(
          `Google API Error (${error.response.status})`,
          'google',
          false,
          [
            `Status: ${error.response.status}`,
            `Message: ${error.response?.data?.error?.message || 'Unknown error'}`,
            'If this persists, check https://status.cloud.google.com/'
          ]
        );
      }

      // Network errors
      if (error.request || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new ProviderError(
          'Network Error - Cannot Reach Google API',
          'google',
          false,
          [
            'Check your internet connection',
            'Verify firewall/proxy settings',
            'Check https://status.cloud.google.com/ for outages'
          ]
        );
      }

      // Unknown errors
      if (error instanceof Error) {
        throw new ProviderError(
          'Google Search Error',
          'google',
          false,
          [error.message, 'Check logs for details']
        );
      }

      throw new ProviderError(
        'Unknown error during Google search',
        'google',
        false,
        ['Check logs for details']
      );
    }
  }
}
