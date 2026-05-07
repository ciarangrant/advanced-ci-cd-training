# variables.tf — Input variables
#
# Task 1: Define the following variables:
#   - aws_region (string, default "eu-west-1")
#   - project_name (string, default "cicd-lab")
#   - environment (string, default "dev")

# TODO: Define variable "aws_region"
variable "aws_region" {
  description = "The AWS region where resources will be created"
  type        = string
  default     = "eu-west-1"
}


# TODO: Define variable "project_name"
variable "project_name" {
  description = "The name of the project, used for resource naming"
  type        = string
  default     = "adv-ci-cd-module-03"
}

# TODO: Define variable "environment"
variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

# TODO: Define variable "unique_suffix"
# This prevents S3 bucket name collisions when multiple learners use the same
# project_name. Set it to your GitHub username or initials (e.g., "jsmith").
# S3 bucket names must be globally unique, so every learner needs a different suffix.
variable "unique_suffix" {
  description = "Unique suffix to prevent S3 bucket name collisions (use your GitHub username or initials)"
  type        = string
  default     = "ciarangrant"   # <-- replace with YOUR GitHub username or initials
}
