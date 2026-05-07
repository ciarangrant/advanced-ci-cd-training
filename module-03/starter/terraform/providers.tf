# providers.tf — Terraform and provider configuration
#
# TODO: This file is complete. Review it to understand the version constraints.

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.35"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
