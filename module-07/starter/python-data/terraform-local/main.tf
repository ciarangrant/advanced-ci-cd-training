# ── Local Labs: Kubernetes Provider (K3s) ────────────────
# Provision K3s resources instead of AWS ECS/ALB/VPC.

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

variable "project_name" {
  type    = string
  default = "python-data"
}

variable "gitea_user" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "app_port" {
  type    = number
  default = 8000
}

variable "blue_weight" {
  type    = number
  default = 100
}

variable "green_weight" {
  type    = number
  default = 0
}

# TODO: Create a kubernetes_namespace resource for var.project_name

# TODO: Create a kubernetes_deployment "blue" with:
#       - 2 replicas
#       - image: localhost:8100/${var.gitea_user}/${var.project_name}:${var.image_tag}
#       - container port: var.app_port
#       - liveness_probe on /health

# TODO: Create a kubernetes_service "blue" pointing to the blue deployment

# TODO: Create a kubernetes_service "green" pointing to the green deployment

# TODO: Create a kubernetes_manifest for Traefik IngressRoute with:
#       - Host match: ${var.project_name}.local
#       - Two services: blue (var.blue_weight) and green (var.green_weight)
