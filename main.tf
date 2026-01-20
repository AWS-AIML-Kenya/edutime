terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "EduTime"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Generate random password for RDS
resource "random_password" "db_password" {
  length  = 16
  special = true
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for current AWS caller identity
data "aws_caller_identity" "current" {}

# Main VPC module
module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
}

# S3 module for static assets
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
}

# CloudFront is handled within the S3 module to avoid circular dependencies

# RDS module
module "rds" {
  source = "./modules/rds"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets
  db_password     = random_password.db_password.result
}

# Lambda module
module "lambda" {
  source = "./modules/lambda"

  project_name             = var.project_name
  environment              = var.environment
  vpc_id                   = module.vpc.vpc_id
  private_subnets          = module.vpc.private_subnets
  lambda_security_group_id = module.rds.lambda_security_group_id
  rds_endpoint             = module.rds.db_endpoint
  rds_port                 = module.rds.db_port
  db_name                  = module.rds.db_name
  db_password              = random_password.db_password.result
  sns_topic_arn            = module.sns.topic_arn
}

# API Gateway module
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name                          = var.project_name
  environment                           = var.environment
  timetable_lambda_arn                  = module.lambda.timetable_lambda_arn
  venue_management_lambda_arn           = module.lambda.venue_management_lambda_arn
  notification_lambda_arn               = module.lambda.notification_lambda_arn
  timetable_lambda_function_name        = module.lambda.timetable_lambda_function_name
  venue_management_lambda_function_name = module.lambda.venue_management_lambda_function_name
  notification_lambda_function_name     = module.lambda.notification_lambda_function_name
}

# SNS module
module "sns" {
  source = "./modules/sns"

  project_name = var.project_name
  environment  = var.environment
}