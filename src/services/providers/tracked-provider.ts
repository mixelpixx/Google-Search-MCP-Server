import { SearchFilters } from '../../types.js';
import { BaseSearchProvider, ProviderInfo, ProviderSearchResponse } from './base-provider.js';
import { UsageTracker } from '../tracking/usage-tracker.js';
import { estimateCost } from '../tracking/cost-estimator.js';

/**
 * Decorator that wraps any search provider with usage tracking
 * Implements the Decorator pattern for non-blocking tracking
 */
export class TrackedProvider extends BaseSearchProvider {
  constructor(
    private innerProvider: BaseSearchProvider,
    private tracker: UsageTracker
  ) {
    super();
  }

  getProviderInfo(): ProviderInfo {
    return this.innerProvider.getProviderInfo();
  }

  validateConfiguration(): void {
    this.innerProvider.validateConfiguration();
  }

  async search(
    query: string,
    numResults: number,
    filters?: SearchFilters
  ): Promise<ProviderSearchResponse> {
    const startTime = Date.now();

    // Execute the search
    const results = await this.innerProvider.search(query, numResults, filters);

    // Track usage (non-blocking, errors won't fail the search)
    try {
      const providerInfo = this.innerProvider.getProviderInfo();
      const timestamp = Date.now();

      // Calculate estimated cost (this is a single search)
      const estimatedCost = estimateCost(providerInfo.name, 1);

      // Track this operation
      this.tracker.track({
        timestamp,
        provider: providerInfo.name,
        operation: 'search',
        query: query.substring(0, 100), // Limit query length for storage
        resultsCount: results.results.length,
        estimatedCost
      });

      // Check thresholds and warn if approaching limits
      const warning = this.tracker.checkThresholds(30);
      if (warning) {
        console.warn(warning.message);
        if (warning.suggestions.length > 0) {
          console.warn('Suggestions:');
          warning.suggestions.forEach(suggestion => {
            console.warn(`  • ${suggestion}`);
          });
        }
      }
    } catch (trackingError) {
      // Never fail the search due to tracking errors
      console.error(`⚠️  Tracking error (non-fatal): ${trackingError}`);
    }

    return results;
  }
}
