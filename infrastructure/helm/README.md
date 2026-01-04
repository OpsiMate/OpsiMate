# OpsiMate Helm Chart

Deploys OpsiMate (frontend, backend, worker) to Kubernetes.

## Structure

```
opsimate/
├── Chart.yaml                      # Chart metadata
├── values.yaml                     # Default configuration (change the values here)
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
```

## Quick Start

kubectl create namespace opsimate
helm install opsimate ./infrastructure/helm/opsimate -n opsimate

## Access the Dashboard

# Port forward
kubectl port-forward svc/opsimate-frontend 8080:80 -n opsimate

# Open http://localhost:8080

## Configuration

See `values.yaml` for all configurable options. Common overrides:

# Use NodePort instead of LoadBalancer
helm install opsimate ./infrastructure/helm/opsimate -n opsimate \
  --set frontend.service.type=NodePort

# Disable persistence
helm install opsimate ./infrastructure/helm/opsimate -n opsimate \
  --set persistence.enabled=false

## Uninstall

helm uninstall opsimate -n opsimate