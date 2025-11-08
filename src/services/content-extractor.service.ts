import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import MarkdownIt from 'markdown-it';
import { WebpageContent, OutputFormat } from '../types.js';
import TurndownService from 'turndown';

interface ContentCacheEntry {
  timestamp: number;
  content: WebpageContent;
}

export class ContentExtractor {
  private md: MarkdownIt;
  private turndownService: TurndownService;
  // Cache for webpage content (key: url + format, value: content)
  private contentCache: Map<string, ContentCacheEntry> = new Map();
  // Cache expiration time in milliseconds (30 minutes)
  private cacheTTL: number = 30 * 60 * 1000;

  constructor() {
    this.md = new MarkdownIt();
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  private cleanText(text: string): string {
    // Remove multiple blank lines
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    // Remove excessive spaces
    text = text.replace(/ +/g, ' ');
    return text.trim();
  }

  private cleanMarkdown(text: string): string {
    let cleanedText = this.cleanText(text);
    // Ensure headers have space after #
    cleanedText = cleanedText.replace(/#([A-Za-z0-9])/g, '# $1');
    return cleanedText;
  }

  private htmlToMarkdown(html: string): string {
    return this.cleanMarkdown(this.turndownService.turndown(html));
  }

  private htmlToPlainText(html: string): string {
    const dom = new JSDOM(html);
    return this.cleanText(dom.window.document.body.textContent || '');
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a cache key from URL and format
   */
  private generateCacheKey(url: string, format: OutputFormat): string {
    return `${url}|${format}`;
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(entry: ContentCacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp < this.cacheTTL;
  }

  /**
   * Store webpage content in cache
   */
  private cacheContent(url: string, format: OutputFormat, content: WebpageContent): void {
    const cacheKey = this.generateCacheKey(url, format);
    this.contentCache.set(cacheKey, {
      timestamp: Date.now(),
      content
    });
    
    // Limit cache size to prevent memory issues (max 50 entries)
    if (this.contentCache.size > 50) {
      // Delete oldest entry
      const oldestKey = Array.from(this.contentCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.contentCache.delete(oldestKey);
    }
  }

  /**
   * Generates a concise summary of the content
   * @param content The content to summarize
   * @param maxLength Maximum length of the summary
   * @returns A summary of the content
   */
  private generateSummary(content: string, maxLength: number = 300): string {
    // Simple summarization: take first few sentences up to maxLength
    const sentences = content.split(/(?<=[.!?])\s+/);
    let summary = '';
    
    for (const sentence of sentences) {
      if ((summary + sentence).length <= maxLength) {
        summary += sentence + ' ';
      } else {
        break;
      }
    }
    
    return summary.trim() + (summary.length < content.length ? '...' : '');
  }

  async extractContent(
    url: string,
    format: OutputFormat = 'markdown',
    options?: {
      maxLength?: number;
      previewLength?: number;
    }
  ): Promise<WebpageContent> {
    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL provided');
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(url, format);
    const cachedContent = this.contentCache.get(cacheKey);
    if (cachedContent && this.isCacheValid(cachedContent)) {
      console.error(`Using cached content for ${url}`);
      return cachedContent.content;
    }

    try {
      // Fetch webpage content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      // Parse with Cheerio for metadata
      const $ = cheerio.load(response.data);
      const metaTags: Record<string, string> = {};
      
      // Only extract the most important meta tags to reduce data volume
      const importantMetaTags = ['description', 'keywords', 'author', 'og:title', 'og:description', 'twitter:title', 'twitter:description'];
      
      $('meta').each((_, element) => {
        const name = $(element).attr('name') || $(element).attr('property') || '';
        const content = $(element).attr('content') || '';
        if (name && content && importantMetaTags.some(tag => name.includes(tag))) {
          metaTags[name] = content;
        }
      });

      // Use Readability for main content extraction
      const dom = new JSDOM(response.data);
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        throw new Error('Failed to extract content from webpage');
      }

      // Convert content based on requested format
      let contentStr: string;
      switch (format) {
        case 'html':
          contentStr = article.content || '';
          break;
        case 'text':
          contentStr = this.htmlToPlainText(article.content || '');
          break;
        case 'markdown':
        default:
          contentStr = this.htmlToMarkdown(article.content || '');
          break;
      }

      // Apply max length if specified
      if (options?.maxLength && contentStr.length > options.maxLength) {
        contentStr = contentStr.substring(0, options.maxLength) + '\n\n[Content truncated to max length]';
      }

      // Calculate content stats
      const wordCount = contentStr.split(/\s+/).filter(word => word.length > 0).length;

      // Generate a summary of the content
      const summary = this.generateSummary(contentStr);

      // Determine preview length
      const previewLength = options?.previewLength || 500;

      const content: WebpageContent = {
        url,
        title: ($('title').text() as string) || article.title || '',
        description: metaTags['description'] || '',
        content: contentStr,
        format: format,
        meta_tags: metaTags,
        stats: {
          word_count: wordCount,
          approximate_chars: contentStr.length
        },
        content_preview: {
          first_500_chars: contentStr.slice(0, previewLength) + (contentStr.length > previewLength ? '...' : '')
        },
        summary: summary
      };

      // Cache the content before returning
      this.cacheContent(url, format, content);

      return content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch webpage: ${error.message}`);
      }
      throw error;
    }
  }

  async batchExtractContent(urls: string[], format: OutputFormat = 'markdown'): Promise<Record<string, WebpageContent | { error: string }>> {
    const results: Record<string, WebpageContent | { error: string }> = {};

    await Promise.all(
      urls.map(async (url) => {
        try {
          results[url] = await this.extractContent(url, format);
        } catch (error) {
          results[url] = {
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
      })
    );

    return results;
  }
}
