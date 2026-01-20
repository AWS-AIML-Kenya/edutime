# SNS Topic for venue change notifications
resource "aws_sns_topic" "venue_notifications" {
  name = "${var.project_name}-${var.environment}-venue-notifications"

  tags = {
    Name = "${var.project_name}-${var.environment}-venue-notifications"
  }
}

# SNS Topic Policy (allowing publish from Lambda functions)
resource "aws_sns_topic_policy" "venue_notifications" {
  arn = aws_sns_topic.venue_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "SNS:Publish",
          "SNS:GetTopicAttributes"
        ]
        Resource = aws_sns_topic.venue_notifications.arn
      },
      {
        Sid    = "AllowAccountAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "SNS:Subscribe",
          "SNS:SetTopicAttributes",
          "SNS:RemovePermission",
          "SNS:Receive",
          "SNS:Publish",
          "SNS:ListSubscriptionsByTopic",
          "SNS:GetTopicAttributes",
          "SNS:DeleteTopic",
          "SNS:AddPermission"
        ]
        Resource = aws_sns_topic.venue_notifications.arn
      }
    ]
  })
}

# Example email subscription (you can add more subscriptions as needed)
# Uncomment and modify the email address as needed
# resource "aws_sns_topic_subscription" "email_alerts" {
#   topic_arn = aws_sns_topic.venue_notifications.arn
#   protocol  = "email"
#   endpoint  = "admin@edutime.com"  # Replace with actual email
# }

# Example SMS subscription (you can add phone numbers as needed)
# Uncomment and modify the phone number as needed
# resource "aws_sns_topic_subscription" "sms_alerts" {
#   topic_arn = aws_sns_topic.venue_notifications.arn
#   protocol  = "sms"
#   endpoint  = "+1234567890"  # Replace with actual phone number
# }

# CloudWatch Log Group for SNS message logging
resource "aws_cloudwatch_log_group" "sns_logs" {
  name              = "/aws/sns/${var.project_name}-${var.environment}-venue-notifications"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-sns-logs"
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}