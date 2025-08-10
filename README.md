<div align="center">
    <img src="apps/client/images/logo.png" width="86">
</div>

<h1 align="center">The open-source infrastructure monitoring and service management platform</h1>

</br>

<div align="center">
Centralized service discovery, monitoring, and management across your infrastructure. SSH-based connectivity, real-time alerts, and intuitive dashboards.
</br>
</div>

<div align="center">
    <a href="https://github.com/OpsiMate/OpsiMate/commits/main">
      <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/OpsiMate/OpsiMate"/></a>
    <a href="https://github.com/OpsiMate/OpsiMate/blob/main/LICENSE">
      <img alt="License" src="https://img.shields.io/github/license/OpsiMate/OpsiMate"/></a>
    <a href="https://github.com/OpsiMate/OpsiMate/stargazers">
      <img alt="GitHub stars" src="https://img.shields.io/github/stars/OpsiMate/OpsiMate?style=social"/></a>
    <a href="https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA">
      <img alt="Join Slack" src="https://img.shields.io/badge/Slack-Join%20Chat-4A154B?logo=slack&logoColor=white"/></a>
</div>

<p align="center">
    <a href="https://opsimate.vercel.app/getting-started/deploy">Get Started</a>
    ·
    <a href="https://opsimate.vercel.app/">Documentation</a>
    ·
    <a href="https://www.opsimate.com/">Website</a>
    ·
    <a href="https://github.com/OpsiMate/OpsiMate/issues/new?assignees=&labels=bug&template=bug_report.md&title=">Report Bug</a>
</p>

<h1 align="center"></h1>

- 🔍 **Service Discovery** - Automatically discover and monitor Docker containers and systemd services
- 🖥️ **Multi-Provider Support** - Connect to VMs, Kubernetes clusters via SSH and APIs
- 📊 **Real-time Monitoring** - Live service status, health checks, and performance metrics
- 🚨 **Integrated Alerting** - Grafana integration for centralized alert management
- 🎛️ **Service Management** - Start, stop, and restart services directly from the dashboard
- 📋 **Centralized Logs** - View and analyze service logs from a single interface

</br>

## Supported Infrastructure

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
    <td align="center" width="150">
        <img width="40" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/grafana/grafana-original.svg" alt="Grafana"/><br/>
        Grafana
    </td>
    <td align="center" width="150">
        <img width="40" src="https://avatars.githubusercontent.com/u/3380462?s=200&v=4" alt="Prometheus"/><br/>
        Prometheus
    </td>
</tr>
</table>

## Getting Started

### Quick Start

```bash
# Clone and install
git clone https://github.com/opsimate/opsimate.git
cd opsimate
npm install
npm run build
npm run dev
```

**Access:** http://localhost:3000

### Docker Deployment

```bash
# Quick setup
mkdir -p data/database data/private-keys
cp ~/.ssh/id_rsa data/private-keys/

# Build and run
docker build -t opsimate .
docker run -d \
  --name opsimate \
  -p 3000:3000 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  opsimate
```

## Configuration

```yaml
# config.yml
server:
  port: 3001
  host: "0.0.0.0"

database:
  path: "/app/data/database/opsimate.db"

security:
  private_keys_path: "/app/data/private-keys"
```

## Development

```bash
# Development commands
npm run dev     # Start development server
npm run build   # Build production version
npm run test    # Run test suite
npm run lint    # Check code quality
```

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, SQLite
- **Infrastructure:** Docker, SSH, Kubernetes API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **[Documentation](https://opsimate.vercel.app/)** - Guides and API reference
- **[GitHub Issues](https://github.com/opsimate/opsimate/issues)** - Bug reports and features
- **[Slack Community](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)** - Get help and discuss
- **[Website](https://www.opsimate.com/)** - Learn more

---

<div align="center">
  <p>Built with ❤️ by the OpsiMate team</p>
  <p>© 2025 OpsiMate. All rights reserved.</p>
</div> 