# Contributing to Google Research MCP

Thank you for your interest in contributing to the Google Research MCP Server. This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a professional and respectful environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature or fix
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Google Cloud Platform account with Custom Search API access
- Text editor or IDE (VS Code recommended)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Google-Research-MCP.git
cd Google-Research-MCP

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your credentials to .env
# GOOGLE_API_KEY=your_google_api_key
# GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# Build the project
npm run build

# Run the server
npm run start:v3
```

### Verify Installation

After running `npm run start:v3`, you should see:

```
============================================================
Google Research MCP Server v3.0.0 (Enhanced)
============================================================
Source quality assessment
Deduplication
AI synthesis: AGENT MODE (Claude will launch agents)
Focus area analysis
Enhanced error handling
Cache metadata
============================================================
Server running on STDIO
```

## Project Structure

```
src/
├── google-search-v3.ts              # Main MCP server
├── services/
│   ├── google-search.service.ts     # Google API integration
│   ├── content-extractor.service.ts # Web content extraction
│   ├── source-quality.service.ts    # Source ranking
│   ├── deduplication.service.ts     # Duplicate detection
│   └── research-synthesis.service.ts # Agent-based synthesis
├── types.ts                          # TypeScript interfaces
└── utils/                            # Utility functions
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-new-tool` - For new features
- `fix/search-bug` - For bug fixes
- `docs/update-readme` - For documentation updates
- `refactor/improve-dedup` - For code refactoring

### Commit Messages

Write clear, descriptive commit messages:

```
feat: add support for image search filtering
fix: resolve deduplication edge case for Reddit URLs
docs: update AGENT-MODE.md with troubleshooting section
refactor: extract URL normalization to utility function
```

Format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or modifications
- `chore:` - Maintenance tasks

## Testing

### Manual Testing

Before submitting changes, test all affected functionality:

```typescript
// Test basic search
google_search({
  query: "test query",
  num_results: 5
})

// Test research with agent mode
research_topic({
  topic: "test topic",
  depth: "intermediate"
})

// Test content extraction
extract_webpage_content({
  url: "https://example.com"
})
```

### Testing Checklist

- [ ] Server starts without errors
- [ ] All tools execute successfully
- [ ] Agent mode synthesis works correctly
- [ ] Quality scores appear in search results
- [ ] Deduplication functions properly
- [ ] Error handling provides helpful messages
- [ ] TypeScript compiles without errors
- [ ] No console warnings or errors

### Build Testing

```bash
# Clean build
rm -rf dist/
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

## Submitting Changes

### Pull Request Process

1. **Update Documentation**
   - Update README.md if adding features
   - Update relevant .md files in docs
   - Add JSDoc comments to new functions

2. **Test Thoroughly**
   - Run the testing checklist above
   - Test edge cases
   - Verify no regressions

3. **Create Pull Request**
   - Provide clear description of changes
   - Reference related issues
   - Include testing performed
   - Add screenshots if UI-related

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Performed
- Describe testing done
- List test cases covered

## Checklist
- [ ] Code follows project style guidelines
- [ ] Documentation updated
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] No console warnings
```

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Define interfaces for all data structures
- Avoid `any` type when possible
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Assesses the quality of a source based on URL and content.
 * @param url - The source URL
 * @param content - Optional webpage content
 * @returns Source quality assessment
 */
assessSource(url: string, content?: WebpageContent): SourceQuality {
  // Implementation
}
```

### Formatting

- Use 2 spaces for indentation
- Max line length: 100 characters
- Use single quotes for strings
- Add trailing commas in multi-line objects/arrays

```typescript
const config = {
  option1: 'value1',
  option2: 'value2',
  option3: 'value3',
};
```

### Error Handling

Always provide helpful error messages:

```typescript
throw new Error(
  `Failed to extract content from ${url}. ` +
  `Ensure the URL is accessible and returns valid HTML.`
);
```

### Service Pattern

Follow existing service patterns:

```typescript
export class NewService {
  private config: Config;

  constructor(config?: Partial<Config>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async performAction(params: Params): Promise<Result> {
    // Implementation
  }

  private helperMethod(): void {
    // Helper implementation
  }
}
```

## Reporting Issues

### Bug Reports

Include:

1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - Exact steps to trigger the bug
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment**
   - Node.js version
   - Operating system
   - MCP client (Claude Code, Claude Desktop, etc.)
6. **Error Messages** - Complete error output
7. **Additional Context** - Screenshots, logs, etc.

### Feature Requests

Include:

1. **Problem Description** - What problem does this solve?
2. **Proposed Solution** - How should it work?
3. **Alternatives Considered** - Other approaches considered
4. **Use Cases** - Real-world usage scenarios
5. **Additional Context** - Examples, mockups, etc.

## Areas for Contribution

### High Priority

- Additional source quality heuristics
- Performance optimizations
- Enhanced deduplication algorithms
- Additional output formats
- Improved error recovery

### Medium Priority

- Additional search filters
- Content extraction improvements
- Cache management
- Rate limiting enhancements

### Documentation

- Additional usage examples
- API documentation
- Troubleshooting guides
- Video tutorials

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search existing issues
3. Open a new issue with the question label

---

Thank you for contributing to Google Research MCP Server!
