# CareLink Backend: Healthcare Server

Spring Boot based API server for authentication, health records, caregiver links, alerts, and personalized news.

## Tech Stack
- Java 21
- Spring Boot 3
- Spring Security
- Spring Data JPA
- PostgreSQL
- Gradle

## Run
```bash
cd backend/healthcare-server
./gradlew bootRun
```

Default port: `8080`

## Environment Variables
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `PASSWORD_RESET_TOKEN_EXPIRATION_MS`
- `NEWS_API_KEY`

## Auth Notes
- All APIs except `/api/auth/**` require a valid JWT.
- Password reset now uses a two-step flow.
- `POST /api/auth/forgot-password` returns a temporary `resetToken` after identity verification.
- `POST /api/auth/reset-password` requires `userId`, `newPassword`, and `resetToken`.

## Core APIs
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/vitals`
- `GET /api/vitals/summary?userId=<id>`
- `GET /api/vitals/insights?userId=<id>&range=7d|30d|365d`
- `POST /api/guardian/connect`
- `GET /api/news`
