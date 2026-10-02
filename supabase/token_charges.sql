-- Secure token charges and refunds
-- Run once in the Supabase SQL editor BEFORE deploying the code that uses it.
--
-- Every token deduction creates a charge. Refunds are only possible against a
-- charge the user owns, for at most its remaining amount, and only once the
-- server has verified the job failed. Completed generations close the charge.

CREATE TABLE IF NOT EXISTS token_charges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  amount           integer NOT NULL CHECK (amount > 0),
  refunded_amount  integer NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  status           text NOT NULL DEFAULT 'charged'
                   CHECK (status IN ('charged', 'partially_refunded', 'refunded', 'completed')),
  feature          text,
  task_id          text,     -- provider job started with this charge ('claimed' while starting)
  provider         text,
  generation_id    text,     -- gallery row created from this charge
  created_at       timestamptz NOT NULL DEFAULT now(),
  settled_at       timestamptz,
  CHECK (refunded_amount <= amount)
);

CREATE INDEX IF NOT EXISTS token_charges_user_idx ON token_charges (user_id, created_at DESC);

-- No policies: only the service role (server) can read or write charges
ALTER TABLE token_charges ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Deduct tokens and create a charge, atomically (no double-spend race)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION charge_tokens(p_user_id uuid, p_amount integer, p_feature text)
RETURNS TABLE (out_charge_id uuid, out_balance integer, out_total_used integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance integer;
  v_total integer;
  v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE user_tokens
     SET balance = balance - p_amount,
         total_used = total_used + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id
     AND balance >= p_amount
  RETURNING balance, total_used INTO v_balance, v_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  INSERT INTO token_charges (user_id, amount, feature)
  VALUES (p_user_id, p_amount, left(p_feature, 64))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_balance, v_total;
END;
$$;

-- ---------------------------------------------------------------------------
-- Refund all (p_amount NULL) or part of a charge's remaining amount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refund_token_charge(p_charge_id uuid, p_user_id uuid, p_amount integer DEFAULT NULL)
RETURNS TABLE (out_refunded integer, out_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_charge token_charges%ROWTYPE;
  v_remaining integer;
  v_refund integer;
  v_balance integer;
BEGIN
  SELECT * INTO v_charge
    FROM token_charges
   WHERE id = p_charge_id AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge_not_found';
  END IF;
  IF v_charge.status NOT IN ('charged', 'partially_refunded') THEN
    RAISE EXCEPTION 'charge_closed';
  END IF;

  v_remaining := v_charge.amount - v_charge.refunded_amount;
  v_refund := COALESCE(p_amount, v_remaining);
  IF v_refund <= 0 OR v_refund > v_remaining THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE token_charges
     SET refunded_amount = refunded_amount + v_refund,
         status = CASE WHEN refunded_amount + v_refund >= amount THEN 'refunded' ELSE 'partially_refunded' END,
         settled_at = now()
   WHERE id = p_charge_id;

  UPDATE user_tokens
     SET balance = balance + v_refund,
         total_used = GREATEST(0, total_used - v_refund),
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  RETURN QUERY SELECT v_refund, v_balance;
END;
$$;

-- Server-only: browsers (anon / authenticated roles) must never call these directly
REVOKE ALL ON FUNCTION charge_tokens(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refund_token_charge(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION charge_tokens(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION refund_token_charge(uuid, uuid, integer) TO service_role;
