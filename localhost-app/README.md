# EduTime Web Application

A modern TypeScript/Node.js web application for timetable and venue management in educational institutions, built with Express.js and Prisma ORM.

## Features

- **Timetable Management**: Create, update, and manage class schedules
- **Venue Management**: Track venue availability and capacity
- **Conflict Detection**: Automatic venue conflict checking
- **User Management**: Support for students, lecturers, class representatives, and administrators
- **Notifications**: Built-in notification system for schedule changes
- **RESTful API**: Clean, well-documented API endpoints
- **Type Safety**: Full TypeScript support with Zod validation
- **Database**: PostgreSQL with Prisma ORM

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Security**: Helmet, CORS
- **Development**: tsx, ESLint

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- npm or yarn

## Installation

1. **Clone and navigate to the project**:
   ```bash
   cd localhost-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database credentials:
   ```env
   DATABASE_URL="postgresql://edutime_admin:your_password@localhost:5432/edutime?schema=public"
   NODE_ENV=development
   PORT=5000
   CORS_ORIGIN=http://localhost:3000
   API_PREFIX=/api/v1
   ```

4. **Set up the database**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

## Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with database stats

### Timetables
- `GET /api/v1/timetables` - Get all timetables (with filtering)
- `GET /api/v1/timetables/:id` - Get timetable by ID
- `POST /api/v1/timetables` - Create new timetable
- `PUT /api/v1/timetables/:id` - Update timetable
- `DELETE /api/v1/timetables/:id` - Delete timetable
- `POST /api/v1/timetables/check-conflicts` - Check venue conflicts

### Venues
- `GET /api/v1/venues` - Get all venues (with filtering)
- `GET /api/v1/venues/:id` - Get venue by ID
- `POST /api/v1/venues` - Create new venue
- `PUT /api/v1/venues/:id` - Update venue
- `DELETE /api/v1/venues/:id` - Delete venue
- `GET /api/v1/venues/:id/availability/:date` - Get venue availability

### Users
- `GET /api/v1/users` - Get all users (with filtering)
- `GET /api/v1/users/:id` - Get user by ID
- `GET /api/v1/users/by-user-id/:userId` - Get user by external ID
- `POST /api/v1/users` - Create new user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user
- `GET /api/v1/users/by-role/:role` - Get users by role

### Notifications
- `GET /api/v1/notifications` - Get all notifications (with filtering)
- `GET /api/v1/notifications/:id` - Get notification by ID
- `POST /api/v1/notifications` - Create new notification
- `PATCH /api/v1/notifications/:id/status` - Update notification status
- `DELETE /api/v1/notifications/:id` - Delete notification
- `GET /api/v1/notifications/timetable/:timetableId` - Get notifications for timetable
- `PATCH /api/v1/notifications/bulk-update-status` - Bulk update notification status

## Query Parameters

### Timetables
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `classRep` - Filter by class representative
- `lecturer` - Filter by lecturer
- `date` - Filter by specific date (YYYY-MM-DD)
- `venueId` - Filter by venue ID
- `status` - Filter by status (scheduled, cancelled, completed, in_progress)
- `startDate` - Filter from date (YYYY-MM-DD)
- `endDate` - Filter to date (YYYY-MM-DD)

### Venues
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `availableOnly` - Show only available venues (true/false)
- `minCapacity` - Minimum capacity required
- `search` - Search in name, location, or facilities

## Database Schema

The application uses the following main entities:

- **Venues**: Physical locations with capacity and facilities
- **Timetables**: Scheduled classes with time, venue, and participants
- **Users**: System users (students, lecturers, class reps, admins)
- **Notifications**: System notifications for schedule changes
- **AttendanceConfirmations**: Attendance tracking for classes

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

## Validation

All API endpoints use Zod schemas for request validation:
- Request body validation
- Query parameter validation
- URL parameter validation
- Type-safe responses

## Security Features

- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization
- SQL injection prevention via Prisma
- Environment variable protection

## Migration from Python/Flask

This TypeScript version replaces the previous Python/Flask implementation with:

- **Better Type Safety**: Full TypeScript support
- **Modern ORM**: Prisma instead of raw SQL
- **Improved Validation**: Zod schemas for all inputs
- **Better Error Handling**: Consistent error responses
- **Enhanced Security**: Modern security practices
- **Developer Experience**: Hot reload, better tooling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

## License

MIT License - see LICENSE file for details