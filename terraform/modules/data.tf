data "aws_ssm_parameter" "eks_ami_id" {
  name = "/aws/service/eks/optimized-ami/${local.k8s_ng_version}/amazon-linux-2/recommended/image_id"
}
