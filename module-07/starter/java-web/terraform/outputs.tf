output "alb_dns" {
  value       = "TODO: reference aws_lb.app.dns_name"
  description = "DNS name of the Application Load Balancer"
}

output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the VPC"
}
