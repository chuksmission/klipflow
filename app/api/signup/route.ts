import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, fingerprint } = await req.json();

    // 1. Check if fingerprint already exists
    const { data: existingFingerprint } = await supabase
      .from('device_fingerprints')
      .select('id')
      .eq('fingerprint', fingerprint)
      .single();

    if (existingFingerprint) {
      return NextResponse.json(
        { error: 'A free trial has already been used on this device.' },
        { status: 400 }
      );
    }

    // 2. Check if email already exists
    const { data: existingEmail } = await supabase
      .from('device_fingerprints')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'This email is already registered.' },
        { status: 400 }
      );
    }

    // 3. Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: Math.random().toString(36).slice(-12),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/verify`,
      }
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 4. Store fingerprint record
    await supabase
      .from('device_fingerprints')
      .insert({
        fingerprint,
        email,
        verified: false
      });

    return NextResponse.json({
      success: true,
      message: 'Please check your email to verify your account and claim your free tokens.'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}