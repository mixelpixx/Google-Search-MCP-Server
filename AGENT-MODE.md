# Agent Mode - Research Synthesis Guide

## What is Agent Mode?

Agent Mode is the **default and recommended** way to use the Google Research MCP v3. Instead of requiring a separate Anthropic API key, it leverages **your existing Claude session** (Claude Code, Claude Desktop, or Cline) to synthesize research.

### Why Agent Mode?

1. **No Extra API Key Required** - You're already using Claude, why authenticate twice?
2. **Better Integration** - Agents run in your current Claude session with full context
3. **More Transparent** - You see exactly what the agent is doing
4. **Same Quality** - Uses the same Claude model you're already using

---

## How It Works

### Traditional Flow (v2 or Direct API Mode)
```
User → MCP Tool → Anthropic API → Synthesis → User
        (requires API key)
```

### Agent Mode Flow (v3 Default)
```
User → MCP Tool → Gathers Research Data
                ↓
              Returns Agent Prompt
                ↓
     Claude Code → Launches Agent → Synthesis → User
     (uses your existing session)
```

---

## Using Agent Mode in Claude Code

### Step 1: Call research_topic

```typescript
research_topic({
  topic: "Kubernetes security best practices",
  depth: "intermediate",
  focus_areas: ["RBAC", "network policies"]
})
```

### Step 2: MCP Returns Agent Prompt

The tool will return something like:

```markdown
# Research: Kubernetes security best practices

**Depth:** intermediate
**Sources Analyzed:** 5
**Duplicates Removed:** 2
**Focus Areas:** RBAC, network policies

---

## CLAUDE CODE: AGENT SYNTHESIS REQUIRED

The research data has been gathered and prepared. **Please launch a general-purpose agent** to synthesize this research.

**Agent Task:** Analyze the research sources and provide comprehensive synthesis.

Copy the following prompt and use it with the Task tool to launch an agent:

---

RESEARCH SYNTHESIS TASK

You are analyzing research on: "Kubernetes security best practices"

**Analysis Depth:** intermediate
**Number of Sources:** 5
**Focus Areas:** RBAC, network policies

**Instructions:** Provide a comprehensive analysis with 5-7 key findings, common themes, and practical takeaways.

**Research Sources:**

=== SOURCE 1 ===
Title: Kubernetes Security Best Practices
URL: https://kubernetes.io/docs/concepts/security/
Type: official_documentation
Authority: 95%
Credibility: 93%

Content Summary:
[Full summary and excerpts from the source...]

=== SOURCE 2 ===
[...]

[Continue for all sources]

**Required Output Format:**

## Executive Summary
[Comprehensive 3-6 paragraph synthesis of all sources]

## Key Findings
1. [Finding 1 - with source attribution]
2. [Finding 2 - with source attribution]
[...]

## Common Themes
- [Theme 1]
- [Theme 2]
[...]

## Focus Area Analysis

### RBAC
**Summary:** [Analysis specific to RBAC]
**Key Points:**
- [Point 1]
- [Point 2]
**Best Practices:**
- [Practice 1]
- [Practice 2]

### network policies
[Similar structure]

**Analysis Guidelines:**
- Synthesize information across ALL sources
- Identify patterns and themes
- Note authority/credibility scores when weighing information
- Provide specific, actionable insights
- Cite sources when making claims

Begin your analysis:

---
```

### Step 3: I (Claude) See This and Launch Agent

When I see `[AGENT_SYNTHESIS_REQUIRED]` in the response, I automatically:

1. Recognize this as an agent task
2. Use the Task tool to launch a general-purpose agent
3. Pass the entire research prompt to the agent
4. The agent analyzes all sources and synthesizes

### Step 4: Agent Returns Synthesis

The agent provides:

```markdown
## Executive Summary

Kubernetes security in 2025 requires a multi-layered approach. Analysis of 5 authoritative sources reveals that RBAC and network policies form the foundation of cluster security. According to the official Kubernetes documentation, implementing least-privilege access through RBAC reduces unauthorized access by 85%. Network policies, when properly configured, prevent lateral movement and contain potential breaches.

[2-4 more paragraphs...]

## Key Findings

1. **RBAC is Foundational**: All sources emphasize Role-Based Access Control as the primary security mechanism (Kubernetes Docs, CNCF Security Whitepaper)

2. **Network Policies Prevent Lateral Movement**: Properly configured NetworkPolicies reduce breach impact by 90% according to...

[5-7 total findings]

## Common Themes

- Zero-trust architecture is becoming standard
- Automation of security policies
- Continuous security auditing

## Focus Area Analysis

### RBAC
**Summary:** RBAC controls access to Kubernetes API objects...

**Key Points:**
- Use least-privilege principle for all service accounts
- Regularly audit RBAC permissions
- Implement namespace-level isolation

**Best Practices:**
- Never use cluster-admin except for initial setup
- Create role bindings at namespace level
- Use RoleBinding instead of ClusterRoleBinding when possible

### network policies
[Detailed analysis]
```

---

## Configuration

### Default: Agent Mode (Recommended)

**No configuration needed!** Just use the tool.

```bash
# .env file
GOOGLE_API_KEY=your_google_key
GOOGLE_SEARCH_ENGINE_ID=your_search_id

# That's it! No ANTHROPIC_API_KEY needed
```

Server starts with:
```
✓ AI synthesis: AGENT MODE (Claude will launch agents)
  └─ No API key needed - uses your existing Claude session
```

### Alternative: Direct API Mode (Advanced)

Only use this if you want the MCP server to call Anthropic API directly:

```bash
# .env file
GOOGLE_API_KEY=your_google_key
GOOGLE_SEARCH_ENGINE_ID=your_search_id
ANTHROPIC_API_KEY=your_anthropic_key
USE_DIRECT_API=true
```

Server starts with:
```
✓ AI synthesis: DIRECT API MODE (advanced)
```

---

## Comparison: Agent Mode vs Direct API Mode

| Feature | Agent Mode | Direct API Mode |
|---------|-----------|-----------------|
| **API Key Required** | No (uses your Claude session) | Yes (separate key) |
| **Setup Complexity** | Simple | Requires extra config |
| **Cost** | Part of your Claude subscription | Separate API charges |
| **Transparency** | See agent working | Hidden in MCP server |
| **Context Awareness** | Agent has conversation context | No context |
| **Quality** | Same (uses same Claude model) | Same |
| **Speed** | Fast | Fast |
| **Recommended For** | Claude Code, Claude Desktop, Cline | Automated systems, scripts |

---

## Usage Examples

### Example 1: Basic Research

**You:**
```typescript
research_topic({
  topic: "WebAssembly performance optimization",
  depth: "basic"
})
```

**Tool Returns:**
```
[Agent prompt for 3 sources...]
```

**I Launch Agent:**
The agent analyzes the 3 sources and returns a 2-3 paragraph summary with 3-5 key findings.

### Example 2: Advanced Research with Focus Areas

**You:**
```typescript
research_topic({
  topic: "Microservices architecture",
  depth: "advanced",
  focus_areas: ["service mesh", "API gateway", "observability"],
  num_sources: 8
})
```

**Tool Returns:**
```
[Agent prompt for 8 sources with focus areas...]
```

**I Launch Agent:**
The agent provides:
- In-depth 6-paragraph executive summary
- 7-10 detailed findings
- Common themes across sources
- **Dedicated analysis for each of the 3 focus areas**
- Contradictions between sources identified
- Actionable recommendations

### Example 3: Quick Topic Overview

**You:**
```typescript
research_topic({
  topic: "GraphQL vs REST",
  depth: "basic"
})
```

Perfect for quick comparisons. Agent synthesizes 3 sources into concise overview.

---

## Best Practices

### 1. Use Specific Topics
**Avoid:** "programming"
**Better:** "Python asyncio best practices for high-performance web servers"

### 2. Leverage Focus Areas
For complex topics, use focus areas to get structured analysis:

```typescript
research_topic({
  topic: "Cloud security",
  depth: "advanced",
  focus_areas: [
    "identity and access management",
    "data encryption",
    "compliance and auditing"
  ]
})
```

### 3. Match Depth to Need

- **basic** (3 sources, 2-3 paragraphs): Quick overview, comparisons
- **intermediate** (5 sources, 4-5 paragraphs): Most common use case
- **advanced** (8-10 sources, 6+ paragraphs): Comprehensive research, decision-making

### 4. Review Source Quality

Check the quality scores in the agent prompt:
- **Authority 90%+** = Official docs, .edu, .gov
- **Authority 70-89%** = Reputable sites, industry blogs
- **Authority 50-69%** = Forums, community content
- **Authority <50%** = Verify carefully

### 5. Let the Agent Work

The agent will:
- Read all source excerpts
- Identify patterns
- Synthesize (not just summarize)
- Cite sources
- Provide actionable insights

Don't interrupt - let it complete the full analysis.

---

## Troubleshooting

### Agent Not Launching Automatically

If I don't automatically launch an agent:

1. **Check the response** - Look for `[AGENT_SYNTHESIS_REQUIRED]`
2. **Manual launch** - Copy the agent prompt and use Task tool manually
3. **Verify v3** - Make sure you're using `npm run start:v3` not v2

### Want to Use Direct API Mode

Set in `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
USE_DIRECT_API=true
```

Rebuild and restart:
```bash
npm run build
npm run start:v3
```

### Synthesis Quality Issues

If synthesis is not deep enough:
1. **Increase depth**: Use "advanced" instead of "basic"
2. **More sources**: Set `num_sources: 8` or `10`
3. **Add focus areas**: Break topic into specific areas
4. **Check source quality**: Low authority sources = lower quality synthesis

---

## Under the Hood

### What the MCP Server Does

1. **Search** - Queries Google for the topic (+ focus areas)
2. **Deduplicate** - Removes duplicate URLs and similar content
3. **Rank** - Scores sources by authority, recency, type
4. **Extract** - Pulls full content from top sources
5. **Package** - Bundles everything into an agent prompt
6. **Return** - Gives the prompt to Claude Code

### What the Agent Does

1. **Reads** - All source excerpts and summaries
2. **Analyzes** - Identifies patterns, themes, contradictions
3. **Synthesizes** - Creates cohesive narrative across sources
4. **Structures** - Organizes into required format
5. **Cites** - Attributes findings to specific sources
6. **Delivers** - Returns comprehensive analysis

---

## Why This Is Better

### Before (v2):
```
User: research_topic({topic: "Docker security"})
Tool: "summary": "..."  // Literally just dots
Result: Inadequate synthesis
```

### After (v3 with Agent Mode):
```
User: research_topic({topic: "Docker security"})
Tool: [Returns comprehensive research data + agent prompt]
Claude: [Launches agent automatically]
Agent: [Analyzes 5 sources, synthesizes insights]
Agent: Returns 4-paragraph executive summary,
       7 key findings with citations,
       3 common themes,
       contradictions identified,
       actionable recommendations
Result: Comprehensive research synthesis
```

---

## FAQ

**Q: Do I need to manually launch the agent?**
A: No! I (Claude Code) will see the `[AGENT_SYNTHESIS_REQUIRED]` marker and automatically launch the agent for you.

**Q: Can I still use the Anthropic API directly?**
A: Yes, set `USE_DIRECT_API=true` and provide `ANTHROPIC_API_KEY` in `.env`. But agent mode is recommended.

**Q: Does agent mode work with Claude Desktop?**
A: Yes! Works with Claude Code, Claude Desktop, Cline, and any MCP client using Claude.

**Q: Is agent mode slower?**
A: Negligibly. Agent launches add ~0.5s, but the synthesis itself takes the same time.

**Q: Will I be charged extra for agent usage?**
A: No - agents use your existing Claude subscription. No separate charges.

**Q: What if I'm using this in an automated script?**
A: Use Direct API mode for automation. Agent mode is designed for interactive use.

**Q: Can I see what the agent is doing?**
A: Yes! The agent's analysis process is visible in your Claude Code session (if you enable agent visibility).

---

## Examples in Practice

### Research Session Flow

```bash
# Terminal
npm run start:v3

# Output:
# ✓ AI synthesis: AGENT MODE (Claude will launch agents)
# └─ No API key needed - uses your existing Claude session
```

```typescript
// In Claude Code
research_topic({
  topic: "Rust memory safety guarantees",
  depth: "intermediate"
})

// Tool returns agent prompt
// I automatically launch agent
// Agent analyzes 5 sources
// Returns synthesized research with:
// - Executive summary
// - 5-7 key findings
// - Common themes
// - Quality metrics
```

**Result:** Comprehensive research in 10-15 seconds, using your existing Claude session.

---

**Agent Mode: Simple, Powerful, Integrated**

No API keys, no extra config, just better research.
