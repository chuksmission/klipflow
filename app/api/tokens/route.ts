import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCharge, createShowcaseCharge } from '../../lib/charges';

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

    const { amount, feature, pool } = await req.json() as { amount?: number; feature?: string; pool?: string };
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Atomic deduction + charge record (supabase/token_charges.sql). The returned
    // charge_id is what generation routes and refunds are tied to.
    // Admin tools pay from the separate showcase balance
    if (pool === 'showcase') {
      const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = pool === 'showcase'
      ? await createShowcaseCharge(user.id, value, feature ?? null)
      : await createCharge(user.id, value, feature ?? null);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ balance: result.balance, total_used: result.totalUsed, charge_id: result.chargeId });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}