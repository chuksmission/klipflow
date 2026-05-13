import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

async function generateKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY!;
  const secretKey = process.env.KLING_SECRET_KEY!;

  const secret = new TextEncoder().encode(secretKey);
  const token = await new jose.SignJWT({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);

  return token;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get('task_id');

    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    const token = await generateKlingToken();

    const response = await fetch(
      `https://api.klingai.com/v1/videos/text2video/${task_id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Status check failed' },
        { status: response.status }
      );
    }

    const taskData = data.data;
    const status = taskData?.task_status;
    const videoUrl = taskData?.task_result?.videos?.[0]?.url;

    return NextResponse.json({
      success: true,
      status,
      video_url: videoUrl || null,
      completed: status === 'succeed',
      failed: status === 'failed',
      progress: taskData?.task_status_msg || ''
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}