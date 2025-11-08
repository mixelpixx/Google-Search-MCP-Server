import { URL } from 'url';
import { SearchResult, WebpageContent } from '../types.js';

export enum SourceType {
  ACADEMIC = 'academic',
  OFFICIAL_DOCS = 'official_documentation',
  NEWS = 'news',
  BLOG = 'blog',
  FORUM = 'forum',
  SOCIAL = 'social_media',
  COMMERCIAL = 'commercial',
  UNKNOWN = 'unknown'
}

export interface SourceQuality {
  url: string;
  domain: string;
  type: SourceType;
  authority_score: number;  // 0.0 - 1.0
  recency_score: number;    // 0.0 - 1.0
  credibility_score: number; // Combined score
  author?: string;
  publication_date?: string;
  last_updated?: string;
}

export class SourceQualityService {
  /**
   * Assess the quality of a source
   */
  assessSource(url: string, content?: WebpageContent | string): SourceQuality {
    const domain = this.extractDomain(url);
    const sourceType = this.classifySourceType(url, domain);
    const authorityScore = this.assessAuthority(domain, sourceType);
    const recencyScore = this.assessRecency(content);
    const author = this.extractAuthor(content);
    const pubDate = this.extractPublicationDate(content);

    // Combined credibility score (weighted average)
    const credibilityScore = (authorityScore * 0.6) + (recencyScore * 0.4);

    return {
      url,
      domain,
      type: sourceType,
      authority_score: authorityScore,
      recency_score: recencyScore,
      credibility_score: credibilityScore,
      author,
      publication_date: pubDate
    };
  }

  /**
   * Rank sources by credibility
   */
  rankSources(sources: SearchResult[], contents?: Map<string, WebpageContent>): SearchResult[] {
    const scoredSources = sources.map(source => {
      const content = contents?.get(source.link);
      const quality = this.assessSource(source.link, content);

      return {
        ...source,
        quality_score: quality.credibility_score,
        source_type: quality.type,
        authority: quality.authority_score
      };
    });

    // Sort by quality score (highest first)
    return scoredSources.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Classify the type of source
   */
  private classifySourceType(url: string, domain: string): SourceType {
    const domainLower = domain.toLowerCase();
    const urlLower = url.toLowerCase();

    // Academic
    if (domainLower.match(/\.edu$|scholar|arxiv|ieee|acm\.org|pubmed|sciencedirect/i)) {
      return SourceType.ACADEMIC;
    }

    // Official documentation
    if (domainLower.match(/docs\.|documentation|developer|github\.com\/docs|microsoft\.com\/docs|python\.org|mozilla\.org|w3\.org/i)) {
      return SourceType.OFFICIAL_DOCS;
    }

    // News
    if (domainLower.match(/\.news|times|post|reuters|ap\.org|bbc\.|cnn\.|npr\.org|guardian|wsj|bloomberg/i)) {
      return SourceType.NEWS;
    }

    // Forums/Community
    if (domainLower.match(/stackoverflow|reddit|forum|discuss|community|hackernews|news\.ycombinator/i)) {
      return SourceType.FORUM;
    }

    // Social media
    if (domainLower.match(/twitter|linkedin|facebook|instagram|tiktok|x\.com/i)) {
      return SourceType.SOCIAL;
    }

    // Blogs
    if (domainLower.match(/blog|medium\.com|dev\.to|hashnode|substack/i)) {
      return SourceType.BLOG;
    }

    // Commercial
    if (domainLower.match(/\.com$/) && !domainLower.match(/github|gitlab/i)) {
      return SourceType.COMMERCIAL;
    }

    return SourceType.UNKNOWN;
  }

  /**
   * Assess domain authority
   */
  private assessAuthority(domain: string, sourceType: SourceType): number {
    // Base score by source type
    const typeScores: Record<SourceType, number> = {
      [SourceType.ACADEMIC]: 0.95,
      [SourceType.OFFICIAL_DOCS]: 0.90,
      [SourceType.NEWS]: 0.70,
      [SourceType.BLOG]: 0.50,
      [SourceType.FORUM]: 0.45,
      [SourceType.SOCIAL]: 0.30,
      [SourceType.COMMERCIAL]: 0.40,
      [SourceType.UNKNOWN]: 0.35
    };

    let baseScore = typeScores[sourceType];

    // Boost for high-authority domains
    const highAuthorityDomains = [
      'github.com', 'stackoverflow.com', 'microsoft.com', 'python.org',
      'mozilla.org', 'w3.org', 'ietf.org', 'arxiv.org', 'ieee.org',
      'acm.org', 'stanford.edu', 'mit.edu', 'nature.com', 'science.org',
      'nytimes.com', 'reuters.com', 'bbc.com', 'npr.org'
    ];

    for (const authDomain of highAuthorityDomains) {
      if (domain.includes(authDomain)) {
        baseScore = Math.min(1.0, baseScore + 0.1);
        break;
      }
    }

    // Boost for .gov, .edu, .org domains
    if (domain.match(/\.gov$/)) {
      baseScore = Math.min(1.0, baseScore + 0.15);
    } else if (domain.match(/\.edu$/)) {
      baseScore = Math.min(1.0, baseScore + 0.10);
    } else if (domain.match(/\.org$/)) {
      baseScore = Math.min(1.0, baseScore + 0.05);
    }

    return baseScore;
  }

  /**
   * Assess content recency
   */
  private assessRecency(content?: WebpageContent | string): number {
    if (!content) return 0.5; // Unknown recency

    const contentStr = typeof content === 'string' ? content : content.content;

    // Extract year mentions from content
    const yearMatches = contentStr.match(/\b(20\d{2})\b/g);

    if (!yearMatches || yearMatches.length === 0) {
      return 0.5; // Unknown recency
    }

    // Get the most recent year mentioned
    const latestYear = Math.max(...yearMatches.map(y => parseInt(y)));
    const currentYear = new Date().getFullYear();
    const age = currentYear - latestYear;

    // Score based on age
    if (age === 0) return 1.0;      // Current year
    if (age === 1) return 0.9;      // Last year
    if (age <= 2) return 0.7;       // 2 years old
    if (age <= 3) return 0.5;       // 3 years old
    if (age <= 5) return 0.3;       // 5 years old
    return 0.1;                      // Older than 5 years
  }

  /**
   * Extract author from content
   */
  private extractAuthor(content?: WebpageContent | string): string | undefined {
    if (!content) return undefined;

    const contentStr = typeof content === 'string' ? content : content.content;

    // Common patterns for author names
    const patterns = [
      /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
      /author:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /written by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];

    for (const pattern of patterns) {
      const match = contentStr.slice(0, 2000).match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Check meta tags if content is WebpageContent
    if (typeof content !== 'string' && content.meta_tags?.author) {
      return content.meta_tags.author;
    }

    return undefined;
  }

  /**
   * Extract publication date from content
   */
  private extractPublicationDate(content?: WebpageContent | string): string | undefined {
    if (!content) return undefined;

    const contentStr = typeof content === 'string' ? content : content.content;

    // Look for date patterns in first 2000 characters
    const datePatterns = [
      /published[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
      /(\w+\s+\d{1,2},?\s+\d{4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = contentStr.slice(0, 2000).match(pattern);
      if (match) {
        try {
          // Try to parse the date
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate quality metrics for a set of sources
   */
  calculateQualityMetrics(sources: SourceQuality[]): {
    source_diversity: number;
    average_authority: number;
    content_freshness: number;
    total_sources: number;
  } {
    if (sources.length === 0) {
      return {
        source_diversity: 0,
        average_authority: 0,
        content_freshness: 0,
        total_sources: 0
      };
    }

    // Source diversity (unique domains / total sources)
    const uniqueDomains = new Set(sources.map(s => s.domain));
    const sourceDiversity = uniqueDomains.size / sources.length;

    // Average authority
    const averageAuthority = sources.reduce((sum, s) => sum + s.authority_score, 0) / sources.length;

    // Content freshness (average recency)
    const contentFreshness = sources.reduce((sum, s) => sum + s.recency_score, 0) / sources.length;

    return {
      source_diversity: Math.round(sourceDiversity * 100) / 100,
      average_authority: Math.round(averageAuthority * 100) / 100,
      content_freshness: Math.round(contentFreshness * 100) / 100,
      total_sources: sources.length
    };
  }
}
