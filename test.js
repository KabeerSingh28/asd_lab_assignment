// Set test environment before loading server
process.env.NODE_ENV = 'test';

import prisma from './src/prisma.js';
import jwt from 'jsonwebtoken';

async function runTests() {
  const { default: app } = await import('./src/server.js');

  console.log('----------------------------------------------------');
  console.log(' Starting User Authentication System API Tests');
  console.log('----------------------------------------------------\n');

  // Start an ephemeral server for testing
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failedCount++;
    }
  }

  try {
    // 1. Clean test data from previous runs if any
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['alice@example.com', 'bob_noname@example.com', 'testcase@example.com']
        }
      }
    });

    // TEST 1: Register new user (with name)
    const signupRes1 = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '  Alice@Example.com  ', // Test trimming and lowercasing
        password: 'password123',
        name: 'Alice Johnson'
      })
    });
    const signupData1 = await signupRes1.json();
    assert(
      signupRes1.status === 201 &&
      signupData1.user.email === 'alice@example.com' &&
      signupData1.user.name === 'Alice Johnson' &&
      !signupData1.user.password &&
      typeof signupData1.token === 'string',
      'Register new user with name (POST /signup)',
      `Status: ${signupRes1.status}, Email: ${signupData1.user?.email}`
    );

    // Verify JWT payload contains id, email and jti
    const decodedToken = jwt.decode(signupData1.token);
    assert(
      decodedToken &&
      decodedToken.email === 'alice@example.com' &&
      decodedToken.id === signupData1.user.id &&
      typeof decodedToken.jti === 'string',
      'JWT contains user ID, email, and unique crypto JWT ID (jti)',
      `Decoded: ${JSON.stringify(decodedToken)}`
    );

    // TEST 2: Register user without name
    const signupRes2 = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob_noname@example.com',
        password: 'securepassword456'
      })
    });
    const signupData2 = await signupRes2.json();
    assert(
      signupRes2.status === 201 &&
      signupData2.user.email === 'bob_noname@example.com' &&
      signupData2.user.name === null,
      'Register new user without name (POST /signup)',
      `Status: ${signupRes2.status}`
    );

    // TEST 3: Registering with existing email
    const duplicateRes = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'differentpassword',
        name: 'Alice Fake'
      })
    });
    const duplicateData = await duplicateRes.json();
    assert(
      duplicateRes.status === 400 && duplicateData.error === 'Email is already registered',
      'Reject registration with already existing email',
      `Status: ${duplicateRes.status}, Error: ${duplicateData.error}`
    );

    // TEST 4: Registering with short password (< 6 chars)
    const shortPassRes = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'shortpass@example.com',
        password: '12345'
      })
    });
    const shortPassData = await shortPassRes.json();
    assert(
      shortPassRes.status === 400 && shortPassData.error.includes('6 characters'),
      'Reject registration with short password (< 6 chars)',
      `Status: ${shortPassRes.status}, Error: ${shortPassData.error}`
    );

    // TEST 5: Registering with invalid email format
    const invalidEmailRes = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'validpassword'
      })
    });
    assert(
      invalidEmailRes.status === 400,
      'Reject registration with invalid email format',
      `Status: ${invalidEmailRes.status}`
    );

    // TEST 6: Login with correct credentials
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '  Alice@Example.com  ', // Normalized email
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 &&
      loginData.user.email === 'alice@example.com' &&
      typeof loginData.token === 'string',
      'Login with correct credentials (POST /login)',
      `Status: ${loginRes.status}`
    );

    const aliceToken = loginData.token;

    // Login user 2 (bob) for dashboard testing without name
    const bobLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob_noname@example.com',
        password: 'securepassword456'
      })
    });
    const bobLoginData = await bobLoginRes.json();
    const bobToken = bobLoginData.token;

    // TEST 7: Login with incorrect password
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'wrongpassword'
      })
    });
    const wrongPassData = await wrongPassRes.json();
    assert(
      wrongPassRes.status === 401 && wrongPassData.error === 'Invalid email or password',
      'Reject login with incorrect password (401)',
      `Status: ${wrongPassRes.status}, Error: ${wrongPassData.error}`
    );

    // TEST 8: Login with non-existent email
    const wrongEmailRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
    });
    const wrongEmailData = await wrongEmailRes.json();
    assert(
      wrongEmailRes.status === 401 && wrongEmailData.error === wrongPassData.error,
      'Same error message for wrong email and wrong password',
      `Wrong email error: "${wrongEmailData.error}", Wrong pass error: "${wrongPassData.error}"`
    );

    // TEST 9: Access protected route /me with valid token
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 &&
      meData.user.email === 'alice@example.com' &&
      meData.user.name === 'Alice Johnson' &&
      meData.user.createdAt &&
      !meData.user.password,
      'Access /me with valid token returns user details without password',
      `Status: ${meRes.status}, Name: ${meData.user?.name}`
    );

    // TEST 10: Access protected route /me without token
    const noTokenRes = await fetch(`${baseUrl}/me`);
    assert(
      noTokenRes.status === 401,
      'Access /me without token returns 401 error',
      `Status: ${noTokenRes.status}`
    );

    // TEST 11: Access protected route /me with invalid token
    const invalidTokenRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: 'Bearer this-is-an-invalid-token' }
    });
    assert(
      invalidTokenRes.status === 401,
      'Access /me with invalid token returns 401 error',
      `Status: ${invalidTokenRes.status}`
    );

    // TEST 11b: Access protected route /me with expired token
    const expiredToken = jwt.sign(
      { id: signupData1.user.id, email: signupData1.user.email },
      process.env.JWTSECRET,
      { expiresIn: '-1s' } // Expired token
    );
    const expiredTokenRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert(
      expiredTokenRes.status === 401,
      'Access /me with expired token returns 401 error',
      `Status: ${expiredTokenRes.status}`
    );

    // TEST 12: Access dashboard with name
    const dashRes1 = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const dashData1 = await dashRes1.json();
    assert(
      dashRes1.status === 200 &&
      dashData1.message === 'Welcome to your dashboard, Alice Johnson!',
      'Access /dashboard when user has name displays name in welcome message',
      `Message: "${dashData1.message}"`
    );

    // TEST 13: Access dashboard when name is empty/null
    const dashRes2 = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const dashData2 = await dashRes2.json();
    assert(
      dashRes2.status === 200 &&
      dashData2.message === 'Welcome to your dashboard, bob_noname@example.com!',
      'Access /dashboard when name is empty falls back to email in welcome message',
      `Message: "${dashData2.message}"`
    );

    // TEST 14: Access dashboard without token
    const dashNoTokenRes = await fetch(`${baseUrl}/dashboard`);
    assert(
      dashNoTokenRes.status === 401,
      'Access /dashboard without token returns 401 error',
      `Status: ${dashNoTokenRes.status}`
    );

    console.log('\n----------------------------------------------------');
    console.log(` Test Summary: ${passedCount} passed, ${failedCount} failed`);
    console.log('----------------------------------------------------');

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
