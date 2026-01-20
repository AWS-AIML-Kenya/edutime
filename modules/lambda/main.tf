# IAM Role for Lambda Execution
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-${var.environment}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-execution-role"
  }
}

# IAM Policy for Lambda VPC Access
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# IAM Policy for Lambda Basic Execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom IAM Policy for SNS Access
resource "aws_iam_policy" "lambda_sns" {
  name        = "${var.project_name}-${var.environment}-lambda-sns-policy"
  description = "Policy for Lambda functions to publish to SNS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:GetTopicAttributes"
        ]
        Resource = var.sns_topic_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_sns" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_sns.arn
}

# Lambda Layer for shared dependencies (psycopg2, requests, etc.)
resource "aws_lambda_layer_version" "dependencies" {
  filename   = "lambda_layer.zip"
  layer_name = "${var.project_name}-${var.environment}-dependencies"

  compatible_runtimes = ["python3.11"]

  # Create a placeholder zip file for dependencies
  depends_on = [data.archive_file.lambda_layer]
}

# Create the dependencies layer zip
data "archive_file" "lambda_layer" {
  type        = "zip"
  output_path = "lambda_layer.zip"

  source {
    content  = <<EOF
# Lambda Layer Dependencies
# This is a placeholder. In production, you would include:
# - psycopg2-binary for PostgreSQL connection
# - boto3 for AWS services
# - requests for HTTP calls
# - Other common dependencies

# To build the actual layer:
# 1. Create a directory: mkdir python
# 2. Install dependencies: pip install psycopg2-binary boto3 requests -t python/
# 3. Zip the python directory: zip -r lambda_layer.zip python/
EOF
    filename = "README.txt"
  }
}

# Timetable Lambda Function
resource "aws_lambda_function" "timetable" {
  filename      = "timetable_lambda.zip"
  function_name = "${var.project_name}-${var.environment}-timetable"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  layers = [aws_lambda_layer_version.dependencies.arn]

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_HOST     = var.rds_endpoint
      DB_PORT     = tostring(var.rds_port)
      DB_NAME     = var.db_name
      DB_PASSWORD = var.db_password
    }
  }

  depends_on = [
    data.archive_file.timetable_lambda,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_basic_execution,
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-timetable-lambda"
  }
}

# Venue Management Lambda Function
resource "aws_lambda_function" "venue_management" {
  filename      = "venue_management_lambda.zip"
  function_name = "${var.project_name}-${var.environment}-venue-management"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  layers = [aws_lambda_layer_version.dependencies.arn]

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_HOST     = var.rds_endpoint
      DB_PORT     = tostring(var.rds_port)
      DB_NAME     = var.db_name
      DB_PASSWORD = var.db_password
    }
  }

  depends_on = [
    data.archive_file.venue_management_lambda,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_basic_execution,
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-venue-management-lambda"
  }
}

# Notification Lambda Function
resource "aws_lambda_function" "notification" {
  filename      = "notification_lambda.zip"
  function_name = "${var.project_name}-${var.environment}-notification"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  layers = [aws_lambda_layer_version.dependencies.arn]

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_HOST       = var.rds_endpoint
      DB_PORT       = tostring(var.rds_port)
      DB_NAME       = var.db_name
      DB_PASSWORD   = var.db_password
      SNS_TOPIC_ARN = var.sns_topic_arn
    }
  }

  depends_on = [
    data.archive_file.notification_lambda,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_sns,
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-lambda"
  }
}

# Lambda function source code archives
data "archive_file" "timetable_lambda" {
  type        = "zip"
  output_path = "timetable_lambda.zip"

  source {
    content  = file("${path.module}/src/timetable_lambda.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "venue_management_lambda" {
  type        = "zip"
  output_path = "venue_management_lambda.zip"

  source {
    content  = file("${path.module}/src/venue_management_lambda.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "notification_lambda" {
  type        = "zip"
  output_path = "notification_lambda.zip"

  source {
    content  = file("${path.module}/src/notification_lambda.py")
    filename = "lambda_function.py"
  }
}