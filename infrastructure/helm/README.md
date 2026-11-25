# OpsiMate Helm Chart

A production-ready Helm chart for deploying OpsiMate on Kubernetes.

## Prerequisites

- Kubernetes 1.23+
- Helm 3.0+
- PV provisioner support (for persistence)

## Understanding Local vs Production

| Environment       | Frontend              | Backend               | Why                                 |
| ----------------- | --------------------- | --------------------- | ----------------------------------- |
| **Local Testing** | LoadBalancer (public) | LoadBalancer (public) | Browser needs direct access to both |
| **Production**    | ClusterIP (private)   | ClusterIP (private)   | Ingress routes traffic internally   |

**Why is backend public in local testing?**

The frontend is a browser app (JavaScript). When you open `localhost:8080`, the app runs in YOUR browser and makes API calls to the backend. Without Ingress, your browser needs direct access to the backend at `localhost:3001`.

**Why is backend private in production?**

In production, Ingress acts as a single entry point. All traffic goes through one URL (e.g., `opsimate.dev`), and Ingress routes `/api/*` to the backend internally. The backend is never exposed to the internet.

## Architecture

### Local Testing (No Ingress)

```
Your Browser
    │
    ├── localhost:8080 ──► Frontend (LoadBalancer)
    │
    └── localhost:3001 ──► Backend (LoadBalancer)
                              │
                              ▼
                           Worker
                              │
                              ▼
                            PVC
```

### Production (With Ingress)

```
Internet
    │
    ▼
┌─────────────────┐
│     Ingress     │  ← Single public entry point
│ opsimate.dev    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  /api/*     /*
    │         │
    ▼         ▼
 Backend   Frontend    Worker
 (private) (private)     │
    │                    │
    └────────┬───────────┘
             ▼
            PVC

```

## Quick Start

### Local Testing (Docker Desktop / Minikube)

```bash
# 1. Navigate to helm chart
cd infrastructure/helm

# 2. Lint the chart
helm lint .

# 3. Dry-run to see generated manifests
helm template opsimate . --debug

# 4. Install with local values (both services public). The backend generates its
#    login-session and encryption keys on the data volume on first start.
helm install opsimate . -n opsimate --create-namespace \
  --set service.frontend.type=LoadBalancer \
  --set service.backend.type=LoadBalancer

# 5. Check pods are running
kubectl get pods -n opsimate

# 6. Check services
kubectl get svc -n opsimate

# 8. Access application
#    Frontend: http://localhost:8080
#    Backend:  http://localhost:3001 (API)
```

## Configuration

### Namespace

| Parameter          | Description          | Default    |
| ------------------ | -------------------- | ---------- |
| `namespace.create` | Create the namespace | `true`     |
| `namespace.name`   | Namespace name       | `opsimate` |

### Backend

| Parameter                           | Description        | Default            |
| ----------------------------------- | ------------------ | ------------------ |
| `backend.replicaCount`              | Number of replicas | `1`                |
| `backend.image.repository`          | Image repository   | `opsimate/backend` |
| `backend.image.tag`                 | Image tag          | `latest`           |
| `backend.image.pullPolicy`          | Image pull policy  | `IfNotPresent`     |
| `backend.port`                      | Container port     | `3001`             |
| `backend.resources.limits.cpu`      | CPU limit          | `500m`             |
| `backend.resources.limits.memory`   | Memory limit       | `512Mi`            |
| `backend.resources.requests.cpu`    | CPU request        | `100m`             |
| `backend.resources.requests.memory` | Memory request     | `128Mi`            |

### Worker

| Parameter                 | Description        | Default                                  |
| ------------------------- | ------------------ | ---------------------------------------- |
| `worker.replicaCount`     | Number of replicas | `1`                                      |
| `worker.image.repository` | Image repository   | `opsimate/backend`                       |
| `worker.image.tag`        | Image tag          | `latest`                                 |
| `worker.command`          | Override command   | `["node", "apps/server/dist/worker.js"]` |

### Frontend

| Parameter                   | Description        | Default             |
| --------------------------- | ------------------ | ------------------- |
| `frontend.replicaCount`     | Number of replicas | `1`                 |
| `frontend.image.repository` | Image repository   | `opsimate/frontend` |
| `frontend.image.tag`        | Image tag          | `latest`            |
| `frontend.image.pullPolicy` | Image pull policy  | `IfNotPresent`      |
| `frontend.port`             | Container port     | `8080`              |

### MCP server (optional)

The container AI assistants connect to; it reads alerts and dashboards through the backend's API with each caller's own token. See `configuration_example/README.md`.

| Parameter                           | Description                                                           | Default        |
| ----------------------------------- | --------------------------------------------------------------------- | -------------- |
| `mcp.enabled`                       | Deploy the MCP server                                                 | `false`        |
| `mcp.replicaCount`                  | Number of replicas                                                    | `1`            |
| `mcp.image.repository`              | Image repository                                                      | `opsimate/mcp` |
| `mcp.image.tag`                     | Image tag                                                             | `latest`       |
| `mcp.image.pullPolicy`              | Image pull policy                                                     | `IfNotPresent` |
| `mcp.port`                          | Container port                                                        | `3100`         |
| `mcp.env.OPSIMATE_URL`              | OpsiMate's URL from the cluster (empty = the chart's backend service) | `""`           |
| `mcp.env.MCP_RATE_LIMIT_PER_MINUTE` | Requests per caller per minute (`0` = none)                           | `"240"`        |

### Services

| Parameter               | Description                           | Default        |
| ----------------------- | ------------------------------------- | -------------- |
| `service.frontend.type` | Frontend service type                 | `LoadBalancer` |
| `service.backend.type`  | Backend service type                  | `ClusterIP`    |
| `service.mcp.type`      | MCP service type (when `mcp.enabled`) | `ClusterIP`    |

To reach the MCP server through the Ingress, add a path for it next to the backend's: `{ path: /mcp, pathType: Prefix, service: mcp }` — assistants then connect to `https://<your-host>/mcp`.

### Persistence

| Parameter                  | Description        | Default         |
| -------------------------- | ------------------ | --------------- |
| `persistence.enabled`      | Enable persistence | `true`          |
| `persistence.storageClass` | Storage class      | `""` (default)  |
| `persistence.accessMode`   | Access mode        | `ReadWriteOnce` |
| `persistence.size`         | Volume size        | `2Gi`           |

### Secrets

| Parameter                | Description                                                                                       | Default    |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------- |
| `secrets.apiToken`       | API authentication token                                                                          | `opsimate` |
| `secrets.jwtSecret`      | Optional. Signs login sessions (`JWT_SECRET`), 32+ bytes; generated on the data volume when empty | `""`       |
| `secrets.encryptionKey`  | Optional. Encrypts stored credentials (`ENCRYPTION_KEY`); generated the same way when empty       | `""`       |
| `secrets.existingSecret` | Name of an existing Secret to use; it must hold `API_TOKEN`, and may hold the two keys above      | `""`       |

Left empty, the backend generates both keys on first start and keeps them on the data volume next to the database (`persistence.enabled`), so there is nothing to set and they survive upgrades with the volume. Back the volume up as a whole. Supply them yourself to keep them in a secret store, or when backend pods do not share one volume. Pass them with `--set` or a Secret you manage rather than a committed values file, and keep them across upgrades: a new `JWT_SECRET` signs everyone out, a new `ENCRYPTION_KEY` makes saved credentials unreadable.

```bash
kubectl create namespace opsimate
kubectl create secret generic opsimate-auth -n opsimate \
  --from-literal=API_TOKEN="<your API token>" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -hex 32)"
helm install opsimate . -n opsimate --set secrets.existingSecret=opsimate-auth
```

### Ingress

| Parameter               | Description    | Default                |
| ----------------------- | -------------- | ---------------------- |
| `ingress.enabled`       | Enable ingress | `false`                |
| `ingress.className`     | Ingress class  | `nginx`                |
| `ingress.hosts[0].host` | Hostname       | `opsimate.example.com` |

## Deployment Scenarios

### 1. Local Development (Docker Desktop)

Both services must be public for browser access.

```yaml
# values-local.yaml
service:
  frontend:
    type: LoadBalancer
  backend:
    type: LoadBalancer

persistence:
  size: 1Gi
```

```bash
helm install opsimate . -f values-local.yaml -n opsimate --create-namespace
```

Access:

- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

### 2. Test-env with Ingress (Recommended)

Both services private, Ingress handles routing.

```yaml
# values-prod-ingress.yaml
service:
  frontend:
    type: ClusterIP
  backend:
    type: ClusterIP

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  hosts:
    - host: "" #Empty = accepts any hostname
      paths:
        - path: /api
          pathType: Prefix
          service: backend
        - path: /
          pathType: Prefix
          service: frontend

backend:
  replicaCount: 1
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi

frontend:
  replicaCount: 1

persistence:
  size: 20Gi

secrets:
  apiToken: "your-secure-test-token"
  # jwtSecret / encryptionKey: generated on the data volume when left out. To manage them
  # yourself, pass them with --set or use existingSecret, never a committed values file.
```

```bash
helm install opsimate . -f values-prod-ingress.yaml -n opsimate --create-namespace
```

### 3. AWS EKS with ALB Ingress

```yaml
# values-eks.yaml
service:
  frontend:
    type: ClusterIP
  backend:
    type: ClusterIP

ingress:
  enabled: true
  # className: alb
  # annotations:
  #   alb.ingress.kubernetes.io/scheme: internet-facing
  #   alb.ingress.kubernetes.io/target-type: ip
  #   alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/xxx
  hosts:
    - host: ""
      paths:
        - path: /api
          pathType: Prefix
          service: backend
        - path: /
          pathType: Prefix
          service: frontend
```

```bash
helm install opsimate . -f values-eks.yaml -n opsimate --create-namespace
```

## Useful Commands

```bash
# Check deployment status
kubectl get pods -n opsimate
kubectl get svc -n opsimate
kubectl get pvc -n opsimate
kubectl get ingress -n opsimate

# View logs
kubectl logs -l app.kubernetes.io/component=backend -n opsimate
kubectl logs -l app.kubernetes.io/component=worker -n opsimate
kubectl logs -l app.kubernetes.io/component=frontend -n opsimate

# Follow logs in real-time
kubectl logs -f -l app.kubernetes.io/component=backend -n opsimate

# Upgrade release, keeping every value it was installed with. Generated keys live on the
# data volume, so they carry over with it; keys you set must be passed again if you do not
# reuse values (or keep secrets.existingSecret in the file)
helm upgrade opsimate . -n opsimate --reuse-values

# Upgrade with new values: the file must hold the full configuration
helm upgrade opsimate . -f values-prod.yaml -n opsimate

# Rollback to previous version
helm rollback opsimate -n opsimate
# Rolling back to a release from before installs generated their own keys: the upgrade
# moved stored credentials (LDAP bind password, AI key, integrations) to the generated key,
# which older releases do not read. They do read ENCRYPTION_KEY and JWT_SECRET from the
# environment, so hand them the generated keys (still on the data volume) after the rollback;
# nothing needs re-entering and nobody is signed out. This lasts until the next upgrade,
# which reads the files again.
ENC=$(kubectl exec -n opsimate deploy/opsimate-backend -- cat /app/data/database/encryption-key)
JWT=$(kubectl exec -n opsimate deploy/opsimate-backend -- cat /app/data/database/jwt-secret)
kubectl set env -n opsimate deploy/opsimate-backend ENCRYPTION_KEY="$ENC" JWT_SECRET="$JWT"
kubectl set env -n opsimate deploy/opsimate-worker ENCRYPTION_KEY="$ENC"

# Uninstall
helm uninstall opsimate -n opsimate

# Delete namespace and all resources
kubectl delete namespace opsimate
```

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod -l app.kubernetes.io/name=opsimate -n opsimate
kubectl get events -n opsimate --sort-by='.lastTimestamp'
```

### Config errors

```bash
kubectl get configmap -n opsimate -o yaml
kubectl exec -it <pod-name> -n opsimate -- cat /app/config/config.yml
```

### Image pull errors

```bash
# Verify images exist
docker pull opsimate/backend:latest
docker pull opsimate/frontend:latest

# Check pull policy in deployment
kubectl get deployment -n opsimate -o yaml | grep -i pullpolicy
```

### PVC issues

```bash
kubectl get pvc -n opsimate
kubectl get storageclass
```

## Chart Structure

```
opsimate/
├── Chart.yaml
├── values.yaml
├── README.md
├── .helmignore
└── templates/
    ├── _helpers.tpl
    ├── configmap.yaml
    ├── secret.yaml
    ├── pvc.yaml
    ├── serviceAccount.yaml
    ├── deployment-backend.yaml
    ├── deployment-worker.yaml
    ├── deployment-frontend.yaml
    ├── service-backend.yaml
    ├── service-frontend.yaml
    ├── ingress.yaml
    └── NOTES.txt
```

## License

See LICENSE file in the repository root.
