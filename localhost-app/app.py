from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime, time

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'edutime'),
    'user': os.getenv('DB_USER', 'edutime_admin'),
    'password': os.getenv('DB_PASSWORD', '')
}

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG)

def handle_db_error(func):
    """Decorator to handle database errors"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except psycopg2.Error as e:
            print(f"Database error: {e}")
            return jsonify({'error': 'Database error occurred'}), 500
        except Exception as e:
            print(f"Unexpected error: {e}")
            return jsonify({'error': 'Internal server error'}), 500
    wrapper.__name__ = func.__name__
    return wrapper

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# ============================================================================
# TIMETABLE ENDPOINTS (Read Operations)
# ============================================================================

@app.route('/api/timetables', methods=['GET'])
@handle_db_error
def get_all_timetables():
    """Get all timetables with optional filtering"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    base_query = """
        SELECT t.*, v.name as venue_name, v.capacity, v.location
        FROM timetables t
        LEFT JOIN venues v ON t.venue_id = v.id
    """
    
    conditions = []
    params = []
    
    # Add filtering based on query parameters
    if request.args.get('class_rep'):
        conditions.append("t.class_rep = %s")
        params.append(request.args.get('class_rep'))
    
    if request.args.get('lecturer'):
        conditions.append("t.lecturer = %s")
        params.append(request.args.get('lecturer'))
    
    if request.args.get('date'):
        conditions.append("t.date = %s")
        params.append(request.args.get('date'))
    
    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)
    
    base_query += " ORDER BY t.date, t.start_time"
    
    cursor.execute(base_query, params)
    timetables = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return jsonify({'timetables': [dict(row) for row in timetables]})

@app.route('/api/timetables/<int:timetable_id>', methods=['GET'])
@handle_db_error
def get_timetable_by_id(timetable_id):
    """Get specific timetable by ID"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
        SELECT t.*, v.name as venue_name, v.capacity, v.location
        FROM timetables t
        LEFT JOIN venues v ON t.venue_id = v.id
        WHERE t.id = %s
    """
    
    cursor.execute(query, (timetable_id,))
    timetable = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    if timetable:
        return jsonify({'timetable': dict(timetable)})
    else:
        return jsonify({'error': 'Timetable not found'}), 404

@app.route('/api/venues', methods=['GET'])
@handle_db_error
def get_all_venues():
    """Get all venues with optional filtering"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
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
    if request.args.get('available_only') == 'true':
        conditions.append("COUNT(t.id) = 0")
    
    if request.args.get('min_capacity'):
        conditions.append("v.capacity >= %s")
        params.append(int(request.args.get('min_capacity')))
    
    if conditions:
        base_query += " HAVING " + " AND ".join(conditions)
    
    base_query += " ORDER BY v.name"
    
    cursor.execute(base_query, params)
    venues = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return jsonify({'venues': [dict(row) for row in venues]})

@app.route('/api/venues/<int:venue_id>', methods=['GET'])
@handle_db_error
def get_venue_by_id(venue_id):
    """Get specific venue by ID with current schedule"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
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
    
    cursor.close()
    conn.close()
    
    if venue:
        return jsonify({'venue': dict(venue)})
    else:
        return jsonify({'error': 'Venue not found'}), 404

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)

# ============================================================================
# VENUE MANAGEMENT ENDPOINTS (Write Operations)
# ============================================================================

@app.route('/api/venues/check-conflicts', methods=['POST'])
@handle_db_error
def check_venue_conflicts():
    """Check for venue conflicts"""
    data = request.get_json()
    
    venue_id = data.get('venue_id')
    date = data.get('date')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    exclude_timetable_id = data.get('exclude_timetable_id')
    
    if not all([venue_id, date, start_time, end_time]):
        return jsonify({'error': 'Missing required parameters'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check for conflicts
    query = """
        SELECT t.*, v.name as venue_name
        FROM timetables t
        JOIN venues v ON t.venue_id = v.id
        WHERE t.venue_id = %s
        AND t.date = %s
        AND t.status != 'cancelled'
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
    
    cursor.close()
    conn.close()
    
    if conflicts:
        return jsonify({
            'has_conflicts': True,
            'conflicts': [dict(row) for row in conflicts]
        })
    else:
        return jsonify({'has_conflicts': False})

@app.route('/api/timetables', methods=['POST'])
@handle_db_error
def create_timetable():
    """Create a new timetable entry"""
    data = request.get_json()
    
    required_fields = ['subject', 'lecturer', 'class_rep', 'date', 'start_time', 'end_time', 'venue_id']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # First check for conflicts
    conflict_data = {
        'venue_id': data['venue_id'],
        'date': data['date'],
        'start_time': data['start_time'],
        'end_time': data['end_time']
    }
    
    # Check conflicts using the same logic
    query = """
        SELECT COUNT(*) as conflict_count
        FROM timetables t
        WHERE t.venue_id = %s
        AND t.date = %s
        AND t.status != 'cancelled'
        AND (
            (t.start_time <= %s AND t.end_time > %s) OR
            (t.start_time < %s AND t.end_time >= %s) OR
            (t.start_time >= %s AND t.end_time <= %s)
        )
    """
    
    params = [
        data['venue_id'], data['date'], 
        data['start_time'], data['start_time'],
        data['end_time'], data['end_time'],
        data['start_time'], data['end_time']
    ]
    
    cursor.execute(query, params)
    conflict_count = cursor.fetchone()['conflict_count']
    
    if conflict_count > 0:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Venue conflict detected'}), 409
    
    # Insert new timetable entry
    insert_query = """
        INSERT INTO timetables (subject, lecturer, class_rep, date, start_time, end_time, venue_id, notes, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING *
    """
    
    insert_params = [
        data['subject'],
        data['lecturer'],
        data['class_rep'],
        data['date'],
        data['start_time'],
        data['end_time'],
        data['venue_id'],
        data.get('notes', '')
    ]
    
    cursor.execute(insert_query, insert_params)
    new_timetable = cursor.fetchone()
    conn.commit()
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Timetable created successfully',
        'timetable': dict(new_timetable)
    }), 201

@app.route('/api/timetables/<int:timetable_id>', methods=['PUT'])
@handle_db_error
def update_timetable(timetable_id):
    """Update an existing timetable entry"""
    data = request.get_json()
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get current timetable
    cursor.execute("SELECT * FROM timetables WHERE id = %s", (timetable_id,))
    current_timetable = cursor.fetchone()
    
    if not current_timetable:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Timetable not found'}), 404
    
    # Build update query dynamically
    update_fields = []
    params = []
    
    allowed_fields = ['subject', 'lecturer', 'class_rep', 'date', 'start_time', 'end_time', 'venue_id', 'notes', 'status']
    
    for field in allowed_fields:
        if field in data:
            update_fields.append(f"{field} = %s")
            params.append(data[field])
    
    if not update_fields:
        cursor.close()
        conn.close()
        return jsonify({'error': 'No fields to update'}), 400
    
    # If time or venue is being updated, check for conflicts
    if any(field in data for field in ['date', 'start_time', 'end_time', 'venue_id']):
        conflict_venue_id = data.get('venue_id', current_timetable['venue_id'])
        conflict_date = data.get('date', current_timetable['date'])
        conflict_start = data.get('start_time', current_timetable['start_time'])
        conflict_end = data.get('end_time', current_timetable['end_time'])
        
        # Convert date and time objects to strings if needed
        if hasattr(conflict_date, 'isoformat'):
            conflict_date = conflict_date.isoformat()
        if hasattr(conflict_start, 'strftime'):
            conflict_start = conflict_start.strftime('%H:%M')
        if hasattr(conflict_end, 'strftime'):
            conflict_end = conflict_end.strftime('%H:%M')
        
        conflict_query = """
            SELECT COUNT(*) as conflict_count
            FROM timetables t
            WHERE t.venue_id = %s
            AND t.date = %s
            AND t.status != 'cancelled'
            AND t.id != %s
            AND (
                (t.start_time <= %s AND t.end_time > %s) OR
                (t.start_time < %s AND t.end_time >= %s) OR
                (t.start_time >= %s AND t.end_time <= %s)
            )
        """
        
        conflict_params = [
            conflict_venue_id, conflict_date, timetable_id,
            conflict_start, conflict_start,
            conflict_end, conflict_end,
            conflict_start, conflict_end
        ]
        
        cursor.execute(conflict_query, conflict_params)
        conflict_count = cursor.fetchone()['conflict_count']
        
        if conflict_count > 0:
    