# Quick Start Guide

## Installation and Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id
```

**Note:** No Anthropic API key required. The server uses agent-based synthesis with your existing Claude session.

### 3. Build and Run

```bash
npm run build
npm run start:v3
```

### 4. Use in Claude Code

```typescript
research_topic({
  topic: "Your topic here",
  depth: "intermediate"
})
```

Claude will automatically launch an agent to synthesize the research.

---

## Research Process

When you call `research_topic`:

1. **MCP Tool** searches Google, deduplicates, and ranks sources by quality
2. **MCP Tool** extracts full content from top sources
3. **MCP Tool** packages everything into an agent prompt
4. **Claude Code** launches an agent automatically
5. **Agent** analyzes all sources and synthesizes insights
6. **Output** includes comprehensive research with:
   - Executive summary
   - Key findings (5-7 for intermediate depth)
   - Common themes
   - Source quality scores
   - Focus area analysis (if requested)

---

## Environment Variables

### Required
```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Optional (Advanced Users Only)
```bash
# Only set these if you want Direct API mode instead of Agent mode
ANTHROPIC_API_KEY=your_anthropic_key
USE_DIRECT_API=true
```

**For 99% of users:** Don't set the optional vars. Agent mode is better!

---

## Verify It's Working

After `npm run start:v3`, you should see:

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
```

If you see `AGENT MODE` - perfect! You're ready to go.

---

## First Research

Try this:

```typescript
research_topic({
  topic: "Docker container security best practices",
  depth: "intermediate"
})
```

Expected:
1. Tool gathers research from 5 high-quality sources
2. Returns agent prompt
3. I launch agent automatically
4. Agent synthesizes and returns comprehensive analysis
5. Takes ~10-15 seconds total

---

## Common Issues

### "No results found"
- Check your Google API key is valid
- Verify search engine ID is correct
- Try a different topic

### "Agent not launching"
- Make sure you're using v3: `npm run start:v3`
- Check server shows "AGENT MODE"
- Look for `[AGENT_SYNTHESIS_REQUIRED]` in response

### "Want to use API directly"
- Set `ANTHROPIC_API_KEY` in `.env`
- Set `USE_DIRECT_API=true` in `.env`
- Rebuild: `npm run build`
- Not recommended for interactive use

---

## Next Steps

- **Read:** `AGENT-MODE.md` for detailed agent mode explanation
- **Read:** `README-V3.md` for comprehensive feature documentation
- **Experiment:** Try different depth levels and focus areas

---

## Examples

### Quick Overview
```typescript
research_topic({
  topic: "GraphQL vs REST APIs",
  depth: "basic"  // 3 sources, quick summary
})
```

### Comprehensive Analysis
```typescript
research_topic({
  topic: "Microservices architecture patterns",
  depth: "advanced",  // 8-10 sources, deep analysis
  focus_areas: ["API gateway", "service mesh", "observability"]
})
```

### Specific Research
```typescript
research_topic({
  topic: "Kubernetes security",
  depth: "intermediate",
  focus_areas: ["RBAC", "network policies", "pod security"],
  num_sources: 7
})
```

---

The tool will work seamlessly with Claude Code, no extra API keys required.
