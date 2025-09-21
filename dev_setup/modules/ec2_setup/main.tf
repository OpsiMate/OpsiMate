resource "aws_vpc" "opsimate_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "opsimate-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.opsimate_vpc.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "opsimate-public-subnet" }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.opsimate_vpc.id
  cidr_block        = var.private_subnet_cidr
  availability_zone = "us-east-1a"
  tags = { Name = "opsimate-private-subnet" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.opsimate_vpc.id
  tags = { Name = "opsimate-main-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.opsimate_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = { Name = "opsimate-public-rt" }
}

resource "aws_route_table_association" "public_assoc" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "ssh" {
  name        = "ssh-sg"
  description = "Allow SSH"
  vpc_id      = aws_vpc.opsimate_vpc.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # ⚠️ change to your IP in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "opsimate-ssh-sg" }
}

resource "tls_private_key" "ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated" {
  key_name   = "terraform-key"
  public_key = tls_private_key.ssh_key.public_key_openssh
}

resource "local_file" "private_key" {
  content          = tls_private_key.ssh_key.private_key_pem
  filename         = "${path.module}/terraform-key.pem"
  file_permission  = "0400"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "opsimate-managed-ec2" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = "t2.micro"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.id]
  associate_public_ip_address = true
  key_name                    = aws_key_pair.generated.key_name

  tags = { Name = "opsimate-terraform-ec2" }
}
