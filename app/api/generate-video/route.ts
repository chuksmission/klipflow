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

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      mode = 'text_to_video',
      image_url,
      duration = '5',
      aspect_ratio = '16:9',
      model = 'kling-v1'
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const token = await generateKlingToken();

    // Build request body based on mode
    const body: any = {
      model_name: model,
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: 'std'
    };

    if (mode === 'image_to_video' && image_url) {
      body.image_url = image_url;
    }

    const endpoint = mode === 'image_to_video'
      ? 'https://api.klingai.com/v1/videos/image2video'
      : 'https://api.klingai.com/v1/videos/text2video';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Kling API error' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      task_id: data.data?.task_id,
      status: data.data?.task_status,
      message: 'Video generation started. Check status with task_id.'
    });

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}