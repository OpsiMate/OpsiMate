
locals {
  create_public_subnets = local.create_vpc && local.len_public_subnets > 0
  create_private_subnets = local.create_vpc && local.len_private_subnets > 0
  num_public_route_tables = var.create_multiple_public_route_tables ? local.len_public_subnets : 1

  len_public_subnets      = length(var.public_subnets)
  len_private_subnets     = length(var.private_subnets)
  len_intra_subnets       = length(var.intra_subnets)
  nat_gateway_count = var.single_nat_gateway ? 1 : var.one_nat_gateway_per_az ? length(var.azs) : local.max_subnet_length


  max_subnet_length = max(
    local.len_private_subnets,
    local.len_public_subnets,
  )


  create_vpc = var.create_vpc
  k8s_ng_version = var.k8s_ng_version != "" ? var.k8s_ng_version : var.k8s_master_version
  node-ami-id = var.node-ami-id != "" ? var.node-ami-id : data.aws_ssm_parameter.eks_ami_id.value
}



