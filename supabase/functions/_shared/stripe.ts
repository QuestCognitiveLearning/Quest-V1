import Stripe from 'https://esm.sh/stripe@14.0.0';

const SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;

export const stripe = new Stripe(SECRET, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
