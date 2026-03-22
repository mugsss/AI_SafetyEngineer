import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url, secret } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Test the webhook by sending a test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from SafetyGuard',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      headers['X-Webhook-Secret'] = secret;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook test successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Webhook returned status ${response.status}`,
      });
    }
  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test webhook',
    });
  }
}
