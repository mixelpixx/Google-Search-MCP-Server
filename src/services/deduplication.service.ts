import crypto from 'crypto';
import { URL } from 'url';
import { SearchResult } from '../types.js';

export class DeduplicationService {
  /**
   * Deduplicate search results based on URL and content similarity
   */
  deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seenUrls = new Set<string>();
    const seenContentHashes = new Set<string>();
    const uniqueResults: SearchResult[] = [];

    for (const result of results) {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(result.link);

      // Create content hash from snippet
      const contentHash = this.hashContent(result.snippet);

      // Check if we've seen this URL or similar content before
      if (!seenUrls.has(normalizedUrl) && !seenContentHashes.has(contentHash)) {
        seenUrls.add(normalizedUrl);
        seenContentHashes.add(contentHash);
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  }

  /**
   * Normalize URL for deduplication
   * Removes query parameters, fragments, trailing slashes, and www prefix
   */
  private normalizeUrl(urlString: string): string {
    try {
      const url = new URL(urlString);

      // Remove www prefix
      let hostname = url.hostname.toLowerCase();
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }

      // Remove trailing slash from pathname
      const pathname = url.pathname.replace(/\/$/, '');

      // Construct normalized URL (without query params and fragments)
      return `${url.protocol}//${hostname}${pathname}`;
    } catch {
      // If URL parsing fails, return original
      return urlString.toLowerCase();
    }
  }

  /**
   * Create a hash of content for similarity detection
   */
  private hashContent(content: string): string {
    // Normalize content before hashing
    const normalized = this.normalizeContent(content);

    // Create MD5 hash
    return crypto
      .createHash('md5')
      .update(normalized)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for efficiency
  }

  /**
   * Normalize content for comparison
   * Removes extra whitespace, converts to lowercase, removes punctuation
   */
  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Calculate content similarity between two strings using Jaccard similarity
   */
  calculateSimilarity(content1: string, content2: string): number {
    const words1 = new Set(this.normalizeContent(content1).split(' '));
    const words2 = new Set(this.normalizeContent(content2).split(' '));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Advanced deduplication with similarity threshold
   * Removes results that are too similar to each other
   */
  deduplicateWithSimilarity(
    results: SearchResult[],
    similarityThreshold: number = 0.7
  ): SearchResult[] {
    const uniqueResults: SearchResult[] = [];

    for (const result of results) {
      let isDuplicate = false;

      // Check against all accepted results
      for (const uniqueResult of uniqueResults) {
        // First check URL normalization
        if (this.normalizeUrl(result.link) === this.normalizeUrl(uniqueResult.link)) {
          isDuplicate = true;
          break;
        }

        // Then check content similarity
        const similarity = this.calculateSimilarity(result.snippet, uniqueResult.snippet);
        if (similarity >= similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  }

  /**
   * Detect and group duplicate sources
   * Returns groups of similar results
   */
  groupDuplicates(results: SearchResult[]): SearchResult[][] {
    const groups: SearchResult[][] = [];

    for (const result of results) {
      let added = false;

      // Try to add to existing group
      for (const group of groups) {
        const firstInGroup = group[0];

        // Check if similar to first item in group
        if (
          this.normalizeUrl(result.link) === this.normalizeUrl(firstInGroup.link) ||
          this.calculateSimilarity(result.snippet, firstInGroup.snippet) >= 0.7
        ) {
          group.push(result);
          added = true;
          break;
        }
      }

      // Create new group if not added to existing
      if (!added) {
        groups.push([result]);
      }
    }

    return groups;
  }

  /**
   * Remove Reddit duplicate threads
   * Handles cases where same Reddit discussion has different URLs
   */
  deduplicateRedditThreads(results: SearchResult[]): SearchResult[] {
    const seenRedditThreads = new Set<string>();
    const filtered: SearchResult[] = [];

    for (const result of results) {
      if (result.link.includes('reddit.com')) {
        // Extract thread ID from Reddit URL
        const threadId = this.extractRedditThreadId(result.link);

        if (threadId && seenRedditThreads.has(threadId)) {
          continue; // Skip duplicate Reddit thread
        }

        if (threadId) {
          seenRedditThreads.add(threadId);
        }
      }

      filtered.push(result);
    }

    return filtered;
  }

  /**
   * Extract Reddit thread ID from URL
   */
  private extractRedditThreadId(url: string): string | null {
    // Match patterns like /comments/abc123/ or /r/subreddit/comments/abc123/
    const match = url.match(/\/comments\/([a-z0-9]+)\//i);
    return match ? match[1] : null;
  }

  /**
   * Comprehensive deduplication that combines all methods
   */
  comprehensiveDeduplication(results: SearchResult[]): {
    deduplicated: SearchResult[];
    duplicatesRemoved: number;
    uniqueUrls: number;
  } {
    const originalCount = results.length;

    // Step 1: Remove exact URL duplicates
    let deduplicated = this.deduplicateResults(results);

    // Step 2: Remove Reddit duplicates
    deduplicated = this.deduplicateRedditThreads(deduplicated);

    // Step 3: Remove similar content
    deduplicated = this.deduplicateWithSimilarity(deduplicated, 0.75);

    const uniqueUrls = new Set(deduplicated.map(r => this.normalizeUrl(r.link))).size;

    return {
      deduplicated,
      duplicatesRemoved: originalCount - deduplicated.length,
      uniqueUrls
    };
  }
}
