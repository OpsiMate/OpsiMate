<div align="center">
    <img src="apps/client/images/logo.png" width="86">
</div>

<h1 align="center">The all-in-one platform for managing and controlling your organization - Everything in one place.</h1>

</br>

<div align="center">
Centralized service discovery, monitoring, and management across your infrastructure.
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
  <img alt="Join Slack" src="https://img.shields.io/badge/Slack-Join%20Chat-4A154B?logo=slack&logoColor=white"/>
</a>
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

- 🔍 **Service Discovery** - Automatically discover and monitor Docker containers and systemd services across your infrastructure
- 🖥️ **Multi-Provider Support** - Connect to VMs, Kubernetes clusters, and cloud instances via SSH and APIs
- 📊 **Real-time Monitoring** - Live service status, health checks, and performance metrics
- 🚨 **Integrated Alerting** - Grafana integration for centralized alert management and correlation
- 🎛️ **Service Management** - Start, stop, and restart services directly from the dashboard
- 📋 **Centralized Logs** - View and analyze service logs from a single interface
- 🏷️ **Smart Tagging** - Organize and filter services with custom tags and labels

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
        <img width="40" src="https://avatars.githubusercontent.com/u/3380462?s=200&v=4" alt="Prometheus"/><br/>
        Prometheus
    </td>
    <td align="center" width="150">
        <img width="40" src="https://avatars.githubusercontent.com/u/6764390?v=4" alt="Kibana"/><br/>
        Kibana
    </td>
</tr>
</table>


### Docker Deployment

#### Quick Start with Docker

```bash
# Create required directories
mkdir -p data/database data/private-keys

# Copy your SSH private keys
cp ~/.ssh/id_rsa data/private-keys/

# Build and run
docker build -t opsimate .
docker run -d \
  --name opsimate \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  opsimate
```
**Access the application:**
   - **Backend:** http://localhost:3001
   - **Client:** http://localhost:8080

## Configuration

OpsiMate uses YAML configuration file



### Example Configuration

```yaml
# OpsiMate Configuration
server:
  port: 3001
  host: "0.0.0.0"

client:
  port: 8080
  api_url: "http://localhost:3001/api/v1"

database:
  path: "/app/data/database/opsimate.db"

security:
  private_keys_path: "/app/data/private-keys"
```

### Volume Mounts

| Volume | Purpose |
|--------|---------|
| `/app/data/database` | SQLite database persistence |
| `/app/data/private-keys` | SSH private keys for authentication |
| `/app/config/config.yml` | Custom configuration |

## Development

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/opsimate/opsimate.git
   cd opsimate
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version
- `npm run test` - Run test suite
- `npm run lint` - Check code quality


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