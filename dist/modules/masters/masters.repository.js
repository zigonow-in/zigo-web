import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { deleteLocationHierarchy } from "./locationHierarchy.repository.js";
let clusterServiceSchemaReady = null;
let surgeRuleSchemaReady = null;
let priceMasterSchemaReady = null;
let taxMasterSchemaReady = null;
let paymentModeSchemaReady = null;
let categoryServiceMasterSchemaReady = null;
let categoryPriceSchemaReady = null;
let bookingTypeSchemaReady = null;
let bookingEngineRuleSchemaReady = null;
let bookingEngineQuickReplySchemaReady = null;
function normalizeServiceCategoryGridSize(value) {
    const raw = String(value || "").trim().toLowerCase();
    return ["1x1", "2x2", "3x3", "4x4", "5x5"].includes(raw) ? raw : "3x3";
}
function normalizeServiceMasterBookingType(value) {
    const raw = String(value || "").trim().toLowerCase();
    return ["both", "instant", "schedule"].includes(raw) ? raw : "both";
}
function normalizeServiceTextColor(value) {
    const raw = String(value || "").trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : "";
}
function normalizeServiceFontSize(value, fallback) {
    return Math.max(8, Math.min(80, Math.round(Number(value || fallback))));
}
function normalizeServiceFontWeight(value, fallback) {
    return Math.max(100, Math.min(900, Math.round(Number(value || fallback) / 100) * 100));
}
function normalizeCategoryServiceMasterIcons(icons = []) {
    return (Array.isArray(icons) ? icons : [])
        .map((icon) => ({
        icon: String(icon.icon || "").trim(),
        size: Math.max(8, Math.min(96, Math.round(Number(icon.size || 18)))),
        target: ["serviceTitle", "serviceSubtitle"].includes(String(icon.target || ""))
            ? String(icon.target)
            : "serviceTitle",
        position: icon.position === "right" ? "right" : "left"
    }))
        .filter((icon) => icon.icon);
}
export async function ensureCategoryServiceMasterSchema() {
    if (!categoryServiceMasterSchemaReady) {
        categoryServiceMasterSchemaReady = pool.query(`
      create table if not exists zigo.category_service_masters (
        id uuid primary key default gen_random_uuid(),
        service_title text not null,
        service_subtitle text,
        static_value text,
        show_static_value boolean not null default true,
        icons jsonb not null default '[]'::jsonb,
        service_title_font_size integer not null default 18,
        service_title_font_weight integer not null default 400,
        service_title_color text not null default '',
        service_subtitle_font_size integer not null default 13,
        service_subtitle_font_weight integer not null default 400,
        service_subtitle_color text not null default '',
        booking_type text not null default 'both',
        show_eta boolean not null default false,
        service_position integer not null default 0,
        service_category_grid_size text not null default '3x3',
        is_enabled boolean not null default true,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.category_service_masters
        add column if not exists service_title text not null default '',
        add column if not exists service_subtitle text,
        add column if not exists static_value text,
        add column if not exists show_static_value boolean not null default true,
        add column if not exists icons jsonb not null default '[]'::jsonb,
        add column if not exists service_title_font_size integer not null default 18,
        add column if not exists service_title_font_weight integer not null default 400,
        add column if not exists service_title_color text not null default '',
        add column if not exists service_subtitle_font_size integer not null default 13,
        add column if not exists service_subtitle_font_weight integer not null default 400,
        add column if not exists service_subtitle_color text not null default '',
        add column if not exists booking_type text not null default 'both',
        add column if not exists show_eta boolean not null default false,
        add column if not exists service_position integer not null default 0,
        add column if not exists service_category_grid_size text not null default '3x3',
        add column if not exists is_enabled boolean not null default true,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_category_service_masters_active
        on zigo.category_service_masters(is_deleted, is_active, is_enabled, service_position);
    `).then(() => undefined).catch((error) => {
            categoryServiceMasterSchemaReady = null;
            throw error;
        });
    }
    await categoryServiceMasterSchemaReady;
}
function normalizeBookingTypeConfig(input) {
    const bookingType = input.bookingType === "schedule" ? "schedule" : "instant";
    const waitWindowMinutes = 0;
    const waitWindowNote = "";
    const timeCategories = normalizeBookingTimeCategories(input.timeCategories || []);
    const categorySlots = timeCategories.filter((category) => category.isActive).flatMap((category) => category.timeSlots);
    const timeSlots = [...new Set([...(input.timeSlots || []), ...categorySlots])]
        .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        .sort();
    return {
        instantMode: "manual",
        waitWindowMinutes,
        waitWindowNote,
        maxAdvanceDays: bookingType === "schedule" ? Math.max(1, Math.round(Number(input.maxAdvanceDays || 1))) : 0,
        allowedDays: bookingType === "schedule" ? [...new Set(input.allowedDays || [])].filter(Boolean) : [],
        timeCategories: bookingType === "schedule" ? timeCategories : [],
        timeSlots: bookingType === "schedule" ? timeSlots : []
    };
}
function normalizeBookingTimeCategories(categories) {
    return (categories || [])
        .map((category, index) => {
        const name = String(category.name || "").trim();
        const id = String(category.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `category_${index + 1}`).replace(/^_+|_+$/g, "");
        const sortOrder = Math.max(1, Math.round(Number(category.sortOrder || index + 1)));
        const isActive = category.isActive !== false;
        const timeSlots = [...new Set(category.timeSlots || [])]
            .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
            .sort();
        return { id: id || `category_${index + 1}`, name, sortOrder, isActive, timeSlots };
    })
        .filter((category) => category.name)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}
async function ensureBookingTypeSchema() {
    if (!bookingTypeSchemaReady) {
        bookingTypeSchemaReady = pool.query(`
      create table if not exists zigo.booking_type_masters (
        id uuid primary key default gen_random_uuid(),
        code text not null unique,
        name text not null,
        booking_type text not null default 'instant',
        config jsonb not null default '{}'::jsonb,
        is_default boolean not null default false,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      create index if not exists idx_booking_type_masters_active on zigo.booking_type_masters(is_deleted, is_active, booking_type);
    `).then(() => undefined).catch((error) => {
            bookingTypeSchemaReady = null;
            throw error;
        });
    }
    await bookingTypeSchemaReady;
}
async function ensureClusterServiceSchema() {
    if (!clusterServiceSchemaReady) {
        clusterServiceSchemaReady = pool.query(`
      create table if not exists zigo.cluster_service_settings (
        id uuid primary key default gen_random_uuid(),
        cluster_id uuid not null references zigo.clusters(id) on delete cascade,
        service_id uuid not null references zigo.services(id) on delete cascade,
        is_visible boolean not null default true,
        is_enabled boolean not null default true,
        is_active boolean not null default true,
        config jsonb not null default '{}'::jsonb,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false,
        unique (cluster_id, service_id)
      );

      create table if not exists zigo.cluster_category_settings (
        id uuid primary key default gen_random_uuid(),
        cluster_id uuid not null references zigo.clusters(id) on delete cascade,
        category_id uuid not null references zigo.categories(id) on delete cascade,
        is_visible boolean not null default true,
        is_enabled boolean not null default true,
        is_active boolean not null default true,
        config jsonb not null default '{}'::jsonb,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false,
        unique (cluster_id, category_id)
      );

      create index if not exists idx_cluster_service_settings_cluster on zigo.cluster_service_settings(cluster_id, is_deleted, is_active);
      create index if not exists idx_cluster_category_settings_cluster on zigo.cluster_category_settings(cluster_id, is_deleted, is_active);
    `).then(() => undefined).catch((error) => {
            clusterServiceSchemaReady = null;
            throw error;
        });
    }
    await clusterServiceSchemaReady;
    await pool.query("alter table zigo.cluster_service_settings add column if not exists config jsonb not null default '{}'::jsonb");
    await pool.query("alter table zigo.cluster_category_settings add column if not exists config jsonb not null default '{}'::jsonb");
}
async function ensureSurgeRuleSchema() {
    if (!surgeRuleSchemaReady) {
        surgeRuleSchemaReady = pool.query(`
      create table if not exists zigo.surge_rules (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        code text not null,
        rule_type text not null default 'time',
        days text[] not null default '{}',
        start_time time,
        end_time time,
        adjustment_type text not null default 'percent',
        adjustment_value numeric(12,2) not null default 0,
        priority integer not null default 0,
        metadata jsonb not null default '{}'::jsonb,
        is_enabled boolean not null default true,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false,
        unique (code)
      );
      create index if not exists idx_surge_rules_active on zigo.surge_rules(is_deleted, is_active, priority);
    `).then(() => undefined).catch((error) => {
            surgeRuleSchemaReady = null;
            throw error;
        });
    }
    await surgeRuleSchemaReady;
}
async function ensurePriceMasterSchema() {
    if (!priceMasterSchemaReady) {
        priceMasterSchemaReady = pool.query(`
      create table if not exists zigo.price_master_rules (
        id uuid primary key default gen_random_uuid(),
        price_type text not null default 'task',
        service_id uuid references zigo.services(id),
        category_id uuid references zigo.categories(id),
        store_id uuid references zigo.stores(id),
        base_price numeric(12,2) not null default 0,
        discount_type text not null default 'none',
        discount_value numeric(12,2) not null default 0,
        selling_price numeric(12,2) not null default 0,
        cart_added boolean not null default false,
        complexity_base text not null default 'none',
        complexity_multiplier numeric(12,4) not null default 0,
        complexity_slabs jsonb not null default '[]'::jsonb,
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        max_stores_per_category integer not null default 1,
        max_stores_total integer not null default 10,
        time_slabs jsonb not null default '[]'::jsonb,
        description text,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.price_master_rules
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists max_stores_per_category integer not null default 1,
        add column if not exists max_stores_total integer not null default 10,
        add column if not exists complexity_slabs jsonb not null default '[]'::jsonb,
        add column if not exists time_slabs jsonb not null default '[]'::jsonb;
      create index if not exists idx_price_master_rules_active on zigo.price_master_rules(is_deleted, is_active, price_type);
      create index if not exists idx_price_master_rules_scope on zigo.price_master_rules(service_id, category_id, store_id);
      create index if not exists idx_price_master_rules_location_scope on zigo.price_master_rules(scope_type, state_id, city_id, zone_id, cluster_id);
    `).then(() => undefined).catch((error) => {
            priceMasterSchemaReady = null;
            throw error;
        });
    }
    await priceMasterSchemaReady;
}
async function ensureCategoryPriceSchema() {
    if (!categoryPriceSchemaReady) {
        categoryPriceSchemaReady = pool.query(`
      create table if not exists zigo.category_price_rules (
        id uuid primary key default gen_random_uuid(),
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        category_id uuid not null references zigo.categories(id),
        time_duration_minutes integer not null default 0,
        base_price numeric(12,2) not null default 0,
        discount_type text not null default 'none',
        discount_value numeric(12,2) not null default 0,
        selling_price numeric(12,2) not null default 0,
        waiting_charge_amount numeric(12,2) not null default 0,
        waiting_charge_time_minutes integer not null default 0,
        available_for_duration boolean not null default true,
        available_for_extend boolean not null default false,
        available_for_expand boolean not null default false,
        is_duration_for_offers boolean not null default false,
        is_offer_eligible boolean not null default true,
        slab jsonb not null default '{}'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.category_price_rules
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists category_id uuid references zigo.categories(id),
        add column if not exists time_duration_minutes integer not null default 0,
        add column if not exists base_price numeric(12,2) not null default 0,
        add column if not exists discount_type text not null default 'none',
        add column if not exists discount_value numeric(12,2) not null default 0,
        add column if not exists selling_price numeric(12,2) not null default 0,
        add column if not exists waiting_charge_amount numeric(12,2) not null default 0,
        add column if not exists waiting_charge_time_minutes integer not null default 0,
        add column if not exists available_for_duration boolean not null default true,
        add column if not exists available_for_extend boolean not null default false,
        add column if not exists available_for_expand boolean not null default false,
        add column if not exists is_duration_for_offers boolean not null default false,
        add column if not exists is_offer_eligible boolean not null default true,
        add column if not exists slab jsonb not null default '{}'::jsonb,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_enabled boolean not null default true,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_category_price_rules_active on zigo.category_price_rules(is_deleted, is_active, is_enabled, category_id);
      create index if not exists idx_category_price_rules_location_scope on zigo.category_price_rules(scope_type, state_id, city_id, zone_id, cluster_id);
    `).then(() => undefined).catch((error) => {
            categoryPriceSchemaReady = null;
            throw error;
        });
    }
    await categoryPriceSchemaReady;
}
async function ensureBookingEngineRuleSchema() {
    if (!bookingEngineRuleSchemaReady) {
        bookingEngineRuleSchemaReady = pool.query(`
      create table if not exists zigo.booking_engine_rules (
        id uuid primary key default gen_random_uuid(),
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        category_id uuid references zigo.categories(id),
        service_control_mode text not null default 'manual',
        manual_service_status text not null default 'stop',
        auto_start_at timestamptz,
        auto_end_at timestamptz,
        auto_start_time text,
        auto_end_time text,
        instant_eta_minutes integer not null default 0,
        instant_initiate_minutes integer not null default 0,
        instant_wrap_up_minutes integer not null default 0,
        instant_travel_minutes integer not null default 0,
        schedule_eta_minutes integer not null default 0,
        schedule_initiate_minutes integer not null default 0,
        schedule_wrap_up_minutes integer not null default 0,
        schedule_travel_minutes integer not null default 0,
        assistant_assignment_mode text not null default 'manual',
        note text,
        image_url text,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.booking_engine_rules
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists category_id uuid references zigo.categories(id),
        add column if not exists service_control_mode text not null default 'manual',
        add column if not exists manual_service_status text not null default 'stop',
        add column if not exists auto_start_at timestamptz,
        add column if not exists auto_end_at timestamptz,
        add column if not exists auto_start_time text,
        add column if not exists auto_end_time text,
        add column if not exists instant_eta_minutes integer not null default 0,
        add column if not exists instant_initiate_minutes integer not null default 0,
        add column if not exists instant_wrap_up_minutes integer not null default 0,
        add column if not exists instant_travel_minutes integer not null default 0,
        add column if not exists schedule_eta_minutes integer not null default 0,
        add column if not exists schedule_initiate_minutes integer not null default 0,
        add column if not exists schedule_wrap_up_minutes integer not null default 0,
        add column if not exists schedule_travel_minutes integer not null default 0,
        add column if not exists assistant_assignment_mode text not null default 'manual',
        add column if not exists note text,
        add column if not exists image_url text,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_booking_engine_rules_active on zigo.booking_engine_rules(is_deleted, is_active, scope_type);
      create index if not exists idx_booking_engine_rules_scope on zigo.booking_engine_rules(scope_type, state_id, city_id, zone_id, cluster_id, category_id);
    `).then(() => undefined).catch((error) => {
            bookingEngineRuleSchemaReady = null;
            throw error;
        });
    }
    await bookingEngineRuleSchemaReady;
}
async function ensureBookingEngineQuickReplySchema() {
    if (!bookingEngineQuickReplySchemaReady) {
        bookingEngineQuickReplySchemaReady = pool.query(`
      create table if not exists zigo.booking_engine_quick_replies (
        id uuid primary key default gen_random_uuid(),
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        category_id uuid references zigo.categories(id),
        actor text not null default 'assistant',
        audience text not null default 'customer',
        booking_stage text not null default 'working',
        action_type text not null default 'message',
        title text not null,
        message text not null,
        sort_order integer not null default 0,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.booking_engine_quick_replies
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists category_id uuid references zigo.categories(id),
        add column if not exists actor text not null default 'assistant',
        add column if not exists audience text not null default 'customer',
        add column if not exists booking_stage text not null default 'working',
        add column if not exists action_type text not null default 'message',
        add column if not exists title text not null default '',
        add column if not exists message text not null default '',
        add column if not exists sort_order integer not null default 0,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_booking_engine_quick_replies_active
        on zigo.booking_engine_quick_replies(is_deleted, is_active, actor, booking_stage);
      create index if not exists idx_booking_engine_quick_replies_scope
        on zigo.booking_engine_quick_replies(scope_type, state_id, city_id, zone_id, cluster_id, category_id);
      create index if not exists idx_booking_engine_quick_replies_sort
        on zigo.booking_engine_quick_replies(actor, booking_stage, sort_order, title);
    `).then(() => undefined).catch((error) => {
            bookingEngineQuickReplySchemaReady = null;
            throw error;
        });
    }
    await bookingEngineQuickReplySchemaReady;
}
async function ensureTaxMasterSchema() {
    if (!taxMasterSchemaReady) {
        taxMasterSchemaReady = pool.query(`
      create table if not exists zigo.tax_master_rules (
        id uuid primary key default gen_random_uuid(),
        tax_applicable_on text not null default 'selling_price',
        tax_applicability text not null default 'exclusive',
        tax_type text not null default 'percent',
        tax_value numeric(12,2) not null default 0,
        formula text not null default '(Tax Applicable On Price x Tax Value / (100+tax value))',
        tax_label text not null,
        tax_note text,
        metadata jsonb not null default '{}'::jsonb,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.tax_master_rules
        add column if not exists tax_applicable_on text not null default 'selling_price',
        add column if not exists tax_applicability text not null default 'exclusive',
        add column if not exists tax_type text not null default 'percent',
        add column if not exists tax_value numeric(12,2) not null default 0,
        add column if not exists formula text not null default '(Tax Applicable On Price x Tax Value / (100+tax value))',
        add column if not exists tax_label text not null default 'Tax',
        add column if not exists tax_note text,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create index if not exists idx_tax_master_rules_active on zigo.tax_master_rules(is_deleted, is_active, created_at desc);
    `).then(() => undefined).catch((error) => {
            taxMasterSchemaReady = null;
            throw error;
        });
    }
    await taxMasterSchemaReady;
}
async function ensurePaymentModeSchema() {
    if (!paymentModeSchemaReady) {
        paymentModeSchemaReady = pool.query(`
      create table if not exists zigo.payment_mode_masters (
        id uuid primary key default gen_random_uuid(),
        code text not null,
        name text not null,
        scope_type text not null default 'all',
        state_id uuid references zigo.states(id),
        city_id uuid references zigo.cities(id),
        zone_id uuid references zigo.zones(id),
        cluster_id uuid references zigo.clusters(id),
        sort_order integer not null default 0,
        description text,
        metadata jsonb not null default '{}'::jsonb,
        is_enabled boolean not null default true,
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.payment_mode_masters
        add column if not exists code text not null default '',
        add column if not exists name text not null default '',
        add column if not exists scope_type text not null default 'all',
        add column if not exists state_id uuid references zigo.states(id),
        add column if not exists city_id uuid references zigo.cities(id),
        add column if not exists zone_id uuid references zigo.zones(id),
        add column if not exists cluster_id uuid references zigo.clusters(id),
        add column if not exists sort_order integer not null default 0,
        add column if not exists description text,
        add column if not exists metadata jsonb not null default '{}'::jsonb,
        add column if not exists is_enabled boolean not null default true,
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create unique index if not exists ux_payment_mode_masters_scope_code
        on zigo.payment_mode_masters(lower(code), scope_type, coalesce(state_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid))
        where coalesce(is_deleted, false) = false;
      create index if not exists idx_payment_mode_masters_active
        on zigo.payment_mode_masters(is_deleted, is_active, is_enabled, scope_type, sort_order);
    `).then(() => undefined).catch((error) => {
            paymentModeSchemaReady = null;
            throw error;
        });
    }
    await paymentModeSchemaReady;
}
export async function listStates() {
    const result = await pool.query(`
    select id, code, name, country_name as "countryName", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    from zigo.states
    where is_deleted = false
    order by name
  `);
    return result.rows;
}
export async function createState(input) {
    const result = await pool.query(`
      insert into zigo.states (code, name, country_name, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $5)
      returning id
    `, [input.code, input.name, input.countryName ?? "India", input.isActive ?? true, input.userId]);
    return result.rows[0];
}
export async function updateState(id, input) {
    const result = await pool.query(`
      update zigo.states
      set code = $2, name = $3, country_name = $4, is_active = $5, updated_by = $6, updated_at = now()
      where id = $1 and is_deleted = false
      returning id
    `, [id, input.code, input.name, input.countryName ?? "India", input.isActive ?? true, input.userId]);
    return result.rows[0] ?? null;
}
export async function deleteState(id, userId) {
    return softDelete("zigo.states", id, userId);
}
export async function listBookingTypes() {
    await ensureBookingTypeSchema();
    const result = await pool.query(`
    select id, code, name, booking_type as "bookingType",
      'manual' as "instantMode",
      coalesce((config->>'waitWindowMinutes')::int, 0) as "waitWindowMinutes",
      coalesce(config->>'waitWindowNote', '') as "waitWindowNote",
      coalesce((config->>'maxAdvanceDays')::int, 0) as "maxAdvanceDays",
      coalesce(config->'allowedDays', '[]'::jsonb) as "allowedDays",
      coalesce(config->'timeCategories', '[]'::jsonb) as "timeCategories",
      coalesce(config->'timeSlots', '[]'::jsonb) as "timeSlots",
      is_default as "isDefault",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from zigo.booking_type_masters
    where coalesce(is_deleted, false) = false
    order by is_default desc, booking_type, name
  `);
    return result.rows;
}
export async function createBookingType(input) {
    await ensureBookingTypeSchema();
    const auditUserId = await existingAuditUserId(input.userId);
    const config = normalizeBookingTypeConfig(input);
    const result = await pool.query(`
      insert into zigo.booking_type_masters (code, name, booking_type, config, is_default, is_active, created_by, updated_by)
      values ($1, $2, $3, $4::jsonb, $5, $6, $7, $7)
      returning id
    `, [input.code.trim(), input.name.trim(), input.bookingType, JSON.stringify(config), input.isDefault ?? false, input.isActive ?? true, auditUserId]);
    if (input.isDefault)
        await setOnlyDefaultBookingType(result.rows[0].id);
    return result.rows[0];
}
export async function updateBookingType(id, input) {
    await ensureBookingTypeSchema();
    const auditUserId = await existingAuditUserId(input.userId);
    const config = normalizeBookingTypeConfig(input);
    const result = await pool.query(`
      update zigo.booking_type_masters
      set code = $2, name = $3, booking_type = $4, config = $5::jsonb, is_default = $6,
          is_active = $7, updated_by = $8, updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [id, input.code.trim(), input.name.trim(), input.bookingType, JSON.stringify(config), input.isDefault ?? false, input.isActive ?? true, auditUserId]);
    if (result.rows[0] && input.isDefault)
        await setOnlyDefaultBookingType(id);
    return result.rows[0] ?? null;
}
async function setOnlyDefaultBookingType(id) {
    await pool.query(`update zigo.booking_type_masters set is_default = (id = $1::uuid) where coalesce(is_deleted, false) = false`, [id]);
}
export async function deleteBookingType(id, userId) {
    await ensureBookingTypeSchema();
    return softDelete("zigo.booking_type_masters", id, userId);
}
export async function listCities() {
    const result = await pool.query(`
    select
      c.id,
      c.state_id as "stateId",
      s.name as "stateName",
      c.code,
      c.name,
      c.is_active as "isActive",
      (c.is_active = true and coalesce(s.is_active, true) = true and coalesce(s.is_deleted, false) = false) as "isUsable",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt"
    from zigo.cities c
    left join zigo.states s on s.id = c.state_id
    where c.is_deleted = false
    order by c.name
  `);
    return result.rows;
}
export async function createCity(input) {
    if (input.stateId)
        await assertActiveRecord("zigo.states", input.stateId, "State");
    const result = await pool.query(`
      insert into zigo.cities (state_id, code, name, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $5)
      returning id
    `, [input.stateId ?? null, input.code, input.name, input.isActive ?? true, input.userId]);
    return result.rows[0];
}
export async function updateCity(id, input) {
    if (input.stateId)
        await assertActiveRecord("zigo.states", input.stateId, "State");
    const result = await pool.query(`
      update zigo.cities
      set state_id = $2, code = $3, name = $4, is_active = $5, updated_by = $6, updated_at = now()
      where id = $1 and is_deleted = false
      returning id
    `, [id, input.stateId ?? null, input.code, input.name, input.isActive ?? true, input.userId]);
    return result.rows[0] ?? null;
}
export async function deleteCity(id, userId) {
    return softDelete("zigo.cities", id, userId);
}
export async function listZones() {
    const result = await pool.query(`
    select
      z.id,
      z.city_id as "cityId",
      c.name as "cityName",
      z.code,
      z.name,
      z.is_active as "isActive",
      (z.is_active = true and c.is_active = true and coalesce(c.is_deleted, false) = false and coalesce(s.is_active, true) = true and coalesce(s.is_deleted, false) = false) as "isUsable",
      z.created_at as "createdAt",
      z.updated_at as "updatedAt"
    from zigo.zones z
    left join zigo.cities c on c.id = z.city_id
    left join zigo.states s on s.id = c.state_id
    where z.is_deleted = false
    order by z.name
  `);
    return result.rows;
}
export async function createZone(input) {
    if (input.cityId)
        await assertUsableCity(input.cityId);
    const result = await pool.query(`
      insert into zigo.zones (city_id, code, name, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $5)
      returning id
    `, [input.cityId ?? null, input.code, input.name, input.isActive ?? true, input.userId]);
    return result.rows[0];
}
export async function updateZone(id, input) {
    if (input.cityId)
        await assertUsableCity(input.cityId);
    const result = await pool.query(`
      update zigo.zones
      set city_id = $2, code = $3, name = $4, is_active = $5, updated_by = $6, updated_at = now()
      where id = $1 and is_deleted = false
      returning id
    `, [id, input.cityId ?? null, input.code, input.name, input.isActive ?? true, input.userId]);
    return result.rows[0] ?? null;
}
export async function deleteZone(id, userId) {
    return deleteLocationHierarchy("zones", id, userId);
}
export async function listClusters() {
    const result = await pool.query(`
    select
      c.id,
      c.city_id as "cityId",
      city.name as "cityName",
      c.zone_id as "zoneId",
      z.name as "zoneName",
      c.name,
      c.code,
      c.description,
      c.areas_description as "areasDescription",
      c.polygon_description as "polygonDescription",
      c.priority,
      c.operating_hours->>'startTime' as "startTime",
      c.operating_hours->>'endTime' as "endTime",
      coalesce((c.metadata->>'isPinned')::boolean, false) as "isPinned",
      coalesce((c.metadata->>'pinPriority')::int, 0) as "pinPriority",
      c.status_id as "statusId",
      c.launch_stage_id as "launchStageId",
      c.is_booking_enabled as "isBookingEnabled",
      c.operating_hours as "operatingHours",
      c.metadata,
      (
        coalesce(c.is_deleted, false) = false
        and city.is_active = true
        and coalesce(city.is_deleted, false) = false
        and coalesce(state.is_active, true) = true
        and coalesce(state.is_deleted, false) = false
        and (c.zone_id is null or (z.is_active = true and coalesce(z.is_deleted, false) = false))
      ) as "isUsable",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt"
    from zigo.clusters c
    left join zigo.cities city on city.id = c.city_id
    left join zigo.zones z on z.id = c.zone_id
    left join zigo.states state on state.id = city.state_id
    where coalesce(c.is_deleted, false) = false
    order by coalesce((c.metadata->>'isPinned')::boolean, false) desc, coalesce((c.metadata->>'pinPriority')::int, 0), c.priority, c.name
  `);
    return result.rows;
}
export async function listClusterReport(filters) {
    const where = ["coalesce(c.is_deleted, false) = false"];
    const values = [];
    const add = (sql, value) => {
        values.push(value);
        where.push(sql.replace("?", `$${values.length}`));
    };
    if (filters.search) {
        const search = filters.search.trim();
        values.push(`%${search}%`);
        const idx = values.length;
        const searchWhere = [`c.name ilike $${idx}`, `c.code ilike $${idx}`, `city.name ilike $${idx}`, `z.name ilike $${idx}`, `coalesce(c.areas_description, '') ilike $${idx}`];
        if (/^[0-9a-f-]{8,}$/i.test(search))
            searchWhere.push(`c.id::text ilike $${idx}`);
        where.push(`(${searchWhere.join(" or ")})`);
    }
    if (filters.cityId)
        add("c.city_id = ?", filters.cityId);
    if (filters.zoneId)
        add("c.zone_id = ?", filters.zoneId);
    if (filters.status === "active")
        where.push("c.is_booking_enabled = true");
    if (filters.status === "inactive")
        where.push("c.is_booking_enabled = false");
    const offset = (filters.page - 1) * filters.pageSize;
    const count = await pool.query(`
      select count(*)::int as total
      from zigo.clusters c
      left join zigo.cities city on city.id = c.city_id
      left join zigo.zones z on z.id = c.zone_id
      where ${where.join(" and ")}
    `, values);
    const result = await pool.query(`
      select
        c.id as "clusterId",
        c.id,
        c.name as "clusterName",
        c.name,
        c.code,
        c.city_id as "cityId",
        city.name as "cityName",
        c.zone_id as "zoneId",
        z.name as "zoneName",
        c.areas_description as areas,
        c.areas_description as "areasDescription",
        c.description,
        c.polygon_description as "polygonDescription",
        c.operating_hours->>'startTime' as "startTime",
        c.operating_hours->>'endTime' as "endTime",
        c.is_booking_enabled as "isBookingEnabled",
        c.priority,
        coalesce((c.metadata->>'isPinned')::boolean, false) as "isPinned",
        coalesce((c.metadata->>'pinPriority')::int, 0) as "pinPriority",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      from zigo.clusters c
      left join zigo.cities city on city.id = c.city_id
      left join zigo.zones z on z.id = c.zone_id
      where ${where.join(" and ")}
      order by coalesce((c.metadata->>'isPinned')::boolean, false) desc,
               coalesce((c.metadata->>'pinPriority')::int, 0),
               c.priority,
               c.name
      limit $${values.length + 1} offset $${values.length + 2}
    `, [...values, filters.pageSize, offset]);
    const totalRecords = count.rows[0]?.total ?? 0;
    return {
        data: result.rows,
        pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            totalRecords,
            totalPages: Math.max(1, Math.ceil(totalRecords / filters.pageSize))
        }
    };
}
export async function createCluster(input) {
    await assertUsableCity(input.cityId);
    if (input.zoneId)
        await assertUsableZone(input.zoneId);
    const result = await pool.query(`
      insert into zigo.clusters
        (city_id, zone_id, name, code, description, areas_description, polygon_description, priority, is_booking_enabled, operating_hours, metadata, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, jsonb_build_object('startTime', $10::text, 'endTime', $11::text), jsonb_build_object('isPinned', $12::boolean, 'pinPriority', $13::int), $14, $14)
      returning id
    `, [
        input.cityId,
        input.zoneId ?? null,
        input.name,
        input.code,
        input.description ?? null,
        input.areasDescription ?? null,
        input.polygonDescription ?? null,
        input.priority ?? 0,
        input.isBookingEnabled ?? false,
        input.startTime ?? null,
        input.endTime ?? null,
        input.isPinned ?? false,
        input.pinPriority ?? 0,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateCluster(id, input) {
    await assertUsableCity(input.cityId);
    if (input.zoneId)
        await assertUsableZone(input.zoneId);
    const result = await pool.query(`
      update zigo.clusters
      set city_id = $2,
          zone_id = $3,
          name = $4,
          code = $5,
          description = $6,
          areas_description = $7,
          polygon_description = $8,
          priority = $9,
          is_booking_enabled = $10,
          operating_hours = coalesce(operating_hours, '{}'::jsonb) || jsonb_build_object('startTime', $11::text, 'endTime', $12::text),
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('isPinned', $13::boolean, 'pinPriority', $14::int),
          updated_by = $15,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        input.cityId,
        input.zoneId ?? null,
        input.name,
        input.code,
        input.description ?? null,
        input.areasDescription ?? null,
        input.polygonDescription ?? null,
        input.priority ?? 0,
        input.isBookingEnabled ?? false,
        input.startTime ?? null,
        input.endTime ?? null,
        input.isPinned ?? false,
        input.pinPriority ?? 0,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteCluster(id, userId) {
    return deleteLocationHierarchy("clusters", id, userId);
}
export async function listServices() {
    const result = await pool.query(`
    select
      id,
      code,
      name,
      description,
      image_url as "imageUrl",
      coalesce(metadata->'pricing'->>'priceType', 'task') as "priceType",
      coalesce(metadata->'bookingLocation'->>'mode', 'current') as "locationMode",
      coalesce(nullif(metadata->'bookingLocation'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
      priority,
      is_recommended as "isRecommended",
      is_enabled as "isEnabled",
      is_active as "isActive",
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from zigo.services
    where is_deleted = false
    order by priority, sort_order, name
  `);
    return result.rows;
}
export async function createService(input) {
    const result = await pool.query(`
      insert into zigo.services
        (code, name, description, image_url, priority, is_recommended, is_enabled, sort_order, is_active, metadata, created_by, updated_by)
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        jsonb_build_object(
          'bookingLocation', jsonb_build_object('mode', $10::text, 'maxLocationsLimit', $11::int)
        ),
        $12, $12
      )
      returning id
    `, [
        input.code,
        input.name,
        input.description ?? null,
        input.imageUrl ?? null,
        input.priority ?? input.sortOrder ?? 0,
        input.isRecommended ?? false,
        input.isEnabled ?? true,
        input.sortOrder ?? input.priority ?? 0,
        input.isActive ?? true,
        input.locationMode === "multi" ? "multi" : "current",
        input.locationMode === "multi" ? Math.max(1, Number(input.maxLocationsLimit ?? 1)) : 1,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateService(id, input) {
    const result = await pool.query(`
      update zigo.services
      set code = $2,
          name = $3,
          description = $4,
          image_url = $5,
          priority = $6,
          is_recommended = $7,
          is_enabled = $8,
          sort_order = $9,
          is_active = $10,
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'bookingLocation', jsonb_build_object('mode', $11::text, 'maxLocationsLimit', $12::int)
            ),
          updated_by = $13,
          updated_at = now()
      where id = $1 and is_deleted = false
      returning id
    `, [
        id,
        input.code,
        input.name,
        input.description ?? null,
        input.imageUrl ?? null,
        input.priority ?? input.sortOrder ?? 0,
        input.isRecommended ?? false,
        input.isEnabled ?? true,
        input.sortOrder ?? input.priority ?? 0,
        input.isActive ?? true,
        input.locationMode === "multi" ? "multi" : "current",
        input.locationMode === "multi" ? Math.max(1, Number(input.maxLocationsLimit ?? 1)) : 1,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteService(id, userId) {
    return softDelete("zigo.services", id, userId);
}
function normalizeMasterCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
}
async function generateUniqueCategoryCode(requestedCode, name, excludeId) {
    const base = normalizeMasterCode(requestedCode || name) || "CATEGORY";
    let candidate = base;
    for (let suffix = 2; suffix < 1000; suffix++) {
        const result = await pool.query(`
        select id
        from zigo.categories
        where lower(code) = lower($1)
          and coalesce(is_deleted, false) = false
          and ($2::uuid is null or id <> $2::uuid)
        limit 1
      `, [candidate, excludeId ?? null]);
        if (!result.rows[0])
            return candidate;
        candidate = `${base}_${suffix}`;
    }
    throw new HttpError(409, `Could not generate a unique code for "${name}". Please enter a user-defined code.`);
}
function normalizeTextList(values) {
    return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}
function buildCategoryGuidance(input) {
    return {
        taskListTitle: String(input.taskListTitle || "Tasks related to category").trim() || "Tasks related to category",
        taskList: normalizeTextList(input.taskList),
        canDoTitle: String(input.canDoTitle || "What Assistant can do").trim() || "What Assistant can do",
        canDoList: normalizeTextList(input.canDoList),
        cantDoTitle: String(input.cantDoTitle || "What Assistant can't do").trim() || "What Assistant can't do",
        cantDoList: normalizeTextList(input.cantDoList)
    };
}
function normalizeCategoryImageUrls(values, primary) {
    return [...new Set([primary, ...(Array.isArray(values) ? values : [])]
            .map((value) => String(value || "").trim())
            .filter(Boolean))];
}
export async function listCategories() {
    await ensureCategoryServiceMasterSchema();
    const result = await pool.query(`
    select
      c.id,
      c.service_id as "serviceId",
      s.name as "serviceName",
      nullif(c.config->'categorySettings'->>'serviceMasterId', '') as "serviceMasterId",
      csm.service_title as "serviceMasterName",
      c.parent_category_id as "parentCategoryId",
      c.code,
      c.name,
      c.description,
      c.image_url as "imageUrl",
      coalesce(c.config->'categorySettings'->'imageUrls', '[]'::jsonb) as "imageUrls",
      c.priority,
      c.is_recommended as "isRecommended",
      c.is_enabled as "isEnabled",
      c.config->'categorySettings'->>'note' as "note",
      coalesce(c.config->'categorySettings'->>'locationMode', 'current') as "locationMode",
      coalesce(nullif(c.config->'categorySettings'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
      coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) as "showInHomePage",
      coalesce(c.config->'categorySettings'->>'homeDisplayMode', case when coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) then 'category' else 'categoryPrice' end) as "homeDisplayMode",
      coalesce(nullif(c.config->'categorySettings'->>'categoryImageHeight', '')::int, 0) as "categoryImageHeight",
      coalesce(nullif(c.config->'categorySettings'->>'categoryImageWidth', '')::int, 0) as "categoryImageWidth",
      coalesce(c.config->'categorySettings'->>'priceDisplayMode', 'row') as "priceDisplayMode",
      coalesce(nullif(c.config->'categorySettings'->>'priceGridRows', '')::int, 3) as "priceGridRows",
      coalesce(nullif(c.config->'categorySettings'->>'priceGridColumns', '')::int, 3) as "priceGridColumns",
      coalesce(c.config->'categorySettings'->>'supplyUnavailableAction', '') as "supplyUnavailableAction",
      c.config->'categorySettings'->>'supplyUnavailableMessage' as "supplyUnavailableMessage",
      coalesce((c.config->'categorySettings'->>'addWithOtherCategory')::boolean, false) as "addWithOtherCategory",
      coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
      c.config->'categorySettings'->>'expandTitle' as "expandTitle",
      coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
      c.config->'categorySettings'->>'expandDescription' as "expandDescription",
      coalesce(c.config->'categoryGuidance'->>'taskListTitle', 'Tasks related to category') as "taskListTitle",
      coalesce(c.config->'categoryGuidance'->'taskList', '[]'::jsonb) as "taskList",
      coalesce(c.config->'categoryGuidance'->>'canDoTitle', 'What Assistant can do') as "canDoTitle",
      coalesce(c.config->'categoryGuidance'->'canDoList', '[]'::jsonb) as "canDoList",
      coalesce(c.config->'categoryGuidance'->>'cantDoTitle', 'What Assistant can''t do') as "cantDoTitle",
      coalesce(c.config->'categoryGuidance'->'cantDoList', '[]'::jsonb) as "cantDoList",
      c.is_active as "isActive",
      (
        c.is_active = true
        and c.is_enabled = true
        and coalesce(s.is_active, true) = true
        and coalesce(s.is_enabled, true) = true
        and coalesce(s.is_deleted, false) = false
        and (
          c.parent_category_id is null
          or (
            p.is_active = true
            and p.is_enabled = true
            and coalesce(p.is_deleted, false) = false
            and coalesce(ps.is_active, true) = true
            and coalesce(ps.is_enabled, true) = true
            and coalesce(ps.is_deleted, false) = false
          )
        )
      ) as "isUsable",
      c.status_id as "statusId",
      c.sort_order as "sortOrder",
      c.config,
      coalesce((c.config->'pricing'->>'basePrice')::numeric, 0) as "basePrice",
      coalesce(c.config->'pricing'->>'discountType', 'none') as "discountType",
      coalesce((c.config->'pricing'->>'discountValue')::numeric, 0) as "discountValue",
      c.config->'pricing'->>'discountLabel' as "discountLabel",
      coalesce((c.config->'pricing'->>'sellingPrice')::numeric, 0) as "sellingPrice",
      coalesce(c.config->'pricing'->'surgeRules', '[]'::jsonb) as "surgeRules",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt"
    from zigo.categories c
    left join zigo.services s on s.id = c.service_id
    left join zigo.category_service_masters csm on csm.id = nullif(c.config->'categorySettings'->>'serviceMasterId', '')::uuid
      and coalesce(csm.is_deleted, false) = false
    left join zigo.categories p on p.id = c.parent_category_id
    left join zigo.services ps on ps.id = p.service_id
    where coalesce(c.is_deleted, false) = false
    order by c.priority, c.sort_order, c.name
  `);
    return result.rows;
}
export async function createCategory(input) {
    if (input.serviceId)
        await assertUsableService(input.serviceId);
    if (input.serviceMasterId)
        await assertUsableCategoryServiceMaster(input.serviceMasterId);
    if (input.parentCategoryId)
        await assertUsableCategory(input.parentCategoryId);
    const name = String(input.name || "").trim();
    const code = await generateUniqueCategoryCode(input.code, name);
    const imageUrls = normalizeCategoryImageUrls(input.imageUrls, input.imageUrl);
    const result = await pool.query(`
      insert into zigo.categories
        (service_id, parent_category_id, code, name, description, image_url, priority, is_recommended, is_enabled, sort_order, is_active, config, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
      returning id
    `, [
        input.serviceId ?? null,
        input.parentCategoryId ?? null,
        code,
        name,
        input.description ?? null,
        imageUrls[0] ?? input.imageUrl ?? null,
        input.priority ?? input.sortOrder ?? 0,
        input.isRecommended ?? false,
        input.isEnabled ?? true,
        input.sortOrder ?? input.priority ?? 0,
        input.isActive ?? true,
        JSON.stringify({
            pricing: buildCategoryPricing(input),
            categorySettings: {
                serviceMasterId: input.serviceMasterId ?? null,
                imageUrls,
                note: input.note ?? null,
                locationMode: input.locationMode === "multi" ? "multi" : "current",
                maxLocationsLimit: input.locationMode === "multi" ? Math.max(1, Number(input.maxLocationsLimit ?? 1)) : 1,
                showInHomePage: (input.homeDisplayMode || (input.showInHomePage === false ? "categoryPrice" : "category")) === "category",
                homeDisplayMode: input.homeDisplayMode === "categoryPrice" ? "categoryPrice" : "category",
                categoryImageHeight: input.homeDisplayMode === "categoryPrice" ? 0 : Math.max(0, Math.min(600, Math.round(Number(input.categoryImageHeight ?? 0)))),
                categoryImageWidth: input.homeDisplayMode === "categoryPrice" ? 0 : Math.max(0, Math.min(600, Math.round(Number(input.categoryImageWidth ?? 0)))),
                priceDisplayMode: input.priceDisplayMode === "grid" ? "grid" : "row",
                priceGridRows: Math.max(1, Math.min(10, Math.round(Number(input.priceGridRows ?? 3)))),
                priceGridColumns: Math.max(1, Math.min(10, Math.round(Number(input.priceGridColumns ?? 3)))),
                supplyUnavailableAction: input.homeDisplayMode === "categoryPrice" ? (["auto_hide", "show_popup", "redirect_schedule"].includes(String(input.supplyUnavailableAction || "")) ? input.supplyUnavailableAction : "") : "",
                supplyUnavailableMessage: input.homeDisplayMode === "categoryPrice" && input.supplyUnavailableAction === "show_popup" ? input.supplyUnavailableMessage ?? null : null,
                addWithOtherCategory: Boolean(input.addWithOtherCategory),
                expandPriority: Math.max(0, Number(input.expandPriority ?? 0)),
                expandTitle: input.expandTitle ?? null,
                expandDuration: input.expandDuration ?? input.expandDescription ?? null,
                expandDescription: input.expandDescription ?? input.expandDuration ?? null
            },
            categoryGuidance: buildCategoryGuidance(input)
        }),
        input.userId
    ]);
    return result.rows[0];
}
export async function updateCategory(id, input) {
    if (input.serviceId)
        await assertUsableService(input.serviceId);
    if (input.serviceMasterId)
        await assertUsableCategoryServiceMaster(input.serviceMasterId);
    if (input.parentCategoryId)
        await assertUsableCategory(input.parentCategoryId);
    const name = String(input.name || "").trim();
    const code = await generateUniqueCategoryCode(input.code, name, id);
    const imageUrls = normalizeCategoryImageUrls(input.imageUrls, input.imageUrl);
    const result = await pool.query(`
      update zigo.categories
      set service_id = $2,
          parent_category_id = $3,
          code = $4,
          name = $5,
          description = $6,
          image_url = $7,
          priority = $8,
          is_recommended = $9,
          is_enabled = $10,
          sort_order = $11,
          is_active = $12,
          config = jsonb_set(coalesce(config, '{}'::jsonb), '{pricing}', $13::jsonb, true),
          updated_by = $14,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        input.serviceId ?? null,
        input.parentCategoryId ?? null,
        code,
        name,
        input.description ?? null,
        imageUrls[0] ?? input.imageUrl ?? null,
        input.priority ?? input.sortOrder ?? 0,
        input.isRecommended ?? false,
        input.isEnabled ?? true,
        input.sortOrder ?? input.priority ?? 0,
        input.isActive ?? true,
        JSON.stringify(buildCategoryPricing(input)),
        input.userId
    ]);
    if (result.rows[0]) {
        await pool.query(`
        update zigo.categories
        set config = jsonb_set(
          coalesce(config, '{}'::jsonb),
          '{categorySettings}',
          $2::jsonb,
          true
        )
        where id = $1
      `, [
            id,
            JSON.stringify({
                serviceMasterId: input.serviceMasterId ?? null,
                imageUrls,
                note: input.note ?? null,
                locationMode: input.locationMode === "multi" ? "multi" : "current",
                maxLocationsLimit: input.locationMode === "multi" ? Math.max(1, Number(input.maxLocationsLimit ?? 1)) : 1,
                showInHomePage: (input.homeDisplayMode || (input.showInHomePage === false ? "categoryPrice" : "category")) === "category",
                homeDisplayMode: input.homeDisplayMode === "categoryPrice" ? "categoryPrice" : "category",
                categoryImageHeight: input.homeDisplayMode === "categoryPrice" ? 0 : Math.max(0, Math.min(600, Math.round(Number(input.categoryImageHeight ?? 0)))),
                categoryImageWidth: input.homeDisplayMode === "categoryPrice" ? 0 : Math.max(0, Math.min(600, Math.round(Number(input.categoryImageWidth ?? 0)))),
                priceDisplayMode: input.priceDisplayMode === "grid" ? "grid" : "row",
                priceGridRows: Math.max(1, Math.min(10, Math.round(Number(input.priceGridRows ?? 3)))),
                priceGridColumns: Math.max(1, Math.min(10, Math.round(Number(input.priceGridColumns ?? 3)))),
                supplyUnavailableAction: input.homeDisplayMode === "categoryPrice" ? (["auto_hide", "show_popup", "redirect_schedule"].includes(String(input.supplyUnavailableAction || "")) ? input.supplyUnavailableAction : "") : "",
                supplyUnavailableMessage: input.homeDisplayMode === "categoryPrice" && input.supplyUnavailableAction === "show_popup" ? input.supplyUnavailableMessage ?? null : null,
                addWithOtherCategory: Boolean(input.addWithOtherCategory),
                expandPriority: Math.max(0, Number(input.expandPriority ?? 0)),
                expandTitle: input.expandTitle ?? null,
                expandDuration: input.expandDuration ?? input.expandDescription ?? null,
                expandDescription: input.expandDescription ?? input.expandDuration ?? null
            })
        ]);
        await pool.query(`
        update zigo.categories
        set config = jsonb_set(
          coalesce(config, '{}'::jsonb),
          '{categoryGuidance}',
          $2::jsonb,
          true
        )
        where id = $1
      `, [id, JSON.stringify(buildCategoryGuidance(input))]);
    }
    return result.rows[0] ?? null;
}
export async function deleteCategory(id, userId) {
    return softDelete("zigo.categories", id, userId);
}
export async function listCategoryServiceMasters() {
    await ensureCategoryServiceMasterSchema();
    const result = await pool.query(`
    select
      id,
      service_title as "serviceTitle",
      service_subtitle as "serviceSubtitle",
      coalesce(icons, '[]'::jsonb) as "icons",
      coalesce(service_title_font_size, 18) as "serviceTitleFontSize",
      coalesce(service_title_font_weight, 400) as "serviceTitleFontWeight",
      coalesce(service_title_color, '') as "serviceTitleColor",
      coalesce(service_subtitle_font_size, 13) as "serviceSubtitleFontSize",
      coalesce(service_subtitle_font_weight, 400) as "serviceSubtitleFontWeight",
      coalesce(service_subtitle_color, '') as "serviceSubtitleColor",
      coalesce(booking_type, 'both') as "bookingType",
      coalesce(show_eta, false) as "showEta",
      service_position as "servicePosition",
      coalesce(service_category_grid_size, '3x3') as "serviceCategoryGridSize",
      is_enabled as "isEnabled",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from zigo.category_service_masters
    where coalesce(is_deleted, false) = false
    order by service_position, service_title
  `);
    return result.rows;
}
export async function createCategoryServiceMaster(input) {
    await ensureCategoryServiceMasterSchema();
    const result = await pool.query(`
      insert into zigo.category_service_masters
        (service_title, service_subtitle, static_value, show_static_value, icons, service_title_font_size, service_title_font_weight, service_title_color, service_subtitle_font_size, service_subtitle_font_weight, service_subtitle_color, booking_type, show_eta, service_position, service_category_grid_size, is_enabled, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
      returning id
    `, [
        String(input.serviceTitle || "").trim(),
        input.serviceSubtitle ?? null,
        null,
        false,
        JSON.stringify(normalizeCategoryServiceMasterIcons(input.icons)),
        normalizeServiceFontSize(input.serviceTitleFontSize, 18),
        normalizeServiceFontWeight(input.serviceTitleFontWeight, 400),
        normalizeServiceTextColor(input.serviceTitleColor),
        normalizeServiceFontSize(input.serviceSubtitleFontSize, 13),
        normalizeServiceFontWeight(input.serviceSubtitleFontWeight, 400),
        normalizeServiceTextColor(input.serviceSubtitleColor),
        normalizeServiceMasterBookingType(input.bookingType),
        Boolean(input.showEta),
        Math.max(0, Math.round(Number(input.servicePosition || 0))),
        normalizeServiceCategoryGridSize(input.serviceCategoryGridSize),
        input.isEnabled !== false,
        input.isActive !== false,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function updateCategoryServiceMaster(id, input) {
    await ensureCategoryServiceMasterSchema();
    const result = await pool.query(`
      update zigo.category_service_masters
      set service_title = $2,
          service_subtitle = $3,
          static_value = $4,
          show_static_value = $5,
          icons = $6::jsonb,
          service_title_font_size = $7,
          service_title_font_weight = $8,
          service_title_color = $9,
          service_subtitle_font_size = $10,
          service_subtitle_font_weight = $11,
          service_subtitle_color = $12,
          booking_type = $13,
          show_eta = $14,
          service_position = $15,
          service_category_grid_size = $16,
          is_enabled = $17,
          is_active = $18,
          updated_by = $19,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        String(input.serviceTitle || "").trim(),
        input.serviceSubtitle ?? null,
        null,
        false,
        JSON.stringify(normalizeCategoryServiceMasterIcons(input.icons)),
        normalizeServiceFontSize(input.serviceTitleFontSize, 18),
        normalizeServiceFontWeight(input.serviceTitleFontWeight, 400),
        normalizeServiceTextColor(input.serviceTitleColor),
        normalizeServiceFontSize(input.serviceSubtitleFontSize, 13),
        normalizeServiceFontWeight(input.serviceSubtitleFontWeight, 400),
        normalizeServiceTextColor(input.serviceSubtitleColor),
        normalizeServiceMasterBookingType(input.bookingType),
        Boolean(input.showEta),
        Math.max(0, Math.round(Number(input.servicePosition || 0))),
        normalizeServiceCategoryGridSize(input.serviceCategoryGridSize),
        input.isEnabled !== false,
        input.isActive !== false,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteCategoryServiceMaster(id, userId) {
    await ensureCategoryServiceMasterSchema();
    return softDelete("zigo.category_service_masters", id, userId);
}
export async function listSurgeRules() {
    await ensureSurgeRuleSchema();
    const result = await pool.query(`
    select
      id,
      name,
      code,
      rule_type as "ruleType",
      days,
      to_char(start_time, 'HH24:MI') as "startTime",
      to_char(end_time, 'HH24:MI') as "endTime",
      adjustment_type as "adjustmentType",
      adjustment_value as "adjustmentValue",
      priority,
      metadata,
      coalesce(metadata->>'scheduleMode', 'date_time') as "scheduleMode",
      coalesce(metadata->'selectedDates', '[]'::jsonb) as "selectedDates",
      coalesce(metadata->'dateTimes', '[]'::jsonb) as "dateTimes",
      coalesce(metadata->'dayTimes', '{}'::jsonb) as "dayTimes",
      coalesce(metadata->'weeklyCalendar', '{}'::jsonb) as "weeklyCalendar",
      coalesce(metadata->'demandSlabs', '[]'::jsonb) as "demandSlabs",
      coalesce(metadata->'demandAnalytics', '{}'::jsonb) as "demandAnalytics",
      coalesce(metadata->'scope', '{"scopeType":"all","clusterIds":[],"serviceIds":[],"categoryIds":[]}'::jsonb) as "scope",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from zigo.surge_rules
    where coalesce(is_deleted, false) = false
    order by priority, name
  `);
    return result.rows;
}
export async function createSurgeRule(input) {
    await ensureSurgeRuleSchema();
    const metadata = buildSurgeRuleMetadata(input);
    const result = await pool.query(`
      insert into zigo.surge_rules
        (name, code, rule_type, days, start_time, end_time, adjustment_type, adjustment_value, priority, metadata, is_active, created_by, updated_by)
      values ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $12)
      returning id
    `, [
        input.name,
        input.code,
        input.ruleType,
        buildSurgeRuleDays(input),
        input.startTime || null,
        input.endTime || null,
        input.adjustmentType,
        input.adjustmentValue,
        input.priority ?? 0,
        JSON.stringify(metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateSurgeRule(id, input) {
    await ensureSurgeRuleSchema();
    const metadata = buildSurgeRuleMetadata(input);
    const result = await pool.query(`
      update zigo.surge_rules
      set name = $2,
          code = $3,
          rule_type = $4,
          days = $5::text[],
          start_time = $6,
          end_time = $7,
          adjustment_type = $8,
          adjustment_value = $9,
          priority = $10,
          metadata = coalesce(metadata, '{}'::jsonb) || $11::jsonb,
          is_active = $12,
          updated_by = $13,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        input.name,
        input.code,
        input.ruleType,
        buildSurgeRuleDays(input),
        input.startTime || null,
        input.endTime || null,
        input.adjustmentType,
        input.adjustmentValue,
        input.priority ?? 0,
        JSON.stringify(metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
function buildSurgeRuleMetadata(input) {
    const dateTimes = input.dateTimes ?? [];
    const selectedDates = input.selectedDates?.length ? input.selectedDates : dateTimes.map((slot) => slot.date);
    const demandSlabs = input.ruleType === "demand"
        ? normalizeDemandSlabs(input.demandSlabs ?? [])
        : [];
    return {
        scheduleMode: input.scheduleMode ?? "date_time",
        selectedDates,
        dateTimes,
        dayTimes: input.dayTimes ?? {},
        weeklyCalendar: input.weeklyCalendar ?? {},
        demandSlabs,
        demandAnalytics: normalizeDemandAnalytics(input),
        scope: normalizeSurgeScope(input.scope)
    };
}
function buildSurgeRuleDays(input) {
    if (input.days?.length)
        return input.days;
    return Object.keys(input.weeklyCalendar ?? {});
}
function normalizeDemandSlabs(slabs) {
    return slabs
        .map((slab) => ({
        minOrders: Math.max(0, Number(slab.minOrders ?? 0)),
        maxOrders: Math.max(0, Number(slab.maxOrders ?? 100)),
        minSupply: Math.max(0, Number(slab.minSupply ?? 0)),
        maxSupply: Math.max(0, Number(slab.maxSupply ?? slab.maxAvailableAssistants ?? 100)),
        maxAvailableAssistants: Math.max(0, Number(slab.maxSupply ?? slab.maxAvailableAssistants ?? 100)),
        adjustmentType: slab.adjustmentType ?? "percent",
        adjustmentValue: Number(slab.adjustmentValue ?? 0)
    }))
        .filter((slab) => slab.minOrders > 0 || slab.maxOrders < 100 || slab.minSupply > 0 || slab.maxSupply < 100 || slab.adjustmentValue !== 0)
        .sort((a, b) => b.minOrders - a.minOrders || a.maxSupply - b.maxSupply);
}
function normalizeDemandAnalytics(input) {
    const source = input.demandAnalytics ?? {};
    return {
        lookbackDays: Math.max(1, Math.min(365, Number(source.lookbackDays ?? 3))),
        startTime: source.startTime || input.startTime || null,
        endTime: source.endTime || input.endTime || null,
        days: source.days?.length ? source.days : input.days ?? [],
        selectedDates: source.selectedDates ?? input.selectedDates ?? [],
        includeHolidays: Boolean(source.includeHolidays)
    };
}
function normalizeSurgeScope(scope) {
    const scopeType = scope?.scopeType ?? "all";
    const clusterId = scope?.clusterId ?? scope?.clusterIds?.[0] ?? null;
    const serviceId = scope?.serviceId ?? scope?.serviceIds?.[0] ?? null;
    const categoryId = scope?.categoryId ?? scope?.categoryIds?.[0] ?? null;
    return {
        scopeType,
        stateId: scopeType === "state" ? scope?.stateId ?? null : null,
        cityId: scopeType === "city" ? scope?.cityId ?? null : null,
        zoneId: scopeType === "zone" ? scope?.zoneId ?? null : null,
        clusterId: scopeType === "cluster" ? clusterId : null,
        serviceId,
        categoryId,
        clusterIds: scopeType === "cluster" && clusterId ? [clusterId] : [],
        serviceIds: serviceId ? [serviceId] : [],
        categoryIds: categoryId ? [categoryId] : []
    };
}
export async function evaluateHighDemandSurge(input) {
    await ensureSurgeRuleSchema();
    const result = await pool.query(`
      with demand_rules as (
        select
          id,
          name,
          adjustment_type as "adjustmentType",
          adjustment_value as "adjustmentValue",
          jsonb_array_elements(coalesce(metadata->'demandSlabs', '[]'::jsonb)) as slab
        from zigo.surge_rules
        where coalesce(is_deleted, false) = false
          and is_active = true
          and rule_type = 'demand'
      )
      select
        id,
        name,
        coalesce(slab->>'adjustmentType', "adjustmentType") as "adjustmentType",
        coalesce(nullif(slab->>'adjustmentValue', '')::numeric, "adjustmentValue") as "adjustmentValue",
        slab
      from demand_rules
      where $1::numeric >= coalesce((slab->>'minOrders')::numeric, 0)
        and $1::numeric <= coalesce((slab->>'maxOrders')::numeric, 100)
        and $2::numeric >= coalesce((slab->>'minSupply')::numeric, 0)
        and $2::numeric <= coalesce((slab->>'maxSupply')::numeric, coalesce((slab->>'maxAvailableAssistants')::numeric, 100))
      order by abs(coalesce((slab->>'adjustmentValue')::numeric, "adjustmentValue")) desc,
               coalesce((slab->>'minOrders')::numeric, 0) desc
      limit 1
    `, [input.orders, input.availableAssistants]);
    const match = result.rows[0];
    return {
        orders: input.orders,
        availableAssistants: input.availableAssistants,
        hasSurge: Boolean(match),
        adjustmentType: match?.adjustmentType ?? "percent",
        adjustmentValue: Number(match?.adjustmentValue ?? 0),
        multiplier: match ? 1 + Number(match.adjustmentValue ?? 0) / 100 : 1,
        ruleId: match?.id ?? null,
        ruleName: match?.name ?? null,
        slab: match?.slab ?? null
    };
}
export async function deleteSurgeRule(id, userId) {
    await ensureSurgeRuleSchema();
    return softDelete("zigo.surge_rules", id, userId);
}
function buildCategoryPricing(input) {
    const basePrice = Math.max(0, Number(input.basePrice ?? 0));
    const additionalCharges = Math.max(0, Number(input.additionalCharges ?? 0));
    const discountType = input.discountType ?? "none";
    const rawDiscount = Math.max(0, Number(input.discountValue ?? 0));
    const discountValue = discountType === "percent" ? Math.min(rawDiscount, 100) : rawDiscount;
    const computedDiscount = discountType === "percent" ? (basePrice * discountValue) / 100 : discountType === "flat" ? discountValue : 0;
    const sellingPrice = Math.max(0, Number(input.sellingPrice ?? Math.max(0, basePrice - computedDiscount)));
    return {
        basePrice,
        additionalCharges,
        discountType,
        discountValue,
        discountLabel: input.discountLabel || null,
        sellingPrice,
        surgeRules: input.surgeRules ?? []
    };
}
export async function listClusterServiceSettings(clusterId) {
    await ensureClusterServiceSchema();
    const result = await pool.query(`
      select
        m.id,
        m.cluster_id as "clusterId",
        cl.name as "clusterName",
        m.service_id as "serviceId",
        s.name as "serviceName",
        s.code as "serviceCode",
        s.description as "serviceDescription",
        s.image_url as "serviceImageUrl",
        m.is_visible as "isVisible",
        m.is_enabled as "isEnabled",
        coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
        m.is_active as "isActive",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt"
      from zigo.cluster_service_settings m
      join zigo.clusters cl on cl.id = m.cluster_id
      join zigo.services s on s.id = m.service_id
      where coalesce(m.is_deleted, false) = false
        and ($1::uuid is null or m.cluster_id = $1)
      order by cl.name, s.priority, s.sort_order, s.name
    `, [clusterId ?? null]);
    return result.rows;
}
export async function upsertClusterServiceSetting(input) {
    await ensureClusterServiceSchema();
    await assertUsableClusterForSettings(input.clusterId);
    await assertActiveRecord("zigo.services", input.serviceId, "Service");
    const auditUserId = await existingAuditUserId(input.userId);
    const result = await pool.query(`
      insert into zigo.cluster_service_settings
        (cluster_id, service_id, is_visible, is_enabled, is_active, config, created_by, updated_by, is_deleted, deleted_by, deleted_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7, false, null, null)
      on conflict (cluster_id, service_id) do update
      set is_visible = excluded.is_visible,
          is_enabled = excluded.is_enabled,
          is_active = excluded.is_active,
          config = coalesce(zigo.cluster_service_settings.config, '{}'::jsonb) || excluded.config,
          is_deleted = false,
          deleted_by = null,
          deleted_at = null,
          updated_by = excluded.updated_by,
          updated_at = now()
      returning id
    `, [input.clusterId, input.serviceId, input.isVisible ?? true, input.isEnabled ?? true, input.isActive ?? true, JSON.stringify({}), auditUserId]);
    return result.rows[0];
}
function buildClusterBookingTypeConfig(input) {
    return {
        mode: input.bookingType,
        instantMode: input.instantMode ?? "both",
        waitWindowMinutes: Math.max(0, Math.round(Number(input.waitWindowMinutes || 0))),
        isActive: input.isActive ?? true
    };
}
export async function listClusterBookingTypeSettings(clusterId) {
    await ensureClusterServiceSchema();
    const result = await pool.query(`
      select *
      from (
        select
          m.id,
          'service' as "targetType",
          m.cluster_id as "clusterId",
          cl.name as "clusterName",
          m.service_id as "serviceId",
          s.name as "serviceName",
          null::uuid as "categoryId",
          null::text as "categoryName",
          coalesce(m.config->'bookingType'->>'mode', 'both') as "bookingType",
          coalesce(m.config->'bookingType'->>'instantMode', 'both') as "instantMode",
          coalesce((m.config->'bookingType'->>'waitWindowMinutes')::int, 0) as "waitWindowMinutes",
          coalesce((m.config->'bookingType'->>'isActive')::boolean, true) as "isActive",
          m.updated_at as "updatedAt"
        from zigo.cluster_service_settings m
        join zigo.clusters cl on cl.id = m.cluster_id
        join zigo.services s on s.id = m.service_id
        where coalesce(m.is_deleted, false) = false
          and m.config ? 'bookingType'
          and ($1::uuid is null or m.cluster_id = $1)
      ) rows
      order by "clusterName", "serviceName", "targetType", "categoryName"
    `, [clusterId ?? null]);
    return result.rows;
}
export async function applyClusterBookingTypeSetting(input) {
    await ensureClusterServiceSchema();
    await assertUsableClusterForSettings(input.clusterId);
    const serviceIds = [...new Set(input.serviceIds || [])].filter(Boolean);
    const serviceScope = input.serviceScope ?? "all";
    if (serviceScope === "select" && !serviceIds.length)
        throw new HttpError(400, "Select at least one service or choose all services.");
    const auditUserId = await existingAuditUserId(input.userId);
    const bookingTypeConfig = buildClusterBookingTypeConfig(input);
    if (input.replaceConfigKey) {
        const configKeySql = `
      concat(
        coalesce(config->'bookingType'->>'mode', 'both'),
        '|',
        coalesce(config->'bookingType'->>'instantMode', 'both'),
        '|',
        coalesce((config->'bookingType'->>'waitWindowMinutes')::int, 0)::text,
        '|',
        case when coalesce((config->'bookingType'->>'isActive')::boolean, true) then 'active' else 'inactive' end
      )
    `;
        for (const tableName of ["zigo.cluster_service_settings", "zigo.cluster_category_settings"]) {
            await pool.query(`
          update ${tableName}
          set config = coalesce(config, '{}'::jsonb) - 'bookingType',
              updated_by = $3,
              updated_at = now()
          where cluster_id = $1
            and coalesce(is_deleted, false) = false
            and config ? 'bookingType'
            and ${configKeySql} = $2
        `, [input.clusterId, input.replaceConfigKey, auditUserId]);
        }
    }
    const services = await pool.query(`
      with mapped as (
        select service_id
        from zigo.cluster_service_settings
        where cluster_id = $2
          and coalesce(is_deleted, false) = false
          and coalesce(is_active, true) = true
          and coalesce(is_enabled, true) = true
      )
      select distinct s.id
      from zigo.services s
      where coalesce(s.is_deleted, false) = false
        and coalesce(s.is_active, true) = true
        and (
          ($1::uuid[] is not null and s.id = any($1::uuid[]))
          or ($1::uuid[] is null and exists (select 1 from mapped) and s.id in (select service_id from mapped))
          or ($1::uuid[] is null and not exists (select 1 from mapped))
        )
      order by s.id
    `, [serviceScope === "select" ? serviceIds : null, input.clusterId]);
    if (!services.rowCount)
        throw new HttpError(400, "No active services matched the selected Cluster Booking Type target.");
    const resolvedServiceIds = services.rows.map((service) => service.id);
    const serviceIdSet = new Set(resolvedServiceIds);
    let servicesUpdated = 0;
    const categoriesUpdated = 0;
    await pool.query(`
      update zigo.cluster_service_settings
      set config = coalesce(config, '{}'::jsonb) - 'bookingType',
          updated_by = $3,
          updated_at = now()
      where cluster_id = $1
        and service_id = any($2::uuid[])
        and coalesce(is_deleted, false) = false
        and config ? 'bookingType'
    `, [input.clusterId, resolvedServiceIds, auditUserId]);
    await pool.query(`
      update zigo.cluster_category_settings m
      set config = coalesce(m.config, '{}'::jsonb) - 'bookingType',
          updated_by = $3,
          updated_at = now()
      from zigo.categories c
      where m.category_id = c.id
        and m.cluster_id = $1
        and c.service_id = any($2::uuid[])
        and coalesce(m.is_deleted, false) = false
        and m.config ? 'bookingType'
    `, [input.clusterId, resolvedServiceIds, auditUserId]);
    const writeService = async (serviceId, config) => {
        await pool.query(`
        insert into zigo.cluster_service_settings
          (cluster_id, service_id, is_visible, is_enabled, is_active, config, created_by, updated_by, is_deleted, deleted_by, deleted_at)
        values ($1, $2, true, true, true, jsonb_build_object('bookingType', $3::jsonb), $4, $4, false, null, null)
        on conflict (cluster_id, service_id) do update
        set config = coalesce(zigo.cluster_service_settings.config, '{}'::jsonb) || jsonb_build_object('bookingType', $3::jsonb),
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_by = excluded.updated_by,
            updated_at = now()
      `, [input.clusterId, serviceId, JSON.stringify(config), auditUserId]);
        servicesUpdated += 1;
    };
    if (input.individualSettings?.length) {
        for (const setting of input.individualSettings) {
            const config = buildClusterBookingTypeConfig(setting);
            const serviceId = setting.serviceId || "";
            if (!serviceIdSet.has(serviceId))
                throw new HttpError(400, "One or more selected services are not valid for this cluster booking type.");
            await writeService(serviceId, config);
        }
        return { servicesUpdated, categoriesUpdated, bookingType: bookingTypeConfig };
    }
    for (const service of services.rows) {
        await writeService(service.id, bookingTypeConfig);
    }
    return {
        servicesUpdated,
        categoriesUpdated,
        bookingType: bookingTypeConfig
    };
}
export async function deleteClusterBookingTypeSetting(targetType, id, userId) {
    await ensureClusterServiceSchema();
    const auditUserId = await existingAuditUserId(userId);
    const tableName = targetType === "category" ? "zigo.cluster_category_settings" : "zigo.cluster_service_settings";
    const result = await pool.query(`
      update ${tableName}
      set config = coalesce(config, '{}'::jsonb) - 'bookingType',
          updated_by = $2,
          updated_at = now()
      where id = $1
        and coalesce(is_deleted, false) = false
        and config ? 'bookingType'
      returning id
    `, [id, auditUserId]);
    return result.rows[0] ?? null;
}
export async function deleteClusterServiceSetting(id, userId) {
    await ensureClusterServiceSchema();
    return softDelete("zigo.cluster_service_settings", id, userId);
}
export async function listClusterCategorySettings(clusterId) {
    await ensureClusterServiceSchema();
    const result = await pool.query(`
      select
        m.id,
        m.cluster_id as "clusterId",
        cl.name as "clusterName",
        m.category_id as "categoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        c.description as "categoryDescription",
        c.image_url as "categoryImageUrl",
        coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
        c.config->'categorySettings'->>'expandTitle' as "expandTitle",
        coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
        c.config->'categorySettings'->>'expandDescription' as "expandDescription",
        coalesce(c.service_id, parent.service_id) as "serviceId",
        c.parent_category_id as "parentCategoryId",
        s.name as "serviceName",
        m.is_visible as "isVisible",
        m.is_enabled as "isEnabled",
        coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
        coalesce((m.config->'pricing'->>'basePrice')::numeric, 0) as "basePrice",
        coalesce((m.config->'pricing'->>'additionalCharges')::numeric, 0) as "additionalCharges",
        coalesce(m.config->'pricing'->>'discountType', 'none') as "discountType",
        coalesce((m.config->'pricing'->>'discountValue')::numeric, 0) as "discountValue",
        m.config->'pricing'->>'discountLabel' as "discountLabel",
        coalesce((m.config->'pricing'->>'sellingPrice')::numeric, 0) as "sellingPrice",
        m.config->'pricing'->>'surgeLabel' as "surgeLabel",
        coalesce(m.config->'pricing'->'surgeRuleIds', '[]'::jsonb) as "surgeRuleIds",
        m.is_active as "isActive",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt"
      from zigo.cluster_category_settings m
      join zigo.clusters cl on cl.id = m.cluster_id
      join zigo.categories c on c.id = m.category_id
      left join zigo.services s on s.id = c.service_id
      where coalesce(m.is_deleted, false) = false
        and ($1::uuid is null or m.cluster_id = $1)
      order by cl.name, s.name, c.priority, c.sort_order, c.name
    `, [clusterId ?? null]);
    return result.rows;
}
export async function upsertClusterCategorySetting(input) {
    await ensureClusterServiceSchema();
    await assertUsableClusterForSettings(input.clusterId);
    await assertUsableCategory(input.categoryId);
    const auditUserId = await existingAuditUserId(input.userId);
    const result = await pool.query(`
      insert into zigo.cluster_category_settings
        (cluster_id, category_id, is_visible, is_enabled, is_active, config, created_by, updated_by, is_deleted, deleted_by, deleted_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7, false, null, null)
      on conflict (cluster_id, category_id) do update
      set is_visible = excluded.is_visible,
          is_enabled = excluded.is_enabled,
          is_active = excluded.is_active,
          config = coalesce(zigo.cluster_category_settings.config, '{}'::jsonb) || excluded.config,
          is_deleted = false,
          deleted_by = null,
          deleted_at = null,
          updated_by = excluded.updated_by,
          updated_at = now()
      returning id
    `, [
        input.clusterId,
        input.categoryId,
        input.isVisible ?? true,
        input.isEnabled ?? true,
        input.isActive ?? true,
        JSON.stringify({ pricing: { ...buildCategoryPricing(input), surgeLabel: input.surgeLabel || null, surgeRuleIds: input.surgeRuleIds ?? [] } }),
        auditUserId
    ]);
    return result.rows[0];
}
export async function deleteClusterCategorySetting(id, userId) {
    await ensureClusterServiceSchema();
    return softDelete("zigo.cluster_category_settings", id, userId);
}
export async function listPriceMasterRules() {
    await ensurePriceMasterSchema();
    const result = await pool.query(`
    select
      pm.id,
      pm.price_type as "priceType",
      pm.scope_type as "scopeType",
      pm.state_id as "stateId",
      state.name as "stateName",
      pm.city_id as "cityId",
      city.name as "cityName",
      pm.zone_id as "zoneId",
      z.name as "zoneName",
      pm.cluster_id as "clusterId",
      cl.name as "clusterName",
      pm.service_id as "serviceId",
      s.name as "serviceName",
      pm.category_id as "categoryId",
      c.name as "categoryName",
      pm.store_id as "storeId",
      st.name as "storeName",
      pm.base_price as "basePrice",
      pm.discount_type as "discountType",
      pm.discount_value as "discountValue",
      pm.selling_price as "sellingPrice",
      pm.cart_added as "cartAdded",
      pm.complexity_base as "complexityBase",
      pm.complexity_multiplier as "complexityMultiplier",
      pm.complexity_slabs as "complexitySlabs",
      pm.max_stores_per_category as "maxStoresPerCategory",
      pm.max_stores_total as "maxStoresTotal",
      pm.time_slabs as "timeSlabs",
      pm.description,
      pm.metadata,
      pm.is_active as "isActive",
      pm.created_at as "createdAt",
      pm.updated_at as "updatedAt"
    from zigo.price_master_rules pm
    left join zigo.states state on state.id = pm.state_id
    left join zigo.cities city on city.id = pm.city_id
    left join zigo.zones z on z.id = pm.zone_id
    left join zigo.clusters cl on cl.id = pm.cluster_id
    left join zigo.services s on s.id = pm.service_id
    left join zigo.categories c on c.id = pm.category_id
    left join zigo.stores st on st.id = pm.store_id
    where coalesce(pm.is_deleted, false) = false
    order by pm.price_type, s.name nulls last, c.name nulls last, st.name nulls last, pm.created_at desc
  `);
    return result.rows;
}
export async function getBookingCatalog(filters) {
    await ensureClusterServiceSchema();
    await ensurePriceMasterSchema();
    await ensureBookingTypeSchema();
    await ensureCategoryServiceMasterSchema();
    const clusterId = filters.clusterId;
    const serviceId = filters.serviceId ?? null;
    const categoryId = filters.categoryId ?? null;
    const search = filters.q?.trim() ? `%${filters.q.trim()}%` : null;
    const priceScope = (await pool.query(`select cl.id as "clusterId", cl.city_id as "cityId", cl.zone_id as "zoneId", city.state_id as "stateId"
     from zigo.clusters cl
     left join zigo.cities city on city.id = cl.city_id
     where cl.id = $1`, [clusterId])).rows[0] || {};
    const services = await pool.query(`
      select
        m.id,
        m.cluster_id as "clusterId",
        m.service_id as "serviceId",
        s.name as "serviceName",
        s.code as "serviceCode",
        s.description as "serviceDescription",
        s.image_url as "serviceImageUrl",
        coalesce(s.metadata->'pricing'->>'priceType', 'task') as "servicePriceType",
        coalesce(s.metadata->'bookingLocation'->>'mode', 'current') as "locationMode",
        coalesce(nullif(s.metadata->'bookingLocation'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
        coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
        (
          select jsonb_build_object(
            'id', bt.id,
            'bookingType', bt.booking_type,
            'instantMode', 'manual',
            'waitWindowMinutes', coalesce((bt.config->>'waitWindowMinutes')::int, 0),
            'waitWindowNote', coalesce(bt.config->>'waitWindowNote', ''),
            'maxAdvanceDays', coalesce((bt.config->>'maxAdvanceDays')::int, 0),
            'allowedDays', coalesce(bt.config->'allowedDays', '[]'::jsonb),
            'timeCategories', coalesce(bt.config->'timeCategories', '[]'::jsonb),
            'timeSlots', coalesce(bt.config->'timeSlots', '[]'::jsonb)
          )
          from zigo.booking_type_masters bt
          where coalesce(bt.is_deleted, false) = false
            and bt.is_active = true
            and bt.is_default = true
          order by bt.updated_at desc
          limit 1
        ) as "defaultBookingType",
        m.is_visible as "isVisible",
        m.is_enabled as "isEnabled",
        m.is_active as "isActive"
      from zigo.cluster_service_settings m
      join zigo.services s on s.id = m.service_id
      where m.cluster_id = $1
        and coalesce(m.is_deleted, false) = false
        and coalesce(m.is_active, true) = true
        and coalesce(m.is_visible, true) = true
        and coalesce(m.is_enabled, true) = true
        and coalesce(s.is_deleted, false) = false
        and coalesce(s.is_active, true) = true
        and coalesce(s.is_enabled, true) = true
      order by s.priority, s.sort_order, s.name
    `, [clusterId]);
    const categories = await pool.query(`
      select
        c.id,
        $1::uuid as "clusterId",
        c.id as "categoryId",
        c.parent_category_id as "parentCategoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        c.description as "categoryDescription",
        c.image_url as "categoryImageUrl",
        coalesce(c.service_id, parent.service_id) as "serviceId",
        s.name as "serviceName",
        coalesce(m.is_visible, true) as "isVisible",
        coalesce(m.is_enabled, true) as "isEnabled",
        coalesce((m.config->'pricing'->>'basePrice')::numeric, (c.config->'pricing'->>'basePrice')::numeric, 0) as "basePrice",
        coalesce((m.config->'pricing'->>'additionalCharges')::numeric, (c.config->'pricing'->>'additionalCharges')::numeric, 0) as "additionalCharges",
        coalesce(m.config->'pricing'->>'discountType', c.config->'pricing'->>'discountType', 'none') as "discountType",
        coalesce((m.config->'pricing'->>'discountValue')::numeric, (c.config->'pricing'->>'discountValue')::numeric, 0) as "discountValue",
        coalesce((m.config->'pricing'->>'sellingPrice')::numeric, (c.config->'pricing'->>'sellingPrice')::numeric, 0) as "sellingPrice",
        coalesce(m.config->'bookingType', '{}'::jsonb) as "bookingTypeConfig",
        coalesce((
          select jsonb_agg(st.operating_hours)
          from zigo.stores st
          join zigo.cluster_store_map cluster_map
            on cluster_map.store_id = st.id
           and cluster_map.cluster_id = $1
           and coalesce(cluster_map.is_deleted, false) = false
           and cluster_map.is_active = true
          join zigo.category_store_map category_map
            on category_map.store_id = st.id
           and category_map.category_id = c.id
           and coalesce(category_map.is_deleted, false) = false
           and category_map.is_active = true
          where coalesce(st.is_deleted, false) = false
            and st.is_active = true
        ), '[]'::jsonb) as "storeOperatingHours",
        coalesce(m.is_active, true) as "isActive"
      from zigo.categories c
      left join zigo.categories parent on parent.id = c.parent_category_id
      join zigo.services s on s.id = coalesce(c.service_id, parent.service_id)
      join zigo.cluster_service_settings csm
        on csm.cluster_id = $1
       and csm.service_id = coalesce(c.service_id, parent.service_id)
       and coalesce(csm.is_deleted, false) = false
       and coalesce(csm.is_active, true) = true
       and coalesce(csm.is_visible, true) = true
       and coalesce(csm.is_enabled, true) = true
      left join zigo.cluster_category_settings m
        on m.cluster_id = $1
       and m.category_id = c.id
       and coalesce(m.is_deleted, false) = false
      where ($2::uuid is null or coalesce(c.service_id, parent.service_id) = $2)
        and coalesce(c.is_deleted, false) = false
        and coalesce(c.is_active, true) = true
        and coalesce(c.is_enabled, true) = true
        and coalesce(parent.is_deleted, false) = false
        and coalesce(parent.is_active, true) = true
        and coalesce(parent.is_enabled, true) = true
        and coalesce(s.is_deleted, false) = false
        and coalesce(s.is_active, true) = true
        and coalesce(s.is_enabled, true) = true
        and coalesce(m.is_active, true) = true
        and coalesce(m.is_visible, true) = true
        and coalesce(m.is_enabled, true) = true
      order by s.name nulls last, c.priority, c.sort_order, c.name
    `, [clusterId, serviceId]);
    const stores = serviceId || categoryId
        ? await pool.query(`
          select
            st.id,
            st.code,
            st.name,
            st.description,
            st.address,
            st.contact,
            st.website,
            st.latitude,
            st.longitude,
            st.priority,
            st.operating_hours as "operatingHours",
            st.is_active as "isActive",
            coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', si.id,
                'fileId', si.file_id,
                'imageUrl', si.image_url,
                'isPrimary', si.is_primary,
                'priority', si.priority
              ) order by si.is_primary desc, si.priority, si.created_at)
              from zigo.store_images si
              where si.store_id = st.id and coalesce(si.is_deleted, false) = false and si.is_active = true
            ), '[]'::jsonb) as images,
            (
              select si.image_url
              from zigo.store_images si
              where si.store_id = st.id and coalesce(si.is_deleted, false) = false and si.is_active = true
              order by si.is_primary desc, si.priority, si.created_at
              limit 1
            ) as "primaryImageUrl",
            coalesce((
              select array_agg(m.category_id)
              from zigo.category_store_map m
              where m.store_id = st.id and coalesce(m.is_deleted, false) = false and m.is_active = true
            ), '{}'::uuid[]) as "serviceCategoryIds",
            coalesce((
              select array_agg(m.store_category_id)
              from zigo.store_category_map m
              where m.store_id = st.id and coalesce(m.is_deleted, false) = false and m.is_active = true
            ), '{}'::uuid[]) as "storeCategoryIds",
            coalesce((
              select array_agg(m.store_keyword_id)
              from zigo.store_keyword_map m
              where m.store_id = st.id and coalesce(m.is_deleted, false) = false and m.is_active = true
            ), '{}'::uuid[]) as "storeKeywordIds",
            array[$1::uuid] as "clusterIds"
          from zigo.stores st
          join zigo.cluster_store_map cluster_map
            on cluster_map.store_id = st.id
           and cluster_map.cluster_id = $1
           and coalesce(cluster_map.is_deleted, false) = false
           and cluster_map.is_active = true
          join zigo.category_store_map category_map
            on category_map.store_id = st.id
           and coalesce(category_map.is_deleted, false) = false
           and category_map.is_active = true
          join zigo.categories c
            on c.id = category_map.category_id
           and coalesce(c.is_deleted, false) = false
           and coalesce(c.is_active, true) = true
           and coalesce(c.is_enabled, true) = true
          left join zigo.categories parent
            on parent.id = c.parent_category_id
          where coalesce(st.is_deleted, false) = false
            and st.is_active = true
            and ($2::uuid is null or category_map.category_id = $2)
            and ($4::uuid is null or coalesce(c.service_id, parent.service_id) = $4)
            and (
              $3::text is null
              or st.name ilike $3
              or st.code ilike $3
              or coalesce(st.address, '') ilike $3
              or coalesce(st.contact, '') ilike $3
              or exists (
                select 1
                from zigo.store_category_map scm
                join zigo.store_categories sc on sc.id = scm.store_category_id
                where scm.store_id = st.id
                  and coalesce(scm.is_deleted, false) = false
                  and scm.is_active = true
                  and sc.name ilike $3
              )
              or exists (
                select 1
                from zigo.store_keyword_map skm
                join zigo.store_keywords sk on sk.id = skm.store_keyword_id
                where skm.store_id = st.id
                  and coalesce(skm.is_deleted, false) = false
                  and skm.is_active = true
                  and sk.name ilike $3
              )
            )
          order by st.priority, st.name
        `, [clusterId, categoryId, search, serviceId])
        : { rows: [] };
    const storeCategories = await pool.query(`
      select id, code, name, service_id as "serviceId", service_category_id as "serviceCategoryId", image_url as "imageUrl", priority, is_active as "isActive"
      from zigo.store_categories
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
        and ($1::uuid is null or service_id = $1)
        and ($2::uuid is null or service_category_id = $2)
      order by priority, name
    `, [serviceId, categoryId]);
    const storeKeywords = await pool.query(`
      select id, code, name, service_id as "serviceId", service_category_id as "serviceCategoryId", priority, is_active as "isActive"
      from zigo.store_keywords
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
        and ($1::uuid is null or service_id = $1)
        and ($2::uuid is null or service_category_id = $2)
      order by priority, name
    `, [serviceId, categoryId]);
    const priceRules = await listPriceMasterRules();
    const categoryPriceRules = await listCategoryPriceRules();
    const bookingTypes = await listBookingTypes();
    const defaultInstantEtaMinutes = await resolveBookingEngineInstantEtaMinutes({
        clusterId: filters.clusterId,
        categoryId: filters.categoryId
    });
    const serviceMasters = await pool.query(`
      select
        id,
        service_title as "serviceTitle",
        service_subtitle as "serviceSubtitle",
        coalesce(icons, '[]'::jsonb) as "icons",
        coalesce(service_title_font_size, 18) as "serviceTitleFontSize",
        coalesce(service_title_font_weight, 400) as "serviceTitleFontWeight",
        coalesce(service_title_color, '') as "serviceTitleColor",
        coalesce(service_subtitle_font_size, 13) as "serviceSubtitleFontSize",
        coalesce(service_subtitle_font_weight, 400) as "serviceSubtitleFontWeight",
        coalesce(service_subtitle_color, '') as "serviceSubtitleColor",
        coalesce(booking_type, 'both') as "bookingType",
        coalesce(show_eta, false) as "showEta",
        $1::int as "instantEtaMinutes",
        service_position as "servicePosition",
        coalesce(service_category_grid_size, '3x3') as "serviceCategoryGridSize",
        is_enabled as "isEnabled",
        is_active as "isActive"
      from zigo.category_service_masters
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
        and coalesce(is_enabled, true) = true
      order by service_position, service_title
    `, [defaultInstantEtaMinutes]);
    const masterCategories = await pool.query(`
      select
        c.id,
        nullif(c.config->'categorySettings'->>'serviceMasterId', '') as "serviceMasterId",
        csm.service_title as "serviceMasterName",
        c.code,
        c.name,
        c.description,
        c.image_url as "imageUrl",
        coalesce(c.config->'categorySettings'->'imageUrls', '[]'::jsonb) as "imageUrls",
        c.priority,
        c.sort_order as "sortOrder",
        c.is_recommended as "isRecommended",
        c.config->'categorySettings'->>'note' as "note",
        coalesce(c.config->'categorySettings'->>'locationMode', 'current') as "locationMode",
        coalesce(nullif(c.config->'categorySettings'->>'maxLocationsLimit', '')::int, 1) as "maxLocationsLimit",
        coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) as "showInHomePage",
        coalesce(c.config->'categorySettings'->>'homeDisplayMode', case when coalesce((c.config->'categorySettings'->>'showInHomePage')::boolean, true) then 'category' else 'categoryPrice' end) as "homeDisplayMode",
        coalesce(nullif(c.config->'categorySettings'->>'categoryImageHeight', '')::int, 0) as "categoryImageHeight",
        coalesce(nullif(c.config->'categorySettings'->>'categoryImageWidth', '')::int, 0) as "categoryImageWidth",
        coalesce(c.config->'categorySettings'->>'priceDisplayMode', 'row') as "priceDisplayMode",
        coalesce(nullif(c.config->'categorySettings'->>'priceGridRows', '')::int, 3) as "priceGridRows",
        coalesce(nullif(c.config->'categorySettings'->>'priceGridColumns', '')::int, 3) as "priceGridColumns",
        coalesce(c.config->'categorySettings'->>'supplyUnavailableAction', '') as "supplyUnavailableAction",
        c.config->'categorySettings'->>'supplyUnavailableMessage' as "supplyUnavailableMessage",
        coalesce((c.config->'categorySettings'->>'addWithOtherCategory')::boolean, false) as "addWithOtherCategory",
        coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
        c.config->'categorySettings'->>'expandTitle' as "expandTitle",
        coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
        c.config->'categorySettings'->>'expandDescription' as "expandDescription",
        coalesce(c.config->'categoryGuidance'->>'taskListTitle', 'Tasks related to category') as "taskListTitle",
        coalesce(c.config->'categoryGuidance'->'taskList', '[]'::jsonb) as "taskList",
        coalesce(c.config->'categoryGuidance'->>'canDoTitle', 'What Assistant can do') as "canDoTitle",
        coalesce(c.config->'categoryGuidance'->'canDoList', '[]'::jsonb) as "canDoList",
        coalesce(c.config->'categoryGuidance'->>'cantDoTitle', 'What Assistant can''t do') as "cantDoTitle",
        coalesce(c.config->'categoryGuidance'->'cantDoList', '[]'::jsonb) as "cantDoList",
        c.is_active as "isActive",
        c.is_enabled as "isEnabled"
      from zigo.categories c
      left join zigo.category_service_masters csm
        on csm.id = nullif(c.config->'categorySettings'->>'serviceMasterId', '')::uuid
       and coalesce(csm.is_deleted, false) = false
       and coalesce(csm.is_active, true) = true
       and coalesce(csm.is_enabled, true) = true
      where coalesce(c.is_deleted, false) = false
        and c.service_id is null
        and c.parent_category_id is null
        and coalesce(c.is_active, true) = true
        and coalesce(c.is_enabled, true) = true
      order by c.priority, c.sort_order, c.name
    `);
    return {
        services: services.rows,
        serviceMasters: serviceMasters.rows,
        categories: categories.rows,
        masterCategories: masterCategories.rows,
        stores: stores.rows,
        storeCategories: storeCategories.rows,
        storeKeywords: storeKeywords.rows,
        bookingTypes,
        priceRules: priceRules.filter((rule) => {
            if (rule.isActive === false)
                return false;
            if (serviceId && rule.serviceId !== serviceId)
                return false;
            if (categoryId && rule.categoryId !== categoryId && !isCategoryGroupPricingEnabled(rule.metadata))
                return false;
            if (rule.scopeType === "cluster")
                return rule.clusterId === priceScope.clusterId;
            if (rule.scopeType === "zone")
                return rule.zoneId === priceScope.zoneId;
            if (rule.scopeType === "city")
                return rule.cityId === priceScope.cityId;
            if (rule.scopeType === "state")
                return rule.stateId === priceScope.stateId;
            return !rule.scopeType || rule.scopeType === "all";
        }),
        categoryPriceRules: categoryPriceRules.filter((rule) => {
            if (rule.isActive === false)
                return false;
            if (rule.isEnabled === false)
                return false;
            if (categoryId && rule.categoryId !== categoryId)
                return false;
            if (rule.scopeType === "cluster")
                return rule.clusterId === priceScope.clusterId;
            if (rule.scopeType === "zone")
                return rule.zoneId === priceScope.zoneId;
            if (rule.scopeType === "city")
                return rule.cityId === priceScope.cityId;
            if (rule.scopeType === "state")
                return rule.stateId === priceScope.stateId;
            return !rule.scopeType || rule.scopeType === "all";
        })
    };
}
export async function createPriceMasterRule(input) {
    await ensurePriceMasterSchema();
    await validatePriceMasterRule(input);
    const scope = normalizePriceMasterScope(input);
    const pricing = buildPriceMasterPricing(input);
    const result = await pool.query(`
      insert into zigo.price_master_rules
        (price_type, scope_type, state_id, city_id, zone_id, cluster_id, service_id, category_id, store_id,
         base_price, discount_type, discount_value, selling_price, cart_added, complexity_base, complexity_multiplier,
         complexity_slabs, max_stores_per_category, max_stores_total, time_slabs, description, metadata, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20::jsonb, $21, $22::jsonb, $23, $24, $24)
      returning id
    `, [
        input.priceType,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.serviceId ?? null,
        input.categoryId ?? null,
        input.storeId ?? null,
        pricing.basePrice,
        pricing.discountType,
        pricing.discountValue,
        pricing.sellingPrice,
        input.cartAdded ?? false,
        input.complexityBase ?? "none",
        Number(input.complexityMultiplier ?? 0),
        JSON.stringify(input.priceType === "task" ? normalizeComplexitySlabs(input.complexitySlabs ?? []) : []),
        Math.max(1, Number(input.maxStoresPerCategory ?? 1)),
        Math.max(1, Number(input.maxStoresTotal ?? 10)),
        JSON.stringify(normalizeTimeSlabs(input.timeSlabs ?? [])),
        input.description ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updatePriceMasterRule(id, input) {
    await ensurePriceMasterSchema();
    await validatePriceMasterRule(input, id);
    const scope = normalizePriceMasterScope(input);
    const pricing = buildPriceMasterPricing(input);
    const result = await pool.query(`
      update zigo.price_master_rules
      set price_type = $2,
          scope_type = $3,
          state_id = $4,
          city_id = $5,
          zone_id = $6,
          cluster_id = $7,
          service_id = $8,
          category_id = $9,
          store_id = $10,
          base_price = $11,
          discount_type = $12,
          discount_value = $13,
          selling_price = $14,
          cart_added = $15,
          complexity_base = $16,
          complexity_multiplier = $17,
          complexity_slabs = $18::jsonb,
          max_stores_per_category = $19,
          max_stores_total = $20,
          time_slabs = $21::jsonb,
          description = $22,
          metadata = $23::jsonb,
          is_active = $24,
          updated_by = $25,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        input.priceType,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.serviceId ?? null,
        input.categoryId ?? null,
        input.storeId ?? null,
        pricing.basePrice,
        pricing.discountType,
        pricing.discountValue,
        pricing.sellingPrice,
        input.cartAdded ?? false,
        input.complexityBase ?? "none",
        Number(input.complexityMultiplier ?? 0),
        JSON.stringify(input.priceType === "task" ? normalizeComplexitySlabs(input.complexitySlabs ?? []) : []),
        Math.max(1, Number(input.maxStoresPerCategory ?? 1)),
        Math.max(1, Number(input.maxStoresTotal ?? 10)),
        JSON.stringify(normalizeTimeSlabs(input.timeSlabs ?? [])),
        input.description ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deletePriceMasterRule(id, userId) {
    await ensurePriceMasterSchema();
    return softDelete("zigo.price_master_rules", id, userId);
}
const TAX_MASTER_FORMULA = "(taxApplicablePrice * taxValue / (100 + taxValue))";
function normalizeTaxMasterInput(input) {
    return {
        taxApplicableOn: input.taxApplicableOn === "base_price" ? "base_price" : "selling_price",
        taxApplicability: input.taxApplicability === "inclusive" ? "inclusive" : "exclusive",
        taxType: input.taxType === "flat" ? "flat" : "percent",
        taxValue: Math.max(0, Number(input.taxValue || 0)),
        formula: input.formula?.trim() || TAX_MASTER_FORMULA,
        taxLabel: input.taxLabel.trim(),
        taxNote: input.taxNote?.trim() || null,
        metadata: {
            formula: input.formula?.trim() || TAX_MASTER_FORMULA
        }
    };
}
export async function listTaxMasterRules() {
    await ensureTaxMasterSchema();
    const result = await pool.query(`
    select
      id,
      tax_applicable_on as "taxApplicableOn",
      tax_applicability as "taxApplicability",
      tax_type as "taxType",
      tax_value as "taxValue",
      formula,
      tax_label as "taxLabel",
      tax_note as "taxNote",
      metadata,
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from zigo.tax_master_rules
    where coalesce(is_deleted, false) = false
    order by is_active desc, updated_at desc, created_at desc
  `);
    return result.rows;
}
export async function createTaxMasterRule(input) {
    await ensureTaxMasterSchema();
    const normalized = normalizeTaxMasterInput(input);
    const result = await pool.query(`
      insert into zigo.tax_master_rules
        (tax_applicable_on, tax_applicability, tax_type, tax_value, formula, tax_label, tax_note,
         metadata, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $10)
      returning id
    `, [
        normalized.taxApplicableOn,
        normalized.taxApplicability,
        normalized.taxType,
        normalized.taxValue,
        normalized.formula,
        normalized.taxLabel,
        normalized.taxNote,
        JSON.stringify(normalized.metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateTaxMasterRule(id, input) {
    await ensureTaxMasterSchema();
    const normalized = normalizeTaxMasterInput(input);
    const result = await pool.query(`
      update zigo.tax_master_rules
      set tax_applicable_on = $2,
          tax_applicability = $3,
          tax_type = $4,
          tax_value = $5,
          formula = $6,
          tax_label = $7,
          tax_note = $8,
          metadata = $9::jsonb,
          is_active = $10,
          updated_by = $11,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        normalized.taxApplicableOn,
        normalized.taxApplicability,
        normalized.taxType,
        normalized.taxValue,
        normalized.formula,
        normalized.taxLabel,
        normalized.taxNote,
        JSON.stringify(normalized.metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteTaxMasterRule(id, userId) {
    await ensureTaxMasterSchema();
    return softDelete("zigo.tax_master_rules", id, userId);
}
function normalizePaymentModeInput(input) {
    const scopeType = input.scopeType || "all";
    return {
        code: String(input.code || "").trim().toUpperCase(),
        name: String(input.name || "").trim(),
        scopeType,
        stateId: ["state", "city", "zone", "cluster"].includes(scopeType) ? input.stateId ?? null : null,
        cityId: ["city", "zone", "cluster"].includes(scopeType) ? input.cityId ?? null : null,
        zoneId: ["zone", "cluster"].includes(scopeType) ? input.zoneId ?? null : null,
        clusterId: scopeType === "cluster" ? input.clusterId ?? null : null,
        sortOrder: Math.max(0, Math.round(Number(input.sortOrder || 0))),
        description: input.description?.trim() || null,
        metadata: {
            subtitle: input.subtitle?.trim() || null,
            icon: input.icon || "wallet",
            handler: input.handler || "cash",
            customerSelectable: input.customerSelectable ?? true
        },
        isEnabled: input.isEnabled ?? true,
        isActive: input.isActive ?? true
    };
}
export async function listPaymentModeRules() {
    await ensurePaymentModeSchema();
    const result = await pool.query(`
    select
      pm.id,
      pm.code,
      pm.name,
      pm.scope_type as "scopeType",
      pm.state_id as "stateId",
      st.name as "stateName",
      pm.city_id as "cityId",
      ct.name as "cityName",
      pm.zone_id as "zoneId",
      zn.name as "zoneName",
      pm.cluster_id as "clusterId",
      cl.name as "clusterName",
      pm.sort_order as "sortOrder",
      pm.description,
      pm.metadata,
      pm.is_enabled as "isEnabled",
      pm.is_active as "isActive",
      pm.created_at as "createdAt",
      pm.updated_at as "updatedAt"
    from zigo.payment_mode_masters pm
    left join zigo.states st on st.id = pm.state_id
    left join zigo.cities ct on ct.id = pm.city_id
    left join zigo.zones zn on zn.id = pm.zone_id
    left join zigo.clusters cl on cl.id = pm.cluster_id
    where coalesce(pm.is_deleted, false) = false
    order by pm.is_active desc, pm.is_enabled desc, pm.sort_order, pm.name
  `);
    return result.rows;
}
export async function createPaymentModeRule(input) {
    await ensurePaymentModeSchema();
    const normalized = normalizePaymentModeInput(input);
    const result = await pool.query(`
      insert into zigo.payment_mode_masters
        (code, name, scope_type, state_id, city_id, zone_id, cluster_id, sort_order, description,
         metadata, is_enabled, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $13)
      returning id
    `, [
        normalized.code,
        normalized.name,
        normalized.scopeType,
        normalized.stateId,
        normalized.cityId,
        normalized.zoneId,
        normalized.clusterId,
        normalized.sortOrder,
        normalized.description,
        JSON.stringify(normalized.metadata),
        normalized.isEnabled,
        normalized.isActive,
        input.userId
    ]);
    return result.rows[0];
}
export async function updatePaymentModeRule(id, input) {
    await ensurePaymentModeSchema();
    const normalized = normalizePaymentModeInput(input);
    const result = await pool.query(`
      update zigo.payment_mode_masters
      set code = $2,
          name = $3,
          scope_type = $4,
          state_id = $5,
          city_id = $6,
          zone_id = $7,
          cluster_id = $8,
          sort_order = $9,
          description = $10,
          metadata = $11::jsonb,
          is_enabled = $12,
          is_active = $13,
          updated_by = $14,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        normalized.code,
        normalized.name,
        normalized.scopeType,
        normalized.stateId,
        normalized.cityId,
        normalized.zoneId,
        normalized.clusterId,
        normalized.sortOrder,
        normalized.description,
        JSON.stringify(normalized.metadata),
        normalized.isEnabled,
        normalized.isActive,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deletePaymentModeRule(id, userId) {
    await ensurePaymentModeSchema();
    return softDelete("zigo.payment_mode_masters", id, userId);
}
export async function listCategoryPriceRules(filters = {}) {
    await ensureCategoryPriceSchema();
    await ensureCategoryServiceMasterSchema();
    const where = ["coalesce(cpr.is_deleted, false) = false"];
    const params = [];
    if (filters.search?.trim()) {
        params.push(`%${filters.search.trim()}%`);
        where.push(`(
      c.name ilike $${params.length}
      or c.code ilike $${params.length}
      or coalesce(s.name, '') ilike $${params.length}
      or coalesce(csm.service_title, '') ilike $${params.length}
      or coalesce(state.name, '') ilike $${params.length}
      or coalesce(city.name, '') ilike $${params.length}
      or coalesce(z.name, '') ilike $${params.length}
      or coalesce(cl.name, '') ilike $${params.length}
    )`);
    }
    if (filters.scopeType) {
        params.push(filters.scopeType);
        where.push(`cpr.scope_type = $${params.length}`);
    }
    if (filters.stateId) {
        params.push(filters.stateId);
        where.push(`cpr.state_id = $${params.length}::uuid`);
    }
    if (filters.cityId) {
        params.push(filters.cityId);
        where.push(`cpr.city_id = $${params.length}::uuid`);
    }
    if (filters.zoneId) {
        params.push(filters.zoneId);
        where.push(`cpr.zone_id = $${params.length}::uuid`);
    }
    if (filters.clusterId) {
        params.push(filters.clusterId);
        where.push(`cpr.cluster_id = $${params.length}::uuid`);
    }
    if (filters.serviceId) {
        params.push(filters.serviceId);
        where.push(`coalesce(
      nullif(c.config->'categorySettings'->>'serviceMasterId', '')::uuid,
      nullif(parent.config->'categorySettings'->>'serviceMasterId', '')::uuid
    ) = $${params.length}::uuid`);
    }
    if (filters.categoryId) {
        params.push(filters.categoryId);
        where.push(`cpr.category_id = $${params.length}::uuid`);
    }
    if (filters.status === "active")
        where.push("cpr.is_active = true");
    if (filters.status === "inactive")
        where.push("cpr.is_active = false");
    const result = await pool.query(`
      select
        cpr.id,
        cpr.scope_type as "scopeType",
        cpr.state_id as "stateId",
        state.name as "stateName",
        cpr.city_id as "cityId",
        city.name as "cityName",
        cpr.zone_id as "zoneId",
        z.name as "zoneName",
        cpr.cluster_id as "clusterId",
        cl.name as "clusterName",
        cpr.category_id as "categoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        c.config->'categorySettings'->>'expandTitle' as "expandTitle",
        coalesce(c.config->'categorySettings'->>'expandDuration', c.config->'categorySettings'->>'expandDescription') as "expandDuration",
        c.config->'categorySettings'->>'expandDescription' as "expandDescription",
        coalesce(nullif(c.config->'categorySettings'->>'expandPriority', '')::int, 0) as "expandPriority",
        coalesce(c.service_id, parent.service_id) as "legacyServiceId",
        coalesce(
          nullif(c.config->'categorySettings'->>'serviceMasterId', '')::uuid,
          nullif(parent.config->'categorySettings'->>'serviceMasterId', '')::uuid
        ) as "serviceId",
        coalesce(csm.service_title, s.name) as "serviceName",
        coalesce(nullif(cpr.slab->>'label', ''), nullif(cpr.metadata->>'label', '')) as "label",
        cpr.time_duration_minutes as "timeDurationMinutes",
        cpr.base_price as "basePrice",
        cpr.discount_type as "discountType",
        cpr.discount_value as "discountValue",
        cpr.selling_price as "sellingPrice",
        cpr.waiting_charge_amount as "waitingChargeAmount",
        cpr.waiting_charge_time_minutes as "waitingChargeTimeMinutes",
        cpr.available_for_duration as "availableForDuration",
        cpr.available_for_extend as "availableForExtend",
        cpr.available_for_expand as "availableForExpand",
        cpr.is_duration_for_offers as "isDurationForOffers",
        cpr.is_offer_eligible as "isOfferEligible",
        cpr.slab,
        cpr.metadata,
        cpr.is_enabled as "isEnabled",
        cpr.is_active as "isActive",
        cpr.created_at as "createdAt",
        cpr.updated_at as "updatedAt"
      from zigo.category_price_rules cpr
      left join zigo.states state on state.id = cpr.state_id
      left join zigo.cities city on city.id = cpr.city_id
      left join zigo.zones z on z.id = cpr.zone_id
      left join zigo.clusters cl on cl.id = cpr.cluster_id
      join zigo.categories c on c.id = cpr.category_id
      left join zigo.categories parent on parent.id = c.parent_category_id
      left join zigo.services s on s.id = coalesce(c.service_id, parent.service_id)
      left join zigo.category_service_masters csm on csm.id = coalesce(
        nullif(c.config->'categorySettings'->>'serviceMasterId', '')::uuid,
        nullif(parent.config->'categorySettings'->>'serviceMasterId', '')::uuid
      )
        and coalesce(csm.is_deleted, false) = false
      where ${where.join(" and ")}
      order by c.name, cpr.time_duration_minutes, cpr.scope_type, cpr.updated_at desc
    `, params);
    return result.rows;
}
export async function createCategoryPriceRule(input) {
    await ensureCategoryPriceSchema();
    await validateCategoryPriceRule(input);
    const scope = normalizeCategoryPriceScope(input);
    const slab = buildCategoryPriceSlab(input);
    const result = await pool.query(`
      insert into zigo.category_price_rules
        (scope_type, state_id, city_id, zone_id, cluster_id, category_id, time_duration_minutes,
         base_price, discount_type, discount_value, selling_price, waiting_charge_amount,
         waiting_charge_time_minutes, available_for_duration, available_for_extend, available_for_expand, is_duration_for_offers, is_offer_eligible, slab, metadata, is_enabled, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb, $21, $22, $23, $23)
      returning id
    `, [
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.categoryId,
        slab.timeDurationMinutes,
        slab.basePrice,
        slab.discountType,
        slab.discountValue,
        slab.sellingPrice,
        slab.waitingChargeAmount,
        slab.waitingChargeTimeMinutes,
        slab.availableForDuration,
        slab.availableForExtend,
        slab.availableForExpand,
        slab.isDurationForOffers,
        slab.isOfferEligible,
        JSON.stringify(slab),
        JSON.stringify({ label: slab.label, availableFor: { duration: slab.availableForDuration, extend: slab.availableForExtend, expand: slab.availableForExpand, offers: slab.isDurationForOffers }, isOfferEligible: slab.isOfferEligible, waitingCharges: { amount: slab.waitingChargeAmount, timeMinutes: slab.waitingChargeTimeMinutes } }),
        input.isEnabled ?? true,
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateCategoryPriceRule(id, input) {
    await ensureCategoryPriceSchema();
    await validateCategoryPriceRule(input, id);
    const scope = normalizeCategoryPriceScope(input);
    const slab = buildCategoryPriceSlab(input);
    const result = await pool.query(`
      update zigo.category_price_rules
      set scope_type = $2,
          state_id = $3,
          city_id = $4,
          zone_id = $5,
          cluster_id = $6,
          category_id = $7,
          time_duration_minutes = $8,
          base_price = $9,
          discount_type = $10,
          discount_value = $11,
          selling_price = $12,
          waiting_charge_amount = $13,
          waiting_charge_time_minutes = $14,
          available_for_duration = $15,
          available_for_extend = $16,
          available_for_expand = $17,
          is_duration_for_offers = $18,
          is_offer_eligible = $19,
          slab = $20::jsonb,
          metadata = $21::jsonb,
          is_enabled = $22,
          is_active = $23,
          updated_by = $24,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.categoryId,
        slab.timeDurationMinutes,
        slab.basePrice,
        slab.discountType,
        slab.discountValue,
        slab.sellingPrice,
        slab.waitingChargeAmount,
        slab.waitingChargeTimeMinutes,
        slab.availableForDuration,
        slab.availableForExtend,
        slab.availableForExpand,
        slab.isDurationForOffers,
        slab.isOfferEligible,
        JSON.stringify(slab),
        JSON.stringify({ label: slab.label, availableFor: { duration: slab.availableForDuration, extend: slab.availableForExtend, expand: slab.availableForExpand, offers: slab.isDurationForOffers }, isOfferEligible: slab.isOfferEligible, waitingCharges: { amount: slab.waitingChargeAmount, timeMinutes: slab.waitingChargeTimeMinutes } }),
        input.isEnabled ?? true,
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteCategoryPriceRule(id, userId) {
    await ensureCategoryPriceSchema();
    return softDelete("zigo.category_price_rules", id, userId);
}
export async function listBookingEngineRules(filters = {}) {
    await ensureBookingEngineRuleSchema();
    const where = ["coalesce(ber.is_deleted, false) = false"];
    const params = [];
    if (filters.search?.trim()) {
        params.push(`%${filters.search.trim()}%`);
        where.push(`(
      coalesce(ber.note, '') ilike $${params.length}
      or coalesce(state.name, '') ilike $${params.length}
      or coalesce(city.name, '') ilike $${params.length}
      or coalesce(z.name, '') ilike $${params.length}
      or coalesce(cl.name, '') ilike $${params.length}
      or coalesce(c.name, '') ilike $${params.length}
      or ber.scope_type ilike $${params.length}
    )`);
    }
    if (filters.scopeType) {
        params.push(filters.scopeType);
        where.push(`ber.scope_type = $${params.length}`);
    }
    if (filters.stateId) {
        params.push(filters.stateId);
        where.push(`ber.state_id = $${params.length}::uuid`);
    }
    if (filters.cityId) {
        params.push(filters.cityId);
        where.push(`ber.city_id = $${params.length}::uuid`);
    }
    if (filters.zoneId) {
        params.push(filters.zoneId);
        where.push(`ber.zone_id = $${params.length}::uuid`);
    }
    if (filters.clusterId) {
        params.push(filters.clusterId);
        where.push(`ber.cluster_id = $${params.length}::uuid`);
    }
    if (filters.categoryId) {
        params.push(filters.categoryId);
        where.push(`ber.category_id = $${params.length}::uuid`);
    }
    if (filters.status === "active")
        where.push("ber.is_active = true");
    if (filters.status === "inactive")
        where.push("ber.is_active = false");
    const result = await pool.query(`
      select
        ber.id,
        ber.scope_type as "scopeType",
        ber.state_id as "stateId",
        state.name as "stateName",
        ber.city_id as "cityId",
        city.name as "cityName",
        ber.zone_id as "zoneId",
        z.name as "zoneName",
        ber.cluster_id as "clusterId",
        cl.name as "clusterName",
        ber.category_id as "categoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        ber.service_control_mode as "serviceControlMode",
        ber.manual_service_status as "manualServiceStatus",
        ber.auto_start_at as "autoStartAt",
        ber.auto_end_at as "autoEndAt",
        ber.auto_start_time as "autoStartTime",
        ber.auto_end_time as "autoEndTime",
        ber.instant_eta_minutes as "instantEtaMinutes",
        ber.instant_initiate_minutes as "instantInitiateMinutes",
        ber.instant_wrap_up_minutes as "instantWrapUpMinutes",
        ber.instant_travel_minutes as "instantTravelMinutes",
        ber.schedule_eta_minutes as "scheduleEtaMinutes",
        ber.schedule_initiate_minutes as "scheduleInitiateMinutes",
        ber.schedule_wrap_up_minutes as "scheduleWrapUpMinutes",
        ber.schedule_travel_minutes as "scheduleTravelMinutes",
        ber.assistant_assignment_mode as "assistantAssignmentMode",
        ber.note,
        ber.image_url as "imageUrl",
        ber.metadata,
        ber.is_active as "isActive",
        ber.created_at as "createdAt",
        ber.updated_at as "updatedAt"
      from zigo.booking_engine_rules ber
      left join zigo.states state on state.id = ber.state_id
      left join zigo.cities city on city.id = ber.city_id
      left join zigo.zones z on z.id = ber.zone_id
      left join zigo.clusters cl on cl.id = ber.cluster_id
      left join zigo.categories c on c.id = ber.category_id
      where ${where.join(" and ")}
      order by ber.scope_type, coalesce(state.name, city.name, z.name, cl.name, c.name, 'All'), ber.updated_at desc
    `, params);
    return result.rows;
}
export async function resolveBookingEngineInstantEtaMinutes(input = {}) {
    await ensureBookingEngineRuleSchema();
    const context = await bookingEngineLocationContext(input.clusterId || null);
    const params = [];
    const matches = ["ber.scope_type = 'all'"];
    const categoryId = String(input.categoryId || "").trim();
    if (categoryId) {
        params.push(categoryId);
        matches.push(`(ber.scope_type = 'category' and ber.category_id = $${params.length}::uuid)`);
    }
    if (input.clusterId) {
        params.push(input.clusterId);
        matches.push(`(ber.scope_type = 'cluster' and ber.cluster_id = $${params.length}::uuid)`);
    }
    if (context.zoneId) {
        params.push(context.zoneId);
        matches.push(`(ber.scope_type = 'zone' and ber.zone_id = $${params.length}::uuid)`);
    }
    if (context.cityId) {
        params.push(context.cityId);
        matches.push(`(ber.scope_type = 'city' and ber.city_id = $${params.length}::uuid)`);
    }
    if (context.stateId) {
        params.push(context.stateId);
        matches.push(`(ber.scope_type = 'state' and ber.state_id = $${params.length}::uuid)`);
    }
    const result = await pool.query(`
      select ber.instant_eta_minutes as "instantEtaMinutes"
      from zigo.booking_engine_rules ber
      where coalesce(ber.is_deleted, false) = false
        and coalesce(ber.is_active, true) = true
        and coalesce(ber.instant_eta_minutes, 0) > 0
        and (${matches.join(" or ")})
      order by
        case ber.scope_type
          when 'category' then 1
          when 'cluster' then 2
          when 'zone' then 3
          when 'city' then 4
          when 'state' then 5
          else 6
        end,
        ber.updated_at desc
      limit 1
    `, params);
    return Math.max(0, Math.round(Number(result.rows[0]?.instantEtaMinutes || 0)));
}
export async function createBookingEngineRule(input) {
    await ensureBookingEngineRuleSchema();
    await validateBookingEngineRule(input);
    const scope = normalizeBookingEngineRuleScope(input);
    const timings = buildBookingEngineTiming(input);
    const metadata = buildBookingEngineMetadata(input, timings);
    const result = await pool.query(`
      insert into zigo.booking_engine_rules
        (scope_type, state_id, city_id, zone_id, cluster_id, category_id, service_control_mode,
         manual_service_status, auto_start_at, auto_end_at, auto_start_time, auto_end_time, instant_eta_minutes, instant_initiate_minutes, instant_wrap_up_minutes,
         instant_travel_minutes, schedule_eta_minutes, schedule_initiate_minutes, schedule_wrap_up_minutes, schedule_travel_minutes,
          assistant_assignment_mode, note, image_url, metadata, is_active, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24, $25, $25)
       returning id
    `, [
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        scope.categoryId,
        timings.serviceControlMode,
        timings.manualServiceStatus,
        timings.autoStartAt,
        timings.autoEndAt,
        timings.autoStartTime,
        timings.autoEndTime,
        timings.instantEtaMinutes,
        timings.instantInitiateMinutes,
        timings.instantWrapUpMinutes,
        timings.instantTravelMinutes,
        timings.scheduleEtaMinutes,
        timings.scheduleInitiateMinutes,
        timings.scheduleWrapUpMinutes,
        timings.scheduleTravelMinutes,
        timings.assistantAssignmentMode,
        input.note ?? null,
        input.imageUrl ?? null,
        JSON.stringify(metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateBookingEngineRule(id, input) {
    await ensureBookingEngineRuleSchema();
    await validateBookingEngineRule(input, id);
    const scope = normalizeBookingEngineRuleScope(input);
    const timings = buildBookingEngineTiming(input);
    const metadata = buildBookingEngineMetadata(input, timings);
    const result = await pool.query(`
      update zigo.booking_engine_rules
      set scope_type = $2,
          state_id = $3,
          city_id = $4,
          zone_id = $5,
          cluster_id = $6,
          category_id = $7,
          service_control_mode = $8,
          manual_service_status = $9,
          auto_start_at = $10::timestamptz,
          auto_end_at = $11::timestamptz,
          auto_start_time = $12,
          auto_end_time = $13,
          instant_eta_minutes = $14,
          instant_initiate_minutes = $15,
          instant_wrap_up_minutes = $16,
          instant_travel_minutes = $17,
          schedule_eta_minutes = $18,
          schedule_initiate_minutes = $19,
          schedule_wrap_up_minutes = $20,
          schedule_travel_minutes = $21,
          assistant_assignment_mode = $22,
          note = $23,
          image_url = $24,
          metadata = $25::jsonb,
          is_active = $26,
          updated_by = $27,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        scope.categoryId,
        timings.serviceControlMode,
        timings.manualServiceStatus,
        timings.autoStartAt,
        timings.autoEndAt,
        timings.autoStartTime,
        timings.autoEndTime,
        timings.instantEtaMinutes,
        timings.instantInitiateMinutes,
        timings.instantWrapUpMinutes,
        timings.instantTravelMinutes,
        timings.scheduleEtaMinutes,
        timings.scheduleInitiateMinutes,
        timings.scheduleWrapUpMinutes,
        timings.scheduleTravelMinutes,
        timings.assistantAssignmentMode,
        input.note ?? null,
        input.imageUrl ?? null,
        JSON.stringify(metadata),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteBookingEngineRule(id, userId) {
    await ensureBookingEngineRuleSchema();
    return softDelete("zigo.booking_engine_rules", id, userId);
}
export async function listBookingEngineQuickReplies(filters = {}) {
    await ensureBookingEngineQuickReplySchema();
    const where = ["coalesce(beqr.is_deleted, false) = false"];
    const params = [];
    if (filters.search?.trim()) {
        params.push(`%${filters.search.trim()}%`);
        where.push(`(
      beqr.title ilike $${params.length}
      or beqr.message ilike $${params.length}
      or coalesce(state.name, '') ilike $${params.length}
      or coalesce(city.name, '') ilike $${params.length}
      or coalesce(z.name, '') ilike $${params.length}
      or coalesce(cl.name, '') ilike $${params.length}
      or coalesce(c.name, '') ilike $${params.length}
      or beqr.booking_stage ilike $${params.length}
      or beqr.action_type ilike $${params.length}
    )`);
    }
    if (filters.scopeType) {
        params.push(filters.scopeType);
        where.push(`beqr.scope_type = $${params.length}`);
    }
    if (filters.stateId) {
        params.push(filters.stateId);
        where.push(`beqr.state_id = $${params.length}::uuid`);
    }
    if (filters.cityId) {
        params.push(filters.cityId);
        where.push(`beqr.city_id = $${params.length}::uuid`);
    }
    if (filters.zoneId) {
        params.push(filters.zoneId);
        where.push(`beqr.zone_id = $${params.length}::uuid`);
    }
    if (filters.clusterId) {
        params.push(filters.clusterId);
        where.push(`beqr.cluster_id = $${params.length}::uuid`);
    }
    if (filters.categoryId) {
        params.push(filters.categoryId);
        where.push(`beqr.category_id = $${params.length}::uuid`);
    }
    if (filters.actor) {
        params.push(filters.actor);
        where.push(`beqr.actor = $${params.length}`);
    }
    if (filters.audience) {
        params.push(filters.audience);
        where.push(`beqr.audience = $${params.length}`);
    }
    if (filters.bookingStage) {
        params.push(filters.bookingStage);
        where.push(`beqr.booking_stage = $${params.length}`);
    }
    if (filters.actionType) {
        params.push(filters.actionType);
        where.push(`beqr.action_type = $${params.length}`);
    }
    if (filters.status === "active")
        where.push("beqr.is_active = true");
    if (filters.status === "inactive")
        where.push("beqr.is_active = false");
    const result = await pool.query(`
      select ${bookingEngineQuickReplySelectColumns("beqr")}
      from zigo.booking_engine_quick_replies beqr
      left join zigo.states state on state.id = beqr.state_id
      left join zigo.cities city on city.id = beqr.city_id
      left join zigo.zones z on z.id = beqr.zone_id
      left join zigo.clusters cl on cl.id = beqr.cluster_id
      left join zigo.categories c on c.id = beqr.category_id
      where ${where.join(" and ")}
      order by beqr.actor, beqr.booking_stage, beqr.sort_order, beqr.title
    `, params);
    return result.rows;
}
export async function createBookingEngineQuickReply(input) {
    await ensureBookingEngineQuickReplySchema();
    await validateBookingEngineQuickReply(input);
    const scope = normalizeBookingEngineRuleScope(input);
    const result = await pool.query(`
      insert into zigo.booking_engine_quick_replies
        (scope_type, state_id, city_id, zone_id, cluster_id, category_id, actor, audience,
         booking_stage, action_type, title, message, sort_order, metadata, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $16)
      returning id
    `, [
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        scope.categoryId,
        input.actor,
        input.audience,
        input.bookingStage,
        input.actionType,
        input.title.trim(),
        input.message.trim(),
        Math.max(0, Math.round(Number(input.sortOrder || 0))),
        JSON.stringify(input.metadata || {}),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0];
}
export async function updateBookingEngineQuickReply(id, input) {
    await ensureBookingEngineQuickReplySchema();
    await validateBookingEngineQuickReply(input);
    const scope = normalizeBookingEngineRuleScope(input);
    const result = await pool.query(`
      update zigo.booking_engine_quick_replies
      set scope_type = $2,
          state_id = $3,
          city_id = $4,
          zone_id = $5,
          cluster_id = $6,
          category_id = $7,
          actor = $8,
          audience = $9,
          booking_stage = $10,
          action_type = $11,
          title = $12,
          message = $13,
          sort_order = $14,
          metadata = $15::jsonb,
          is_active = $16,
          updated_by = $17,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `, [
        id,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        scope.categoryId,
        input.actor,
        input.audience,
        input.bookingStage,
        input.actionType,
        input.title.trim(),
        input.message.trim(),
        Math.max(0, Math.round(Number(input.sortOrder || 0))),
        JSON.stringify(input.metadata || {}),
        input.isActive ?? true,
        input.userId
    ]);
    return result.rows[0] ?? null;
}
export async function deleteBookingEngineQuickReply(id, userId) {
    await ensureBookingEngineQuickReplySchema();
    return softDelete("zigo.booking_engine_quick_replies", id, userId);
}
export async function resolveBookingEngineRuleForContext(input = {}) {
    await ensureBookingEngineRuleSchema();
    const context = await bookingEngineLocationContext(input.clusterId || null);
    const result = await pool.query(`
      select ${bookingEngineRuleSelectColumns("ber")},
        case ber.scope_type
          when 'category' then 60
          when 'cluster' then 50
          when 'zone' then 40
          when 'city' then 30
          when 'state' then 20
          else 10
        end as "scopeRank"
      from zigo.booking_engine_rules ber
      left join zigo.states state on state.id = ber.state_id
      left join zigo.cities city on city.id = ber.city_id
      left join zigo.zones z on z.id = ber.zone_id
      left join zigo.clusters cl on cl.id = ber.cluster_id
      left join zigo.categories c on c.id = ber.category_id
      where coalesce(ber.is_deleted, false) = false
        and ber.is_active = true
        and (
          ber.scope_type = 'all'
          or (ber.scope_type = 'state' and ber.state_id = $1::uuid)
          or (ber.scope_type = 'city' and ber.city_id = $2::uuid)
          or (ber.scope_type = 'zone' and ber.zone_id = $3::uuid)
          or (ber.scope_type = 'cluster' and ber.cluster_id = $4::uuid)
          or (ber.scope_type = 'category' and ber.category_id = $5::uuid)
        )
      order by "scopeRank" desc, ber.updated_at desc
      limit 1
    `, [context.stateId, context.cityId, context.zoneId, input.clusterId || null, input.categoryId || null]);
    return result.rows[0] ?? null;
}
export async function listBookingEngineQuickRepliesForBooking(input) {
    await ensureBookingEngineQuickReplySchema();
    const booking = await pool.query(`
      select
        sr.id,
        sr.status_code as "statusCode",
        sr.cluster_id as "clusterId",
        coalesce(sr.category_id, nullif(sr.metadata->'categoryDetails'->>'categoryId', '')::uuid) as "categoryId",
        sr.metadata,
        ta.status_code as "assignmentStatus"
      from zigo.service_requests sr
      left join zigo.task_assignments ta on ta.id = sr.accepted_assignment_id
      where sr.id = $1
      limit 1
    `, [input.bookingId]);
    const row = booking.rows[0];
    if (!row)
        throw new HttpError(404, "Booking not found");
    const context = await bookingEngineLocationContext(row.clusterId);
    const stage = bookingEngineStageFromStatus(row.statusCode, row.assignmentStatus);
    const result = await pool.query(`
      select ${bookingEngineQuickReplySelectColumns("beqr")},
        $6::text as "resolvedBookingStage",
        case beqr.scope_type
          when 'category' then 60
          when 'cluster' then 50
          when 'zone' then 40
          when 'city' then 30
          when 'state' then 20
          else 10
        end as "scopeRank"
      from zigo.booking_engine_quick_replies beqr
      left join zigo.states state on state.id = beqr.state_id
      left join zigo.cities city on city.id = beqr.city_id
      left join zigo.zones z on z.id = beqr.zone_id
      left join zigo.clusters cl on cl.id = beqr.cluster_id
      left join zigo.categories c on c.id = beqr.category_id
      where coalesce(beqr.is_deleted, false) = false
        and beqr.is_active = true
        and beqr.actor = $1
        and beqr.booking_stage = $6
        and (
          beqr.scope_type = 'all'
          or (beqr.scope_type = 'state' and beqr.state_id = $2::uuid)
          or (beqr.scope_type = 'city' and beqr.city_id = $3::uuid)
          or (beqr.scope_type = 'zone' and beqr.zone_id = $4::uuid)
          or (beqr.scope_type = 'cluster' and beqr.cluster_id = $5::uuid)
          or (beqr.scope_type = 'category' and beqr.category_id = $7::uuid)
        )
      order by "scopeRank" desc, beqr.sort_order, beqr.title
    `, [input.actor, context.stateId, context.cityId, context.zoneId, row.clusterId, stage, row.categoryId]);
    return { bookingId: input.bookingId, bookingStage: stage, data: result.rows };
}
async function validateBookingEngineRule(input, excludeId) {
    const scope = normalizeBookingEngineRuleScope(input);
    if (scope.scopeType === "state")
        await assertActiveRecord("zigo.states", scope.stateId, "State");
    if (scope.scopeType === "city")
        await assertUsableCity(scope.cityId);
    if (scope.scopeType === "zone")
        await assertUsableZone(scope.zoneId);
    if (scope.scopeType === "cluster")
        await assertUsableClusterForSettings(scope.clusterId);
    if (scope.scopeType === "category")
        await assertUsableCategory(scope.categoryId);
    const timings = buildBookingEngineTiming(input);
    if (timings.serviceControlMode === "auto") {
        if (!timings.autoStartTime || !timings.autoEndTime)
            throw new HttpError(400, "Auto service mode requires Start and End time.");
        const startMinutes = bookingEngineTimeToMinutes(timings.autoStartTime);
        const endMinutes = bookingEngineTimeToMinutes(timings.autoEndTime);
        if (startMinutes == null || endMinutes == null)
            throw new HttpError(400, "Use valid auto service Start and End time.");
        if (startMinutes === endMinutes)
            throw new HttpError(400, "Auto service Start and End time cannot be the same.");
    }
    await assertNoDuplicateBookingEngineRule(scope, excludeId);
}
async function assertNoDuplicateBookingEngineRule(scope, excludeId) {
    const result = await pool.query(`
      select id
      from zigo.booking_engine_rules
      where coalesce(is_deleted, false) = false
        and scope_type = $1
        and state_id is not distinct from $2::uuid
        and city_id is not distinct from $3::uuid
        and zone_id is not distinct from $4::uuid
        and cluster_id is not distinct from $5::uuid
        and category_id is not distinct from $6::uuid
        and ($7::uuid is null or id <> $7::uuid)
      limit 1
    `, [scope.scopeType, scope.stateId, scope.cityId, scope.zoneId, scope.clusterId, scope.categoryId, excludeId ?? null]);
    if (result.rows.length) {
        throw new HttpError(409, "A Booking Engine rule already exists for this scope.");
    }
}
function normalizeBookingEngineRuleScope(input) {
    const scopeType = input.scopeType ?? "all";
    if (scopeType === "state" && !input.stateId)
        throw new HttpError(400, "State is required for state-scoped booking engine rules.");
    if (scopeType === "city" && !input.cityId)
        throw new HttpError(400, "City is required for city-scoped booking engine rules.");
    if (scopeType === "zone" && !input.zoneId)
        throw new HttpError(400, "Zone is required for zone-scoped booking engine rules.");
    if (scopeType === "cluster" && !input.clusterId)
        throw new HttpError(400, "Cluster is required for cluster-scoped booking engine rules.");
    if (scopeType === "category" && !input.categoryId)
        throw new HttpError(400, "Category is required for category-scoped booking engine rules.");
    return {
        scopeType,
        stateId: scopeType === "state" ? input.stateId : null,
        cityId: scopeType === "city" ? input.cityId : null,
        zoneId: scopeType === "zone" ? input.zoneId : null,
        clusterId: scopeType === "cluster" ? input.clusterId : null,
        categoryId: scopeType === "category" ? input.categoryId : null
    };
}
function normalizeBookingEngineTimeValue(value) {
    const text = String(value || "").trim();
    if (!text)
        return null;
    return /^\d{2}:\d{2}$/.test(text) ? text : null;
}
function bookingEngineTimeToMinutes(value) {
    const normalized = normalizeBookingEngineTimeValue(value);
    if (!normalized)
        return null;
    const [hoursText, minutesText] = normalized.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes))
        return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
        return null;
    return hours * 60 + minutes;
}
function buildBookingEngineTiming(input) {
    const boundedMinutes = (value) => Math.max(0, Math.min(1440, Math.round(Number(value ?? 0))));
    const serviceControlMode = input.serviceControlMode === "auto" ? "auto" : "manual";
    return {
        serviceControlMode,
        manualServiceStatus: input.manualServiceStatus === "start" ? "start" : "stop",
        autoStartAt: serviceControlMode === "auto" ? input.autoStartAt || null : null,
        autoEndAt: serviceControlMode === "auto" ? input.autoEndAt || null : null,
        autoStartTime: serviceControlMode === "auto" ? normalizeBookingEngineTimeValue(input.autoStartTime) : null,
        autoEndTime: serviceControlMode === "auto" ? normalizeBookingEngineTimeValue(input.autoEndTime) : null,
        instantEtaMinutes: boundedMinutes(input.instantEtaMinutes),
        instantInitiateMinutes: boundedMinutes(input.instantInitiateMinutes),
        instantWrapUpMinutes: boundedMinutes(input.instantWrapUpMinutes),
        instantTravelMinutes: boundedMinutes(input.instantTravelMinutes),
        scheduleEtaMinutes: boundedMinutes(input.scheduleEtaMinutes),
        scheduleInitiateMinutes: boundedMinutes(input.scheduleInitiateMinutes),
        scheduleWrapUpMinutes: boundedMinutes(input.scheduleWrapUpMinutes),
        scheduleTravelMinutes: boundedMinutes(input.scheduleTravelMinutes),
        assistantAssignmentMode: input.assistantAssignmentMode === "auto" ? "auto" : "manual"
    };
}
function buildBookingEngineMetadata(input, timings) {
    return {
        serviceCalendar: {
            mode: timings.serviceControlMode,
            manualStatus: timings.manualServiceStatus,
            autoStartAt: timings.autoStartAt,
            autoEndAt: timings.autoEndAt,
            autoStartTime: timings.autoStartTime,
            autoEndTime: timings.autoEndTime
        },
        instant: {
            etaMinutes: timings.instantEtaMinutes,
            initiateMinutes: timings.instantInitiateMinutes,
            bookingWrapUpMinutes: timings.instantWrapUpMinutes,
            travelTimeToReachMinutes: timings.instantTravelMinutes
        },
        schedule: {
            etaMinutes: timings.scheduleEtaMinutes,
            initiateMinutes: timings.scheduleInitiateMinutes,
            bookingWrapUpMinutes: timings.scheduleWrapUpMinutes,
            travelTimeToReachMinutes: timings.scheduleTravelMinutes
        },
        assistantAssignment: {
            mode: timings.assistantAssignmentMode,
            manualNote: "Booking confirmed and assistant assigned manually by admin.",
            autoNote: "Booking confirmed and assistant assigned as per availability."
        },
        note: input.note ?? "",
        imageUrl: input.imageUrl ?? ""
    };
}
function bookingEngineRuleSelectColumns(alias = "ber") {
    return `
    ${alias}.id,
    ${alias}.scope_type as "scopeType",
    ${alias}.state_id as "stateId",
    state.name as "stateName",
    ${alias}.city_id as "cityId",
    city.name as "cityName",
    ${alias}.zone_id as "zoneId",
    z.name as "zoneName",
    ${alias}.cluster_id as "clusterId",
    cl.name as "clusterName",
    ${alias}.category_id as "categoryId",
    c.name as "categoryName",
    c.code as "categoryCode",
    ${alias}.service_control_mode as "serviceControlMode",
    ${alias}.manual_service_status as "manualServiceStatus",
    ${alias}.auto_start_at as "autoStartAt",
    ${alias}.auto_end_at as "autoEndAt",
    ${alias}.auto_start_time as "autoStartTime",
    ${alias}.auto_end_time as "autoEndTime",
    ${alias}.instant_eta_minutes as "instantEtaMinutes",
    ${alias}.instant_initiate_minutes as "instantInitiateMinutes",
    ${alias}.instant_wrap_up_minutes as "instantWrapUpMinutes",
    ${alias}.instant_travel_minutes as "instantTravelMinutes",
    ${alias}.schedule_eta_minutes as "scheduleEtaMinutes",
    ${alias}.schedule_initiate_minutes as "scheduleInitiateMinutes",
    ${alias}.schedule_wrap_up_minutes as "scheduleWrapUpMinutes",
    ${alias}.schedule_travel_minutes as "scheduleTravelMinutes",
    ${alias}.assistant_assignment_mode as "assistantAssignmentMode",
    ${alias}.note,
    ${alias}.image_url as "imageUrl",
    ${alias}.metadata,
    ${alias}.is_active as "isActive",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}
function bookingEngineQuickReplySelectColumns(alias = "beqr") {
    return `
    ${alias}.id,
    ${alias}.scope_type as "scopeType",
    ${alias}.state_id as "stateId",
    state.name as "stateName",
    ${alias}.city_id as "cityId",
    city.name as "cityName",
    ${alias}.zone_id as "zoneId",
    z.name as "zoneName",
    ${alias}.cluster_id as "clusterId",
    cl.name as "clusterName",
    ${alias}.category_id as "categoryId",
    c.name as "categoryName",
    c.code as "categoryCode",
    ${alias}.actor,
    ${alias}.audience,
    ${alias}.booking_stage as "bookingStage",
    ${alias}.action_type as "actionType",
    ${alias}.title,
    ${alias}.message,
    ${alias}.sort_order as "sortOrder",
    ${alias}.metadata,
    ${alias}.is_active as "isActive",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}
async function validateBookingEngineQuickReply(input) {
    const scope = normalizeBookingEngineRuleScope(input);
    if (scope.scopeType === "state")
        await assertActiveRecord("zigo.states", scope.stateId, "State");
    if (scope.scopeType === "city")
        await assertUsableCity(scope.cityId);
    if (scope.scopeType === "zone")
        await assertUsableZone(scope.zoneId);
    if (scope.scopeType === "cluster")
        await assertUsableClusterForSettings(scope.clusterId);
    if (scope.scopeType === "category")
        await assertUsableCategory(scope.categoryId);
    if (!input.title?.trim())
        throw new HttpError(400, "Quick reply title is required.");
    if (!input.message?.trim())
        throw new HttpError(400, "Quick reply message is required.");
}
async function bookingEngineLocationContext(clusterId) {
    if (!clusterId)
        return { stateId: null, cityId: null, zoneId: null };
    const result = await pool.query(`
      select
        city.state_id as "stateId",
        cl.city_id as "cityId",
        cl.zone_id as "zoneId"
      from zigo.clusters cl
      left join zigo.cities city on city.id = cl.city_id
      where cl.id = $1::uuid
      limit 1
    `, [clusterId]);
    return result.rows[0] ?? { stateId: null, cityId: null, zoneId: null };
}
function bookingEngineStageFromStatus(statusCode, assignmentStatus) {
    const status = String(statusCode || "").toLowerCase();
    const assignment = String(assignmentStatus || "").toLowerCase();
    if (status === "completed")
        return "completed";
    if (status === "cancelled" || status === "failed")
        return "cancelled";
    if (status === "rejected" || assignment === "rejected")
        return "rejected";
    if (status === "hold")
        return "hold";
    if (status === "in_progress" || status === "approval_pending" || assignment === "in_progress")
        return "working";
    if (assignment === "accepted" || status === "accepted")
        return "accepted";
    if (status === "assigned" || assignment === "offered" || assignment === "reserved")
        return "assigned";
    return "pending_assign";
}
async function validateCategoryPriceRule(input, excludeId) {
    const scope = normalizeCategoryPriceScope(input);
    await assertUsableCategory(input.categoryId);
    if (scope.scopeType === "state")
        await assertActiveRecord("zigo.states", scope.stateId, "State");
    if (scope.scopeType === "city")
        await assertUsableCity(scope.cityId);
    if (scope.scopeType === "zone")
        await assertUsableZone(scope.zoneId);
    if (scope.scopeType === "cluster")
        await assertUsableClusterForSettings(scope.clusterId);
    await assertNoDuplicateCategoryPriceRule(input, scope, excludeId);
}
async function assertNoDuplicateCategoryPriceRule(input, scope, excludeId) {
    const result = await pool.query(`
      select id
      from zigo.category_price_rules
      where coalesce(is_deleted, false) = false
        and scope_type = $1
        and state_id is not distinct from $2::uuid
        and city_id is not distinct from $3::uuid
        and zone_id is not distinct from $4::uuid
        and cluster_id is not distinct from $5::uuid
        and category_id = $6::uuid
        and time_duration_minutes = $7
        and ($8::uuid is null or id <> $8::uuid)
      limit 1
    `, [
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.categoryId,
        Math.max(0, Math.round(Number(input.timeDurationMinutes ?? 0))),
        excludeId ?? null
    ]);
    if (result.rows.length) {
        throw new HttpError(409, "A Category Price rule already exists for this scope, category, and time duration.");
    }
}
function normalizeCategoryPriceScope(input) {
    const scopeType = input.scopeType ?? "all";
    if (scopeType === "state" && !input.stateId)
        throw new HttpError(400, "State is required for state-scoped category prices.");
    if (scopeType === "city" && !input.cityId)
        throw new HttpError(400, "City is required for city-scoped category prices.");
    if (scopeType === "zone" && !input.zoneId)
        throw new HttpError(400, "Zone is required for zone-scoped category prices.");
    if (scopeType === "cluster" && !input.clusterId)
        throw new HttpError(400, "Cluster is required for cluster-scoped category prices.");
    return {
        scopeType,
        stateId: scopeType === "state" ? input.stateId : null,
        cityId: scopeType === "city" ? input.cityId : null,
        zoneId: scopeType === "zone" ? input.zoneId : null,
        clusterId: scopeType === "cluster" ? input.clusterId : null
    };
}
function buildCategoryPriceSlab(input) {
    const basePrice = roundCategoryPriceMoney(Math.max(0, Number(input.basePrice ?? 0)));
    const discountType = input.discountType === "percent" || input.discountType === "flat" ? input.discountType : "none";
    const discountValue = roundCategoryPriceMoney(Math.max(0, Number(input.discountValue ?? 0)));
    const discountAmount = discountType === "percent" ? (basePrice * Math.min(discountValue, 100)) / 100 : discountType === "flat" ? discountValue : 0;
    const calculatedSellingPrice = Math.max(0, basePrice - discountAmount);
    const timeDurationMinutes = Math.max(0, Math.round(Number(input.timeDurationMinutes ?? 0)));
    return {
        label: String(input.label || "").trim() || `${timeDurationMinutes} min`,
        timeDurationMinutes,
        basePrice,
        discountType,
        discountValue,
        sellingPrice: roundCategoryPriceMoney(Math.max(0, Number(input.sellingPrice ?? calculatedSellingPrice))),
        waitingChargeAmount: roundCategoryPriceMoney(Math.max(0, Number(input.waitingChargeAmount ?? 0))),
        waitingChargeTimeMinutes: Math.max(0, Math.round(Number(input.waitingChargeTimeMinutes ?? 0))),
        availableForDuration: input.availableForDuration !== false,
        availableForExtend: input.availableForExtend === true,
        availableForExpand: input.availableForExpand === true,
        isDurationForOffers: input.isDurationForOffers === true,
        isOfferEligible: input.isOfferEligible !== false
    };
}
function roundCategoryPriceMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}
async function validatePriceMasterRule(input, excludeId) {
    const scope = normalizePriceMasterScope(input);
    if (!input.serviceId)
        throw new HttpError(400, "Service is required for Price Master rules.");
    await assertUsableService(input.serviceId);
    if (input.categoryId)
        await assertUsableCategoryForService(input.categoryId, input.serviceId);
    if (input.storeId)
        await assertActiveRecord("zigo.stores", input.storeId, "Store");
    if (scope.scopeType === "state")
        await assertActiveRecord("zigo.states", scope.stateId, "State");
    if (scope.scopeType === "city")
        await assertUsableCity(scope.cityId);
    if (scope.scopeType === "zone")
        await assertUsableZone(scope.zoneId);
    if (scope.scopeType === "cluster")
        await assertUsableClusterForSettings(scope.clusterId);
    await assertNoDuplicatePriceMasterRule(input, scope, excludeId);
    if (input.priceType === "time" && !normalizeTimeSlabs(input.timeSlabs ?? []).length) {
        throw new HttpError(400, "At least one time slab is required for time pricing.");
    }
    if (input.priceType === "task") {
        if (isCategoryGroupPricingEnabled(input.metadata)) {
            const group = normalizeCategoryGroupPricing(input.metadata);
            if (!group.slabs.length)
                throw new HttpError(400, "Add price rows for this service's categories before saving Price Master.");
            for (const slab of group.slabs) {
                await assertUsableCategoryForService(slab.categoryId, input.serviceId);
                if (slab.basePrice <= 0 || slab.sellingPrice <= 0) {
                    throw new HttpError(400, `Price is required for ${slab.categoryName || "category"}. Enter Base Price and Selling Price greater than 0.`);
                }
            }
            return;
        }
        const maxStoresPerCategory = Math.max(1, Number(input.maxStoresPerCategory ?? 1));
        const slabStoreCount = normalizeComplexitySlabs(input.complexitySlabs ?? []).reduce((sum, slab) => sum + slab.storeNumber, 0);
        if (1 + slabStoreCount > maxStoresPerCategory) {
            throw new HttpError(400, `Maximum store in category limit exceeded. Max store in category is ${maxStoresPerCategory}; 1st store is reserved and task slabs use ${slabStoreCount}.`);
        }
    }
}
async function assertNoDuplicatePriceMasterRule(input, scope, excludeId) {
    const result = await pool.query(`
      select id
      from zigo.price_master_rules
      where coalesce(is_deleted, false) = false
        and price_type = $1
        and scope_type = $2
        and state_id is not distinct from $3::uuid
        and city_id is not distinct from $4::uuid
        and zone_id is not distinct from $5::uuid
        and cluster_id is not distinct from $6::uuid
        and service_id is not distinct from $7::uuid
        and category_id is not distinct from $8::uuid
        and store_id is not distinct from $9::uuid
        and ($10::uuid is null or id <> $10::uuid)
      limit 1
    `, [
        input.priceType,
        scope.scopeType,
        scope.stateId,
        scope.cityId,
        scope.zoneId,
        scope.clusterId,
        input.serviceId ?? null,
        input.categoryId ?? null,
        input.storeId ?? null,
        excludeId ?? null
    ]);
    if (result.rows.length) {
        throw new HttpError(409, "A Price Master rule already exists for the same price type, scope, service, category, and store.");
    }
}
function normalizePriceMasterScope(input) {
    const scopeType = input.scopeType ?? "all";
    if (scopeType === "state" && !input.stateId)
        throw new HttpError(400, "State is required for state-scoped price rules.");
    if (scopeType === "city" && !input.cityId)
        throw new HttpError(400, "City is required for city-scoped price rules.");
    if (scopeType === "zone" && !input.zoneId)
        throw new HttpError(400, "Zone is required for zone-scoped price rules.");
    if (scopeType === "cluster" && !input.clusterId)
        throw new HttpError(400, "Cluster is required for cluster-scoped price rules.");
    return {
        scopeType,
        stateId: scopeType === "state" ? input.stateId : null,
        cityId: scopeType === "city" ? input.cityId : null,
        zoneId: scopeType === "zone" ? input.zoneId : null,
        clusterId: scopeType === "cluster" ? input.clusterId : null
    };
}
function buildPriceMasterPricing(input) {
    const basePrice = Math.max(0, Number(input.basePrice ?? 0));
    const discountType = input.discountType ?? "none";
    const discountValue = Math.max(0, Number(input.discountValue ?? 0));
    const discountAmount = discountType === "percent" ? (basePrice * Math.min(discountValue, 100)) / 100 : discountType === "flat" ? discountValue : 0;
    return {
        basePrice,
        discountType,
        discountValue,
        sellingPrice: Math.max(0, Number(input.sellingPrice ?? basePrice - discountAmount))
    };
}
function normalizeTimeSlabs(slabs) {
    return (slabs || [])
        .map((slab) => {
        const durationMinutes = Math.max(1, Math.round(Number(slab.durationMinutes || 0)));
        const basePrice = Math.max(0, Number(slab.basePrice ?? slab.price ?? slab.sellingPrice ?? 0));
        const discountType = slab.discountType === "percent" || slab.discountType === "flat" ? slab.discountType : "none";
        const discountValue = Math.max(0, Number(slab.discountValue ?? 0));
        const discountAmount = discountType === "percent" ? (basePrice * Math.min(discountValue, 100)) / 100 : discountType === "flat" ? discountValue : 0;
        const sellingPrice = Math.max(0, Number(slab.sellingPrice ?? slab.price ?? basePrice - discountAmount));
        return {
            label: String(slab.label || "").trim() || `${durationMinutes} min`,
            durationMinutes,
            basePrice,
            discountType,
            discountValue,
            sellingPrice,
            price: sellingPrice,
            isActive: slab.isActive !== false
        };
    })
        .filter((slab) => slab.durationMinutes > 0 && slab.sellingPrice >= 0)
        .sort((a, b) => a.durationMinutes - b.durationMinutes);
}
function normalizeComplexitySlabs(slabs) {
    const normalized = [];
    for (const slab of slabs || []) {
        const storeNumber = Math.max(1, Math.round(Number(slab.storeNumber || 0)));
        const multiplier = Math.max(0, Number(slab.multiplier || 0));
        const durationMinutes = Math.max(0, Math.round(Number(slab.durationMinutes || 0)));
        if (storeNumber >= 1 && multiplier > 0)
            normalized.push({ storeNumber, multiplier, durationMinutes });
    }
    return normalized;
}
function priceMasterTaskDurationMinutes(metadata) {
    const root = metadata && typeof metadata === "object" ? metadata : {};
    return Math.max(0, Math.round(Number(root.taskDurationMinutes || 0)));
}
function priceMasterWaitingCharge(metadata) {
    const root = metadata && typeof metadata === "object" ? metadata : {};
    const allottedRaw = root.allottedTime && typeof root.allottedTime === "object" ? root.allottedTime : {};
    const amount = Math.max(0, Number(allottedRaw.waitingCharge || allottedRaw.waitingChargeAmount || 0));
    const chargePerMinutes = Math.max(0, Math.round(Number(allottedRaw.chargePerMinutes || allottedRaw.waitingChargeMinutes || 0)));
    return {
        allottedTime: {
            enabled: Boolean(allottedRaw.enabled),
            durationMinutes: Math.max(0, Math.round(Number(allottedRaw.durationMinutes || root.taskDurationMinutes || 0)))
        },
        waitingCharge: {
            enabled: Boolean(allottedRaw.enabled) && amount > 0 && chargePerMinutes > 0,
            amount,
            chargePerMinutes
        }
    };
}
export async function quotePriceMaster(input) {
    await ensurePriceMasterSchema();
    const cartItems = input.cartItems || [];
    if (input.priceType === "time")
        return quoteTimePrice(input);
    return quoteTaskPrice({ ...input, cartItems });
}
async function quoteTaskPrice(input) {
    const errors = [];
    const cartServiceIds = new Set(input.cartItems.map((item) => item.serviceId || input.serviceId));
    const categoryGroupRule = cartServiceIds.size <= 1 ? await findCategoryGroupPriceMasterRule(input) : null;
    if (categoryGroupRule)
        return quoteCategoryGroupTaskPrice(input, categoryGroupRule);
    if (!input.cartItems.length)
        errors.push("Add at least one store to quote task pricing.");
    const categoryCounts = new Map();
    const categoryGroupCounts = new Map();
    const serviceStoreCounts = new Map();
    let runningTotal = 0;
    const lineItems = [];
    for (const [index, item] of input.cartItems.entries()) {
        const itemServiceId = item.serviceId || input.serviceId;
        if (item.priceType === "time") {
            const timeQuote = await quoteTimePrice({ ...input, serviceId: itemServiceId, categoryId: item.categoryId || null, durationMinutes: item.durationMinutes ?? input.durationMinutes ?? 1, priceType: "time" });
            if (!timeQuote.isValid) {
                errors.push(...timeQuote.errors);
                continue;
            }
            const line = timeQuote.lineItems[0];
            const amount = Number(line?.amount || 0);
            runningTotal += amount;
            lineItems.push({
                ...line,
                amount: roundMoney(amount),
                runningTotal: roundMoney(runningTotal)
            });
            continue;
        }
        if (!item.categoryId) {
            errors.push("Category is required for selected cart item.");
            continue;
        }
        const categoryKey = `${itemServiceId}:${item.categoryId}`;
        const count = (categoryCounts.get(categoryKey) || 0) + 1;
        categoryCounts.set(categoryKey, count);
        const groupRule = !item.storeId ? await findCategoryGroupPriceMasterRule({ ...input, serviceId: itemServiceId, categoryId: item.categoryId, priceType: "task" }) : null;
        if (groupRule) {
            const group = normalizeCategoryGroupPricing(groupRule.metadata);
            const serviceCategoryIds = categoryGroupCounts.get(itemServiceId) || new Set();
            categoryGroupCounts.set(itemServiceId, serviceCategoryIds);
            if (serviceCategoryIds.has(item.categoryId)) {
                errors.push("This category is already added in cart.");
                continue;
            }
            serviceCategoryIds.add(item.categoryId);
            const maxAllowed = group.maxCategoriesAllowed;
            if (maxAllowed !== "all" && serviceCategoryIds.size > maxAllowed) {
                errors.push(`Maximum categories allowed in cart: ${maxAllowed}.`);
                continue;
            }
            const slab = group.slabs.find((candidate) => candidate.categoryId === item.categoryId && candidate.sellingPrice > 0);
            if (!slab) {
                errors.push("Price Master price is required for selected category.");
                continue;
            }
            const amount = slab.sellingPrice;
            runningTotal += amount;
            lineItems.push({
                categoryId: item.categoryId,
                categoryName: slab.categoryName,
                storeId: null,
                storeName: null,
                ruleId: groupRule.id,
                priceLogic: "category selling price",
                basePrice: roundMoney(slab.basePrice),
                discountType: slab.discountType,
                discountValue: roundMoney(slab.discountValue),
                durationMinutes: Math.max(0, Number(slab.durationMinutes || 0)),
                allottedTime: slab.allottedTime,
                waitingCharge: slab.waitingCharge,
                amount: roundMoney(amount),
                runningTotal: roundMoney(runningTotal)
            });
            continue;
        }
        const rule = await findPriceMasterRule({ ...input, serviceId: itemServiceId, categoryId: item.categoryId, storeId: item.storeId || null, priceType: "task" });
        if (!rule) {
            errors.push(`No task price rule found for selected category/store.`);
            continue;
        }
        const serviceStoreCount = (serviceStoreCounts.get(itemServiceId) || 0) + 1;
        serviceStoreCounts.set(itemServiceId, serviceStoreCount);
        const maxStoresTotal = Number(rule.max_stores_total || 0);
        if (maxStoresTotal > 0 && serviceStoreCount > maxStoresTotal) {
            errors.push(`Maximum stores limit reached. Remove a store from cart to add a new store.`);
            continue;
        }
        if (count > Number(rule.max_stores_per_category || 1)) {
            errors.push(`Maximum stores limit reached for ${rule.categoryName || "category"}. Remove a store from cart to add a new store.`);
            continue;
        }
        const parentDurationMinutes = priceMasterTaskDurationMinutes(rule.metadata);
        const price = count === 1
            ? { amount: Number(rule.selling_price || 0), label: "1st store selling price", durationMinutes: parentDurationMinutes }
            : complexityPrice(rule, count);
        if (price.error) {
            errors.push(price.error);
            continue;
        }
        const durationMinutes = count === 1
            ? parentDurationMinutes
            : Math.max(0, Number(price.durationMinutes || 0));
        const amount = price.amount;
        const waitingConfig = priceMasterWaitingCharge(rule.metadata);
        runningTotal += amount;
        lineItems.push({
            categoryId: item.categoryId,
            categoryName: rule.categoryName,
            storeId: item.storeId || null,
            storeName: rule.storeName,
            ruleId: rule.id,
            priceLogic: price.label,
            durationMinutes,
            allottedTime: waitingConfig.allottedTime,
            waitingCharge: waitingConfig.waitingCharge,
            amount: roundMoney(amount),
            runningTotal: roundMoney(runningTotal)
        });
    }
    return { priceType: "task", lineItems, errors, grandTotal: roundMoney(runningTotal), grandTotalPaise: Math.round(runningTotal * 100), isValid: errors.length === 0 };
}
async function quoteCategoryGroupTaskPrice(input, rule) {
    const errors = [];
    if (!input.cartItems.length)
        errors.push("Add at least one category to quote task pricing.");
    const group = normalizeCategoryGroupPricing(rule.metadata);
    const maxAllowed = group.maxCategoriesAllowed;
    const uniqueCategoryIds = new Set();
    let runningTotal = 0;
    const lineItems = [];
    for (const item of input.cartItems) {
        if (!item.categoryId) {
            errors.push("Category is required for selected cart item.");
            continue;
        }
        if (uniqueCategoryIds.has(item.categoryId)) {
            errors.push("This category is already added in cart.");
            continue;
        }
        uniqueCategoryIds.add(item.categoryId);
        if (maxAllowed !== "all" && uniqueCategoryIds.size > maxAllowed) {
            errors.push(`Maximum categories allowed in cart: ${maxAllowed}.`);
            continue;
        }
        const slab = group.slabs.find((candidate) => candidate.categoryId === item.categoryId && candidate.sellingPrice > 0);
        if (!slab) {
            errors.push("Price Master price is required for selected category.");
            continue;
        }
        const amount = slab.sellingPrice;
        runningTotal += amount;
        lineItems.push({
            categoryId: item.categoryId,
            categoryName: slab.categoryName,
            storeId: null,
            storeName: null,
            ruleId: rule.id,
            priceLogic: "category selling price",
            basePrice: roundMoney(slab.basePrice),
            discountType: slab.discountType,
            discountValue: roundMoney(slab.discountValue),
            durationMinutes: Math.max(0, Number(slab.durationMinutes || 0)),
            allottedTime: slab.allottedTime,
            waitingCharge: slab.waitingCharge,
            amount: roundMoney(amount),
            runningTotal: roundMoney(runningTotal)
        });
    }
    return { priceType: "task", lineItems, errors, grandTotal: roundMoney(runningTotal), grandTotalPaise: Math.round(runningTotal * 100), isValid: errors.length === 0 };
}
async function quoteTimePrice(input) {
    const rule = await findPriceMasterRule({ ...input, storeId: null, priceType: "time" });
    const errors = [];
    if (!rule)
        return { priceType: "time", lineItems: [], errors: ["No time price rule found."], grandTotal: 0, grandTotalPaise: 0, isValid: false };
    const duration = Math.max(1, Number(input.durationMinutes || 1));
    const slabs = normalizeTimeSlabs(rule.time_slabs || []).filter((slab) => slab.isActive !== false);
    const slab = slabs.find((candidate) => candidate.durationMinutes >= duration);
    if (!slab)
        errors.push(`No matching time slab found for ${duration} minutes.`);
    const amount = slab?.price || 0;
    return {
        priceType: "time",
        lineItems: slab ? [{ categoryId: input.categoryId || null, categoryName: rule.categoryName, ruleId: rule.id, durationMinutes: duration, billedDurationMinutes: slab.durationMinutes, slab, amount, runningTotal: amount }] : [],
        errors,
        grandTotal: roundMoney(amount),
        grandTotalPaise: Math.round(amount * 100),
        isValid: errors.length === 0
    };
}
function normalizeCategoryGroupPricing(metadata) {
    const root = metadata && typeof metadata === "object" ? metadata : {};
    const sourceRaw = root.categoryGroupPricing;
    const source = sourceRaw && typeof sourceRaw === "object" ? sourceRaw : {};
    const slabsRaw = Array.isArray(source.slabs) ? source.slabs : [];
    const maxRaw = source.maxCategoriesAllowed;
    return {
        enabled: Boolean(source.enabled),
        maxCategoriesAllowed: maxRaw === "all" || maxRaw === undefined ? "all" : Math.max(1, Math.round(Number(maxRaw || 1))),
        slabs: slabsRaw
            .map((item) => {
            const slab = item && typeof item === "object" ? item : {};
            const discountType = slab.discountType === "percent" || slab.discountType === "flat" ? slab.discountType : "none";
            const allottedTimeRaw = slab.allottedTime && typeof slab.allottedTime === "object" ? slab.allottedTime : {};
            const allottedDurationMinutes = Math.max(0, Math.round(Number(allottedTimeRaw.durationMinutes || slab.durationMinutes || priceMasterTaskDurationMinutes(root) || 0)));
            const waitingRaw = slab.waitingCharge && typeof slab.waitingCharge === "object" ? slab.waitingCharge : {};
            const waitingAmount = Math.max(0, Number(waitingRaw.amount || 0));
            const waitingMinutes = Math.max(0, Math.round(Number(waitingRaw.chargePerMinutes || 0)));
            return {
                categoryId: String(slab.categoryId || ""),
                categoryName: String(slab.categoryName || ""),
                basePrice: Math.max(0, Number(slab.basePrice || 0)),
                discountType,
                discountValue: Math.max(0, Number(slab.discountValue || 0)),
                sellingPrice: Math.max(0, Number(slab.sellingPrice ?? slab.basePrice ?? 0)),
                durationMinutes: allottedDurationMinutes,
                allottedTime: {
                    enabled: Boolean(allottedTimeRaw.enabled),
                    durationMinutes: allottedDurationMinutes
                },
                waitingCharge: {
                    enabled: Boolean(waitingRaw.enabled) && waitingAmount > 0 && waitingMinutes > 0,
                    amount: waitingAmount,
                    chargePerMinutes: waitingMinutes
                }
            };
        })
            .filter((slab) => slab.categoryId)
    };
}
function isCategoryGroupPricingEnabled(metadata) {
    return normalizeCategoryGroupPricing(metadata).enabled;
}
async function findCategoryGroupPriceMasterRule(input) {
    const scope = await resolvePriceScope(input);
    const result = await pool.query(`
      select pm.*, s.name as "serviceName",
        case pm.scope_type
          when 'cluster' then 5
          when 'zone' then 4
          when 'city' then 3
          when 'state' then 2
          else 1
        end as scope_rank,
        case when pm.category_id is null then 1 else 0 end as service_rule_rank,
        coalesce((
          select count(*)
          from jsonb_array_elements(coalesce(pm.metadata->'categoryGroupPricing'->'slabs', '[]'::jsonb)) as slab
          where coalesce((slab->>'sellingPrice')::numeric, 0) > 0
        ), 0) as priced_slab_count
      from zigo.price_master_rules pm
      left join zigo.services s on s.id = pm.service_id
      where coalesce(pm.is_deleted, false) = false
        and pm.is_active = true
        and pm.price_type = 'task'
        and pm.service_id = $1
        and coalesce((pm.metadata->'categoryGroupPricing'->>'enabled')::boolean, false) = true
        and (
          pm.scope_type = 'all'
          or (pm.scope_type = 'state' and pm.state_id = $2::uuid)
          or (pm.scope_type = 'city' and pm.city_id = $3::uuid)
          or (pm.scope_type = 'zone' and pm.zone_id = $4::uuid)
          or (pm.scope_type = 'cluster' and pm.cluster_id = $5::uuid)
        )
      order by priced_slab_count desc, scope_rank desc, service_rule_rank desc, pm.updated_at desc
      limit 1
    `, [input.serviceId, scope.stateId, scope.cityId, scope.zoneId, scope.clusterId]);
    return result.rows[0] ?? null;
}
async function findPriceMasterRule(input) {
    const scope = await resolvePriceScope(input);
    const result = await pool.query(`
      select pm.*, s.name as "serviceName", c.name as "categoryName", st.name as "storeName",
        case pm.scope_type
          when 'cluster' then 5
          when 'zone' then 4
          when 'city' then 3
          when 'state' then 2
          else 1
        end as scope_rank,
        case when pm.store_id is not null then 2 else 1 end as store_rank
      from zigo.price_master_rules pm
      left join zigo.services s on s.id = pm.service_id
      left join zigo.categories c on c.id = pm.category_id
      left join zigo.stores st on st.id = pm.store_id
      where coalesce(pm.is_deleted, false) = false
        and pm.is_active = true
        and pm.price_type = $1
        and pm.service_id = $2
        and (($3::uuid is null and pm.category_id is null) or pm.category_id = $3::uuid)
        and (pm.store_id is null or pm.store_id = $4::uuid)
        and (
          pm.scope_type = 'all'
          or (pm.scope_type = 'state' and pm.state_id = $5::uuid)
          or (pm.scope_type = 'city' and pm.city_id = $6::uuid)
          or (pm.scope_type = 'zone' and pm.zone_id = $7::uuid)
          or (pm.scope_type = 'cluster' and pm.cluster_id = $8::uuid)
        )
      order by scope_rank desc, store_rank desc, pm.updated_at desc
      limit 1
    `, [input.priceType, input.serviceId, input.categoryId ?? null, input.storeId ?? null, scope.stateId, scope.cityId, scope.zoneId, scope.clusterId]);
    return result.rows[0] ?? null;
}
async function resolvePriceScope(input) {
    if (input.clusterId) {
        const result = await pool.query(`select cl.id as "clusterId", cl.city_id as "cityId", cl.zone_id as "zoneId", city.state_id as "stateId"
       from zigo.clusters cl left join zigo.cities city on city.id = cl.city_id where cl.id = $1`, [input.clusterId]);
        if (result.rows[0])
            return result.rows[0];
    }
    return { stateId: input.stateId ?? null, cityId: input.cityId ?? null, zoneId: input.zoneId ?? null, clusterId: input.clusterId ?? null };
}
function complexityPrice(rule, storeNumber) {
    const additionalStoreNumber = storeNumber - 1;
    let slabStart = 1;
    for (const slab of normalizeComplexitySlabs(rule.complexity_slabs || [])) {
        const slabEnd = slabStart + slab.storeNumber - 1;
        if (additionalStoreNumber >= slabStart && additionalStoreNumber <= slabEnd) {
            const complexityBase = rule.complexity_base === "base" ? "base" : "selling";
            const baseAmount = complexityBase === "base" ? Number(rule.base_price || 0) : Number(rule.selling_price || 0);
            return {
                amount: baseAmount * slab.multiplier,
                label: `additional stores ${slabStart}-${slabEnd}: ${slab.multiplier}x ${complexityBase} price`,
                durationMinutes: slab.durationMinutes
            };
        }
        slabStart = slabEnd + 1;
    }
    return {
        amount: 0,
        label: "",
        durationMinutes: 0,
        error: `No complexity slab found for additional store ${additionalStoreNumber}${rule.categoryName ? ` in ${rule.categoryName}` : ""}.`
    };
}
function roundMoney(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
export async function getOrCreateDeliveryTypeGroup() {
    const result = await pool.query(`
      insert into zigo.lookup_groups (code, name, description, is_system)
      values ('delivery_type', 'Delivery Type', 'Delivery type master', true)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            updated_at = now()
      returning id
    `);
    return result.rows[0].id;
}
export async function listDeliveryTypes() {
    const groupId = await getOrCreateDeliveryTypeGroup();
    const result = await pool.query(`
      select
        id,
        group_id as "groupId",
        code,
        name,
        description,
        sort_order as "sortOrder",
        is_active as "isActive",
        is_system as "isSystem",
        config,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from zigo.lookup_values
      where group_id = $1
      order by sort_order, name
    `, [groupId]);
    return result.rows;
}
export async function createDeliveryType(input) {
    const groupId = await getOrCreateDeliveryTypeGroup();
    const result = await pool.query(`
      insert into zigo.lookup_values
        (group_id, code, name, description, sort_order, is_active)
      values ($1, $2, $3, $4, $5, $6)
      returning id
    `, [groupId, input.code, input.name, input.description ?? null, input.sortOrder ?? 0, input.isActive ?? true]);
    return result.rows[0];
}
export async function updateDeliveryType(id, input) {
    const result = await pool.query(`
      update zigo.lookup_values
      set code = $2,
          name = $3,
          description = $4,
          sort_order = $5,
          is_active = $6,
          updated_at = now()
      where id = $1
      returning id
    `, [id, input.code, input.name, input.description ?? null, input.sortOrder ?? 0, input.isActive ?? true]);
    return result.rows[0] ?? null;
}
async function softDelete(tableName, id, userId) {
    const result = await pool.query(`
      update ${tableName}
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1 and is_deleted = false
      returning id
    `, [id, userId]);
    return result.rows[0] ?? null;
}
async function assertActiveRecord(tableName, id, label) {
    const result = await pool.query(`
      select id
      from ${tableName}
      where id = $1
        and coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
    `, [id]);
    if (!result.rowCount) {
        throw new HttpError(400, `${label} is inactive or deleted. Activate it before using it.`);
    }
}
async function existingAuditUserId(userId) {
    if (!userId)
        return null;
    const result = await pool.query("select id from zigo.users where id = $1 limit 1", [userId]);
    return result.rowCount ? userId : null;
}
async function assertUsableClusterForSettings(id) {
    const result = await pool.query(`
      select
        name,
        coalesce(is_deleted, false) as "isDeleted",
        coalesce(is_booking_enabled, false) as "isBookingEnabled"
      from zigo.clusters
      where id = $1
      limit 1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected Cluster was not found.");
    if (row.isDeleted || !row.isBookingEnabled) {
        throw new HttpError(400, `Selected Cluster "${row.name}" is inactive or deleted. Activate it before using it.`);
    }
}
async function assertUsableCity(id) {
    const result = await pool.query(`
      select
        c.id,
        c.name as "cityName",
        c.is_active as "cityActive",
        coalesce(c.is_deleted, false) as "cityDeleted",
        s.name as "stateName",
        coalesce(s.is_active, true) as "stateActive",
        coalesce(s.is_deleted, false) as "stateDeleted"
      from zigo.cities c
      left join zigo.states s on s.id = c.state_id
      where c.id = $1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected City was not found.");
    if (row.cityDeleted || !row.cityActive)
        throw new HttpError(400, `Selected City "${row.cityName}" is inactive or deleted. Activate the City before using it.`);
    if (row.stateDeleted || !row.stateActive)
        throw new HttpError(400, `Selected City "${row.cityName}" cannot be used because its parent State "${row.stateName || "unknown"}" is inactive or deleted. Activate the State first.`);
}
async function assertUsableZone(id) {
    const result = await pool.query(`
      select
        z.id,
        z.name as "zoneName",
        z.is_active as "zoneActive",
        coalesce(z.is_deleted, false) as "zoneDeleted",
        c.name as "cityName",
        c.is_active as "cityActive",
        coalesce(c.is_deleted, false) as "cityDeleted",
        s.name as "stateName",
        coalesce(s.is_active, true) as "stateActive",
        coalesce(s.is_deleted, false) as "stateDeleted"
      from zigo.zones z
      left join zigo.cities c on c.id = z.city_id
      left join zigo.states s on s.id = c.state_id
      where z.id = $1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected Zone was not found.");
    if (row.zoneDeleted || !row.zoneActive)
        throw new HttpError(400, `Selected Zone "${row.zoneName}" is inactive or deleted. Activate the Zone before using it.`);
    if (row.cityDeleted || !row.cityActive)
        throw new HttpError(400, `Selected Zone "${row.zoneName}" cannot be used because its parent City "${row.cityName || "unknown"}" is inactive or deleted. Activate the City first.`);
    if (row.stateDeleted || !row.stateActive)
        throw new HttpError(400, `Selected Zone "${row.zoneName}" cannot be used because its parent State "${row.stateName || "unknown"}" is inactive or deleted. Activate the State first.`);
}
async function assertUsableCategory(id) {
    const result = await pool.query(`
      select
        c.id,
        c.name as "categoryName",
        c.is_active as "categoryActive",
        coalesce(c.is_deleted, false) as "categoryDeleted",
        s.name as "serviceName",
        coalesce(s.is_active, true) as "serviceActive",
        coalesce(s.is_enabled, true) as "serviceEnabled",
        coalesce(s.is_deleted, false) as "serviceDeleted",
        p.name as "parentCategoryName",
        coalesce(p.is_active, true) as "parentCategoryActive",
        coalesce(p.is_enabled, true) as "parentCategoryEnabled",
        coalesce(p.is_deleted, false) as "parentCategoryDeleted",
        ps.name as "parentServiceName",
        coalesce(ps.is_active, true) as "parentServiceActive",
        coalesce(ps.is_enabled, true) as "parentServiceEnabled",
        coalesce(ps.is_deleted, false) as "parentServiceDeleted"
      from zigo.categories c
      left join zigo.services s on s.id = c.service_id
      left join zigo.categories p on p.id = c.parent_category_id
      left join zigo.services ps on ps.id = p.service_id
      where c.id = $1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected Category was not found.");
    if (row.categoryDeleted || !row.categoryActive)
        throw new HttpError(400, `Selected Category "${row.categoryName}" is inactive or deleted. Activate the Category before using it.`);
    if (row.serviceDeleted || !row.serviceActive)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its Service "${row.serviceName || "unknown"}" is inactive or deleted. Activate the Service first.`);
    if (!row.serviceEnabled)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its Service "${row.serviceName || "unknown"}" is disabled. Enable the Service first.`);
    if (row.parentCategoryDeleted || !row.parentCategoryActive)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its parent Category "${row.parentCategoryName || "unknown"}" is inactive or deleted. Activate the parent Category first.`);
    if (!row.parentCategoryEnabled)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its parent Category "${row.parentCategoryName || "unknown"}" is disabled. Enable the parent Category first.`);
    if (row.parentServiceDeleted || !row.parentServiceActive)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its parent Category belongs to inactive/deleted Service "${row.parentServiceName || "unknown"}". Activate that Service first.`);
    if (!row.parentServiceEnabled)
        throw new HttpError(400, `Selected Category "${row.categoryName}" cannot be used because its parent Category belongs to disabled Service "${row.parentServiceName || "unknown"}". Enable that Service first.`);
}
async function assertUsableCategoryServiceMaster(id) {
    await ensureCategoryServiceMasterSchema();
    const result = await pool.query(`
      select
        service_title as "serviceTitle",
        coalesce(is_active, true) as "isActive",
        coalesce(is_enabled, true) as "isEnabled",
        coalesce(is_deleted, false) as "isDeleted"
      from zigo.category_service_masters
      where id = $1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected Service Master was not found.");
    if (row.isDeleted)
        throw new HttpError(400, `Selected Service Master "${row.serviceTitle}" is deleted. Restore it before using it.`);
    if (!row.isActive)
        throw new HttpError(400, `Selected Service Master "${row.serviceTitle}" is deactive. Activate it before using it.`);
    if (!row.isEnabled)
        throw new HttpError(400, `Selected Service Master "${row.serviceTitle}" is disabled. Enable it before using it.`);
}
async function assertUsableCategoryForService(categoryId, serviceId) {
    await assertUsableCategory(categoryId);
    const result = await pool.query(`
      select
        c.name as "categoryName",
        c.service_id as "serviceId",
        s.name as "serviceName"
      from zigo.categories c
      left join zigo.services s on s.id = $2
      where c.id = $1
      limit 1
    `, [categoryId, serviceId]);
    const row = result.rows[0];
    if (row?.serviceId && row.serviceId !== serviceId) {
        throw new HttpError(400, `Selected Category "${row.categoryName}" does not belong to Service "${row.serviceName || serviceId}".`);
    }
}
async function assertUsableService(id) {
    const result = await pool.query(`
      select
        name,
        coalesce(is_active, true) as "isActive",
        coalesce(is_enabled, true) as "isEnabled",
        coalesce(is_deleted, false) as "isDeleted"
      from zigo.services
      where id = $1
    `, [id]);
    const row = result.rows[0];
    if (!row)
        throw new HttpError(400, "Selected Service was not found.");
    if (row.isDeleted)
        throw new HttpError(400, `Selected Service "${row.name}" is deleted. Restore it before using it.`);
    if (!row.isActive)
        throw new HttpError(400, `Selected Service "${row.name}" is deactive. Activate it before using it.`);
    if (!row.isEnabled)
        throw new HttpError(400, `Selected Service "${row.name}" is disabled. Enable it before using it.`);
}
