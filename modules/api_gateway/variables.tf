variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "timetable_lambda_arn" {
  description = "ARN of the timetable Lambda function"
  type        = string
}

variable "venue_management_lambda_arn" {
  description = "ARN of the venue management Lambda function"
  type        = string
}

variable "notification_lambda_arn" {
  description = "ARN of the notification Lambda function"
  type        = string
}

variable "timetable_lambda_function_name" {
  description = "Name of the timetable Lambda function"
  type        = string
}

variable "venue_management_lambda_function_name" {
  description = "Name of the venue management Lambda function"
  type        = string
}

variable "notification_lambda_function_name" {
  description = "Name of the notification Lambda function"
  type        = string
}