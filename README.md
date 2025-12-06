<p align="center">
  <img src="apps/client/public/images/logo.png" width="86" alt="OpsiMate logo" />
</p>

<h1 align="center">OpsiMate</h1>
<p align="center"><b>Unified Alert Management & Monitoring Platform</b></p>
<p align="center">
  Built for DevOps/NOC/IT teams to centralize alerts from multiple sources,
  monitor system health, and respond to incidents faster.
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
  <a href="https://opsimate.vercel.app/docs/getting-started/deploy">Get Started</a> ·
  <a href="https://opsimate.vercel.app/">Docs</a> ·
  <a href="https://www.opsimate.com/">Website</a> ·
  <a href="https://github.com/OpsiMate/OpsiMate/issues/new?labels=bug&template=bug_report.md">Report Bug</a>
</p>

---

### TL;DR
- � **Centralized Alert Management** - Aggregate alerts from any platform!
- � **Smart Filtering & Grouping** - Organize alerts by type, status, tags, and custom criteria
- 📊 **Real-time Monitoring** - Live alert dashboard with auto-refresh and TV mode for NOC displays
- 🎯 **Quick Actions** - Acknowledge, resolve, and manage alerts with one click
- 🏷️ **Flexible Tagging** - Categorize and filter alerts for faster incident response

### Alert Management Dashboard

![OpsiMate Alerts Dashboard](assets/images/dashboard.png)

### TV Mode for NOC Displays

![OpsiMate TV Mode](assets/images/tv-mode.png)

</br>

## Key Features

### 🚨 Alert Integrations

OpsiMate connects with your existing monitoring tools to centralize all alerts in one place:

<table>
<tr>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/grafana/grafana-original.svg" alt="Grafana"/><br/>
        <strong>Grafana</strong><br/>
        <span style="font-size: 12px;">Webhook alerts</span>
    </td>
    <td align="center" width="150">
        <img width="40" src="https://www.gstatic.com/pantheon/images/welcome/supercloud.svg" alt="GCP"/><br/>
        <strong>Google Cloud</strong><br/>
        <span style="font-size: 12px;">Cloud Monitoring</span>
    </td>
    <td align="center" width="150">
        <img width="40" src="https://uptime.kuma.pet/img/icon.svg" alt="Uptime Kuma"/><br/>
        <strong>Uptime Kuma</strong><br/>
        <span style="font-size: 12px;">Uptime alerts</span>
    </td>
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/prometheus/prometheus-original.svg" alt="Custom"/><br/>
        <strong>Custom Webhooks</strong><br/>
        <span style="font-size: 12px;">Any source</span>
    </td>
</tr>
</table>

### 📊 Service Discovery & Monitoring

Automatically discover and monitor services across your infrastructure:

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
        Linux VMs (systemd)
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
- **Backend:** [http://localhost:3001](http://localhost:3001)
- **Client:** [http://localhost:8080](http://localhost:8080)


## Manual Docker Run
### OpsiMate now uses separate Docker images for frontend, backend (API), and worker (background jobs):

```bash
# Backend (API Server):
docker run -d \
  --name opsimate-backend \
  --rm \
  -p 3001:3001 \
  opsimate/backend
```

```bash
# Worker (Background Jobs - required for auto-refresh & alerts):
docker run -d \
  --name opsimate-worker \
  --rm \
  opsimate/backend node apps/server/dist/worker.js
```

```bash
# Frontend:
docker run -d \
  --name opsimate-frontend \
  --rm \
  -p 8080:8080 \
  opsimate/frontend
```

```bash
# We also support the old Monolith version:
docker run -d \
  --name opsimate \
  --rm \
  -p 3001:3001 -p 8080:8080 \
  opsimate/opsimate
```

**Access the application:**
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **Client UI:** [http://localhost:8080](http://localhost:8080)

> **Note:** The worker container runs background jobs for auto-discovery and alert polling. Both backend and worker should share the same database volume for proper operation.


### Volume Mounts (optional but recommended)

| Volume | Purpose | Required For |
|--------|---------|--------------|
| `/app/data/database` | SQLite database persistence | Backend + Worker |
| `/app/data/private-keys` | SSH private keys for authentication | Backend + Worker |
| `/app/config/config.yml` | Custom configuration | Backend + Worker |

### Example with volumes:

```bash
# Backend with volumes
docker run -d \
  --name opsimate-backend \
  --rm \
  -p 3001:3001 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/config.yml:/app/config/config.yml \
  opsimate/backend
```

```bash
# Worker with shared volumes
docker run -d \
  --name opsimate-worker \
  --rm \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/config.yml:/app/config/config.yml \
  opsimate/backend node apps/server/dist/worker.js
```

> **💡 Tip:** Use `docker-compose` for easier management of all containers and shared volumes. See the [docker-compose.yml](docker-compose.yml) in the repository.

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

- **New Alert Integrations** - Add support for additional monitoring platforms (Datadog, New Relic, etc.)
- **Alert Routing & Escalation** - Implement advanced alert routing and escalation policies
- **UI/UX Improvements** - Enhance the alert dashboard and user experience
- **Performance Optimizations** - Improve alert processing and dashboard responsiveness
- **Documentation** - Help improve integration guides and documentation

## Roadmap

### Upcoming Features

- **📊 Alert Analytics** - Trends, patterns, and incident reports
- **🤖 AI-Powered Insights** - Intelligent alert correlation and noise reduction
- **🔄 Incident Management** - Full incident lifecycle management and postmortems


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
