import { BaseSearchProvider, ProviderError } from './base-provider.js';
import { SerpAPIProvider } from './serpapi-provider.js';
import { TrackedProvider } from './tracked-provider.js';
import { UsageTracker } from '../tracking/usage-tracker.js';

/**
 * Factory for creating search providers
 * Simplified to use SerpAPI as the sole provider
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
   * Create and return the SerpAPI search provider
   */
  getProvider(): BaseSearchProvider {
    if (this.provider) {
      return this.provider;
    }

    console.error('Initializing search provider: serpapi');

    try {
      this.provider = new SerpAPIProvider();

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
