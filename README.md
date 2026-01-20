# EduTime - Campus Venue Management System

A comprehensive AWS cloud solution for managing campus lecture venues, timetables, and notifications for class representatives and lecturers.

## Architecture Overview

EduTime is built on AWS using a serverless architecture that provides scalability, reliability, and cost-effectiveness. The system follows the campus venue management flow:

1. **Check app** - Users access via CloudFront-distributed web/mobile clients
2. **View timetable & venues** - API Gateway routes to Lambda functions reading from RDS PostgreSQL
3. **Check for conflicts/changes** - Venue management Lambda handles conflict detection and updates
4. **Handle conflicts & update timetable** - Database updates managed through Lambda functions
5. **Send notifications** - SNS publishes venue change notifications to subscribed users
6. **Confirm attendance** - Attendance confirmations recorded and notifications sent
7. **Done** - Latest timetable state always available in RDS

## Components

### AWS Infrastructure

- **CloudFront**: Global CDN for fast content delivery
- **S3**: Static asset storage (web app files, images)
- **API Gateway**: REST API endpoints for all operations
- **Lambda Functions**: Serverless compute for business logic
  - Timetable Handler: Read operations for timetables and venues
  - Venue Management: Create, update, delete operations with conflict checking
  - Notification Handler: SNS publishing and attendance tracking
- **RDS PostgreSQL**: Primary database for all application data
- **SNS**: Push notification service for venue changes and alerts
- **VPC**: Network isolation with public and private subnets
- **IAM**: Security roles and policies for least-privilege access

### Database Schema

The PostgreSQL database includes:
- **venues**: Campus venue information (capacity, location, facilities)
- **timetables**: Class schedules with venue assignments
- **attendance_confirmations**: User attendance status tracking
- **notifications**: Notification history and status
- **users**: User profiles and notification preferences

## API Endpoints

### Timetables
- `GET /api/timetables` - List all timetables (with filtering)
- `GET /api/timetables/{id}` - Get specific timetable
- `POST /api/timetables` - Create new timetable entry
- `PUT /api/timetables/{id}` - Update existing timetable
- `DELETE /api/timetables/{id}` - Cancel timetable entry

### Venues
- `GET /api/venues` - List all venues (with availability filtering)
- `GET /api/venues/{id}` - Get specific venue with schedule
- `POST /api/venues/check-conflicts` - Check for venue conflicts

### Notifications
- `POST /api/notifications/venue-change` - Send venue change notifications
- `POST /api/notifications/attendance` - Record attendance confirmations
- `POST /api/notifications/reminder` - Send class reminders

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Terraform >= 1.0 installed
3. Access to AWS account with admin privileges

### Step 1: Deploy Infrastructure

```bash
# Clone the repository
git clone <repository-url>
cd edutime-aws-infrastructure

# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy the infrastructure
terraform apply
```

### Step 2: Database Setup

```bash
# Connect to the RDS instance (use endpoint from terraform output)
psql -h <rds-endpoint> -U edutime_admin -d edutime

# Run the database schema
\\i database_schema.sql
```

### Step 3: Configure Lambda Dependencies

The Lambda functions require additional dependencies. Create the dependencies layer:

```bash
# Create a temporary directory
mkdir lambda-deps && cd lambda-deps

# Create the python directory for the layer
mkdir python

# Install dependencies
pip install psycopg2-binary boto3 requests -t python/

# Create the layer package
zip -r ../lambda_layer.zip python/

# Upload to S3 or update the layer directly
aws lambda update-layer-version \\
  --layer-name edutime-dev-dependencies \\
  --zip-file fileb://../lambda_layer.zip \\
  --compatible-runtimes python3.11
```

### Step 4: Configure SNS Subscriptions

Add email and SMS subscriptions to receive notifications:

```bash
# Email subscription
aws sns subscribe \\
  --topic-arn <sns-topic-arn> \\
  --protocol email \\
  --notification-endpoint admin@yourdomain.com

# SMS subscription (optional)
aws sns subscribe \\
  --topic-arn <sns-topic-arn> \\
  --protocol sms \\
  --notification-endpoint +1234567890
```

## Configuration

### Environment Variables

The system uses the following environment variables (automatically set by Terraform):

- `DB_HOST`: RDS PostgreSQL endpoint
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: edutime)
- `DB_PASSWORD`: Database master password (generated)
- `SNS_TOPIC_ARN`: SNS topic ARN for notifications

### Terraform Variables

Key variables you can customize in `terraform.tfvars`:

```hcl
# terraform.tfvars
aws_region = "us-east-1"
project_name = "edutime"
environment = "dev"  # or "staging", "prod"
vpc_cidr = "10.0.0.0/16"
```

## Monitoring & Maintenance

### CloudWatch Logs

All Lambda functions log to CloudWatch:
- `/aws/lambda/edutime-dev-timetable`
- `/aws/lambda/edutime-dev-venue-management`
- `/aws/lambda/edutime-dev-notification`

### Database Monitoring

RDS Enhanced Monitoring is enabled with:
- Performance Insights
- CloudWatch metrics
- Automated backups (7-day retention)

### Scaling

The serverless architecture automatically scales based on demand:
- **Lambda**: Scales to handle concurrent requests
- **RDS**: Can be upgraded to larger instances
- **CloudFront**: Global edge locations handle traffic spikes

## Security Features

- **VPC**: Database and Lambda functions in private subnets
- **Security Groups**: Restrictive network access rules
- **IAM**: Least-privilege access for all resources
- **Encryption**: RDS and S3 encryption at rest
- **HTTPS**: All API traffic encrypted in transit

## Cost Optimization

- **Serverless**: Pay only for actual usage
- **CloudFront**: Reduces origin server load
- **RDS**: Right-sized instance with storage auto-scaling
- **Lambda**: Efficient memory allocation and timeout settings

## Troubleshooting

### Common Issues

1. **Lambda timeout**: Increase timeout in `modules/lambda/main.tf`
2. **Database connection**: Check security groups and VPC configuration
3. **CORS errors**: Verify API Gateway CORS settings
4. **SNS delivery**: Check topic subscriptions and permissions

### Useful Commands

```bash
# Check Terraform state
terraform state list

# View RDS endpoint
terraform output rds_endpoint

# Check Lambda logs
aws logs tail /aws/lambda/edutime-dev-timetable --follow

# Test API endpoints
curl https://<api-gateway-url>/api/venues

# Check SNS topic subscriptions
aws sns list-subscriptions-by-topic --topic-arn <topic-arn>
```

## Development

### Local Development

For local development and testing:

1. Set up a local PostgreSQL database
2. Configure environment variables
3. Test Lambda functions locally using SAM or similar tools

### Adding Features

The modular Terraform structure makes it easy to add new components:

1. Create new modules in the `modules/` directory
2. Add module references in `main.tf`
3. Update variables and outputs as needed

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review CloudWatch logs for errors
3. Verify AWS resource status in the console
4. Check database connectivity and data integrity

## License

This project is licensed under the MIT License - see the LICENSE file for details.