terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "4.49.0"
    }
  }
  required_version = ">= 1.3.6"
}



provider "aws" {
  region  = var.region
  profile = var.aws_profile
}