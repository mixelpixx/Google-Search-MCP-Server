# Google Research MCP Server

**Version 3.0.0** - Enhanced research synthesis with intelligent source quality assessment and deduplication.

An advanced Model Context Protocol (MCP) server that provides comprehensive Google search capabilities, webpage content extraction, and AI-powered research synthesis. Built for Claude Code, Claude Desktop, and other MCP-compatible clients.

## Overview

This MCP server transforms Google search into a powerful research tool by:

- **Intelligent Source Ranking** - Automatically scores sources by authority, recency, and credibility
- **Deduplication** - Removes duplicate URLs and similar content across search results
- **Agent-Based Synthesis** - Leverages your existing Claude session to synthesize research findings
- **Focus Area Analysis** - Provides dedicated analysis for specific aspects of your research topic
- **Quality Metrics** - Tracks source diversity, authority, and content freshness

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Google Cloud Platform account with Custom Search API enabled
- Google Custom Search Engine ID

### Installation

#### Option 1: Using npx (Recommended)

Run directly without cloning:

```bash
# Set environment variables and run
GOOGLE_API_KEY=your_key GOOGLE_SEARCH_ENGINE_ID=your_id npx google-search-mcp
```

Or create a `.env` file in your working directory with your credentials, then run:

```bash
npx google-search-mcp
```

#### Option 2: Clone and Build

```bash
# Clone the repository
git clone <https://github.com/mixelpixx/Google-Search-MCP-Server>
cd Google-Research-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file in the project root:

```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id
```

**Note:** No Anthropic API key is required. The server uses agent-based synthesis that leverages your existing Claude session.

### Running the Server

```bash
# Start v3 server (recommended)
npm run start:v3

# For HTTP mode
npm run start:v3:http
```

Expected output:
```
============================================================
Google Research MCP Server v3.0.0 (Enhanced)
============================================================
✓ Source quality assessment
✓ Deduplication
✓ AI synthesis: AGENT MODE (Claude will launch agents)
  └─ No API key needed - uses your existing Claude session
✓ Focus area analysis
✓ Enhanced error handling
✓ Cache metadata
============================================================
Server running on STDIO
```

## Features

### Core Capabilities

#### 1. Advanced Google Search
- Full-text search with quality scoring
- Domain filtering and date restrictions
- Result categorization (academic, official docs, news, forums, etc.)
- Automatic deduplication of results
- Source authority ranking

#### 2. Content Extraction
- Clean content extraction from web pages
- Multiple output formats (Markdown, HTML, plain text)
- Configurable preview lengths
- Batch extraction support (up to 5 URLs)
- Automatic content summarization

#### 3. Research Synthesis
- Agent-based research analysis
- Comprehensive source synthesis
- Focus area breakdowns
- Contradiction detection
- Actionable recommendations
- Quality metrics reporting
