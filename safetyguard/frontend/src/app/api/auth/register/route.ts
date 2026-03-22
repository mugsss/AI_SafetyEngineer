import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO users (id, email, name, hashed_password, created_at, updated_at)
      VALUES (${userId}, ${email}, ${name || email.split('@')[0]}, ${hashedPassword}, ${now}, ${now})
    `;

    const token = await createToken(userId);
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name: name || email.split('@')[0],
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
