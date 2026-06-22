module "vpc" {
  source = "./modules"

  name = "opsimate"
  cidr = "10.2.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
  public_subnets  = ["10.2.160.0/19", "10.2.192.0/19", "10.2.224.0/19"]
  private_subnets = ["10.2.0.0/18", "10.2.64.0/18", "10.2.128.0/19"]

  enable_nat_gateway = true
  enable_vpn_gateway = true
  aws_profile = "ct-poc"
  region = "eu-west-1"

  tags = {
    Terraform = "true"
    Environment = "dev"
  }
  cluster-name = "opsimate"
  k8s_master_version = "1.32"
  instance_types = ["t2.large", "m3.large", "m1.large", "m7i.large", "m6i.large", "m5dn.large", "m5d.large", "m6gd.large", "t3.large", "t4g.large"]
  capacity_type   = "SPOT"
  minimum-node = "1"
  maximum-node = "1"
  desired-node = "1"
}

