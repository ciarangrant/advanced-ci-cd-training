variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "image_tag" {
  type        = string
  description = "Docker image tag (commit SHA) to deploy"
}

variable "traffic_distribution" {
  type        = string
  default     = "blue"
  description = "Traffic routing: blue (100% blue), split (50/50), green (100% green)"
}

variable "traffic_weights" {
  type = map(object({
    blue  = number
    green = number
  }))
  default = {
    blue  = { blue = 100, green = 0 }
    split = { blue = 50, green = 50 }
    green = { blue = 0, green = 100 }
  }
}

variable "app_port" {
  type    = number
  default = 3000
}
