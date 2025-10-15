# MCP Server (GitHub)

This folder provides a simple scaffold to run the GitHub MCP Server locally using the official container image. It is intended to satisfy repository-level MCP expectations and provide a working local/CI entrypoint for tools that expect an MCP server.

Prerequisites
- Docker (for local container runs)
- A GitHub Personal Access Token (PAT) with scopes you want to expose to tools (see README below)

Quick start (Docker)

1. Create a file `mcp-server/.env` with:

```
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx
GITHUB_TOOLSETS="repos,issues,pull_requests"
GITHUB_HOST=
```

2. Run the server:

```
docker run -i --rm --env-file .env ghcr.io/github/github-mcp-server
```

VS Code MCP example

Create a `.vscode/mcp.json` with configuration to point the MCP host to this server (example provided in this repo).

CI example

There is a GitHub Actions workflow `.github/workflows/mcp-server.yml` that demonstrates starting the server (via Docker) for CI checks.

Security

Do not commit real PATs into the repo. Use repository or organization secrets for CI.

Extending

If you want a custom MCP server binary, you can build from source (Go) and replace the `docker run` command with your binary invocation. See upstream: https://github.com/github/github-mcp-server
