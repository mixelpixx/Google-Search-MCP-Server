# Google Search MCP Server: SerpAPI Migration Guide

## Overview
Migrate from Google Custom Search Engine API (sunset Jan 1, 2027) to SerpAPI. This is a straightforward provider swap - the existing provider pattern makes this clean.

## Prerequisites
- SerpAPI account with API key: https://serpapi.com/manage-api-key
- Free tier: 100 searches/month
- Paid tier: $50/month for 5,000 searches

---

## Files to Modify

### 1. Add New Provider File
**Location:** `services/providers/serpapi-provider.ts`

**Action:** Create new file (already generated in `/mnt/user-data/outputs/serpapi-provider.ts`)

**What it does:**
- Implements `BaseSearchProvider` interface
- Maps SerpAPI response format (`organic_results[]`) to internal `SearchResult[]` format
- Handles SerpAPI-specific error codes and rate limits
- Converts filter parameters to SerpAPI format

**Key mappings:**
```
Google CSE → SerpAPI
key + cx  → api_key only
items[]   → organic_results[]
lr        → hl (language)
num       → num (same)
start     → start (calculated differently)
```

---

### 2. Update Provider Factory
**File:** `services/providers/provider-factory.ts`

**Changes:**
```typescript
// Add import at top
import { SerpAPIProvider } from './serpapi-provider.js';

// Add case in switch statement (around line 42):
case 'serpapi':
  this.provider = new SerpAPIProvider();
  break;
```

**Lines to modify:** Add import at top, add case around line 42 in `getProvider()` method

---

### 3. Update Main Server File
**File:** `google-search-v3.ts`

#### Change 1: Replace validation function (lines 14-85)
**Replace:** `validateGoogleAPI()` function
**With:** New validation function from `/mnt/user-data/outputs/validation-function.ts`

**Key differences:**
- Checks `SERPAPI_KEY` instead of `GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`
- Tests endpoint: `https://serpapi.com/search` instead of `googleapis.com/customsearch`
- Updated error messages for SerpAPI

#### Change 2: Update main() function (lines 1018-1028)
```typescript
// Line 1019: Change function call
const validation = await validateSerpAPI();  // was: validateGoogleAPI()

// Lines 1023-1027: Update error messages
console.error('\n❌ Server startup aborted due to API validation failure');
console.error('   Fix the issues above and try again\n');
// Remove Google-specific messaging about API closure
```

#### Change 3: Update startup banner (lines 920-933)
```typescript
// Line 920: Update banner
console.error('Google Research MCP Server v3.0.0 (SerpAPI)');

// Remove lines about Google API sunset warning
// Keep all the feature check marks (✓ Source quality, etc.)
```

---

### 4. Update Environment Variables
**File:** `.env`

**Remove:**
```bash
GOOGLE_API_KEY=your_google_key
GOOGLE_SEARCH_ENGINE_ID=your_cx_id
```

**Add:**
```bash
SERPAPI_KEY=your_serpapi_key
SEARCH_PROVIDER=serpapi
```

**Note:** If `SEARCH_PROVIDER` is not set, factory defaults to 'google' for backwards compatibility. Set it to 'serpapi' explicitly.

---

### 5. Update Documentation (Optional but Recommended)

**Files to update:**
- `README.md` - Update setup instructions
- `SETUP-V3.md` - Replace Google setup with SerpAPI setup
- `ALTERNATIVES.md` - Move Google to "deprecated" section, promote SerpAPI

**Key points:**
- Free tier: 100 searches/month (vs Google's 100/day)
- Better structured responses
- No search engine ID needed (simpler config)
- More reliable (Google CSE is shutting down)

---

## Testing Checklist

After making changes, test:

1. **Basic search:**
   - Simple query returns results
   - Results have correct format (title, link, snippet)

2. **Filters:**
   - `site:wikipedia.org` filter works
   - Language filter (`language: "en"`)
   - Date restriction (`dateRestrict: "m6"`)
   - Result types (images, news, video)

3. **Pagination:**
   - Multiple pages work
   - Page 2+ returns different results
   - `hasNextPage` / `hasPreviousPage` flags correct

4. **Error handling:**
   - Invalid API key shows clear error
   - Rate limit (429) shows helpful message
   - Network errors handled gracefully

5. **Startup validation:**
   - Server validates API key on startup
   - Shows SerpAPI in banner (not Google)
   - Displays correct provider info

---

## Implementation Order

**Step 1:** Copy `serpapi-provider.ts` to your project
- Location: `services/providers/serpapi-provider.ts`

**Step 2:** Update `provider-factory.ts`
- Add import
- Add switch case

**Step 3:** Update `google-search-v3.ts`
- Replace validation function
- Update main() 
- Update startup banner

**Step 4:** Update `.env`
- Add SERPAPI_KEY
- Set SEARCH_PROVIDER=serpapi

**Step 5:** Test
- Run validation: `npm run dev` (should show SerpAPI validation)
- Run search: Test via MCP client
- Test error cases: Try invalid key, rate limit

---

## Response Format Comparison

### Google CSE Response:
```json
{
  "items": [
    {
      "title": "Example",
      "link": "https://example.com",
      "snippet": "Description",
      "pagemap": {...}
    }
  ],
  "searchInformation": {
    "totalResults": "1000"
  }
}
```

### SerpAPI Response:
```json
{
  "organic_results": [
    {
      "position": 1,
      "title": "Example",
      "link": "https://example.com",
      "snippet": "Description",
      "source": "Example",
      "date": "2024-01-01"
    }
  ],
  "search_information": {
    "total_results": 1000
  }
}
```

**Provider handles mapping automatically** - no changes needed to service layer or tool definitions.

---

## Rollback Plan

If SerpAPI has issues:

1. **Keep Google provider:** Don't delete `google-provider.ts`
2. **Switch back:** Set `SEARCH_PROVIDER=google` in `.env`
3. **Restore env vars:** Add back `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`

The provider pattern makes this instant - just change environment variable and restart.

---

## Common Issues

### "SERPAPI_KEY not set"
- Add key to `.env` file
- Get key at: https://serpapi.com/manage-api-key

### "Unknown provider 'serpapi'"
- Did you add the import in `provider-factory.ts`?
- Did you add the switch case?
- Check for typos in provider name

### Rate limit hit immediately
- Free tier is 100/month, not per day
- Check usage at: https://serpapi.com/account
- Consider upgrading if needed

### Results look different
- SerpAPI may return different results than Google CSE
- This is normal - different proxy locations
- Use `location` parameter for consistency

---

## Benefits of This Migration

✅ **Simpler setup:** One API key instead of two credentials
✅ **Better structure:** Cleaner JSON response format  
✅ **More reliable:** Not being shut down like Google CSE
✅ **Good free tier:** 100 searches/month for development
✅ **Better docs:** SerpAPI has excellent documentation
✅ **More features:** Access to Google Images, News, Videos, etc.

---

## Next Steps After Migration

Consider also adding:
- Brave Search provider (2,000 free/month)
- Tavily provider (AI-optimized search)
- Provider auto-fallback (if one fails, try another)

These can coexist with SerpAPI using the same provider pattern.
