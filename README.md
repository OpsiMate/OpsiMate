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

### Service Types

- **Docker Containers** - Full lifecycle management of containerized applications
- **Systemd Services** - Native Linux service monitoring and control
- **Kubernetes Pods** - Pod-level visibility and management
- **Custom Services** - Extensible framework for custom service types

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

## Getting Started

### Prerequisites

- **Node.js 20+** - Runtime environment
- **Docker** (optional) - For containerized deployment
- **SSH Access** - To target infrastructure
- **SSH Private Keys** - For secure authentication

### Quick Start

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

5. **Access the application:**
   - **Application:** http://localhost:3000

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

#### Production Deployment

```bash
# Use custom configuration
cp configuration_example/container-config.yml my-config.yml
# Edit my-config.yml with your settings

# Deploy with custom config
docker run -d \
  --name opsimate \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/my-config.yml:/app/config/config.yml \
  opsimate
```

## Configuration

OpsiMate uses YAML configuration files for flexible deployment scenarios:

### Configuration Files

- **`config.yml`** - Local development configuration
- **`container-config.yml`** - Docker container configuration
- **`custom-docker-config.yml`** - Custom Docker configuration example

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

| Volume | Purpose | Required |
|--------|---------|----------|
| `/app/data/database` | SQLite database persistence | ✅ |
| `/app/data/private-keys` | SSH private keys for authentication | ✅ |
| `/app/config/config.yml` | Custom configuration | ❌ |

## Features

### Service Discovery

- **Automatic Discovery** - Scan infrastructure providers for running services
- **Multi-Protocol Support** - SSH, Kubernetes API, Docker API
- **Real-time Updates** - Continuous monitoring with configurable intervals
- **Service Categorization** - Automatic tagging and classification

### Monitoring & Alerting

- **Health Checks** - Service status monitoring with custom health endpoints
- **Log Aggregation** - Centralized log viewing and analysis
- **Alert Integration** - Grafana alert correlation and management
- **Performance Metrics** - Resource usage and performance tracking

### Service Management

- **Lifecycle Control** - Start, stop, restart services remotely
- **Bulk Operations** - Manage multiple services simultaneously
- **Rollback Support** - Safe service updates with rollback capabilities
- **Scheduled Operations** - Automated maintenance and updates

### User Interface

- **Modern Dashboard** - Clean, responsive React interface
- **Real-time Updates** - Live service status and metrics
- **Advanced Filtering** - Search and filter by tags, status, provider
- **Custom Views** - Save and share custom dashboard configurations

## Technology Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **React Query** - Server state management

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **TypeScript** - Type-safe server development
- **SQLite** - Embedded database
- **Node SSH** - SSH client for remote operations
- **Zod** - Schema validation

### Infrastructure
- **Docker** - Containerization
- **Turbo** - Monorepo build system
- **GitHub Actions** - CI/CD pipeline

## Development

### Workspace Structure

OpsiMate uses a monorepo structure with Turbo for efficient builds:

```bash
# Work on frontend only
cd apps/client
npm run dev

# Work on backend only
cd apps/server
npm run dev

# Work on shared packages
cd packages/shared
npm run dev

# Build all workspaces
npm run build
```

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version
- `npm run test` - Run test suite
- `npm run lint` - Check code quality

### API Development

The backend provides a RESTful API with the following endpoints:

- `GET /api/v1/providers` - List all infrastructure providers
- `GET /api/v1/services` - List all discovered services
- `POST /api/v1/services/{id}/start` - Start a service
- `POST /api/v1/services/{id}/stop` - Stop a service
- `GET /api/v1/services/{id}/logs` - Get service logs
- `GET /api/v1/alerts` - List active alerts

## Contributing

We welcome contributions to OpsiMate! Here's how you can help:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes** with tests
5. **Submit a pull request**

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features and bug fixes
- Update documentation for API changes
- Use conventional commit messages
- Ensure all CI checks pass

### Areas for Contribution

- **New Provider Integrations** - Add support for additional infrastructure platforms
- **Monitoring Integrations** - Extend alerting and metrics capabilities
- **UI/UX Improvements** - Enhance the dashboard and user experience
- **Performance Optimizations** - Improve scalability and responsiveness
- **Documentation** - Help improve guides and API documentation

## Roadmap

### Upcoming Features

- **🔌 Plugin System** - Extensible architecture for custom integrations
- **📈 Advanced Analytics** - Service performance trends and insights
- **🔄 GitOps Integration** - Infrastructure as Code workflows
- **🌐 Multi-Cluster Support** - Manage services across multiple environments
- **📱 Mobile App** - Native mobile application for on-the-go monitoring
- **🤖 AI-Powered Insights** - Intelligent anomaly detection and recommendations

### Long-term Vision

- **Enterprise Features** - RBAC, audit logging, compliance reporting
- **Cloud Native** - Kubernetes operator and Helm charts
- **Marketplace** - Community-driven plugin ecosystem
- **SaaS Offering** - Hosted version with enterprise support

## License

OpsiMate is distributed under the [MIT License](LICENSE). See `LICENSE` for more information.

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