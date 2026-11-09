# OpsiMate frontend

**One alert queue for all your monitoring tools.** Grafana, Datadog, Zabbix, Uptime Kuma and Google Cloud each have their own alert list. OpsiMate gives your NOC one screen: every alert, one owner, one place to say "we know, it's handled". Self-hosted, no SaaS.

This image is the web UI. It needs `opsimate/backend` (API, port 3001) running next to it.

## Quick start

```
curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/scripts/start-docker.sh | sh
```

Web UI: http://localhost:8080 · API: http://localhost:3001

Or with a compose file, Helm chart or Terraform: see the [deployment guide](https://docs.opsimate.dev/docs/getting-started/deploy).

## What you get

- One alerts table across every source, with grouping, filters, saved dashboards and keyboard navigation
- Owners and incidents, so every alert has a person and a status
- Mute policies, enrichments and silences to cut known noise
- TV mode for NOC displays, dark and light themes

## Tags

`latest` and `X.Y.Z` (semver), multi-arch (amd64, arm64). Each release also publishes `X.Y.Z-amd64` and `X.Y.Z-arm64`. Use the same version tag for frontend and backend.

## Links

[GitHub](https://github.com/OpsiMate/OpsiMate) · [Docs](https://docs.opsimate.dev) · [Demo](https://demo.opsimate.dev) · [Website](https://www.opsimate.dev) · [Slack](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)

Licensed under AGPL-3.0. If OpsiMate is useful to you, a star on [GitHub](https://github.com/OpsiMate/OpsiMate) helps the project.
