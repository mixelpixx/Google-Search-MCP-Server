import { BaseSearchProvider, ProviderError } from './base-provider.js';
import { GoogleSearchProvider } from './google-provider.js';
import { BraveSearchProvider } from './brave-provider.js';
import { TavilySearchProvider } from './tavily-provider.js';
import { TrackedProvider } from './tracked-provider.js';
import { UsageTracker } from '../tracking/usage-tracker.js';

/**
 * Factory for creating search providers
 * Implements the Factory pattern to create providers based on configuration
 */
export class ProviderFactory {
  private static instance: ProviderFactory;
  private provider: BaseSearchProvider | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of the factory
   */
  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  /**
   * Create and return the configured search provider
   * Defaults to Google if SEARCH_PROVIDER is not set (backwards compatibility)
   */
  getProvider(): BaseSearchProvider {
    if (this.provider) {
      return this.provider;
    }

    // Get provider type from environment, default to 'google' for backwards compatibility
    const providerType = (process.env.SEARCH_PROVIDER?.toLowerCase() || 'google').trim();

    console.error(`Initializing search provider: ${providerType}`);

    try {
      switch (providerType) {
        case 'google':
          this.provider = new GoogleSearchProvider();
          break;

        case 'brave':
          this.provider = new BraveSearchProvider();
          break;

        case 'tavily':
          this.provider = new TavilySearchProvider();
          break;

        default:
          console.warn(`⚠️  Unknown provider '${providerType}', falling back to Google`);
          this.provider = new GoogleSearchProvider();
          break;
      }

      const info = this.provider.getProviderInfo();
      console.error(`✓ Using ${info.displayName} as search provider`);

      if (info.freeTierLimit) {
        console.error(`  Free tier: ${info.freeTierLimit}`);
      }

      // Wrap with tracking decorator if enabled
      const trackingEnabled = process.env.USAGE_TRACKING_ENABLED === 'true';
      if (trackingEnabled) {
        const tracker = new UsageTracker();
        this.provider = new TrackedProvider(this.provider, tracker);
      }

      return this.provider;
    } catch (error) {
      if (error instanceof ProviderError) {
        // Format error message with recovery suggestions
        let message = `⚠️  ${error.message}\n`;
        if (error.recoverySuggestions.length > 0) {
          message += '\nRecovery steps:\n';
          error.recoverySuggestions.forEach(suggestion => {
            message += `  • ${suggestion}\n`;
          });
        }
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Reset the provider instance (useful for testing)
   */
  reset(): void {
    this.provider = null;
  }
}
