output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = module.s3.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront Distribution domain name"
  value       = module.s3.cloudfront_domain_name
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.api_gateway.api_url
}

output "s3_bucket_name" {
  description = "S3 bucket name for static assets"
  value       = module.s3.bucket_name
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  value       = module.sns.topic_arn
}

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    timetable    = module.lambda.timetable_lambda_function_name
    venue        = module.lambda.venue_management_lambda_function_name
    notification = module.lambda.notification_lambda_function_name
  }
}