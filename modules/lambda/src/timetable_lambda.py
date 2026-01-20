import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def lambda_handler(event, context):
    """
    Lambda function to handle timetable operations for EduTime
    - GET /timetables: Retrieve all timetables
    - GET /timetables/{id}: Retrieve specific timetable
    - GET /venues: Retrieve all venues
    - GET /venues/{id}: Retrieve specific venue
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
        query_parameters = event.get('queryStringParameters') or {}

        # Connect to database
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor(cursor_factory=RealDictCursor)

        # Route the request based on path and method
        if http_method == 'GET':
            if path.startswith('/api/timetables'):
                if 'id' in path_parameters:
                    # Get specific timetable
                    timetable_id = path_parameters['id']
                    result = get_timetable_by_id(cursor, timetable_id)
                else:
                    # Get all timetables
                    result = get_all_timetables(cursor, query_parameters)

            elif path.startswith('/api/venues'):
                if 'id' in path_parameters:
                    # Get specific venue
                    venue_id = path_parameters['id']
                    result = get_venue_by_id(cursor, venue_id)
                else:
                    # Get all venues
                    result = get_all_venues(cursor, query_parameters)
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
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
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

def get_all_timetables(cursor, query_params):
    """Retrieve all timetables with optional filtering"""

    base_query = """
        SELECT t.*, v.name as venue_name, v.capacity, v.location
        FROM timetables t
        LEFT JOIN venues v ON t.venue_id = v.id
    """

    conditions = []
    params = []

    # Add filtering based on query parameters
    if query_params.get('class_rep'):
        conditions.append("t.class_rep = %s")
        params.append(query_params['class_rep'])

    if query_params.get('lecturer'):
        conditions.append("t.lecturer = %s")
        params.append(query_params['lecturer'])

    if query_params.get('date'):
        conditions.append("t.date = %s")
        params.append(query_params['date'])

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    base_query += " ORDER BY t.date, t.start_time"

    cursor.execute(base_query, params)
    timetables = cursor.fetchall()

    return {'timetables': [dict(row) for row in timetables]}

def get_timetable_by_id(cursor, timetable_id):
    """Retrieve specific timetable by ID"""

    query = """
        SELECT t.*, v.name as venue_name, v.capacity, v.location
        FROM timetables t
        LEFT JOIN venues v ON t.venue_id = v.id
        WHERE t.id = %s
    """

    cursor.execute(query, (timetable_id,))
    timetable = cursor.fetchone()

    if timetable:
        return {'timetable': dict(timetable)}
    else:
        return {'error': 'Timetable not found'}

def get_all_venues(cursor, query_params):
    """Retrieve all venues with optional filtering"""

    base_query = """
        SELECT v.*,
               COUNT(t.id) as scheduled_sessions,
               CASE WHEN COUNT(t.id) > 0 THEN true ELSE false END as is_occupied
        FROM venues v
        LEFT JOIN timetables t ON v.id = t.venue_id
            AND t.date = CURRENT_DATE
            AND CURRENT_TIME BETWEEN t.start_time AND t.end_time
        GROUP BY v.id
    """

    conditions = []
    params = []

    # Add filtering based on query parameters
    if query_params.get('available_only') == 'true':
        conditions.append("COUNT(t.id) = 0")

    if query_params.get('min_capacity'):
        conditions.append("v.capacity >= %s")
        params.append(int(query_params['min_capacity']))

    if conditions:
        base_query += " HAVING " + " AND ".join(conditions)

    base_query += " ORDER BY v.name"

    cursor.execute(base_query, params)
    venues = cursor.fetchall()

    return {'venues': [dict(row) for row in venues]}

def get_venue_by_id(cursor, venue_id):
    """Retrieve specific venue by ID with current schedule"""

    query = """
        SELECT v.*,
               json_agg(
                   json_build_object(
                       'id', t.id,
                       'subject', t.subject,
                       'lecturer', t.lecturer,
                       'date', t.date,
                       'start_time', t.start_time,
                       'end_time', t.end_time,
                       'class_rep', t.class_rep
                   )
               ) FILTER (WHERE t.id IS NOT NULL) as scheduled_sessions
        FROM venues v
        LEFT JOIN timetables t ON v.id = t.venue_id
            AND t.date >= CURRENT_DATE
        WHERE v.id = %s
        GROUP BY v.id
    """

    cursor.execute(query, (venue_id,))
    venue = cursor.fetchone()

    if venue:
        return {'venue': dict(venue)}
    else:
        return {'error': 'Venue not found'}