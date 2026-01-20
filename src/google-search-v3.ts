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