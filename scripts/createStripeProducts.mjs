#!/usr/bin/env node
/**
 * createStripeProducts.mjs
 *
 * One-shot script. Creates the Quest Learning Stripe products + prices:
 *
 *   Classroom — monthly $29 / annual $250 (founding member)
 *   Studio    — monthly $59 / annual $499 (founding member)
 *   Studio Additional Tutor Seat — monthly $29
 *   Enterprise — quote-only, no price
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/createStripeProducts.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/createStripeProducts.mjs --test
 *
 * Output is the env-var block to drop into Vercel + Supabase secrets:
 *
 *   STRIPE_PRICE_CLASSROOM_MONTHLY=price_xxx
 *   STRIPE_PRICE_CLASSROOM_ANNUAL=price_xxx
 *   STRIPE_PRICE_STUDIO_MONTHLY=price_xxx
 *   STRIPE_PRICE_STUDIO_ANNUAL=price_xxx
 *   STRIPE_PRICE_STUDIO_SEAT=price_xxx
 *
 * Safe to re-run with --dry to preview without writing. Idempotent within a
 * single run (re-runs create *new* duplicate products — Stripe has no
 * uniqueness constraint on name). Use the dashboard to clean up duplicates
 * if this script is run twice.
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}
const DRY = process.argv.includes("--dry");
const stripe = new Stripe(KEY, { apiVersion: "2024-06-20" });

const isLive = KEY.startsWith("sk_live_");
console.log(`Mode: ${isLive ? "LIVE" : "TEST"}${DRY ? " (DRY RUN)" : ""}`);

async function ensure(action, fn) {
  if (DRY) {
    console.log(`[dry] would: ${action}`);
    return { id: `dry_${action.replace(/\s+/g, "_")}` };
  }
  const out = await fn();
  console.log(`${action} → ${out.id}`);
  return out;
}

const PLAN_DEFS = [
  {
    productName: "Quest Learning Classroom",
    productDescription:
      "Unlimited classes and students, unlimited AI generations, live sessions, AI Panda Tutor.",
    metadata: { tier: "classroom", founding_member: "true" },
    prices: [
      {
        envKey: "STRIPE_PRICE_CLASSROOM_MONTHLY",
        nickname: "Classroom Monthly (founding)",
        unit_amount: 2900,
        currency: "usd",
        recurring: { interval: "month" },
      },
      {
        envKey: "STRIPE_PRICE_CLASSROOM_ANNUAL",
        nickname: "Classroom Annual (founding)",
        unit_amount: 25000,
        currency: "usd",
        recurring: { interval: "year" },
      },
    ],
  },
  {
    productName: "Quest Learning Studio",
    productDescription:
      "Unlimited classes, branded packets, automated parent reports, multi-tutor seats.",
    metadata: { tier: "studio", founding_member: "true" },
    prices: [
      {
        envKey: "STRIPE_PRICE_STUDIO_MONTHLY",
        nickname: "Studio Monthly (founding)",
        unit_amount: 5900,
        currency: "usd",
        recurring: { interval: "month" },
      },
      {
        envKey: "STRIPE_PRICE_STUDIO_ANNUAL",
        nickname: "Studio Annual (founding)",
        unit_amount: 49900,
        currency: "usd",
        recurring: { interval: "year" },
      },
    ],
  },
  {
    productName: "Quest Learning Studio - Additional Tutor Seat",
    productDescription: "Add a tutor seat to an existing Studio subscription.",
    metadata: { tier: "studio_seat" },
    prices: [
      {
        envKey: "STRIPE_PRICE_STUDIO_SEAT",
        nickname: "Studio Seat Monthly",
        unit_amount: 2900,
        currency: "usd",
        recurring: { interval: "month" },
      },
    ],
  },
  {
    productName: "Quest Learning Enterprise",
    productDescription:
      "Custom-quoted plan: SSO, admin dashboard, white-label, custom AI training.",
    metadata: { tier: "enterprise" },
    prices: [],
  },
];

const envOut = {};

for (const plan of PLAN_DEFS) {
  const product = await ensure(`create product "${plan.productName}"`, () =>
    stripe.products.create({
      name: plan.productName,
      description: plan.productDescription,
      metadata: plan.metadata,
    })
  );

  for (const p of plan.prices) {
    const price = await ensure(`create price "${p.nickname}"`, () =>
      stripe.prices.create({
        product: product.id,
        nickname: p.nickname,
        unit_amount: p.unit_amount,
        currency: p.currency,
        recurring: p.recurring,
        metadata: { ...plan.metadata, env_key: p.envKey },
      })
    );
    envOut[p.envKey] = price.id;
  }
}

console.log("\n--- Add these to Vercel + Supabase Edge Function env vars ---");
for (const [k, v] of Object.entries(envOut)) {
  console.log(`${k}=${v}`);
}
