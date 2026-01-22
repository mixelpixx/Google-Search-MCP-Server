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

// API Validation Function - checks Google API connectivity at startup
async function validateGoogleAPI(): Promise<{ valid: boolean; warning?: string }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.error('❌ Missing required environment variables:');
    if (!apiKey) console.error('   - GOOGLE_API_KEY not set');
    if (!searchEngineId) console.error('   - GOOGLE_SEARCH_ENGINE_ID not set');
    console.error('\n💡 See SETUP-V3.md for configuration instructions');
    console.error('💡 Note: Google CLOSED this API to new customers in 2024');
    console.error('   If you don\'t have credentials, see ALTERNATIVES.md\n');
    return { valid: false };
  }

  try {
    // Test API with a simple query
    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=test&num=1`;
    const response = await fetch(testUrl);

    if (response.ok) {
      console.error('✅ Google API credentials validated successfully');
      return { valid: true };
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || '';

      if (errorMessage.includes('disabled') || errorMessage.includes('not been used')) {
        console.error('❌ API Access Denied (403) - Custom Search API not enabled');
        console.error('   Enable it at: https://console.cloud.google.com/apis/library/customsearch.googleapis.com');
        return { valid: false };
      }

      console.error('❌ API Access Denied (403)');
      console.error('   Possible causes:');
      console.error('   1. Invalid API key');
      console.error('   2. Custom Search API not enabled');
      console.error('   3. Billing not enabled (if over 100 queries/day)');
      console.error('\n💡 Enable API: https://console.cloud.google.com/apis/library/customsearch.googleapis.com');
      return { valid: false };
    }

    if (response.status === 429) {
      console.error('⚠️  API Rate Limit Hit (you may have already used 100 queries today)');
      console.error('   Server will still start, but searches will fail until tomorrow');
      console.error('   Or enable billing: https://console.cloud.google.com/billing');
      return { valid: true, warning: 'rate_limit' };
    }

    if (response.status === 400) {
      console.error('❌ Invalid API Request (400)');
      console.error('   Check your GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID');
      return { valid: false };
    }

    const errorData = await response.json().catch(() => ({}));
    console.error(`❌ API validation failed with status ${response.status}`);
    console.error('   Error:', errorData?.error?.message || 'Unknown error');
    return { valid: false };

  } catch (error: any) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('❌ Network error - cannot reach Google API');
      console.error('   Check your internet connection');
    } else {
      console.error('❌ Error during API validation:', error.message);
    }
    return { valid: false };
  }
}

