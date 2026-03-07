-- ============================================
-- RPC Function to handle signup with ToS transaction
-- ============================================

CREATE OR REPLACE FUNCTION signup_with_tos(
  p_email VARCHAR,
  p_full_name VARCHAR,
  p_password_hash VARCHAR,
  p_avatar_url VARCHAR,
  p_tos_version VARCHAR,
  p_ip_address INET,
  p_user_agent TEXT,
  p_existing_user_id UUID DEFAULT NULL
) RETURNS SETOF users AS $$
DECLARE
  v_user_id UUID;
  v_user users;
BEGIN
  -- 1. Insert or Update User
  IF p_existing_user_id IS NOT NULL THEN
    UPDATE users
    SET 
      full_name = p_full_name,
      password_hash = p_password_hash,
      avatar_url = p_avatar_url,
      member_status = 'active'::member_status,
      subscription_tier = 'free'::subscription_tier,
      credits_used = 0,
      credits_limit = 25,
      addon_credits_remaining = 0,
      updated_at = NOW()
    WHERE _id = p_existing_user_id
    RETURNING * INTO v_user;
    
    v_user_id := p_existing_user_id;
  ELSE
    INSERT INTO users (
      email, 
      full_name, 
      password_hash, 
      avatar_url, 
      subscription_tier, 
      credits_limit
    )
    VALUES (
      p_email, 
      p_full_name, 
      p_password_hash, 
      p_avatar_url, 
      'free'::subscription_tier, 
      25
    )
    RETURNING * INTO v_user;
    
    v_user_id := v_user._id;
  END IF;

  -- 2. Insert ToS Acceptance record
  INSERT INTO tos_acceptances (
    user_id,
    tos_version,
    ip_address,
    user_agent
  ) VALUES (
    v_user_id,
    p_tos_version,
    p_ip_address,
    p_user_agent
  );

  RETURN NEXT v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
