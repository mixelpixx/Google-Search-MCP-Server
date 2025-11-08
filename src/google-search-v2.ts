import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { GoogleSearchService } from './services/google-search.service.js';
import { ContentExtractor } from './services/content-extractor.service.js';
import { OutputFormat } from './types.js';
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
    category: z.string().optional()
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
  })).optional()
} as const;

const ExtractWebpageInputSchema = {
  url: z.string().url().describe('Full URL of the webpage to extract content from (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'),
  format: z.enum(['markdown', 'html', 'text']).optional().describe('Output format for the extracted content. Options: "markdown" (default), "html", or "text".'),
  full_content: z.boolean().optional().describe('Whether to return the full content of the webpage (true) or just a preview (false). Default is false.')
};

const ExtractWebpageOutputSchema = {
  url: z.string(),
  title: z.string(),
  description: z.string(),
  word_count: z.number(),
  approximate_chars: z.number(),
  summary: z.string().optional(),
  preview: z.string(),
  full_content: z.string().optional()
};

const ExtractMultipleWebpagesInputSchema = {
  urls: z.array(z.string().url()).max(5).describe('Array of webpage URLs to extract content from. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'),
  format: z.enum(['markdown', 'html', 'text']).optional().describe('Output format for the extracted content. Options: "markdown" (default), "html", or "text".')
};

const ResearchTopicInputSchema = {
  topic: z.string().describe('The topic to research. Be specific to get the most relevant results.'),
  depth: z.enum(['basic', 'intermediate', 'advanced']).optional().describe('The level of depth for the research: "basic" (overview), "intermediate" (detailed), or "advanced" (comprehensive). Default is "intermediate".'),
  num_sources: z.number().min(1).max(10).optional().describe('Maximum number of sources to include in the research (default: 5, max: 10).'),
  focus_areas: z.array(z.string()).optional().describe('Specific aspects of the topic to focus on.')
};

class GoogleSearchServer {
  private server: McpServer;
  private searchService: GoogleSearchService;
  private contentExtractor: ContentExtractor;

  constructor() {
    this.searchService = new GoogleSearchService();
    this.contentExtractor = new ContentExtractor();

    this.server = new McpServer({
      name: 'google-research',
      version: '2.0.0'
    });

    this.registerTools();
    this.registerPrompts();
  }

  private registerTools() {
    // Google Search Tool
    this.server.registerTool(
      'google_search',
      {
        title: 'Google Search',
        description: 'Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google\'s search engine. Results include titles, snippets, and URLs that can be analyzed further using extract_webpage_content.',
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
            return {
              content: [{
                type: 'text',
                text: 'No results found. Try:\n- Using different keywords\n- Removing quotes from non-exact phrases\n- Using more general terms'
              }],
              isError: true
            };
          }

          // Format results
          const formattedResults = results.map(result => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            category: result.category
          }));

          let responseText = `Search results for "${args.query}":\n\n`;

          if (categories && categories.length > 0) {
            responseText += "Categories: " + categories.map(c => `${c.name} (${c.count})`).join(', ') + "\n\n";
          }

          if (pagination) {
            responseText += `Showing page ${pagination.currentPage}${pagination.totalResults ? ` of approximately ${pagination.totalResults} results` : ''}\n\n`;
          }

          formattedResults.forEach((result, index) => {
            responseText += `${index + 1}. ${result.title}\n`;
            responseText += `   URL: ${result.link}\n`;
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

          return {
            content: [{ type: 'text', text: responseText }],
            structuredContent: {
              results: formattedResults,
              pagination,
              categories
            }
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error during search';
          return {
            content: [{ type: 'text', text: message }],
            isError: true
          };
        }
      }
    );

    // Extract Webpage Content Tool
    this.server.registerTool(
      'extract_webpage_content',
      {
        title: 'Extract Webpage Content',
        description: 'Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter. Use it to get detailed information from specific pages found via google_search. Works with most common webpage formats including articles, blogs, and documentation.',
        inputSchema: ExtractWebpageInputSchema,
        outputSchema: ExtractWebpageOutputSchema
      },
      async (args) => {
        try {
          const content = await this.contentExtractor.extractContent(
            args.url,
            (args.format as OutputFormat) || 'markdown'
          );

          let responseText = `Content from: ${content.url}\n\n`;
          responseText += `Title: ${content.title}\n`;

          if (content.description) {
            responseText += `Description: ${content.description}\n`;
          }

          responseText += `\nStats: ${content.stats.word_count} words, ${content.stats.approximate_chars} characters\n\n`;

          if (content.summary) {
            responseText += `Summary: ${content.summary}\n\n`;
          }

          responseText += `Content Preview:\n${content.content_preview.first_500_chars}\n\n`;

          // Only include full content if explicitly requested
          if (args.full_content) {
            responseText += `Full Content:\n${content.content}\n\n`;
          } else {
            responseText += `Note: This is a preview of the content. To get the full content, set 'full_content: true' parameter. For specific information, please ask about particular aspects of this webpage.`;
          }

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
              full_content: args.full_content ? content.content : undefined
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const helpText = 'Common issues:\n- Check if the URL is accessible in a browser\n- Ensure the webpage is public\n- Try again if it\'s a temporary network issue';

          return {
            content: [{ type: 'text', text: `${errorMessage}\n\n${helpText}` }],
            isError: true
          };
        }
      }
    );

    // Extract Multiple Webpages Tool
    this.server.registerTool(
      'extract_multiple_webpages',
      {
        title: 'Extract Multiple Webpages',
        description: 'Extract and analyze content from multiple webpages in a single request. This tool is ideal for comparing information across different sources or gathering comprehensive information on a topic. Limited to 5 URLs per request to maintain performance.',
        inputSchema: ExtractMultipleWebpagesInputSchema
      },
      async (args) => {
        if (args.urls.length > 5) {
          return {
            content: [{
              type: 'text',
              text: 'Maximum 5 URLs allowed per request to maintain performance. Please reduce the number of URLs.'
            }],
            isError: true
          };
        }

        try {
          const results = await this.contentExtractor.batchExtractContent(
            args.urls,
            (args.format as OutputFormat) || 'markdown'
          );

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

            responseText += `Preview: ${result.content_preview.first_500_chars.substring(0, 150)}...\n\n`;

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

          responseText += `Note: These are previews of the content. To analyze the full content of a specific URL, use the extract_webpage_content tool with that URL and set 'full_content: true'.`;

          return {
            content: [{ type: 'text', text: responseText }],
            structuredContent: structuredResults
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const helpText = 'Common issues:\n- Check if all URLs are accessible in a browser\n- Ensure all webpages are public\n- Try again if it\'s a temporary network issue\n- Consider reducing the number of URLs';

          return {
            content: [{ type: 'text', text: `${errorMessage}\n\n${helpText}` }],
            isError: true
          };
        }
      }
    );

    // Research Topic Tool (Combined search + extraction)
    this.server.registerTool(
      'research_topic',
      {
        title: 'Research Topic',
        description: 'Deeply research a topic by searching for relevant information, extracting content from multiple sources, and organizing it into a comprehensive markdown document. This tool helps develop a thorough understanding of complex or unfamiliar topics.',
        inputSchema: ResearchTopicInputSchema,
        outputSchema: {
          topic: z.string(),
          sources_analyzed: z.number(),
          research_summary: z.string(),
          key_findings: z.array(z.string()),
          sources: z.array(z.object({
            title: z.string(),
            url: z.string(),
            summary: z.string()
          }))
        }
      },
      async (args) => {
        try {
          const depth = args.depth || 'intermediate';
          const num_sources = args.num_sources || 5;

          // Search for the topic
          let searchQuery = args.topic;
          if (args.focus_areas && args.focus_areas.length > 0) {
            searchQuery += ' ' + args.focus_areas.join(' ');
          }

          const { results } = await this.searchService.search(searchQuery, num_sources);

          if (results.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `No results found for topic "${args.topic}". Try refining your search query.`
              }],
              isError: true
            };
          }

          // Extract content from top results
          const urls = results.slice(0, Math.min(num_sources, 5)).map(r => r.link);
          const extractedContent = await this.contentExtractor.batchExtractContent(urls, 'markdown');

          // Build research document
          let researchDoc = `# Research: ${args.topic}\n\n`;
          researchDoc += `**Research Depth:** ${depth}\n`;
          researchDoc += `**Sources Analyzed:** ${Object.keys(extractedContent).length}\n\n`;

          if (args.focus_areas && args.focus_areas.length > 0) {
            researchDoc += `**Focus Areas:** ${args.focus_areas.join(', ')}\n\n`;
          }

          researchDoc += `## Summary\n\n`;

          const sources: any[] = [];
          const keyFindings: string[] = [];

          for (const [url, content] of Object.entries(extractedContent)) {
            if ('error' in content) continue;

            researchDoc += `### ${content.title}\n`;
            researchDoc += `**Source:** ${url}\n\n`;

            if (content.summary) {
              researchDoc += `${content.summary}\n\n`;
              keyFindings.push(`${content.title}: ${content.summary}`);
            }

            sources.push({
              title: content.title,
              url: url,
              summary: content.summary || content.description || ''
            });
          }

          researchDoc += `\n## Sources\n\n`;
          sources.forEach((source, idx) => {
            researchDoc += `${idx + 1}. [${source.title}](${source.url})\n`;
          });

          return {
            content: [{ type: 'text', text: researchDoc }],
            structuredContent: {
              topic: args.topic,
              sources_analyzed: sources.length,
              research_summary: researchDoc,
              key_findings: keyFindings,
              sources: sources
            }
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error during research';
          return {
            content: [{ type: 'text', text: message }],
            isError: true
          };
        }
      }
    );
  }

  private registerPrompts() {
    // Research Topic Prompt
    this.server.registerPrompt(
      'research-topic',
      {
        title: 'Research Topic',
        description: 'Start a comprehensive research session on a specific topic',
        argsSchema: {
          topic: z.string(),
          focus: z.string().optional()
        }
      },
      (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please research the topic "${args.topic}"${args.focus ? ` with a focus on ${args.focus}` : ''}. Use the research_topic tool to gather comprehensive information from multiple sources.`
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
        description: 'Compare information from multiple URLs to identify similarities and differences',
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
                text: `Please compare the following sources:\n${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n\n${args.aspect ? `Focus on comparing: ${args.aspect}` : 'Identify key similarities and differences.'}`
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
        description: 'Verify a claim by searching for and analyzing multiple sources',
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
              text: `Please fact-check the following claim: "${args.claim}"\n\nSearch for reliable sources and analyze whether this claim is accurate.`
            }
          }
        ]
      })
    );
  }

  async start() {
    try {
      // Determine transport type based on environment variable
      const transportType = process.env.MCP_TRANSPORT || 'stdio';

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
    console.error('Google Research MCP server running on STDIO');

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
        // Create a new transport for each request to prevent request ID collisions
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
      console.error(`Google Research MCP Server running on http://localhost:${port}/mcp`);
      console.error(`Connect via: claude mcp add --transport http google-research http://localhost:${port}/mcp`);
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
const server = new GoogleSearchServer();
server.start().catch(console.error);
