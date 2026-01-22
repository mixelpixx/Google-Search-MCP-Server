# Migration Guide: Multi-Provider Search

This guide will help you migrate from Google Custom Search to alternative providers (Brave or Tavily) or enable usage tracking for cost control.

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Provider Comparison](#provider-comparison)
- [Migration Paths](#migration-paths)
  - [Google → Brave](#google--brave-recommended)
  - [Google → Tavily](#google--tavily-for-research)
  - [Enable Usage Tracking](#enable-usage-tracking)
- [Feature Support Matrix](#feature-support-matrix)
- [Cost Estimation](#cost-estimation)
- [Troubleshooting](#troubleshooting)

---

## Why Migrate?

### Google Custom Search Issues

1. **API Sunset**: Google Custom Search API will be **discontinued on January 1, 2027**
2. **Closed to New Users**: API has been closed to new registrations since 2024
3. **Limited Free Tier**: Only 100 queries/day (vs Brave's 2,000/month)
4. **Higher Costs**: $5 per 1,000 queries (vs Brave's $3 per 5,000)

### Benefits of Migrating

- **Future-Proof**: Brave and Tavily have no announced sunset dates
- **Better Pricing**: 10-20x more free queries per month
- **Lower Paid Costs**: More cost-effective at scale
- **Privacy**: Brave doesn't track users (if that matters to your use case)
- **AI Optimization**: Tavily is specifically designed for AI agents

---

## Provider Comparison

| Feature | Google | Brave | Tavily |
|---------|--------|-------|--------|
| **Free Tier** | 100/day | 2,000/month | 1,000/month |
| **Paid Pricing** | $5/1k queries | $3/mo (5k) | $30/mo (4k) |
| **Cost per Query** | $0.005 | $0.0006 | $0.0075 |
| **Status** | Sunsets 2027 | Active | Active |
| **New Signups** | Closed | Open | Open |
| **Best For** | Legacy | General use | AI research |
| **Privacy** | Tracked | Private | Standard |
| **Search Depth** | Standard | Standard | Advanced |
| **Quality Scoring** | No | No | Yes |

**Recommendation**: **Brave** for most users, **Tavily** for AI research workflows.

---

## Migration Paths

### Google → Brave (Recommended)

Best for: General usage, privacy-focused, cost-conscious users

#### Step 1: Get Brave API Key

1. Visit https://api.search.brave.com/app/keys
2. Sign up (no credit card required for free tier)
3. Copy your API key

#### Step 2: Update Your `.env` File

```bash
# Add Brave configuration
SEARCH_PROVIDER=brave
BRAVE_API_KEY=your_brave_api_key_here

# Optional: Keep Google as fallback
# GOOGLE_API_KEY=your_google_api_key_here
# GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

#### Step 3: Rebuild and Restart

```bash
npm run build
# Restart your MCP server
```

#### Step 4: Verify

You should see:
```
✓ Using Brave Search as search provider
  Free tier: 2,000 queries/month
```

#### Step 5: Test

Run a test search:
```bash
# Using Claude Code or your MCP client
google_search(query: "test search")
```

Verify results are returned and have the same structure as Google results.

#### Step 6: Monitor Usage (Optional)

Enable usage tracking to monitor your Brave usage:
```bash
USAGE_TRACKING_ENABLED=true
USAGE_TRACKING_PERSIST=true
USAGE_MAX_SEARCHES_PER_MONTH=2000
```

---

### Google → Tavily (For Research)

Best for: AI agents, deep research, academic use, synthesis workflows

#### Step 1: Get Tavily API Key

1. Visit https://app.tavily.com/sign-in
2. Sign up
3. Navigate to API keys section
4. Copy your API key

#### Step 2: Update Your `.env` File

```bash
# Add Tavily configuration
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=your_tavily_api_key_here
```

#### Step 3: Rebuild and Restart

```bash
npm run build
# Restart your MCP server
```

#### Step 4: Verify

You should see:
```
✓ Using Tavily Search as search provider
  Free tier: 1,000 queries/month
```

#### Step 5: Understand Differences

**Tavily Specifics:**
- Searches take 10-30 seconds (advanced mode)
- Results include quality scores
- Optimized for comprehensive research
- No traditional pagination (each search is independent)

#### Step 6: Monitor Usage

```bash
USAGE_TRACKING_ENABLED=true
USAGE_TRACKING_PERSIST=true
USAGE_MAX_SEARCHES_PER_MONTH=1000
```

---

### Enable Usage Tracking

Track usage and costs across any provider (Google, Brave, or Tavily)

#### Step 1: Enable Tracking

Add to your `.env`:
```bash
USAGE_TRACKING_ENABLED=true
USAGE_TRACKING_PERSIST=true  # Optional: persist to SQLite
USAGE_TRACKING_DB_PATH=./.mcp-usage-tracking.db  # Optional: custom path
```

#### Step 2: Set Thresholds (Optional)

```bash
# Alert at 80% and 100% of these limits
USAGE_MAX_SEARCHES_PER_MONTH=1000
USAGE_MAX_COST_PER_MONTH=10.00
```

#### Step 3: Rebuild and Restart

```bash
npm run build
# Restart your MCP server
```

#### Step 4: Verify

You should see:
```
✓ Usage tracking enabled
✓ Usage tracking database initialized: ./.mcp-usage-tracking.db
```

#### Step 5: Monitor Warnings

When you approach limits:
```
WARNING: Approaching search limit: 800/1000 searches (80%)
Suggestions:
  • Monitor your usage carefully
  • Consider caching results when possible
```

---

## Feature Support Matrix

### Search Filters

| Filter | Google | Brave | Tavily |
|--------|--------|-------|--------|
| `site` | Yes | Yes (in query) | Yes |
| `language` | Yes | Yes (mapped) | No |
| `dateRestrict` | Yes | Yes (mapped) | Yes |
| `exactTerms` | Yes | Yes | Yes |
| `resultType` | Yes | No | No |
| `sort` | Yes | No | No |
| `page` | Yes | Yes | No |

**Note**: All providers return results in the same format, so your MCP tools will work identically.

### Filter Mappings

#### Date Restrictions

Google → Brave:
- `d1-7` → `pw` (past week)
- `d1-30` → `pm` (past month)
- `y1` → `py` (past year)

Google → Tavily:
- `d7` → `days: 7`
- `m1` → `days: 30`
- `y1` → `days: 365`

#### Language Codes

Google → Brave:
- Uses country codes instead of language codes
- Common mappings: `en`, `es`, `fr`, `de`, `it`, `pt`, `ru`, `ja`, `ko`, `zh`

Tavily:
- Language filter not supported

---

## Cost Estimation

### Monthly Cost Comparison (100 searches/day ≈ 3,000/month)

| Provider | Free Tier | Paid Queries | Monthly Cost |
|----------|-----------|--------------|--------------|
| Google | 100/day = ~3,000/mo | 0 | **$0** |
| Google (over limit) | 100/day | 2,900 | **$14.50** |
| Brave | 2,000/mo | 1,000 | **$3** |
| Tavily | 1,000/mo | 2,000 | **$30** + overage |

### Annual Cost Comparison (same usage)

| Provider | Annual Cost |
|----------|-------------|
| Google (within free tier) | $0 |
| Google (100/day) | $174 |
| Brave | $36 |
| Tavily | $360+ |

**Best Value**: Brave for general usage (94% cost savings vs Google paid)

---

## Troubleshooting

### Common Issues

#### "Missing required configuration"

**Cause**: API key not set for selected provider

**Solution**:
```bash
# For Brave
BRAVE_API_KEY=your_key_here

# For Tavily
TAVILY_API_KEY=your_key_here
```

#### "Rate Limit Exceeded"

**Cause**: Exceeded free tier or paid plan limit

**Solutions**:
1. Wait until next billing period
2. Upgrade your plan
3. Switch to different provider:
   ```bash
   SEARCH_PROVIDER=brave  # or tavily
   ```

#### "Unknown provider, falling back to Google"

**Cause**: Invalid `SEARCH_PROVIDER` value

**Valid values**: `google`, `brave`, `tavily`

**Fix**:
```bash
SEARCH_PROVIDER=brave  # lowercase, no spaces
```

#### Searches Take Too Long (Tavily)

**Cause**: Tavily uses advanced search mode (10-30 seconds)

**This is normal** - Tavily prioritizes quality over speed

**Alternative**: Use Brave for faster results

#### Results Look Different

**Expected** - Different providers have different indices

**All providers return**:
- `title`: Page title
- `link`: URL
- `snippet`: Description
- `source`: Always `'google_search'` for compatibility

#### Usage Tracking Not Working

**Check**:
1. `USAGE_TRACKING_ENABLED=true` is set
2. Rebuild after changing: `npm run build`
3. Check console for initialization message
4. Database errors are logged but non-blocking

---

## Rollback to Google

If you need to rollback:

### Step 1: Update `.env`

```bash
SEARCH_PROVIDER=google
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### Step 2: Rebuild

```bash
npm run build
```

### Step 3: Restart

Your server will use Google Custom Search again.

**Remember**: Google API sunsets January 1, 2027.

---

## Next Steps

1. **Test Thoroughly**: Run your typical queries with the new provider
2. **Monitor Usage**: Enable tracking to understand your patterns
3. **Adjust Thresholds**: Set limits based on your actual usage
4. **Plan for Scale**: Consider paid tiers if approaching free limits
5. **Provide Feedback**: Report any issues or differences you notice

---

## Support

- **Documentation**: See main README.md
- **Issues**: https://github.com/anthropics/google-search-mcp/issues
- **Provider Docs**:
  - Brave: https://api.search.brave.com/app/documentation
  - Tavily: https://docs.tavily.com/

---

**Migration successful?** Remember to update your documentation and notify any users of the provider change!
