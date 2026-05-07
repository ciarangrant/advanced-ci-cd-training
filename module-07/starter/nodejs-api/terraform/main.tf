terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # TODO: Configure S3 remote backend
  # Replace REPLACE_ME_UNIQUE_SUFFIX with your own unique suffix (e.g., your GitHub username)
  # backend "s3" {
  #   bucket       = "hackathon-tf-state-REPLACE_ME_UNIQUE_SUFFIX"
  #   key          = "hackathon/nodejs-api/terraform.tfstate"
  #   region       = "eu-west-1"
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.aws_region
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# ---- Networking (provided) ----

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "hackathon-vpc"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "hackathon-public-a"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "hackathon-public-b"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "hackathon-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "hackathon-public-rt"
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name_prefix = "hackathon-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "hackathon-alb-sg"
  }
}

resource "aws_security_group" "app" {
  name_prefix = "hackathon-app-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "hackathon-app-sg"
  }
}

# ---- Your work starts here ----

# TODO: Add an ALB (Application Load Balancer)
# resource "aws_lb" "app" { ... }

# TODO: Add two target groups (blue and green)
# resource "aws_lb_target_group" "blue" { ... }
# resource "aws_lb_target_group" "green" { ... }

# TODO: Add an ALB listener with weighted forwarding
# Use var.traffic_weights[var.traffic_distribution] to control the weights
# See Hint 4 in the lab README

# TODO: Add ECS resources for deployment:
# - aws_cloudwatch_log_group for "/ecs/hackathon-app"
# - aws_iam_role for ECS task execution (with AmazonECSTaskExecutionRolePolicy)
# - aws_ecs_cluster
# - aws_ecs_task_definition (Fargate, with execution_role_arn, container definition, and log configuration)
# - aws_ecs_service (connected to the green target group)
