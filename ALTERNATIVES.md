# Alternative Search APIs (Since Google Closed to New Users)

Google closed the Custom Search JSON API to new customers in 2024. If you don't have existing API credentials, here are working alternatives.

## Option 1: SerpAPI (Recommended)

**Best for:** Most users, easy migration, reliable results

**Pricing:**
- 100 searches/month FREE
- $50/month for 5,000 searches
- No daily limits (monthly quotas)

**Pros:**
- Same Google results quality
- Easy API, good documentation
- Includes additional data (featured snippets, knowledge panels)

**Cons:**
- More expensive than Google for high volume
- Monthly billing

**Setup:**
1. Sign up: https://serpapi.com/
2. Get your API key from dashboard
3. Install: `npm install serpapi`

**Example Usage:**
```javascript
const { getJson } = require('serpapi');

getJson({
  engine: "google",
  q: "your search query",
  api_key: "YOUR_API_KEY"
}, (json) => {
  console.log(json.organic_results);
});
```

---

## Option 2: ScraperAPI

**Best for:** High volume needs, budget-conscious

**Pricing:**
- 1,000 requests/month FREE
- $49/month for 100,000 requests
- Pay-as-you-go options

**Pros:**
- Very high volume capacity
- Handles anti-bot protection
- Multiple search engines supported

**Cons:**
- Results can be slower
- Requires more error handling

**Setup:**
1. Sign up: https://scraperapi.com/
2. Get API key
3. Use their Google Search endpoint

**Example Usage:**
```javascript
const axios = require('axios');

const response = await axios.get('http://api.scraperapi.com', {
  params: {
    api_key: 'YOUR_API_KEY',
    url: 'https://www.google.com/search?q=your+query'
  }
});
```

---

## Option 3: SearchAPI.io

**Best for:** Budget-conscious users, simple needs

**Pricing:**
- 100 searches/month FREE
- $29/month for 1,000 searches
- Flexible plans

**Pros:**
- Lower cost entry point
- Google-compatible API format
- Real-time results

**Cons:**
- Smaller company
- Less documentation

**Setup:**
1. Sign up: https://searchapi.io/
2. Get API key
3. Very similar API to Google's format

---

## Option 4: Bing Search API

**Best for:** Microsoft ecosystem users, enterprise

**Pricing:**
- 1,000 queries/month FREE (Azure)
- Pay-as-you-go after that

**Pros:**
- Official Microsoft API (won't disappear)
- Good documentation
- Enterprise support

**Cons:**
- Bing results, not Google
- Azure account required

**Setup:**
1. Create Azure account: https://azure.microsoft.com/
2. Create Bing Search resource
3. Get API key from Azure portal

---

## Option 5: DuckDuckGo Instant Answer API

**Best for:** Simple queries, free usage

**Pricing:**
- FREE (no API key required!)

**Pros:**
- Completely free
- No rate limits
- Privacy-focused

**Cons:**
- Limited to "instant answers" only
- Not full search results
- Less comprehensive

**Example:**
```javascript
const response = await fetch(
  'https://api.duckduckgo.com/?q=your+query&format=json'
);
```

---

## Option 6: Build Your Own (Not Recommended)

**Why you shouldn't:**
- Scraping Google violates their ToS
- They actively block scrapers
- Your IP will get blocked
- Legal risks
- High maintenance burden
- Results are inconsistent

**If you must:**
- Use a proxy rotation service
- Implement extensive rate limiting
- Be prepared for constant breakage
- Consider the legal implications

---

## Migration Support

We're exploring adding adapter modules to make switching between APIs easier. This would allow you to:
- Use the same MCP interface
- Swap backends without code changes
- Fall back to alternatives when one fails

If you're interested in contributing to this effort, please open an issue on GitHub.

---

## Comparison Table

| Provider | Free Tier | Paid Starting | Google Results | Ease of Migration |
|----------|-----------|---------------|----------------|-------------------|
| SerpAPI | 100/mo | $50/mo | Yes | Easy |
| ScraperAPI | 1,000/mo | $49/mo | Yes | Medium |
| SearchAPI.io | 100/mo | $29/mo | Yes | Easy |
| Bing API | 1,000/mo | Pay-as-you-go | No (Bing) | Medium |
| DuckDuckGo | Unlimited | Free | No | Easy |

---

## Questions?

Open an issue on GitHub with the tag `migration-help` and we'll try to assist.

---

*Last updated: January 2026*
