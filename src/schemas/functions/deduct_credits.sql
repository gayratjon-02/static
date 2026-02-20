-- ============================================
-- ATOMIC CREDIT DEDUCTION FUNCTION
-- PostgreSQL (Supabase)
-- Race condition'ni oldini oladi
-- ============================================

CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_credits_used INTEGER;
  v_credits_limit INTEGER;
  v_addon_credits INTEGER;
  v_remaining INTEGER;
  v_new_credits_used INTEGER;
BEGIN
  -- Get user with row-level lock (FOR UPDATE)
  SELECT credits_used, credits_limit, addon_credits_remaining
  INTO v_credits_used, v_credits_limit, v_addon_credits
  FROM users
  WHERE _id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Qolgan kreditni hisoblash
  v_remaining := (v_credits_limit - v_credits_used) + COALESCE(v_addon_credits, 0);

  -- Yetarli kredit bormi?
  IF v_remaining < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS');
  END IF;

  -- Kreditni yechish
  v_new_credits_used := v_credits_used + p_amount;

  UPDATE users
  SET credits_used = v_new_credits_used
  WHERE _id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'balance_before', v_remaining,
    'balance_after', v_remaining - p_amount,
    'credits_used', v_new_credits_used
  );
END;
$$;
