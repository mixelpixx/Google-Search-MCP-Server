[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/mixelpixx-google-search-mcp-server-badge.png)](https://mseep.ai/app/mixelpixx-google-search-mcp-server)

# Version 2.0 is here!!
# NEWS - my NEW 'KiCAD MCP Server' is here, along with this 'Google Search MCP Server' they are a powerful duo!
https://github.com/mixelpixx/KiCAD-MCP-Server

# Google Search MCP Server
An MCP (Model Context Protocol) server that provides Google search capabilities and webpage content analysis tools. This server enables AI models to perform Google searches and analyze webpage content programmatically.

## Features

- Google Custom Search integration
- Advanced search features (filters, sorting, pagination, categorization)
- Webpage content analysis in multiple formats (markdown, HTML, plain text)
- Batch webpage analysis
- Result categorization and classification
- Content summarization
- Optimized, human-readable responses
- MCP-compliant interface

## Prerequisites

- Node.js (v16 or higher)
- Google Cloud Platform account
- Custom Search Engine ID
- Google API Key

## Installation

1. Clone the repository
2. Install Node.js dependencies:
```bash
npm install
```
3. Build the TypeScript code:
```bash
npm run build
```

## Configuration

1. Set up environment variables for your Google API credentials:

You can either set these as system environment variables or configure them in your MCP settings file.

Required environment variables:
- `GOOGLE_API_KEY`: Your Google API key
- `GOOGLE_SEARCH_ENGINE_ID`: Your Custom Search Engine ID

2. Add the server configuration to your MCP settings file (typically located at `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):
```json
{
  "mcpServers": {
    "google-search": {
      "autoApprove": [
        "google_search",
        "extract_webpage_content",
        "extract_multiple_webpages"
      ],
      "disabled": false,
      "timeout": 60,
      "command": "node",
      "args": [
        "/path/to/google-search-mcp-server/dist/google-search.js"
      ],
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_SEARCH_ENGINE_ID": "your-custom-search-engine-id"
      },
      "transportType": "stdio"
    }
  }
}
```

## Running

Start the MCP server:
```bash
npm run start
```

## Available Tools

### 1. google_search
Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google's search engine.

```typescript
{
  "name": "google_search",
  "arguments": {
    "query": "your search query",
    "num_results": 5, // optional, default: 5
    "site": "example.com", // optional, limit results to specific website
    "language": "en", // optional, filter by language (ISO 639-1 code)
    "dateRestrict": "m6", // optional, filter by date (e.g., "m6" for last 6 months)
    "exactTerms": "exact phrase", // optional, search for exact phrase
    "resultType": "news", // optional, specify type (news, images, videos)
    "page": 2, // optional, page number for pagination (starts at 1)
    "resultsPerPage": 10, // optional, results per page (max: 10)
    "sort": "date" // optional, sort by "date" or "relevance" (default)
  }
}
```

Response includes:
- Search results with title, link, snippet in a readable format
- Pagination information (current page, total results, etc.)
- Categories of results (automatically detected)
- Navigation hints for pagination

### 2. extract_webpage_content
Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter.

```typescript
{
  "name": "extract_webpage_content",
  "arguments": {
    "url": "https://example.com",
    "format": "markdown" // optional, format options: "markdown" (default), "html", or "text"
  }
}
```

Response includes:
- Title and description of the webpage
- Content statistics (word count, character count)
- Content summary
- Content preview (first 500 characters)

### 3. extract_multiple_webpages
Extract and analyze content from multiple webpages in a single request. Ideal for comparing information across different sources or gathering comprehensive information on a topic.

```typescript
{
  "name": "extract_multiple_webpages",
  "arguments": {
    "urls": [
      "https://example1.com",
      "https://example2.com"
    ],
    "format": "html" // optional, format options: "markdown" (default), "html", or "text"
  }
}
```

Response includes:
- Title and description of each webpage
- Content statistics for each webpage
- Content summary for each webpage
- Content preview for each webpage (first 150 characters)

## Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Create API credentials (API Key)
5. Go to the [Custom Search Engine](https://programmablesearchengine.google.com/about/) page
6. Create a new search engine and get your Search Engine ID
7. Add these credentials to your MCP settings file or set them as environment variables

## Error Handling

The server provides detailed error messages for:
- Missing or invalid API credentials
- Failed search requests
- Invalid webpage URLs
- Network connectivity issues

## Architecture

The server is built with TypeScript and uses the MCP SDK to provide a standardized interface for AI models to interact with Google Search and webpage content analysis tools. It consists of two main services:

1. **GoogleSearchService**: Handles Google API interactions for search functionality
2. **ContentExtractor**: Manages webpage content analysis and extraction

The server uses caching mechanisms to improve performance and reduce API calls.

## Distributing the Built Version

If you prefer to distribute only the built version of this tool rather than the source code, you can follow these steps:

1. Build the TypeScript code:
```bash
npm run build
```

2. Create a distribution package with only the necessary files:
```bash
# Create a distribution directory
mkdir -p dist-package

# Copy the compiled JavaScript files
cp -r dist dist-package/

# Copy package files (without dev dependencies)
cp package.json dist-package/
cp README.md dist-package/

# Create a simplified package.json for distribution
node -e "const pkg = require('./package.json'); delete pkg.devDependencies; delete pkg.scripts.build; delete pkg.scripts.dev; pkg.scripts.start = 'node dist/google-search.js'; require('fs').writeFileSync('dist-package/package.json', JSON.stringify(pkg, null, 2));"
```

3. Users can then install and run the built version:
```bash
# Install production dependencies only
npm install --production

# Start the server
npm start
```

This approach allows you to distribute the compiled JavaScript files without exposing the TypeScript source code. Users will still need to:

1. Configure their Google API credentials as environment variables
2. Add the server configuration to their MCP settings file
3. Install the production dependencies

Note that the package.json in the distribution will only include production dependencies and a simplified set of scripts.

## License

MIT
