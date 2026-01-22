import axios from 'axios';
import { SearchResult, SearchFilters, SearchPaginationInfo } from '../../types.js';
import { BaseSearchProvider, ProviderInfo, ProviderError, ProviderSearchResponse } from './base-provider.js';

/**
 * Tavily Search API provider implementation
 * API Documentation: https://docs.tavily.com/docs/tavily-api/rest_api
 *
 * Tavily is optimized for AI agents and research tasks
 */
export class TavilySearchProvider extends BaseSearchProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.tavily.com/search';

  constructor() {
    super();
    this.validateConfiguration();
    this.apiKey = process.env.TAVILY_API_KEY!;
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'tavily',
      displayName: 'Tavily Search',
      requiresApiKey: true,
      freeTierLimit: '1,000 queries/month',
      paidPricing: '$30/month (4,000 queries)',
      bestFor: 'AI agents, research tasks'
    };
  }

  validateConfiguration(): void {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      throw new ProviderError(
        'Missing required Tavily configuration',
        'tavily',
        true,
        [
          'Set TAVILY_API_KEY in your .env file',
          'Get API key: https://app.tavily.com/sign-in',
          'Free tier: 1,000 queries/month',
          'Paid tier: $30/month for 4,000 queries',
          'Best for: AI-powered research and synthesis'
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
      // Build include_domains array from site filter
      const includeDomains: string[] = [];
      if (filters?.site) {
        includeDomains.push(filters.site);
      }

      // Calculate days parameter from dateRestrict
      let days: number | undefined;
      if (filters?.dateRestrict) {
        const dateMatch = filters.dateRestrict.match(/^([dwmy])(\d+)$/);
        if (dateMatch) {
          const [, unit, value] = dateMatch;
          const numValue = parseInt(value, 10);

          switch (unit) {
            case 'd':
              days = numValue;
              break;
            case 'w':
              days = numValue * 7;
              break;
            case 'm':
              days = numValue * 30;
              break;
            case 'y':
              days = numValue * 365;
              break;
          }
        }
      }

      // Tavily API request body
      const requestBody: any = {
        api_key: this.apiKey,
        query: query,
        search_depth: 'advanced',  // Use advanced search for better results
        include_answer: false,      // We don't need the AI-generated answer
        max_results: Math.min(numResults, 10)  // Tavily max is 10
      };

      // Add include_domains if we have site filter
      if (includeDomains.length > 0) {
        requestBody.include_domains = includeDomains;
      }

      // Add days filter if we have date restriction
      if (days !== undefined) {
        requestBody.days = days;
      }

      const response = await axios.post(this.baseUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000  // Tavily can be slower due to advanced search
      });

      // Check if we got results
      if (!response.data.results || response.data.results.length === 0) {
        return {
          results: [],
          pagination: {
            currentPage: 1,
            resultsPerPage: numResults,
            totalResults: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
          },
          categories: []
        };
      }

      // Map Tavily results to our SearchResult format
      const results: SearchResult[] = response.data.results.map((item: any) => {
        const result: SearchResult = {
          title: item.title || '',
          link: item.url || '',
          snippet: item.content || '',  // Tavily provides 'content' instead of 'snippet'
          pagemap: {},
          datePublished: item.published_date || '',
          source: 'google_search'  // Keep as 'google_search' for compatibility
        };

        // Add Tavily-specific quality score if available
        if (item.score !== undefined) {
          result.quality_score = item.score;
        }

        result.category = this.categorizeResult(result);
        return result;
      });

      // Generate category statistics
      const categories = this.generateCategoryStats(results);

      // Tavily doesn't support pagination in the traditional sense
      // Each request is independent
      const pagination: SearchPaginationInfo = {
        currentPage: 1,
        resultsPerPage: results.length,
        totalResults: results.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      };

      return {
        results,
        pagination,
        categories
      };
    } catch (error: any) {
      // Handle Tavily API errors
      if (axios.isAxiosError(error)) {
        // Rate limit (429)
        if (error.response?.status === 429) {
          throw new ProviderError(
            'Tavily API Rate Limit Exceeded',
            'tavily',
            false,
            [
              'Free tier: 1,000 queries/month (limit reached)',
              'Solution 1: Wait until next month for reset',
              'Solution 2: Upgrade plan at https://app.tavily.com/billing',
              'Paid tier: $30/month for 4,000 queries',
              'Alternative: Switch to Brave (2,000 free/month) or Google provider'
            ]
          );
        }

        // Unauthorized (401)
        if (error.response?.status === 401) {
          throw new ProviderError(
            'Invalid Tavily API Key',
            'tavily',
            true,
            [
              'Check TAVILY_API_KEY in your .env file',
              'Get API key: https://app.tavily.com/sign-in',
              'Ensure the key is active and not expired'
            ]
          );
        }

        // Forbidden (403)
        if (error.response?.status === 403) {
          throw new ProviderError(
            'Tavily API Access Denied',
            'tavily',
            true,
            [
              'Your API key may not have access to this endpoint',
              'Verify your subscription status: https://app.tavily.com/billing',
              'Contact Tavily support if issue persists'
            ]
          );
        }

        // Bad Request (400)
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.detail || 'Invalid request';
          throw new ProviderError(
            'Invalid Tavily API Request',
            'tavily',
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
            `Tavily API Error (${error.response.status})`,
            'tavily',
            false,
            [
              `Status: ${error.response.status}`,
              `Message: ${error.response?.data?.detail || 'Unknown error'}`,
              'Check https://status.tavily.com/ for service status'
            ]
          );
        }

        // Network errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new ProviderError(
            'Network Error - Cannot Reach Tavily API',
            'tavily',
            false,
            [
              'Check your internet connection',
              'Verify firewall/proxy settings',
              'Check https://status.tavily.com/ for outages',
              'Note: Tavily searches can take 10-30 seconds (advanced mode)'
            ]
          );
        }
      }

      // Unknown errors
      if (error instanceof Error) {
        throw new ProviderError(
          'Tavily Search Error',
          'tavily',
          false,
          [error.message, 'Check logs for details']
        );
      }

      throw new ProviderError(
        'Unknown error during Tavily search',
        'tavily',
        false,
        ['Check logs for details']
      );
    }
  }
}
