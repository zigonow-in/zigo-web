import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portalSource = readFileSync(new URL("../public/portal.js", import.meta.url), "utf8");
const offersRepository = readFileSync(new URL("../src/modules/offers/offers.repository.ts", import.meta.url), "utf8");
const portalRepository = readFileSync(new URL("../src/modules/portal/portal.repository.ts", import.meta.url), "utf8");
const coordinatorStart = portalSource.indexOf("let customerCartQuoteInFlight = null;");
const coordinatorEnd = portalSource.indexOf("function refreshCustomerCartConfirmBarOnly", coordinatorStart);
assert.ok(coordinatorStart >= 0, "customer quote coordinator must exist");
assert.ok(coordinatorEnd > coordinatorStart, "customer quote coordinator boundary must exist");

function createHarness() {
  const state = {
    customerView: "cart",
    token: "customer-token",
    cart: [{ id: "item-1", categoryId: "category-1", serviceId: "service-1", durationMinutes: 30 }],
    customerSelectedOfferId: "",
    customerOfferCode: "",
    customerOfferAutoApplyDismissed: false,
    customerServerBillingQuote: null,
    customerServerBillingQuoteKey: "",
    customerServerBillingQuoteFetchedAt: 0,
    customerServerBillingQuoteBusy: false,
    customerServerBillingQuoteError: "",
    customerCartOffersError: ""
  };
  let context = "duration-30";
  const requests = [];
  const renders = { offers: 0, bill: 0, confirm: 0 };
  const api = (_path, _options) => new Promise((resolve, reject) => {
    requests.push({ context, resolve, reject });
  });
  const snippet = portalSource.slice(coordinatorStart, coordinatorEnd);
  const getRefresh = new Function(
    "actor", "state", "customerCartBillingFingerprint", "cartTotals", "customerCartBillingQuoteKey",
    "customerCartBillingQuotePayload", "isUuid", "api", "refreshCustomerCartOffersOnly",
    "refreshCustomerCartBillOnly", "refreshCustomerCartConfirmBarOnly", "customerCartLocationStopsForPayload",
    `${snippet}; return refreshCustomerCartAuthoritativePricing;`
  );
  const refresh = getRefresh(
    "customer", state,
    () => JSON.stringify({ amount: state.customerServerBillingQuote?.pricingBreakdown?.amountToPayPaise || 0 }),
    () => ({ toPay: Number(state.customerServerBillingQuote?.pricingBreakdown?.amountToPayPaise || 0) / 100 }),
    () => JSON.stringify({ context, offerId: state.customerSelectedOfferId, code: state.customerOfferCode, skip: state.customerOfferAutoApplyDismissed }),
    () => ({ clusterId: "cluster-1", categoryId: "category-1", address: "Valid address", metadata: {} }),
    () => true,
    api,
    () => { renders.offers += 1; },
    () => { renders.bill += 1; },
    () => { renders.confirm += 1; },
    () => []
  );
  return { state, requests, renders, refresh, setContext: (value) => { context = value; } };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const harness = createHarness();
  const first = harness.refresh({ forceRefresh: true });
  await flush();
  assert.equal(harness.requests.length, 1, "first pricing request should be sent");
  harness.setContext("duration-60");
  const second = harness.refresh({ forceRefresh: true });
  assert.equal(harness.requests.length, 1, "a newer request should queue behind the in-flight request");
  harness.requests[0].resolve({ data: { pricingBreakdown: { amountToPayPaise: 10000 } } });
  await flush();
  assert.equal(harness.requests.length, 2, "the latest cart context should be requoted");
  harness.requests[1].resolve({ data: { pricingBreakdown: { amountToPayPaise: 20000 } } });
  await Promise.all([first, second]);
  assert.equal(harness.state.customerServerBillingQuoteKey.includes("duration-60"), true, "stale quote must not become current");
  assert.equal(harness.state.customerServerBillingQuote.pricingBreakdown.amountToPayPaise, 20000);
}

{
  const harness = createHarness();
  harness.state.customerSelectedOfferId = "offer-1";
  const apply = harness.refresh({ forceRefresh: true });
  await flush();
  harness.requests[0].reject(Object.assign(new Error("Selected offer is not eligible for this booking."), { status: 404 }));
  await flush();
  assert.equal(harness.requests.length, 2, "an invalid offer must trigger one clean quote without the stale selection");
  harness.requests[1].resolve({ data: { pricingBreakdown: { amountToPayPaise: 9900 } } });
  await apply;
  assert.equal(harness.state.customerSelectedOfferId, "", "invalid offer selection must be cleared");
  assert.equal(harness.state.customerOfferAutoApplyDismissed, true, "an invalid explicit offer must not be silently re-applied");
  assert.equal(harness.state.customerServerBillingQuote.pricingBreakdown.amountToPayPaise, 9900);
}

{
  const harness = createHarness();
  const first = harness.refresh({ forceRefresh: true });
  await flush();
  const second = harness.refresh({ forceRefresh: true });
  harness.requests[0].resolve({ data: { pricingBreakdown: { amountToPayPaise: 12345 } } });
  await flush();
  assert.equal(harness.requests.length, 2, "repeated force refresh must not be dropped");
  harness.requests[1].resolve({ data: { pricingBreakdown: { amountToPayPaise: 12345 } } });
  await Promise.all([first, second]);
  assert.ok(harness.renders.bill > 0 && harness.renders.confirm > 0, "authoritative quote must update bill and confirmation UI");
}

assert.match(portalSource, /paymentModeCode: String\(customerSelectedPaymentMaster\(\)\.code \|\| state\.selectedPayment \|\| "cash"\)/, "offer listing must include payment mode");
assert.match(portalSource, /customerCartOffersCacheMs = 30_000/, "offer listing must revalidate scheduled offers periodically");
assert.match(portalSource, /String\(appliedOffer\?\.id \|\| ""\) === String\(offer\.id \|\| ""\)/, "offer UI must use server-confirmed applied state");
assert.match(portalSource, /customerCartBillingQuoteKey\(\) !== quoteKey/, "stale quote responses must be rejected");
assert.match(offersRepository, /o\.active_from is null or o\.active_from <= now\(\)/, "future offers must not be eligible before their start time");
assert.match(offersRepository, /o\.active_until is null or o\.active_until >= now\(\)/, "expired offers must not remain eligible");
assert.match(offersRepository, /\$5::uuid is not null and pm\.payment_mode_id = \$5::uuid/, "payment-mode master restrictions must be enforced");
assert.match(offersRepository, /lower\(pm\.payment_mode_code\) = lower\(\$6::text\)/, "payment-mode code restrictions must be case insensitive");
assert.match(portalSource, /paymentModeId: String\(customerSelectedPaymentMaster\(\)\.id \|\| ""\)/, "customer quotes must carry the payment-mode master ID");
assert.match(portalRepository, /snapshotOffer: !input\.dryRun/, "booking quotes and confirmations must preserve the offer snapshot policy");
assert.match(portalRepository, /const totalDiscountPaise = Math\.max\(0, Number\(resolvedTaxPricing\.discountAmountPaise \|\| 0\) \+ addonDiscountPaise\);/, "saved savings must combine item and add-on discounts once");
assert.doesNotMatch(portalRepository, /\+ addonDiscountPaise \+ Number\(deliveryQuote\.deliveryDiscountPaise \|\| 0\)/, "delivery discount must not be counted twice");

console.log("Customer offer flow checks passed: latest-wins quotes, invalid-offer recovery, repeated refresh, payment-mode filtering, future-offer revalidation, and server-confirmed UI state.");
