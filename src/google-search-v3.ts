#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { GoogleSearchService } from './services/google-search.service.js';
import { ContentExtractor } from './services/content-extractor.service.js';
import { SourceQualityService } from './services/source-quality.service.js';
import { DeduplicationService } from './services/deduplication.service.js';
import { ResearchSynthesisService, ResearchDepth } from './services/research-synthesis.service.js';
import { OutputFormat, CacheInfo, ErrorContext } from './types.js';
import { z } from 'zod';
import express from 'express';

// Zod Schemas for validation
const SearchFiltersSchema = z.object({
  site: z.string().optional(),
  language: z.string().optional(),
  dateRestrict: z.string().optional(),
  exactTerms: z.string().optional(),
  resultType: z.string().optional(),
  page: z.number().optional(),
  resultsPerPage: z.number().optional(),
  sort: z.string().optional()
}).optional();

const SearchInputSchema = {
  query: z.string().describe('Search query - be specific and use quotes for exact matches. For best results, use clear keywords and avoid very long queries.'),
  num_results: z.number().optional().describe('Number of results to return (default: 5, max: 10). Increase for broader coverage, decrease for faster response.'),
  site: z.string().optional().describe('Limit search results to a specific website domain (e.g., "wikipedia.org" or "nytimes.com").'),
  language: z.string().optional().describe('Filter results by language using ISO 639-1 codes (e.g., "en" for English, "es" for Spanish, "fr" for French).'),
  dateRestrict: z.string().optional().describe('Filter results by date using Google\'s date restriction format: "d[number]" for past days, "w[number]" for past weeks, "m[number]" for past months, or "y[number]" for past years. Example: "m6" for results from the past 6 months.'),
  exactTerms: z.string().optional().describe('Search for results that contain this exact phrase. This is equivalent to putting the terms in quotes in the search query.'),
  resultType: z.string().optional().describe('Specify the type of results to return. Options include "image" (or "images"), "news", and "video" (or "videos"). Default is general web results.'),
  page: z.number().optional().describe('Page number for paginated results (starts at 1). Use in combination with resultsPerPage to navigate through large result sets.'),
  resultsPerPage: z.number().optional().describe('Number of results to show per page (default: 5, max: 10). Controls how many results are returned for each page.'),
  sort: z.string().optional().describe('Sorting method for search results. Options: "relevance" (default) or "date" (most recent first).')
};

const SearchOutputSchema = {
  results: z.array(z.object({
    title: z.string(),
    link: z.string(),
    snippet: z.string(),
    category: z.string().optional(),
    quality_score: z.number().optional(),
    authority: z.number().optional(),
    source_type: z.string().optional()
  })),
  pagination: z.object({
    currentPage: z.number(),
    totalResults: z.number().optional(),
    resultsPerPage: z.number(),
    totalPages: z.number().optional(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
  }).optional(),
  categories: z.array(z.object({
    name: z.string(),
    count: z.number()
  })).optional(),
  cache_info: z.object({
    cached: z.boolean(),
    retrieved_at: z.string(),
    cache_hit: z.boolean()
  }).optional()
} as const;

const ExtractWebpageInputSchema = {
  url: z.string().url().describe('Full URL of the webpage to extract content from (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'),
  format: z.enum(['markdown', 'html', 'text']).optional().describe('Output format for the extracted content. Options: "markdown" (default), "html", or "text".'),
  full_content: z.boolean().optional().describe('Whether to return the full content of the webpage (true) or just a preview (false). Default is false.'),
  max_length: z.number().optional().describe('Maximum character length for the extracted content. Useful for controlling response size.'),
  preview_length: z.number().optional().describe('Length of the preview in characters (default: 500).')
};

const ExtractWebpageOutputSchema = {
  url: z.string(),
  title: z.string(),
  description: z.string(),
  word_count: z.number(),
  approximate_chars: z.number(),
  summary: z.string().optional(),
  preview: z.string(),
  full_content: z.string().optional(),
  cache_info: z.object({
    cached: z.boolean(),
    retrieved_at: z.string(),
    cache_hit: z.boolean()
  }).optional()
};

const ExtractMultipleWebpagesInputSchema = {
  urls: z.array(z.string().url()).max(5).describe('Array of webpage URLs to extract content from. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'),
  format: z.enum(['markdown', 'html', 'text']).optional().describe('Output format for the extracted content. Options: "markdown" (default), "html", or "text".')
};

const ResearchTopicInputSchema = {
  topic: z.string().describe('The topic to research. Be specific to get the most relevant results.'),
  depth: z.enum(['basic', 'intermediate', 'advanced']).optional().describe('The level of depth for the research: "basic" (quick overview with 3-5 sources), "intermediate" (comprehensive analysis with 5-7 sources), or "advanced" (in-depth analysis with 8-10 sources and deeper synthesis). Default is "intermediate".'),
  num_sources: z.number().min(1).max(10).optional().describe('Maximum number of sources to include in the research (default: 5, max: 10).'),
  focus_areas: z.array(z.string()).optional().describe('Specific aspects of the topic to focus on. Each focus area will get dedicated analysis.')
};

class GoogleSearchServerV3 {
  private server: McpServer;
  private searchService: GoogleSearchService;
  private contentExtractor: ContentExtractor;
  private sourceQualityService: SourceQualityService;
  private deduplicationService: DeduplicationService;
  private researchSynthesisService: ResearchSynthesisService;

  constructor() {
    this.searchService = new GoogleSearchService();
    this.contentExtractor = new ContentExtractor();
    this.sourceQualityService = new SourceQualityService();
    this.deduplicationService = new DeduplicationService();
    this.researchSynthesisService = new ResearchSynthesisService();

    this.server = new McpServer({
      name: 'google-research',
      version: '3.0.0'
    });

    this.registerTools();
    this.registerPrompts();
  }

  private createErrorResponse(
    errorType: string,
    message: string,
    originalQuery?: string,
    suggestions?: string[]
  ): { content: any[]; isError: boolean } {
    const errorContext: ErrorContext = {
      type: errorType,
      message,
      suggestions: suggestions || this.getDefaultSuggestions(errorType),
      alternative_queries: originalQuery ? this.generateAlternativeQueries(originalQuery) : undefined,
      timestamp: new Date().toISOString()
    };

    let errorText = `Error: ${message}\n\n`;

    if (errorContext.suggestions && errorContext.suggestions.length > 0) {
      errorText += 'Suggestions:\n';
      errorContext.suggestions.forEach(s => errorText += `- ${s}\n`);
    }

    if (errorContext.alternative_queries && errorContext.alternative_queries.length > 0) {
      errorText += '\nTry these alternative queries:\n';
      errorContext.alternative_queries.forEach(q => errorText += `- "${q}"\n`);
    }

    return {
      content: [{ type: 'text', text: errorText }],
      isError: true
    };
  }

  private getDefaultSuggestions(errorType: string): string[] {
    const suggestions: Record<string, string[]> = {
      'NO_RESULTS': [
        'Try using broader search terms',
        'Remove date restrictions',
        'Check spelling of search terms',
        'Try searching for related concepts'
      ],
      'RATE_LIMIT': [
        'Wait a moment before retrying',
        'Reduce number of concurrent requests'
      ],
      'EXTRACTION_FAILED': [
        'Check if the URL is accessible in a browser',
        'Ensure the webpage is not behind a paywall',
        'Try a different source for the same information'
      ],
      'NETWORK_ERROR': [
        'Check your internet connection',
        'Try again in a moment',
        'Verify the URL is correct'
      ]
    };

    return suggestions[errorType] || ['Try again with different parameters'];
  }

  private generateAlternativeQueries(query: string): string[] {
    const words = query.split(/\s+/);

    if (words.length <= 2) {
      return [];
    }

    return [
      words.slice(0, Math.ceil(words.length / 2)).join(' '), // First half
      words.slice(-Math.ceil(words.length / 2)).join(' '),   // Last half
      `${words[0]} overview`,                                 // Basics
      `${words.join(' ')} guide`                             // Guide version
    ].filter(q => q !== query);
  }

  private createCacheInfo(cached: boolean): CacheInfo {
    return {
      cached,
      retrieved_at: new Date().toISOString(),
      cache_hit: cached
    };
  }

  private registerTools() {
    // Google Search Tool (Enhanced)
    this.server.registerTool(
      'google_search',
      {
        title: 'Google Search',
        description: 'Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google\'s search engine. Results include titles, snippets, URLs, and quality scores.',
        inputSchema: SearchInputSchema,
        outputSchema: SearchOutputSchema
      },
      async (args) => {
        try {
          const { results, pagination, categories } = await this.searchService.search(
            args.query,
            args.num_results,
            {
              site: args.site,
              language: args.language,
              dateRestrict: args.dateRestrict,
              exactTerms: args.exactTerms,
              resultType: args.resultType,
              page: args.page,
              resultsPerPage: args.resultsPerPage,
              sort: args.sort
            }
          );

          if (results.length === 0) {
            return this.createErrorResponse(
              'NO_RESULTS',
              `No results found for "${args.query}"`,
              args.query
            );
          }

          // IMPROVEMENT #5: Deduplicate results
          const deduped = this.deduplicationService.comprehensiveDeduplication(results);

          // IMPROVEMENT #7: Rank by source quality
          const rankedResults = this.sourceQualityService.rankSources(deduped.deduplicated);

          // Format results with quality scores
          const formattedResults = rankedResults.map(result => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            category: result.category,
            quality_score: result.quality_score,
            authority: result.authority,
            source_type: result.source_type
          }));

          // IMPROVEMENT #9: Add cache info
          const cacheInfo = this.createCacheInfo(false); // Would be true if from cache

          let responseText = `Search results for "${args.query}":\n\n`;

          if (deduped.duplicatesRemoved > 0) {
            responseText += `✓ Removed ${deduped.duplicatesRemoved} duplicate sources\n`;
            responseText += `✓ ${deduped.uniqueUrls} unique domains\n\n`;
          }

          if (categories && categories.length > 0) {
            responseText += "Categories: " + categories.map(c => `${c.name} (${c.count})`).join(', ') + "\n\n";
          }

          if (pagination) {
            responseText += `Showing page ${pagination.currentPage}${pagination.totalResults ? ` of approximately ${pagination.totalResults} results` : ''}\n\n`;
          }

          formattedResults.forEach((result, index) => {
            responseText += `${index + 1}. ${result.title}\n`;
            responseText += `   URL: ${result.link}\n`;
            if (result.quality_score) {
              responseText += `   Quality: ${Math.round(result.quality_score * 100)}% | Authority: ${Math.round((result.authority || 0) * 100)}% | Type: ${result.source_type}\n`;
            }
            responseText += `   ${result.snippet}\n\n`;
          });

          if (pagination && (pagination.hasNextPage || pagination.hasPreviousPage)) {
            responseText += "Navigation: ";
            if (pagination.hasPreviousPage) {
              responseText += "Use 'page: " + (pagination.currentPage - 1) + "' for previous results. ";
            }
            if (pagination.hasNextPage) {
              responseText += "Use 'page: " + (pagination.currentPage + 1) + "' for more results.";
            }
            responseText += "\n";
          }

          responseText += `\nRetrieved at: ${cacheInfo.retrieved_at}`;

          return {
            content: [{ type: 'text', text: responseText }],
            structuredContent: {
              results: formattedResults,
              pagination,
              categories,
              cache_info: cacheInfo
            }
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error during search';
          return this.createErrorResponse('SEARCH_ERROR', message, args.query);
        }
      }
    );

    // Extract Webpage Content Tool (Enhanced)
    this.server.registerTool(
      'extract_webpage_content',
      {
        title: 'Extract Webpage Content',
        description: 'Extract and analyze content from a webpage. Supports custom preview lengths and max content limits. This tool fetches the main content while removing ads and clutter.',
        inputSchema: ExtractWebpageInputSchema,
        outputSchema: ExtractWebpageOutputSchema
      },
      async (args) => {
        try {
          // IMPROVEMENT #2: Content extraction depth controls
          const content = await this.contentExtractor.extractContent(
            args.url,
            (args.format as OutputFormat) || 'markdown',
            {
              maxLength: args.max_length,
              previewLength: args.preview_length
            }
          );

          // IMPROVEMENT #9: Add cache info
          const cacheInfo = this.createCacheInfo(false);

          let responseText = `Content from: ${content.url}\n\n`;
          responseText += `Title: ${content.title}\n`;

          if (content.description) {
            responseText += `Description: ${content.description}\n`;
          }

          responseText += `\nStats: ${content.stats.word_count} words, ${content.stats.approximate_chars} characters\n\n`;

          if (content.summary) {
            responseText += `Summary: ${content.summary}\n\n`;
          }

          // IMPROVEMENT #4: Consistent preview length
          const previewLength = args.preview_length || 500;
          responseText += `Content Preview (${previewLength} chars):\n${content.content_preview.first_500_chars}\n\n`;

          if (args.full_content) {
            responseText += `Full Content:\n${content.content}\n\n`;
          } else {
            responseText += `Note: This is a preview. Set 'full_content: true' for complete text or 'max_length' to control size.`;
          }

          responseText += `\n\nRetrieved at: ${cacheInfo.retrieved_at}`;

          return {
            content: [{ type: 'text', text: responseText }],
            structuredContent: {
              url: content.url,
              title: content.title,
              description: content.description,
              word_count: content.stats.word_count,
              approximate_chars: content.stats.approximate_chars,
              summary: content.summary,
              preview: content.content_preview.first_500_chars,
              full_content: args.full_content ? content.content : undefined,
              cache_info: cacheInfo
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return this.createErrorResponse('EXTRACTION_FAILED', errorMessage, args.url);
        }
      }
    );

    // Extract Multiple Webpages Tool (Enhanced)
    this.server.registerTool(
      'extract_multiple_webpages',
      {
        title: 'Extract Multiple Webpages',
        description: 'Extract and analyze content from multiple webpages in a single request. Limited to 5 URLs per request for performance.',
        inputSchema: ExtractMultipleWebpagesInputSchema
      },
      async (args) => {
        if (args.urls.length > 5) {
          return this.createErrorResponse(
            'TOO_MANY_URLS',
            'Maximum 5 URLs allowed per request',
            '',
            ['Reduce the number of URLs to 5 or fewer', 'Consider splitting into multiple requests']
          );
        }

        try {
          const results = await this.contentExtractor.batchExtractContent(
            args.urls,
            (args.format as OutputFormat) || 'markdown'
          );

          const cacheInfo = this.createCacheInfo(false);

          let responseText = `Content from ${args.urls.length} webpages:\n\n`;
          const structuredResults: Record<string, any> = {};

          for (const [url, result] of Object.entries(results)) {
            responseText += `URL: ${url}\n`;

            if ('error' in result) {
              responseText += `Error: ${result.error}\n\n`;
              structuredResults[url] = { error: result.error };
              continue;
            }

            responseText += `Title: ${result.title}\n`;
            if (result.description) {
              responseText += `Description: ${result.description}\n`;
            }
            responseText += `Stats: ${result.stats.word_count} words\n`;
            if (result.summary) {
              responseText += `Summary: ${result.summary}\n`;
            }
            responseText += `Preview: ${result.content_preview.first_500_chars.substring(0, 200)}...\n\n`;

            structuredResults[url] = {
              url: result.url,
              title: result.title,
              description: result.description,
              word_count: result.stats.word_count,
              approximate_chars: result.stats.approximate_chars,
              summary: result.summary,
              preview: result.content_preview.first_500_chars
            };
          }

          responseText += `Retrieved at: ${cacheInfo.retrieved_at}`;

          return {
            content: [{ type: 'text', text: responseText }],
            structuredContent: {
              ...structuredResults,
              cache_info: cacheInfo
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return this.createErrorResponse('BATCH_EXTRACTION_FAILED', errorMessage);
        }
      }
    );

    // Research Topic Tool (COMPLETELY REWRITTEN WITH ALL IMPROVEMENTS)
    this.server.registerTool(
      'research_topic',
      {
        title: 'Research Topic (Enhanced)',
        description: 'Deeply research a topic with AI-powered synthesis, source quality assessment, deduplication, and focus area analysis. This tool searches, extracts, analyzes, and synthesizes information from multiple high-quality sources.',
        inputSchema: ResearchTopicInputSchema,
        outputSchema: {
          topic: z.string(),
          sources_analyzed: z.number(),
          sources_retrieved: z.number(),
          duplicates_removed: z.number(),
          research_summary: z.string(),
          key_findings: z.array(z.string()),
          themes: z.array(z.string()),
          focus_area_analysis: z.record(z.object({
            summary: z.string(),
            findings: z.array(z.string()),
            best_practices: z.array(z.string()).optional()
          })).optional(),
          quality_metrics: z.object({
            source_diversity: z.number(),
            average_authority: z.number(),
            content_freshness: z.number(),
            total_sources: z.number()
          }),
          sources: z.array(z.object({
            title: z.string(),
            url: z.string(),
            summary: z.string(),
            quality_score: z.number(),
            authority: z.number(),
            type: z.string(),
            publication_date: z.string().optional()
          })),
          metadata: z.object({
            depth_level: z.string(),
            focus_areas: z.array(z.string()).optional(),
            retrieved_at: z.string(),
            synthesis_method: z.string()
          })
        }
      },
      async (args) => {
        try {
          const depth = (args.depth || 'intermediate') as ResearchDepth;
          const numSources = this.getNumSourcesForDepth(args.num_sources, depth);
          const startTime = new Date();

          // IMPROVEMENT #8: Handle focus areas properly
          let searchQueries: string[] = [args.topic];

          if (args.focus_areas && args.focus_areas.length > 0) {
            // Create dedicated searches for each focus area
            searchQueries = [
              args.topic,
              ...args.focus_areas.map(area => `${args.topic} ${area}`)
            ];
          }

          // Execute all searches
          let allResults: any[] = [];

          for (const query of searchQueries) {
            const { results } = await this.searchService.search(
              query,
              Math.ceil(numSources / searchQueries.length) + 2 // Extra for deduplication
            );
            allResults.push(...results);
          }

          if (allResults.length === 0) {
            return this.createErrorResponse(
              'NO_RESULTS',
              `No results found for topic "${args.topic}"`,
              args.topic,
              ['Try broader search terms', 'Check spelling', 'Try related topics']
            );
          }

          // IMPROVEMENT #5: Deduplicate sources
          const dedupResult = this.deduplicationService.comprehensiveDeduplication(allResults);
          const uniqueResults = dedupResult.deduplicated;

          // IMPROVEMENT #7: Rank by source quality
          const rankedResults = this.sourceQualityService.rankSources(uniqueResults);

          // Take top N sources
          const topResults = rankedResults.slice(0, numSources);

          // Extract full content from top sources
          const urls = topResults.slice(0, Math.min(numSources, 5)).map(r => r.link);
          const extractedContent = await this.contentExtractor.batchExtractContent(urls, 'markdown');

          // Filter out failed extractions
          const successfulExtractions = new Map<string, any>();
          for (const [url, content] of Object.entries(extractedContent)) {
            if (!('error' in content)) {
              successfulExtractions.set(url, content);
            }
          }

          if (successfulExtractions.size === 0) {
            return this.createErrorResponse(
              'EXTRACTION_FAILED',
              'Failed to extract content from any sources',
              args.topic,
              ['Sources may be behind paywalls', 'Try different sources', 'Check internet connection']
            );
          }

          // IMPROVEMENT #7: Assess source quality
          const sourceQualities = new Map<string, any>();
          for (const [url, content] of successfulExtractions.entries()) {
            const quality = this.sourceQualityService.assessSource(url, content);
            sourceQualities.set(url, quality);
          }

          // IMPROVEMENT #1: ACTUALLY SYNTHESIZE with LLM (not just concatenate!)
          const synthesis = await this.researchSynthesisService.synthesizeResearch(
            args.topic,
            successfulExtractions,
            sourceQualities,
            depth,
            args.focus_areas
          );

          // Check if agent mode synthesis is required (Claude Code integration)
          const isAgentMode = this.researchSynthesisService.isAgentMode();
          const requiresAgentSynthesis = synthesis.summary.startsWith('[AGENT_SYNTHESIS_REQUIRED]');

          // Calculate quality metrics
          const qualityMetrics = this.sourceQualityService.calculateQualityMetrics(
            Array.from(sourceQualities.values())
          );

          // Build structured sources list
          const sources = Array.from(successfulExtractions.entries()).map(([url, content]) => {
            const quality = sourceQualities.get(url);
            return {
              title: content.title,
              url: url,
              summary: content.summary || content.description || '',
              quality_score: quality?.credibility_score || 0.5,
              authority: quality?.authority_score || 0.5,
              type: quality?.type || 'unknown',
              publication_date: quality?.publication_date
            };
          });

          // Sort sources by quality
          sources.sort((a, b) => b.quality_score - a.quality_score);

          // Build comprehensive research document
          let researchDoc = `# Research: ${args.topic}\n\n`;
          researchDoc += `**Depth:** ${depth}\n`;
          researchDoc += `**Sources Analyzed:** ${successfulExtractions.size}\n`;
          researchDoc += `**Duplicates Removed:** ${dedupResult.duplicatesRemoved}\n`;

          if (args.focus_areas && args.focus_areas.length > 0) {
            researchDoc += `**Focus Areas:** ${args.focus_areas.join(', ')}\n`;
          }

          // AGENT MODE: Display the agent prompt for Claude Code to use
          if (requiresAgentSynthesis && isAgentMode) {
            researchDoc += `\n---\n\n`;
            researchDoc += `## 🤖 CLAUDE CODE: AGENT SYNTHESIS REQUIRED\n\n`;
            researchDoc += `The research data has been gathered and prepared. **Please launch a general-purpose agent** to synthesize this research.\n\n`;
            researchDoc += `**Agent Task:** Analyze the research sources and provide comprehensive synthesis.\n\n`;
            researchDoc += `Copy the following prompt and use it with the Task tool to launch an agent:\n\n`;
            researchDoc += `---\n\n`;
            researchDoc += synthesis.summary.replace('[AGENT_SYNTHESIS_REQUIRED]\n\n', '');
            researchDoc += `\n\n---\n\n`;
            researchDoc += `**After the agent completes:** The agent will provide the synthesized research with:\n`;
            researchDoc += `- Executive Summary\n`;
            researchDoc += `- Key Findings (${depth === 'basic' ? '3-5' : depth === 'intermediate' ? '5-7' : '7-10'})\n`;
            researchDoc += `- Common Themes\n`;
            if (args.focus_areas && args.focus_areas.length > 0) {
              researchDoc += `- Dedicated analysis for each focus area: ${args.focus_areas.join(', ')}\n`;
            }
            if (depth === 'advanced') {
              researchDoc += `- Contradictions between sources\n`;
              researchDoc += `- Actionable recommendations\n`;
            }
          } else {
            researchDoc += `\n## Executive Summary\n\n${synthesis.summary}\n\n`;
          }

          researchDoc += `## Key Findings\n\n`;
          synthesis.key_findings.forEach((finding, idx) => {
            researchDoc += `${idx + 1}. ${finding}\n`;
          });

          if (synthesis.themes && synthesis.themes.length > 0) {
            researchDoc += `\n## Common Themes\n\n`;
            synthesis.themes.forEach(theme => {
              researchDoc += `- ${theme}\n`;
            });
          }

          if (synthesis.focus_analysis && args.focus_areas) {
            researchDoc += `\n## Focus Area Analysis\n\n`;
            for (const area of args.focus_areas) {
              const analysis = synthesis.focus_analysis[area];
              if (analysis) {
                researchDoc += `### ${area}\n\n`;
                researchDoc += `${analysis.summary}\n\n`;

                if (analysis.findings && analysis.findings.length > 0) {
                  researchDoc += `**Key Points:**\n`;
                  analysis.findings.forEach(f => researchDoc += `- ${f}\n`);
                  researchDoc += '\n';
                }

                if (analysis.best_practices && analysis.best_practices.length > 0) {
                  researchDoc += `**Best Practices:**\n`;
                  analysis.best_practices.forEach(bp => researchDoc += `- ${bp}\n`);
                  researchDoc += '\n';
                }
              }
            }
          }

          if (synthesis.contradictions && synthesis.contradictions.length > 0) {
            researchDoc += `\n## Contradictions Between Sources\n\n`;
            synthesis.contradictions.forEach(c => researchDoc += `- ${c}\n`);
          }

          if (synthesis.recommendations && synthesis.recommendations.length > 0) {
            researchDoc += `\n## Recommendations\n\n`;
            synthesis.recommendations.forEach(r => researchDoc += `- ${r}\n`);
          }

          researchDoc += `\n## Quality Metrics\n\n`;
          researchDoc += `- Source Diversity: ${Math.round(qualityMetrics.source_diversity * 100)}%\n`;
          researchDoc += `- Average Authority: ${Math.round(qualityMetrics.average_authority * 100)}%\n`;
          researchDoc += `- Content Freshness: ${Math.round(qualityMetrics.content_freshness * 100)}%\n`;

          researchDoc += `\n## Sources\n\n`;
          sources.forEach((source, idx) => {
            researchDoc += `${idx + 1}. [${source.title}](${source.url})\n`;
            researchDoc += `   - Quality: ${Math.round(source.quality_score * 100)}% | Authority: ${Math.round(source.authority * 100)}% | Type: ${source.type}\n`;
            if (source.publication_date) {
              researchDoc += `   - Published: ${source.publication_date}\n`;
            }
            if (source.summary) {
              researchDoc += `   - ${source.summary}\n`;
            }
            researchDoc += `\n`;
          });

          const endTime = new Date();
          const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

          researchDoc += `\n---\n*Research completed in ${duration}s at ${endTime.toISOString()}*\n`;
          researchDoc += `*Synthesis method: ${this.researchSynthesisService.isAvailable() ? 'AI-powered (Claude)' : 'Basic'}*`;

          return {
            content: [{ type: 'text', text: researchDoc }],
            structuredContent: {
              topic: args.topic,
              sources_analyzed: successfulExtractions.size,
              sources_retrieved: allResults.length,
              duplicates_removed: dedupResult.duplicatesRemoved,
              research_summary: synthesis.summary,
              key_findings: synthesis.key_findings,
              themes: synthesis.themes,
              focus_area_analysis: synthesis.focus_analysis,
              quality_metrics: qualityMetrics,
              sources: sources,
              metadata: {
                depth_level: depth,
                focus_areas: args.focus_areas,
                retrieved_at: endTime.toISOString(),
                synthesis_method: this.researchSynthesisService.isAvailable() ? 'AI-powered' : 'basic'
              }
            }
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error during research';
          return this.createErrorResponse('RESEARCH_ERROR', message, args.topic);
        }
      }
    );
  }

  private getNumSourcesForDepth(requested?: number, depth: ResearchDepth = 'intermediate'): number {
    if (requested) return requested;

    // IMPROVEMENT #6: Depth actually affects number of sources
    const depthDefaults = {
      'basic': 3,
      'intermediate': 5,
      'advanced': 8
    };

    return depthDefaults[depth];
  }

  private registerPrompts() {
    // Research Topic Prompt
    this.server.registerPrompt(
      'research-topic',
      {
        title: 'Research Topic',
        description: 'Start a comprehensive research session with AI synthesis',
        argsSchema: {
          topic: z.string(),
          focus: z.string().optional(),
          depth: z.enum(['basic', 'intermediate', 'advanced']).optional()
        }
      },
      (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please research the topic "${args.topic}"${args.focus ? ` with a focus on ${args.focus}` : ''}${args.depth ? ` at ${args.depth} depth` : ''}. Use the research_topic tool for comprehensive AI-powered analysis.`
            }
          }
        ]
      })
    );

    // Compare Sources Prompt
    this.server.registerPrompt(
      'compare-sources',
      {
        title: 'Compare Sources',
        description: 'Compare information from multiple URLs',
        argsSchema: {
          url1: z.string(),
          url2: z.string(),
          url3: z.string().optional(),
          aspect: z.string().optional()
        }
      },
      (args) => {
        const urls = [args.url1, args.url2, args.url3].filter((u): u is string => !!u);
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Compare these sources:\n${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n\n${args.aspect ? `Focus: ${args.aspect}` : 'Identify similarities and differences.'}`
              }
            }
          ]
        };
      }
    );

    // Fact Check Prompt
    this.server.registerPrompt(
      'fact-check',
      {
        title: 'Fact Check',
        description: 'Verify a claim using multiple sources',
        argsSchema: {
          claim: z.string()
        }
      },
      (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Fact-check: "${args.claim}"\n\nSearch for reliable sources and analyze accuracy.`
            }
          }
        ]
      })
    );
  }

  async start() {
    try {
      const transportType = process.env.MCP_TRANSPORT || 'stdio';

      console.error('='.repeat(60));
      console.error('Google Research MCP Server v3.0.0 (Enhanced)');
      console.error('='.repeat(60));
      console.error('✓ Source quality assessment');
      console.error('✓ Deduplication');
      if (this.researchSynthesisService.isAgentMode()) {
        console.error('✓ AI synthesis: AGENT MODE (Claude will launch agents)');
        console.error('  └─ No API key needed - uses your existing Claude session');
      } else {
        console.error('✓ AI synthesis: DIRECT API MODE (advanced)');
      }
      console.error('✓ Focus area analysis');
      console.error('✓ Enhanced error handling');
      console.error('✓ Cache metadata');
      console.error('='.repeat(60));

      if (transportType === 'http') {
        await this.startHttpServer();
      } else {
        await this.startStdioServer();
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to start MCP server:', error.message);
      } else {
        console.error('Failed to start MCP server: Unknown error');
      }
      process.exit(1);
    }
  }

  private async startStdioServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Server running on STDIO');

    process.on('SIGINT', () => {
      this.server.close().catch(console.error);
      process.exit(0);
    });
  }

  private async startHttpServer() {
    const app = express();
    app.use(express.json());

    const port = parseInt(process.env.PORT || '3000');

    app.post('/mcp', async (req, res) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        });

        res.on('close', () => {
          transport.close();
        });

        await this.server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });

    app.listen(port, () => {
      console.error(`Server running on http://localhost:${port}/mcp`);
    }).on('error', (error: Error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      this.server.close().catch(console.error);
      process.exit(0);
    });
  }
}

// Start the server
const server = new GoogleSearchServerV3();
server.start().catch(console.error);
