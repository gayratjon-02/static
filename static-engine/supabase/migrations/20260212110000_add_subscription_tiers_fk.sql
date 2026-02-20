-- Add FK relationships to subscription_tiers
-- This creates explicit connections between tables

-- Add FK from users to subscription_tiers
ALTER TABLE users 
ADD CONSTRAINT fk_users_subscription_tier 
FOREIGN KEY (subscription_tier) 
REFERENCES subscription_tiers(tier_key);

-- Add FK from subscriptions to subscription_tiers
ALTER TABLE subscriptions 
ADD CONSTRAINT fk_subscriptions_tier 
FOREIGN KEY (tier) 
REFERENCES subscription_tiers(tier_key);
