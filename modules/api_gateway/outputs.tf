output "api_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_url" {
  description = "URL of the API Gateway"
  value       = aws_api_gateway_deployment.main.invoke_url
}

output "api_domain" {
  description = "Domain of the API Gateway for CloudFront"
  value       = replace(aws_api_gateway_deployment.main.invoke_url, "/^https?://([^/]+).*/", "$1")
}

output "execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.main.execution_arn
}