import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from './prisma.js';
import { requireAuth } from './middleware/auth.js';

// Load environment variables from .env
dotenv.config();

const app = express();

// Parse incoming JSON requests
app.use(express.json());

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'User Authentication System API is running' });
});

// 1. POST /signup - Register a new user
app.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate email and password are provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Clean email: remove extra spaces and convert to lowercase
    const cleanEmail = email.trim().toLowerCase();

    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Validate password length (at least 6 characters)
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must have at least 6 characters' });
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Hash the password with 10 salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user to the database
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name ? name.trim() : null
      }
    });

    // Generate a unique JWT ID using Node.js crypto
    const jwtId = crypto.randomUUID();

    // Generate JWT token (expires in 1 hour)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWTSECRET,
      { expiresIn: '1h', jwtid: jwtId }
    );

    // Return user details (without password) and token
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'An error occurred during signup' });
  }
});

// 2. POST /login - Authenticate existing user
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email: trim and lowercase
    const cleanEmail = email.trim().toLowerCase();

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    // If user does not exist, return generic error
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare entered password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If password does not match, return the exact same generic error
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate unique JWT ID using crypto
    const jwtId = crypto.randomUUID();

    // Generate JWT token (expires in 1 hour)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWTSECRET,
      { expiresIn: '1h', jwtid: jwtId }
    );

    // Return user details and token
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'An error occurred during login' });
  }
});

// 4. GET /me - Get current user profile (Protected)
app.get('/me', requireAuth, async (req, res) => {
  try {
    // Find the user by ID stored in the verified JWT
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    // If user no longer exists in database
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'An error occurred while fetching profile' });
  }
});

// 5. GET /dashboard - Protected dashboard route
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Fetch logged-in user's name and email
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    // If user does not exist
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has a name, use it; otherwise fallback to email
    const displayName = user.name && user.name.trim() !== '' ? user.name : user.email;

    return res.status(200).json({
      message: `Welcome to your dashboard, ${displayName}!`,
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return res.status(500).json({ error: 'An error occurred while loading dashboard' });
  }
});

// Start server (unless running in test mode)
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;
