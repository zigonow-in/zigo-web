-- Generated from the local ZIGO master catalog. Inserts only missing identities.
set search_path = public;

insert into zigo.addon_charge_masters (
  addon_type, scope, title, description, label, applicable_on, cost_type,
  cost_value, percentage_base, customer_price, discount_slabs,
  delivery_distance_slabs, metadata, is_active, scope_type, state_id, city_id,
  zone_id, cluster_id, micro_market_id, nano_market_id
)
select incoming.*
  from (values
    ('delivery', 'all', 'Delivery Distance Offers', 'Migrated from Assistant Master delivery distance offers.', 'Delivery charges', 'all_customer', 'flat', '0.00'::numeric, 'selling_price', null::numeric, '[]'::jsonb, '[{"discountType":"percent","discountValue":100,"maxDistanceKm":1},{"discountType":"percent","discountValue":10,"maxDistanceKm":3},{"discountType":"percent","discountValue":30,"maxDistanceKm":5},{"discountType":"percent","discountValue":40,"maxDistanceKm":8},{"discountType":"percent","discountValue":50,"maxDistanceKm":10}]'::jsonb, '{}'::jsonb, true::boolean, 'all', null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid),
  ('platform', 'all', 'Platform fee', null, 'Platform Charge', 'all_customer', 'flat', '100.00'::numeric, 'selling_price', null::numeric, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, false::boolean, 'all', null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid),
  ('weather', 'all', 'Weather Charges', null, 'Weather fee', 'all_customer', 'flat', '10.00'::numeric, 'selling_price', null::numeric, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, false::boolean, 'all', null::uuid, null::uuid, null::uuid, null::uuid, null::uuid, null::uuid)
  ) as incoming(addon_type, scope, title, description, label, applicable_on, cost_type,
                cost_value, percentage_base, customer_price, discount_slabs,
                delivery_distance_slabs, metadata, is_active, scope_type, state_id,
                city_id, zone_id, cluster_id, micro_market_id, nano_market_id)
 where not exists (
   select 1 from zigo.addon_charge_masters existing
    where not existing.is_deleted
      and existing.addon_type = incoming.addon_type
      and existing.scope_type = incoming.scope_type
      and existing.title = incoming.title
 );

insert into zigo.tax_master_rules (
  tax_applicable_on, tax_applicability, tax_type, tax_value, formula, tax_label,
  tax_note, metadata, is_active, tax_category
)
select incoming.*
  from (values
    ('selling_price', 'exclusive', 'percent', '18.00'::numeric, '(taxApplicablePrice * taxValue / (100 + taxValue))', 'delivery fee', null, '{"formula":"(taxApplicablePrice * taxValue / (100 + taxValue))"}'::jsonb, true::boolean, 'delivery'),
  ('selling_price', 'inclusive', 'percent', '18.00'::numeric, '(taxApplicablePrice * taxValue / (100 + taxValue))', 'Platform', null, '{"formula":"(taxApplicablePrice * taxValue / (100 + taxValue))"}'::jsonb, true::boolean, 'platform'),
  ('selling_price', 'inclusive', 'percent', '5.00'::numeric, '(SellingPrice * TaxValue / (100 + TaxValue))', 'service fee', 'Applicable GST is included in the total amount.', '{"formula":"(SellingPrice * TaxValue / (100 + TaxValue))"}'::jsonb, true::boolean, 'service'),
  ('selling_price', 'exclusive', 'percent', '18.00'::numeric, '(taxApplicablePrice * taxValue / (100 + taxValue))', 'Weather GST', null, '{"formula":"(taxApplicablePrice * taxValue / (100 + taxValue))"}'::jsonb, false::boolean, 'weather')
  ) as incoming(tax_applicable_on, tax_applicability, tax_type, tax_value, formula,
                tax_label, tax_note, metadata, is_active, tax_category)
 where not exists (
   select 1 from zigo.tax_master_rules existing
    where not existing.is_deleted
      and existing.tax_category = incoming.tax_category
      and existing.tax_label = incoming.tax_label
      and existing.tax_applicable_on = incoming.tax_applicable_on
      and existing.tax_value = incoming.tax_value
      and existing.tax_applicability = incoming.tax_applicability
 );

insert into zigo.pg_transaction_charge_masters (
  payment_mode, charge_type, charge_value, description, is_active
)
select incoming.*
  from (values
    ('cash', 'percent', '0.0000'::numeric, 'Cash has no payment gateway cost', true::boolean),
  ('credit_card', 'percent', '2.5000'::numeric, 'Credit card payment processing cost', true::boolean),
  ('debit_card', 'percent', '0.9500'::numeric, 'Debit card payment processing cost', true::boolean),
  ('net_banking', 'percent', '0.9500'::numeric, 'Net banking payment processing cost', true::boolean),
  ('other', 'percent', '0.0000'::numeric, 'Fallback payment gateway cost', true::boolean),
  ('upi', 'percent', '0.0000'::numeric, 'UPI payment processing cost', true::boolean),
  ('wallet', 'percent', '0.0000'::numeric, 'Wallet payment processing cost', true::boolean)
  ) as incoming(payment_mode, charge_type, charge_value, description, is_active)
 where not exists (
   select 1 from zigo.pg_transaction_charge_masters existing
    where not existing.is_deleted
      and existing.payment_mode = incoming.payment_mode
 );

insert into zigo.offers (
  internal_name, offer_type, status, title, subtitle, description, note, icon_url,
  image_url, priority, custom_offer_exclusive, fallback_to_general_offer,
  stacking_allowed, audience_type, user_segment, validity_mode, active_from,
  active_until, valid_days, redeem_limit_per_user, redeem_limit_total,
  redeem_limit_daily, redeem_limit_cluster, cooldown_minutes,
  package_purchase_limit, auto_apply, public_code, referral_enabled,
  referral_scope, common_referral_code, discount_type, discount_value,
  discount_cap_paise, fixed_price_paise, buy_quantity, free_quantity,
  credit_amount_paise, package_price_paise, metadata
)
select incoming.*
  from (values
    ('WELCOMEZIGO', 'FREE_SERVICE', 'ACTIVE', 'ZIGO BOOKING FREE', 'Welcome Offer', null, null, null, null, 1::integer, true::boolean, false::boolean, false::boolean, 'all', 'all', 'no_expiry', '2026-10-27T17:21:00.000Z'::timestamptz, '2026-10-31T17:21:00.000Z'::timestamptz, 5::integer, 1::integer, 1::integer, null::integer, null::integer, 0::integer, null::integer, false::boolean, 'WELCOMEZIGO', false::boolean, 'selected_assistants', 'WELCOMEZIGO', 'flat', '99.00'::numeric, null::integer, null::integer, 1::integer, 30::integer, null::integer, null::integer, '{"source":"admin_offer_packages_master","campaign":{"channels":[],"weekdays":[],"timeSlots":[],"budgetPaise":1000000,"maxBenefitPaise":null,"minimumServiceAmountPaise":null},"offerKind":"free_first_booking","priceRule":{"basePrice":99,"discountType":"flat","noOfBookings":1,"sellingPrice":0,"discountValue":99,"discountAmount":null,"durationPerBookingMinutes":30},"eligibility":{"scope":{"cityId":"","zoneId":"","stateId":"","clusterId":"","scopeType":"all"},"excludedUserIdsMode":"selected","includedUserIdsMode":"all"},"packageProduct":null}'::jsonb)
  ) as incoming(internal_name, offer_type, status, title, subtitle, description, note,
                icon_url, image_url, priority, custom_offer_exclusive,
                fallback_to_general_offer, stacking_allowed, audience_type, user_segment,
                validity_mode, active_from, active_until, valid_days,
                redeem_limit_per_user, redeem_limit_total, redeem_limit_daily,
                redeem_limit_cluster, cooldown_minutes, package_purchase_limit, auto_apply,
                public_code, referral_enabled, referral_scope, common_referral_code,
                discount_type, discount_value, discount_cap_paise, fixed_price_paise,
                buy_quantity, free_quantity, credit_amount_paise, package_price_paise, metadata)
 where not exists (
   select 1 from zigo.offers existing
    where not existing.is_deleted
      and (existing.internal_name = incoming.internal_name
       or (incoming.public_code is not null and existing.public_code = incoming.public_code))
 );

insert into zigo.offer_versions (offer_id, version_no, snapshot)
select offer.id, incoming.version_no, incoming.snapshot::jsonb
  from (values
    ('WELCOMEZIGO', 1, '{"id":"5c5ddeee-e0d0-43d8-897a-b95dbce5f11b","note":null,"title":"ZIGO BOOKING FREE","scopes":[{"cityId":null,"zoneId":null,"stateId":null,"clusterId":null,"scopeType":"all"}],"status":"ACTIVE","iconUrl":null,"imageUrl":null,"isActive":true,"metadata":{"source":"admin_offer_packages_master","campaign":{"channels":[],"weekdays":[],"timeSlots":[],"budgetPaise":1000000,"maxBenefitPaise":null,"minimumServiceAmountPaise":null},"offerKind":"free_first_booking","priceRule":{"basePrice":99,"discountType":"flat","noOfBookings":1,"sellingPrice":0,"discountValue":99,"discountAmount":null,"durationPerBookingMinutes":30},"eligibility":{"scope":{"cityId":"","zoneId":"","stateId":"","clusterId":"","scopeType":"all"},"excludedUserIdsMode":"selected","includedUserIdsMode":"all"},"packageProduct":null},"priority":1,"subtitle":"Welcome Offer","autoApply":false,"createdAt":"2026-10-27T17:23:48.843Z","isEnabled":true,"offerType":"FREE_SERVICE","updatedAt":"2026-10-27T17:23:48.843Z","validDays":5,"activeFrom":"2026-10-27T17:21:00.000Z","publicCode":"WELCOMEZIGO","activeUntil":"2026-10-31T17:21:00.000Z","buyQuantity":1,"categoryIds":["c1a6c53e-adf5-4451-a996-6cc4ff5fe012","bd9ca2ac-140d-479b-a58c-4418f52401fb","f83a01d5-b704-4fd5-964b-f977bca2ac7a","632d0613-3f5c-4b14-ad84-98872cf91788","b16740fb-e2d7-4651-9cc5-17948eb9ddf5","b59608b9-698b-4ccf-8702-23476bf7a673","e1ecf3c4-053f-4a08-b1fc-30f2d0ed53a9","adce9afb-4a02-428d-8abb-eece2b5f0f54","2d44ff66-5392-4b4c-bfe6-c367d69250c7","85ea3c90-08de-4d1b-ace3-c35dc98716ea","4882767a-2b75-443d-a85a-b48e16d3e597","20ad6908-8e5e-4fc4-9e15-71b4eac1e631"],"description":null,"durationIds":[],"userSegment":"all","audienceType":"all","bookingTypes":["both"],"contentItems":[],"discountType":"flat","freeQuantity":30,"internalName":"WELCOMEZIGO","validityMode":"no_expiry","consumedCount":0,"discountValue":"99.00","referralCodes":[],"referralScope":"selected_assistants","paymentModeIds":[],"cooldownMinutes":0,"excludedUserIds":[],"fixedPricePaise":null,"includedUserIds":[],"redemptionCount":0,"referralEnabled":false,"stackingAllowed":false,"currentVersionId":null,"discountCapPaise":null,"legacyServiceIds":[],"paymentModeCodes":[],"redeemLimitDaily":null,"redeemLimitTotal":1,"serviceMasterIds":["9f87f4c1-9905-4934-8b03-62850e769bbc","b7c731d6-1d1e-46f0-9b1f-34bfe628ef97","db4b6b37-56f0-4447-98ea-5c4e985dd510","7c066275-eed7-43ce-8ce3-27b7b4ee5e52","c75e980b-3bb2-4a82-9dec-d47916b836f5"],"creditAmountPaise":null,"packagePricePaise":null,"commonReferralCode":"WELCOMEZIGO","redeemLimitCluster":null,"redeemLimitPerUser":1,"customOfferExclusive":true,"packagePurchaseLimit":null,"fallbackToGeneralOffer":false}'::jsonb)
  ) as incoming(internal_name, version_no, snapshot)
  join zigo.offers offer on offer.internal_name = incoming.internal_name
 where not exists (
   select 1 from zigo.offer_versions existing
    where existing.offer_id = offer.id and existing.version_no = incoming.version_no
 );

update zigo.offers offer
   set current_version_id = version.id
  from zigo.offer_versions version
 where version.offer_id = offer.id
   and version.version_no = (
     select max(version2.version_no)
       from zigo.offer_versions version2
      where version2.offer_id = offer.id
   )
   and not offer.is_deleted;

insert into zigo.offer_scopes (offer_id, scope_type, state_id, city_id, zone_id, cluster_id, metadata)
select offer.id, incoming.scope_type, incoming.state_id, incoming.city_id,
       incoming.zone_id, incoming.cluster_id, incoming.metadata::jsonb
  from (values
    ('WELCOMEZIGO', 'all', null::uuid, null::uuid, null::uuid, null::uuid, '{}'::jsonb)
  ) as incoming(internal_name, scope_type, state_id, city_id, zone_id, cluster_id, metadata)
  join zigo.offers offer on offer.internal_name = incoming.internal_name
 where not exists (
   select 1 from zigo.offer_scopes existing
    where existing.offer_id = offer.id
      and existing.scope_type = incoming.scope_type
      and coalesce(existing.state_id::text, '') = coalesce(incoming.state_id::text, '')
      and coalesce(existing.city_id::text, '') = coalesce(incoming.city_id::text, '')
      and coalesce(existing.zone_id::text, '') = coalesce(incoming.zone_id::text, '')
      and coalesce(existing.cluster_id::text, '') = coalesce(incoming.cluster_id::text, '')
 );

insert into zigo.offer_services (offer_id, service_master_id)
select offer.id, service.id
  from (values
    ('WELCOMEZIGO', 'Book your <b>Trusted Assistant</b>'),
  ('WELCOMEZIGO', 'Health'),
  ('WELCOMEZIGO', 'Indoor'),
  ('WELCOMEZIGO', 'Outdoor'),
  ('WELCOMEZIGO', 'Tell us your need')
  ) as incoming(internal_name, service_title)
  join zigo.offers offer on offer.internal_name = incoming.internal_name
  join zigo.category_service_masters service on service.service_title = incoming.service_title
 where not exists (
   select 1 from zigo.offer_services existing
    where existing.offer_id = offer.id and existing.service_master_id = service.id
 );

insert into zigo.offer_categories (offer_id, category_id)
select offer.id, category.id
  from (values
    ('WELCOMEZIGO', 'BE_THERE'),
  ('WELCOMEZIGO', 'BETHERE'),
  ('WELCOMEZIGO', 'BOOK_YOUR_TRUSTED_ASSISTANT'),
  ('WELCOMEZIGO', 'BUSINESS'),
  ('WELCOMEZIGO', 'ELDER'),
  ('WELCOMEZIGO', 'FAMILY'),
  ('WELCOMEZIGO', 'HEALTH'),
  ('WELCOMEZIGO', 'HOUSE'),
  ('WELCOMEZIGO', 'PERSONAL'),
  ('WELCOMEZIGO', 'SHOPPING'),
  ('WELCOMEZIGO', 'SHOPPING_2'),
  ('WELCOMEZIGO', 'TELLUS')
  ) as incoming(internal_name, category_code)
  join zigo.offers offer on offer.internal_name = incoming.internal_name
  join zigo.categories category on category.code = incoming.category_code
 where not exists (
   select 1 from zigo.offer_categories existing
    where existing.offer_id = offer.id and existing.category_id = category.id
 );
