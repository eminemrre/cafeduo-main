# Skills and MCP Setup

Last updated: 2026-02-06

## Installed Skills
- `codex-readiness-integration-test`
- `codex-readiness-unit-test`
- `doc`
- `gh-fix-ci`
- `openai-docs`
- `playwright`
- `security-best-practices`
- `security-ownership-map`
- `security-threat-model`

Notes:
- These are installed under `~/.codex/skills`.
- Restart Codex to ensure new skills are fully available in all sessions.

## Configured MCP Servers
- `openaiDeveloperDocs`
  - Transport: `streamable_http`
  - URL: `https://developers.openai.com/mcp`
- `brave-search`
  - Transport: `stdio`
  - Command: `npx -y @brave/brave-search-mcp-server`
- `clean-code`
  - Transport: `stdio`
  - Command: `npx -y @supermodeltools/mcp-server`
  - Note: clean-code odakli code graph/context server olarak eklendi.
- `context7`
  - Transport: `stdio`
  - Command: `npx -y @upstash/context7-mcp`
- `fetch`
  - Transport: `stdio`
  - Command: `npx -y @modelcontextprotocol/server-fetch`
- `git`
  - Transport: `stdio`
  - Command: `npx -y @modelcontextprotocol/server-git`
- `playwright-mcp`
  - Transport: `stdio`
  - Command: `npx -y @playwright/mcp@latest`
- `time`
  - Transport: `stdio`
  - Command: `npx -y @modelcontextprotocol/server-time`
- `websearch`
  - Transport: `stdio`
  - Command: `npx -y open-websearch`

## Runtime Check
- `list_mcp_resources`: no resources returned
- `list_mcp_resource_templates`: no templates returned
- Not: Bu durum sunucularin kayitli oldugu, ancak ilgili server'in resource expose etmedigi senaryolarda normaldir.

## Pending Optional MCP
- `postgres-cafeduo` can be added when a valid `DATABASE_URL` is available:
  - `codex mcp add postgres-cafeduo -- npx -y @modelcontextprotocol/server-postgres "postgresql://USER:PASS@HOST:5432/DB"`

## Recommended Next Skills (Curated)
- `cloudflare-deploy` for DNS/CDN/WAF and edge rollout.
- `sentry` for production error tracking workflows.
- `develop-web-game` for deeper game-loop iteration and balancing workflows.
- `linux-service-hardening` for production VDS service hardening and safer ops defaults.

See also:
- `docs/skills_mcp_research.md` for source-backed recommendation notes.
