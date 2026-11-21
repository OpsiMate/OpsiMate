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

# 2. Create the secret that signs login sessions, once, and save it somewhere private:
#    every upgrade needs the same value, and changing it signs everyone out
export OPSIMATE_JWT_SECRET=$(openssl rand -hex 32)

# 3. Lint the chart
helm lint . --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"

# 4. Dry-run to see generated manifests. The output prints the Secret, so use a throwaway
#    value here, never the real one
helm template opsimate . --debug --set secrets.jwtSecret=dry-run-placeholder-not-a-real-secret

# 5. Install with local values (both services public)
helm install opsimate . -n opsimate --create-namespace \
  --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET" \
  --set service.frontend.type=LoadBalancer \
  --set service.backend.type=LoadBalancer

# 6. Check pods are running
kubectl get pods -n opsimate

# 7. Check services
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

| Parameter                | Description                                                                                 | Default    |
| ------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| `secrets.apiToken`       | API authentication token                                                                    | `opsimate` |
| `secrets.jwtSecret`      | **Required** unless `existingSecret` is set. Signs login sessions (`JWT_SECRET`), 32+ bytes | `""`       |
| `secrets.existingSecret` | Name of an existing Secret to use; it must hold `API_TOKEN` and `JWT_SECRET`                | `""`       |

The backend refuses to start without `JWT_SECRET`, and the chart refuses to render without one. Generate it with `openssl rand -hex 32`, pass it with `--set` rather than a committed values file, and keep the same value across upgrades: changing it signs everyone out. For production, prefer a Secret you manage yourself:

```bash
kubectl create namespace opsimate
kubectl create secret generic opsimate-auth -n opsimate \
  --from-literal=API_TOKEN="<your API token>" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)"
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
helm install opsimate . -f values-local.yaml -n opsimate --create-namespace \
  --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"
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
  # jwtSecret: not in a values file. Pass it with --set (below) or use existingSecret.
```

```bash
helm install opsimate . -f values-prod-ingress.yaml -n opsimate --create-namespace \
  --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"
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
helm install opsimate . -f values-eks.yaml -n opsimate --create-namespace \
  --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"
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

# Upgrade release, keeping every value it was installed with: secrets.jwtSecret, or
# secrets.existingSecret, included
helm upgrade opsimate . -n opsimate --reuse-values

# First upgrade from a chart version without the JWT secret: add it once (not needed with
# secrets.existingSecret, as long as that Secret has a JWT_SECRET key)
helm upgrade opsimate . -n opsimate --reuse-values --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"

# Upgrade with new values: the file must hold the full configuration, so pass the same JWT
# secret again (or keep secrets.existingSecret in the file), or everyone is signed out
helm upgrade opsimate . -f values-prod.yaml -n opsimate --set secrets.jwtSecret="$OPSIMATE_JWT_SECRET"

# Rollback to previous version
helm rollback opsimate -n opsimate

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
