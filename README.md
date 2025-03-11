# Built For use with Cline + VS Code!

# Google Search MCP Server

An MCP (Model Context Protocol) server that provides Google search capabilities and webpage content analysis tools. This server enables AI models to perform Google searches and analyze webpage content programmatically.

<a href="https://glama.ai/mcp/servers/8m8reyzrcd">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/8m8reyzrcd/badge" alt="Google Search Server MCP server" />
</a>

## Features

- Advanced Google Search with filtering options (date, language, country, safe search)
- Detailed webpage content extraction and analysis
- Batch webpage analysis for comparing multiple sources
- Environment variable support for API credentials
- Comprehensive error handling and user feedback
- MCP-compliant interface for seamless integration with AI assistants

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.8 or higher)
- Google Cloud Platform account
- Custom Search Engine ID
- Google API Key

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/google-search-mcp.git
   cd google-search-mcp
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   pip install flask google-api-python-client flask-cors beautifulsoup4 trafilatura markdownify
   ```

4. Build the TypeScript code:
   ```bash
   npm run build
   ```

5. Create a helper script to start the Python servers (Windows example):
   ```bash
   # Create start-python-servers.cmd
   @echo off
   echo Starting Python servers for Google Search MCP...
   
   REM Start Python search server
   start "Google Search API" cmd /k "python google_search.py"
   
   REM Start Python link viewer
   start "Link Viewer" cmd /k "python link_view.py"
   
   echo Python servers started. You can close this window.
   ```

## Configuration

### API Credentials

You can provide Google API credentials in two ways:

1. **Environment Variables** (Recommended):
   - Set `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` in your environment
   - The server will automatically use these values

2. **Configuration File**:
   - Create an `api-keys.json` file in the root directory:
   ```json
   {
       "api_key": "your-google-api-key",
       "search_engine_id": "your-custom-search-engine-id"
   }
   ```

### MCP Settings Configuration

Add the server configuration to your MCP settings file:

#### For Cline (VS Code Extension)
File location: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "google-search": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\path\\to\\google-search-mcp\\dist\\google-search.js"],
      "cwd": "C:\\path\\to\\google-search-mcp",
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_SEARCH_ENGINE_ID": "your-custom-search-engine-id"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### For Claude Desktop App
File location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-search": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\path\\to\\google-search-mcp\\dist\\google-search.js"],
      "cwd": "C:\\path\\to\\google-search-mcp",
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key",
        "GOOGLE_SEARCH_ENGINE_ID": "your-custom-search-engine-id"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Running the Server

### Method 1: Start Python Servers Separately (Recommended)

1. First, start the Python servers using the helper script:
   ```bash
   start-python-servers.cmd
   ```

2. Configure the MCP settings to run only the Node.js server:
   ```json
   {
     "command": "C:\\Program Files\\nodejs\\node.exe",
     "args": ["C:\\path\\to\\google-search-mcp\\dist\\google-search.js"]
   }
   ```

### Method 2: All-in-One Script

Start both the TypeScript and Python servers with a single command:
```bash
npm run start:all
```

## Available Tools

### 1. google_search
Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google's search engine.

```typescript
{
  "name": "google_search",
  "arguments": {
    "query": "your search query",
    "num_results": 5, // optional, default: 5, max: 10
    "date_restrict": "w1", // optional, restrict to past day (d1), week (w1), month (m1), year (y1)
    "language": "en", // optional, ISO 639-1 language code (en, es, fr, de, ja, etc.)
    "country": "us", // optional, ISO 3166-1 alpha-2 country code (us, uk, ca, au, etc.)
    "safe_search": "medium" // optional, safe search level: "off", "medium", "high"
  }
}
```

### 2. extract_webpage_content
Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter.

```typescript
{
  "name": "extract_webpage_content",
  "arguments": {
    "url": "https://example.com"
  }
}
```

### 3. extract_multiple_webpages
Extract and analyze content from multiple webpages in a single request. Ideal for comparing information across different sources or gathering comprehensive information on a topic.

```typescript
{
  "name": "extract_multiple_webpages",
  "arguments": {
    "urls": [
      "https://example1.com",
      "https://example2.com"
    ]
  }
}
```

## Example Usage

Here are some examples of how to use the Google Search MCP tools:

### Basic Search
```
Search for information about artificial intelligence
```

### Advanced Search with Filters
```
Search for recent news about climate change from the past week in Spanish
```

### Content Extraction
```
Extract the content from https://example.com/article
```

### Multiple Content Comparison
```
Compare information from these websites:
- https://site1.com/topic
- https://site2.com/topic
- https://site3.com/topic
```

## Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Create API credentials (API Key)
5. Go to the [Custom Search Engine](https://programmablesearchengine.google.com/about/) page
6. Create a new search engine and get your Search Engine ID
7. Add these credentials to your `api-keys.json` file

## Error Handling

The server provides detailed error messages for:
- Missing or invalid API credentials
- Failed search requests
- Invalid webpage URLs
- Network connectivity issues

## Architecture

The server consists of two main components:
1. TypeScript MCP Server: Handles MCP protocol communication and provides the tool interface
2. Python Flask Server: Manages Google API interactions and webpage content analysis

## License

MIT