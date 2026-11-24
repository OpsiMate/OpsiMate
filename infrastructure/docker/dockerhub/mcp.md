# OpsiMate MCP server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for [OpsiMate](https://github.com/OpsiMate/OpsiMate), the self-hosted alert queue for Grafana, Datadog, Zabbix, Uptime Kuma and Google Cloud alerts. It lets an AI assistant (Claude, Cursor, any MCP client) read and act on your alerts through the OpsiMate API.

## Quick start

```
docker run -d --name opsimate-mcp -p 3100:3100 \
  -e OPSIMATE_URL=http://your-opsimate-host:3001 \
  opsimate/mcp:latest
```

Health check: `GET http://localhost:3100/health`. MCP endpoint: `POST http://localhost:3100/mcp` with your OpsiMate API token in the `x-api-token` header.

Setup for each client, and the full tool list: [MCP guide](https://docs.opsimate.dev/).

## Tags

`latest` and `X.Y.Z` (semver), multi-arch (amd64, arm64). Match the version of your `opsimate/backend`.

## Links

[GitHub](https://github.com/OpsiMate/OpsiMate) · [Docs](https://docs.opsimate.dev) · [Website](https://www.opsimate.dev) · [Slack](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)

Licensed under AGPL-3.0.
