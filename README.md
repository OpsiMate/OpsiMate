<p align="center">
  <img src="apps/client/images/logo.png" width="86" alt="OpsiMate logo" />
</p>

<h1 align="center">OpsiMate</h1>
<p align="center"><b>One console for servers, Docker, and Kubernetes—discover, monitor, and act.</b></p>
<p align="center">
  Built for DevOps/NOC/IT teams that need a single place to see service health,
  jump to dashboards, and perform safe start/stop/restart operations.
</p>

<p align="center">
  <a href="https://img.shields.io/github/commit-activity/m/OpsiMate/OpsiMate">
    <img alt="Commit activity" src="https://img.shields.io/github/commit-activity/m/OpsiMate/OpsiMate" />
  </a>
  <a href="https://github.com/OpsiMate/OpsiMate/releases">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/OpsiMate/OpsiMate" />
  </a>
  <a href="https://github.com/OpsiMate/OpsiMate/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/OpsiMate/OpsiMate" />
  </a>
  <a href="https://github.com/OpsiMate/OpsiMate/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/OpsiMate/OpsiMate?style=social" />
  </a>
  <a href="https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA">
    <img alt="Join Slack" src="https://img.shields.io/badge/Slack-Join%20Chat-4A154B?logo=slack&logoColor=white" />
  </a>
</p>

<p align="center">
  <a href="https://opsimate.vercel.app/getting-started/deploy">Get Started</a> ·
  <a href="https://opsimate.vercel.app/">Docs</a> ·
  <a href="https://www.opsimate.com/">Website</a> ·
  <a href="https://github.com/OpsiMate/OpsiMate/issues/new?labels=bug&template=bug_report.md">Report Bug</a>
</p>

---

### TL;DR
- 🔎 **Auto-discovery** of Docker/systemd services  
- 📊 **Live health & metrics** with Grafana/Prometheus/Kibana links  
- 🎛️ **Safe actions**: start/stop/restart from the dashboard  
- 🏷️ **Smart tags** for quick filtering

### MCP Server (GitHub)

This repository includes an `mcp-server/` scaffold that lets you run the official GitHub MCP Server container locally. It is intended to make the repository compatible with MCP-host applications (Copilot, Claude, Cursor, etc.) and to allow CI or maintainer checks that expect an MCP server.

See `mcp-server/README.md` for quick start instructions. Do NOT commit your real GitHub PAT — use `.env` locally and GitHub Secrets in CI.


### Main Dashboard

![OpsiMate Dashboard](assets/images/dashboard.png)

### TV Mode

![OpsiMate TV Mode](assets/images/tv-mode.png)

</br>

## Supported Infrastructure

### Compute Platforms

<table>
<tr>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" alt="Docker"/><br/>
        Docker
    </td>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg" alt="Kubernetes"/><br/>
        Kubernetes
    </td>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg" alt="Linux VMs"/><br/>
        Linux VMs
    </td>
</tr>
</table>

### Monitoring Integrations

<table>
<tr>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/grafana/grafana-original.svg" alt="Grafana"/><br/>
        Grafana
    </td>
  <td align="center" width="150">
      <img width="40" src="https://github.com/datadog.png?size=200" alt="Datadog"/><br/>
      Datadog
  </td>
    <td align="center" width="150">
        <img width="40" src="https://avatars.githubusercontent.com/u/6764390?v=4" alt="Kibana"/><br/>
        Kibana
    </td>
</tr>
</table>


### Docker Deployment

Run OpsiMate locally quickly with Docker and a single command — no cloning or building required.

### Run OpsiMate with one command
#### Open your terminal and run:
```bash
curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/scripts/start-docker.sh | sh
```
**Access the application:**
   - **Backend:** http://localhost:3001
   - **Client:** http://localhost:8080


## Manual Docker Run (Alternatively)
#### OpsiMate now uses separate Docker images for frontend and backend:


```bash
#Backend:

docker run -d \
  --name opsimate-backend \
  --rm \
  -p 3001:3001 \
  opsimate/backend

```

```bash
#Frontend:

docker run -d \
  --name opsimate-frontend \
  --rm \
  -p 8080:8080 \
  opsimate/frontend

```

```bash
#We also suppourt the old Monolith verison:

docker run -d \
  --name opsimate \
  --rm \
  -p 3001:3001 -p 8080:8080 \
  opsimate/opsimate

```

**Access the application:**
   - **Backend:** http://localhost:3001
   - **Client:** http://localhost:8080


### Volume Mounts (optional)

| Volume | Purpose |
|--------|---------|
| `/app/data/database` | SQLite database persistence |
| `/app/data/private-keys` | SSH private keys for authentication |
| `/app/config/config.yml` | Custom configuration |

### for example:

```bash
# Run the container
docker run -d \
  --name opsimate \
  --rm \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/config.yml:/app/config/config.yml \
  opsimate/opsimate
```

## Configuration

OpsiMate uses YAML configuration file



### Example Configuration

```yaml
# OpsiMate Configuration
server:
  port: 3001
  host: "0.0.0.0"

database:
  path: "/app/data/database/opsimate.db"

security:
  private_keys_path: "/app/data/private-keys"

vm:
  try_with_sudo: false
```

## Contributing

We welcome contributions to OpsiMate! Here's how you can help:

### Areas for Contribution

- **New Provider Support** - Add support for additional infrastructure platforms
- **New Integrations** - Extend alerting and metrics capabilities
- **UI/UX Improvements** - Enhance the dashboard and user experience
- **Performance Optimizations** - Improve scalability and responsiveness
- **Documentation** - Help improve guides and documentation

## Roadmap

### Upcoming Features

- **📈 Advanced Analytics** - Service performance trends and insights
- **🔄 GitOps Integration** - Infrastructure as Code workflows
- **🤖 AI-Powered Insights** - Intelligent anomaly detection and recommendations


## Support

- **[Documentation](https://opsimate.vercel.app/)** - Comprehensive guides and API reference
- **[GitHub Issues](https://github.com/opsimate/opsimate/issues)** - Bug reports and feature requests
- **[Slack Community](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)** - Join our discussions and get help
- **[Website](https://www.opsimate.com/)** - Learn more about OpsiMate

---

<div align="center">
  <p>Built with ❤️ by the OpsiMate team</p>
  <p>© 2025 OpsiMate. All rights reserved.</p>
</div> 

## 💖 Our Amazing Contributors

This project wouldn’t be what it is today without the incredible people who have shared their time, knowledge, and creativity.  
A huge thank you to everyone who has helped and continues to help make OpsiMate better every day! 🙌

 <a href="https://github.com/OpsiMate/OpsiMate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=OpsiMate/OpsiMate" />
</a>

---
