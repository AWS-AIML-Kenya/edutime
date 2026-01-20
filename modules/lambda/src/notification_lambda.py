import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from datetime import datetime

def lambda_handler(event, context):
    """
    Lambda function to handle notifications for EduTime
    - POST /notifications/venue-change: Send venue change notifications
    - POST /notifications/attendance: Record and notify attendance confirmations
    - POST /notifications/reminder: Send class reminders
    """

    # Database connection parameters
    db_params = {
        'host': os.environ['DB_HOST'],
        'port': os.environ['DB_PORT'],
        'database': os.environ['DB_NAME'],
        'user': 'edutime_admin',
        'password': os.environ['DB_PASSWORD']
    }

    # SNS client
    sns_client = boto3.client('sns')
    sns_topic_arn = os.environ['SNS_TOPIC_ARN']

    try:
        # Parse the incoming event
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}

        # Connect to database
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor(cursor_factory=RealDictCursor)

        # Route the request based on path and method
        if http_method == 'POST':
            if path == '/api/notifications/venue-change':
                result = handle_venue_change_notification(cursor, connection, sns_client, sns_topic_arn, body)
            elif path == '/api/notifications/attendance':
                result = handle_attendance_confirmation(cursor, connection, sns_client, sns_topic_arn, body)
            elif path == '/api/notifications/reminder':
                result = handle_class_reminder(cursor, sns_client, sns_topic_arn, body)
            else:
                result = {'error': 'Path not found'}
        else:
            result = {'error': 'Method not allowed'}

        cursor.close()
        connection.close()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }

def handle_venue_change_notification(cursor, connection, sns_client, sns_topic_arn, request_data):
    """Handle venue change notifications"""

    timetable_id = request_data.get('timetable_id')
    old_venue_id = request_data.get('old_venue_id')
    new_venue_id = request_data.get('new_venue_id')
    change_reason = request_data.get('reason', 'Venue change')

    if not all([timetable_id, old_venue_id, new_venue_id]):
        return {'error': 'Missing required parameters'}

    # Get timetable details with venue information
    query = """
        SELECT t.*,
               v_old.name as old_venue_name, v_old.location as old_venue_location,
               v_new.name as new_venue_name, v_new.location as new_venue_location
        FROM timetables t
        JOIN venues v_old ON %s = v_old.id
        JOIN venues v_new ON t.venue_id = v_new.id
        WHERE t.id = %s
    """

    cursor.execute(query, (old_venue_id, timetable_id))
    timetable = cursor.fetchone()

    if not timetable:
        return {'error': 'Timetable not found'}

    # Create notification record
    notification_query = """
        INSERT INTO notifications (timetable_id, type, message, recipients, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        RETURNING id
    """

    notification_message = f"""
    VENUE CHANGE ALERT

    Subject: {timetable['subject']}
    Date: {timetable['date']}
    Time: {timetable['start_time']} - {timetable['end_time']}

    OLD VENUE: {timetable['old_venue_name']} ({timetable['old_venue_location']})
    NEW VENUE: {timetable['new_venue_name']} ({timetable['new_venue_location']})

    Reason: {change_reason}

    Please update your schedule accordingly.
    """

    # Determine recipients (students, class rep, lecturer)
    recipients = [timetable['class_rep'], timetable['lecturer']]

    cursor.execute(notification_query, (
        timetable_id,
        'venue_change',
        notification_message,
        json.dumps(recipients)
    ))

    notification_id = cursor.fetchone()['id']
    connection.commit()

    # Send SNS notification
    sns_message = {
        'notification_id': notification_id,
        'type': 'venue_change',
        'timetable_id': timetable_id,
        'subject': timetable['subject'],
        'date': str(timetable['date']),
        'time': f"{timetable['start_time']} - {timetable['end_time']}",
        'old_venue': f"{timetable['old_venue_name']} ({timetable['old_venue_location']})",
        'new_venue': f"{timetable['new_venue_name']} ({timetable['new_venue_location']})",
        'reason': change_reason,
        'recipients': recipients
    }

    try:
        sns_response = sns_client.publish(
            TopicArn=sns_topic_arn,
            Message=json.dumps(sns_message),
            Subject=f"Venue Change: {timetable['subject']}",
            MessageAttributes={
                'notification_type': {
                    'DataType': 'String',
                    'StringValue': 'venue_change'
                },
                'timetable_id': {
                    'DataType': 'String',
                    'StringValue': str(timetable_id)
                }
            }
        )

        return {
            'success': True,
            'message': 'Venue change notification sent successfully',
            'notification_id': notification_id,
            'sns_message_id': sns_response['MessageId']
        }

    except Exception as e:
        print(f"SNS Error: {str(e)}")
        return {
            'success': False,
            'error': 'Failed to send notification via SNS',
            'notification_id': notification_id
        }

def handle_attendance_confirmation(cursor, connection, sns_client, sns_topic_arn, request_data):
    """Handle attendance confirmations"""

    timetable_id = request_data.get('timetable_id')
    user_id = request_data.get('user_id')  # Could be student ID, class rep, or lecturer
    user_type = request_data.get('user_type')  # 'student', 'class_rep', 'lecturer'
    status = request_data.get('status')  # 'confirmed', 'declined', 'maybe'

    if not all([timetable_id, user_id, user_type, status]):
        return {'error': 'Missing required parameters'}

    # Get timetable details
    cursor.execute("""
        SELECT t.*, v.name as venue_name, v.location as venue_location
        FROM timetables t
        JOIN venues v ON t.venue_id = v.id
        WHERE t.id = %s
    """, (timetable_id,))

    timetable = cursor.fetchone()

    if not timetable:
        return {'error': 'Timetable not found'}

    # Record attendance confirmation
    attendance_query = """
        INSERT INTO attendance_confirmations (timetable_id, user_id, user_type, status, confirmed_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (timetable_id, user_id)
        DO UPDATE SET status = EXCLUDED.status, confirmed_at = EXCLUDED.confirmed_at
        RETURNING id
    """

    cursor.execute(attendance_query, (timetable_id, user_id, user_type, status))
    attendance_id = cursor.fetchone()['id']
    connection.commit()

    # Create notification for attendance confirmation
    notification_message = f"""
    ATTENDANCE {status.upper()}

    Subject: {timetable['subject']}
    Date: {timetable['date']}
    Time: {timetable['start_time']} - {timetable['end_time']}
    Venue: {timetable['venue_name']} ({timetable['venue_location']})

    {user_type.title()}: {user_id}
    Status: {status.title()}

    Confirmed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """

    # Insert notification record
    cursor.execute("""
        INSERT INTO notifications (timetable_id, type, message, recipients, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        RETURNING id
    """, (timetable_id, 'attendance_confirmation', notification_message, json.dumps([timetable['class_rep'], timetable['lecturer']])))

    notification_id = cursor.fetchone()['id']
    connection.commit()

    # Send SNS notification for attendance confirmation
    sns_message = {
        'notification_id': notification_id,
        'type': 'attendance_confirmation',
        'timetable_id': timetable_id,
        'subject': timetable['subject'],
        'date': str(timetable['date']),
        'time': f"{timetable['start_time']} - {timetable['end_time']}",
        'venue': f"{timetable['venue_name']} ({timetable['venue_location']})",
        'user_id': user_id,
        'user_type': user_type,
        'status': status
    }

    try:
        sns_response = sns_client.publish(
            TopicArn=sns_topic_arn,
            Message=json.dumps(sns_message),
            Subject=f"Attendance {status.title()}: {timetable['subject']}",
            MessageAttributes={
                'notification_type': {
                    'DataType': 'String',
                    'StringValue': 'attendance_confirmation'
                },
                'timetable_id': {
                    'DataType': 'String',
                    'StringValue': str(timetable_id)
                }
            }
        )

        return {
            'success': True,
            'message': 'Attendance confirmation recorded and notification sent',
            'attendance_id': attendance_id,
            'notification_id': notification_id,
            'sns_message_id': sns_response['MessageId']
        }

    except Exception as e:
        print(f"SNS Error: {str(e)}")
        return {
            'success': True,
            'message': 'Attendance recorded but notification failed',
            'attendance_id': attendance_id,
            'notification_id': notification_id,
            'error': str(e)
        }

def handle_class_reminder(cursor, sns_client, sns_topic_arn, request_data):
    """Handle class reminders"""

    timetable_id = request_data.get('timetable_id')
    reminder_type = request_data.get('reminder_type', '30min')  # '30min', '1hour', '1day'

    if not timetable_id:
        return {'error': 'Missing timetable_id'}

    # Get timetable details
    cursor.execute("""
        SELECT t.*, v.name as venue_name, v.location as venue_location
        FROM timetables t
        JOIN venues v ON t.venue_id = v.id
        WHERE t.id = %s
    """, (timetable_id,))

    timetable = cursor.fetchone()

    if not timetable:
        return {'error': 'Timetable not found'}

    # Create reminder message
    reminder_times = {
        '30min': '30 minutes',
        '1hour': '1 hour',
        '1day': '1 day'
    }

    reminder_message = f"""
    CLASS REMINDER - {reminder_times.get(reminder_type, '30 minutes')} before class

    Subject: {timetable['subject']}
    Lecturer: {timetable['lecturer']}
    Date: {timetable['date']}
    Time: {timetable['start_time']} - {timetable['end_time']}
    Venue: {timetable['venue_name']} ({timetable['venue_location']})

    Don't forget to attend your class!
    """

    # Send SNS notification
    sns_message = {
        'type': 'class_reminder',
        'timetable_id': timetable_id,
        'subject': timetable['subject'],
        'lecturer': timetable['lecturer'],
        'date': str(timetable['date']),
        'time': f"{timetable['start_time']} - {timetable['end_time']}",
        'venue': f"{timetable['venue_name']} ({timetable['venue_location']})",
        'reminder_type': reminder_type
    }

    try:
        sns_response = sns_client.publish(
            TopicArn=sns_topic_arn,
            Message=json.dumps(sns_message),
            Subject=f"Class Reminder: {timetable['subject']}",
            MessageAttributes={
                'notification_type': {
                    'DataType': 'String',
                    'StringValue': 'class_reminder'
                },
                'timetable_id': {
                    'DataType': 'String',
                    'StringValue': str(timetable_id)
                },
                'reminder_type': {
                    'DataType': 'String',
                    'StringValue': reminder_type
                }
            }
        )

        return {
            'success': True,
            'message': 'Class reminder sent successfully',
            'sns_message_id': sns_response['MessageId']
        }

    except Exception as e:
        print(f"SNS Error: {str(e)}")
        return {
            'success': False,
            'error': 'Failed to send class reminder via SNS'
        }