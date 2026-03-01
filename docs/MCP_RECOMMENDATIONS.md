# MCP Recommendations for CafeDuo

Last updated: 2026-03-01

## Executive Summary

Context7 MCP is already configured and working. This document provides an overview of the current MCP setup and recommendations for additional MCPs that would benefit the CafeDuo project.

## Current MCP Configuration

### Configured in Codex Environment

According to [`docs/skills_mcp_setup.md`](docs/skills_mcp_setup.md), the following MCPs are configured in the Codex environment:

#### ✅ Active MCPs

1. **context7** - Documentation and code context server
   - Transport: `stdio`
   - Command: `npx -y @upstash/context7-mcp`
   - Status: ✅ **Working** (verified via test query)
   - Purpose: Provides up-to-date documentation and code examples for libraries
   - Also configured in [`.roo/mcp.json`](.roo/mcp.json:1-7)

2. **openaiDeveloperDocs** - OpenAI documentation
   - Transport: `streamable_http`
   - URL: `https://developers.openai.com/mcp`
   - Purpose: Access to OpenAI API documentation

3. **brave-search** - Web search capabilities
   - Transport: `stdio`
   - Command: `npx -y @brave/brave-search-mcp-server`
   - Purpose: Web search for research and documentation lookup

4. **clean-code** - Code graph and context server
   - Transport: `stdio`
   - Command: `npx -y @supermodeltools/mcp-server`
   - Purpose: Clean code focused context and code graph analysis

5. **fetch** - HTTP request capabilities
   - Transport: `stdio`
   - Command: `npx -y @modelcontextprotocol/server-fetch`
   - Purpose: Controlled web content extraction for docs/spec validation

6. **git** - Git repository operations
   - Transport: `stdio`
   - Command: `npx -y @modelcontextprotocol/server-git`
   - Purpose: Structured repository inspection for release diffs and audits

7. **playwright-mcp** - E2E testing support
   - Transport: `stdio`
   - Command: `npx -y @playwright/mcp@latest`
   - Purpose: Playwright test automation and debugging

8. **time** - Timezone-safe time operations
   - Transport: `stdio`
   - Command: `npx -y @modelcontextprotocol/server-time`
   - Purpose: TZ-safe scheduling/cron checks for production operations

9. **websearch** - Additional web search
   - Transport: `stdio`
   - Command: `npx -y open-websearch`
   - Purpose: Alternative web search capabilities

### ⏳ Pending Optional MCPs

1. **postgres-cafeduo** - PostgreSQL database access
   - Package: `@modelcontextprotocol/server-postgres`
   - Command: `npx -y @modelcontextprotocol/server-postgres "postgresql://USER:PASS@HOST:5432/DB"`
   - Status: Not configured (requires valid `***REMOVED***`)
   - Purpose: DB schema/query inspection during bug triage and release checks

## Project Technology Stack

CafeDuo uses the following technologies that could benefit from additional MCP support:

- **Frontend**: React + TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, CommonJS
- **Database**: PostgreSQL with node-pg-migrate
- **Cache**: Redis (Upstash)
- **Real-time**: Socket.IO
- **Testing**: Jest, Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Docker, Caddy

## Recommended MCP Additions

### High Priority

#### 1. PostgreSQL MCP (`postgres-cafeduo`)

**Why**: Direct database inspection capabilities would be valuable for:
- Schema validation during migrations
- Query optimization and performance analysis
- Data integrity checks
- Production troubleshooting

**Setup**:
```bash
# When ***REMOVED*** is available (production/staging)
codex mcp add postgres-cafeduo -- npx -y @modelcontextprotocol/server-postgres "postgresql://USER:PASS@HOST:5432/DB"
```

**Security Note**: 
- Use environment variables for credentials, not command args
- Consider read-only credentials for non-admin use
- Keep production credentials out of MCP configs

**Current Status**: Listed as pending in `docs/skills_mcp_setup.md`

#### 2. Redis MCP

**Why**: Redis is a critical component for:
- Cache inspection and debugging
- Session management verification
- Rate limiting monitoring
- Real-time state inspection

**Potential Package**: Look for `@modelcontextprotocol/server-redis` or similar in the MCP registry

**Note**: As of knowledge cutoff (May 2025), this may not exist yet. Check the [MCP Registry](https://modelcontextprotocol.io/registry) for availability.

### Medium Priority

#### 3. GitHub MCP (`@modelcontextprotocol/server-github`)

**Why**: Would enable:
- PR review workflows
- Issue tracking and management
- CI/CD pipeline inspection
- Release management

**Current Status**: Not configured, but **git** MCP provides local repository access

**Setup**:
```bash
codex mcp add github -- npx -y @modelcontextprotocol/server-github
```

**Note**: Requires GitHub token for authentication

#### 4. Docker MCP

**Why**: Useful for:
- Container inspection and debugging
- Image build verification
- Docker Compose orchestration
- Production deployment checks

**Potential Package**: Check MCP registry for Docker-related servers

### Low Priority (Already Covered)

These were considered but are already covered by existing MCPs:

- ✅ **Testing**: Covered by `playwright-mcp`
- ✅ **Code Context**: Covered by `context7` and `clean-code`
- ✅ **Documentation**: Covered by `context7`, `openaiDeveloperDocs`, and `brave-search`
- ✅ **Git Operations**: Covered by `git` MCP
- ✅ **Web Requests**: Covered by `fetch` MCP

## MCP Best Practices

Based on [`docs/skills_mcp_research.md`](docs/skills_mcp_research.md), follow these guardrails:

### Security

1. **Prefer maintained servers** from official MCP sources and registry
2. **Remote MCP servers** must enforce auth + origin validation
3. **Keep secrets out of MCP command args** - inject via env vars instead
4. **Use read-only credentials** where possible for database/API access

### Configuration

1. **Test MCPs individually** before adding to production workflows
2. **Document purpose and use cases** for each MCP
3. **Version pin critical MCPs** to avoid breaking changes
4. **Monitor resource usage** for stdio-based MCPs

### Maintenance

1. **Regular updates** - Check for MCP package updates monthly
2. **Deprecation checks** - Monitor MCP registry for deprecated servers
3. **Performance monitoring** - Track MCP response times and failures
4. **Audit access logs** - Review MCP usage patterns for security

## Installation Instructions

### For New MCPs

1. **Test locally first**:
   ```bash
   npx -y <mcp-package> [args]
   ```

2. **Add to Codex environment**:
   ```bash
   codex mcp add <name> -- npx -y <mcp-package> [args]
   ```

3. **Add to `.roo/mcp.json`** (if using Roo):
   ```json
   {
     "mcpServers": {
       "<name>": {
         "command": "npx",
         "args": ["-y", "<mcp-package>"],
         "transport": "stdio"
       }
     }
   }
   ```

4. **Restart Codex/Roo** to ensure new MCPs are fully available

### For PostgreSQL MCP

1. **Generate database URL** from environment:
   ```bash
   # Local development
   export DB_URL="postgresql://cafeduo:password@localhost:5432/cafeduo"
   
   # Production (read-only recommended)
   export DB_URL="postgresql://readonly_user:password@prod-host:5432/cafeduo"
   ```

2. **Configure MCP**:
   ```bash
   codex mcp add postgres-cafeduo -- npx -y @modelcontextprotocol/server-postgres "$DB_URL"
   ```

3. **Test connection**:
   - Use MCP tools to run a simple query
   - Verify read-only access if configured that way

## Context7 MCP Usage

Context7 is already configured and working. Here's how to use it effectively:

### Query Documentation

Use Context7 to get up-to-date documentation for any library:

```typescript
// Example: Get Socket.IO documentation
mcp--context7--resolve-library-id({
  libraryName: "socket.io",
  query: "Socket.IO event handling and authentication"
})

// Then query specific topics
mcp--context7--query-docs({
  libraryId: "/websites/socket_io_v4",
  query: "How to implement JWT authentication with Socket.IO"
})
```

### Supported Libraries for CafeDuo

Context7 has excellent coverage for our stack:

- **Socket.IO**: 1374+ code snippets (v4)
- **React**: Comprehensive documentation
- **Express**: Node.js server documentation
- **PostgreSQL**: Database documentation
- **Jest**: Testing documentation
- **Playwright**: E2E testing documentation

### Best Practices

1. **Be specific in queries** - Better results with detailed questions
2. **Use library IDs** - More accurate than package names
3. **Check versions** - Ensure documentation matches your version
4. **Combine with web search** - Use brave-search for supplemental info

## Next Steps

### Immediate

1. ✅ Context7 MCP configured in [`.roo/mcp.json`](.roo/mcp.json:1-7)
2. ✅ Documentation created

### Short-term (Before Production Deploy)

1. **Configure PostgreSQL MCP** when database credentials are finalized
2. **Test GitHub MCP** for PR workflows during stabilization phase
3. **Audit all MCP access** for security compliance

### Long-term (Post-Launch)

1. **Monitor MCP registry** for new relevant servers
2. **Evaluate Redis MCP** when available
3. **Consider Docker MCP** for production deployment workflows
4. **Review custom MCP needs** based on operational patterns

## Resources

- **MCP Registry**: https://modelcontextprotocol.io/registry
- **MCP Specification**: https://modelcontextprotocol.io/specification
- **Official MCP Servers**: https://github.com/modelcontextprotocol/servers
- **Context7 MCP**: https://github.com/upstash/context7-mcp

## Related Documentation

- [`docs/skills_mcp_setup.md`](docs/skills_mcp_setup.md) - Current MCP configuration
- [`docs/skills_mcp_research.md`](docs/skills_mcp_research.md) - Research notes and guardrails
- [`.roo/mcp.json`](.roo/mcp.json) - Roo MCP configuration
- [`AGENTS.md`](AGENTS.md) - Agent rules and conventions
