# OpsiMate backend

**One alert queue for all your monitoring tools.** Grafana, Datadog, Zabbix, Uptime Kuma and Google Cloud each have their own alert list. OpsiMate gives your NOC one screen: every alert, one owner, one place to say "we know, it's handled". Self-hosted, no SaaS.

This image is the API server and alert ingestion. It runs alongside `opsimate/frontend` (web UI) and, optionally, `opsimate/mcp` (MCP server for AI assistants).

## Quick start

```
curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/scripts/start-docker.sh | sh
```

Web UI: http://localhost:8080 · API: http://localhost:3001

Or with a compose file, Helm chart or Terraform: see the [deployment guide](https://docs.opsimate.dev/docs/getting-started/deploy).

## What it does

- Receives alerts by webhook from Grafana, Datadog, Zabbix, Uptime Kuma, Google Cloud Monitoring and any custom source
- Owners, incidents, mute policies, enrichments and silences on top of the raw alerts
- Root-cause analysis via API, alert insights (MTTR, MTTA, volume), AI-powered search
- Keeps the queue fast at 10K+ alerts

## Configuration

| Variable | Purpose |
|---|---|
| `API_TOKEN` | Token that webhook sources must send (default `opsimate`; change it) |
| `PORT` | API port (default `3001`) |
| `CONFIG_FILE` | Optional YAML config path |

Full list: [environment and config reference](https://docs.opsimate.dev/).

## Tags

`latest` and `X.Y.Z` (semver), multi-arch (amd64, arm64). Each release also publishes `X.Y.Z-amd64` and `X.Y.Z-arm64`.

## Links

[GitHub](https://github.com/OpsiMate/OpsiMate) · [Docs](https://docs.opsimate.dev) · [Demo](https://demo.opsimate.dev) · [Website](https://www.opsimate.dev) · [Slack](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)

Licensed under AGPL-3.0. If OpsiMate is useful to you, a star on [GitHub](https://github.com/OpsiMate/OpsiMate) helps the project.
