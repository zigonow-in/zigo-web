-- Move legacy Assistant Master delivery offers into the Add-on Charges Master.
-- The legacy setting remains readable for backward compatibility, so existing offers are not lost.
insert into zigo.addon_charge_masters
  (addon_type, scope, title, description, label, applicable_on, cost_type,
   cost_value, percentage_base, discount_slabs, delivery_distance_slabs, is_active)
select
  'delivery',
  'all',
  'Delivery Distance Offers',
  'Migrated from Assistant Master delivery distance offers.',
  'Delivery charges',
  'all_customer',
  'flat',
  0,
  'selling_price',
  '[]'::jsonb,
  coalesce((app.value::jsonb)->'deliveryOfferSlabs', '[]'::jsonb),
  true
from zigo.app_settings app
where app."key" = 'assistant.master_values'
  and coalesce(app.is_deleted, false) = false
  and app.is_active = true
  and jsonb_typeof((app.value::jsonb)->'deliveryOfferSlabs') = 'array'
  and jsonb_array_length((app.value::jsonb)->'deliveryOfferSlabs') > 0
  and not exists (
    select 1
    from zigo.addon_charge_masters existing
    where existing.addon_type = 'delivery'
      and coalesce(existing.is_deleted, false) = false
  );
