# OpsiMate Helm Chart

Deploys OpsiMate (frontend, backend, worker) to Kubernetes.

## Structure

```
helm/
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
helm install opsimate ./infrastructure/helm -n opsimate

## Access the Dashboard

# Port forward
kubectl port-forward svc/opsimate-frontend 8080:80 -n opsimate

# Open http://localhost:8080

## Configuration

See `values.yaml` for all configurable options. Common overrides:

# Use NodePort instead of LoadBalancer
helm install opsimate ./infrastructure/helm -n opsimate \
  --set frontend.service.type=NodePort

# Disable persistence
helm install opsimate ./infrastructure/helm -n opsimate \
  --set persistence.enabled=false

## Uninstall

helm uninstall opsimate -n opsimate

## Security Note

⚠️ **Development Only**: The API token is stored as plaintext in `values.yaml`. This is acceptable for development/testing but **not suitable for production**.

For production deployments, use external secret management solutions:
- [Kubernetes External Secrets](https://external-secrets.io/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)