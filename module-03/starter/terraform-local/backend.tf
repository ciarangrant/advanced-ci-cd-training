# Local backend — no S3 bucket or DynamoDB table needed.
# State is stored in terraform.tfstate in this directory.
terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
