# Google Research MCP v3 - Quick Setup Guide

## Prerequisites

- Node.js 18+ installed
- Google API key and Search Engine ID
- Anthropic API key (optional but recommended)

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /path/to/Google-Research-MCP
npm install
```

This installs the new `@anthropic-ai/sdk` package.

### 2. Configure Environment

Edit `.env` file:

```bash
# Required
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# HIGHLY RECOMMENDED (for AI synthesis)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional
MCP_TRANSPORT=stdio
PORT=3000
```

**Get Anthropic API Key:**
1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up / Log in
3. Navigate to API Keys
4. Create new key (starts with `sk-ant-`)
5. Copy to `.env`

### 3. Build TypeScript

```bash
npm run build
```

This compiles all the new services:
- `source-quality.service.ts`
- `deduplication.service.ts`
- `research-synthesis.service.ts`
- `google-search-v3.ts`

### 4. Test the Server

**Option A: Standalone Test**

```bash
npm run start:v3
```

You should see:

```
==============================================================
Google Research MCP Server v3.0.0 (Enhanced)
==============================================================
✓ Source quality assessment
✓ Deduplication
✓ AI synthesis: ENABLED  ← Should show ENABLED if API key set
✓ Focus area analysis
✓ Enhanced error handling
✓ Cache metadata
==============================================================
Server running on STDIO
```

**Option B: With Claude Desktop**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-research": {
      "command": "node",
      "args": [
        "/absolute/path/to/Google-Research-MCP/dist/google-search-v3.js"
      ],
      "env": {
        "GOOGLE_API_KEY": "your_key",
        "GOOGLE_SEARCH_ENGINE_ID": "your_id",
        "ANTHROPIC_API_KEY": "your_anthropic_key"
      }
    }
  }
}
```

Restart Claude Desktop.

---

## Testing the Improvements

### Test 1: Research Synthesis (CRITICAL)

**What to test:** AI-powered synthesis instead of "..."

```typescript
research_topic({
  topic: "Docker container security best practices",
  depth: "intermediate"
})
```

**Expected output:**
- Real summary paragraph (not "...")
- 5-7 actual findings extracted from sources
- Themes identified
- Quality metrics shown
- Retrieved timestamp

**Failure case:** If you see summary: "...", check that:
- `ANTHROPIC_API_KEY` is set in `.env`
- Server startup shows "AI synthesis: ENABLED"
- API key is valid (test at console.anthropic.com)

### Test 2: Source Quality & Deduplication

**What to test:** Quality scoring and duplicate removal

```typescript
google_search({
  query: "python asyncio tutorial",
  num_results: 10
})
```

**Expected output:**
```
✓ Removed 2 duplicate sources
✓ 8 unique domains

Results:
1. Python Official Docs
   Quality: 95% | Authority: 90% | Type: official_documentation
   [snippet]

2. Real Python Tutorial
   Quality: 78% | Authority: 60% | Type: blog
   [snippet]
...
```

### Test 3: Focus Areas

**What to test:** Dedicated analysis per focus area

```typescript
research_topic({
  topic: "Kubernetes security",
  focus_areas: ["RBAC", "network policies", "pod security"],
  depth: "advanced"
})
```

**Expected output:**
```markdown
## Focus Area Analysis

### RBAC
Dedicated analysis of Role-Based Access Control...

**Key Points:**
- Finding 1 specific to RBAC
- Finding 2 specific to RBAC
...

**Best Practices:**
- Practice 1
- Practice 2

### network policies
[Dedicated section for network policies]

### pod security
[Dedicated section for pod security]
```

### Test 4: Enhanced Error Handling

**What to test:** Helpful error messages

```typescript
google_search({
  query: "xyzabc123notreal"
})
```

**Expected output:**
```
Error: No results found for "xyzabc123notreal"

Suggestions:
- Try using broader search terms
- Check spelling of search terms
- Try searching for related concepts

Try these alternative queries:
- "xyzabc basics"
- "xyzabc guide"
```

### Test 5: Content Extraction Controls

**What to test:** Custom preview lengths

```typescript
extract_webpage_content({
  url: "https://realpython.com/async-io-python/",
  preview_length: 300,
  max_length: 5000
})
```

**Expected output:**
```
Content Preview (300 chars):
[Exactly 300 characters]

Note: Content limited to 5000 characters

Retrieved at: 2025-11-07T...
```

### Test 6: Cache Metadata

**What to test:** Timestamps on all responses

```typescript
google_search({
  query: "rust programming"
})
```

**Expected in output:**
```
Retrieved at: 2025-11-07T21:45:00.000Z

[structuredContent includes cache_info]
```

---

## Verification Checklist

- [ ] Server starts without errors
- [ ] Shows `✓ AI synthesis: ENABLED`
- [ ] Research summaries are actual analysis (not "...")
- [ ] Sources show quality scores
- [ ] Duplicates are removed (check for "Removed X duplicates")
- [ ] Focus areas get dedicated sections
- [ ] Errors provide helpful suggestions
- [ ] All responses include timestamps
- [ ] Preview lengths are consistent

---

## Common Issues

### Issue: Agent synthesis not working

**Cause:** Server not in agent mode or configuration issue

**Fix:**
1. Verify server shows "AGENT MODE" on startup
2. Check for `[AGENT_SYNTHESIS_REQUIRED]` in output
3. Rebuild: `npm run build`
4. Restart server

### Issue: TypeScript compilation errors

**Cause:** New dependencies not installed

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Research still returns "..."

**Possible causes:**
1. API key not set (check startup message)
2. API rate limit reached
3. Network issues

**Debug:**
```bash
# Check API key is loaded
npm run start:v3

# Look for this line:
# ✓ AI synthesis: ENABLED  ← Should be ENABLED
```

### Issue: No quality scores on sources

**Cause:** Using v2 instead of v3

**Fix:**
```bash
# Make sure you're running v3:
npm run start:v3  # NOT start:v2
```

### Issue: Focus areas not working

**Symptoms:** No "Focus Area Analysis" section

**Check:**
1. Did you pass `focus_areas` parameter?
2. Using v3 server?
3. AI synthesis enabled?

**Example:**
```typescript
research_topic({
  topic: "topic name",
  focus_areas: ["area1", "area2"],  // Must be array
  depth: "advanced"                  // Advanced recommended
})
```

---

## Performance Expectations

### Search Operations

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| `google_search` | 1-2s | +0.3s for quality scoring |
| `extract_webpage_content` | 2-3s | Per URL |
| `research_topic` (basic) | 8-10s | 3 sources + AI synthesis |
| `research_topic` (intermediate) | 12-15s | 5 sources + synthesis |
| `research_topic` (advanced) | 18-25s | 8-10 sources + deep analysis |

**Note:** AI synthesis adds 3-8s depending on content size and depth.

### Token Usage (Anthropic)

| Depth | Input Tokens | Output Tokens | Est. Cost |
|-------|-------------|---------------|-----------|
| basic | ~3,000 | ~500 | $0.01 |
| intermediate | ~6,000 | ~1,000 | $0.02 |
| advanced | ~10,000 | ~1,500 | $0.04 |

*Prices based on Claude 3.5 Sonnet rates as of 2025*

---

## Next Steps

1. Verify all tests pass
2. Check agent synthesis is working
3. Read `README.md` for comprehensive documentation
4. Review `tool-evaluation-report.md` for detailed analysis
5. Check `implementation-guide.md` for implementation details
6. Start using the improved research capabilities

---

## Quick Reference

### Commands

```bash
# Build
npm run build

# Run v3 (STDIO)
npm run start:v3

# Run v3 (HTTP)
npm run start:v3:http

# Run v2 (fallback)
npm run start:v2
```

### Environment Variables

```bash
GOOGLE_API_KEY=xxx              # Required
GOOGLE_SEARCH_ENGINE_ID=xxx     # Required
ANTHROPIC_API_KEY=xxx           # Recommended
MCP_TRANSPORT=stdio             # Optional
PORT=3000                       # Optional (HTTP mode)
```

### Tool Names

- `google_search` - Enhanced search with quality scores
- `extract_webpage_content` - Enhanced with depth controls
- `extract_multiple_webpages` - Batch extraction
- `research_topic` - Completely rewritten with AI synthesis

---

## Support

- **Issues:** Check `tool-evaluation-report.md` first
- **Code Examples:** See `implementation-guide.md`
- **Full Docs:** See `README-V3.md`

---

**Setup Complete**

The server is now configured with:
- AI-powered research synthesis (agent mode)
- Source quality assessment
- Deduplication
- Focus area analysis
- Enhanced error handling
- All 10 improvements active
