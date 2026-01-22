import Database from 'better-sqlite3';
import { estimateCost, formatCost, getFreeTierInfo, getDaysInBillingPeriod } from './cost-estimator.js';

/**
 * Usage record for a single search operation
 */
export interface UsageRecord {
  timestamp: number;
  provider: string;
  operation: string;
  query?: string;
  resultsCount: number;
  estimatedCost: number;
}

/**
 * Usage statistics for a time period
 */
export interface UsageStats {
  provider: string;
  totalSearches: number;
  totalResults: number;
  estimatedCost: number;
  period: {
    start: number;
    end: number;
  };
}

/**
 * Threshold warning
 */
export interface ThresholdWarning {
  type: 'searches' | 'cost';
  current: number;
  limit: number;
  percentage: number;
  message: string;
  suggestions: string[];
}

/**
 * Usage tracker with optional SQLite persistence
 */
export class UsageTracker {
  private db: Database.Database | null = null;
  private inMemoryRecords: UsageRecord[] = [];
  private enabled: boolean;
  private persistEnabled: boolean;
  private dbPath: string;

  // Threshold configuration
  private maxSearchesPerMonth: number;
  private maxCostPerMonth: number;

  constructor() {
    this.enabled = process.env.USAGE_TRACKING_ENABLED === 'true';
    this.persistEnabled = process.env.USAGE_TRACKING_PERSIST === 'true';
    this.dbPath = process.env.USAGE_TRACKING_DB_PATH || './.mcp-usage-tracking.db';

    this.maxSearchesPerMonth = parseInt(process.env.USAGE_MAX_SEARCHES_PER_MONTH || '0', 10);
    this.maxCostPerMonth = parseFloat(process.env.USAGE_MAX_COST_PER_MONTH || '0');

    if (this.enabled) {
      console.error('✓ Usage tracking enabled');

      if (this.persistEnabled) {
        this.initializeDatabase();
      } else {
        console.error('  In-memory tracking only (not persisted)');
      }
    }
  }

  /**
   * Initialize SQLite database for persistent tracking
   */
  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);

      // Create table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS usage_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          provider TEXT NOT NULL,
          operation TEXT NOT NULL,
          query TEXT,
          results_count INTEGER NOT NULL,
          estimated_cost REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_records(timestamp);
        CREATE INDEX IF NOT EXISTS idx_provider ON usage_records(provider);
      `);

      console.error(`✓ Usage tracking database initialized: ${this.dbPath}`);
    } catch (error) {
      console.error(`⚠️  Failed to initialize usage tracking database: ${error}`);
      console.error('  Falling back to in-memory tracking only');
      this.db = null;
      this.persistEnabled = false;
    }
  }

  /**
   * Track a search operation (non-blocking)
   */
  track(record: UsageRecord): void {
    if (!this.enabled) {
      return;
    }

    try {
      // Always track in memory
      this.inMemoryRecords.push(record);

      // Limit in-memory records to last 1000
      if (this.inMemoryRecords.length > 1000) {
        this.inMemoryRecords = this.inMemoryRecords.slice(-1000);
      }

      // Persist to database if enabled (non-blocking)
      if (this.db && this.persistEnabled) {
        const stmt = this.db.prepare(`
          INSERT INTO usage_records (timestamp, provider, operation, query, results_count, estimated_cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          record.timestamp,
          record.provider,
          record.operation,
          record.query || null,
          record.resultsCount,
          record.estimatedCost
        );
      }
    } catch (error) {
      // Never fail the search due to tracking errors
      console.error(`⚠️  Usage tracking error: ${error}`);
    }
  }

  /**
   * Get usage statistics for a time period
   */
  getStats(daysBack: number = 30): Map<string, UsageStats> {
    if (!this.enabled) {
      return new Map();
    }

    const now = Date.now();
    const startTime = now - (daysBack * 24 * 60 * 60 * 1000);

    const stats = new Map<string, UsageStats>();

    try {
      // Get records from database if available
      if (this.db && this.persistEnabled) {
        const rows = this.db.prepare(`
          SELECT provider, COUNT(*) as total_searches, SUM(results_count) as total_results, SUM(estimated_cost) as total_cost
          FROM usage_records
          WHERE timestamp >= ?
          GROUP BY provider
        `).all(startTime);

        rows.forEach((row: any) => {
          stats.set(row.provider, {
            provider: row.provider,
            totalSearches: row.total_searches,
            totalResults: row.total_results,
            estimatedCost: row.total_cost,
            period: { start: startTime, end: now }
          });
        });
      } else {
        // Use in-memory records
        const relevantRecords = this.inMemoryRecords.filter(r => r.timestamp >= startTime);

        const providerMap = new Map<string, UsageRecord[]>();
        relevantRecords.forEach(record => {
          const records = providerMap.get(record.provider) || [];
          records.push(record);
          providerMap.set(record.provider, records);
        });

        providerMap.forEach((records, provider) => {
          stats.set(provider, {
            provider,
            totalSearches: records.length,
            totalResults: records.reduce((sum, r) => sum + r.resultsCount, 0),
            estimatedCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
            period: { start: startTime, end: now }
          });
        });
      }
    } catch (error) {
      console.error(`⚠️  Error getting usage stats: ${error}`);
    }

    return stats;
  }

  /**
   * Check if usage exceeds thresholds and return warnings
   */
  checkThresholds(daysBack: number = 30): ThresholdWarning | null {
    if (!this.enabled) {
      return null;
    }

    const stats = this.getStats(daysBack);

    // Sum across all providers
    let totalSearches = 0;
    let totalCost = 0;

    stats.forEach(stat => {
      totalSearches += stat.totalSearches;
      totalCost += stat.estimatedCost;
    });

    // Check search limit
    if (this.maxSearchesPerMonth > 0) {
      const percentage = (totalSearches / this.maxSearchesPerMonth) * 100;

      if (percentage >= 100) {
        return {
          type: 'searches',
          current: totalSearches,
          limit: this.maxSearchesPerMonth,
          percentage: 100,
          message: `⚠️  Search limit reached: ${totalSearches}/${this.maxSearchesPerMonth} searches this month`,
          suggestions: [
            'Consider upgrading your provider plan',
            'Switch to a provider with higher free tier',
            'Wait until next month for reset'
          ]
        };
      } else if (percentage >= 80) {
        return {
          type: 'searches',
          current: totalSearches,
          limit: this.maxSearchesPerMonth,
          percentage: Math.round(percentage),
          message: `⚠️  Approaching search limit: ${totalSearches}/${this.maxSearchesPerMonth} searches (${Math.round(percentage)}%)`,
          suggestions: [
            'Monitor your usage carefully',
            'Consider caching results when possible'
          ]
        };
      }
    }

    // Check cost limit
    if (this.maxCostPerMonth > 0) {
      const percentage = (totalCost / this.maxCostPerMonth) * 100;

      if (percentage >= 100) {
        return {
          type: 'cost',
          current: totalCost,
          limit: this.maxCostPerMonth,
          percentage: 100,
          message: `⚠️  Cost limit reached: ${formatCost(totalCost)}/${formatCost(this.maxCostPerMonth)} this month`,
          suggestions: [
            'Review your usage patterns',
            'Consider switching to a more cost-effective provider',
            'Implement query caching'
          ]
        };
      } else if (percentage >= 80) {
        return {
          type: 'cost',
          current: totalCost,
          limit: this.maxCostPerMonth,
          percentage: Math.round(percentage),
          message: `⚠️  Approaching cost limit: ${formatCost(totalCost)}/${formatCost(this.maxCostPerMonth)} (${Math.round(percentage)}%)`,
          suggestions: [
            'Monitor your usage carefully',
            'Review cost-effective alternatives'
          ]
        };
      }
    }

    return null;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
