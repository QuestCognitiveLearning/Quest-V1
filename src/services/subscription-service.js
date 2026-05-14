/**
 * @file   subscription-service.js
 * @desc   Stripe subscription operations — fetch price IDs, create checkout
 *         sessions, route to billing portal. Components never call Stripe
 *         endpoints directly; they go through this module.
 * @author Quest Learning core team
 */

import { quest } from '@/api/questClient';
import { SUBSCRIPTION_STATUS, SUBSCRIPTION_TIER } from '@/constants';

/**
 * Fetch the current Stripe price IDs from the backend config.
 * @returns {Promise<{premium_price_id?: string}>}
 */
export async function fetchPriceIds() {
  const response = await quest.functions.invoke('getStripePrices');
  return response.data ?? {};
}

/**
 * Activate the free tier for the current teacher (no Stripe involvement).
 * @returns {Promise<object>}
 */
export async function activateFreeTier() {
  return quest.auth.updateMe({
    subscription_status: SUBSCRIPTION_STATUS.FREE,
    subscription_tier: SUBSCRIPTION_TIER.FREE,
  });
}

/**
 * Start a Stripe Checkout session for the Premium plan.
 * Redirects the browser to Stripe-hosted checkout.
 * @param {object} options
 * @param {string} options.priceId - Stripe price ID
 * @param {string} options.successUrl - URL to return to on success
 * @param {string} options.cancelUrl - URL to return to on cancel
 * @returns {Promise<void>} - never resolves; redirects browser
 * @throws if the backend doesn't return a checkout URL
 */
export async function startCheckout({ priceId, successUrl, cancelUrl }) {
  const response = await quest.functions.invoke('createCheckout', {
    priceId,
    successUrl,
    cancelUrl,
  });
  const url = response?.data?.url;
  if (!url) throw new Error('No checkout URL returned from server');
  window.location.href = url;
}

/**
 * Redirect to the Stripe customer billing portal.
 * @returns {Promise<void>}
 */
export async function openBillingPortal() {
  const response = await quest.functions.invoke('stripePortal');
  const url = response?.data?.url;
  if (!url) throw new Error('No portal URL returned from server');
  window.location.href = url;
}
