# OpsiMate Helm Chart

<<<<<<< Updated upstream
A production-ready Helm chart for deploying OpsiMate on Kubernetes.

## Prerequisites

- Kubernetes 1.23+
- Helm 3.0+
- PV provisioner support (for persistence)

## Understanding Local vs Production

| Environment | Frontend | Backend | Why |
|-------------|----------|---------|-----|
| **Local Testing** | LoadBalancer (public) | LoadBalancer (public) | Browser needs direct access to both |
| **Production** | ClusterIP (private) | ClusterIP (private) | Ingress routes traffic internally |

**Why is backend public in local testing?**

The frontend is a browser app (JavaScript). When you open `localhost:8080`, the app runs in YOUR browser and makes API calls to the backend. Without Ingress, your browser needs direct access to the backend at `localhost:3001`.

**Why is backend private in production?**

In production, Ingress acts as a single entry point. All traffic goes through one URL (e.g., `opsimate.com`), and Ingress routes `/api/*` to the backend internally. The backend is never exposed to the internet.

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
│ opsimate.com    │
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
=======
Deploys OpsiMate (frontend, backend, worker) to Kubernetes.

## Structure

```
opsimate/
├── Chart.yaml                      # Chart metadata
├── values.yaml                     # Default configuration
├── README.md
└── templates/
    ├── _helpers.tpl                # Template helpers
    ├── deployment-backend.yaml     # Backend API server
    ├── deployment-frontend.yaml    # Frontend UI
    ├── deployment-worker.yaml      # Background worker
    ├── service-backend.yaml        # Internal service for backend
    ├── service-frontend.yaml       # External service for frontend
    ├── secret.yaml                 # API token
    └── pvc.yaml                    # Persistent storage
>>>>>>> Stashed changes
```

## Quick Start

<<<<<<< Updated upstream
### Local Testing (Docker Desktop / Minikube)

```bash
# 1. Navigate to helm chart
cd infrastructure/helm

# 2. Lint the chart
helm lint .

# 3. Dry-run to see generated manifests
helm template opsimate . --debug

# 4. Install with local values (both services public)
helm install opsimate . -n opsimate --create-namespace \
  --set service.frontend.type=LoadBalancer \
  --set service.backend.type=LoadBalancer

# 5. Check pods are running
kubectl get pods -n opsimate

# 6. Check services
kubectl get svc -n opsimate

# 7. Access application
#    Frontend: http://localhost:8080
#    Backend:  http://localhost:3001 (API)
```


## Configuration

### Namespace

| Parameter | Description | Default |
|-----------|-------------|---------|
| `namespace.create` | Create the namespace | `true` |
| `namespace.name` | Namespace name | `opsimate` |

### Backend

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.replicaCount` | Number of replicas | `1` |
| `backend.image.repository` | Image repository | `opsimate/backend` |
| `backend.image.tag` | Image tag | `latest` |
| `backend.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `backend.port` | Container port | `3001` |
| `backend.resources.limits.cpu` | CPU limit | `500m` |
| `backend.resources.limits.memory` | Memory limit | `512Mi` |
| `backend.resources.requests.cpu` | CPU request | `100m` |
| `backend.resources.requests.memory` | Memory request | `128Mi` |

### Worker

| Parameter | Description | Default |
|-----------|-------------|---------|
| `worker.replicaCount` | Number of replicas | `1` |
| `worker.image.repository` | Image repository | `opsimate/backend` |
| `worker.image.tag` | Image tag | `latest` |
| `worker.command` | Override command | `["node", "apps/server/dist/worker.js"]` |

### Frontend

| Parameter | Description | Default |
|-----------|-------------|---------|
| `frontend.replicaCount` | Number of replicas | `1` |
| `frontend.image.repository` | Image repository | `opsimate/frontend` |
| `frontend.image.tag` | Image tag | `latest` |
| `frontend.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `frontend.port` | Container port | `8080` |

### Services

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.frontend.type` | Frontend service type | `LoadBalancer` |
| `service.backend.type` | Backend service type | `ClusterIP` |

### Persistence

| Parameter | Description | Default |
|-----------|-------------|---------|
| `persistence.enabled` | Enable persistence | `true` |
| `persistence.storageClass` | Storage class | `""` (default) |
| `persistence.accessMode` | Access mode | `ReadWriteOnce` |
| `persistence.size` | Volume size | `2Gi` |

### Secrets

| Parameter | Description | Default |
|-----------|-------------|---------|
| `secrets.apiToken` | API authentication token | `opsimate` |
| `secrets.existingSecret` | Use existing secret | `""` |

### Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class | `nginx` |
| `ingress.hosts[0].host` | Hostname | `opsimate.example.com` |

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
  apiToken: "your-secure-production-token"
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

# Upgrade release
helm upgrade opsimate . -n opsimate

# Upgrade with new values
helm upgrade opsimate . -f values-prod.yaml -n opsimate

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
=======
```bash
kubectl create namespace opsimate
helm install opsimate ./infrastructure/helm/opsimate -n opsimate
```

## Access the Dashboard

```bash
# Port forward
kubectl port-forward svc/opsimate-frontend 8080:80 -n opsimate

# Open http://localhost:8080
```

## Configuration

See `values.yaml` for all configurable options. Common overrides:

```bash
# Use NodePort instead of LoadBalancer
helm install opsimate ./infrastructure/helm/opsimate -n opsimate \
  --set frontend.service.type=NodePort

# Disable persistence
helm install opsimate ./infrastructure/helm/opsimate -n opsimate \
  --set persistence.enabled=false
```

## Security Note

⚠️ **Development Only**: The API token is stored as plaintext in `values.yaml`. This is acceptable for development/testing but **not suitable for production**.

For production deployments, use external secret management solutions:
- [Kubernetes External Secrets](https://external-secrets.io/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)

## Uninstall

```bash
helm uninstall opsimate -n opsimate
```
>>>>>>> Stashed changes
