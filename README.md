# User Authentication System using JWT

A simple and clean user authentication system built with Node.js, Express.js, Prisma, PostgreSQL, bcrypt, and JSON Web Tokens (JWT).

This project allows users to register, log in, and access protected profile and dashboard endpoints using bearer tokens.

---

## Technologies Used

- **Node.js** - JavaScript runtime environment
- **Express.js** - Web framework for building REST APIs
- **Prisma** - Next-generation ORM for interacting with PostgreSQL
- **PostgreSQL** - Relational database
- **bcrypt** - Password hashing (10 salt rounds)
- **jsonwebtoken (JWT)** - Token generation and authentication
- **Node.js crypto** - Unique JWT ID (`jti`) generation

---

## Project Structure

```
asd_lab_assignment/
├── prisma/
│   └── schema.prisma        # Prisma schema defining the User model
├── src/
│   ├── middleware/
│   │   └── auth.js          # JWT authentication middleware (requireAuth)
│   ├── prisma.js            # Prisma client instance
│   └── server.js            # Express application and API routes
├── .env.example             # Example environment variables
├── .gitignore               # Ignored files (node_modules, .env)
├── package.json             # Project dependencies and scripts
├── test.js                  # Automated test script
└── README.md                # Project documentation
```

---

## Database Model

The `User` model is defined in `prisma/schema.prisma`:

| Field | Type | Description |
|---|---|---|
| `id` | `Int` | Unique user ID (Auto-increment primary key) |
| `email` | `String` | Unique user email (cleaned and lowercased) |
| `password` | `String` | Hashed password using bcrypt |
| `name` | `String?` | Optional user name |
| `createdAt` | `DateTime` | Account creation timestamp (defaults to current time) |

---

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/KabeerSingh28/asd_lab_assignment.git
cd asd_lab_assignment
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root folder based on `.env.example`:

```bash
cp .env.example .env
```

Update `.env` with your PostgreSQL credentials and JWT secret:

```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"
JWTSECRET="your_jwt_secret_key_here"
```

### 4. Set up the database with Prisma

Push the schema to your PostgreSQL database:

```bash
npx prisma db push
```

Generate the Prisma Client:

```bash
npx prisma generate
```

---

## Running the Application

### Start the development server (with auto-restart)

```bash
npm run dev
```

### Start the production server

```bash
npm start
```

The server will start at `http://localhost:3000`.

### Run automated tests

```bash
npm test
```

This executes the automated test suite testing all 5 APIs for both successful and failure/edge cases.

---

## API Documentation and Examples

### 1. Register User

- **Method:** `POST`
- **Endpoint:** `/signup`
- **Description:** Registers a new user with cleaned email and hashed password (10 rounds). Returns user details (excluding password) and a 1-hour JWT containing `id`, `email`, and a unique `jti`.

**Request:**
```bash
curl -X POST http://localhost:3000/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "mypassword123",
    "name": "Kabeer Singh"
  }'
```

**Success Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "name": "Kabeer Singh",
    "createdAt": "2026-11-24T05:40:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. User Login

- **Method:** `POST`
- **Endpoint:** `/login`
- **Description:** Authenticates user credentials. Returns the same generic error for wrong email or wrong password to prevent user enumeration.

**Request:**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "mypassword123"
  }'
```

**Success Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "name": "Kabeer Singh"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. Authentication Middleware (`requireAuth`)

- Protects private routes.
- Expects header in format: `Authorization: Bearer <token>`.
- Returns `401 Unauthorized` if the token is missing, invalid, or expired.
- Decodes the token and attaches payload to `req.user`.

---

### 4. Get Current User Profile (Protected)

- **Method:** `GET`
- **Endpoint:** `/me`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Fetches current user profile from database using ID in the verified token. Never exposes password hash.

**Request:**
```bash
curl -X GET http://localhost:3000/me \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "email": "student@example.com",
    "name": "Kabeer Singh",
    "createdAt": "2026-11-24T05:40:00.000Z"
  }
}
```

---

### 5. User Dashboard (Protected)

- **Method:** `GET`
- **Endpoint:** `/dashboard`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Greets the authenticated user by name if available, otherwise falls back to their email.

**Request:**
```bash
curl -X GET http://localhost:3000/dashboard \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Success Response (200 OK):**
```json
{
  "message": "Welcome to your dashboard, Kabeer Singh!",
  "user": {
    "name": "Kabeer Singh",
    "email": "student@example.com"
  }
}
```

---

## Test Scenarios Covered

The automated test suite (`npm test`) verifies:

1. Registering a new user with all fields.
2. Registering without an optional name.
3. Rejecting registration when email is already registered (`400`).
4. Rejecting registration when password is less than 6 characters (`400`).
5. Rejecting registration with invalid email format (`400`).
6. Logging in with valid credentials (`200`).
7. Rejecting login with incorrect password (`401`).
8. Rejecting login with non-existent email (`401` with identical error message).
9. Accessing protected `/me` endpoint with a valid token (`200`).
10. Accessing protected `/me` endpoint without a token (`401`).
11. Accessing protected `/me` endpoint with an invalid or expired token (`401`).
12. Accessing `/dashboard` showing personalized user name (`200`).
13. Accessing `/dashboard` falling back to email when name is not provided (`200`).
14. Verifying JWT payload structure (`id`, `email`, and `jti`).
