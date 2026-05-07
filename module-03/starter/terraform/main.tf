# main.tf — Resource definitions
#
# Task 1: Create the following resources:
#
# 1. aws_s3_bucket named "app_data"
#    - bucket name: "${var.project_name}-data-${var.environment}-${var.unique_suffix}"
#    - lifecycle: prevent_destroy = true
#    - tags: Environment = var.environment, ManagedBy = "terraform"
#
# 2. aws_s3_bucket_versioning named "app_data"
#    - bucket: reference the S3 bucket id from resource 1
#    - versioning_configuration: status = "Enabled"
#
# 3. aws_dynamodb_table named "terraform_locks"
#    - name: "${var.project_name}-tf-locks"
#    - billing_mode: "PAY_PER_REQUEST"
#    - hash_key: "LockID"
#    - attribute: name = "LockID", type = "S"

# TODO: Add aws_s3_bucket resource
resource "aws_s3_bucket" "app_data" {
  bucket = "${var.project_name}-data-${var.environment}-${var.unique_suffix}"

  # Prevents accidental deletion via terraform destroy
  lifecycle {
    prevent_destroy = false
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# TODO: Add aws_s3_bucket_versioning resource
resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# TODO: Add aws_dynamodb_table resource
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.project_name}-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S" # String type
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
