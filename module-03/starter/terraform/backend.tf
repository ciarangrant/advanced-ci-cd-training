# backend.tf — Remote state configuration
#
# Task 2: After creating the S3 bucket and DynamoDB table (Task 1),
# uncomment the backend block below and run:
#
#   terraform init -migrate-state
#
# This migrates your local state file to the remote S3 backend.

terraform {
  backend "s3" {
    bucket         = "adv-ci-cd-module-03-data-dev-ciarangrant"
    key            = "dev/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "adv-ci-cd-module-03-tf-locks"
  }
}
