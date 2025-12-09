
resource "aws_vpc" "this" {
  count = local.create_vpc ? 1 : 0


  cidr_block          =  var.cidr

  instance_tenancy                     = var.instance_tenancy
  enable_dns_hostnames                 = var.enable_dns_hostnames
  enable_dns_support                   = var.enable_dns_support
  tags = merge(
    { "Name" = var.name },
    var.tags,
    var.vpc_tags,
  )
}


resource "aws_internet_gateway" "this" {
  count = local.create_public_subnets && var.create_igw ? 1 : 0
  vpc_id = aws_vpc.this[0].id

  tags = merge(
    { "Name" = var.name },
    var.tags,
    var.igw_tags,
  )
}


resource "aws_subnet" "public" {
  count = local.create_public_subnets && (!var.one_nat_gateway_per_az || local.len_public_subnets >= length(var.azs)) ? local.len_public_subnets : 0
  availability_zone                              = length(regexall("^[a-z]{2}-", element(var.azs, count.index))) > 0 ? element(var.azs, count.index) : null
  availability_zone_id                           = length(regexall("^[a-z]{2}-", element(var.azs, count.index))) == 0 ? element(var.azs, count.index) : null
  cidr_block                                     = element(concat(var.public_subnets, [""]), count.index)
  enable_dns64                                   = var.public_subnet_enable_dns64
  enable_resource_name_dns_aaaa_record_on_launch = var.public_subnet_enable_resource_name_dns_aaaa_record_on_launch
  enable_resource_name_dns_a_record_on_launch    = var.public_subnet_enable_resource_name_dns_a_record_on_launch
  map_public_ip_on_launch                        = var.map_public_ip_on_launch
  private_dns_hostname_type_on_launch            = var.public_subnet_private_dns_hostname_type_on_launch
  vpc_id                                         = aws_vpc.this[0].id

  tags = merge(
    {
      Name = try(
        var.public_subnet_names[count.index],
        format("${var.name}-${var.public_subnet_suffix}-%s", element(var.azs, count.index))
      )
    },
    var.tags,
    var.public_subnet_tags,
    lookup(var.public_subnet_tags_per_az, element(var.azs, count.index), {})
  )
}

resource "aws_route_table" "public" {
  count = local.create_public_subnets ? local.num_public_route_tables : 0
  vpc_id = aws_vpc.this[0].id

  tags = merge(
    {
      "Name" = var.create_multiple_public_route_tables ? format(
        "${var.name}-${var.public_subnet_suffix}-%s",
        element(var.azs, count.index),
      ) : "${var.name}-${var.public_subnet_suffix}"
    },
    var.tags,
    var.public_route_table_tags,
  )
}

resource "aws_route_table_association" "public" {
  count = local.create_public_subnets ? local.len_public_subnets : 0



  subnet_id      = element(aws_subnet.public[*].id, count.index)
  route_table_id = element(aws_route_table.public[*].id, var.create_multiple_public_route_tables ? count.index : 0)
}


resource "aws_route" "public_internet_gateway" {
  count = local.create_public_subnets && var.create_igw ? local.num_public_route_tables : 0


  route_table_id         = aws_route_table.public[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id

  timeouts {
    create = "5m"
  }
}



resource "aws_subnet" "private" {
  count = local.create_private_subnets ? local.len_private_subnets : 0
  availability_zone                              = length(regexall("^[a-z]{2}-", element(var.azs, count.index))) > 0 ? element(var.azs, count.index) : null
  availability_zone_id                           = length(regexall("^[a-z]{2}-", element(var.azs, count.index))) == 0 ? element(var.azs, count.index) : null
  cidr_block                                     = element(concat(var.private_subnets, [""]), count.index)
  enable_dns64                                   = var.private_subnet_enable_dns64
  enable_resource_name_dns_aaaa_record_on_launch = var.private_subnet_enable_resource_name_dns_aaaa_record_on_launch
  enable_resource_name_dns_a_record_on_launch    = var.private_subnet_enable_resource_name_dns_a_record_on_launch
  private_dns_hostname_type_on_launch            = var.private_subnet_private_dns_hostname_type_on_launch
  vpc_id                                         = var.cidr

  tags = merge(
    {
      Name = try(
        var.private_subnet_names[count.index],
        format("${var.name}-${var.private_subnet_suffix}-%s", element(var.azs, count.index))
      )
    },
    var.tags,
    var.private_subnet_tags,
    lookup(var.private_subnet_tags_per_az, element(var.azs, count.index), {})
  )
}


resource "aws_route_table" "private" {
  count = local.create_private_subnets && local.max_subnet_length > 0 ? local.nat_gateway_count : 0
  vpc_id = aws_vpc.this[0].id

  tags = merge(
    {
      "Name" = var.single_nat_gateway ? "${var.name}-${var.private_subnet_suffix}" : format(
        "${var.name}-${var.private_subnet_suffix}-%s",
        element(var.azs, count.index),
      )
    },
    var.tags,
    var.private_route_table_tags,
  )
}
resource "aws_route_table_association" "private" {
  count = local.create_private_subnets ? local.len_private_subnets : 0
  subnet_id = element(aws_subnet.private[*].id, count.index)
  route_table_id = element(
    aws_route_table.private[*].id,
    var.single_nat_gateway ? 0 : count.index,
  )
}



# Create EKS cluster

resource "aws_iam_role" "eks-master-role" {
  name = "${var.cluster-name}-eks-master-iam-role"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY

}


resource "aws_iam_role" "eks-node-role" {
  name = "${var.cluster-name}-eks-node-iam-role"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY

}



resource "aws_security_group" "aws-eks-master-sg" {
  name        = "${var.cluster-name}-eks-master-sg"
  description = "Cluster communication with worker nodes"
  vpc_id      = aws_vpc.this[0].id

  ingress {
    from_port   = 0
    protocol    = "tcp"
    to_port     = 65535
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name         = format("%s-sg-eks-master", var.cluster-name)
  }
}


resource "aws_security_group" "aws-eks-node-sg" {
  name        = "${var.cluster-name}-eks-node-sg"
  description = "Security group for all nodes in the cluster"
  vpc_id      = aws_vpc.this[0].id

  tags = {
    Name                     = format("%s-sg-eks-node", var.cluster-name)

  }

  lifecycle {
    ignore_changes = [ingress, egress] # Ignore external rules added dynamically
  }
}



resource "aws_iam_role_policy_attachment" "eks-cluster-AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks-master-role.name
}

resource "aws_iam_role_policy_attachment" "eks-cluster-AmazonEKSServicePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks-master-role.name
}

resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSComputePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSComputePolicy"
  role       = aws_iam_role.eks-master-role.name
}
resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSBlockStoragePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSBlockStoragePolicy"
  role       = aws_iam_role.eks-master-role.name
}
resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSLoadBalancingPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSLoadBalancingPolicy"
  role       = aws_iam_role.eks-master-role.name
}
resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks-master-role.name
}
resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSNetworkingPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSNetworkingPolicy"
  role       = aws_iam_role.eks-master-role.name
}

resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKSWorkerNodePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks-node-role.name
}

resource "aws_iam_role_policy_attachment" "eks-node-AmazonEKS_CNI_Policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks-node-role.name
}

resource "aws_iam_role_policy_attachment" "eks-node-AmazonEC2ContainerRegistryFullAccess" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
  role       = aws_iam_role.eks-node-role.name
}

resource "aws_iam_instance_profile" "eks-node" {
  name = "${var.cluster-name}-node-instance-profile"
  role = aws_iam_role.eks-node-role.name
}
resource "aws_eks_cluster" "aws-eks" {
  name     = var.cluster-name
  role_arn = aws_iam_role.eks-master-role.arn
  version  = var.k8s_master_version

  vpc_config {
    security_group_ids = [aws_security_group.aws-eks-master-sg.id]
    subnet_ids         = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
  }
  depends_on = [
    aws_iam_role.eks-master-role,
    aws_iam_role_policy_attachment.eks-cluster-AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.eks-cluster-AmazonEKSServicePolicy,
  ]
  enabled_cluster_log_types = var.enabled_cluster_log_types

  lifecycle {
    ignore_changes = [tags["alpha.eksctl.io/cluster-oidc-enabled"], ]
  }

}


resource "tls_private_key" "rsa" {
  algorithm = "RSA"
  rsa_bits  = 4096
}
resource "aws_key_pair" "tf_key" {
  key_name   = var.key_pair_name
  public_key = tls_private_key.rsa.public_key_openssh
}
resource "null_resource" "save_private_key" {
  provisioner "local-exec" {
    command = "echo '${tls_private_key.rsa.private_key_pem}' > ./opsimate-private-key.pem && chmod 400 ./opsimate-private-key.pem"
  }
  depends_on = [tls_private_key.rsa]
}


resource "aws_launch_template" "eks-nodegroup-lt" {
  name_prefix            = "eks-nodegroup-lt-"
  image_id               = local.node-ami-id
  key_name               = aws_key_pair.tf_key.key_name
  vpc_security_group_ids = [aws_security_group.aws-eks-node-sg.id]
  update_default_version = true
  block_device_mappings {
    device_name = var.root_device_name

    ebs {
      volume_type = var.root_volume_type
      volume_size = var.root_device_size
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name                                            = "${var.cluster-name}-${var.node_group_type}"
    }
  }

}



resource "aws_eks_node_group" "eks-node-ng" {
  cluster_name    = var.cluster-name
  node_group_name = "${var.cluster-name}-eks-node-${var.node_group_type}"
  node_role_arn   = aws_iam_role.eks-node-role.arn
  subnet_ids      = aws_subnet.private[*].id
  capacity_type   = var.capacity_type
  ami_type        = "CUSTOM"
  instance_types  = var.instance_types

  scaling_config {
    desired_size = var.desired-node
    max_size     = var.maximum-node
    min_size     = var.minimum-node
  }

  force_update_version = var.force_update_version

  update_config {
    max_unavailable = var.max_unavailable
  }

  launch_template {
    id      = aws_launch_template.eks-nodegroup-lt.id
    version = var.launch_template_version
  }


  tags = {
    Name                                            = "${var.cluster-name}-eks-node-${var.node_group_type}"
  }

  # Timeout for the operation
  timeouts {
    create = "4h"
    delete = "2h"
    update = "4h"
  }

  # Optional: Allow external changes without Terraform plan difference
  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }
}
