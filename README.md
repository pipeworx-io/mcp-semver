# mcp-semver

Semantic Versioning (semver) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `parse_semver` | Parse a semantic-version string into major/minor/patch/prerelease/build (keyless, offline). Accepts an optional leading "v". |
| `compare_semver` | Compare two semver strings. Returns -1 (a<b), 0 (equal), or 1 (a>b), honoring prerelease precedence. |
| `satisfies_range` | Test whether a version satisfies a range: exact, ^ (caret), ~ (tilde), comparators (>=,>,<=,<,=), x-ranges (1.2.x), AND (space-separated), OR (\|\|). E.g. version "1.4.2", range "^1.2.0". |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "semver": {
      "url": "https://gateway.pipeworx.io/semver/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Semver data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
