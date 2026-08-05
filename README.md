# BuildTrack Backend

BuildTrack Backend is the API layer for the BuildTrack construction site management system. It handles authentication, project management, laborer records, attendance tracking, daily reports, and analytics for site operations.

## Features

- User authentication and authorization
- Project management
- Laborer management
- Attendance tracking
- Daily site reporting
- Analytics endpoints
- Image upload support for reports and site assets
- PostgreSQL data persistence

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- JWT authentication
- Multer for file uploads
- CORS support

## Project Structure

```bash
.
├── config/
│   ├── db.js
│   └── migrate.js
├── controllers/
├── middleware/
├── routes/
├── services/
├── uploads/
├── .env.example
├── package.json
├── server.js
└── README.md
```

## Prerequisites

Before running the app, make sure you have:

- Node.js installed
- PostgreSQL database running
- npm or yarn installed

## Installation

1. Clone the repository
2. Navigate to the backend folder
3. Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the backend root with the following values:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buildtrack
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

## Run the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Database Migration

```bash
npm run migrate
```

## API Health Check

The API exposes a health endpoint:

```bash
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "service": "BuildTrack API"
}
```

## Main API Routes

- `/api/auth` - authentication routes
- `/api/projects` - project routes
- `/api/reports` - report routes
- `/api/laborers` - laborer routes
- `/api/attendance` - attendance routes
- `/api/analytics` - analytics routes
- `/uploads` - uploaded media files

## Notes

- Uploaded files are served from the `uploads` directory.
- The app expects a PostgreSQL database connection configured through environment variables.
- CORS is enabled for the frontend URL defined in `CLIENT_URL`.

## License

This project is currently provided as an internal application and does not include a specific license file yet.
