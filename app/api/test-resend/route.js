import { NextResponse } from 'next/server';
import config from '@/src/config/index.js';

export async function GET() {
  const startTime = Date.now();
  const apiKey = config.RESEND_API_KEY || process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'No RESEND_API_KEY in environment' }, { status: 500 });
  }

  const maskedKey = `${apiKey.substring(0, 10)}... (length: ${apiKey.length})`;
  const payload = {
    from: 'Pehlix Health <noreply@pehlix.in>',
    to: ['aman.kalpra.11@gmail.com'],
    subject: 'Pehlix Production Diagnostic Test',
    html: `<p>Diagnostic email sent at ${new Date().toISOString()}. API Key: ${maskedKey}</p>`
  };

  try {
    console.log('[Diagnostic] Sending email to Resend from Vercel serverless function...');
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;
    const ok = response.ok;
    const status = response.status;
    const bodyText = await response.text();

    console.log(`[Diagnostic] Resend response in ${duration}ms (status: ${status}):`, bodyText);

    return NextResponse.json({
      success: ok,
      status,
      durationMs: duration,
      responseBody: bodyText,
      maskedKey
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Diagnostic] Failed after ${duration}ms:`, error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      durationMs: duration
    }, { status: 500 });
  }
}
