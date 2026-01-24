# OpsiMate Terraform Infrastructure

Terraform configuration for deploying OpsiMate on AWS EKS.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                    VPC                                       │
│                              (10.0.0.0/16)                                   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                         Public Subnets                              │    │
│   │  ┌─────────────────────┐            ┌─────────────────────┐         │    │
│   │  │   10.0.1.0/24       │            │   10.0.2.0/24       │         │    │
│   │  │      (AZ-1)         │            │      (AZ-2)         │         │    │
│   │  │                     │            │                     │         │    │
│   │  │  ┌───────────────┐  │            │                     │         │    │
│   │  │  │  NAT Gateway  │  │            │   (LB Endpoint)     │         │    │
│   │  │  └───────────────┘  │            │                     │         │    │
│   │  └─────────────────────┘            └─────────────────────┘         │    │
│   │                                                                     │    │
│   │                    ┌────────────────────┐                           │    │
│   │                    │   Load Balancer    │ ← Internet traffic        │    │ 
│   │                    │   (Port 80/443)    │                           │    │
│   │                    └─────────┬──────────┘                           │    │
│   └──────────────────────────────┼──────────────────────────────────────┘    │
│                                  │                                           │
│   ┌──────────────────────────────┼───────────────────────────────────────┐   │
│   │                      Private Subnets                                 │   │
│   │  ┌─────────────────────┐     │      ┌─────────────────────┐          │   │
│   │  │   10.0.10.0/24      │     │      │   10.0.20.0/24      │          │   │
│   │  │      (AZ-1)         │     ▼      │      (AZ-2)         │          │   │
│   │  │  ┌───────────────┐  │            │  ┌───────────────┐  │          │   │
│   │  │  │    Node 1     │◄─┼────────────┼─►│    Node 2     │  │          │   │
│   │  │  │  (t3.small)   │  │            │  │  (t3.small)   │  │          │   │
│   │  │  └───────────────┘  │            │  └───────────────┘  │          │   │
│   │  └─────────────────────┘            └─────────────────────┘          │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- kubectl

## Cost Estimate (Test Environment)

| Component | Monthly Cost |
|-----------|--------------|
| EKS Cluster | $72 |
| 2x t3.small nodes | ~$30 |
| NAT Gateway | ~$45 |
| Load Balancer | ~$16 |
| **Total** | **~$163/month** |

**So try to destroy the whole infrastructure once done with the testing.**

## Make sure to create a variables file(terraform.tfvars) and mention as below or change as you like

```
aws_region           = "us-east-1"
aws_profile          = "<your-AWS-account-profile>" # Mention your AWS CLI profile name here
project_name         = "opsimate"
environment          = "test"
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]
availability_zones   = ["us-east-1a", "us-east-1b"]
cluster_name         = "opsimate-cluster"
cluster_version      = 1.31
node_instance_types  = ["t3.small"]
node_desired_size    = 2
node_min_size        = 1
node_max_size        = 3
node_disk_size       = 20
```

## Quick Start

```bash
# 1. Initialize Terraform
terraform init

# 2. Review the plan
terraform plan

# 3. Apply (creates infrastructure)
terraform apply

# 4. Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name opsimate-cluster

# 5. Verify connection
kubectl get nodes
```

## Configuration

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `project_name` | Project name for resource naming | `opsimate` |
| `environment` | Environment name | `test` |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` |
| `cluster_name` | EKS cluster name | `opsimate-cluster` |
| `cluster_version` | Kubernetes version | `1.29` |
| `node_instance_types` | EC2 instance types | `["t3.small"]` |
| `node_desired_size` | Desired node count | `2` |
| `node_min_size` | Minimum node count | `1` |
| `node_max_size` | Maximum node count | `3` |
| `node_disk_size` | Node disk size (GB) | `20` |

## Deploy OpsiMate

After infrastructure is ready:

```bash

# 1. Verify EBS CSI driver is running
kubectl get pods -n kube-system | grep ebs


# 2. Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

<Wait for approximately more than 300s for NGINX Controller to start working>

# 3. Deploy OpsiMate with Helm
cd ../helm
helm install opsimate . -n opsimate --create-namespace \
  --set service.frontend.type=ClusterIP \
  --set service.backend.type=ClusterIP \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set persistence.storageClass=gp2

# 4. Get Load Balancer URL
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## Useful Commands

```bash
# Check cluster info
kubectl cluster-info

# Check nodes
kubectl get nodes -o wide

# Check all pods
kubectl get pods -A

# View EKS cluster details
aws eks describe-cluster --name opsimate-cluster --region us-east-1

# SSH to nodes (if needed - requires bastion or SSM)
# Nodes are in private subnets, use AWS Systems Manager Session Manager
```

## Destroy Infrastructure

```bash
# First, delete Kubernetes resources
helm uninstall opsimate -n opsimate
kubectl delete namespace opsimate

# Delete Ingress controller
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Then destroy Terraform resources
terraform destroy
```

## Troubleshooting

### Cannot connect to cluster

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name opsimate-cluster

# Check AWS identity
aws sts get-caller-identity
```

### Nodes not joining cluster

```bash
# Check node group status
aws eks describe-nodegroup --cluster-name opsimate-cluster --nodegroup-name opsimate-node-group

# Check node IAM role
aws iam get-role --role-name opsimate-eks-nodes-role
```

### Pods stuck in Pending

```bash
# Check node resources
kubectl describe nodes

# Check events
kubectl get events -A --sort-by='.lastTimestamp'
```

## File Structure

```
terraform/
├── main.tf              # Provider configuration
├── variables.tf         # Input variables
├── terraform.tfvars     # values of Input variables
├── outputs.tf           # Output values
├── vpc.tf               # VPC, subnets, NAT, IGW
├── security-groups.tf   # Security groups
├── iam.tf               # IAM roles and policies
├── eks.tf               # EKS cluster and node group
└── README.md            # Documentation which your looking right now
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run `terraform fmt` and `terraform validate`
5. Submit a pull request
