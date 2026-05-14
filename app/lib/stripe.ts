import Stripe from "stripe";

// Stripe client - initialized with secret key from admin settings or env
export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-12-18.acacia" as any });
};
