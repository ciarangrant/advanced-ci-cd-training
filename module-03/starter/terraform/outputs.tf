# outputs.tf — Output values
#
# Task 1: Define outputs for:
#   - bucket_name: the S3 bucket name
#   - bucket_arn: the S3 bucket ARN
#   - lock_table_name: the DynamoDB table name

# TODO: Add output "bucket_name"
# The name of the S3 bucket created
output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.app_data.id
}

# TODO: Add output "bucket_arn"
# The ARN of the S3 bucket
output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.app_data.arn
}

# TODO: Add output "lock_table_name"
# The name of the DynamoDB table used for state locking
output "lock_table_name" {
  description = "The name of the DynamoDB table"
  value       = aws_dynamodb_table.terraform_locks.name
}
