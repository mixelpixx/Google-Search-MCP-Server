import { WebpageContent } from '../types.js';
import { SourceQuality } from './source-quality.service.js';

export interface ResearchSynthesis {
  summary: string;
  key_findings: string[];
  themes: string[];
  focus_analysis?: Record<string, FocusAreaAnalysis>;
  contradictions?: string[];
  recommendations?: string[];
}

export interface FocusAreaAnalysis {
  summary: string;
  findings: string[];
  best_practices?: string[];
}

export type ResearchDepth = 'basic' | 'intermediate' | 'advanced';

export class ResearchSynthesisService {
  private client: any = null;
  private useAgentMode: boolean = false;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const forceDirectAPI = process.env.USE_DIRECT_API === 'true';

    // DEFAULT TO AGENT MODE since user is already using Claude
    // (via Claude Code, Claude Desktop, Cline, etc.)
    // Only use direct API if explicitly configured
    if (apiKey && forceDirectAPI) {
      this.initializeDirectAPI(apiKey);
    } else {
      // Agent mode is the default - works with Claude Code/Desktop/Cline out of the box
      this.useAgentMode = true;
      console.warn('Using agent-based synthesis (recommended for Claude Code/Desktop/Cline)');
      console.warn('Agents will be launched automatically to synthesize research');
    }
  }

  private async initializeDirectAPI(apiKey: string): Promise<void> {
    try {
      // Dynamic import - package must be installed separately for Direct API mode
      const anthropicModule = await eval('import("@anthropic-ai/sdk")');
      const Anthropic = anthropicModule.default;
      this.client = new Anthropic({ apiKey });
      this.useAgentMode = false;
      console.warn('Using direct API synthesis (advanced mode)');
    } catch (error) {
      console.error('Failed to load @anthropic-ai/sdk. Install it with: npm install @anthropic-ai/sdk');
      console.warn('Falling back to agent mode');
      this.useAgentMode = true;
    }
  }

  /**
   * Check if synthesis service is available
   */
  isAvailable(): boolean {
    return this.client !== null || this.useAgentMode;
  }

  /**
   * Check if using agent mode
   */
  isAgentMode(): boolean {
    return this.useAgentMode;
  }

  /**
   * Synthesize research from multiple sources
   */
  async synthesizeResearch(
    topic: string,
    contents: Map<string, WebpageContent>,
    sourceQualities: Map<string, SourceQuality>,
    depth: ResearchDepth = 'intermediate',
    focusAreas?: string[]
  ): Promise<ResearchSynthesis> {
    if (!this.isAvailable()) {
      // Fallback to basic synthesis if API not available
      return this.basicSynthesis(topic, contents, focusAreas);
    }

    // AGENT MODE: Return agent prompt instead of calling API
    if (this.useAgentMode) {
      return this.agentModeSynthesis(topic, contents, sourceQualities, depth, focusAreas);
    }

    try {
      const prompt = this.buildSynthesisPrompt(
        topic,
        contents,
        sourceQualities,
        depth,
        focusAreas
      );

      const response = await this.client!.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: this.getMaxTokensForDepth(depth),
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // Parse the response
      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      return this.parseSynthesisResponse(responseText);
    } catch (error) {
      console.error('Synthesis error:', error);
      // Fallback to basic synthesis on error
      return this.basicSynthesis(topic, contents, focusAreas);
    }
  }

  /**
   * Agent mode synthesis - returns a placeholder that Claude Code will replace with agent output
   */
  private agentModeSynthesis(
    topic: string,
    contents: Map<string, WebpageContent>,
    sourceQualities: Map<string, SourceQuality>,
    depth: ResearchDepth,
    focusAreas?: string[]
  ): ResearchSynthesis {
    // Build the research data package for the agent
    const agentPrompt = this.buildAgentPrompt(topic, contents, sourceQualities, depth, focusAreas);

    // Return a synthesis that tells Claude Code to launch an agent
    return {
      summary: `[AGENT_SYNTHESIS_REQUIRED]\n\n${agentPrompt}`,
      key_findings: [
        'Agent synthesis will be performed by Claude Code',
        'Launch a general-purpose agent with the provided research data',
        'Agent will analyze all sources and generate comprehensive findings'
      ],
      themes: ['Agent-based synthesis in progress'],
      focus_analysis: focusAreas ? this.createAgentFocusPlaceholder(focusAreas) : undefined
    };
  }

  /**
   * Build prompt for Claude Code agent to use
   */
  private buildAgentPrompt(
    topic: string,
    contents: Map<string, WebpageContent>,
    sourceQualities: Map<string, SourceQuality>,
    depth: ResearchDepth,
    focusAreas?: string[]
  ): string {
    const depthInstructions = {
      basic: 'Provide a brief 2-3 paragraph overview with 3-5 key findings.',
      intermediate: 'Provide a comprehensive analysis with 5-7 key findings, common themes, and practical takeaways.',
      advanced: 'Provide an in-depth analysis with 7-10 findings, detailed themes, contradictions between sources, and actionable recommendations.'
    };

    // Compile sources with quality scores
    let sourcesText = '';
    let sourceIndex = 1;

    for (const [url, content] of contents.entries()) {
      const quality = sourceQualities.get(url);

      sourcesText += `\n\n=== SOURCE ${sourceIndex} ===\n`;
      sourcesText += `Title: ${content.title}\n`;
      sourcesText += `URL: ${url}\n`;

      if (quality) {
        sourcesText += `Type: ${quality.type}\n`;
        sourcesText += `Authority: ${Math.round(quality.authority_score * 100)}%\n`;
        sourcesText += `Credibility: ${Math.round(quality.credibility_score * 100)}%\n`;
        if (quality.author) sourcesText += `Author: ${quality.author}\n`;
        if (quality.publication_date) sourcesText += `Published: ${quality.publication_date}\n`;
      }

      sourcesText += `\nContent Summary:\n${content.summary || content.description}\n`;
      sourcesText += `\nKey Excerpts:\n${this.truncateContent(content.content, 2000)}\n`;
      sourceIndex++;
    }

    let prompt = `RESEARCH SYNTHESIS TASK

You are analyzing research on: "${topic}"

**Analysis Depth:** ${depth}
**Number of Sources:** ${contents.size}
${focusAreas && focusAreas.length > 0 ? `**Focus Areas:** ${focusAreas.join(', ')}` : ''}

**Instructions:** ${depthInstructions[depth]}

${focusAreas && focusAreas.length > 0 ? `\n**Focus Area Requirements:**
For each focus area (${focusAreas.join(', ')}), provide:
1. Dedicated summary of findings specific to that area
2. 3-5 key points
3. Best practices or recommendations specific to that area\n` : ''}

**Research Sources:**
${sourcesText}

**Required Output Format:**

Please provide your analysis in the following structure:

## Executive Summary
[Comprehensive 3-6 paragraph synthesis of all sources]

## Key Findings
1. [Finding 1 - with source attribution]
2. [Finding 2 - with source attribution]
3. [Continue for ${depth === 'basic' ? '3-5' : depth === 'intermediate' ? '5-7' : '7-10'} findings]

## Common Themes
- [Theme 1]
- [Theme 2]
- [Theme 3]
${depth === 'advanced' ? '- [Additional themes as discovered]' : ''}

${focusAreas && focusAreas.length > 0 ? `\n## Focus Area Analysis\n\n${focusAreas.map(area => `### ${area}\n**Summary:** [Analysis specific to ${area}]\n**Key Points:**\n- [Point 1]\n- [Point 2]\n- [Point 3]\n**Best Practices:**\n- [Practice 1]\n- [Practice 2]\n`).join('\n')}\n` : ''}

${depth === 'advanced' ? `## Contradictions Between Sources
- [List any disagreements or conflicting information between sources]

## Recommendations
- [Actionable recommendation 1]
- [Actionable recommendation 2]
- [Continue with practical takeaways]
` : ''}

**Analysis Guidelines:**
- Synthesize information across ALL sources, don't just summarize each separately
- Identify patterns and themes that emerge across multiple sources
- Note the authority/credibility scores when weighing conflicting information
- Provide specific, actionable insights
- Cite sources when making specific claims (e.g., "according to [Source Title]...")
${depth === 'advanced' ? '- Identify gaps in the research or areas needing more investigation' : ''}

Begin your analysis:`;

    return prompt;
  }

  /**
   * Create placeholder focus analysis for agent mode
   */
  private createAgentFocusPlaceholder(focusAreas: string[]): Record<string, FocusAreaAnalysis> {
    const analysis: Record<string, FocusAreaAnalysis> = {};

    for (const area of focusAreas) {
      analysis[area] = {
        summary: `Agent will provide dedicated analysis for: ${area}`,
        findings: [`Detailed findings for ${area} will be synthesized by the agent`]
      };
    }

    return analysis;
  }

  /**
   * Build the synthesis prompt for the LLM
   */
  private buildSynthesisPrompt(
    topic: string,
    contents: Map<string, WebpageContent>,
    sourceQualities: Map<string, SourceQuality>,
    depth: ResearchDepth,
    focusAreas?: string[]
  ): string {
    const depthInstructions = {
      basic: 'Provide a brief 2-3 paragraph overview with 3-5 key findings.',
      intermediate: 'Provide a comprehensive analysis with 5-7 key findings, common themes, and practical takeaways.',
      advanced: 'Provide an in-depth analysis with 7-10 findings, detailed themes, contradictions between sources, and actionable recommendations.'
    };

    // Compile sources with quality scores
    let sourcesText = '';
    let sourceIndex = 1;

    for (const [url, content] of contents.entries()) {
      const quality = sourceQualities.get(url);

      sourcesText += `\n\n=== SOURCE ${sourceIndex} ===\n`;
      sourcesText += `Title: ${content.title}\n`;
      sourcesText += `URL: ${url}\n`;

      if (quality) {
        sourcesText += `Type: ${quality.type}\n`;
        sourcesText += `Authority: ${Math.round(quality.authority_score * 100)}%\n`;
        sourcesText += `Credibility: ${Math.round(quality.credibility_score * 100)}%\n`;
        if (quality.author) sourcesText += `Author: ${quality.author}\n`;
        if (quality.publication_date) sourcesText += `Published: ${quality.publication_date}\n`;
      }

      sourcesText += `\nContent:\n${this.truncateContent(content.content, 3000)}\n`;
      sourceIndex++;
    }

    let prompt = `You are a research analyst. Analyze the following ${contents.size} sources about "${topic}" and provide a structured synthesis.

${depthInstructions[depth]}

${focusAreas && focusAreas.length > 0 ? `\nFocus Areas to address: ${focusAreas.join(', ')}` : ''}

SOURCES:
${sourcesText}

Provide your response in the following JSON format:
{
  "summary": "A well-written comprehensive summary",
  "key_findings": ["Finding 1", "Finding 2", ...],
  "themes": ["Theme 1", "Theme 2", ...],
  ${focusAreas && focusAreas.length > 0 ? `"focus_analysis": {
    "${focusAreas[0]}": {
      "summary": "...",
      "findings": ["...", "..."],
      "best_practices": ["...", "..."]
    }
  },` : ''}
  "contradictions": ["Any contradictions found between sources"],
  "recommendations": ["Actionable recommendations based on the research"]
}

Ensure your response is valid JSON and comprehensive.`;

    return prompt;
  }

  /**
   * Parse the LLM response into structured format
   */
  private parseSynthesisResponse(response: string): ResearchSynthesis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || 'No summary provided',
        key_findings: parsed.key_findings || [],
        themes: parsed.themes || [],
        focus_analysis: parsed.focus_analysis,
        contradictions: parsed.contradictions,
        recommendations: parsed.recommendations
      };
    } catch (error) {
      console.error('Failed to parse synthesis response:', error);

      // Return a basic structure if parsing fails
      return {
        summary: response.substring(0, 1000),
        key_findings: ['Analysis completed - see summary for details'],
        themes: []
      };
    }
  }

  /**
   * Truncate content to fit within token limits
   */
  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    return content.substring(0, maxChars) + '\n\n[Content truncated...]';
  }

  /**
   * Get max tokens based on depth level
   */
  private getMaxTokensForDepth(depth: ResearchDepth): number {
    const tokenLimits = {
      basic: 1500,
      intermediate: 3000,
      advanced: 4000
    };

    return tokenLimits[depth];
  }

  /**
   * Basic synthesis fallback (when API is not available)
   */
  private basicSynthesis(
    topic: string,
    contents: Map<string, WebpageContent>,
    focusAreas?: string[]
  ): ResearchSynthesis {
    const findings: string[] = [];
    const themes = new Set<string>();

    // Extract summaries and titles as findings
    for (const [url, content] of contents.entries()) {
      if (content.summary) {
        findings.push(`${content.title}: ${content.summary}`);
      }

      // Extract potential themes from titles
      const words = content.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 5) {
          themes.add(word);
        }
      });
    }

    const summary = `Research on "${topic}" based on ${contents.size} sources. ${
      findings.length > 0 ? findings[0] : 'Multiple sources analyzed.'
    }`;

    return {
      summary,
      key_findings: findings.slice(0, 7),
      themes: Array.from(themes).slice(0, 5),
      focus_analysis: focusAreas ? this.createBasicFocusAnalysis(focusAreas, contents) : undefined
    };
  }

  /**
   * Create basic focus area analysis without LLM
   */
  private createBasicFocusAnalysis(
    focusAreas: string[],
    contents: Map<string, WebpageContent>
  ): Record<string, FocusAreaAnalysis> {
    const analysis: Record<string, FocusAreaAnalysis> = {};

    for (const area of focusAreas) {
      const relevantContent: string[] = [];

      // Find content relevant to this focus area
      for (const [url, content] of contents.entries()) {
        const areaLower = area.toLowerCase();
        if (
          content.title.toLowerCase().includes(areaLower) ||
          content.content.toLowerCase().includes(areaLower)
        ) {
          relevantContent.push(`${content.title}: ${content.summary || content.description}`);
        }
      }

      analysis[area] = {
        summary: relevantContent.length > 0
          ? `Found ${relevantContent.length} sources discussing ${area}`
          : `Limited information found on ${area}`,
        findings: relevantContent.slice(0, 3)
      };
    }

    return analysis;
  }

  /**
   * Synthesize content for a specific focus area
   */
  async synthesizeFocusArea(
    topic: string,
    focusArea: string,
    contents: Map<string, WebpageContent>,
    depth: ResearchDepth = 'intermediate'
  ): Promise<FocusAreaAnalysis> {
    if (!this.isAvailable()) {
      return this.basicSynthesis(topic, contents, [focusArea]).focus_analysis![focusArea];
    }

    try {
      const prompt = `Analyze the following sources about "${focusArea}" in the context of "${topic}".

Provide a focused analysis including:
1. Summary of key points about ${focusArea}
2. Specific findings related to ${focusArea}
3. Best practices or recommendations

Sources:
${Array.from(contents.values()).map(c =>
  `Title: ${c.title}\n${this.truncateContent(c.content, 2000)}`
).join('\n\n---\n\n')}

Return as JSON: {"summary": "...", "findings": ["..."], "best_practices": ["..."]}`;

      const response = await this.client!.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const parsed = JSON.parse(responseText.match(/\{[\s\S]*\}/)![0]);

      return {
        summary: parsed.summary,
        findings: parsed.findings || [],
        best_practices: parsed.best_practices
      };
    } catch (error) {
      console.error('Focus area synthesis error:', error);
      return this.basicSynthesis(topic, contents, [focusArea]).focus_analysis![focusArea];
    }
  }
}
