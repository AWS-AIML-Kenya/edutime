import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, time

def lambda_handler(event, context):
    """
    Lambda function to handle venue management operations for EduTime
    - POST /venues/check-conflicts: Check for venue conflicts
    - PUT /timetables/{id}/venue: Update venue assignment
    - POST /timetables: Create new timetable entry
    - PUT /timetables/{id}: Update existing timetable
    - DELETE /timetables/{id}: Cancel timetable entry
    """

    # Database connection parameters
    db_params = {
        'host': os.environ['DB_HOST'],
        'port': os.environ['DB_PORT'],
        'database': os.environ['DB_NAME'],
        'user': 'edutime_admin',
        'password': os.environ['DB_PASSWORD']
    }

    try:
        # Parse the incoming event
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}

        # Connect to database
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor(cursor_factory=RealDictCursor)

        # Route the request based on path and method
        if http_method == 'POST':
            if path == '/api/venues/check-conflicts':
                result = check_venue_conflicts(cursor, body)
            elif path == '/api/timetables':
                result = create_timetable(cursor, connection, body)
            else:
                result = {'error': 'Path not found'}

        elif http_method == 'PUT':
            if path.startswith('/api/timetables/') and path.endswith('/venue'):
                timetable_id = path_parameters.get('id')
                result = update_venue_assignment(cursor, connection, timetable_id, body)
            elif path.startswith('/api/timetables/'):
                timetable_id = path_parameters.get('id')
                result = update_timetable(cursor, connection, timetable_id, body)
            else:
                result = {'error': 'Path not found'}

        elif http_method == 'DELETE':
            if path.startswith('/api/timetables/'):
                timetable_id = path_parameters.get('id')
                result = delete_timetable(cursor, connection, timetable_id)
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
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
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

def check_venue_conflicts(cursor, request_data):
    """Check for venue conflicts for a given time slot"""

    venue_id = request_data.get('venue_id')
    date = request_data.get('date')
    start_time = request_data.get('start_time')
    end_time = request_data.get('end_time')
    exclude_timetable_id = request_data.get('exclude_timetable_id')

    if not all([venue_id, date, start_time, end_time]):
        return {'error': 'Missing required parameters'}

    # Check for conflicts
    query = """
        SELECT t.*, v.name as venue_name
        FROM timetables t
        JOIN venues v ON t.venue_id = v.id
        WHERE t.venue_id = %s
        AND t.date = %s
        AND (
            (t.start_time <= %s AND t.end_time > %s) OR
            (t.start_time < %s AND t.end_time >= %s) OR
            (t.start_time >= %s AND t.end_time <= %s)
        )
    """

    params = [venue_id, date, start_time, start_time, end_time, end_time, start_time, end_time]

    if exclude_timetable_id:
        query += " AND t.id != %s"
        params.append(exclude_timetable_id)

    cursor.execute(query, params)
    conflicts = cursor.fetchall()

    if conflicts:
        return {
            'has_conflicts': True,
            'conflicts': [dict(row) for row in conflicts]
        }
    else:
        return {'has_conflicts': False}

def create_timetable(cursor, connection, request_data):
    """Create a new timetable entry"""

    required_fields = ['subject', 'lecturer', 'class_rep', 'date', 'start_time', 'end_time', 'venue_id']

    for field in required_fields:
        if field not in request_data:
            return {'error': f'Missing required field: {field}'}

    # First check for conflicts
    conflict_check = check_venue_conflicts(cursor, request_data)
    if conflict_check.get('has_conflicts'):
        return {
            'error': 'Venue conflict detected',
            'conflicts': conflict_check['conflicts']
        }

    # Insert new timetable entry
    query = """
        INSERT INTO timetables (subject, lecturer, class_rep, date, start_time, end_time, venue_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING *
    """

    params = [
        request_data['subject'],
        request_data['lecturer'],
        request_data['class_rep'],
        request_data['date'],
        request_data['start_time'],
        request_data['end_time'],
        request_data['venue_id']
    ]

    cursor.execute(query, params)
    new_timetable = cursor.fetchone()
    connection.commit()

    return {
        'success': True,
        'message': 'Timetable created successfully',
        'timetable': dict(new_timetable)
    }

def update_venue_assignment(cursor, connection, timetable_id, request_data):
    """Update venue assignment for a timetable entry"""

    new_venue_id = request_data.get('venue_id')
    if not new_venue_id:
        return {'error': 'Missing venue_id'}

    # Get current timetable details
    cursor.execute("SELECT * FROM timetables WHERE id = %s", (timetable_id,))
    current_timetable = cursor.fetchone()

    if not current_timetable:
        return {'error': 'Timetable not found'}

    # Check for conflicts with new venue
    conflict_data = {
        'venue_id': new_venue_id,
        'date': current_timetable['date'].isoformat(),
        'start_time': current_timetable['start_time'].strftime('%H:%M'),
        'end_time': current_timetable['end_time'].strftime('%H:%M'),
        'exclude_timetable_id': timetable_id
    }

    conflict_check = check_venue_conflicts(cursor, conflict_data)
    if conflict_check.get('has_conflicts'):
        return {
            'error': 'New venue has conflicts',
            'conflicts': conflict_check['conflicts']
        }

    # Update venue assignment
    query = "UPDATE timetables SET venue_id = %s, updated_at = NOW() WHERE id = %s RETURNING *"
    cursor.execute(query, (new_venue_id, timetable_id))
    updated_timetable = cursor.fetchone()
    connection.commit()

    return {
        'success': True,
        'message': 'Venue updated successfully',
        'timetable': dict(updated_timetable)
    }

def update_timetable(cursor, connection, timetable_id, request_data):
    """Update an existing timetable entry"""

    if not timetable_id:
        return {'error': 'Missing timetable ID'}

    # Get current timetable
    cursor.execute("SELECT * FROM timetables WHERE id = %s", (timetable_id,))
    current_timetable = cursor.fetchone()

    if not current_timetable:
        return {'error': 'Timetable not found'}

    # Build update query dynamically
    update_fields = []
    params = []

    allowed_fields = ['subject', 'lecturer', 'class_rep', 'date', 'start_time', 'end_time', 'venue_id']

    for field in allowed_fields:
        if field in request_data:
            update_fields.append(f"{field} = %s")
            params.append(request_data[field])

    if not update_fields:
        return {'error': 'No fields to update'}

    # If time or venue is being updated, check for conflicts
    if any(field in request_data for field in ['date', 'start_time', 'end_time', 'venue_id']):
        conflict_data = {
            'venue_id': request_data.get('venue_id', current_timetable['venue_id']),
            'date': request_data.get('date', current_timetable['date'].isoformat()),
            'start_time': request_data.get('start_time', current_timetable['start_time'].strftime('%H:%M')),
            'end_time': request_data.get('end_time', current_timetable['end_time'].strftime('%H:%M')),
            'exclude_timetable_id': timetable_id
        }

        conflict_check = check_venue_conflicts(cursor, conflict_data)
        if conflict_check.get('has_conflicts'):
            return {
                'error': 'Update would create conflicts',
                'conflicts': conflict_check['conflicts']
            }

    # Perform update
    update_fields.append("updated_at = NOW()")
    params.append(timetable_id)

    query = f"UPDATE timetables SET {', '.join(update_fields)} WHERE id = %s RETURNING *"
    cursor.execute(query, params)
    updated_timetable = cursor.fetchone()
    connection.commit()

    return {
        'success': True,
        'message': 'Timetable updated successfully',
        'timetable': dict(updated_timetable)
    }

def delete_timetable(cursor, connection, timetable_id):
    """Delete a timetable entry"""

    if not timetable_id:
        return {'error': 'Missing timetable ID'}

    # Check if timetable exists
    cursor.execute("SELECT * FROM timetables WHERE id = %s", (timetable_id,))
    timetable = cursor.fetchone()

    if not timetable:
        return {'error': 'Timetable not found'}

    # Delete the timetable
    cursor.execute("DELETE FROM timetables WHERE id = %s", (timetable_id,))
    connection.commit()

    return {
        'success': True,
        'message': 'Timetable deleted successfully',
        'deleted_timetable': dict(timetable)
    }