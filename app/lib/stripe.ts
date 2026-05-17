import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fetch Stripe secret key from admin_settings table
export const getStripeKey = async (): Promise<string | null> => {
  // First try environment variable (fallback)
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;

  // Then try admin_settings table
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "stripe_secret_key")
    .single();

  return data?.value || null;
};

export const getStripePublishableKey = async (): Promise<string | null> => {
  if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "stripe_publishable_key")
    .single();

  return data?.value || null;
};

export const getStripeWebhookSecret = async (): Promise<string | null> => {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;

  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "stripe_webhook_secret")
    .single();

  return data?.value || null;
};

// Get initialized Stripe client
export const getStripe = async (): Promise<Stripe | null> => {
  const key = await getStripeKey();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-12-18.acacia" as any });
};