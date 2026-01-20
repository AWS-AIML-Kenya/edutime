# Data source for current AWS region
data "aws_region" "current" {}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-${var.environment}-api"
  description = "EduTime Campus Venue Management API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api"
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_method.timetables_get,
    aws_api_gateway_method.timetables_post,
    aws_api_gateway_method.timetables_id_get,
    aws_api_gateway_method.timetables_id_put,
    aws_api_gateway_method.timetables_id_delete,
    aws_api_gateway_method.venues_get,
    aws_api_gateway_method.venues_id_get,
    aws_api_gateway_method.venues_conflicts_post,
    aws_api_gateway_method.notifications_venue_change_post,
    aws_api_gateway_method.notifications_attendance_post,
    aws_api_gateway_method.notifications_reminder_post,
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = var.environment

  # Trigger redeployment when configuration changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.timetables.id,
      aws_api_gateway_resource.venues.id,
      aws_api_gateway_resource.notifications.id,
      aws_api_gateway_method.timetables_get.id,
      aws_api_gateway_method.timetables_post.id,
      aws_api_gateway_method.venues_get.id,
      aws_api_gateway_method.notifications_venue_change_post.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  # Enable logging
  xray_tracing_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-api-stage"
  }
}

# API Gateway Resources
resource "aws_api_gateway_resource" "timetables" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "timetables"
}

resource "aws_api_gateway_resource" "timetables_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.timetables.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "venues" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "venues"
}

resource "aws_api_gateway_resource" "venues_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.venues.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "venues_conflicts" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.venues.id
  path_part   = "check-conflicts"
}

resource "aws_api_gateway_resource" "notifications" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "notifications"
}

resource "aws_api_gateway_resource" "notifications_venue_change" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.notifications.id
  path_part   = "venue-change"
}

resource "aws_api_gateway_resource" "notifications_attendance" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.notifications.id
  path_part   = "attendance"
}

resource "aws_api_gateway_resource" "notifications_reminder" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.notifications.id
  path_part   = "reminder"
}

# CORS for all resources
resource "aws_api_gateway_method" "cors_timetables" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_timetables" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables.id
  http_method = aws_api_gateway_method.cors_timetables.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_timetables" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables.id
  http_method = aws_api_gateway_method.cors_timetables.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_timetables" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables.id
  http_method = aws_api_gateway_method.cors_timetables.http_method
  status_code = aws_api_gateway_method_response.cors_timetables.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Timetables Methods
resource "aws_api_gateway_method" "timetables_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timetables_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables.id
  http_method = aws_api_gateway_method.timetables_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.timetable_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "timetables_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timetables_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables.id
  http_method = aws_api_gateway_method.timetables_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.venue_management_lambda_arn}/invocations"
}

# Individual Timetable Methods
resource "aws_api_gateway_method" "timetables_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timetables_id_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables_id.id
  http_method = aws_api_gateway_method.timetables_id_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.timetable_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "timetables_id_put" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables_id.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timetables_id_put" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables_id.id
  http_method = aws_api_gateway_method.timetables_id_put.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.venue_management_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "timetables_id_delete" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.timetables_id.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timetables_id_delete" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.timetables_id.id
  http_method = aws_api_gateway_method.timetables_id_delete.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.venue_management_lambda_arn}/invocations"
}

# Venues Methods
resource "aws_api_gateway_method" "venues_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.venues.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "venues_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.venues.id
  http_method = aws_api_gateway_method.venues_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.timetable_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "venues_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.venues_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "venues_id_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.venues_id.id
  http_method = aws_api_gateway_method.venues_id_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.timetable_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "venues_conflicts_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.venues_conflicts.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "venues_conflicts_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.venues_conflicts.id
  http_method = aws_api_gateway_method.venues_conflicts_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.venue_management_lambda_arn}/invocations"
}

# Notification Methods
resource "aws_api_gateway_method" "notifications_venue_change_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications_venue_change.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "notifications_venue_change_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.notifications_venue_change.id
  http_method = aws_api_gateway_method.notifications_venue_change_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.notification_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "notifications_attendance_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications_attendance.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "notifications_attendance_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.notifications_attendance.id
  http_method = aws_api_gateway_method.notifications_attendance_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.notification_lambda_arn}/invocations"
}

resource "aws_api_gateway_method" "notifications_reminder_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications_reminder.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "notifications_reminder_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.notifications_reminder.id
  http_method = aws_api_gateway_method.notifications_reminder_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.notification_lambda_arn}/invocations"
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "timetable_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.timetable_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "venue_management_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.venue_management_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "notification_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.notification_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}