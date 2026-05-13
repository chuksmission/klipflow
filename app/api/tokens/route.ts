import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      // Create token record if doesn't exist
      const { data: newRecord } = await supabase
        .from('user_tokens')
        .insert({ user_id: user.id, balance: 25, total_used: 0 })
        .select()
        .single();
      return NextResponse.json({ balance: 25, total_used: 0 });
    }

    return NextResponse.json({ balance: data.balance, total_used: data.total_used });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount = 10 } = await req.json();

    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!tokenData) {
      return NextResponse.json({ error: 'Token record not found' }, { status: 404 });
    }

    if (tokenData.balance < amount) {
      return NextResponse.json({ error: 'Insufficient token balance' }, { status: 400 });
    }

    const { data: updated } = await supabase
      .from('user_tokens')
      .update({
        balance: tokenData.balance - amount,
        total_used: tokenData.total_used + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    return NextResponse.json({ balance: updated?.balance, total_used: updated?.total_used });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}