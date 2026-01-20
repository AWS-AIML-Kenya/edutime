-- EduTime Database Schema
-- PostgreSQL 15.7

-- Create the database (if not exists)
-- This is typically done outside of this script
-- CREATE DATABASE edutime;

-- Connect to the edutime database
-- \c edutime;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    facilities TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Timetables table
CREATE TABLE IF NOT EXISTS timetables (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    lecturer VARCHAR(255) NOT NULL,
    class_rep VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed', 'in_progress')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance confirmations table
CREATE TABLE IF NOT EXISTS attendance_confirmations (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER REFERENCES timetables(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('student', 'class_rep', 'lecturer')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'declined', 'maybe')),
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timetable_id, user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER REFERENCES timetables(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('venue_change', 'attendance_confirmation', 'class_reminder', 'cancellation')),
    message TEXT NOT NULL,
    recipients JSONB NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for future authentication features)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'class_rep', 'lecturer', 'admin')),
    phone_number VARCHAR(20),
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_timetables_date ON timetables(date);
CREATE INDEX IF NOT EXISTS idx_timetables_venue_id ON timetables(venue_id);
CREATE INDEX IF NOT EXISTS idx_timetables_lecturer ON timetables(lecturer);
CREATE INDEX IF NOT EXISTS idx_timetables_class_rep ON timetables(class_rep);
CREATE INDEX IF NOT EXISTS idx_timetables_datetime ON timetables(date, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
CREATE INDEX IF NOT EXISTS idx_venues_capacity ON venues(capacity);

CREATE INDEX IF NOT EXISTS idx_attendance_timetable_id ON attendance_confirmations(timetable_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_confirmations(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_timetable_id ON notifications(timetable_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create triggers for updating updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetables_updated_at BEFORE UPDATE ON timetables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample venues
INSERT INTO venues (name, location, capacity, facilities) VALUES
('Main Auditorium', 'Academic Block A - Ground Floor', 300, 'Projector, Audio System, Air Conditioning, WiFi'),
('Computer Lab 1', 'IT Block - 1st Floor', 40, 'Computers, Projector, Air Conditioning, WiFi'),
('Computer Lab 2', 'IT Block - 2nd Floor', 40, 'Computers, Projector, Air Conditioning, WiFi'),
('Lecture Hall 101', 'Academic Block B - 1st Floor', 100, 'Projector, Whiteboard, Air Conditioning, WiFi'),
('Lecture Hall 102', 'Academic Block B - 1st Floor', 100, 'Projector, Whiteboard, Air Conditioning, WiFi'),
('Lecture Hall 201', 'Academic Block B - 2nd Floor', 80, 'Projector, Whiteboard, Air Conditioning, WiFi'),
('Lecture Hall 202', 'Academic Block B - 2nd Floor', 80, 'Projector, Whiteboard, Air Conditioning, WiFi'),
('Seminar Room 1', 'Academic Block C - Ground Floor', 30, 'TV Screen, Whiteboard, Air Conditioning, WiFi'),
('Seminar Room 2', 'Academic Block C - 1st Floor', 30, 'TV Screen, Whiteboard, Air Conditioning, WiFi'),
('Conference Room', 'Administration Block - 2nd Floor', 20, 'Conference Table, Projector, Video Conferencing, WiFi'),
('Physics Lab', 'Science Block - 1st Floor', 25, 'Lab Equipment, Fume Hoods, Safety Equipment'),
('Chemistry Lab', 'Science Block - 2nd Floor', 25, 'Lab Equipment, Fume Hoods, Safety Equipment'),
('Library Study Hall', 'Library Building - 1st Floor', 60, 'Study Tables, Silent Environment, WiFi'),
('Sports Complex Hall', 'Sports Complex', 200, 'Audio System, Projector, Air Conditioning')
ON CONFLICT DO NOTHING;

-- Insert sample users
INSERT INTO users (user_id, email, full_name, role, phone_number) VALUES
('REP001', 'john.smith@student.edutime.edu', 'John Smith', 'class_rep', '+1234567890'),
('REP002', 'sarah.johnson@student.edutime.edu', 'Sarah Johnson', 'class_rep', '+1234567891'),
('REP003', 'mike.davis@student.edutime.edu', 'Mike Davis', 'class_rep', '+1234567892'),
('LEC001', 'dr.wilson@edutime.edu', 'Dr. Emily Wilson', 'lecturer', '+1234567893'),
('LEC002', 'prof.brown@edutime.edu', 'Prof. Robert Brown', 'lecturer', '+1234567894'),
('LEC003', 'dr.garcia@edutime.edu', 'Dr. Maria Garcia', 'lecturer', '+1234567895'),
('LEC004', 'prof.lee@edutime.edu', 'Prof. David Lee', 'lecturer', '+1234567896'),
('ADMIN001', 'admin@edutime.edu', 'System Administrator', 'admin', '+1234567897')
ON CONFLICT DO NOTHING;

-- Insert sample timetables
INSERT INTO timetables (subject, lecturer, class_rep, date, start_time, end_time, venue_id, notes) VALUES
('Computer Science 101', 'Dr. Emily Wilson', 'John Smith', CURRENT_DATE + INTERVAL '1 day', '09:00', '10:30', 2, 'Introduction to Programming'),
('Mathematics 201', 'Prof. Robert Brown', 'Sarah Johnson', CURRENT_DATE + INTERVAL '1 day', '11:00', '12:30', 4, 'Calculus II'),
('Physics 101', 'Dr. Maria Garcia', 'Mike Davis', CURRENT_DATE + INTERVAL '1 day', '14:00', '15:30', 11, 'Classical Mechanics Lab'),
('Database Systems', 'Prof. David Lee', 'John Smith', CURRENT_DATE + INTERVAL '2 days', '10:00', '11:30', 2, 'SQL and Relational Databases'),
('English Literature', 'Dr. Emily Wilson', 'Sarah Johnson', CURRENT_DATE + INTERVAL '2 days', '15:00', '16:30', 8, 'Modern Poetry Analysis'),
('Chemistry 102', 'Dr. Maria Garcia', 'Mike Davis', CURRENT_DATE + INTERVAL '3 days', '13:00', '15:00', 12, 'Organic Chemistry Lab')
ON CONFLICT DO NOTHING;

-- Create a view for convenient timetable queries with venue information
CREATE OR REPLACE VIEW timetable_details AS
SELECT
    t.*,
    v.name as venue_name,
    v.location as venue_location,
    v.capacity as venue_capacity,
    v.facilities as venue_facilities,
    -- Calculate if the class is currently happening
    CASE
        WHEN t.date = CURRENT_DATE
        AND CURRENT_TIME BETWEEN t.start_time AND t.end_time
        THEN true
        ELSE false
    END as is_current_class,
    -- Calculate if the class is upcoming today
    CASE
        WHEN t.date = CURRENT_DATE
        AND CURRENT_TIME < t.start_time
        THEN true
        ELSE false
    END as is_upcoming_today
FROM timetables t
LEFT JOIN venues v ON t.venue_id = v.id;

-- Create a function to check venue conflicts
CREATE OR REPLACE FUNCTION check_venue_conflict(
    p_venue_id INTEGER,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_timetable_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM timetables
    WHERE venue_id = p_venue_id
    AND date = p_date
    AND status != 'cancelled'
    AND (p_exclude_timetable_id IS NULL OR id != p_exclude_timetable_id)
    AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
    );

    RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to the database user
-- Replace 'edutime_admin' with your actual database user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edutime_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edutime_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO edutime_admin;