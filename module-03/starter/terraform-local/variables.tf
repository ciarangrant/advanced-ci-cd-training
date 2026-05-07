variable "project_name" {
  description = "Prefix for all resource names"
  type        = string
  default     = "cicd-lab"

  # TODO: Add a validation block requiring 3-21 lowercase
  #       alphanumeric characters matching ^[a-z][a-z0-9-]{2,20}$
}

variable "app_port" {
  description = "External port for the application container"
  type        = number
  default     = 8080
}
