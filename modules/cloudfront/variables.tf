variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID for static assets"
  type        = string
}

variable "s3_bucket_domain_name" {
  description = "S3 bucket regional domain name"
  type        = string
}

variable "api_gateway_domain" {
  description = "API Gateway domain name"
  type        = string
}