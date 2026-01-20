output "timetable_lambda_arn" {
  description = "ARN of the timetable Lambda function"
  value       = aws_lambda_function.timetable.arn
}

output "venue_management_lambda_arn" {
  description = "ARN of the venue management Lambda function"
  value       = aws_lambda_function.venue_management.arn
}

output "notification_lambda_arn" {
  description = "ARN of the notification Lambda function"
  value       = aws_lambda_function.notification.arn
}

output "timetable_lambda_function_name" {
  description = "Name of the timetable Lambda function"
  value       = aws_lambda_function.timetable.function_name
}

output "venue_management_lambda_function_name" {
  description = "Name of the venue management Lambda function"
  value       = aws_lambda_function.venue_management.function_name
}

output "notification_lambda_function_name" {
  description = "Name of the notification Lambda function"
  value       = aws_lambda_function.notification.function_name
}