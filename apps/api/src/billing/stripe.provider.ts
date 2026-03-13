import Stripe from 'stripe';
import type { Env } from '../config/env.js';

export const STRIPE = Symbol('STRIPE');

export interface StripeHandle {
  /** Null when STRIPE_SECRET_KEY is not set: checkout and portal are unavailable. */
  api: Stripe | null;
  /** Signature verification works without an API key; it only needs the webhook secret. */
  webhooks: Stripe['webhooks'];
}

export function createStripe(env: Env): StripeHandle {
  const api = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  return { api, webhooks: (api ?? new Stripe('sk_test_unconfigured')).webhooks };
}
