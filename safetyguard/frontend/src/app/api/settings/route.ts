import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    
    const settings = await sql`
      SELECT * FROM user_app_settings WHERE user_id = ${user.id} LIMIT 1
    `;

    if (settings.length === 0) {
      // Return default settings
      return NextResponse.json({
        llm_provider: 'featherless',
        llm_model: 'Qwen/Qwen3-32B',
        auto_run_analysis: false,
        email_notifications: true,
        theme: 'system',
        extra_settings: {},
      });
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const now = new Date().toISOString();

    const {
      llm_provider = 'featherless',
      llm_model = 'Qwen/Qwen3-32B',
      auto_run_analysis = false,
      email_notifications = true,
      theme = 'system',
      extra_settings = {},
    } = body;

    // Upsert settings
    const existing = await sql`
      SELECT id FROM user_app_settings WHERE user_id = ${user.id} LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE user_app_settings SET
          llm_provider = ${llm_provider},
          llm_model = ${llm_model},
          auto_run_analysis = ${auto_run_analysis},
          email_notifications = ${email_notifications},
          theme = ${theme},
          extra_settings = ${JSON.stringify(extra_settings)},
          updated_at = ${now}
        WHERE user_id = ${user.id}
      `;
    } else {
      const settingsId = randomUUID();
      await sql`
        INSERT INTO user_app_settings (
          id, user_id, llm_provider, llm_model, auto_run_analysis,
          email_notifications, theme, extra_settings, created_at, updated_at
        )
        VALUES (
          ${settingsId}, ${user.id}, ${llm_provider}, ${llm_model}, ${auto_run_analysis},
          ${email_notifications}, ${theme}, ${JSON.stringify(extra_settings)}, ${now}, ${now}
        )
      `;
    }

    const settings = await sql`
      SELECT * FROM user_app_settings WHERE user_id = ${user.id} LIMIT 1
    `;

    return NextResponse.json(settings[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
