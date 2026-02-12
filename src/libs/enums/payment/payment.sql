
CREATE TYPE payment_status AS ENUM (
  'active',
  'inactive',
  'past_due',
  'canceled'
);

CREATE TYPE subscription_tier AS ENUM (
  'free',
  'basic',
  'pro',
  'enterprise'
);

CREATE TYPE subscription_status AS ENUM (
  'active',
  'inactive',
  'canceled',
  'past_due',
  'trialing'
);

CREATE TYPE billing_interval AS ENUM (
  'monthly',
  'annual'
);
