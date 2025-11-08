# Google Research MCP - Implementation Guide for Fixes

This guide provides concrete code examples for implementing the suggested improvements to the Google Research MCP tool.

---

## CRITICAL FIX #1: Improve Research Summary Quality

### Current Problem
```python
# Current output (pseudocode of what I observed):
{
    "research_summary": "...",  # Just dots or incomplete excerpts
    "key_findings": ["..."],    # Not useful
    "sources_analyzed": 5,      # Claims 5 but shows 2
}
```

### Root Cause Analysis
The `research_topic` function likely:
1. Performs searches ✅
2. Gets URLs ✅
3. Extracts content (maybe partially) ⚠️
4. **SKIPS** actual content synthesis ❌
5. Returns raw excerpts as "summary" ❌

### Proposed Implementation

```python
import hashlib
from datetime import datetime
from typing import List, Dict, Optional

async def research_topic(
    topic: str,
    depth: str = "intermediate",
    num_sources: int = 5,
    focus_areas: Optional[List[str]] = None
) -> Dict:
    """
    Research a topic by searching, extracting, and synthesizing information.

    Depth levels:
    - basic: Quick overview, 3 sources, summary only
    - intermediate: Balanced analysis, 5 sources, findings + themes
    - advanced: Deep dive, 8+ sources, full synthesis + comparisons
    """

    # Step 1: Construct search queries
    search_queries = _build_search_queries(topic, focus_areas)

    # Step 2: Execute searches and collect URLs
    all_results = []
    for query in search_queries:
        results = await google_search(
            query=query,
            num_results=_get_results_per_query(depth, len(search_queries)),
            dateRestrict="y1"  # Prefer recent content
        )
        all_results.extend(results['results'])

    # Step 3: Deduplicate and prioritize sources
    unique_sources = _deduplicate_sources(all_results)
    ranked_sources = _rank_sources(unique_sources, depth)
    top_sources = ranked_sources[:num_sources]

    # Step 4: Extract full content from sources
    urls = [source['link'] for source in top_sources]
    try:
        extracted_content = await extract_multiple_webpages(
            urls=urls[:5],  # Batch limit
            format="markdown"
        )
    except Exception as e:
        return _error_response(f"Content extraction failed: {e}", topic)

    # Step 5: CRITICAL - Actually synthesize the content
    synthesis = await _synthesize_research(
        topic=topic,
        content=extracted_content,
        sources=top_sources,
        depth=depth,
        focus_areas=focus_areas
    )

    # Step 6: Return structured, quality results
    return {
        "topic": topic,
        "sources_analyzed": len(top_sources),
        "sources_retrieved": len(all_results),
        "research_summary": synthesis['summary'],
        "key_findings": synthesis['findings'],
        "themes": synthesis['themes'],
        "focus_area_analysis": synthesis['focus_analysis'] if focus_areas else None,
        "sources": [
            {
                "title": src['title'],
                "url": src['link'],
                "snippet": src['snippet'],
                "category": src.get('category'),
                "quality_score": src.get('quality_score', 0.5),
                "publication_date": _extract_date(src)
            }
            for src in top_sources
        ],
        "metadata": {
            "depth_level": depth,
            "focus_areas": focus_areas,
            "retrieved_at": datetime.utcnow().isoformat(),
            "quality_metrics": _calculate_quality_metrics(top_sources, synthesis)
        }
    }


def _build_search_queries(topic: str, focus_areas: Optional[List[str]]) -> List[str]:
    """Build search queries based on topic and focus areas."""
    queries = [topic]

    if focus_areas:
        # Create focused queries for each area
        queries.extend([f"{topic} {area}" for area in focus_areas])

    return queries


def _get_results_per_query(depth: str, num_queries: int) -> int:
    """Determine how many results to get per query based on depth."""
    depth_map = {
        "basic": 5,
        "intermediate": 7,
        "advanced": 10
    }
    return depth_map.get(depth, 7) // max(num_queries, 1)


def _deduplicate_sources(sources: List[Dict]) -> List[Dict]:
    """Remove duplicate sources based on URL and content similarity."""
    seen_urls = set()
    seen_content_hashes = set()
    unique = []

    for source in sources:
        url = source['link']
        # Normalize URL (remove query params, trailing slashes)
        normalized_url = _normalize_url(url)

        # Create content hash from snippet
        content_hash = hashlib.md5(
            source.get('snippet', '').encode()
        ).hexdigest()[:8]

        if normalized_url not in seen_urls and content_hash not in seen_content_hashes:
            seen_urls.add(normalized_url)
            seen_content_hashes.add(content_hash)
            unique.append(source)

    return unique


def _normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(url)
    # Remove query params and fragments, normalize path
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc.lower(),
        parsed.path.rstrip('/'),
        '', '', ''
    ))
    return normalized


def _rank_sources(sources: List[Dict], depth: str) -> List[Dict]:
    """Rank sources by quality/relevance."""
    for source in sources:
        score = 0.0

        # Authority scoring
        domain = _extract_domain(source['link'])
        score += _get_domain_authority_score(domain)

        # Category bonus
        category = source.get('category', '')
        if category in ['Educational', 'Documentation', 'News']:
            score += 0.2
        elif category in ['Social Media']:
            score -= 0.1  # Deprioritize unless nothing else

        # Recency bonus (if detectable)
        if 'date' in source.get('snippet', '').lower():
            score += 0.1

        source['quality_score'] = score

    # Sort by quality score descending
    return sorted(sources, key=lambda x: x.get('quality_score', 0), reverse=True)


def _get_domain_authority_score(domain: str) -> float:
    """Score domains by authority (simplified)."""
    # High authority domains
    high_authority = [
        'edu', 'gov', 'github.com', 'stackoverflow.com',
        'microsoft.com', 'python.org', 'mozilla.org',
        'w3.org', 'ietf.org', 'arxiv.org'
    ]

    # Medium authority
    medium_authority = [
        'medium.com', 'dev.to', 'realpython.com',
        'digitalocean.com', 'aws.amazon.com'
    ]

    domain_lower = domain.lower()

    for auth_domain in high_authority:
        if auth_domain in domain_lower:
            return 1.0

    for auth_domain in medium_authority:
        if auth_domain in domain_lower:
            return 0.6

    # News sites
    if any(x in domain_lower for x in ['.news', 'times', 'post', 'reuters']):
        return 0.5

    # Unknown domains
    return 0.3


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    from urllib.parse import urlparse
    return urlparse(url).netloc


async def _synthesize_research(
    topic: str,
    content: Dict,
    sources: List[Dict],
    depth: str,
    focus_areas: Optional[List[str]]
) -> Dict:
    """
    THE KEY FUNCTION - Actually synthesize research from extracted content.

    This is where the magic happens. Instead of returning raw excerpts,
    we actually analyze and synthesize the information.
    """

    # Combine all extracted content
    all_text = "\n\n---\n\n".join([
        f"Source: {src['title']}\nURL: {src['url']}\n\n{src.get('preview', src.get('summary', ''))}"
        for src in content.values()
    ])

    # Depth-based analysis prompts
    depth_instructions = {
        "basic": "Provide a brief 2-3 paragraph overview.",
        "intermediate": "Provide a comprehensive analysis with key findings and themes.",
        "advanced": "Provide an in-depth analysis with findings, themes, comparisons, and actionable insights."
    }

    # Build synthesis prompt
    prompt = f"""Analyze the following research material about "{topic}" and provide a structured synthesis.

Research Material:
{all_text[:15000]}  # Limit to avoid token issues

Instructions: {depth_instructions[depth]}

Required Output Structure:
1. SUMMARY: A well-written {_get_summary_length(depth)}-paragraph synthesis
2. KEY FINDINGS: 5-7 specific, actionable findings (bullet points)
3. THEMES: 3-5 common themes across sources
"""

    if focus_areas:
        prompt += f"\n4. FOCUS AREA ANALYSIS: Specific insights for each focus area: {', '.join(focus_areas)}"

    prompt += "\n\nProvide your response in JSON format with keys: summary, findings, themes, focus_analysis"

    # Call LLM to synthesize
    # NOTE: This assumes you have an LLM available in your MCP server
    # You might use OpenAI, Anthropic Claude, or local model
    synthesis_response = await _call_llm_for_synthesis(prompt)

    return synthesis_response


def _get_summary_length(depth: str) -> int:
    """Get appropriate summary length for depth level."""
    return {
        "basic": 2,
        "intermediate": 4,
        "advanced": 6
    }[depth]


async def _call_llm_for_synthesis(prompt: str) -> Dict:
    """
    Call an LLM to synthesize the research.

    This is the SECRET SAUCE that's currently missing!
    """
    # Placeholder - implement with your LLM of choice
    # Example with Anthropic Claude:
    """
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(response.content[0].text)
    """

    # For now, return structured format
    return {
        "summary": "Synthesized summary would go here",
        "findings": [
            "Finding 1 based on analysis",
            "Finding 2 based on analysis",
        ],
        "themes": [
            "Theme 1 identified",
            "Theme 2 identified",
        ],
        "focus_analysis": {}
    }


def _calculate_quality_metrics(sources: List[Dict], synthesis: Dict) -> Dict:
    """Calculate quality metrics for the research."""
    return {
        "source_diversity": _calculate_source_diversity(sources),
        "average_authority": sum(s.get('quality_score', 0.5) for s in sources) / len(sources),
        "findings_count": len(synthesis.get('findings', [])),
        "themes_identified": len(synthesis.get('themes', [])),
        "content_freshness": _calculate_freshness(sources)
    }


def _calculate_source_diversity(sources: List[Dict]) -> float:
    """Calculate how diverse the sources are (different domains)."""
    domains = {_extract_domain(s['link']) for s in sources}
    return min(1.0, len(domains) / len(sources))


def _calculate_freshness(sources: List[Dict]) -> float:
    """Estimate content freshness based on dates found."""
    # Simplified - would need actual date extraction
    return 0.75  # Placeholder


def _extract_date(source: Dict) -> Optional[str]:
    """Extract publication date from source."""
    # Implement date extraction from snippet or metadata
    return None  # Placeholder


def _error_response(error_message: str, topic: str) -> Dict:
    """Return structured error response."""
    return {
        "success": False,
        "topic": topic,
        "error": {
            "message": error_message,
            "suggestions": [
                "Try simplifying the search query",
                "Check if the topic is too niche",
                "Try different focus areas"
            ]
        }
    }
```

---

## CRITICAL FIX #2: Better Focus Area Handling

### Current Problem
Focus areas are specified but seem to be ignored in the actual search and analysis.

### Proposed Implementation

```python
async def research_with_focus_areas(
    topic: str,
    focus_areas: List[str],
    depth: str = "intermediate"
) -> Dict:
    """
    Research a topic with dedicated analysis for each focus area.
    """
    results_by_area = {}

    # Search separately for each focus area
    for area in focus_areas:
        area_results = await google_search(
            query=f"{topic} {area}",
            num_results=5
        )

        # Extract content for this focus area
        urls = [r['link'] for r in area_results['results'][:3]]
        content = await extract_multiple_webpages(urls)

        # Synthesize findings for this specific area
        area_synthesis = await _synthesize_focus_area(
            topic=topic,
            focus_area=area,
            content=content,
            depth=depth
        )

        results_by_area[area] = area_synthesis

    # Create overall synthesis
    overall_summary = _combine_focus_areas(topic, results_by_area)

    return {
        "topic": topic,
        "focus_areas": focus_areas,
        "overall_summary": overall_summary,
        "focus_area_details": results_by_area,
        "metadata": {
            "retrieved_at": datetime.utcnow().isoformat(),
            "depth": depth
        }
    }


async def _synthesize_focus_area(
    topic: str,
    focus_area: str,
    content: Dict,
    depth: str
) -> Dict:
    """Synthesize research for a specific focus area."""
    combined_text = "\n\n".join([
        src.get('preview', '') for src in content.values()
    ])

    prompt = f"""Analyze the following content about "{focus_area}" in the context of "{topic}".

Content:
{combined_text[:5000]}

Provide:
1. Summary of key points about {focus_area}
2. Specific findings related to {focus_area}
3. Best practices or recommendations

Return as JSON with keys: summary, findings, recommendations
"""

    return await _call_llm_for_synthesis(prompt)
```

---

## IMPROVEMENT #3: Source Quality Assessment

```python
from dataclasses import dataclass
from enum import Enum

class SourceType(Enum):
    ACADEMIC = "academic"
    OFFICIAL_DOCS = "official_documentation"
    NEWS = "news"
    BLOG = "blog"
    FORUM = "forum"
    SOCIAL = "social_media"
    COMMERCIAL = "commercial"
    UNKNOWN = "unknown"


@dataclass
class SourceQuality:
    url: str
    domain: str
    type: SourceType
    authority_score: float  # 0.0 - 1.0
    recency_score: float    # 0.0 - 1.0
    credibility_score: float  # Combined score
    author: Optional[str] = None
    publication_date: Optional[str] = None
    last_updated: Optional[str] = None


def assess_source_quality(url: str, content: str) -> SourceQuality:
    """Comprehensive source quality assessment."""
    domain = _extract_domain(url)
    source_type = _classify_source_type(url, domain)
    authority = _assess_authority(domain, source_type)
    recency = _assess_recency(content, url)
    author = _extract_author(content)
    pub_date = _extract_publication_date(content)

    credibility = (authority * 0.6) + (recency * 0.4)

    return SourceQuality(
        url=url,
        domain=domain,
        type=source_type,
        authority_score=authority,
        recency_score=recency,
        credibility_score=credibility,
        author=author,
        publication_date=pub_date
    )


def _classify_source_type(url: str, domain: str) -> SourceType:
    """Classify the type of source."""
    domain_lower = domain.lower()

    # Academic
    if any(x in domain_lower for x in ['.edu', 'scholar', 'arxiv', 'ieee', 'acm.org']):
        return SourceType.ACADEMIC

    # Official docs
    if any(x in domain_lower for x in [
        'docs.', 'documentation', 'python.org', 'mozilla.org',
        'w3.org', 'microsoft.com/docs', 'github.com/docs'
    ]):
        return SourceType.OFFICIAL_DOCS

    # News
    if any(x in domain_lower for x in [
        '.news', 'times', 'post', 'reuters', 'ap.org', 'bbc.', 'cnn.'
    ]):
        return SourceType.NEWS

    # Forums/Community
    if any(x in domain_lower for x in [
        'stackoverflow', 'reddit', 'forum', 'discuss', 'community'
    ]):
        return SourceType.FORUM

    # Social media
    if any(x in domain_lower for x in [
        'twitter', 'linkedin', 'facebook', 'instagram', 'tiktok'
    ]):
        return SourceType.SOCIAL

    # Blogs
    if any(x in domain_lower for x in [
        'blog', 'medium.com', 'dev.to', 'hashnode', 'substack'
    ]):
        return SourceType.BLOG

    return SourceType.UNKNOWN


def _assess_authority(domain: str, source_type: SourceType) -> float:
    """Assess domain authority."""
    # Base score by source type
    type_scores = {
        SourceType.ACADEMIC: 0.95,
        SourceType.OFFICIAL_DOCS: 0.90,
        SourceType.NEWS: 0.70,
        SourceType.BLOG: 0.50,
        SourceType.FORUM: 0.45,
        SourceType.SOCIAL: 0.30,
        SourceType.COMMERCIAL: 0.40,
        SourceType.UNKNOWN: 0.35
    }

    base_score = type_scores[source_type]

    # Boost for known high-quality domains
    quality_boost = _get_domain_authority_score(domain)

    return min(1.0, base_score + (quality_boost * 0.2))


def _assess_recency(content: str, url: str) -> float:
    """Assess content recency."""
    # Extract year mentions from content
    import re
    years = re.findall(r'\b(20\d{2})\b', content)

    if not years:
        return 0.5  # Unknown recency

    latest_year = max(int(y) for y in years)
    current_year = datetime.now().year

    age = current_year - latest_year

    if age == 0:
        return 1.0
    elif age == 1:
        return 0.9
    elif age <= 2:
        return 0.7
    elif age <= 3:
        return 0.5
    else:
        return 0.3


def _extract_author(content: str) -> Optional[str]:
    """Extract author name from content."""
    import re

    # Common patterns
    patterns = [
        r'by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',  # "by John Doe"
        r'author:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',  # "author: John Doe"
        r'written by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',  # "written by John Doe"
    ]

    for pattern in patterns:
        match = re.search(pattern, content[:1000])  # Check first 1000 chars
        if match:
            return match.group(1)

    return None


def _extract_publication_date(content: str) -> Optional[str]:
    """Extract publication date from content."""
    import re
    from dateutil import parser

    # Look for date patterns
    date_patterns = [
        r'published[:\s]+(\w+\s+\d{1,2},?\s+\d{4})',
        r'(\w+\s+\d{1,2},?\s+\d{4})',
        r'(\d{4}-\d{2}-\d{2})'
    ]

    for pattern in date_patterns:
        match = re.search(pattern, content[:1000], re.IGNORECASE)
        if match:
            try:
                date_obj = parser.parse(match.group(1))
                return date_obj.isoformat()
            except:
                continue

    return None
```

---

## IMPROVEMENT #4: Enhanced Error Handling

```python
from enum import Enum
from typing import List

class ErrorType(Enum):
    NO_RESULTS = "no_results"
    RATE_LIMIT = "rate_limit"
    INVALID_QUERY = "invalid_query"
    EXTRACTION_FAILED = "extraction_failed"
    NETWORK_ERROR = "network_error"
    INVALID_URL = "invalid_url"


def enhanced_error_response(
    error_type: ErrorType,
    original_query: str,
    details: str = ""
) -> Dict:
    """Return helpful error response with suggestions."""

    suggestions_map = {
        ErrorType.NO_RESULTS: [
            "Try using broader search terms",
            "Remove date restrictions",
            "Check spelling of technical terms",
            "Try searching for related concepts"
        ],
        ErrorType.RATE_LIMIT: [
            "Wait a moment before retrying",
            "Reduce number of concurrent requests",
            "Consider caching results"
        ],
        ErrorType.INVALID_QUERY: [
            "Ensure query is not empty",
            "Avoid special characters",
            "Try rephrasing the question"
        ],
        ErrorType.EXTRACTION_FAILED: [
            "Some pages may be behind paywalls",
            "Try different sources",
            "Check if URL is accessible"
        ]
    }

    alternative_queries = _generate_alternative_queries(original_query, error_type)

    return {
        "success": False,
        "error": {
            "type": error_type.value,
            "message": details or f"{error_type.value.replace('_', ' ').title()}",
            "original_query": original_query,
            "suggestions": suggestions_map.get(error_type, ["Try again with different parameters"]),
            "alternative_queries": alternative_queries,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


def _generate_alternative_queries(query: str, error_type: ErrorType) -> List[str]:
    """Generate alternative query suggestions."""
    if error_type == ErrorType.NO_RESULTS:
        # Simplify query
        words = query.split()
        if len(words) > 3:
            return [
                " ".join(words[:3]),  # First 3 words
                " ".join(words[-3:]),  # Last 3 words
                f"{words[0]} basics",  # Basics of first word
            ]

    return []
```

---

## TESTING THE IMPROVEMENTS

```python
# Test script to verify improvements
async def test_improvements():
    """Test the improved research functionality."""

    print("Test 1: Basic research with quality assessment")
    result1 = await research_topic(
        topic="Python asyncio",
        depth="intermediate",
        num_sources=5
    )
    print(f"✓ Got {result1['sources_analyzed']} sources")
    print(f"✓ Summary length: {len(result1['research_summary'])} chars")
    print(f"✓ Quality score: {result1['metadata']['quality_metrics']['average_authority']}")

    print("\nTest 2: Research with focus areas")
    result2 = await research_with_focus_areas(
        topic="Docker security",
        focus_areas=["image scanning", "runtime security", "network isolation"],
        depth="advanced"
    )
    print(f"✓ Analyzed {len(result2['focus_area_details'])} focus areas")

    print("\nTest 3: Error handling")
    result3 = await research_topic(
        topic="xyzabc123notarealthing",
        depth="basic"
    )
    print(f"✓ Got error suggestions: {result3.get('error', {}).get('suggestions', [])}")

    print("\nAll tests passed!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_improvements())
```

---

## SUMMARY

The key improvements are:

1. **Actually synthesize content** - Don't just return excerpts
2. **Deduplicate sources** - Avoid redundant information
3. **Quality scoring** - Rank sources by authority and recency
4. **Focus area implementation** - Separate searches and analysis per focus area
5. **Better errors** - Helpful suggestions and alternatives
6. **Metadata richness** - Timestamps, quality metrics, source details

The biggest issue is #1 - the tool needs to actually call an LLM to synthesize research, not just concatenate excerpts. Everything else is secondary to that core functionality.
