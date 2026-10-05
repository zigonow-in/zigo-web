--
-- PostgreSQL database dump
--

\restrict J76FPCKJ9Inq3WuWjudYDkXozQF9ZLRtwAGevug397DJgqrVPXGDhqZDxLMUW3x

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_workflow_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_to_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_from_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_actor_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_states DROP CONSTRAINT IF EXISTS workflow_states_workflow_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_endpoints DROP CONSTRAINT IF EXISTS webhook_endpoints_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_endpoints DROP CONSTRAINT IF EXISTS webhook_endpoints_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_endpoints DROP CONSTRAINT IF EXISTS webhook_endpoints_api_client_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_webhook_endpoint_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_outbox_event_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.wallets DROP CONSTRAINT IF EXISTS wallets_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_wallet_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_entry_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_direction_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_avatar_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_granted_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_modules DROP CONSTRAINT IF EXISTS user_modules_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.user_modules DROP CONSTRAINT IF EXISTS user_modules_module_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.time_slot_masters DROP CONSTRAINT IF EXISTS time_slot_masters_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.time_slot_masters DROP CONSTRAINT IF EXISTS time_slot_masters_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.time_slot_masters DROP CONSTRAINT IF EXISTS time_slot_masters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.tax_master_rules DROP CONSTRAINT IF EXISTS tax_master_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.tax_master_rules DROP CONSTRAINT IF EXISTS tax_master_rules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.tax_master_rules DROP CONSTRAINT IF EXISTS tax_master_rules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_updates DROP CONSTRAINT IF EXISTS task_updates_update_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_updates DROP CONSTRAINT IF EXISTS task_updates_stop_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_updates DROP CONSTRAINT IF EXISTS task_updates_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_updates DROP CONSTRAINT IF EXISTS task_updates_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_types DROP CONSTRAINT IF EXISTS task_types_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_stop_visits DROP CONSTRAINT IF EXISTS task_stop_visits_stop_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_stop_visits DROP CONSTRAINT IF EXISTS task_stop_visits_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_stop_visits DROP CONSTRAINT IF EXISTS task_stop_visits_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_stop_visits DROP CONSTRAINT IF EXISTS task_stop_visits_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_verified_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_stop_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_proof_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_execution_sessions DROP CONSTRAINT IF EXISTS task_execution_sessions_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_execution_sessions DROP CONSTRAINT IF EXISTS task_execution_sessions_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_execution_sessions DROP CONSTRAINT IF EXISTS task_execution_sessions_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_events DROP CONSTRAINT IF EXISTS task_events_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_events DROP CONSTRAINT IF EXISTS task_events_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_assignment_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_assignment_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_assigned_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_priority_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.support_issues DROP CONSTRAINT IF EXISTS support_issues_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_place_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_service_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_store_keyword_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_cluster_map DROP CONSTRAINT IF EXISTS store_cluster_map_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_cluster_map DROP CONSTRAINT IF EXISTS store_cluster_map_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_store_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_service_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.states DROP CONSTRAINT IF EXISTS states_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.states DROP CONSTRAINT IF EXISTS states_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.states DROP CONSTRAINT IF EXISTS states_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.sla_breach_events DROP CONSTRAINT IF EXISTS sla_breach_events_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.sla_breach_events DROP CONSTRAINT IF EXISTS sla_breach_events_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.sla_breach_events DROP CONSTRAINT IF EXISTS sla_breach_events_breach_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.settlements DROP CONSTRAINT IF EXISTS settlements_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.settlements DROP CONSTRAINT IF EXISTS settlements_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_task_rules DROP CONSTRAINT IF EXISTS service_task_rules_task_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_task_rules DROP CONSTRAINT IF EXISTS service_task_rules_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_workflow_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_task_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_source_app_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_current_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_booking_mode_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_categories DROP CONSTRAINT IF EXISTS service_categories_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_categories DROP CONSTRAINT IF EXISTS service_categories_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.roles DROP CONSTRAINT IF EXISTS roles_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.roles DROP CONSTRAINT IF EXISTS roles_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.roles DROP CONSTRAINT IF EXISTS roles_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_verification_requirements DROP CONSTRAINT IF EXISTS role_verification_requirements_role_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_verification_requirements DROP CONSTRAINT IF EXISTS role_verification_requirements_document_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_modules DROP CONSTRAINT IF EXISTS role_modules_role_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.role_modules DROP CONSTRAINT IF EXISTS role_modules_module_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_timeline_events DROP CONSTRAINT IF EXISTS request_timeline_events_visibility_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_timeline_events DROP CONSTRAINT IF EXISTS request_timeline_events_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_timeline_events DROP CONSTRAINT IF EXISTS request_timeline_events_event_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_timeline_events DROP CONSTRAINT IF EXISTS request_timeline_events_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_stop_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_place_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_transition_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_to_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_from_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_locations DROP CONSTRAINT IF EXISTS request_locations_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_locations DROP CONSTRAINT IF EXISTS request_locations_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_items DROP CONSTRAINT IF EXISTS request_items_stop_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_items DROP CONSTRAINT IF EXISTS request_items_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_items DROP CONSTRAINT IF EXISTS request_items_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_stop_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_attachment_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.refunds DROP CONSTRAINT IF EXISTS refunds_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.refunds DROP CONSTRAINT IF EXISTS refunds_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.refunds DROP CONSTRAINT IF EXISTS refunds_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.refunds DROP CONSTRAINT IF EXISTS refunds_payment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_group_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_payments DROP CONSTRAINT IF EXISTS razorpay_payments_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_payments DROP CONSTRAINT IF EXISTS razorpay_payments_customer_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.ratings DROP CONSTRAINT IF EXISTS ratings_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.ratings DROP CONSTRAINT IF EXISTS ratings_rated_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_rule_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_pricing_policy_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_membership_plan_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.portal_favorites DROP CONSTRAINT IF EXISTS portal_favorites_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.policy_configs DROP CONSTRAINT IF EXISTS policy_configs_policy_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.places DROP CONSTRAINT IF EXISTS places_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.places DROP CONSTRAINT IF EXISTS places_place_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.places DROP CONSTRAINT IF EXISTS places_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.places DROP CONSTRAINT IF EXISTS places_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.permissions DROP CONSTRAINT IF EXISTS permissions_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.permissions DROP CONSTRAINT IF EXISTS permissions_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.permissions DROP CONSTRAINT IF EXISTS permissions_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_payment_intent_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_gateway_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_intent_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_gateway_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.organizations DROP CONSTRAINT IF EXISTS organizations_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.organizations DROP CONSTRAINT IF EXISTS organizations_organization_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_templates DROP CONSTRAINT IF EXISTS notification_templates_channel_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_templates DROP CONSTRAINT IF EXISTS notification_templates_audience_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_template_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_notification_event_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_channel_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.modules DROP CONSTRAINT IF EXISTS modules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.modules DROP CONSTRAINT IF EXISTS modules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.modules DROP CONSTRAINT IF EXISTS modules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_permission_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_module_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.lookup_values DROP CONSTRAINT IF EXISTS lookup_values_group_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.invoices DROP CONSTRAINT IF EXISTS invoices_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.invoices DROP CONSTRAINT IF EXISTS invoices_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_line_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_invoice_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.service_task_rules DROP CONSTRAINT IF EXISTS fk_service_task_proof_policy;
ALTER TABLE IF EXISTS ONLY zigo.membership_plans DROP CONSTRAINT IF EXISTS fk_membership_pricing_policy;
ALTER TABLE IF EXISTS ONLY zigo.membership_plans DROP CONSTRAINT IF EXISTS fk_membership_cancellation_policy;
ALTER TABLE IF EXISTS ONLY zigo.idempotency_keys DROP CONSTRAINT IF EXISTS fk_idempotency_actor_user;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS fk_customer_addresses_cluster;
ALTER TABLE IF EXISTS ONLY zigo.assistant_location_pings DROP CONSTRAINT IF EXISTS fk_assistant_location_request;
ALTER TABLE IF EXISTS ONLY zigo.file_links DROP CONSTRAINT IF EXISTS file_links_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_severity_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_exception_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_detected_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.event_log DROP CONSTRAINT IF EXISTS event_log_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.event_log DROP CONSTRAINT IF EXISTS event_log_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.event_log DROP CONSTRAINT IF EXISTS event_log_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.devices DROP CONSTRAINT IF EXISTS devices_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.devices DROP CONSTRAINT IF EXISTS devices_platform_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.devices DROP CONSTRAINT IF EXISTS devices_app_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.daily_cluster_metrics DROP CONSTRAINT IF EXISTS daily_cluster_metrics_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.daily_assistant_metrics DROP CONSTRAINT IF EXISTS daily_assistant_metrics_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_default_membership_plan_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_unserviceable_locations DROP CONSTRAINT IF EXISTS customer_unserviceable_locations_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_unserviceable_locations DROP CONSTRAINT IF EXISTS customer_unserviceable_locations_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_tickets DROP CONSTRAINT IF EXISTS customer_support_tickets_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_tickets DROP CONSTRAINT IF EXISTS customer_support_tickets_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_tickets DROP CONSTRAINT IF EXISTS customer_support_tickets_assigned_admin_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_messages DROP CONSTRAINT IF EXISTS customer_support_messages_ticket_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_messages DROP CONSTRAINT IF EXISTS customer_support_messages_sender_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_notes DROP CONSTRAINT IF EXISTS customer_notes_note_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_notes DROP CONSTRAINT IF EXISTS customer_notes_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_notes DROP CONSTRAINT IF EXISTS customer_notes_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_memberships DROP CONSTRAINT IF EXISTS customer_memberships_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_memberships DROP CONSTRAINT IF EXISTS customer_memberships_membership_plan_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_memberships DROP CONSTRAINT IF EXISTS customer_memberships_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_favorite_places DROP CONSTRAINT IF EXISTS customer_favorite_places_place_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_favorite_places DROP CONSTRAINT IF EXISTS customer_favorite_places_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_disputes DROP CONSTRAINT IF EXISTS customer_disputes_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_disputes DROP CONSTRAINT IF EXISTS customer_disputes_resolved_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_disputes DROP CONSTRAINT IF EXISTS customer_disputes_customer_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_disputes DROP CONSTRAINT IF EXISTS customer_disputes_assigned_admin_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_cart DROP CONSTRAINT IF EXISTS customer_cart_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_cart DROP CONSTRAINT IF EXISTS customer_cart_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_auth_sessions DROP CONSTRAINT IF EXISTS customer_auth_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_auth_sessions DROP CONSTRAINT IF EXISTS customer_auth_sessions_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_approvals DROP CONSTRAINT IF EXISTS customer_approvals_task_update_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_approvals DROP CONSTRAINT IF EXISTS customer_approvals_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_launch_stage_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_visibility DROP CONSTRAINT IF EXISTS cluster_service_visibility_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_visibility DROP CONSTRAINT IF EXISTS cluster_service_visibility_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_visibility DROP CONSTRAINT IF EXISTS cluster_service_visibility_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_launch_configs DROP CONSTRAINT IF EXISTS cluster_launch_configs_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_launch_configs DROP CONSTRAINT IF EXISTS cluster_launch_configs_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_boundaries DROP CONSTRAINT IF EXISTS cluster_boundaries_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_boundaries DROP CONSTRAINT IF EXISTS cluster_boundaries_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_access_rules DROP CONSTRAINT IF EXISTS cluster_access_rules_source_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_access_rules DROP CONSTRAINT IF EXISTS cluster_access_rules_rule_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_access_rules DROP CONSTRAINT IF EXISTS cluster_access_rules_allowed_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_thread_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_thread_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_store_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_service_masters DROP CONSTRAINT IF EXISTS category_service_masters_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_service_masters DROP CONSTRAINT IF EXISTS category_service_masters_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_service_masters DROP CONSTRAINT IF EXISTS category_service_masters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_parent_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_type_masters DROP CONSTRAINT IF EXISTS booking_type_masters_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_type_masters DROP CONSTRAINT IF EXISTS booking_type_masters_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_type_masters DROP CONSTRAINT IF EXISTS booking_type_masters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_updates DROP CONSTRAINT IF EXISTS booking_task_updates_task_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_updates DROP CONSTRAINT IF EXISTS booking_task_updates_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_updates DROP CONSTRAINT IF EXISTS booking_task_updates_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_update_reads DROP CONSTRAINT IF EXISTS booking_task_update_reads_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_update_reads DROP CONSTRAINT IF EXISTS booking_task_update_reads_update_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_task_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_last_ping_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_reviews DROP CONSTRAINT IF EXISTS booking_reviews_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_reviews DROP CONSTRAINT IF EXISTS booking_reviews_customer_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_reviews DROP CONSTRAINT IF EXISTS booking_reviews_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_orchestration_state DROP CONSTRAINT IF EXISTS booking_orchestration_state_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_orchestration_state DROP CONSTRAINT IF EXISTS booking_orchestration_state_reservation_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_orchestration_state DROP CONSTRAINT IF EXISTS booking_orchestration_state_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_orchestration_state DROP CONSTRAINT IF EXISTS booking_orchestration_state_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_invoice_email_jobs DROP CONSTRAINT IF EXISTS booking_invoice_email_jobs_customer_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_invoice_email_jobs DROP CONSTRAINT IF EXISTS booking_invoice_email_jobs_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_zone_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_state_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_city_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_category_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_billing_snapshots DROP CONSTRAINT IF EXISTS booking_billing_snapshots_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_verification_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_current_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicles DROP CONSTRAINT IF EXISTS assistant_vehicles_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicles DROP CONSTRAINT IF EXISTS assistant_vehicles_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_verified_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_document_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_damage_reports DROP CONSTRAINT IF EXISTS assistant_vehicle_damage_reports_vehicle_master_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_damage_reports DROP CONSTRAINT IF EXISTS assistant_vehicle_damage_reports_vehicle_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_damage_reports DROP CONSTRAINT IF EXISTS assistant_vehicle_damage_reports_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_damage_reports DROP CONSTRAINT IF EXISTS assistant_vehicle_damage_reports_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_assignments DROP CONSTRAINT IF EXISTS assistant_vehicle_assignments_vehicle_master_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_assignments DROP CONSTRAINT IF EXISTS assistant_vehicle_assignments_removed_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_assignments DROP CONSTRAINT IF EXISTS assistant_vehicle_assignments_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_assignments DROP CONSTRAINT IF EXISTS assistant_vehicle_assignments_assigned_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_training_records DROP CONSTRAINT IF EXISTS assistant_training_records_training_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_training_records DROP CONSTRAINT IF EXISTS assistant_training_records_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_training_records DROP CONSTRAINT IF EXISTS assistant_training_records_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_rejection_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_offer_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_assignment_run_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_skill_map DROP CONSTRAINT IF EXISTS assistant_skill_map_skill_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_skill_map DROP CONSTRAINT IF EXISTS assistant_skill_map_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_shift_plans DROP CONSTRAINT IF EXISTS assistant_shift_plans_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_shift_plans DROP CONSTRAINT IF EXISTS assistant_shift_plans_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_shift_plans DROP CONSTRAINT IF EXISTS assistant_shift_plans_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_master_logs DROP CONSTRAINT IF EXISTS assistant_master_logs_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_master_logs DROP CONSTRAINT IF EXISTS assistant_master_logs_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_location_pings DROP CONSTRAINT IF EXISTS assistant_location_pings_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_earnings DROP CONSTRAINT IF EXISTS assistant_earnings_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_earnings DROP CONSTRAINT IF EXISTS assistant_earnings_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_earnings DROP CONSTRAINT IF EXISTS assistant_earnings_earning_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_earnings DROP CONSTRAINT IF EXISTS assistant_earnings_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_verified_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_verification_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_file_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_document_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_document_verification_events DROP CONSTRAINT IF EXISTS assistant_document_verification_events_document_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_document_verification_events DROP CONSTRAINT IF EXISTS assistant_document_verification_events_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_document_verification_events DROP CONSTRAINT IF EXISTS assistant_document_verification_events_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_document_verification_events DROP CONSTRAINT IF EXISTS assistant_document_verification_even_assistant_document_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_task_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_cluster_map DROP CONSTRAINT IF EXISTS assistant_cluster_map_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_cluster_map DROP CONSTRAINT IF EXISTS assistant_cluster_map_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_service_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_calendar_blocks DROP CONSTRAINT IF EXISTS assistant_calendar_blocks_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_calendar_blocks DROP CONSTRAINT IF EXISTS assistant_calendar_blocks_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_availability DROP CONSTRAINT IF EXISTS assistant_availability_next_available_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_availability DROP CONSTRAINT IF EXISTS assistant_availability_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_availability DROP CONSTRAINT IF EXISTS assistant_availability_availability_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_availability DROP CONSTRAINT IF EXISTS assistant_availability_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_runs DROP CONSTRAINT IF EXISTS assignment_runs_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_runs DROP CONSTRAINT IF EXISTS assignment_runs_run_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_runs DROP CONSTRAINT IF EXISTS assignment_runs_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_runs DROP CONSTRAINT IF EXISTS assignment_runs_assignment_policy_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policy_rules DROP CONSTRAINT IF EXISTS assignment_policy_rules_rule_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policy_rules DROP CONSTRAINT IF EXISTS assignment_policy_rules_assignment_policy_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policies DROP CONSTRAINT IF EXISTS assignment_policies_service_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policies DROP CONSTRAINT IF EXISTS assignment_policies_cluster_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_responses DROP CONSTRAINT IF EXISTS approval_responses_response_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_responses DROP CONSTRAINT IF EXISTS approval_responses_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_responses DROP CONSTRAINT IF EXISTS approval_responses_approval_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_task_update_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_requested_by_assistant_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_request_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_approval_type_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.app_settings DROP CONSTRAINT IF EXISTS app_settings_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.app_settings DROP CONSTRAINT IF EXISTS app_settings_deleted_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.app_settings DROP CONSTRAINT IF EXISTS app_settings_created_by_fkey;
ALTER TABLE IF EXISTS ONLY zigo.api_clients DROP CONSTRAINT IF EXISTS api_clients_status_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.api_clients DROP CONSTRAINT IF EXISTS api_clients_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_reason_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY zigo.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_type_id_fkey;
DROP INDEX IF EXISTS zigo.ux_payment_mode_masters_scope_code;
DROP INDEX IF EXISTS zigo.uq_vehicle_master_number_active;
DROP INDEX IF EXISTS zigo.uq_user_roles_scoped;
DROP INDEX IF EXISTS zigo.uq_assistant_vehicle_assignment_active_vehicle;
DROP INDEX IF EXISTS zigo.uq_assistant_vehicle_assignment_active_assistant;
DROP INDEX IF EXISTS zigo.uq_assistant_availability_assistant;
DROP INDEX IF EXISTS zigo.uq_app_config_values_scope;
DROP INDEX IF EXISTS zigo.idx_zones_active;
DROP INDEX IF EXISTS zigo.idx_vehicle_master_cluster_active;
DROP INDEX IF EXISTS zigo.idx_vehicle_master_active;
DROP INDEX IF EXISTS zigo.idx_users_phone_lookup;
DROP INDEX IF EXISTS zigo.idx_users_email_lookup;
DROP INDEX IF EXISTS zigo.idx_users_created_at;
DROP INDEX IF EXISTS zigo.idx_users_account_status;
DROP INDEX IF EXISTS zigo.idx_user_roles_user_active;
DROP INDEX IF EXISTS zigo.idx_user_roles_role_active;
DROP INDEX IF EXISTS zigo.idx_time_slot_masters_active;
DROP INDEX IF EXISTS zigo.idx_tax_master_rules_active;
DROP INDEX IF EXISTS zigo.idx_task_proofs_gps_location;
DROP INDEX IF EXISTS zigo.idx_task_offers_assistant;
DROP INDEX IF EXISTS zigo.idx_task_events_request;
DROP INDEX IF EXISTS zigo.idx_task_assignments_assistant_live;
DROP INDEX IF EXISTS zigo.idx_task_assignments_active;
DROP INDEX IF EXISTS zigo.idx_surge_rules_active;
DROP INDEX IF EXISTS zigo.idx_stores_active;
DROP INDEX IF EXISTS zigo.idx_store_keywords_parent_active;
DROP INDEX IF EXISTS zigo.idx_store_keyword_map_store;
DROP INDEX IF EXISTS zigo.idx_store_images_store;
DROP INDEX IF EXISTS zigo.idx_store_categories_parent_active;
DROP INDEX IF EXISTS zigo.idx_store_categories_active;
DROP INDEX IF EXISTS zigo.idx_states_active;
DROP INDEX IF EXISTS zigo.idx_settlements_request_unique;
DROP INDEX IF EXISTS zigo.idx_services_active;
DROP INDEX IF EXISTS zigo.idx_service_requests_live;
DROP INDEX IF EXISTS zigo.idx_service_requests_customer;
DROP INDEX IF EXISTS zigo.idx_service_requests_cluster_state;
DROP INDEX IF EXISTS zigo.idx_roles_code_active_unique;
DROP INDEX IF EXISTS zigo.idx_request_stops_location;
DROP INDEX IF EXISTS zigo.idx_request_stops_cluster;
DROP INDEX IF EXISTS zigo.idx_request_locations_cluster;
DROP INDEX IF EXISTS zigo.idx_razorpay_webhook_order;
DROP INDEX IF EXISTS zigo.idx_razorpay_payments_status;
DROP INDEX IF EXISTS zigo.idx_razorpay_payments_payment;
DROP INDEX IF EXISTS zigo.idx_razorpay_payments_booking;
DROP INDEX IF EXISTS zigo.idx_price_master_rules_scope;
DROP INDEX IF EXISTS zigo.idx_price_master_rules_location_scope;
DROP INDEX IF EXISTS zigo.idx_price_master_rules_active;
DROP INDEX IF EXISTS zigo.idx_portal_favorites_user;
DROP INDEX IF EXISTS zigo.idx_places_location;
DROP INDEX IF EXISTS zigo.idx_places_cluster_status;
DROP INDEX IF EXISTS zigo.idx_permissions_code_active_unique;
DROP INDEX IF EXISTS zigo.idx_payment_transactions_request;
DROP INDEX IF EXISTS zigo.idx_payment_mode_masters_active;
DROP INDEX IF EXISTS zigo.idx_outbox_events_available;
DROP INDEX IF EXISTS zigo.idx_modules_code_active_unique;
DROP INDEX IF EXISTS zigo.idx_location_pings_request;
DROP INDEX IF EXISTS zigo.idx_file_links_entity;
DROP INDEX IF EXISTS zigo.idx_event_log_request;
DROP INDEX IF EXISTS zigo.idx_event_log_name_time;
DROP INDEX IF EXISTS zigo.idx_customer_unserviceable_locations_seen;
DROP INDEX IF EXISTS zigo.idx_customer_unserviceable_locations_customer;
DROP INDEX IF EXISTS zigo.idx_customer_unserviceable_locations_coords;
DROP INDEX IF EXISTS zigo.idx_customer_unserviceable_locations_area;
DROP INDEX IF EXISTS zigo.idx_customer_support_tickets_status;
DROP INDEX IF EXISTS zigo.idx_customer_support_tickets_customer;
DROP INDEX IF EXISTS zigo.idx_customer_support_messages_ticket;
DROP INDEX IF EXISTS zigo.idx_customer_disputes_status;
DROP INDEX IF EXISTS zigo.idx_customer_disputes_customer;
DROP INDEX IF EXISTS zigo.idx_customer_disputes_booking;
DROP INDEX IF EXISTS zigo.idx_customer_cart_user;
DROP INDEX IF EXISTS zigo.idx_customer_addresses_location;
DROP INDEX IF EXISTS zigo.idx_customer_addresses_customer_active;
DROP INDEX IF EXISTS zigo.idx_cluster_service_settings_cluster;
DROP INDEX IF EXISTS zigo.idx_cluster_category_settings_cluster;
DROP INDEX IF EXISTS zigo.idx_cluster_boundaries_geometry;
DROP INDEX IF EXISTS zigo.idx_cities_active;
DROP INDEX IF EXISTS zigo.idx_category_service_masters_active;
DROP INDEX IF EXISTS zigo.idx_category_price_rules_location_scope;
DROP INDEX IF EXISTS zigo.idx_category_price_rules_active;
DROP INDEX IF EXISTS zigo.idx_categories_active;
DROP INDEX IF EXISTS zigo.idx_capacity_reservations_status;
DROP INDEX IF EXISTS zigo.idx_capacity_reservations_cluster_window;
DROP INDEX IF EXISTS zigo.idx_capacity_reservations_booking;
DROP INDEX IF EXISTS zigo.idx_capacity_reservations_assistant_window;
DROP INDEX IF EXISTS zigo.idx_booking_type_masters_active;
DROP INDEX IF EXISTS zigo.idx_booking_task_updates_request;
DROP INDEX IF EXISTS zigo.idx_booking_task_updates_actor;
DROP INDEX IF EXISTS zigo.idx_booking_task_update_reads_user;
DROP INDEX IF EXISTS zigo.idx_booking_route_sessions_booking_status;
DROP INDEX IF EXISTS zigo.idx_booking_route_sessions_assistant_status;
DROP INDEX IF EXISTS zigo.idx_booking_reviews_customer;
DROP INDEX IF EXISTS zigo.idx_booking_reviews_assistant;
DROP INDEX IF EXISTS zigo.idx_booking_realtime_events_created;
DROP INDEX IF EXISTS zigo.idx_booking_realtime_events_cluster;
DROP INDEX IF EXISTS zigo.idx_booking_realtime_events_booking;
DROP INDEX IF EXISTS zigo.idx_booking_realtime_events_assistant;
DROP INDEX IF EXISTS zigo.idx_booking_orchestration_state_cluster_risk;
DROP INDEX IF EXISTS zigo.idx_booking_orchestration_state_assistant;
DROP INDEX IF EXISTS zigo.idx_booking_invoice_email_jobs_due;
DROP INDEX IF EXISTS zigo.idx_booking_engine_rules_scope;
DROP INDEX IF EXISTS zigo.idx_booking_engine_rules_active;
DROP INDEX IF EXISTS zigo.idx_booking_engine_quick_replies_sort;
DROP INDEX IF EXISTS zigo.idx_booking_engine_quick_replies_scope;
DROP INDEX IF EXISTS zigo.idx_booking_engine_quick_replies_active;
DROP INDEX IF EXISTS zigo.idx_booking_billing_snapshots_request;
DROP INDEX IF EXISTS zigo.idx_assistant_master_logs_assistant;
DROP INDEX IF EXISTS zigo.idx_assistant_location_pings_request;
DROP INDEX IF EXISTS zigo.idx_assistant_location_pings_location;
DROP INDEX IF EXISTS zigo.idx_assistant_location_pings_assistant_created;
DROP INDEX IF EXISTS zigo.idx_assistant_document_verification_events_document;
DROP INDEX IF EXISTS zigo.idx_assistant_document_verification_events_assistant;
DROP INDEX IF EXISTS zigo.idx_assistant_doc_events_assistant;
DROP INDEX IF EXISTS zigo.idx_assistant_delay_credits_booking;
DROP INDEX IF EXISTS zigo.idx_assistant_delay_credits_assistant;
DROP INDEX IF EXISTS zigo.idx_assistant_damage_reports_assistant;
DROP INDEX IF EXISTS zigo.idx_assistant_calendar_blocks_source;
DROP INDEX IF EXISTS zigo.idx_assistant_calendar_blocks_cluster_window;
DROP INDEX IF EXISTS zigo.idx_assistant_calendar_blocks_assistant_window;
DROP INDEX IF EXISTS zigo.idx_assistant_availability_location;
DROP INDEX IF EXISTS zigo.idx_assistant_availability_latest;
DROP INDEX IF EXISTS zigo.idx_app_settings_active_key;
DROP INDEX IF EXISTS zigo.idx_admin_actions_entity;
DROP INDEX IF EXISTS zigo.customer_auth_sessions_user_active_idx;
DROP INDEX IF EXISTS zigo.customer_auth_sessions_customer_active_idx;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_pkey;
ALTER TABLE IF EXISTS ONLY zigo.zones DROP CONSTRAINT IF EXISTS zones_city_id_code_key;
ALTER TABLE IF EXISTS ONLY zigo.workflows DROP CONSTRAINT IF EXISTS workflows_pkey;
ALTER TABLE IF EXISTS ONLY zigo.workflows DROP CONSTRAINT IF EXISTS workflows_code_key;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_workflow_id_from_state_id_to_state_id__key;
ALTER TABLE IF EXISTS ONLY zigo.workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.workflow_states DROP CONSTRAINT IF EXISTS workflow_states_workflow_id_code_key;
ALTER TABLE IF EXISTS ONLY zigo.workflow_states DROP CONSTRAINT IF EXISTS workflow_states_pkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_endpoints DROP CONSTRAINT IF EXISTS webhook_endpoints_pkey;
ALTER TABLE IF EXISTS ONLY zigo.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_pkey;
ALTER TABLE IF EXISTS ONLY zigo.wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
ALTER TABLE IF EXISTS ONLY zigo.wallets DROP CONSTRAINT IF EXISTS wallets_owner_type_owner_id_currency_key;
ALTER TABLE IF EXISTS ONLY zigo.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_pkey;
ALTER TABLE IF EXISTS ONLY zigo.vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_pkey;
ALTER TABLE IF EXISTS ONLY zigo.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY zigo.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE IF EXISTS ONLY zigo.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.user_modules DROP CONSTRAINT IF EXISTS user_modules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.time_slot_masters DROP CONSTRAINT IF EXISTS time_slot_masters_pkey;
ALTER TABLE IF EXISTS ONLY zigo.time_slot_masters DROP CONSTRAINT IF EXISTS time_slot_masters_code_key;
ALTER TABLE IF EXISTS ONLY zigo.tax_master_rules DROP CONSTRAINT IF EXISTS tax_master_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_updates DROP CONSTRAINT IF EXISTS task_updates_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_types DROP CONSTRAINT IF EXISTS task_types_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_types DROP CONSTRAINT IF EXISTS task_types_code_key;
ALTER TABLE IF EXISTS ONLY zigo.task_stop_visits DROP CONSTRAINT IF EXISTS task_stop_visits_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_proofs DROP CONSTRAINT IF EXISTS task_proofs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_execution_sessions DROP CONSTRAINT IF EXISTS task_execution_sessions_request_id_key;
ALTER TABLE IF EXISTS ONLY zigo.task_execution_sessions DROP CONSTRAINT IF EXISTS task_execution_sessions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_events DROP CONSTRAINT IF EXISTS task_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_pkey;
ALTER TABLE IF EXISTS ONLY zigo.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_code_key;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_ticket_number_key;
ALTER TABLE IF EXISTS ONLY zigo.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_pkey;
ALTER TABLE IF EXISTS ONLY zigo.support_issues DROP CONSTRAINT IF EXISTS support_issues_pkey;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_store_code_key;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_place_id_key;
ALTER TABLE IF EXISTS ONLY zigo.stores DROP CONSTRAINT IF EXISTS stores_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_keywords DROP CONSTRAINT IF EXISTS store_keywords_code_key;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_store_keyword_id_store_id_key;
ALTER TABLE IF EXISTS ONLY zigo.store_keyword_map DROP CONSTRAINT IF EXISTS store_keyword_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_images DROP CONSTRAINT IF EXISTS store_images_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_cluster_map DROP CONSTRAINT IF EXISTS store_cluster_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_store_category_id_store_id_key;
ALTER TABLE IF EXISTS ONLY zigo.store_category_map DROP CONSTRAINT IF EXISTS store_category_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_pkey;
ALTER TABLE IF EXISTS ONLY zigo.store_categories DROP CONSTRAINT IF EXISTS store_categories_code_key;
ALTER TABLE IF EXISTS ONLY zigo.states DROP CONSTRAINT IF EXISTS states_pkey;
ALTER TABLE IF EXISTS ONLY zigo.states DROP CONSTRAINT IF EXISTS states_code_key;
ALTER TABLE IF EXISTS ONLY zigo.sla_breach_events DROP CONSTRAINT IF EXISTS sla_breach_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.settlements DROP CONSTRAINT IF EXISTS settlements_request_id_key;
ALTER TABLE IF EXISTS ONLY zigo.settlements DROP CONSTRAINT IF EXISTS settlements_pkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_pkey;
ALTER TABLE IF EXISTS ONLY zigo.services DROP CONSTRAINT IF EXISTS services_code_key;
ALTER TABLE IF EXISTS ONLY zigo.service_task_rules DROP CONSTRAINT IF EXISTS service_task_rules_service_id_task_type_id_key;
ALTER TABLE IF EXISTS ONLY zigo.service_task_rules DROP CONSTRAINT IF EXISTS service_task_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_request_number_key;
ALTER TABLE IF EXISTS ONLY zigo.service_requests DROP CONSTRAINT IF EXISTS service_requests_pkey;
ALTER TABLE IF EXISTS ONLY zigo.service_categories DROP CONSTRAINT IF EXISTS service_categories_pkey;
ALTER TABLE IF EXISTS ONLY zigo.roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE IF EXISTS ONLY zigo.roles DROP CONSTRAINT IF EXISTS roles_code_key;
ALTER TABLE IF EXISTS ONLY zigo.role_verification_requirements DROP CONSTRAINT IF EXISTS role_verification_requirements_pkey;
ALTER TABLE IF EXISTS ONLY zigo.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.role_modules DROP CONSTRAINT IF EXISTS role_modules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_timeline_events DROP CONSTRAINT IF EXISTS request_timeline_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_request_id_sequence_no_key;
ALTER TABLE IF EXISTS ONLY zigo.request_stops DROP CONSTRAINT IF EXISTS request_stops_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_status_history DROP CONSTRAINT IF EXISTS request_status_history_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_locations DROP CONSTRAINT IF EXISTS request_locations_service_request_id_sequence_key;
ALTER TABLE IF EXISTS ONLY zigo.request_locations DROP CONSTRAINT IF EXISTS request_locations_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_items DROP CONSTRAINT IF EXISTS request_items_pkey;
ALTER TABLE IF EXISTS ONLY zigo.request_attachments DROP CONSTRAINT IF EXISTS request_attachments_pkey;
ALTER TABLE IF EXISTS ONLY zigo.refunds DROP CONSTRAINT IF EXISTS refunds_pkey;
ALTER TABLE IF EXISTS ONLY zigo.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_pkey;
ALTER TABLE IF EXISTS ONLY zigo.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_code_key;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_webhook_events DROP CONSTRAINT IF EXISTS razorpay_webhook_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_webhook_events DROP CONSTRAINT IF EXISTS razorpay_webhook_events_event_id_key;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_payments DROP CONSTRAINT IF EXISTS razorpay_payments_provider_order_id_key;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_payments DROP CONSTRAINT IF EXISTS razorpay_payments_pkey;
ALTER TABLE IF EXISTS ONLY zigo.razorpay_downtimes DROP CONSTRAINT IF EXISTS razorpay_downtimes_pkey;
ALTER TABLE IF EXISTS ONLY zigo.ratings DROP CONSTRAINT IF EXISTS ratings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_policies DROP CONSTRAINT IF EXISTS pricing_policies_pkey;
ALTER TABLE IF EXISTS ONLY zigo.pricing_policies DROP CONSTRAINT IF EXISTS pricing_policies_code_key;
ALTER TABLE IF EXISTS ONLY zigo.price_master_rules DROP CONSTRAINT IF EXISTS price_master_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.portal_favorites DROP CONSTRAINT IF EXISTS portal_favorites_pkey;
ALTER TABLE IF EXISTS ONLY zigo.policy_configs DROP CONSTRAINT IF EXISTS policy_configs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.policy_configs DROP CONSTRAINT IF EXISTS policy_configs_code_key;
ALTER TABLE IF EXISTS ONLY zigo.places DROP CONSTRAINT IF EXISTS places_pkey;
ALTER TABLE IF EXISTS ONLY zigo.permissions DROP CONSTRAINT IF EXISTS permissions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.permissions DROP CONSTRAINT IF EXISTS permissions_code_key;
ALTER TABLE IF EXISTS ONLY zigo.payments DROP CONSTRAINT IF EXISTS payments_pkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_webhooks DROP CONSTRAINT IF EXISTS payment_webhooks_pkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_merchant_order_id_key;
ALTER TABLE IF EXISTS ONLY zigo.payment_mode_masters DROP CONSTRAINT IF EXISTS payment_mode_masters_pkey;
ALTER TABLE IF EXISTS ONLY zigo.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_pkey;
ALTER TABLE IF EXISTS ONLY zigo.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.organizations DROP CONSTRAINT IF EXISTS organizations_pkey;
ALTER TABLE IF EXISTS ONLY zigo.organizations DROP CONSTRAINT IF EXISTS organizations_code_key;
ALTER TABLE IF EXISTS ONLY zigo.notification_templates DROP CONSTRAINT IF EXISTS notification_templates_pkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_templates DROP CONSTRAINT IF EXISTS notification_templates_code_key;
ALTER TABLE IF EXISTS ONLY zigo.notification_events DROP CONSTRAINT IF EXISTS notification_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_pkey;
ALTER TABLE IF EXISTS ONLY zigo.modules DROP CONSTRAINT IF EXISTS modules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.modules DROP CONSTRAINT IF EXISTS modules_code_key;
ALTER TABLE IF EXISTS ONLY zigo.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.membership_plans DROP CONSTRAINT IF EXISTS membership_plans_pkey;
ALTER TABLE IF EXISTS ONLY zigo.membership_plans DROP CONSTRAINT IF EXISTS membership_plans_code_key;
ALTER TABLE IF EXISTS ONLY zigo.lookup_values DROP CONSTRAINT IF EXISTS lookup_values_pkey;
ALTER TABLE IF EXISTS ONLY zigo.lookup_values DROP CONSTRAINT IF EXISTS lookup_values_group_id_code_key;
ALTER TABLE IF EXISTS ONLY zigo.lookup_groups DROP CONSTRAINT IF EXISTS lookup_groups_pkey;
ALTER TABLE IF EXISTS ONLY zigo.lookup_groups DROP CONSTRAINT IF EXISTS lookup_groups_code_key;
ALTER TABLE IF EXISTS ONLY zigo.invoices DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE IF EXISTS ONLY zigo.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE IF EXISTS ONLY zigo.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_pkey;
ALTER TABLE IF EXISTS ONLY zigo.idempotency_keys DROP CONSTRAINT IF EXISTS idempotency_keys_pkey;
ALTER TABLE IF EXISTS ONLY zigo.idempotency_keys DROP CONSTRAINT IF EXISTS idempotency_keys_key_key;
ALTER TABLE IF EXISTS ONLY zigo.files DROP CONSTRAINT IF EXISTS files_storage_provider_bucket_object_key_key;
ALTER TABLE IF EXISTS ONLY zigo.files DROP CONSTRAINT IF EXISTS files_pkey;
ALTER TABLE IF EXISTS ONLY zigo.file_links DROP CONSTRAINT IF EXISTS file_links_pkey;
ALTER TABLE IF EXISTS ONLY zigo.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_pkey;
ALTER TABLE IF EXISTS ONLY zigo.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_code_key;
ALTER TABLE IF EXISTS ONLY zigo.exception_events DROP CONSTRAINT IF EXISTS exception_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.event_log DROP CONSTRAINT IF EXISTS event_log_pkey;
ALTER TABLE IF EXISTS ONLY zigo.document_types DROP CONSTRAINT IF EXISTS document_types_pkey;
ALTER TABLE IF EXISTS ONLY zigo.document_types DROP CONSTRAINT IF EXISTS document_types_code_key;
ALTER TABLE IF EXISTS ONLY zigo.devices DROP CONSTRAINT IF EXISTS devices_pkey;
ALTER TABLE IF EXISTS ONLY zigo.daily_cluster_metrics DROP CONSTRAINT IF EXISTS daily_cluster_metrics_pkey;
ALTER TABLE IF EXISTS ONLY zigo.daily_assistant_metrics DROP CONSTRAINT IF EXISTS daily_assistant_metrics_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_user_id_key;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customers DROP CONSTRAINT IF EXISTS customers_customer_code_key;
ALTER TABLE IF EXISTS ONLY zigo.customer_unserviceable_locations DROP CONSTRAINT IF EXISTS customer_unserviceable_locations_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_tickets DROP CONSTRAINT IF EXISTS customer_support_tickets_ticket_number_key;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_tickets DROP CONSTRAINT IF EXISTS customer_support_tickets_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_support_messages DROP CONSTRAINT IF EXISTS customer_support_messages_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_notes DROP CONSTRAINT IF EXISTS customer_notes_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_memberships DROP CONSTRAINT IF EXISTS customer_memberships_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_favorite_places DROP CONSTRAINT IF EXISTS customer_favorite_places_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_disputes DROP CONSTRAINT IF EXISTS customer_disputes_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_cart DROP CONSTRAINT IF EXISTS customer_cart_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_auth_sessions DROP CONSTRAINT IF EXISTS customer_auth_sessions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_approvals DROP CONSTRAINT IF EXISTS customer_approvals_pkey;
ALTER TABLE IF EXISTS ONLY zigo.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_pkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_pkey;
ALTER TABLE IF EXISTS ONLY zigo.clusters DROP CONSTRAINT IF EXISTS clusters_code_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_store_map DROP CONSTRAINT IF EXISTS cluster_store_map_cluster_id_store_id_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_visibility DROP CONSTRAINT IF EXISTS cluster_service_visibility_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_visibility DROP CONSTRAINT IF EXISTS cluster_service_visibility_cluster_id_service_id_category_i_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_service_settings DROP CONSTRAINT IF EXISTS cluster_service_settings_cluster_id_service_id_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_launch_configs DROP CONSTRAINT IF EXISTS cluster_launch_configs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_category_settings DROP CONSTRAINT IF EXISTS cluster_category_settings_cluster_id_category_id_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_boundaries DROP CONSTRAINT IF EXISTS cluster_boundaries_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cluster_access_rules DROP CONSTRAINT IF EXISTS cluster_access_rules_source_cluster_id_allowed_cluster_id_r_key;
ALTER TABLE IF EXISTS ONLY zigo.cluster_access_rules DROP CONSTRAINT IF EXISTS cluster_access_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_pkey;
ALTER TABLE IF EXISTS ONLY zigo.cities DROP CONSTRAINT IF EXISTS cities_code_key;
ALTER TABLE IF EXISTS ONLY zigo.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_pkey;
ALTER TABLE IF EXISTS ONLY zigo.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_pkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.category_store_map DROP CONSTRAINT IF EXISTS category_store_map_category_id_store_id_key;
ALTER TABLE IF EXISTS ONLY zigo.category_service_masters DROP CONSTRAINT IF EXISTS category_service_masters_pkey;
ALTER TABLE IF EXISTS ONLY zigo.category_price_rules DROP CONSTRAINT IF EXISTS category_price_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE IF EXISTS ONLY zigo.categories DROP CONSTRAINT IF EXISTS categories_code_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_type_masters DROP CONSTRAINT IF EXISTS booking_type_masters_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_type_masters DROP CONSTRAINT IF EXISTS booking_type_masters_code_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_updates DROP CONSTRAINT IF EXISTS booking_task_updates_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_task_update_reads DROP CONSTRAINT IF EXISTS booking_task_update_reads_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_service_request_id_assistant_id_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_route_sessions DROP CONSTRAINT IF EXISTS booking_route_sessions_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_reviews DROP CONSTRAINT IF EXISTS booking_reviews_service_request_id_customer_user_id_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_reviews DROP CONSTRAINT IF EXISTS booking_reviews_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_realtime_events DROP CONSTRAINT IF EXISTS booking_realtime_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_orchestration_state DROP CONSTRAINT IF EXISTS booking_orchestration_state_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_invoice_email_jobs DROP CONSTRAINT IF EXISTS booking_invoice_email_jobs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_invoice_email_jobs DROP CONSTRAINT IF EXISTS booking_invoice_email_jobs_booking_id_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_rules DROP CONSTRAINT IF EXISTS booking_engine_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_engine_quick_replies DROP CONSTRAINT IF EXISTS booking_engine_quick_replies_pkey;
ALTER TABLE IF EXISTS ONLY zigo.booking_billing_snapshots DROP CONSTRAINT IF EXISTS booking_billing_snapshots_service_request_id_key;
ALTER TABLE IF EXISTS ONLY zigo.booking_billing_snapshots DROP CONSTRAINT IF EXISTS booking_billing_snapshots_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_user_id_key;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistants DROP CONSTRAINT IF EXISTS assistants_assistant_code_key;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicles DROP CONSTRAINT IF EXISTS assistant_vehicles_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicles DROP CONSTRAINT IF EXISTS assistant_vehicles_assistant_id_registration_number_key;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_vehicle_id_document_type_id_key;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_documents DROP CONSTRAINT IF EXISTS assistant_vehicle_documents_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_damage_reports DROP CONSTRAINT IF EXISTS assistant_vehicle_damage_reports_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_vehicle_assignments DROP CONSTRAINT IF EXISTS assistant_vehicle_assignments_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_training_records DROP CONSTRAINT IF EXISTS assistant_training_records_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_task_offers DROP CONSTRAINT IF EXISTS assistant_task_offers_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_skills DROP CONSTRAINT IF EXISTS assistant_skills_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_skills DROP CONSTRAINT IF EXISTS assistant_skills_code_key;
ALTER TABLE IF EXISTS ONLY zigo.assistant_skill_map DROP CONSTRAINT IF EXISTS assistant_skill_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_shift_plans DROP CONSTRAINT IF EXISTS assistant_shift_plans_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_master_logs DROP CONSTRAINT IF EXISTS assistant_master_logs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_location_pings DROP CONSTRAINT IF EXISTS assistant_location_pings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_earnings DROP CONSTRAINT IF EXISTS assistant_earnings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_documents DROP CONSTRAINT IF EXISTS assistant_documents_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_document_verification_events DROP CONSTRAINT IF EXISTS assistant_document_verification_events_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_task_assignment_id_key;
ALTER TABLE IF EXISTS ONLY zigo.assistant_delay_credits DROP CONSTRAINT IF EXISTS assistant_delay_credits_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_cluster_map DROP CONSTRAINT IF EXISTS assistant_cluster_map_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_capacity_reservations DROP CONSTRAINT IF EXISTS assistant_capacity_reservations_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_calendar_blocks DROP CONSTRAINT IF EXISTS assistant_calendar_blocks_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assistant_calendar_blocks DROP CONSTRAINT IF EXISTS assistant_calendar_blocks_no_overlap;
ALTER TABLE IF EXISTS ONLY zigo.assistant_availability DROP CONSTRAINT IF EXISTS assistant_availability_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_runs DROP CONSTRAINT IF EXISTS assignment_runs_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policy_rules DROP CONSTRAINT IF EXISTS assignment_policy_rules_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policies DROP CONSTRAINT IF EXISTS assignment_policies_pkey;
ALTER TABLE IF EXISTS ONLY zigo.assignment_policies DROP CONSTRAINT IF EXISTS assignment_policies_code_key;
ALTER TABLE IF EXISTS ONLY zigo.approval_responses DROP CONSTRAINT IF EXISTS approval_responses_pkey;
ALTER TABLE IF EXISTS ONLY zigo.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_pkey;
ALTER TABLE IF EXISTS ONLY zigo.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE IF EXISTS ONLY zigo.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE IF EXISTS ONLY zigo.app_config_values DROP CONSTRAINT IF EXISTS app_config_values_pkey;
ALTER TABLE IF EXISTS ONLY zigo.api_clients DROP CONSTRAINT IF EXISTS api_clients_pkey;
ALTER TABLE IF EXISTS ONLY zigo.api_clients DROP CONSTRAINT IF EXISTS api_clients_client_key_key;
ALTER TABLE IF EXISTS ONLY zigo.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_pkey;
ALTER TABLE IF EXISTS zigo.booking_realtime_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS zigo.booking_invoice_email_jobs ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS zigo.zones;
DROP TABLE IF EXISTS zigo.workflows;
DROP TABLE IF EXISTS zigo.workflow_transitions;
DROP TABLE IF EXISTS zigo.workflow_states;
DROP TABLE IF EXISTS zigo.webhook_endpoints;
DROP TABLE IF EXISTS zigo.webhook_deliveries;
DROP TABLE IF EXISTS zigo.wallets;
DROP TABLE IF EXISTS zigo.wallet_ledger;
DROP TABLE IF EXISTS zigo.vehicle_master;
DROP TABLE IF EXISTS zigo.users;
DROP TABLE IF EXISTS zigo.user_roles;
DROP TABLE IF EXISTS zigo.user_permissions;
DROP TABLE IF EXISTS zigo.user_modules;
DROP TABLE IF EXISTS zigo.time_slot_masters;
DROP TABLE IF EXISTS zigo.tax_master_rules;
DROP TABLE IF EXISTS zigo.task_updates;
DROP TABLE IF EXISTS zigo.task_types;
DROP TABLE IF EXISTS zigo.task_stop_visits;
DROP TABLE IF EXISTS zigo.task_proofs;
DROP TABLE IF EXISTS zigo.task_execution_sessions;
DROP TABLE IF EXISTS zigo.task_events;
DROP TABLE IF EXISTS zigo.task_assignments;
DROP TABLE IF EXISTS zigo.surge_rules;
DROP TABLE IF EXISTS zigo.support_tickets;
DROP TABLE IF EXISTS zigo.support_issues;
DROP TABLE IF EXISTS zigo.stores;
DROP TABLE IF EXISTS zigo.store_keywords;
DROP TABLE IF EXISTS zigo.store_keyword_map;
DROP TABLE IF EXISTS zigo.store_images;
DROP TABLE IF EXISTS zigo.store_cluster_map;
DROP TABLE IF EXISTS zigo.store_category_map;
DROP TABLE IF EXISTS zigo.store_categories;
DROP TABLE IF EXISTS zigo.states;
DROP TABLE IF EXISTS zigo.sla_breach_events;
DROP TABLE IF EXISTS zigo.settlements;
DROP TABLE IF EXISTS zigo.services;
DROP TABLE IF EXISTS zigo.service_task_rules;
DROP TABLE IF EXISTS zigo.service_requests;
DROP TABLE IF EXISTS zigo.service_categories;
DROP TABLE IF EXISTS zigo.roles;
DROP TABLE IF EXISTS zigo.role_verification_requirements;
DROP TABLE IF EXISTS zigo.role_permissions;
DROP TABLE IF EXISTS zigo.role_modules;
DROP TABLE IF EXISTS zigo.request_timeline_events;
DROP TABLE IF EXISTS zigo.request_stops;
DROP TABLE IF EXISTS zigo.request_status_history;
DROP TABLE IF EXISTS zigo.request_locations;
DROP TABLE IF EXISTS zigo.request_items;
DROP TABLE IF EXISTS zigo.request_attachments;
DROP TABLE IF EXISTS zigo.refunds;
DROP TABLE IF EXISTS zigo.reason_codes;
DROP TABLE IF EXISTS zigo.razorpay_webhook_events;
DROP TABLE IF EXISTS zigo.razorpay_payments;
DROP TABLE IF EXISTS zigo.razorpay_downtimes;
DROP TABLE IF EXISTS zigo.ratings;
DROP TABLE IF EXISTS zigo.pricing_rules;
DROP TABLE IF EXISTS zigo.pricing_policies;
DROP TABLE IF EXISTS zigo.price_master_rules;
DROP TABLE IF EXISTS zigo.portal_favorites;
DROP TABLE IF EXISTS zigo.policy_configs;
DROP TABLE IF EXISTS zigo.places;
DROP TABLE IF EXISTS zigo.permissions;
DROP TABLE IF EXISTS zigo.payments;
DROP TABLE IF EXISTS zigo.payment_webhooks;
DROP TABLE IF EXISTS zigo.payment_transactions;
DROP TABLE IF EXISTS zigo.payment_mode_masters;
DROP TABLE IF EXISTS zigo.payment_intents;
DROP TABLE IF EXISTS zigo.outbox_events;
DROP TABLE IF EXISTS zigo.organizations;
DROP TABLE IF EXISTS zigo.notification_templates;
DROP TABLE IF EXISTS zigo.notification_events;
DROP TABLE IF EXISTS zigo.notification_deliveries;
DROP TABLE IF EXISTS zigo.modules;
DROP TABLE IF EXISTS zigo.module_permissions;
DROP TABLE IF EXISTS zigo.membership_plans;
DROP TABLE IF EXISTS zigo.lookup_values;
DROP TABLE IF EXISTS zigo.lookup_groups;
DROP TABLE IF EXISTS zigo.invoices;
DROP TABLE IF EXISTS zigo.invoice_lines;
DROP TABLE IF EXISTS zigo.idempotency_keys;
DROP TABLE IF EXISTS zigo.files;
DROP TABLE IF EXISTS zigo.file_links;
DROP TABLE IF EXISTS zigo.feature_flags;
DROP TABLE IF EXISTS zigo.exception_events;
DROP TABLE IF EXISTS zigo.event_log;
DROP TABLE IF EXISTS zigo.document_types;
DROP TABLE IF EXISTS zigo.devices;
DROP TABLE IF EXISTS zigo.daily_cluster_metrics;
DROP TABLE IF EXISTS zigo.daily_assistant_metrics;
DROP TABLE IF EXISTS zigo.customers;
DROP TABLE IF EXISTS zigo.customer_unserviceable_locations;
DROP TABLE IF EXISTS zigo.customer_support_tickets;
DROP TABLE IF EXISTS zigo.customer_support_messages;
DROP TABLE IF EXISTS zigo.customer_notes;
DROP TABLE IF EXISTS zigo.customer_memberships;
DROP TABLE IF EXISTS zigo.customer_favorite_places;
DROP TABLE IF EXISTS zigo.customer_disputes;
DROP TABLE IF EXISTS zigo.customer_cart;
DROP TABLE IF EXISTS zigo.customer_auth_sessions;
DROP TABLE IF EXISTS zigo.customer_approvals;
DROP TABLE IF EXISTS zigo.customer_addresses;
DROP TABLE IF EXISTS zigo.clusters;
DROP TABLE IF EXISTS zigo.cluster_store_map;
DROP TABLE IF EXISTS zigo.cluster_service_visibility;
DROP TABLE IF EXISTS zigo.cluster_service_settings;
DROP TABLE IF EXISTS zigo.cluster_launch_configs;
DROP TABLE IF EXISTS zigo.cluster_category_settings;
DROP TABLE IF EXISTS zigo.cluster_boundaries;
DROP TABLE IF EXISTS zigo.cluster_access_rules;
DROP TABLE IF EXISTS zigo.cities;
DROP TABLE IF EXISTS zigo.chat_threads;
DROP TABLE IF EXISTS zigo.chat_messages;
DROP TABLE IF EXISTS zigo.category_store_map;
DROP TABLE IF EXISTS zigo.category_service_masters;
DROP TABLE IF EXISTS zigo.category_price_rules;
DROP TABLE IF EXISTS zigo.categories;
DROP TABLE IF EXISTS zigo.booking_type_masters;
DROP TABLE IF EXISTS zigo.booking_task_updates;
DROP TABLE IF EXISTS zigo.booking_task_update_reads;
DROP TABLE IF EXISTS zigo.booking_route_sessions;
DROP TABLE IF EXISTS zigo.booking_reviews;
DROP SEQUENCE IF EXISTS zigo.booking_realtime_events_id_seq;
DROP TABLE IF EXISTS zigo.booking_realtime_events;
DROP TABLE IF EXISTS zigo.booking_orchestration_state;
DROP SEQUENCE IF EXISTS zigo.booking_invoice_email_jobs_id_seq;
DROP TABLE IF EXISTS zigo.booking_invoice_email_jobs;
DROP TABLE IF EXISTS zigo.booking_engine_rules;
DROP TABLE IF EXISTS zigo.booking_engine_quick_replies;
DROP TABLE IF EXISTS zigo.booking_billing_snapshots;
DROP TABLE IF EXISTS zigo.assistants;
DROP TABLE IF EXISTS zigo.assistant_vehicles;
DROP TABLE IF EXISTS zigo.assistant_vehicle_documents;
DROP TABLE IF EXISTS zigo.assistant_vehicle_damage_reports;
DROP TABLE IF EXISTS zigo.assistant_vehicle_assignments;
DROP TABLE IF EXISTS zigo.assistant_training_records;
DROP TABLE IF EXISTS zigo.assistant_task_offers;
DROP TABLE IF EXISTS zigo.assistant_skills;
DROP TABLE IF EXISTS zigo.assistant_skill_map;
DROP TABLE IF EXISTS zigo.assistant_shift_plans;
DROP TABLE IF EXISTS zigo.assistant_master_logs;
DROP TABLE IF EXISTS zigo.assistant_location_pings;
DROP TABLE IF EXISTS zigo.assistant_earnings;
DROP TABLE IF EXISTS zigo.assistant_documents;
DROP TABLE IF EXISTS zigo.assistant_document_verification_events;
DROP TABLE IF EXISTS zigo.assistant_delay_credits;
DROP TABLE IF EXISTS zigo.assistant_cluster_map;
DROP TABLE IF EXISTS zigo.assistant_capacity_reservations;
DROP TABLE IF EXISTS zigo.assistant_calendar_blocks;
DROP TABLE IF EXISTS zigo.assistant_availability;
DROP TABLE IF EXISTS zigo.assignment_runs;
DROP TABLE IF EXISTS zigo.assignment_policy_rules;
DROP TABLE IF EXISTS zigo.assignment_policies;
DROP TABLE IF EXISTS zigo.approval_responses;
DROP TABLE IF EXISTS zigo.approval_requests;
DROP TABLE IF EXISTS zigo.app_settings;
DROP TABLE IF EXISTS zigo.app_config_values;
DROP TABLE IF EXISTS zigo.api_clients;
DROP TABLE IF EXISTS zigo.admin_actions;
DROP SCHEMA IF EXISTS zigo;
--
-- Name: zigo; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA zigo;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.admin_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action_type_id uuid,
    reason_id uuid,
    notes text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_clients; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.api_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    client_key text NOT NULL,
    status_id uuid,
    allowed_scopes text[] DEFAULT '{}'::text[] NOT NULL,
    rate_limit_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_config_values; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.app_config_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    scope_type text DEFAULT 'global'::text NOT NULL,
    scope_id uuid,
    value jsonb NOT NULL,
    is_secret boolean DEFAULT false NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: approval_requests; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    task_update_id uuid,
    requested_by_assistant_id uuid,
    approval_type_id uuid,
    title text NOT NULL,
    description text,
    amount numeric(12,2),
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: approval_responses; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.approval_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approval_request_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    response_type_id uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_policies; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assignment_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    cluster_id uuid,
    service_id uuid,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_policy_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assignment_policy_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_policy_id uuid NOT NULL,
    rule_type_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    weight numeric(8,3) DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_runs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assignment_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    assignment_policy_id uuid,
    run_type_id uuid,
    status_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    rule_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: assistant_availability; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    availability_status_id uuid,
    cluster_id uuid,
    latitude numeric(10,7),
    longitude numeric(10,7),
    location public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN ((longitude IS NOT NULL) AND (latitude IS NOT NULL)) THEN (public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    battery_percent integer,
    app_version text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_code text DEFAULT 'offline'::text NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    online_started_at timestamp with time zone,
    today_online_seconds integer DEFAULT 0 NOT NULL,
    today_online_date date DEFAULT CURRENT_DATE NOT NULL,
    presence_status text DEFAULT 'OFFLINE'::text NOT NULL,
    work_status text DEFAULT 'FREE'::text NOT NULL,
    availability_confidence text DEFAULT 'UNKNOWN'::text NOT NULL,
    heartbeat_at timestamp with time zone,
    gps_captured_at timestamp with time zone,
    next_available_at timestamp with time zone,
    next_available_lat numeric(10,7),
    next_available_lng numeric(10,7),
    next_available_cluster_id uuid,
    status_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_calendar_blocks; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_calendar_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    block_type text NOT NULL,
    status_code text DEFAULT 'active'::text NOT NULL,
    source_type text,
    source_id uuid,
    cluster_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    start_lat numeric(10,7),
    start_lng numeric(10,7),
    end_lat numeric(10,7),
    end_lng numeric(10,7),
    confidence text DEFAULT 'EXPECTED'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assistant_calendar_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['SHIFT'::text, 'BOOKING'::text, 'TEMPORARY_HOLD'::text, 'TRAVEL'::text, 'WRAP_UP'::text, 'BREAK'::text, 'TIME_OFF'::text, 'ADMIN_BLOCK'::text]))),
    CONSTRAINT assistant_calendar_blocks_check CHECK ((end_at > start_at)),
    CONSTRAINT assistant_calendar_blocks_confidence_check CHECK ((confidence = ANY (ARRAY['CONFIRMED'::text, 'EXPECTED'::text, 'UNKNOWN'::text])))
);


--
-- Name: assistant_capacity_reservations; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_capacity_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    assignment_id uuid,
    assistant_id uuid,
    cluster_id uuid NOT NULL,
    booking_type text DEFAULT 'instant'::text NOT NULL,
    assign_type text DEFAULT 'manual'::text NOT NULL,
    status_code text DEFAULT 'reserved'::text NOT NULL,
    reserved_from timestamp with time zone NOT NULL,
    reserved_until timestamp with time zone NOT NULL,
    promised_start_at timestamp with time zone,
    sla_deadline_at timestamp with time zone,
    source text DEFAULT 'booking_engine'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    release_reason text
);


--
-- Name: assistant_cluster_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_cluster_map (
    assistant_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_delay_credits; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_delay_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    task_assignment_id uuid NOT NULL,
    assistant_id uuid NOT NULL,
    planned_start_at timestamp with time zone,
    actual_started_at timestamp with time zone NOT NULL,
    delay_minutes integer DEFAULT 0 NOT NULL,
    credited_minutes integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'assistant_start'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_document_verification_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_document_verification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_document_id uuid,
    assistant_id uuid NOT NULL,
    document_type_id uuid,
    old_status text,
    new_status text NOT NULL,
    remarks text,
    actor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_documents; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    document_type_id uuid,
    file_id uuid,
    verification_status_id uuid,
    verified_by_user_id uuid,
    verified_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_earnings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    request_id uuid NOT NULL,
    earning_type_id uuid,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_location_pings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_location_pings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    request_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location public.geography(Point,4326) GENERATED ALWAYS AS ((public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326))::public.geography) STORED,
    accuracy_meters numeric(8,2),
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    service_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_master_logs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_master_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_shift_plans; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_shift_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    cluster_id uuid,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_skill_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_skill_map (
    assistant_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    proficiency_level integer DEFAULT 1 NOT NULL,
    verified_at timestamp with time zone
);


--
-- Name: assistant_skills; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_task_offers; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_task_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_run_id uuid,
    request_id uuid NOT NULL,
    assistant_id uuid NOT NULL,
    offer_status_id uuid,
    offered_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    responded_at timestamp with time zone,
    rejection_reason_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: assistant_training_records; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_training_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    training_type_id uuid,
    status_id uuid,
    completed_at timestamp with time zone,
    score numeric(5,2),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_vehicle_assignments; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_vehicle_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    vehicle_master_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    removed_by uuid,
    removed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_vehicle_damage_reports; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_vehicle_damage_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    vehicle_master_id uuid,
    vehicle_assignment_id uuid,
    reason text NOT NULL,
    proof_picture_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    expense numeric(12,2),
    paid_by text NOT NULL,
    payment_proof_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_vehicle_documents; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_vehicle_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    document_type_id uuid NOT NULL,
    file_id uuid,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    verified_by_user_id uuid,
    verified_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistant_vehicles; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistant_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assistant_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    registration_number text NOT NULL,
    make text,
    model text,
    color text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: assistants; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.assistants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assistant_code text NOT NULL,
    status_id uuid,
    verification_status_id uuid,
    current_cluster_id uuid,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_billing_snapshots; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_billing_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    base_price_paise bigint DEFAULT 0 NOT NULL,
    discount_paise bigint DEFAULT 0 NOT NULL,
    selling_price_paise bigint DEFAULT 0 NOT NULL,
    item_total_paise bigint DEFAULT 0 NOT NULL,
    tax_amount_paise bigint DEFAULT 0 NOT NULL,
    inclusive_tax_amount_paise bigint DEFAULT 0 NOT NULL,
    exclusive_tax_amount_paise bigint DEFAULT 0 NOT NULL,
    tip_amount_paise bigint DEFAULT 0 NOT NULL,
    waiting_charges_paise bigint DEFAULT 0 NOT NULL,
    grand_total_paise bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    tax_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    pricing_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_engine_quick_replies; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_engine_quick_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text DEFAULT 'all'::text NOT NULL,
    state_id uuid,
    city_id uuid,
    zone_id uuid,
    cluster_id uuid,
    category_id uuid,
    actor text DEFAULT 'assistant'::text NOT NULL,
    audience text DEFAULT 'customer'::text NOT NULL,
    booking_stage text DEFAULT 'working'::text NOT NULL,
    action_type text DEFAULT 'message'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: booking_engine_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_engine_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text DEFAULT 'all'::text NOT NULL,
    state_id uuid,
    city_id uuid,
    zone_id uuid,
    cluster_id uuid,
    category_id uuid,
    service_control_mode text DEFAULT 'manual'::text NOT NULL,
    manual_service_status text DEFAULT 'stop'::text NOT NULL,
    auto_start_at timestamp with time zone,
    auto_end_at timestamp with time zone,
    instant_eta_minutes integer DEFAULT 0 NOT NULL,
    instant_wrap_up_minutes integer DEFAULT 0 NOT NULL,
    instant_travel_minutes integer DEFAULT 0 NOT NULL,
    schedule_eta_minutes integer DEFAULT 0 NOT NULL,
    schedule_wrap_up_minutes integer DEFAULT 0 NOT NULL,
    schedule_travel_minutes integer DEFAULT 0 NOT NULL,
    assistant_assignment_mode text DEFAULT 'manual'::text NOT NULL,
    note text,
    image_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    auto_start_time text,
    auto_end_time text,
    instant_initiate_minutes integer DEFAULT 0 NOT NULL,
    schedule_initiate_minutes integer DEFAULT 0 NOT NULL
);


--
-- Name: booking_invoice_email_jobs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_invoice_email_jobs (
    id bigint NOT NULL,
    booking_id uuid NOT NULL,
    customer_user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_invoice_email_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'sent'::text, 'skipped'::text, 'failed'::text])))
);


--
-- Name: booking_invoice_email_jobs_id_seq; Type: SEQUENCE; Schema: zigo; Owner: -
--

CREATE SEQUENCE zigo.booking_invoice_email_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_invoice_email_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: zigo; Owner: -
--

ALTER SEQUENCE zigo.booking_invoice_email_jobs_id_seq OWNED BY zigo.booking_invoice_email_jobs.id;


--
-- Name: booking_orchestration_state; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_orchestration_state (
    service_request_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    demand_status text DEFAULT 'pending_assign'::text NOT NULL,
    risk_status text DEFAULT 'on_time'::text NOT NULL,
    supply_status text DEFAULT 'unassigned'::text NOT NULL,
    booking_type text DEFAULT 'instant'::text NOT NULL,
    assign_type text DEFAULT 'manual'::text NOT NULL,
    requested_start_at timestamp with time zone,
    promised_start_at timestamp with time zone,
    sla_deadline_at timestamp with time zone,
    assistant_id uuid,
    reservation_id uuid,
    next_check_at timestamp with time zone,
    last_event_type text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_realtime_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_realtime_events (
    id bigint NOT NULL,
    event_type text NOT NULL,
    booking_id uuid,
    tab text,
    message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assistant_id uuid,
    cluster_id uuid
);


--
-- Name: booking_realtime_events_id_seq; Type: SEQUENCE; Schema: zigo; Owner: -
--

CREATE SEQUENCE zigo.booking_realtime_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_realtime_events_id_seq; Type: SEQUENCE OWNED BY; Schema: zigo; Owner: -
--

ALTER SEQUENCE zigo.booking_realtime_events_id_seq OWNED BY zigo.booking_realtime_events.id;


--
-- Name: booking_reviews; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    customer_user_id uuid NOT NULL,
    assistant_id uuid,
    zigo_rating integer NOT NULL,
    assistant_rating integer NOT NULL,
    service_rating integer NOT NULL,
    review_text text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_reviews_assistant_rating_check CHECK (((assistant_rating >= 1) AND (assistant_rating <= 5))),
    CONSTRAINT booking_reviews_service_rating_check CHECK (((service_rating >= 1) AND (service_rating <= 5))),
    CONSTRAINT booking_reviews_zigo_rating_check CHECK (((zigo_rating >= 1) AND (zigo_rating <= 5)))
);


--
-- Name: booking_route_sessions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_route_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    task_assignment_id uuid,
    assistant_id uuid NOT NULL,
    status_code text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    stopped_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    last_latitude numeric(10,7),
    last_longitude numeric(10,7),
    last_accuracy_meters numeric(8,2),
    last_eta_minutes integer,
    last_ping_id uuid,
    route_legs jsonb DEFAULT '[]'::jsonb NOT NULL,
    route_progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    tracking_source text DEFAULT 'assistant_webview'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_task_update_reads; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_task_update_reads (
    update_id uuid NOT NULL,
    user_id uuid NOT NULL,
    actor_type text NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_task_updates; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_task_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    task_assignment_id uuid,
    actor_user_id uuid,
    actor_type text NOT NULL,
    update_type text DEFAULT 'text'::text NOT NULL,
    message text,
    media_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_type_masters; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.booking_type_masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    booking_type text DEFAULT 'instant'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_category_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_id uuid,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    image_url text,
    priority integer DEFAULT 0 NOT NULL,
    is_recommended boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: category_price_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.category_price_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text DEFAULT 'all'::text NOT NULL,
    state_id uuid,
    city_id uuid,
    zone_id uuid,
    cluster_id uuid,
    category_id uuid NOT NULL,
    time_duration_minutes integer DEFAULT 0 NOT NULL,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    discount_type text DEFAULT 'none'::text NOT NULL,
    discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    waiting_charge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    waiting_charge_time_minutes integer DEFAULT 0 NOT NULL,
    slab jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    available_for_duration boolean DEFAULT true NOT NULL,
    available_for_extend boolean DEFAULT false NOT NULL,
    available_for_expand boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_duration_for_offers boolean DEFAULT false NOT NULL,
    is_offer_eligible boolean DEFAULT true NOT NULL
);


--
-- Name: category_service_masters; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.category_service_masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_title text NOT NULL,
    service_subtitle text,
    static_value text,
    show_static_value boolean DEFAULT true NOT NULL,
    icons jsonb DEFAULT '[]'::jsonb NOT NULL,
    service_position integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    service_category_grid_size text DEFAULT '3x3'::text NOT NULL,
    service_title_font_size integer DEFAULT 18 NOT NULL,
    service_title_font_weight integer DEFAULT 700 NOT NULL,
    service_title_color text DEFAULT ''::text NOT NULL,
    service_subtitle_font_size integer DEFAULT 13 NOT NULL,
    service_subtitle_font_weight integer DEFAULT 400 NOT NULL,
    service_subtitle_color text DEFAULT ''::text NOT NULL,
    booking_type text DEFAULT 'both'::text NOT NULL,
    show_eta boolean DEFAULT false NOT NULL
);


--
-- Name: category_store_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.category_store_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_user_id uuid,
    message_type_id uuid,
    message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_threads; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    thread_type_id uuid,
    status_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cities; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    state text,
    country text DEFAULT 'IN'::text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    operating_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    state_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: cluster_access_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_access_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_cluster_id uuid NOT NULL,
    allowed_cluster_id uuid NOT NULL,
    rule_type_id uuid,
    is_enabled boolean DEFAULT false NOT NULL,
    max_distance_km numeric(8,2),
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cluster_boundaries; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_boundaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    boundary_geojson jsonb NOT NULL,
    boundary_geometry public.geometry(MultiPolygon,4326),
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cluster_category_settings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_category_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    category_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: cluster_launch_configs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_launch_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    min_online_assistants integer DEFAULT 0 NOT NULL,
    backup_assistants integer DEFAULT 0 NOT NULL,
    booking_enabled_at timestamp with time zone,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cluster_service_settings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_service_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    service_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: cluster_service_visibility; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_service_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    service_id uuid NOT NULL,
    category_id uuid,
    is_visible boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: cluster_store_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.cluster_store_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: clusters; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    zone_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status_id uuid,
    launch_stage_id uuid,
    is_booking_enabled boolean DEFAULT false NOT NULL,
    operating_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    description text,
    areas_description text,
    polygon_description text
);


--
-- Name: customer_addresses; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    label text,
    address_text text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    location public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN ((longitude IS NOT NULL) AND (latitude IS NOT NULL)) THEN (public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    city text,
    postal_code text,
    cluster_id uuid,
    is_default boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);


--
-- Name: customer_approvals; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    task_update_id uuid,
    approval_type text NOT NULL,
    status_code text DEFAULT 'pending'::text NOT NULL,
    amount_paise integer,
    requested_message text,
    decision_notes text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_auth_sessions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_auth_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    refresh_token_version integer DEFAULT 1 NOT NULL,
    user_agent text,
    ip_address text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason text,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_cart; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_cart (
    customer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cart_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_note text DEFAULT ''::text NOT NULL
);


--
-- Name: customer_disputes; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    customer_user_id uuid NOT NULL,
    assigned_admin_user_id uuid,
    status_code text DEFAULT 'open'::text NOT NULL,
    subject text DEFAULT 'Booking dispute'::text NOT NULL,
    description text,
    request_refund boolean DEFAULT false NOT NULL,
    requested_refund_amount_paise integer DEFAULT 0 NOT NULL,
    payment_mode text,
    resolution_type text,
    resolution_amount_paise integer DEFAULT 0 NOT NULL,
    resolution_reason text,
    admin_response text,
    resolved_at timestamp with time zone,
    resolved_by_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_favorite_places; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_favorite_places (
    customer_id uuid NOT NULL,
    place_id uuid NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_memberships; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    membership_plan_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_notes; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    note_type_id uuid,
    note text NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_support_messages; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_type character varying(20) NOT NULL,
    sender_user_id uuid,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_support_tickets; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number character varying(32) NOT NULL,
    customer_id uuid NOT NULL,
    booking_id uuid,
    subject character varying(200) NOT NULL,
    category character varying(60) DEFAULT 'general'::character varying NOT NULL,
    status_code character varying(30) DEFAULT 'open'::character varying NOT NULL,
    priority_code character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    assigned_admin_user_id uuid,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_unserviceable_locations; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customer_unserviceable_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    user_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location_title text,
    address_text text NOT NULL,
    state_name text,
    city_name text,
    postal_code text,
    hit_count integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    customer_code text NOT NULL,
    default_membership_plan_id uuid,
    status_id uuid,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_assistant_metrics; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.daily_assistant_metrics (
    metric_date date NOT NULL,
    assistant_id uuid NOT NULL,
    online_minutes integer DEFAULT 0 NOT NULL,
    busy_minutes integer DEFAULT 0 NOT NULL,
    tasks_offered integer DEFAULT 0 NOT NULL,
    tasks_accepted integer DEFAULT 0 NOT NULL,
    tasks_completed integer DEFAULT 0 NOT NULL,
    tasks_rejected integer DEFAULT 0 NOT NULL,
    earning_total numeric(12,2) DEFAULT 0 NOT NULL,
    rating_avg numeric(3,2)
);


--
-- Name: daily_cluster_metrics; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.daily_cluster_metrics (
    metric_date date NOT NULL,
    cluster_id uuid NOT NULL,
    requests_created integer DEFAULT 0 NOT NULL,
    requests_completed integer DEFAULT 0 NOT NULL,
    requests_cancelled integer DEFAULT 0 NOT NULL,
    failed_assignments integer DEFAULT 0 NOT NULL,
    avg_assignment_seconds numeric(12,2),
    avg_completion_minutes numeric(12,2),
    revenue_total numeric(12,2) DEFAULT 0 NOT NULL,
    refund_total numeric(12,2) DEFAULT 0 NOT NULL,
    support_ticket_count integer DEFAULT 0 NOT NULL
);


--
-- Name: devices; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_type_id uuid,
    platform_id uuid,
    push_token text,
    device_uid text,
    app_version text,
    last_seen_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_types; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    entity_type text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_log; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.event_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    entity_type text,
    entity_id uuid,
    actor_user_id uuid,
    request_id uuid,
    cluster_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exception_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.exception_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    exception_type_id uuid,
    severity_id uuid,
    reason_id uuid,
    detected_by_user_id uuid,
    status_id uuid,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: feature_flags; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_enabled boolean DEFAULT false NOT NULL,
    rollout_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_links; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.file_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    purpose text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage_provider text NOT NULL,
    bucket text NOT NULL,
    object_key text NOT NULL,
    original_name text,
    mime_type text,
    size_bytes bigint,
    checksum text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    actor_user_id uuid,
    request_hash text,
    response_status integer,
    response_body jsonb,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: invoice_lines; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    line_type_id uuid,
    description text NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    invoice_number text NOT NULL,
    status_id uuid,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    issued_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_groups; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.lookup_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lookup_values; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.lookup_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    color text,
    icon text,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membership_plans; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.membership_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    priority_level integer DEFAULT 0 NOT NULL,
    free_minutes_per_task integer DEFAULT 0 NOT NULL,
    support_sla_minutes integer,
    pricing_policy_id uuid,
    cancellation_policy_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: module_permissions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.module_permissions (
    module_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: notification_deliveries; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.notification_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_event_id uuid,
    template_id uuid,
    user_id uuid,
    channel_id uuid,
    status_id uuid,
    provider_reference text,
    sent_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_code text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_templates; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    channel_id uuid,
    audience_id uuid,
    subject_template text,
    body_template text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    organization_type_id uuid,
    status_id uuid,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: outbox_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status_id uuid,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_intents; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.payment_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    customer_id uuid,
    intent_type_id uuid,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    gateway_id uuid,
    gateway_reference text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: payment_mode_masters; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.payment_mode_masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    scope_type text DEFAULT 'all'::text NOT NULL,
    state_id uuid,
    city_id uuid,
    zone_id uuid,
    cluster_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: payment_transactions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    provider text DEFAULT 'zaakpay'::text NOT NULL,
    merchant_order_id text NOT NULL,
    provider_transaction_id text,
    amount_paise integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status_code text DEFAULT 'created'::text NOT NULL,
    checksum text,
    return_payload jsonb,
    webhook_payload jsonb,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_webhooks; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.payment_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    merchant_order_id text,
    provider_transaction_id text,
    event_status text,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_intent_id uuid,
    request_id uuid,
    customer_id uuid,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    gateway_id uuid,
    gateway_payment_id text,
    paid_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    module text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: places; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_type_id uuid,
    name text NOT NULL,
    address_text text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    location public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN ((longitude IS NOT NULL) AND (latitude IS NOT NULL)) THEN (public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    city_id uuid,
    cluster_id uuid,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: policy_configs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.policy_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_type_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_favorites; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.portal_favorites (
    user_id uuid NOT NULL,
    actor_type text NOT NULL,
    favorite_type text NOT NULL,
    object_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: price_master_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.price_master_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    price_type text DEFAULT 'task'::text NOT NULL,
    service_id uuid,
    category_id uuid,
    store_id uuid,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    discount_type text DEFAULT 'none'::text NOT NULL,
    discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    cart_added boolean DEFAULT false NOT NULL,
    complexity_base text DEFAULT 'none'::text NOT NULL,
    complexity_multiplier numeric(12,4) DEFAULT 0 NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    scope_type text DEFAULT 'all'::text NOT NULL,
    state_id uuid,
    city_id uuid,
    zone_id uuid,
    cluster_id uuid,
    max_stores_per_category integer DEFAULT 1 NOT NULL,
    max_stores_total integer DEFAULT 10 NOT NULL,
    time_slabs jsonb DEFAULT '[]'::jsonb NOT NULL,
    complexity_slabs jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: pricing_policies; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.pricing_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pricing_policy_id uuid NOT NULL,
    service_id uuid,
    category_id uuid,
    cluster_id uuid,
    membership_plan_id uuid,
    rule_type_id uuid,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_to timestamp with time zone,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ratings; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    rated_by_user_id uuid NOT NULL,
    rated_entity_type text NOT NULL,
    rated_entity_id uuid NOT NULL,
    rating numeric(3,2) NOT NULL,
    comment text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ratings_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))
);


--
-- Name: razorpay_downtimes; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.razorpay_downtimes (
    id text NOT NULL,
    method text,
    status_code text,
    severity text,
    instrument jsonb DEFAULT '{}'::jsonb NOT NULL,
    begin_at timestamp with time zone,
    end_at timestamp with time zone,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: razorpay_payments; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.razorpay_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid,
    customer_user_id uuid,
    provider_order_id text NOT NULL,
    provider_payment_id text,
    amount_paise integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    receipt text,
    status_code text DEFAULT 'pending'::text NOT NULL,
    method text,
    bank text,
    wallet text,
    vpa text,
    email text,
    contact text,
    error_code text,
    error_description text,
    captured_at timestamp with time zone,
    verified_at timestamp with time zone,
    last_reconciled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_order jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_payment jsonb DEFAULT '{}'::jsonb NOT NULL,
    webhook_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: razorpay_webhook_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.razorpay_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text,
    event_name text NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reason_codes; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.reason_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    reason_group_id uuid,
    applies_to_entity text,
    requires_notes boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refunds; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid,
    request_id uuid,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    reason_id uuid,
    gateway_refund_id text,
    processed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_attachments; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    stop_id uuid,
    file_id uuid NOT NULL,
    attachment_type_id uuid,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_items; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    stop_id uuid,
    item_name text NOT NULL,
    quantity text,
    notes text,
    estimated_amount numeric(12,2),
    approved_amount numeric(12,2),
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_locations; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    sequence integer NOT NULL,
    location_type text DEFAULT 'store'::text NOT NULL,
    name text,
    address text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cluster_id uuid
);


--
-- Name: request_status_history; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    from_state_id uuid,
    to_state_id uuid,
    transition_id uuid,
    actor_user_id uuid,
    reason_id uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_stops; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    place_id uuid,
    stop_type_id uuid,
    custom_address_text text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    location public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN ((longitude IS NOT NULL) AND (latitude IS NOT NULL)) THEN (public.st_setsrid(public.st_makepoint((longitude)::double precision, (latitude)::double precision), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    cluster_id uuid,
    state_id uuid,
    instructions text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_timeline_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.request_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    event_type_id uuid,
    actor_user_id uuid,
    title text NOT NULL,
    description text,
    visibility_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_modules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.role_modules (
    role_id uuid NOT NULL,
    module_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_verification_requirements; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.role_verification_requirements (
    role_id uuid NOT NULL,
    document_type_id uuid NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.service_categories (
    service_id uuid NOT NULL,
    category_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: service_requests; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.service_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_number text NOT NULL,
    customer_id uuid NOT NULL,
    service_id uuid NOT NULL,
    category_id uuid,
    task_type_id uuid,
    cluster_id uuid NOT NULL,
    workflow_id uuid,
    current_state_id uuid,
    booking_mode_id uuid,
    scheduled_at timestamp with time zone,
    estimated_duration_min integer DEFAULT 0 NOT NULL,
    free_duration_min integer DEFAULT 0 NOT NULL,
    paid_duration_min integer DEFAULT 0 NOT NULL,
    priority_level integer DEFAULT 0 NOT NULL,
    customer_notes text,
    source_app_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    closed_at timestamp with time zone,
    delivery_type_id uuid,
    status_code text DEFAULT 'draft'::text NOT NULL,
    notes text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    estimated_amount_paise integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    accepted_assignment_id uuid,
    cancelled_reason text,
    completed_at timestamp with time zone,
    booking_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_type text DEFAULT 'instant'::text NOT NULL,
    booking_date date,
    booking_time_slot text,
    booking_amount_paise bigint DEFAULT 0 NOT NULL,
    base_price_paise bigint DEFAULT 0 NOT NULL,
    discount_paise bigint DEFAULT 0 NOT NULL,
    selling_price_paise bigint DEFAULT 0 NOT NULL,
    waiting_time_minutes integer DEFAULT 0 NOT NULL,
    waiting_charges_paise bigint DEFAULT 0 NOT NULL,
    payment_type text DEFAULT 'cash'::text NOT NULL,
    payment_status text DEFAULT 'due'::text NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    service_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    category_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    store_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    customer_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    location_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    upload_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    additional_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    booking_start_at timestamp with time zone,
    booking_end_at timestamp with time zone,
    booking_available_at timestamp with time zone,
    eta_minutes integer DEFAULT 0 NOT NULL,
    wrap_up_minutes integer DEFAULT 0 NOT NULL,
    travel_buffer_minutes integer DEFAULT 0 NOT NULL,
    actual_task_started_at timestamp with time zone,
    assistant_start_delay_minutes integer DEFAULT 0 NOT NULL,
    delay_credit_minutes integer DEFAULT 0 NOT NULL,
    initiate_minutes integer DEFAULT 0 NOT NULL
);


--
-- Name: service_task_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.service_task_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    task_type_id uuid NOT NULL,
    allows_multi_stop boolean DEFAULT false NOT NULL,
    allows_custom_location boolean DEFAULT false NOT NULL,
    requires_customer_approval boolean DEFAULT false NOT NULL,
    requires_purchase_payment boolean DEFAULT false NOT NULL,
    proof_policy_id uuid,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    image_url text,
    priority integer DEFAULT 0 NOT NULL,
    is_recommended boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: settlements; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    customer_total numeric(12,2) DEFAULT 0 NOT NULL,
    assistant_earning_total numeric(12,2) DEFAULT 0 NOT NULL,
    platform_fee_total numeric(12,2) DEFAULT 0 NOT NULL,
    refund_total numeric(12,2) DEFAULT 0 NOT NULL,
    status_id uuid,
    settled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_request_id uuid
);


--
-- Name: sla_breach_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.sla_breach_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    breach_type_id uuid,
    threshold_seconds integer NOT NULL,
    actual_seconds integer NOT NULL,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: states; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    country_name text DEFAULT 'India'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: store_categories; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    image_url text,
    description text,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    service_id uuid,
    service_category_id uuid
);


--
-- Name: store_category_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_category_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_category_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: store_cluster_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_cluster_map (
    store_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: store_images; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    file_id uuid,
    image_url text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: store_keyword_map; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_keyword_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_keyword_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: store_keywords; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.store_keywords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    service_category_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid,
    store_code text,
    category_id uuid,
    phone text,
    operating_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_partner boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    name text,
    address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    description text,
    contact text,
    website text,
    priority integer DEFAULT 0 NOT NULL
);


--
-- Name: support_issues; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.support_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    opened_by_type text NOT NULL,
    opened_by_id uuid,
    status_code text DEFAULT 'open'::text NOT NULL,
    reason text NOT NULL,
    resolution text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: support_tickets; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number text NOT NULL,
    request_id uuid,
    customer_id uuid,
    assistant_id uuid,
    category_id uuid,
    priority_id uuid,
    status_id uuid,
    assigned_to_user_id uuid,
    subject text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);


--
-- Name: surge_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.surge_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    rule_type text DEFAULT 'time'::text NOT NULL,
    days text[] DEFAULT '{}'::text[] NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    adjustment_type text DEFAULT 'percent'::text NOT NULL,
    adjustment_value numeric(12,2) DEFAULT 0 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: task_assignments; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    assistant_id uuid NOT NULL,
    assignment_status_id uuid,
    assignment_type_id uuid,
    assigned_by_user_id uuid,
    reason_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    service_request_id uuid,
    status_code text DEFAULT 'offered'::text NOT NULL,
    offered_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
    reject_reason text,
    admin_reason text,
    created_by_user_id uuid,
    actual_started_at timestamp with time zone,
    start_delay_minutes integer DEFAULT 0 NOT NULL,
    delay_credit_minutes integer DEFAULT 0 NOT NULL
);


--
-- Name: task_events; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    assignment_id uuid,
    actor_type text NOT NULL,
    actor_id uuid,
    event_type text NOT NULL,
    notes text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_execution_sessions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_execution_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    assistant_id uuid NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    status_id uuid,
    timer_started_at timestamp with time zone,
    total_active_seconds integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: task_proofs; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    stop_id uuid,
    assistant_id uuid,
    proof_type_id uuid,
    file_id uuid,
    gps_latitude numeric(10,7),
    gps_longitude numeric(10,7),
    gps_location public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN ((gps_longitude IS NOT NULL) AND (gps_latitude IS NOT NULL)) THEN (public.st_setsrid(public.st_makepoint((gps_longitude)::double precision, (gps_latitude)::double precision), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    otp_verified boolean DEFAULT false NOT NULL,
    verified_by_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_stop_visits; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_stop_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    stop_id uuid NOT NULL,
    assistant_id uuid NOT NULL,
    reached_at timestamp with time zone,
    left_at timestamp with time zone,
    gps_verified boolean DEFAULT false NOT NULL,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: task_types; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status_id uuid,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_updates; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.task_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    stop_id uuid,
    assistant_id uuid,
    update_type_id uuid,
    message text,
    amount_requested numeric(12,2),
    requires_customer_action boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_master_rules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.tax_master_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tax_applicable_on text DEFAULT 'selling_price'::text NOT NULL,
    tax_applicability text DEFAULT 'exclusive'::text NOT NULL,
    tax_type text DEFAULT 'percent'::text NOT NULL,
    tax_value numeric(12,2) DEFAULT 0 NOT NULL,
    formula text DEFAULT '(Tax Applicable On Price x Tax Value / (100+tax value))'::text NOT NULL,
    tax_label text NOT NULL,
    tax_note text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: time_slot_masters; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.time_slot_masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: user_modules; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.user_modules (
    user_id uuid NOT NULL,
    module_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_permissions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.user_permissions (
    user_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_type text,
    scope_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    phone text,
    email public.citext,
    password_hash text,
    display_name text,
    avatar_file_id uuid,
    status_id uuid,
    last_login_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT users_phone_or_email_chk CHECK (((phone IS NOT NULL) OR (email IS NOT NULL)))
);


--
-- Name: vehicle_master; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.vehicle_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_name text NOT NULL,
    company text,
    vehicle_number text,
    model text,
    fuel_type text NOT NULL,
    color text,
    picture_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    owner_type text DEFAULT 'Own'::text NOT NULL,
    rental_company_name text,
    rental_company_address text,
    rental_company_number text,
    rent_slab text,
    rent_charges numeric(12,2),
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    zigo_slab text,
    zigo_charges numeric(12,2),
    cluster_id uuid
);


--
-- Name: wallet_ledger; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.wallet_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    request_id uuid,
    entry_type_id uuid,
    direction_id uuid,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    reference_type text,
    reference_id uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallets; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_type text NOT NULL,
    owner_id uuid NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    status_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_deliveries; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_endpoint_id uuid NOT NULL,
    outbox_event_id uuid,
    status_id uuid,
    attempt_count integer DEFAULT 0 NOT NULL,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_status integer,
    response_body text,
    next_retry_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_endpoints; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.webhook_endpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    api_client_id uuid,
    url text NOT NULL,
    subscribed_events text[] DEFAULT '{}'::text[] NOT NULL,
    secret_reference text,
    status_id uuid,
    retry_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_states; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.workflow_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: workflow_transitions; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.workflow_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    from_state_id uuid,
    to_state_id uuid NOT NULL,
    action_code text NOT NULL,
    actor_type_id uuid,
    requires_reason boolean DEFAULT false NOT NULL,
    requires_payment boolean DEFAULT false NOT NULL,
    requires_proof boolean DEFAULT false NOT NULL,
    rule_config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: workflows; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    entity_type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: zigo; Owner: -
--

CREATE TABLE zigo.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    status_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


--
-- Name: booking_invoice_email_jobs id; Type: DEFAULT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_invoice_email_jobs ALTER COLUMN id SET DEFAULT nextval('zigo.booking_invoice_email_jobs_id_seq'::regclass);


--
-- Name: booking_realtime_events id; Type: DEFAULT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_realtime_events ALTER COLUMN id SET DEFAULT nextval('zigo.booking_realtime_events_id_seq'::regclass);


--
-- Data for Name: admin_actions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.admin_actions (id, actor_user_id, entity_type, entity_id, action_type_id, reason_id, notes, before_data, after_data, created_at) FROM stdin;
\.


--
-- Data for Name: api_clients; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.api_clients (id, organization_id, name, client_key, status_id, allowed_scopes, rate_limit_config, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: app_config_values; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.app_config_values (id, config_key, scope_type, scope_id, value, is_secret, starts_at, ends_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.app_settings (id, key, value, description, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
1674c460-66ee-4e58-810b-ba12df09947b	media.image_save_path	/uploads/images	Base save path for image metadata	t	\N	2026-05-16 16:12:52.487775+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-06 23:19:16.652747+05:30	\N	\N	f
2aa25034-5aef-4d13-b7d0-92c2c8186ccd	booking.personal_assistant_cart_mix	{"personalAssistantServiceId":"c5398c5e-75f6-4b50-bd1d-9ffd4f1d9ba3","allowedWithMode":"all","allowedServiceIds":[]}	Personal Assistant service cart mixing rules	t	\N	2026-05-26 01:45:54.128398+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-06 23:19:16.653725+05:30	\N	\N	f
dfdeba0a-470e-49ce-9023-bc5f04312b73	media.document_save_path	/uploads/documents	Base save path for document metadata	t	\N	2026-05-16 16:12:52.487775+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-06 23:19:16.65798+05:30	\N	\N	f
46cf0912-bcf2-4452-8f1e-5bf10ec6b56a	booking.type_automation	{"maxReachMinutes":30,"freeSoonMinutes":15,"averageReachMinutes":20}	Instant automate reach and availability thresholds	t	\N	2026-05-27 00:14:50.708914+05:30	\N	2026-08-06 23:19:16.655705+05:30	\N	\N	f
7a4d1d75-3b8d-4c25-8b79-37fec7768c74	otp.providers	{"smsProviders":[{"id":"startmessaging","name":"StartMessaging","isActive":true,"method":"POST","url":"https://api.startmessaging.com/otp/send","headers":{"Content-Type":"application/json","X-API-Key":"sm_live_a098bcfd06ba3785e63e48e761734198bf1f4fdc"},"bodyTemplate":{"phoneNumber":"{{phoneNumber}}","templateId":"0afbdeb0-785d-4dd0-bd48-365a182df276","variables":{"otp":"{{otp}}","appName":"ZIGO","message":"ZIGO SMS Verification Code: {{otp}}"}},"successPath":"success","messageIdPath":"data.messageId","requestSample":{"phoneNumber":"+918899339136","templateId":"0afbdeb0-785d-4dd0-bd48-365a182df276","variables":{"otp":"123456","appName":"ZIGO"}},"responseSample":{"success":true,"statusCode":201,"data":{"status":"sent","phoneNumber":"+918899339136"}}}],"emailProviders":[{"id":"zigo-godaddy-smtp","name":"ZIGO GoDaddy SMTP","isActive":true,"host":"smtpout.secureserver.net","port":465,"secure":true,"user":"admin@zigonow.in","password":"Qwert!2345","from":"admin@zigonow.in","subjectTemplate":"ZIGO Email Verification Code","bodyTemplate":"ZIGO Email Verification Code: {{otp}}\\n\\nUse this 6 digit code to verify your ZIGO account. It expires in 10 minutes.","requestSample":{"to":"customer@example.com","subject":"ZIGO Email OTP","body":"ZIGO Email OTP: 123456"},"responseSample":{"status":"sent"}}]}	Dynamic OTP SMS API and email SMTP provider settings	t	\N	2026-05-29 18:02:31.625062+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-06 23:19:16.657825+05:30	\N	\N	f
60260862-5799-43b7-8cf6-159026d8f24d	booking.live_sync	{"isEnabled":true,"transport":"sse","refreshOnEvent":true,"playSound":true,"showBell":true,"showToast":true,"fallbackPollingEnabled":true,"fallbackPollingSeconds":60,"reconnectSeconds":5,"eventScope":"bookings"}	Booking live sync controls for Admin Panel realtime updates	t	\N	2026-05-31 15:21:23.822453+05:30	\N	2026-08-06 23:19:16.654149+05:30	\N	\N	f
cb12f46d-7d93-4289-90a2-2690db014acc	booking.engine	{"isEnabled":true,"orchestrationWorkerEnabled":true,"orchestrationIntervalSeconds":30,"batchSize":100,"businessModel":"managed_supply","riskLookaheadMinutes":20,"slaGraceMinutes":10,"manualAssignBeforeStartMinutes":15,"instantAutoMaxWaitMinutes":45,"defaultWaitWindowMinutes":0,"customerCancelInstantMinutes":5,"customerCancelScheduleMinutes":30,"customerAssistantDelayCancelOpenMinutes":1,"customerAssistantDelayAutoCancelMinutes":2,"capacityHoldMinutes":10,"paymentHoldMinutes":10,"assignmentAcceptanceTimeoutSeconds":120,"autoReassignEnabled":true,"autoReassignAfterSeconds":120,"allowManualInstantWhenNoSupply":true,"releaseCapacityOnPaymentFailure":true,"releaseCapacityOnCancel":true,"notifyOnRiskChange":true,"customerPortal":{"isEnabled":true,"shareUrlPath":"/customer","allowSelfRegistration":true,"loginWithMobileOtp":true,"allowBookService":true,"allowOnlinePayment":true,"allowLiveTracking":true,"allowTextUpdates":true,"allowImageUpdates":true,"allowVoiceUpdates":true,"linkExpiryMinutes":1440},"assistantPortal":{"isEnabled":true,"shareUrlPath":"/assistant","loginWithMobileOtp":true,"loginWithPassword":true,"allowGoOnline":true,"allowTaskExecution":true,"allowTextUpdates":true,"allowImageUpdates":true,"allowVoiceUpdates":true,"allowDailyReport":true,"requireClusterVehicleDocuments":true},"adminOverride":{"canBookForCustomer":true,"canAssignForAssistant":true,"canRespondForCustomer":true,"canRespondForAssistant":true,"canForceCompleteTask":true,"canSwitchInstantToSchedule":true,"overrideReasonRequired":true,"autoEscalateNoResponseMinutes":5},"communication":{"realtimeUpdatesEnabled":true,"customerNotifyOnAssignment":true,"customerNotifyOnDelay":true,"assistantNotifyOnAssignment":true,"adminNotifyOnNoResponse":true,"allowCustomerAssistantChat":true,"storeTaskMediaInTimeline":false},"hurdles":{"assistantOffline":{"enabled":true,"action":"auto_reassign","escalationMinutes":2},"previousTaskDelay":{"enabled":true,"action":"warn_then_reassign","escalationMinutes":5},"customerExtension":{"enabled":true,"action":"recalculate_supply","escalationMinutes":1},"waitingTimeExtend":{"enabled":true,"action":"recalculate_supply","escalationMinutes":0},"vehicleIssue":{"enabled":true,"action":"manual_dispatch","escalationMinutes":3},"locationIssue":{"enabled":true,"action":"manual_dispatch","escalationMinutes":3}}}	Booking engine SLA, demand, supply, capacity, hurdle, and business model controls	t	\N	2026-05-31 18:32:41.344285+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-06 23:44:45.943086+05:30	\N	\N	f
\.


--
-- Data for Name: approval_requests; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.approval_requests (id, request_id, task_update_id, requested_by_assistant_id, approval_type_id, title, description, amount, currency, status_id, expires_at, metadata, created_at, responded_at) FROM stdin;
\.


--
-- Data for Name: approval_responses; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.approval_responses (id, approval_request_id, customer_id, response_type_id, notes, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: assignment_policies; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assignment_policies (id, code, name, cluster_id, service_id, priority, is_active, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assignment_policy_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assignment_policy_rules (id, assignment_policy_id, rule_type_id, sort_order, is_required, condition, weight, created_at) FROM stdin;
\.


--
-- Data for Name: assignment_runs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assignment_runs (id, request_id, assignment_policy_id, run_type_id, status_id, started_at, ended_at, rule_snapshot, metadata) FROM stdin;
\.


--
-- Data for Name: assistant_availability; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_availability (id, assistant_id, availability_status_id, cluster_id, latitude, longitude, battery_percent, app_version, changed_at, metadata, status_code, capacity, updated_at, online_started_at, today_online_seconds, today_online_date, presence_status, work_status, availability_confidence, heartbeat_at, gps_captured_at, next_available_at, next_available_lat, next_available_lng, next_available_cluster_id, status_updated_at) FROM stdin;
\.


--
-- Data for Name: assistant_calendar_blocks; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_calendar_blocks (id, assistant_id, block_type, status_code, source_type, source_id, cluster_id, start_at, end_at, start_lat, start_lng, end_lat, end_lng, confidence, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assistant_capacity_reservations; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_capacity_reservations (id, service_request_id, assignment_id, assistant_id, cluster_id, booking_type, assign_type, status_code, reserved_from, reserved_until, promised_start_at, sla_deadline_at, source, metadata, created_by_user_id, created_at, updated_at, released_at, release_reason) FROM stdin;
\.


--
-- Data for Name: assistant_cluster_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_cluster_map (assistant_id, cluster_id, is_primary, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_delay_credits; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_delay_credits (id, service_request_id, task_assignment_id, assistant_id, planned_start_at, actual_started_at, delay_minutes, credited_minutes, source, metadata, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_document_verification_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_document_verification_events (id, assistant_document_id, assistant_id, document_type_id, old_status, new_status, remarks, actor_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_documents; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_documents (id, assistant_id, document_type_id, file_id, verification_status_id, verified_by_user_id, verified_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assistant_earnings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_earnings (id, assistant_id, request_id, earning_type_id, amount, currency, status_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_location_pings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_location_pings (id, assistant_id, request_id, latitude, longitude, accuracy_meters, captured_at, metadata, service_request_id, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_master_logs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_master_logs (id, assistant_id, action, entity_type, entity_id, details, actor_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_shift_plans; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_shift_plans (id, assistant_id, cluster_id, starts_at, ends_at, status_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_skill_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_skill_map (assistant_id, skill_id, proficiency_level, verified_at) FROM stdin;
\.


--
-- Data for Name: assistant_skills; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_skills (id, code, name, description, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_task_offers; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_task_offers (id, assignment_run_id, request_id, assistant_id, offer_status_id, offered_at, expires_at, responded_at, rejection_reason_id, metadata) FROM stdin;
\.


--
-- Data for Name: assistant_training_records; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_training_records (id, assistant_id, training_type_id, status_id, completed_at, score, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_vehicle_assignments; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_vehicle_assignments (id, assistant_id, vehicle_master_id, is_active, assigned_by, assigned_at, removed_by, removed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assistant_vehicle_damage_reports; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_vehicle_damage_reports (id, assistant_id, vehicle_master_id, vehicle_assignment_id, reason, proof_picture_urls, expense, paid_by, payment_proof_url, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_vehicle_documents; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_vehicle_documents (id, vehicle_id, document_type_id, file_id, verification_status, verified_by_user_id, verified_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: assistant_vehicles; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistant_vehicles (id, assistant_id, vehicle_type, registration_number, make, model, color, verification_status, metadata, created_at, updated_at, is_deleted, deleted_by, deleted_at) FROM stdin;
\.


--
-- Data for Name: assistants; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.assistants (id, user_id, assistant_code, status_id, verification_status_id, current_cluster_id, rating_avg, rating_count, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_billing_snapshots; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_billing_snapshots (id, service_request_id, base_price_paise, discount_paise, selling_price_paise, item_total_paise, tax_amount_paise, inclusive_tax_amount_paise, exclusive_tax_amount_paise, tip_amount_paise, waiting_charges_paise, grand_total_paise, currency, tax_details, pricing_details, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_engine_quick_replies; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_engine_quick_replies (id, scope_type, state_id, city_id, zone_id, cluster_id, category_id, actor, audience, booking_stage, action_type, title, message, sort_order, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
05d4bcfd-385a-4565-a697-12274a9e8ec2	all	\N	\N	\N	\N	\N	admin	customer	pending_assign	message	Pending Assignment	We'll assign you an assistant soon	1	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:24:35.694058+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:24:35.694058+05:30	\N	\N	f
7d69e851-881b-4e66-a122-4becf68629b9	all	\N	\N	\N	\N	\N	admin	customer	assigned	message	Assistant Assigned	We have assigned you a Professional Assistant	1	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:25:37.002009+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:25:37.002009+05:30	\N	\N	f
86f26c09-4189-4b74-9b79-24468c7b3574	all	\N	\N	\N	\N	\N	admin	customer	cancelled	message	Booking Cancelled	As per our do and donts for a category that you have selected, we are going to cancel your booking	1	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:28:41.072112+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:28:41.072112+05:30	\N	\N	f
18a257e7-4609-478f-880e-96e9ab0f7408	all	\N	\N	\N	\N	\N	assistant	customer	working	message	Start Working	I'm start working	1	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:29:40.403808+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:29:40.403808+05:30	\N	\N	f
c11200dc-af3a-43a0-a311-11df762ab9d1	all	\N	\N	\N	\N	\N	customer	assistant	hold	message	Task on Hold	Keep hold my task	1	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:30:35.329526+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:30:35.329526+05:30	\N	\N	f
a4fdf7b7-2acf-48c2-afa3-5dc8b441eeb1	all	\N	\N	\N	\N	\N	admin	customer	cancelled	cancel	Assistant unable to start work	Your task has been cancelled due to the assigned assistant's unavailability. We sincerely apologize for the inconvenience.	2	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-19 10:34:11.260548+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-19 10:34:11.260548+05:30	\N	\N	f
a4640971-2dd2-4470-9ace-181b77f7fb07	all	\N	\N	\N	\N	\N	customer	admin	cancelled	cancel	Customer cancel the booking	Booking has been cancelled	0	{}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-19 11:10:12.187222+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-19 11:10:12.187222+05:30	\N	\N	f
\.


--
-- Data for Name: booking_engine_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_engine_rules (id, scope_type, state_id, city_id, zone_id, cluster_id, category_id, service_control_mode, manual_service_status, auto_start_at, auto_end_at, instant_eta_minutes, instant_wrap_up_minutes, instant_travel_minutes, schedule_eta_minutes, schedule_wrap_up_minutes, schedule_travel_minutes, assistant_assignment_mode, note, image_url, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, auto_start_time, auto_end_time, instant_initiate_minutes, schedule_initiate_minutes) FROM stdin;
e38367dd-6470-40dc-a81d-a907596a5a73	city	\N	8071a1a7-dc7f-41dd-9a70-f42e1d175c25	\N	\N	\N	auto	stop	2026-07-02 08:00:00+05:30	2026-08-31 23:00:00+05:30	20	5	10	30	5	10	manual	Service Start soon	/uploads/images/ZIGO-Post-Home-Help-1782984780405.png	{"note": "Service Start soon", "instant": {"etaMinutes": 20, "bookingWrapUpMinutes": 5, "travelTimeToReachMinutes": 10}, "imageUrl": "/uploads/images/ZIGO-Post-Home-Help-1782984780405.png", "schedule": {"etaMinutes": 30, "bookingWrapUpMinutes": 5, "travelTimeToReachMinutes": 10}, "serviceCalendar": {"mode": "auto", "autoEndAt": "2026-08-31T23:00", "autoStartAt": "2026-07-02T08:00", "manualStatus": "stop"}, "assistantAssignment": {"mode": "manual", "autoNote": "Booking confirmed and assistant assigned as per availability.", "manualNote": "Booking confirmed and assistant assigned manually by admin."}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 15:03:02.627596+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:20:14.661423+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:20:14.661423+05:30	t	\N	\N	0	0
9cadeaee-0830-4434-af96-0544d811dd08	all	\N	\N	\N	\N	\N	manual	start	\N	\N	10	5	0	10	5	0	manual	Book your PersonalAssistant	/uploads/images/ZIGO-Post-Urgent-Help-1783000354838.png	{"note": "Book your PersonalAssistant", "instant": {"etaMinutes": 10, "initiateMinutes": 5, "bookingWrapUpMinutes": 5, "travelTimeToReachMinutes": 0}, "imageUrl": "/uploads/images/ZIGO-Post-Urgent-Help-1783000354838.png", "schedule": {"etaMinutes": 10, "initiateMinutes": 5, "bookingWrapUpMinutes": 5, "travelTimeToReachMinutes": 0}, "serviceCalendar": {"mode": "manual", "autoEndAt": null, "autoEndTime": null, "autoStartAt": null, "manualStatus": "start", "autoStartTime": null}, "assistantAssignment": {"mode": "manual", "autoNote": "Booking confirmed and assistant assigned as per availability.", "manualNote": "Booking confirmed and assistant assigned manually by admin."}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-02 19:22:36.195469+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-04 10:39:59.092367+05:30	\N	\N	f	\N	\N	5	5
\.


--
-- Data for Name: booking_invoice_email_jobs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_invoice_email_jobs (id, booking_id, customer_user_id, status, attempt_count, next_attempt_at, locked_at, sent_at, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_orchestration_state; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_orchestration_state (service_request_id, cluster_id, demand_status, risk_status, supply_status, booking_type, assign_type, requested_start_at, promised_start_at, sla_deadline_at, assistant_id, reservation_id, next_check_at, last_event_type, metadata, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_realtime_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_realtime_events (id, event_type, booking_id, tab, message, payload, created_at, assistant_id, cluster_id) FROM stdin;
\.


--
-- Data for Name: booking_reviews; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_reviews (id, service_request_id, customer_user_id, assistant_id, zigo_rating, assistant_rating, service_rating, review_text, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_route_sessions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_route_sessions (id, service_request_id, task_assignment_id, assistant_id, status_code, started_at, stopped_at, last_seen_at, last_latitude, last_longitude, last_accuracy_meters, last_eta_minutes, last_ping_id, route_legs, route_progress, tracking_source, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_task_update_reads; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_task_update_reads (update_id, user_id, actor_type, read_at) FROM stdin;
\.


--
-- Data for Name: booking_task_updates; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_task_updates (id, service_request_id, task_assignment_id, actor_user_id, actor_type, update_type, message, media_urls, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: booking_type_masters; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.booking_type_masters (id, code, name, booking_type, config, is_default, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
3368cf9a-a417-40f1-b398-8916b178552b	INST001	Instant	instant	{"timeSlots": [], "allowedDays": [], "maxAdvanceDays": 0}	f	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-26 23:43:24.285459+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-26 23:43:24.285459+05:30	\N	\N	f
9807a21d-b172-4960-a512-3387da02b67a	SCH001	Schedule	schedule	{"timeSlots": ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"], "allowedDays": ["today", "tomorrow", "next_2", "next_3", "next_4", "next_5", "next_6", "next_7", "next_8"], "instantMode": "manual", "maxAdvanceDays": 8, "timeCategories": [{"id": "morning", "name": "Morning", "isActive": true, "sortOrder": 1, "timeSlots": ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]}, {"id": "afternoon", "name": "Afternoon", "isActive": true, "sortOrder": 2, "timeSlots": ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]}, {"id": "evening", "name": "Evening", "isActive": true, "sortOrder": 3, "timeSlots": ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"]}, {"id": "night", "name": "Night", "isActive": true, "sortOrder": 4, "timeSlots": ["20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"]}], "waitWindowNote": "", "waitWindowMinutes": 0}	f	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-26 23:43:13.22425+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 22:04:33.349893+05:30	\N	\N	f
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.categories (id, parent_category_id, code, name, description, status_id, sort_order, config, created_at, updated_at, service_id, created_by, updated_by, deleted_by, deleted_at, is_deleted, is_active, image_url, priority, is_recommended, is_enabled) FROM stdin;
42655d16-ff67-4127-aece-188875f104d7	\N	001	Buy & Bring	We'll buy for you	\N	1	{}	2026-05-15 18:16:15.99963+05:30	2026-05-16 16:19:58.395463+05:30	\N	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 16:19:58.395463+05:30	t	f	\N	0	f	t
dd493994-a7b4-45d2-901c-ba1ae05a19b3	\N	002	Wait & Queue	Wait for you in a queue	\N	1	{}	2026-05-15 18:17:09.54513+05:30	2026-05-16 16:20:02.045113+05:30	\N	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 16:20:02.045113+05:30	t	f	\N	0	f	t
de52d3a1-7745-4423-8230-c9f1208be094	\N	C001	Medicine	\N	\N	2	{}	2026-05-16 16:22:24.295304+05:30	2026-05-16 17:04:28.853859+05:30	bb61a52e-af7e-485a-bf75-d371f889ed89	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/8cc38a79-68a7-46bf-97e8-d0424aff0238-1778931246011.png	2	t	t
504100dc-21ec-4fba-80be-4c5680ff6293	\N	C002	Food	\N	\N	1	{}	2026-05-16 16:22:43.554178+05:30	2026-05-16 17:11:04.630809+05:30	bb61a52e-af7e-485a-bf75-d371f889ed89	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/food-1778931655507.png	1	f	t
79a611a4-6bc6-4a83-8388-307a7984555c	\N	C003	Baby Care	\N	\N	3	{}	2026-05-16 17:14:48.772212+05:30	2026-05-16 17:14:57.899345+05:30	bb61a52e-af7e-485a-bf75-d371f889ed89	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/baby_care-1778931887300.png	3	f	t
20b75169-9d58-40d5-8f05-08f16e638c15	\N	CLTHEX001	Clothes Exchange	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-05-25 20:11:07.511102+05:30	2026-06-15 18:37:12.545607+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 18:37:12.545607+05:30	t	f	/uploads/images/download-5-1779720064745.jpg	0	f	t
4e1061c3-c072-4bc8-9d6e-afccc9ea6750	\N	COUDIS001	Courier Dispatch	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-05-25 20:14:19.925798+05:30	2026-06-15 18:37:16.779524+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 18:37:16.779524+05:30	t	f	/uploads/images/images-1-1779720258188.jpg	0	f	t
5e778120-836c-4ee6-b2f0-9315b486a47e	\N	PRDRTN001	Product Return	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-05-25 20:12:20.974519+05:30	2026-06-15 18:37:20.975881+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 18:37:20.975881+05:30	t	f	/uploads/images/download-6-1779720138913.jpg	0	f	t
c23c70fb-068b-4c2a-85e2-417c1082f7f4	\N	SCQ001	School & College Queue	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-05-24 19:39:20.497703+05:30	2026-06-15 18:37:25.226722+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 18:37:25.226722+05:30	t	f	/uploads/images/images-1779631757832.jpg	0	f	t
a0807a1b-ade5-492f-b3b8-8cd3b5881ba4	\N	WQHQ001	Hospital Queue	\N	\N	1	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-05-24 19:36:10.822863+05:30	2026-06-15 18:37:39.823029+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 18:37:39.823029+05:30	t	f	/uploads/images/nurse-talking-patient-girl-coronavirus-vaccination-hospital-covid-black-male-vac-1779631562655.webp	1	f	t
91c84110-8bf5-48a9-b6a3-c9c4924d9a82	\N	ECR	E-commerce Returns	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 18:56:32.463517+05:30	2026-06-15 18:56:32.463517+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
7b956bd8-69b7-446c-aaee-4273f30313a3	\N	CE	Clothing Exchange	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 18:58:48.490499+05:30	2026-06-15 18:58:48.490499+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
eef0a395-1bd3-4395-917d-2c0015f0a1a1	\N	CPH	Courier & Parcel Help	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 18:59:16.25499+05:30	2026-06-15 18:59:16.25499+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
b056612a-f65f-4fad-923c-1f38454f4469	\N	SCV	Service Centre Visit	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:04:58.11655+05:30	2026-06-15 19:04:58.11655+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
e6f8ff42-df63-4bf5-9d46-1755803f50ff	\N	LDCH	Laundry & Dry Cleaning Help	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:51:59.236776+05:30	2026-06-15 19:51:59.236776+05:30	b8af3437-b5be-4de9-906d-fb15a1204ab2	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
f34f8518-d8e5-4cab-870e-35ef6bba0356	\N	GOQ	Govt Office Queue	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:53:27.790866+05:30	2026-06-15 19:53:27.790866+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
102f4005-20fe-41ec-aec4-dd91879c7986	\N	HDQ	Hospital & Diagnostic Queue	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:54:17.176708+05:30	2026-06-15 19:54:17.176708+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
bef41855-263f-446b-af8d-b273dff065f3	\N	SCQ	School & College Queue	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:54:53.059449+05:30	2026-06-15 19:54:53.059449+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
7acd9ebb-b397-404f-b5cf-2ac537b0db34	\N	USQ	Utility & Service Queue	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:55:14.823957+05:30	2026-06-15 19:55:14.823957+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
3b7e4394-b029-4338-a370-5c82d941ae87	\N	HPQ	Home Presence Assistance	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-15 19:55:34.904281+05:30	2026-06-15 19:55:34.904281+05:30	ece963f6-5b99-4f44-9722-88b10bfeb641	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
dac9f113-122f-48a9-827a-cad540a40696	\N	SE	Small Essentials	Keys, Charger, Wallet, Documents	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:47:35.340121+05:30	2026-06-16 10:47:35.340121+05:30	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
93ca55fe-2c31-4607-ae75-c81406098ce7	\N	PI	Personal Items	Lunch Box, Water Bottle, Clothes, Shoes	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:48:24.875798+05:30	2026-06-16 10:48:24.875798+05:30	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
10d51866-0f30-4803-a566-9593b98fe168	\N	UE	Urgent Essentials	Medicine, Passport, Important Documents	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:49:25.931435+05:30	2026-06-16 10:49:25.931435+05:30	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
0cb70531-d24c-4519-af52-a3e54088f56e	\N	OVA	OPD Visit Assistance	Token, registration, doctor queue, billing	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:50:38.212551+05:30	2026-06-16 10:50:38.212551+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
d3d3c307-1580-498a-8ecf-7b4e9568abde	\N	ADH	Admission or Discharge Help	Formalities, billing coordination, document movement	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:51:42.915527+05:30	2026-06-16 10:51:42.915527+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
cb45fd6c-02a8-40a9-bd41-f79b69712bf2	\N	DC	Diagnostic Coordination	Test booking, sample coordination, report collection	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:52:35.691337+05:30	2026-06-16 10:52:35.691337+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
bd620e09-b655-4336-9ac5-c9c63bc2bab1	\N	MRM	Medicine Refill Management	Prescription based refill pickup	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:54:43.164491+05:30	2026-06-16 10:54:43.164491+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
ac6954e3-5558-4f5f-a57a-1b321c89de19	\N	EHC	Elderly Hospital Companion	Accompany elderly during visit	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:55:42.837695+05:30	2026-06-16 10:55:42.837695+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
1cdbbf63-2985-4340-8758-f6aae31b5fda	\N	ACC	Ambulance & Care Coordination	Coordination only, not medical responsibility	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:56:18.806958+05:30	2026-06-16 10:56:18.806958+05:30	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	\N	0	f	t
9dc62332-770e-424b-ba09-5856eb7cf5d7	\N	OE	Office Essentials	Laptop, Bag, Files, Hard Disk	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}	2026-06-16 10:48:59.095428+05:30	2026-06-19 18:50:59.93673+05:30	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/images-1-1781875257365.jpg	0	f	t
85ea3c90-08de-4d1b-ace3-c35dc98716ea	\N	HOUSE	House	Everything your home needs/Someone trusted can be at your home when you can't. 	\N	3	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "current", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "7c066275-eed7-43ce-8ce3-27b7b4ee5e52", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 1, "addWithOtherCategory": false}}	2026-06-29 12:14:55.324125+05:30	2026-07-17 21:32:30.916537+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jun-29-2026-12_20_10-PM-1782720958939.png	3	f	t
2d44ff66-5392-4b4c-bfe6-c367d69250c7	\N	PERSONAL	Personal	For your own everyday needs.	\N	1	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Personal Tasks", "Shopping Assistance", "Buy & Bring", "Appointments", "Queue Standing", "Returns & Exchange", "Document Collection", "Personal Errands", "Tailor & Laundry", "Gifts & Surprises", "Pay Bills", "Anything you need done"], "canDoList": ["Complete personal tasks and errands", "Buy and bring items from nearby stores", "Assist with shopping", "Stand in queues on your behalf", "Attend appointments with or for you", "Collect or submit documents", "Pick up or drop off items", "Coordinate with shops, vendors or service providers", "Handle returns and exchanges", "Pay utility bills using your provided payment method", "Help with tailor, laundry and gift-related tasks"], "canDoTitle": "What Assistant can do", "cantDoList": ["Perform illegal or unsafe activities", "Share or use your passwords, PINs or OTPs", "Sign legal or financial documents on your behalf", "Accept tasks that put the assistant or others at risk", "Make personal, financial or legal decisions for you", "Purchase age-restricted or prohibited items where not legally permitted", "Carry or transport illegal, dangerous or restricted goods", "Handle large amounts of cash without prior approval from ZIGO", "Perform professional services that require a licensed expert"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "For your own everyday needs."}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "7c066275-eed7-43ce-8ce3-27b7b4ee5e52", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 4, "addWithOtherCategory": false}}	2026-06-29 12:11:24.862878+05:30	2026-07-17 21:32:10.540941+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jun-29-2026-12_10_29-PM-1782720941858.png	1	f	t
051b620d-2153-48dc-929e-861348c8f8e1	\N	URGENT	Urgent Help	For situations that can't wait.	\N	7	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "multi", "expandDuration": null, "expandPriority": 0, "expandDescription": null, "maxLocationsLimit": 2, "addWithOtherCategory": false}}	2026-06-29 15:36:18.537589+05:30	2026-07-17 21:32:59.034024+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 21:32:59.034024+05:30	t	f	/uploads/images/Urgent-1783600823085.png	7	f	t
b16740fb-e2d7-4651-9cc5-17948eb9ddf5	\N	SHOPPING	Shopping	\N	\N	9	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/ChatGPT-Image-Jul-18-2026-02_40_16-AM-1784322950710.png"], "expandTitle": null, "locationMode": "current", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "b7c731d6-1d1e-46f0-9b1f-34bfe628ef97", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 1, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false}}	2026-07-18 02:43:54.574028+05:30	2026-07-18 02:45:56.1448+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jul-18-2026-02_40_16-AM-1784322950710.png	9	f	t
20ad6908-8e5e-4fc4-9e15-71b4eac1e631	\N	TELLUS		Simply describe your requirement. If it's safe, legal and practical, ZIGO will assign a trained, verified and reliable Personal Assistant to help you. There are no fixed service limits. If your task can be completed responsibly, we'll do our best to help.	\N	9	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Decorate your home before an event", "Assist during house shifting", "Vehicle pickup for servicing and return", "Purchase event tickets", "Assist at exhibitions or trade fairs", "Photography assistant during an event", "Deliver invitation cards", "Help with donation drop-offs", "Coordinate with decorators, caterers or photographers", "Purchase flowers or decorations for an event", "Packing & Unpacking Assistance", "Exhibition & Event Support", "Any Safe, Legal & Practical Custom Task"], "canDoList": ["Complete custom tasks that don't fit any other ZIGO service category", "Visit locations and complete tasks on your behalf", "Coordinate with people, vendors, offices or service providers", "Buy, collect, deliver or return permitted items", "Assist with planning, organization and task coordination", "Share live updates, photos or videos during the task (when requested)", "Adapt to your specific instructions for safe and practical tasks", "Keep you informed until the task is completed"], "canDoTitle": "What Assistant can do", "cantDoList": ["Perform illegal, unsafe, unethical or fraudulent activities", "Impersonate you or misuse your identity", "Sign legal, financial, medical or official documents on your behalf", "Handle passwords, PINs, OTPs, biometric verification or confidential credentials", "Provide medical, legal, financial or professional advice", "Carry prohibited, hazardous or dangerous items", "Perform licensed or regulated professional services", "Handle large amounts of cash or valuables outside ZIGO's approved policy", "Accept tasks that may put anyone's safety, privacy or property at risk", "Accept any request that violates ZIGO's policies or applicable laws"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/ChatGPT-Image-Jul-18-2026-02_54_38-AM-1784324306671.png"], "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "c75e980b-3bb2-4a82-9dec-d47916b836f5", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 3, "categoryImageWidth": 500, "categoryImageHeight": 100, "addWithOtherCategory": false, "supplyUnavailableAction": "", "supplyUnavailableMessage": null}}	2026-07-09 15:48:03.55504+05:30	2026-08-04 17:39:38.111223+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jul-18-2026-02_54_38-AM-1784324306671.png	9	f	t
632d0613-3f5c-4b14-ad84-98872cf91788	\N	ELDER	Elder Care	Support for your elderly loved ones when you can't be there.	\N	5	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Elder Companion", "Senior Citizen Assistance", "Medical Appointment Assistance", "Hospital Visits", "Medicine Collection", "Health Check-up Support", "Grocery & Essential Shopping", "Home Visits & Well-being Checks", "Caregiver Coordination"], "canDoList": ["Accompany senior citizens to hospitals, clinics, or appointments", "Provide companionship during hospital visits or at home", "Collect medicines, prescriptions, and medical reports", "Assist with grocery and essential shopping", "Coordinate with family members, caregivers, and healthcare providers", "Visit elderly family members on your behalf and share updates", "Help with simple day-to-day errands and local tasks", "Assist with bill payments, document submissions, or bank visits (as per ZIGO policy)", "Offer friendly companionship and emotional support during scheduled visits", "Keep you informed throughout the task"], "canDoTitle": "What Assistant can do", "cantDoList": ["Provide medical treatment, nursing care, or physiotherapy", "Administer medicines, injections, or medical procedures", "Lift or physically assist individuals requiring professional caregiving", "Handle medical emergencies requiring ambulance or emergency services", "Make medical, legal, or financial decisions on behalf of the customer", "Sign hospital, legal, or financial documents", "Handle confidential passwords, PINs, OTPs, or banking credentials", "Stay overnight or provide continuous caregiving services"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "multi", "expandDuration": null, "expandPriority": 0, "serviceMasterId": "b7c731d6-1d1e-46f0-9b1f-34bfe628ef97", "expandDescription": null, "maxLocationsLimit": 3, "addWithOtherCategory": false}}	2026-07-09 15:15:04.74297+05:30	2026-07-17 18:59:33.528024+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jun-29-2026-12_13_13-PM-1783590397464.png	5	f	t
f83a01d5-b704-4fd5-964b-f977bca2ac7a	\N	HEALTH	Health Care	Support for your health needs when you need someone by your side.	\N	4	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Medical Appointments", "Hospital Companion", "Medicine Collection", "Medical Test Assistance", "Lab Report Collection", "Health Check-up Support", "Diagnostic Center Visits", "Pharmacy Assistance", "Care Coordination"], "canDoList": ["Accompany you to hospitals, clinics or diagnostic centers", "Assist during medical appointments and help with coordination", "Collect prescribed medicines from pharmacies", "Collect medical reports, lab results or diagnostic documents", "Help schedule, reschedule or coordinate medical appointments", "Assist with hospital admissions, discharge formalities and non-medical coordination", "Wait in queues at hospitals, clinics or pharmacies on your behalf (where permitted)", "Coordinate with doctors' reception, hospital staff or caregivers for updates", "Help with basic non-medical support during your visit", "Keep you informed throughout the task"], "canDoTitle": "What Assistant can do", "cantDoList": ["Provide medical advice, diagnosis or treatment", "Administer medicines, injections or perform any medical procedure", "Replace doctors, nurses or licensed healthcare professionals", "Make medical, legal or financial decisions on your behalf", "Handle medical emergencies requiring an ambulance or emergency services", "Sign hospital, insurance or legal documents on your behalf", "Handle confidential passwords, PINs or OTPs", "Carry or transport controlled medicines or prohibited medical substances", "Accept unsafe, illegal or unethical requests"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "b7c731d6-1d1e-46f0-9b1f-34bfe628ef97", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 3, "addWithOtherCategory": false}}	2026-07-09 13:25:29.227544+05:30	2026-07-17 21:31:48.137882+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/Health-1783589809466.png	4	f	t
e1ecf3c4-053f-4a08-b1fc-30f2d0ed53a9	\N	BETHERE	Be There	When your physical presence is needed. / When you can't be there, your ZIGO Assistant can. 	\N	8	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/ChatGPT-Image-Jul-9-2026-03_59_27-PM-1783593000390.png", "/uploads/images/Family-1784318914361.png", "/uploads/images/Health-1784318921886.png"], "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "db4b6b37-56f0-4447-98ea-5c4e985dd510", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 2, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false}}	2026-06-29 14:42:10.062541+05:30	2026-07-18 02:02:40.892878+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jul-9-2026-03_59_27-PM-1783593000390.png	8	f	t
b59608b9-698b-4ccf-8702-23476bf7a673	\N	BUSINESS	Business	Support for your work and business.	\N	6	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Site visits", "Vendor coordination", "Business Verification", "Office errands", "Business representation", "Document Submission", "Cash Deposit", "Inventory Checks", "Local Business Support"], "canDoList": ["Visit offices, stores, warehouses or business locations on your behalf", "Coordinate with vendors, suppliers, clients or service providers", "Submit or collect business documents", "Conduct site visits and provide updates with photos or videos", "Perform business verification and collect factual information", "Deliver or collect business-related items or documents", "Assist with inventory checks and stock verification", "Deposit cash or cheques within ZIGO's approved policy", "Represent you professionally during meetings, appointments or inspections", "Keep you informed throughout the task"], "canDoTitle": "What Assistant can do", "cantDoList": ["Make business, financial or legal decisions on your behalf", "Sign contracts, agreements, invoices or legal documents", "Negotiate commercial deals or pricing without your authorization", "Handle confidential company information beyond the assigned task", "Accept or collect payments from customers unless specifically approved by ZIGO", "Carry prohibited items or large amounts of cash outside ZIGO's policy", "Perform professional services that require a licensed expert", "Accept illegal, unsafe or unethical requests", "Misrepresent themselves as your employee or authorized signatory"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Support for your work and business."}, "categorySettings": {"note": null, "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "db4b6b37-56f0-4447-98ea-5c4e985dd510", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 2, "addWithOtherCategory": false}}	2026-06-29 12:56:44.588424+05:30	2026-07-17 21:32:50.5136+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/Business-1783592869964.png	6	f	t
adce9afb-4a02-428d-8abb-eece2b5f0f54	\N	SHOPPING_2	Shopping	\N	\N	10	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/ChatGPT-Image-Jul-18-2026-02_34_08-AM-1784322991624.png", "/uploads/images/ChatGPT-Image-Jul-18-2026-02_40_16-AM-1784322994972.png"], "expandTitle": null, "locationMode": "current", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "db4b6b37-56f0-4447-98ea-5c4e985dd510", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 1, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false}}	2026-07-18 02:46:37.727938+05:30	2026-07-18 02:46:37.727938+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/ChatGPT-Image-Jul-18-2026-02_34_08-AM-1784322991624.png	10	f	t
bd9ca2ac-140d-479b-a58c-4418f52401fb	\N	FAMILY	Family	Support for your family and loved ones when you can't be there.	\N	2	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": ["Parents Assistance", "Elder Support", "Child Assistance", "Hospital Companion", "Medicine Collection", "Family Coordination", "Appointment Assistance", "Emergency Family Support"], "canDoList": ["Accompany parents or family members to appointments", "Assist senior citizens with everyday support", "Provide companionship during hospital or clinic visits", "Collect prescribed medicines, reports or medical documents", "Coordinate appointments with hospitals, clinics or service providers", "Visit your family member on your behalf and share updates", "Help with small day-to-day family errands", "Assist children with safe pickup, drop or supervision as per ZIGO's policy", "Coordinate with caregivers, relatives or hospital staff", "Keep you informed throughout the task"], "canDoTitle": "What Assistant can do", "cantDoList": ["Provide medical treatment or nursing care", "Administer medicines, injections or medical procedures", "Make medical, legal or financial decisions on your behalf", "Babysit children without a responsible guardian's authorization or beyond ZIGO's policy", "Handle emergencies requiring police, ambulance or fire services", "Sign hospital, legal or financial documents on your behalf", "Handle confidential passwords, PINs or OTPs", "Accept unsafe, illegal or unethical requests"], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Support for your family and loved ones when you can't be there."}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/Family-1784310846237.png", "/uploads/images/Be-there-1784318838277.png", "/uploads/images/Urgent-1784318847385.png"], "expandTitle": null, "locationMode": "multi", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "b7c731d6-1d1e-46f0-9b1f-34bfe628ef97", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 2, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false}}	2026-06-29 12:13:23.372465+05:30	2026-07-18 02:02:11.375166+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/Family-1784310846237.png	2	f	t
4882767a-2b75-443d-a85a-b48e16d3e597	\N	BE_THERE	Be There	\N	\N	10	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/Be-there-1784323167201.png"], "expandTitle": null, "locationMode": "current", "priceGridRows": 3, "expandDuration": null, "expandPriority": 0, "showInHomePage": true, "homeDisplayMode": "category", "serviceMasterId": "7c066275-eed7-43ce-8ce3-27b7b4ee5e52", "priceDisplayMode": "row", "priceGridColumns": 3, "expandDescription": null, "maxLocationsLimit": 1, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false}}	2026-07-18 02:49:31.566151+05:30	2026-07-18 02:49:31.566151+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/Be-there-1784323167201.png	10	f	t
c1a6c53e-adf5-4451-a996-6cc4ff5fe012	\N	BOOK_YOUR_TRUSTED_ASSISTANT	Urgent Help	\N	\N	0	{"pricing": {"basePrice": 0, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "discountLabel": null, "discountValue": 0, "additionalCharges": 0}, "categoryGuidance": {"taskList": [], "canDoList": [], "canDoTitle": "What Assistant can do", "cantDoList": [], "cantDoTitle": "What Assistant can't do", "taskListTitle": "Tasks related to category"}, "categorySettings": {"note": null, "imageUrls": ["/uploads/images/flash-3d-icon-png-download-11597500-1785610429823.webp"], "expandTitle": null, "locationMode": "multi", "priceGridRows": 4, "expandDuration": null, "expandPriority": 0, "showInHomePage": false, "homeDisplayMode": "categoryPrice", "serviceMasterId": "9f87f4c1-9905-4934-8b03-62850e769bbc", "priceDisplayMode": "row", "priceGridColumns": 4, "expandDescription": null, "maxLocationsLimit": 3, "categoryImageWidth": 0, "categoryImageHeight": 0, "addWithOtherCategory": false, "supplyUnavailableAction": "redirect_schedule", "supplyUnavailableMessage": null}}	2026-07-17 20:03:55.751361+05:30	2026-08-04 00:00:37.494025+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	t	/uploads/images/flash-3d-icon-png-download-11597500-1785610429823.webp	0	f	t
\.


--
-- Data for Name: category_price_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.category_price_rules (id, scope_type, state_id, city_id, zone_id, cluster_id, category_id, time_duration_minutes, base_price, discount_type, discount_value, selling_price, waiting_charge_amount, waiting_charge_time_minutes, slab, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, available_for_duration, available_for_extend, available_for_expand, is_enabled, is_duration_for_offers, is_offer_eligible) FROM stdin;
dbaf524a-9c7c-4be5-9e00-dacba6c04984	all	\N	\N	\N	\N	c1a6c53e-adf5-4451-a996-6cc4ff5fe012	60	199.00	flat	50.00	149.00	0.00	0	{"label": "1 hr", "basePrice": 199, "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "availableForExpand": true, "availableForExtend": false, "timeDurationMinutes": 60, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "1 hr", "availableFor": {"expand": true, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 20:05:43.954205+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.661783+05:30	\N	\N	f	t	f	t	t	f	t
0bd1398a-614c-41dd-93fa-76a754084438	all	\N	\N	\N	\N	c1a6c53e-adf5-4451-a996-6cc4ff5fe012	90	249.00	flat	50.00	199.00	0.00	0	{"label": "1.5 hrs", "basePrice": 249, "discountType": "flat", "sellingPrice": 199, "discountValue": 50, "availableForExpand": true, "availableForExtend": false, "timeDurationMinutes": 90, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "1.5 hrs", "availableFor": {"expand": true, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 20:05:43.976723+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.685753+05:30	\N	\N	f	t	f	t	t	f	t
25948e78-debc-485e-82dc-a59899ded237	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	2	10.00	flat	5.00	5.00	0.00	0	{"label": "2 min", "basePrice": 10, "discountType": "flat", "sellingPrice": 5, "discountValue": 5, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 2, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "2 min", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-06 09:12:20.947337+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.689552+05:30	\N	\N	f	t	f	f	t	f	t
5e2347c7-5a09-496f-837a-e16e1bfb6bf0	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	30	99.00	flat	50.00	49.00	0.00	0	{"label": "30 mins", "basePrice": 99, "discountType": "flat", "sellingPrice": 49, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 30, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "30 mins", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:18.966965+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.709904+05:30	\N	\N	f	t	f	f	t	f	t
6a5bf54a-e352-4694-aebb-535462ab12d1	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	60	149.00	flat	50.00	99.00	0.00	0	{"label": "1 hr", "basePrice": 149, "discountType": "flat", "sellingPrice": 99, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 60, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "1 hr", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.007766+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.731542+05:30	\N	\N	f	t	f	f	t	f	t
de687cca-cae1-44f0-84fe-7d1edc4ed62a	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	90	199.00	flat	50.00	149.00	0.00	0	{"label": "1.5 hrs", "basePrice": 199, "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 90, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "1.5 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.025369+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.755425+05:30	\N	\N	f	t	f	f	t	f	t
b99e1a6a-0e2c-4511-914a-7b11e972dd48	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	120	249.00	flat	50.00	199.00	0.00	0	{"label": "2 hrs", "basePrice": 249, "discountType": "flat", "sellingPrice": 199, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 120, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "2 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.041684+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.779401+05:30	\N	\N	f	t	f	f	t	f	t
e0338419-eeea-4c1f-b47f-4a0b47cf1403	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	150	299.00	flat	50.00	249.00	0.00	0	{"label": "2.5 hrs", "basePrice": 299, "discountType": "flat", "sellingPrice": 249, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 150, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "2.5 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.056529+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.801734+05:30	\N	\N	f	t	f	f	t	f	t
d724e331-fcac-40bd-8c9d-b088bcdf7d97	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	180	349.00	flat	50.00	299.00	0.00	0	{"label": "3 hrs", "basePrice": 349, "discountType": "flat", "sellingPrice": 299, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 180, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "3 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.069704+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.823623+05:30	\N	\N	f	t	f	f	t	f	t
1397df49-7fdc-41cb-9d19-ae811d73a7eb	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	210	399.00	flat	50.00	349.00	0.00	0	{"label": "3.5 hrs", "basePrice": 399, "discountType": "flat", "sellingPrice": 349, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 210, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "3.5 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.086803+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.878612+05:30	\N	\N	f	t	f	f	t	f	t
ba9c7256-209e-4583-a433-6058870d0e04	all	\N	\N	\N	\N	2d44ff66-5392-4b4c-bfe6-c367d69250c7	240	449.00	flat	50.00	399.00	0.00	0	{"label": "4 hrs", "basePrice": 449, "discountType": "flat", "sellingPrice": 399, "discountValue": 50, "availableForExpand": false, "availableForExtend": false, "timeDurationMinutes": 240, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "4 hrs", "availableFor": {"expand": false, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-01 01:46:19.102569+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 19:53:54.919418+05:30	\N	\N	f	t	f	f	t	f	t
fb639ff3-9fbe-4b31-a03d-124e2ddbe953	all	\N	\N	\N	\N	c1a6c53e-adf5-4451-a996-6cc4ff5fe012	30	149.00	flat	50.00	99.00	0.00	0	{"label": "30 min", "basePrice": 149, "discountType": "flat", "sellingPrice": 99, "discountValue": 50, "availableForExpand": true, "availableForExtend": false, "timeDurationMinutes": 30, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "30 min", "availableFor": {"expand": true, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 20:05:43.9245+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.52027+05:30	\N	\N	f	t	f	t	t	f	t
322dcf38-9e58-4bb2-a7c6-f25c6c7fd6ba	all	\N	\N	\N	\N	c1a6c53e-adf5-4451-a996-6cc4ff5fe012	120	299.00	flat	50.00	249.00	0.00	0	{"label": "2 hrs", "basePrice": 299, "discountType": "flat", "sellingPrice": 249, "discountValue": 50, "availableForExpand": true, "availableForExtend": false, "timeDurationMinutes": 120, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "2 hrs", "availableFor": {"expand": true, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 20:05:44.001416+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.711991+05:30	\N	\N	f	t	f	t	t	f	t
32a49027-9ed1-485e-8d90-16a837252f12	all	\N	\N	\N	\N	c1a6c53e-adf5-4451-a996-6cc4ff5fe012	2	29.00	flat	10.00	19.00	0.00	0	{"label": "2 min", "basePrice": 29, "discountType": "flat", "sellingPrice": 19, "discountValue": 10, "availableForExpand": true, "availableForExtend": false, "timeDurationMinutes": 2, "waitingChargeAmount": 0, "availableForDuration": true, "waitingChargeTimeMinutes": 0}	{"label": "2 min", "availableFor": {"expand": true, "extend": false, "duration": true}, "waitingCharges": {"amount": 0, "timeMinutes": 0}}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.739727+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 21:58:19.739727+05:30	\N	\N	f	t	f	t	t	f	t
\.


--
-- Data for Name: category_service_masters; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.category_service_masters (id, service_title, service_subtitle, static_value, show_static_value, icons, service_position, is_enabled, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, service_category_grid_size, service_title_font_size, service_title_font_weight, service_title_color, service_subtitle_font_size, service_subtitle_font_weight, service_subtitle_color, booking_type, show_eta) FROM stdin;
7c066275-eed7-43ce-8ce3-27b7b4ee5e52	Indoor	\N	\N	f	[{"icon": "/uploads/images/flash-3d-icon-png-download-11597500-1784321891489.png", "size": 28, "target": "serviceTitle", "position": "left"}]	4	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 18:58:31.152007+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-08-01 21:52:27.852857+05:30	\N	\N	f	3x3	18	700	#000000	13	400	#000000	both	f
b7c731d6-1d1e-46f0-9b1f-34bfe628ef97	Health	\N	\N	f	[{"icon": "/uploads/images/health-icon-2-1784311301429.png", "size": 20, "target": "serviceTitle", "position": "left"}]	2	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 18:58:02.265389+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 02:46:58.592782+05:30	\N	\N	f	4x4	18	700	#000000	13	400	#000000	both	f
7b56ada2-cb5d-46b8-8d25-0a7a1d357afb		\N	\N	f	[]	0	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 23:28:43.348003+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 23:28:51.959277+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 23:28:51.959277+05:30	t	3x3	18	700		13	400		both	f
c75e980b-3bb2-4a82-9dec-d47916b836f5	Tell us your need	\N	\N	f	[{"icon": "/uploads/images/conversation-3d-rendering-isometric-icon-png-1784324930861.png", "size": 24, "target": "serviceTitle", "position": "left"}]	5	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 21:34:12.037614+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 03:18:55.258982+05:30	\N	\N	f	1x1	18	700	#000000	13	400	#000000	both	f
9f87f4c1-9905-4934-8b03-62850e769bbc	Book your <b>Trusted Assistant</b>	<b>Urgent help in</b>	\N	f	[{"icon": "/uploads/images/flash-icon-1784314177132.png", "size": 21, "target": "serviceSubtitle", "position": "right"}, {"icon": "/uploads/images/blue-check-mark-verified-profile-account-social-media-symbol-user-interface-them-1784361674275.png", "size": 26, "target": "serviceTitle", "position": "right"}]	1	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 16:47:54.425987+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 22:21:00.035506+05:30	\N	\N	f	4x4	18	700	#000000	14	400	#5c5c5c	instant	t
db4b6b37-56f0-4447-98ea-5c4e985dd510	Outdoor	\N	\N	f	[{"icon": "/uploads/images/pngtree-open-door-3d-style-graphic-clipart-png-image_13604980-1784321466133.png", "size": 24, "target": "serviceTitle", "position": "left"}]	3	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-17 18:58:23.611474+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-18 02:21:11.579817+05:30	\N	\N	f	3x3	18	700	#000000	13	400	#000000	both	f
\.


--
-- Data for Name: category_store_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.category_store_map (id, category_id, store_id, is_active, created_by, created_at, deleted_by, deleted_at, is_deleted) FROM stdin;
11b13ce5-47de-4c98-8a3a-ed11451bae62	79a611a4-6bc6-4a83-8388-307a7984555c	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 19:46:30.666744+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:18.01872+05:30	t
345e0df8-e8ab-47bc-b509-56c9b2a84eec	504100dc-21ec-4fba-80be-4c5680ff6293	be7f502c-d686-4237-b3e4-b492fc05a833	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:19.954112+05:30	t
68844647-3b12-4ecf-8bea-40c505f4d896	504100dc-21ec-4fba-80be-4c5680ff6293	28906383-ec9f-4b7d-87d7-e45e46d3f912	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:24:05.057631+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:21.584372+05:30	t
e97e54ad-1684-4fee-8a84-596ad2b40d52	504100dc-21ec-4fba-80be-4c5680ff6293	eb8a8b2b-3849-4320-9525-f2314658b9ac	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:23.581231+05:30	t
26f541e2-8e2d-424e-a915-f037b45ac806	504100dc-21ec-4fba-80be-4c5680ff6293	a501062b-a597-4875-8688-85e0a2efd8c2	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:25.621864+05:30	t
a70e8375-7041-4810-ada9-5e09c190533e	504100dc-21ec-4fba-80be-4c5680ff6293	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:27.678781+05:30	t
c1933f06-4c76-4a12-a930-61335b38f370	504100dc-21ec-4fba-80be-4c5680ff6293	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:29.557332+05:30	t
980504c4-4e6a-48da-a2ce-d8666f42b76d	de52d3a1-7745-4423-8230-c9f1208be094	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 19:01:07.01153+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:31.567451+05:30	t
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.chat_messages (id, thread_id, sender_user_id, message_type_id, message, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: chat_threads; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.chat_threads (id, request_id, thread_type_id, status_id, created_at) FROM stdin;
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cities (id, name, code, state, country, timezone, operating_hours, status_id, created_at, updated_at, state_id, is_active, metadata, created_by, updated_by, deleted_by, deleted_at, is_deleted) FROM stdin;
fd3caeea-0a31-4782-b7de-b436c1b27395	Gurgaon	GURGAON	\N	IN	Asia/Kolkata	{}	\N	2026-05-16 12:10:32.838029+05:30	2026-05-16 18:12:29.135037+05:30	c89a7f1d-241e-47e7-9829-b1e5316fee43	f	{"seeded": true}	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:12:29.135037+05:30	t
8071a1a7-dc7f-41dd-9a70-f42e1d175c25	Gurgaon	CTY001	\N	IN	Asia/Kolkata	{}	\N	2026-05-16 00:06:04.743774+05:30	2026-05-17 14:13:12.197602+05:30	e236489e-dd7c-4286-a944-6114eeb3fe56	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f
21ead40b-98c2-4bbb-b179-ca74f427a206	Dwarka	CTY002	\N	IN	Asia/Kolkata	{}	\N	2026-05-17 14:13:02.132347+05:30	2026-05-17 14:13:18.918771+05:30	454b92a0-ad47-44df-94df-eb1719e9a500	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f
eef25e78-da34-48e2-a46d-8a6d6a127ead	Jammu	01	\N	IN	Asia/Kolkata	{}	\N	2026-05-22 11:08:32.048104+05:30	2026-05-22 11:08:32.048104+05:30	a43ef94e-af52-437a-b852-c8e19d5ca017	t	{}	a6290b06-9d07-4093-98af-a2051e52fa8b	a6290b06-9d07-4093-98af-a2051e52fa8b	\N	\N	f
\.


--
-- Data for Name: cluster_access_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_access_rules (id, source_cluster_id, allowed_cluster_id, rule_type_id, is_enabled, max_distance_km, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cluster_boundaries; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_boundaries (id, cluster_id, boundary_geojson, boundary_geometry, version, is_active, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: cluster_category_settings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_category_settings (id, cluster_id, category_id, is_visible, is_enabled, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, config) FROM stdin;
9f2fea3f-4f7e-4f7d-bc07-da0f5eeaeca0	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	de52d3a1-7745-4423-8230-c9f1208be094	t	t	t	a6290b06-9d07-4093-98af-a2051e52fa8b	2026-05-22 13:46:35.274128+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:59:03.298642+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
e29dcbbb-b520-4a61-87c7-721a62e77dbf	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	504100dc-21ec-4fba-80be-4c5680ff6293	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 11:43:01.34655+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:59:20.867234+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
1fbb8634-ed2d-4603-b47e-71ab7f8906d8	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	79a611a4-6bc6-4a83-8388-307a7984555c	t	t	t	a6290b06-9d07-4093-98af-a2051e52fa8b	2026-05-22 13:46:57.110634+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:59:20.867234+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
787dbfe7-8e2e-4a66-8888-00a8912ec70d	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	5e778120-836c-4ee6-b2f0-9315b486a47e	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 21:37:42.766915+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:45:53.197988+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
86531a4e-1aa5-4ccf-97f0-f81eabe3a92e	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	20b75169-9d58-40d5-8f05-08f16e638c15	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 21:37:25.783294+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:45:53.197988+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
6260ee8d-a280-493f-a2b4-f2f456120609	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	4e1061c3-c072-4bc8-9d6e-afccc9ea6750	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 21:37:35.08055+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:45:53.197988+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
ce1037b5-f48c-4449-bbac-2125406af977	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	c23c70fb-068b-4c2a-85e2-417c1082f7f4	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:04:45.804549+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:43:43.882664+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
1a08311b-8255-47c7-909f-825c29a026ce	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	a0807a1b-ade5-492f-b3b8-8cd3b5881ba4	t	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:04:55.304206+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-28 13:43:43.882664+05:30	\N	\N	f	{"pricing": {"basePrice": 0, "surgeLabel": null, "surgeRules": [], "discountType": "none", "sellingPrice": 0, "surgeRuleIds": [], "discountLabel": null, "discountValue": 0, "additionalCharges": 0}}
\.


--
-- Data for Name: cluster_launch_configs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_launch_configs (id, cluster_id, min_online_assistants, backup_assistants, booking_enabled_at, config, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cluster_service_settings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_service_settings (id, cluster_id, service_id, is_visible, is_enabled, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, config) FROM stdin;
2d5a4d07-76d7-4119-87bf-af8ae9855b19	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	bb61a52e-af7e-485a-bf75-d371f889ed89	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 11:37:32.635465+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:11.638983+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:11.638983+05:30	t	{}
a769671a-aefa-491c-be16-3364b7a76deb	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	b8af3437-b5be-4de9-906d-fb15a1204ab2	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 21:37:15.121822+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:17.192896+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:17.192896+05:30	t	{}
387d5d8f-6ca2-43e4-9fab-e8f438642211	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 15:00:25.953288+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:21.59386+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:21.59386+05:30	t	{}
1ee18539-9312-4510-8444-aafa332f4f2d	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 15:00:18.987706+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:25.465578+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:25.465578+05:30	t	{}
5184de4f-5795-4c12-8de1-597d43ea56a9	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	c5398c5e-75f6-4b50-bd1d-9ffd4f1d9ba3	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-21 09:31:14.564141+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:29.664563+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:29.664563+05:30	t	{}
beb7cf15-c3ad-4af7-b73e-c9ce932d8aa6	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	ece963f6-5b99-4f44-9722-88b10bfeb641	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-21 09:31:01.98747+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:32.781367+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:32.781367+05:30	t	{}
7b0a8014-f459-483a-b924-9dd3b65f4fc8	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	f3bf3ab2-01e2-401f-9561-fea760bdc80a	t	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 15:00:53.206649+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:36.236027+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:36.236027+05:30	t	{}
90605389-af32-4a46-a029-ca75e98983f3	16221a46-8ed7-4449-a010-571f2e8e7bee	bb61a52e-af7e-485a-bf75-d371f889ed89	f	f	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 03:12:12.953141+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 14:50:46.748977+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 14:50:46.748977+05:30	t	{}
\.


--
-- Data for Name: cluster_service_visibility; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_service_visibility (id, cluster_id, service_id, category_id, is_visible, starts_at, ends_at, config) FROM stdin;
\.


--
-- Data for Name: cluster_store_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.cluster_store_map (id, cluster_id, store_id, is_active, created_by, created_at, deleted_by, deleted_at, is_deleted) FROM stdin;
213504c6-9121-4297-a0e1-e5c362585187	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
76bf8584-cf17-43e2-9f54-6524ad0f0ec5	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
eef227e1-3181-43dc-9c5f-d8560b45fbed	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	28906383-ec9f-4b7d-87d7-e45e46d3f912	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:24:05.057631+05:30	\N	\N	f
f1c27bea-12c0-4a28-842c-473af6538030	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 21:50:04.405553+05:30	\N	\N	f
7fe43cba-e07f-492b-a210-7f380dc06a5a	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
3efac2a5-d02c-4033-9ed1-6d77cddbed2f	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	a501062b-a597-4875-8688-85e0a2efd8c2	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	\N	\N	f
48665197-a5a6-4a24-8886-333e0a4c52cd	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
\.


--
-- Data for Name: clusters; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.clusters (id, city_id, zone_id, name, code, priority, status_id, launch_stage_id, is_booking_enabled, operating_hours, metadata, created_at, updated_at, created_by, updated_by, deleted_by, deleted_at, is_deleted, description, areas_description, polygon_description) FROM stdin;
305b63d8-44ac-409e-a31b-3661a853fda7	fd3caeea-0a31-4782-b7de-b436c1b27395	\N	Demo Gurgaon Cluster	DEMO-GGN-1	1	\N	\N	f	{"endTime": null, "startTime": null}	{"seeded": true, "isPinned": false, "pinPriority": 0}	2026-05-16 12:10:32.838029+05:30	2026-05-16 15:51:49.808256+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	Seed cluster for booking testing	Gurgaon central demo areas	POLYGON((77.0266 28.4595, 77.0766 28.4595, 77.0766 28.4895, 77.0266 28.4895, 77.0266 28.4595))
f7965377-9d4c-4fe2-ba62-ca8611ece9e4	8071a1a7-dc7f-41dd-9a70-f42e1d175c25	118b1cca-1ce1-43d4-81c2-a879284b1607	Gurgaon Cluster 1 	C001	1	\N	\N	t	{"endTime": "23:00", "startTime": "07:00"}	{"isPinned": true, "pinPriority": 1}	2026-05-16 00:18:16.935221+05:30	2026-05-17 18:09:18.258486+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	\N	Sector 56, 57, 58, 44, 55	POLYGON ((77.1028932 28.4583685, 77.1019492 28.4516523, 77.1064981 28.447049, 77.1106181 28.4453125, 77.1101029 28.4414255, 77.1122486 28.4392557, 77.1143514 28.43802, 77.1160893 28.4371003, 77.1157566 28.4358857, 77.1136162 28.4330142, 77.1152927 28.4319559, 77.1144143 28.4302191, 77.1078714 28.421538, 77.1113212 28.4045997, 77.0788772 28.4033918, 77.0739424 28.4131293, 77.0660889 28.4210551, 77.075102 28.4308678, 77.0581061 28.4438512, 77.0722336 28.4590675, 77.0746369 28.4572564, 77.0856232 28.4605766, 77.1007294 28.4632931, 77.1065659 28.4641985, 77.1028932 28.4583685))
16221a46-8ed7-4449-a010-571f2e8e7bee	21ead40b-98c2-4bbb-b179-ca74f427a206	4066a462-e317-4185-b31e-f7607485db96	Dwarka Cluster 1	CLST002	0	\N	\N	t	{"endTime": "21:31", "startTime": "08:00"}	{"isPinned": true, "pinPriority": 2}	2026-05-17 14:16:58.918239+05:30	2026-08-01 21:31:40.673846+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	\N	Sector -12, Sector-13, Sector - 14, Sector -8	POLYGON ((77.1214846 28.6046072, 77.0871523 28.6428804, 77.0473269 28.6486051, 77.0253542 28.6377580, 76.9920519 28.6168154, 76.9965151 28.5743117, 77.0504168 28.5580292, 77.1036318 28.5761207, 77.1214846 28.6046072))
\.


--
-- Data for Name: customer_addresses; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_addresses (id, customer_id, label, address_text, latitude, longitude, city, postal_code, cluster_id, is_default, metadata, created_at, updated_at, deleted_at, created_by, updated_by, deleted_by) FROM stdin;
\.


--
-- Data for Name: customer_approvals; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_approvals (id, service_request_id, task_update_id, approval_type, status_code, amount_paise, requested_message, decision_notes, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: customer_auth_sessions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_auth_sessions (id, user_id, customer_id, refresh_token_hash, refresh_token_version, user_agent, ip_address, metadata, expires_at, revoked_at, revoked_reason, last_used_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_cart; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_cart (customer_id, user_id, cart_items, created_at, updated_at, customer_note) FROM stdin;
\.


--
-- Data for Name: customer_disputes; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_disputes (id, service_request_id, customer_user_id, assigned_admin_user_id, status_code, subject, description, request_refund, requested_refund_amount_paise, payment_mode, resolution_type, resolution_amount_paise, resolution_reason, admin_response, resolved_at, resolved_by_user_id, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_favorite_places; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_favorite_places (customer_id, place_id, label, created_at) FROM stdin;
\.


--
-- Data for Name: customer_memberships; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_memberships (id, customer_id, membership_plan_id, starts_at, ends_at, status_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: customer_notes; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_notes (id, customer_id, note_type_id, note, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: customer_support_messages; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_support_messages (id, ticket_id, sender_type, sender_user_id, message, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: customer_support_tickets; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_support_tickets (id, ticket_number, customer_id, booking_id, subject, category, status_code, priority_code, assigned_admin_user_id, last_message_at, closed_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_unserviceable_locations; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customer_unserviceable_locations (id, customer_id, user_id, latitude, longitude, location_title, address_text, state_name, city_name, postal_code, hit_count, first_seen_at, last_seen_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.customers (id, user_id, customer_code, default_membership_plan_id, status_id, rating_avg, rating_count, preferences, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: daily_assistant_metrics; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.daily_assistant_metrics (metric_date, assistant_id, online_minutes, busy_minutes, tasks_offered, tasks_accepted, tasks_completed, tasks_rejected, earning_total, rating_avg) FROM stdin;
\.


--
-- Data for Name: daily_cluster_metrics; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.daily_cluster_metrics (metric_date, cluster_id, requests_created, requests_completed, requests_cancelled, failed_assignments, avg_assignment_seconds, avg_completion_minutes, revenue_total, refund_total, support_ticket_count) FROM stdin;
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.devices (id, user_id, app_type_id, platform_id, push_token, device_uid, app_version, last_seen_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: document_types; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.document_types (id, code, name, entity_type, description, is_active, created_at, updated_at) FROM stdin;
d7c534e2-f5d8-4b32-bef8-a849f6834dc1	aadhaar_front	Aadhaar Card Front Image	assistant	Aadhaar card front side	t	2026-05-16 22:14:48.742859+05:30	2026-08-06 23:18:56.793004+05:30
5d8500e0-6337-4c60-8da7-d39c3188d82c	aadhaar_back	Aadhaar Card Back Image	assistant	Aadhaar card back side	t	2026-05-16 22:14:48.775484+05:30	2026-08-06 23:18:56.797652+05:30
a4d25506-fa6f-4d96-ac5c-0fed7c91387f	pan_front	PAN Card Front Image	assistant	PAN card front side	t	2026-05-16 22:14:48.776864+05:30	2026-08-06 23:18:56.798811+05:30
24d99e8a-5da9-4ac5-b3c5-94cc8d3c1b07	pan_back	PAN Card Back Image	assistant	PAN card back side	t	2026-05-16 22:14:48.778702+05:30	2026-08-06 23:18:56.800171+05:30
19a4aec6-8420-4365-9768-93834fd4b8fc	profile_picture	Profile Picture	assistant	Assistant profile picture	t	2026-05-16 22:14:48.779497+05:30	2026-08-06 23:18:56.80169+05:30
aa38c8bd-71d4-4a20-9ff8-d7af8e12f957	driving_license_front	Driving Licence Front Image	assistant	Driving licence front side	t	2026-05-17 12:32:11.72131+05:30	2026-08-06 23:18:56.803338+05:30
7839b9e8-6119-4c87-9c7d-4a6ddb7f1a6f	driving_license_back	Driving Licence Back Image	assistant	Driving licence back side	t	2026-05-17 12:32:11.758067+05:30	2026-08-06 23:18:56.804489+05:30
\.


--
-- Data for Name: event_log; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.event_log (id, event_name, entity_type, entity_id, actor_user_id, request_id, cluster_id, payload, occurred_at) FROM stdin;
\.


--
-- Data for Name: exception_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.exception_events (id, request_id, exception_type_id, severity_id, reason_id, detected_by_user_id, status_id, description, metadata, created_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.feature_flags (id, code, name, description, is_enabled, rollout_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: file_links; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.file_links (id, file_id, entity_type, entity_id, purpose, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.files (id, storage_provider, bucket, object_key, original_name, mime_type, size_bytes, checksum, metadata, created_at) FROM stdin;
b86b46f3-b74e-440c-af4f-62eaa18d4d61	local_public	/uploads/images	/uploads/images/test.png	test.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "00000000-0000-0000-0000-000000000000"}	2026-05-16 16:51:32.452985+05:30
5119cc4e-e3c9-473c-ba59-d1579e44ce5a	local_public	/uploads/images	/uploads/images/test-1778930512413.png	test.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 16:51:52.417887+05:30
9e0b1786-9d09-40b0-825f-5a5c93546a45	local_public	/uploads/images	/uploads/images/bring_buy-1778930558283.png	bring_buy.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 16:52:38.289901+05:30
e444dca1-4a57-4766-a1e8-1e27f4862251	local_public	/uploads/images	/uploads/images/queue-1778930831906.png	queue.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 16:57:11.919202+05:30
15ba3b65-8509-4f76-a2ce-cae93342fa9a	local_public	/uploads/images	/uploads/images/8cc38a79-68a7-46bf-97e8-d0424aff0238-1778931246011.png	8cc38a79-68a7-46bf-97e8-d0424aff0238.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 17:04:06.02779+05:30
36c75734-4897-4be4-ae46-9d2b7f79b8d8	local_public	/uploads/images	/uploads/images/food-1778931655507.png	food.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 17:10:55.552757+05:30
e053aaf4-220c-48d0-907c-271bf5f7ca83	local_public	/uploads/images	/uploads/images/baby_care-1778931887300.png	baby_care.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 17:14:47.317758+05:30
20989612-5925-4396-bcd4-c8ec5c568c89	local_public	/uploads/images	/uploads/images/Personal_Assistant-1778932078781.png	Personal_Assistant.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 17:17:58.789706+05:30
1a42d706-2ba6-48d0-9479-6b85a508d0fc	local_public	/uploads/images	/uploads/images/saloon-1778934690957.png	saloon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:01:30.967652+05:30
53e85c82-707b-42c3-83c5-c67897ac4263	local_public	/uploads/images	/uploads/images/banquet-1778934828620.png	banquet.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:03:48.631039+05:30
bf2cd76e-78bd-4861-b4d3-a8d97ae7bed0	local_public	/uploads/images	/uploads/images/play-station-1778934903051.png	play station.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:05:03.05833+05:30
d18f8b80-cd12-43ae-9104-8b7f7f8d3d7c	local_public	/uploads/images	/uploads/images/dry-cleaner-1778935002628.png	dry cleaner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:06:42.63142+05:30
4918f63f-7eff-4d06-adeb-a3687be38735	local_public	/uploads/images	/uploads/images/food-1778935201191.webp	food.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:10:01.194417+05:30
677d815d-8503-4dfc-8df3-269aca67e0f6	local_public	/uploads/images	/uploads/images/8cc38a79-68a7-46bf-97e8-d0424aff0238-1778935204614.png	8cc38a79-68a7-46bf-97e8-d0424aff0238.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:10:04.620626+05:30
6e022ac2-014d-4711-958b-0038c6a8f05a	local_public	/uploads/images	/uploads/images/health-care-1778936895275.png	health care.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:38:15.304746+05:30
2d0c09d8-3346-4e8a-adc1-2bc72d9a67b2	local_public	/uploads/images	/uploads/images/pharmacy-or-clinic-interior-illustration-vector-1778937539715.jpg	pharmacy-or-clinic-interior-illustration-vector.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:48:59.782789+05:30
adb0be65-f889-4c4c-93db-89abd8f144fc	local_public	/uploads/images	/uploads/images/medical-shop-1778937546046.png	medical-shop.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 18:49:06.069487+05:30
1823bc51-a89d-4d73-95d1-f9501ea6a084	local_public	/uploads/images	/uploads/images/pharmacy-or-clinic-interior-illustration-vector-1778938329760.jpg	pharmacy-or-clinic-interior-illustration-vector.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 19:02:09.79108+05:30
c371b1e0-a066-4dfd-91a2-5fd26838b3e8	local_public	/uploads/images	/uploads/images/pharmacy-or-clinic-interior-illustration-vector-1778940888156.jpg	pharmacy-or-clinic-interior-illustration-vector.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 19:44:48.182442+05:30
fc933cab-3661-49b1-9e89-d8057c605938	local_public	/uploads/images	/uploads/images/medical-shop-1778940895715.png	medical-shop.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 19:44:55.76905+05:30
3156f69c-a8f4-4c1c-9cc2-7d1c6731d442	local_public	/uploads/documents	/uploads/documents/Proof-of-Authority-1778950081162.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:18:01.17715+05:30
349fa247-4f3d-4028-aaab-ab896f02bd60	local_public	/uploads/documents	/uploads/documents/baby_care-1778950092217.png	baby_care.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:18:12.231817+05:30
0e1e3943-42fb-4939-b804-5e31f1235485	local_public	/uploads/documents	/uploads/documents/baby_care-1778950102927.webp	baby_care.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:18:22.942815+05:30
9e4f8bf8-da9c-49be-8a97-c72054c6e9c5	local_public	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778950111366.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:18:31.38067+05:30
442aabf2-5c6f-4cec-89f3-b693cdacbf4f	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1778950119201.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:18:39.214985+05:30
d8c5ffdf-a81c-4e2d-9069-330ec186ecec	external_url	/uploads/documents	/uploads/documents/ZIGO_split_2-1780083054391.png	ZIGO_split_2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:00:57.13346+05:30
aa983bc7-f854-4b6f-8bfa-2929896605b7	local_public	/uploads/documents	/uploads/documents/test-1778950295698.pdf	test.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:21:35.701333+05:30
83507e7d-78be-468e-9a33-0872a0399abd	local_public	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778950520869.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:25:20.879554+05:30
daf80b50-7f85-4bd2-997b-1477589f0707	local_public	/uploads/documents	/uploads/documents/Proof-of-Authority-1778950534034.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:25:34.042692+05:30
885e64b5-d3ba-4026-96bc-1d94314b2fe9	local_public	/uploads/documents	/uploads/documents/play-station-1778950538958.png	play station.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:25:38.967283+05:30
97d004e0-5bb3-494f-96ca-2685bc82b9fb	local_public	/uploads/documents	/uploads/documents/dry-cleaner-1778950542769.png	dry cleaner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:25:42.778233+05:30
f0448e57-58fb-4485-8858-68c7644d9db8	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1778950548778.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:25:48.789881+05:30
4b211809-4afd-4c49-b21e-3d27ecc2b248	external_url	/uploads/documents	/uploads/documents/aadhaar-front-test.pdf	aadhaar-front.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:29:19.933309+05:30
5095c238-cb11-4063-a6a0-3902485df626	external_url	/uploads/documents	/uploads/documents/pan-front-test.jpg	pan-front.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:29:19.943775+05:30
f78ea27c-7e6c-4bb9-b9ba-dfb2c576feef	local_public	/uploads/documents	/uploads/documents/Proof-of-Authority-1778951034422.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:33:54.437481+05:30
51ac7296-1757-4d9e-9c14-81212f26d516	local_public	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778951042571.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:34:02.58455+05:30
44ca2b59-4e05-4d1d-bb0a-2501683b1068	local_public	/uploads/documents	/uploads/documents/Proof-of-Authority-1778951048549.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:34:08.562279+05:30
1f1983af-f856-4191-bab6-b2bff044e07e	local_public	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778951053406.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:34:13.419497+05:30
ff0a0ea0-aa9d-4482-b075-2f3b7b9d4abf	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1778951060252.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-16 22:34:20.265593+05:30
1d1ad31e-ecb1-4a90-8cac-3101d153fcc6	external_url	/uploads/documents	/uploads/documents/Proof-of-Authority-1778951034422.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:34:26.286813+05:30
581a31ca-144a-4ded-9b73-36b44072f628	external_url	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778951042571.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:34:26.330611+05:30
8c27bd97-b46e-4b24-b3cb-8fe1a7b7fea0	external_url	/uploads/documents	/uploads/documents/Proof-of-Authority-1778951048549.pdf	Proof of Authority.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:34:26.346327+05:30
ed8cc5ae-a6ae-40c4-a2db-e317d9ca01c2	external_url	/uploads/documents	/uploads/documents/Draft-Authority-Letter-1778951053406.pdf	Draft Authority Letter.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:34:26.360794+05:30
54038d54-4198-4ba5-8576-32d01a8a7e6a	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1778951060252.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-16 22:34:26.378166+05:30
5e38b751-7409-443f-b4aa-c916e6dd3150	local_public	/uploads/images	/uploads/images/ather-1779003443281.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "d93e56cd-29e7-43ce-9e76-9cc3acc24fbc"}	2026-05-17 13:07:23.291846+05:30
d96e3160-fda6-4c76-ac6c-e2c3ccbb4e39	local_public	/uploads/images	/uploads/images/hero-VIDA-1779003609878.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "d93e56cd-29e7-43ce-9e76-9cc3acc24fbc"}	2026-05-17 13:10:09.892128+05:30
877be461-1008-4718-a260-8280d5b73835	local_public	/uploads/images	/uploads/images/hero-VIDA-1779003619423.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "d93e56cd-29e7-43ce-9e76-9cc3acc24fbc"}	2026-05-17 13:10:19.430854+05:30
0886bd1e-271e-442a-a3a0-8fb6f14d269c	local_public	/uploads/images	/uploads/images/VIDA-2-1779003756721.jpg	VIDA 2.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "d93e56cd-29e7-43ce-9e76-9cc3acc24fbc"}	2026-05-17 13:12:36.730017+05:30
d1bd8f85-c7d5-4f23-86e1-1b137a1df92d	local_public	/uploads/images	/uploads/images/ather-1779003930323.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "d93e56cd-29e7-43ce-9e76-9cc3acc24fbc"}	2026-05-17 13:15:30.326347+05:30
258c6e14-791e-46a2-8df9-9af18ba5c687	local_public	/uploads/documents	/uploads/documents/play-station-1779008688069.png	play station.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:34:48.075356+05:30
85895cba-7036-4022-85c0-926a267b92a4	local_public	/uploads/documents	/uploads/documents/dry-cleaner-1779008695245.png	dry cleaner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:34:55.252372+05:30
d419a6ea-e3c2-4105-8a83-2c8843e4ad2f	local_public	/uploads/documents	/uploads/documents/VIDA-2-1779008700747.jpg	VIDA 2.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:35:00.750198+05:30
bf7ff820-63b7-43b7-ac28-26d27ab11d29	local_public	/uploads/documents	/uploads/documents/hero-VIDA-1779008704374.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:35:04.376978+05:30
e0295c08-50e2-4d53-88ed-5b35c9bd6a61	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779008711437.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:35:11.454846+05:30
3d6dea34-3309-4137-9d3f-efe037e87959	local_public	/uploads/documents	/uploads/documents/baby_care-1779008721922.webp	baby_care.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:35:21.925169+05:30
665d44c4-ae1e-40f4-bf91-8578cf8560fb	local_public	/uploads/documents	/uploads/documents/8cc38a79-68a7-46bf-97e8-d0424aff0238-1779008726679.webp	8cc38a79-68a7-46bf-97e8-d0424aff0238.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:35:26.685312+05:30
ea2cb12f-2945-454d-8d2e-d735cda5499d	external_url	/uploads/documents	/uploads/documents/play-station-1779008688069.png	play station.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.884161+05:30
8be427b1-be6c-4d08-ad1a-0bf1e8e5859e	external_url	/uploads/documents	/uploads/documents/dry-cleaner-1779008695245.png	dry cleaner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.918731+05:30
39261e12-933a-41c9-bd00-a4175692c7a5	external_url	/uploads/documents	/uploads/documents/VIDA-2-1779008700747.jpg	VIDA 2.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.93301+05:30
439a1249-9470-4534-9417-27d0b11a3bcd	external_url	/uploads/documents	/uploads/documents/hero-VIDA-1779008704374.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.943042+05:30
f19f2157-0590-4196-ac19-9ce8e251b1af	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779008711437.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.95631+05:30
de10f1ae-e274-45ef-86c4-d2b257b3bbec	external_url	/uploads/documents	/uploads/documents/baby_care-1779008721922.webp	baby_care.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.979109+05:30
3afac8d9-7725-44ee-a26b-eaf8e8a9c8bf	external_url	/uploads/documents	/uploads/documents/8cc38a79-68a7-46bf-97e8-d0424aff0238-1779008726679.webp	8cc38a79-68a7-46bf-97e8-d0424aff0238.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 14:35:32.991903+05:30
e2ed6282-5c18-44ba-b0ff-4309a316522d	local_public	/uploads/documents	/uploads/documents/zigo-white-logo-1-1-1779008769924.png	zigo-white-logo (1) (1).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 14:36:09.927649+05:30
9a08e64a-0e10-4413-9735-c4415e5ff351	local_public	/uploads/documents	/uploads/documents/ather-1779013310610.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:51:50.618916+05:30
c6ae4284-6123-459d-a9d0-dec74b701ec7	local_public	/uploads/documents	/uploads/documents/bring_buy-1779013315581.png	bring_buy.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:51:55.589023+05:30
81ba3166-9e60-471f-8496-1a5e01c84350	local_public	/uploads/documents	/uploads/documents/Personal_Assistant-1779013322681.png	Personal_Assistant.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:52:02.693379+05:30
1a7f639e-fc36-4b34-a958-e7b82eb523bc	local_public	/uploads/documents	/uploads/documents/O-with-fill-1779013327608.png	O with fill.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:52:07.612133+05:30
c38a781c-ee05-4c67-972f-a946b0a8eb25	local_public	/uploads/documents	/uploads/documents/ZIGO-Partner-1779013336394.png	ZIGO Partner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:52:16.399493+05:30
46f9657b-9465-4fc6-8fcc-f28c9a6c4a2a	local_public	/uploads/documents	/uploads/documents/ather-1779013340805.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:52:20.81111+05:30
81a16ab8-c4b8-4de6-9fb6-16be25c7f283	local_public	/uploads/documents	/uploads/documents/VIDA-2-1779013344479.jpg	VIDA 2.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 15:52:24.482976+05:30
cb30fdd3-b7ae-4640-ad50-d60f05603c88	external_url	/uploads/documents	/uploads/documents/ather-1779013310610.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.714762+05:30
7cf53fb2-8cef-43bc-87bf-d1c0e43561a8	external_url	/uploads/documents	/uploads/documents/bring_buy-1779013315581.png	bring_buy.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.730596+05:30
cd2d0e79-7b35-439b-991a-5e35d2269dbb	external_url	/uploads/documents	/uploads/documents/Personal_Assistant-1779013322681.png	Personal_Assistant.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.74464+05:30
e0c6ce4d-159a-4bed-a6d9-fd843171e02e	external_url	/uploads/documents	/uploads/documents/O-with-fill-1779013327608.png	O with fill.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.754041+05:30
b717eae9-8d99-4ccd-a324-1d3cb70c7d12	external_url	/uploads/documents	/uploads/documents/ZIGO-Partner-1779013336394.png	ZIGO Partner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.769056+05:30
048995af-4397-4c60-8443-5c3b87d6e3cf	external_url	/uploads/documents	/uploads/documents/ather-1779013340805.webp	ather.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.782845+05:30
a6006ef7-0928-4695-b6ee-6c2143de4f37	external_url	/uploads/documents	/uploads/documents/VIDA-2-1779013344479.jpg	VIDA 2.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 15:52:30.795062+05:30
e7b818dc-895c-46d0-b216-a808223a25aa	local_public	/uploads/documents	/uploads/documents/hero-VIDA-1779020859131.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 17:57:39.1535+05:30
ebf0429d-4f2c-4494-8744-b388d34e548e	external_url	/uploads/documents	/uploads/documents/hero-VIDA-1779020859131.webp	hero VIDA.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 17:57:40.759842+05:30
0b44784a-8758-44ce-8150-332ebd0e54b5	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779021237620.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 18:03:57.635903+05:30
9173d547-bb59-4f33-a4b0-0b131d142b81	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779021237620.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-17 18:04:07.290203+05:30
e509a06a-42e5-4748-82fd-0e4b4c159513	local_public	/uploads/images	/uploads/images/O-without-fill-1779021740264.png	O without fill.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 18:12:20.268711+05:30
ccfeb00f-bdf4-41f6-a0c0-93d231a64e24	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-06-at-10-45-19-PM-1779021762269.jpeg	WhatsApp Image 2026-05-06 at 10.45.19 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 18:12:42.272774+05:30
6eec11b1-1723-4466-bd34-b5a21924b153	local_public	/uploads/images	/uploads/images/O-without-fill-1779021817921.png	O without fill.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-17 18:13:37.924229+05:30
19bb03f7-3622-49a3-b74a-bfe65460d5d9	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779255110832.jpeg	WhatsApp Image 2026-05-15 at 12.05.08 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-20 11:01:50.838016+05:30
ee9eb9da-d13e-41ed-8729-e2fa57c81a91	local_public	/uploads/images	/uploads/images/zigo-white-logo-1-2-1779255437593.png	zigo-white-logo (1) (2).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-20 11:07:17.610133+05:30
399b963f-2aa9-4e7a-82e9-8e414a4cf92c	local_public	/uploads/images	/uploads/images/rough-zigo-1779255755151.png	rough-zigo.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-20 11:12:35.154529+05:30
435c0e20-4010-442d-b770-bc2b275e92db	local_public	/uploads/images	/uploads/images/ZIGO-Partner-1779427942245.png	ZIGO Partner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-22 11:02:22.273119+05:30
144327dd-f3e6-4502-8b6e-f55c98aa19fa	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-24-at-12-24-18-AM-1779562475819.jpeg	WhatsApp Image 2026-05-24 at 12.24.18 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 00:24:35.843359+05:30
f4a42b12-dbcf-4572-a1b7-e440bfdd0fd9	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-24-at-12-24-18-AM-1779562951333.jpeg	WhatsApp Image 2026-05-24 at 12.24.18 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 00:32:31.353592+05:30
2bdbe3b4-e474-4ecb-a0a9-8ce7cae1a272	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-24-at-12-24-18-AM-1779563586716.jpeg	WhatsApp Image 2026-05-24 at 12.24.18 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 00:43:06.723243+05:30
3bb03934-a624-42e4-a4f0-25c7a640f670	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-24-at-12-24-18-AM-1779564197978.jpeg	WhatsApp Image 2026-05-24 at 12.24.18 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 00:53:17.992042+05:30
373ab016-3653-4d60-ae57-06e2ab073a3d	local_public	/uploads/images	/uploads/images/nurse-talking-patient-girl-coronavirus-vaccination-hospital-covid-black-male-vac-1779631562655.webp	nurse-talking-patient-girl-coronavirus-vaccination-hospital-covid-black-male-vaccine-injection-sitting-corona-virus-198245211.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 19:36:02.68217+05:30
74911c91-aa75-4d04-a9a8-fade3c0ad5e4	local_public	/uploads/images	/uploads/images/images-1779631757832.jpg	images.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-24 19:39:17.840593+05:30
04cde4f1-cd09-48ee-8b61-bf8c17956d64	local_public	/uploads/images	/uploads/images/download-1-1779651583453.jpg	download (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 01:09:43.600962+05:30
6197e50b-7519-4fb6-befd-9493b1243595	local_public	/uploads/images	/uploads/images/download-1779651624119.jpg	download.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 01:10:24.128886+05:30
1d81c75a-dd79-44e8-a463-17880c3f324c	local_public	/uploads/images	/uploads/images/download-2-1779651689570.jpg	download (2).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 01:11:29.573707+05:30
184bdb7a-7bf6-4493-8bbb-834e7bad2ee5	local_public	/uploads/images	/uploads/images/download-1-1779651801780.jpg	download (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 01:13:21.790408+05:30
d06885bb-c5c6-4587-97ec-0c7364952109	local_public	/uploads/images	/uploads/images/download-1-1779652073724.jpg	download (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 01:17:53.736051+05:30
b223b180-c2a3-433c-b48a-31fc8e909069	local_public	/uploads/images	/uploads/images/download-3-1779701820634.jpg	download (3).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:07:00.643839+05:30
1799e38b-daf6-4652-acce-fb0017b13422	local_public	/uploads/images	/uploads/images/download-1-1779701928361.jpg	download (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:08:48.364174+05:30
a5860360-9dad-4021-a2aa-33f8cfb01762	local_public	/uploads/images	/uploads/images/download-3-1779701931640.jpg	download (3).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:08:51.644877+05:30
c896c5c7-4cf0-4a3d-82c8-8238c2f23465	local_public	/uploads/images	/uploads/images/download-3-1779702364243.jpg	download (3).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:16:04.245646+05:30
14f980bd-278d-4e66-a34a-0800bac69e04	local_public	/uploads/images	/uploads/images/download-2-1779702531251.jpg	download (2).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:18:51.254798+05:30
914ff3b1-ae00-4f8d-beef-47f7fe9db4f6	local_public	/uploads/images	/uploads/images/download-4-1779702723320.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:22:03.322995+05:30
54f4325a-c59d-493d-9c34-1e0ec168d6f5	local_public	/uploads/images	/uploads/images/download-4-1779702751230.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:22:31.23246+05:30
801b45fd-e280-45b5-9fe2-7d73796c4fd4	local_public	/uploads/images	/uploads/images/download-4-1779702795051.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:23:15.053732+05:30
be1a1782-0f7f-4461-a13e-6ef0e383d83c	local_public	/uploads/images	/uploads/images/download-1779703058502.jpg	download.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 15:27:38.505298+05:30
8271b84c-89e3-4482-8642-1240bbba7e27	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-25-at-8-09-43-PM-1779719995201.jpeg	WhatsApp Image 2026-05-25 at 8.09.43 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 20:09:55.228536+05:30
0471af25-a1e6-4792-9c87-d6f775bc00e8	local_public	/uploads/images	/uploads/images/download-5-1779720064745.jpg	download (5).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 20:11:04.755088+05:30
3abac53b-7cff-4c59-b677-61752c5605fe	local_public	/uploads/images	/uploads/images/download-6-1779720138913.jpg	download (6).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 20:12:18.916301+05:30
562b202a-b0f8-40e5-8cc2-39628ba39e74	local_public	/uploads/images	/uploads/images/images-1-1779720258188.jpg	images (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-25 20:14:18.192093+05:30
4169375c-c8ee-413d-86c2-4c07d0e55137	local_public	/uploads/images	/uploads/images/ChatGPT-Image-May-28-2026-11_15_30-PM-1779993459024.png	ChatGPT Image May 28, 2026, 11_15_30 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 00:07:39.031214+05:30
b2fded08-28fa-4549-b63c-01cdce76f4b2	local_public	/uploads/images	/uploads/images/ChatGPT-Image-May-28-2026-11_15_30-PM-1779994310106.png	ChatGPT Image May 28, 2026, 11_15_30 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 00:21:50.120614+05:30
4bc945c4-4766-49da-b843-60549e39bb7a	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780053843359.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 16:54:03.36796+05:30
5eba8dac-f3f1-4173-9d4e-aa83fda2ff10	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Pin-3-1780053856918.png	ZIGO-Post-Pin-3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 16:54:16.92177+05:30
0204c655-213a-43d6-a470-c806234721ca	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780054151189.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 16:59:11.195302+05:30
6d4be280-6228-4c81-b81f-a2df1550b06d	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780054351966.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 17:02:31.974983+05:30
4a51ae84-ce52-4bf6-a49d-46da3a228724	external_url	/uploads/documents	/uploads/documents/ZIGO_split_1-1780054351966.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-29 17:02:34.45447+05:30
3af07cda-aa96-41ed-8a76-8044b4fcdeb7	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780057948918.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:02:28.925075+05:30
11658312-f543-4b44-b9af-b282d7e40c04	local_public	/uploads/images	/uploads/images/ZIGO_split_3-1780058953036.png	ZIGO_split_3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:19:13.039956+05:30
4e959f08-0cd2-4d7e-ae5c-b448993c53a6	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780058956652.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:19:16.665145+05:30
8968a507-4c3f-451b-bd74-7c08478709a3	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780059180336.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:23:00.341768+05:30
9c93ad34-d23a-4fe8-823f-bc9316ae5e43	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780059219823.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:23:39.830865+05:30
a0083f05-c86a-43ac-a540-ad9fba9fd3b0	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780059681640.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:31:21.645805+05:30
db89e539-c466-419d-afc1-da1f30c6c38c	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780060281785.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:41:21.793168+05:30
d320eac5-21b6-433b-adcf-09d9aa3d83f0	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780060615380.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 18:46:55.391366+05:30
ac0d4114-3b20-473d-a7a6-c9ac27055e41	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780061837070.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 19:07:17.076912+05:30
8ce05de4-bedc-4ab9-818e-f39b0d72b476	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780063249699.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 19:30:49.708844+05:30
28df7645-787f-48ef-a02d-73d405f665b4	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780073812899.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 22:26:52.905948+05:30
72e90055-997e-4802-a34a-7191ea5f7c44	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780073993944.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 22:29:53.950717+05:30
37983fab-46da-4cd4-b4e3-36ebd185632b	local_public	/uploads/images	/uploads/images/0882f182-1c29-41cc-81fe-08616d7eaf8f-1780077880518.jpg	0882f182-1c29-41cc-81fe-08616d7eaf8f.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-29 23:34:40.535533+05:30
1a5cf31e-660a-4b9e-afb7-5c39d7388cc3	local_public	/uploads/images	/uploads/images/ZIGO_split_2-1780081752259.png	ZIGO_split_2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:39:12.263929+05:30
1eeba928-259c-4bef-b516-61e210f17948	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780081755031.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:39:15.034869+05:30
b9de41aa-8735-4ffd-97d5-0bb263d31f51	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780081762176.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:39:22.179943+05:30
389eebd3-0972-4226-a962-53e6993a8f99	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-25-at-8-09-43-PM-1780082201489.jpeg	WhatsApp Image 2026-05-25 at 8.09.43 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:46:41.494368+05:30
a53a6cc1-d595-4ab8-a3ba-026aa9a0367c	local_public	/uploads/images	/uploads/images/ZIGO-Partner-1780082251531.png	ZIGO Partner.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:47:31.53547+05:30
f23e6063-853b-4460-bdc8-8108912cdb25	local_public	/uploads/images	/uploads/images/ZIGO_split_1-1780082355855.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 00:49:15.85775+05:30
364bec0d-634e-440e-8036-800e840b3ec8	local_public	/uploads/documents	/uploads/documents/ZIGO_split_2-1780083054391.png	ZIGO_split_2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:00:54.396507+05:30
eb292b7e-c7b1-414b-8fd1-cfe3acc75bd8	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780083081070.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:01:21.074821+05:30
516dc46c-584c-480e-84d9-a3cfe3402af6	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780083083958.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:01:23.963817+05:30
5ffb3f9a-a17f-4204-8b42-1a893ff80b21	local_public	/uploads/documents	/uploads/documents/ZIGO-GST-1780083130787.pdf	ZIGO-GST.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:02:10.791723+05:30
42e75afa-a238-41ce-b103-121bfc70df39	external_url	/uploads/documents	/uploads/documents/ZIGO-GST-1780083130787.pdf	ZIGO-GST.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:02:12.752971+05:30
c3dcb993-2fe4-4fc9-8ef5-3a3c1eada5e3	local_public	/uploads/documents	/uploads/documents/ZIGO_split_3-1780084374650.png	ZIGO_split_3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:22:54.661429+05:30
2146e13f-ad20-4771-8977-1b8d1f2b6ca6	local_public	/uploads/documents	/uploads/documents/ZIGO_split_2-1780084376936.png	ZIGO_split_2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:22:56.945016+05:30
642de0a8-8c31-4091-af5a-cf3e06f4ad14	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780084379722.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:22:59.73328+05:30
10f8c294-feba-4992-bd5f-79ac3b57b301	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Pin-3-1780084382551.png	ZIGO-Post-Pin-3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:23:02.559799+05:30
2e2a41dd-4480-497a-ba00-b016d7f2fc4b	local_public	/uploads/documents	/uploads/documents/ChatGPT-Image-May-28-2026-11_15_30-PM-1780084387840.png	ChatGPT Image May 28, 2026, 11_15_30 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:23:07.846667+05:30
2d027cd1-5e13-4c2b-86a5-98869f77024f	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-4-59-58-PM-1780084393522.jpeg	WhatsApp Image 2026-05-28 at 4.59.58 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:23:13.527066+05:30
9ddd0a1d-9fbf-4ee1-9254-fd09416c6950	external_url	/uploads/documents	/uploads/documents/ZIGO_split_3-1780084374650.png	ZIGO_split_3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.199421+05:30
a495b79c-956e-4263-a9f4-a0cfd63ce614	external_url	/uploads/documents	/uploads/documents/ZIGO_split_2-1780084376936.png	ZIGO_split_2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.220071+05:30
685510ba-bd90-4040-a92d-2272c6717659	external_url	/uploads/documents	/uploads/documents/ZIGO_split_1-1780084379722.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.231973+05:30
822191bd-4afb-4ed6-984c-c119103b754b	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Pin-3-1780084382551.png	ZIGO-Post-Pin-3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.244094+05:30
86495649-5755-4248-88d1-719bdff81b71	external_url	/uploads/documents	/uploads/documents/ChatGPT-Image-May-28-2026-11_15_30-PM-1780084387840.png	ChatGPT Image May 28, 2026, 11_15_30 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.259688+05:30
f32411d9-afcd-40e9-807f-c5eef407312f	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-4-59-58-PM-1780084393522.jpeg	WhatsApp Image 2026-05-28 at 4.59.58 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:23:15.275325+05:30
b3147594-202a-4652-ac89-fc530deec2c6	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-26-at-8-57-17-PM-1780084445496.jpeg	WhatsApp Image 2026-05-26 at 8.57.17 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:05.504223+05:30
bf8de9f1-1770-4b93-b988-914a6f8c7be1	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-12-19-33-AM-2-1780084448241.jpeg	WhatsApp Image 2026-05-28 at 12.19.33 AM (2).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:08.244318+05:30
c4825fd6-d5a9-4ad0-b44e-d0f559ef67d2	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-12-19-33-AM-1-1780084451239.jpeg	WhatsApp Image 2026-05-28 at 12.19.33 AM (1).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:11.243455+05:30
2b3dd1fd-d527-4abe-8c90-38798bcf05cf	local_public	/uploads/documents	/uploads/documents/ZIGO_split_3-1780084454182.png	ZIGO_split_3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:14.185998+05:30
2dc7e0f8-75c4-4bf6-af9e-2daeff6dc257	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780084456985.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:16.988434+05:30
c7f81104-f22a-4278-96fc-3f04175dcabd	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Pin-2-1780084459300.png	ZIGO-Post-Pin-2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:19.313317+05:30
7565923c-a650-4120-a56e-fa207b5e8213	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-26-at-8-57-17-PM-1780084445496.jpeg	WhatsApp Image 2026-05-26 at 8.57.17 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.067914+05:30
99ad7102-6129-4858-8242-a013a2ef5d82	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-12-19-33-AM-2-1780084448241.jpeg	WhatsApp Image 2026-05-28 at 12.19.33 AM (2).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.083896+05:30
ec56773f-923b-4f06-b496-31878c8fa4df	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-12-19-33-AM-1-1780084451239.jpeg	WhatsApp Image 2026-05-28 at 12.19.33 AM (1).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.094228+05:30
4c5efeeb-be81-4415-b3bd-cefc477e3746	external_url	/uploads/documents	/uploads/documents/ZIGO_split_3-1780084454182.png	ZIGO_split_3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.112782+05:30
94879da0-411a-4bba-9e9a-caa7a2631942	external_url	/uploads/documents	/uploads/documents/ZIGO_split_1-1780084456985.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.131954+05:30
febda090-6b29-4afa-a304-08ca00ddd7bf	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Pin-2-1780084459300.png	ZIGO-Post-Pin-2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:24:20.148802+05:30
d9c957bf-490f-4a61-80a1-1847206599c2	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-2-40-01-PM-1-1780084492869.jpeg	WhatsApp Image 2026-05-28 at 2.40.01 PM (1).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:52.87434+05:30
ef3e1f6a-7005-4358-a4bc-b337ac4895f4	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-2-40-01-PM-1780084496403.jpeg	WhatsApp Image 2026-05-28 at 2.40.01 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:56.406882+05:30
8af21661-9c1b-40f3-a337-9a93200ed70f	local_public	/uploads/documents	/uploads/documents/Queue-Standing-1780084499369.jpg	Queue Standing.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:24:59.37249+05:30
00ca8c09-8e8e-43d2-987c-65a978c70512	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-27-at-2-42-33-PM-1780084502583.jpeg	WhatsApp Image 2026-05-27 at 2.42.33 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:25:02.586028+05:30
a9d0527b-2fdb-4e26-98cb-50ff60b7d6d8	local_public	/uploads/documents	/uploads/documents/images-1780084505698.jpg	images.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:25:05.701851+05:30
d2858630-c58e-4f46-8304-631c7469eed4	local_public	/uploads/documents	/uploads/documents/download-4-1780084510099.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:25:10.10169+05:30
883afacb-ca82-46ba-95fc-b2b42946aee2	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-2-40-01-PM-1-1780084492869.jpeg	WhatsApp Image 2026-05-28 at 2.40.01 PM (1).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.374672+05:30
07aecff0-ea4d-41fe-a124-fd650c5c5500	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-28-at-2-40-01-PM-1780084496403.jpeg	WhatsApp Image 2026-05-28 at 2.40.01 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.38636+05:30
38d01d53-f1dd-4d74-aa55-acf345b9be1e	external_url	/uploads/documents	/uploads/documents/Queue-Standing-1780084499369.jpg	Queue Standing.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.397492+05:30
87477083-835d-4b8d-bea2-ce99c9c4812c	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-27-at-2-42-33-PM-1780084502583.jpeg	WhatsApp Image 2026-05-27 at 2.42.33 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.406392+05:30
788f09b1-f221-4e11-b78b-0a059cde0cd2	external_url	/uploads/documents	/uploads/documents/images-1780084505698.jpg	images.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.419613+05:30
a91e5169-15f5-4ff9-9031-02129fe8bec4	external_url	/uploads/documents	/uploads/documents/download-4-1780084510099.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:25:11.431387+05:30
0cc8818f-9fa1-488a-9db9-28d0b0659822	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-30-at-1-27-53-AM-1780084684284.jpeg	WhatsApp Image 2026-05-30 at 1.27.53 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:28:04.287797+05:30
9004359f-3aaf-4e6b-87d1-b52b8525f156	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-30-at-1-29-49-AM-1780084809132.jpeg	WhatsApp Image 2026-05-30 at 1.29.49 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:30:09.134976+05:30
f0ae2474-12b8-4170-9734-0e36856a42f6	local_public	/uploads/documents	/uploads/documents/ZIGO_split_1-1780085478807.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:41:18.81208+05:30
289d53f5-1b0a-4a15-9324-8573e441e85c	external_url	/uploads/documents	/uploads/documents/ZIGO_split_1-1780085478807.png	ZIGO_split_1.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:41:19.912735+05:30
ecf64b79-16ce-4c58-916b-c343b19612da	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-27-at-2-42-33-PM-1780085492041.jpeg	WhatsApp Image 2026-05-27 at 2.42.33 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:41:32.045217+05:30
6b11f434-73b7-423b-bc49-2f5a28bdb3aa	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-27-at-2-42-33-PM-1780085492041.jpeg	WhatsApp Image 2026-05-27 at 2.42.33 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:41:33.91745+05:30
f6b2a302-43a3-40e9-8ef5-5e7c5cd5566b	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-NaniKaGhar-1780085500653.jpeg	ZIGO-Post-NaniKaGhar.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 01:41:40.658505+05:30
1da3485a-9770-45f8-a9c7-01790b30e114	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-NaniKaGhar-1780085500653.jpeg	ZIGO-Post-NaniKaGhar.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 01:41:41.606439+05:30
89a91c4b-fa9b-404a-9378-75240a90f01e	local_public	/uploads/images	/uploads/images/ZIGO-Post-Pin-3-1780124191089.png	ZIGO-Post-Pin-3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 12:26:31.094974+05:30
706bc1ad-52be-43fc-b213-9210b209fa47	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-30-at-12-17-01-PM-1780129348815.jpeg	WhatsApp Image 2026-05-30 at 12.17.01 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 13:52:28.82139+05:30
1eb2cbc7-2970-4ce0-a7dc-160bf2056d84	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-05-30-at-12-17-01-PM-1780129348815.jpeg	WhatsApp Image 2026-05-30 at 12.17.01 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-05-30 13:52:30.36273+05:30
fc8b5797-a552-4bc4-8f4d-c4bdc4583cdb	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-30-at-1-27-53-AM-1780135662563.jpeg	WhatsApp Image 2026-05-30 at 1.27.53 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 15:37:42.578774+05:30
2d800562-1404-4e5a-a024-b71a20cde02d	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-30-at-1-27-53-AM-1780137267610.jpeg	WhatsApp Image 2026-05-30 at 1.27.53 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-30 16:04:27.616252+05:30
154d0de9-de51-459b-bcd3-757eeb801508	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-05-30-at-1-27-53-AM-1780217830569.jpeg	WhatsApp Image 2026-05-30 at 1.27.53 AM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-31 14:27:10.577721+05:30
83ced6d5-f7cc-49c7-85d0-26096189c4d7	local_public	/uploads/images	/uploads/images/Booking-Master-1780217834058.png	Booking Master.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-31 14:27:14.062433+05:30
21f7a957-58fa-463e-8698-d8c6368715b5	local_public	/uploads/images	/uploads/images/ZIGO-Post-Pin-3-1780217839417.png	ZIGO-Post-Pin-3.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-05-31 14:27:19.421251+05:30
a6fa1911-6e71-47de-b9b9-fe0b4ae27405	local_public	/uploads/images	/uploads/images/Personal-Assistant-Slots-1780555801292.png	Personal Assistant Slots.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 12:20:01.330486+05:30
282d2e50-f98a-43c4-b922-0392537d6947	local_public	/uploads/images	/uploads/images/queue-1780555929823.png	queue.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 12:22:09.838753+05:30
fad5f5f0-74a0-4b87-b645-caff6c44f104	local_public	/uploads/images	/uploads/images/file_00000000cd3071f59aa84e8c3098d3c4-2-1780555932779.png	file_00000000cd3071f59aa84e8c3098d3c4~2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 12:22:12.794322+05:30
eaeb9ed8-11d8-41ab-88c7-abc904decead	local_public	/uploads/documents	/uploads/documents/Personal-Assistance-1780560346410.png	Personal Assistance.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 13:35:46.419944+05:30
c2ea5f4e-be9b-4a43-bd74-bc6d0f873910	local_public	/uploads/documents	/uploads/documents/Untitled-1-1780560356623.pdf	Untitled-1.pdf	application/pdf	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 13:35:56.630971+05:30
2e51db89-0d9d-45b0-b0de-e2101a48650a	local_public	/uploads/documents	/uploads/documents/23-51-05-1780560410957.mp4	23-51-05.mp4	video/mp4	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 13:36:50.971737+05:30
8f735187-5322-4042-bf5e-328855fb3e26	local_public	/uploads/documents	/uploads/documents/23-51-05-1780570766976.mp4	23-51-05.mp4	video/mp4	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-04 16:29:26.990516+05:30
fa2569f4-5e6a-4d53-af51-c8b453eb6854	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-06-at-12-42-43-PM-1780753680361.jpeg	WhatsApp Image 2026-06-06 at 12.42.43 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-06 19:18:00.37993+05:30
df6bbc91-aa75-460f-b0a2-a83c3db331fc	local_public	/uploads/documents	/uploads/documents/image-7-1780763022744.png	image (7).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-06 21:53:42.752359+05:30
b94c5eda-ce89-483b-b009-7b0f7e7cad8c	local_public	/uploads/documents	/uploads/documents/image-7-1780763031534.png	image (7).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-06 21:53:51.539239+05:30
af112b17-5d08-401f-9955-b441fe86554e	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Choti-Choti-Khushiyan-1780986249527.png	ZIGO-Post-Choti-Choti-Khushiyan.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-09 11:54:09.563004+05:30
5e6825f6-95cf-41da-894c-6da65c2ce661	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Choti-Choti-Khushiyan-1780986649996.png	ZIGO-Post-Choti-Choti-Khushiyan.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "d068e4bc-20e6-40fc-b37f-d6c6c4a9a78f"}	2026-06-09 12:00:50.008115+05:30
e6e1bfc6-a4e9-47e8-9b8f-4d1c04c9dfaa	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Kids-Surprise-1781513527769.png	ZIGO-Post-Kids-Surprise.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-15 14:22:07.779283+05:30
7591cc34-0f58-4dc2-8f5d-124925693ded	local_public	/uploads/images	/uploads/images/WhatsApp-Image-2026-06-02-at-12-37-04-PM-1781513835033.jpeg	WhatsApp Image 2026-06-02 at 12.37.04 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:27:15.041618+05:30
908b5d30-465d-4ee7-9043-ecb94293a365	local_public	/uploads/images	/uploads/images/Buy-Bring-1781514021978.png	Buy & Bring.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:30:21.984809+05:30
ea891c2c-c3d1-4d5c-b435-72c640659f66	local_public	/uploads/images	/uploads/images/Return-Pickup-Exchange-1781514235344.png	Return, Pickup & Exchange.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:33:55.352746+05:30
29f30980-e967-49a6-a52d-6a1e464bf2b8	local_public	/uploads/images	/uploads/images/Queue-Standing-Appointment-Assistance-1781514391880.png	Queue Standing & Appointment Assistance.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:36:31.897756+05:30
fef9f83a-91ae-490c-a7fa-59319b26ec51	local_public	/uploads/images	/uploads/images/Hospital-Care-Assistance-1781514568099.png	Hospital & Care Assistance.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:39:28.103162+05:30
fc898e9b-3e02-47c1-aee9-2cf237305155	local_public	/uploads/images	/uploads/images/Forgotten-Item-Delivery-1781514884422.png	Forgotten Item Delivery.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:44:44.428734+05:30
577c34f9-4464-4588-8714-16bec171e8fe	local_public	/uploads/images	/uploads/images/Find-Nearby-Me-1781515169318.png	Find Nearby Me.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:49:29.325194+05:30
3eacf202-cc55-4cba-ad6b-4da03f98c8e0	local_public	/uploads/images	/uploads/images/Personal-Assistance-1781515398238.png	Personal Assistance.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-15 14:53:18.244571+05:30
4b87c5c0-cb7c-4c37-a62c-70efa81affa6	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Virual-Baby-Shopping-1781773544455.png	ZIGO-Post-Virual-Baby-Shopping.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-18 14:35:44.472162+05:30
50401877-8e9c-4658-9cba-27b7006ab48b	local_public	/uploads/documents	/uploads/documents/Schedule-UI-and-data-render-flow-1781773544645.mp4	Schedule UI and data render flow.mp4	video/mp4	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-18 14:35:44.662284+05:30
74fc0279-d21d-4bb7-bc0b-27f25881fe2d	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Virual-Baby-Shopping-1781787864093.png	ZIGO-Post-Virual-Baby-Shopping.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-18 18:34:24.103627+05:30
25d9fc90-61d8-43c9-a788-d8632bcb49d5	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Virual-Baby-Shopping-1781793273562.png	ZIGO-Post-Virual-Baby-Shopping.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-18 20:04:33.576104+05:30
43417c4b-61e9-42a7-94ec-63b77b7ac07c	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Party-Organiser-1781863903516.png	ZIGO-Post-Party-Organiser.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:41:43.530731+05:30
0b0740b7-ac53-4b3b-a878-e2798d2b1fdc	local_public	/uploads/documents	/uploads/documents/Track-Booking-UI-1781863903561.png	Track Booking UI.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:41:43.571893+05:30
482de77d-8f83-4146-9660-72b6036d6ed5	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Party-Organiser-1781863931242.png	ZIGO-Post-Party-Organiser.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:42:11.252524+05:30
63697f52-1e90-4404-8af8-bd3d5d314979	local_public	/uploads/documents	/uploads/documents/Track-Booking-UI-1781863931257.png	Track Booking UI.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:42:11.265263+05:30
6f8d9b9b-3eed-4dd9-84b2-9d61d5e430bb	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Party-Organiser-1781864553069.png	ZIGO-Post-Party-Organiser.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:52:33.079199+05:30
c618a021-187e-4bec-8c99-224b8219b627	local_public	/uploads/documents	/uploads/documents/Track-Booking-UI-1781864553093.png	Track Booking UI.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 15:52:33.100636+05:30
ec75fb2f-0d72-4680-bd78-0715612939fa	local_public	/uploads/documents	/uploads/documents/Track-Booking-UI-1781865899842.png	Track Booking UI.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:14:59.847614+05:30
59915c2e-0e0b-4f53-96dc-c8c9f3bd9f6c	local_public	/uploads/documents	/uploads/documents/download-4-1781866265783.jpg	download (4).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:21:05.789205+05:30
7638ec1f-75aa-4e04-96d2-c7fdb48e40c1	local_public	/uploads/documents	/uploads/documents/images-1781866265797.jpg	images.jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:21:05.800903+05:30
d9b10933-d8d6-43e7-a9f6-9808358497f9	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Party-Organiser-1781867551896.png	ZIGO-Post-Party-Organiser.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:42:31.901841+05:30
1f7dfa2c-4337-4c6b-b6e3-e15445277836	local_public	/uploads/documents	/uploads/documents/load-more-records-1781867551989.mp4	load more records.mp4	video/mp4	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:42:31.994147+05:30
86aa8d56-534a-4339-bc5a-bde4890eda61	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Elder-Care-1781867552051.png	ZIGO-Post-Elder-Care.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 16:42:32.057553+05:30
bf669c12-8cf4-43c6-b143-cd2da55c9dcf	local_public	/uploads/images	/uploads/images/images-1-1781875257365.jpg	images (1).jpg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-19 18:50:57.383776+05:30
56496ea6-e507-446c-87fe-6c8637647706	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Party-Organiser-1781892576820.png	ZIGO-Post-Party-Organiser.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 23:39:36.833272+05:30
9cb5fa9a-62b7-4460-8a22-9588450702ba	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-15-at-6-47-58-PM-1781892576869.jpeg	WhatsApp Image 2026-06-15 at 6.47.58 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 23:39:36.877818+05:30
0b2a80f4-9907-4500-be34-efd7a36e678d	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-15-at-6-47-57-PM-2-1781892576893.jpeg	WhatsApp Image 2026-06-15 at 6.47.57 PM (2).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 23:39:36.900162+05:30
3ac84eef-b990-421e-bd38-9cdc2ac0eb00	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-15-at-6-47-57-PM-1-1781892576910.jpeg	WhatsApp Image 2026-06-15 at 6.47.57 PM (1).jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 23:39:36.91641+05:30
6c7be651-5a30-483b-af6a-16e852c47213	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-15-at-6-47-57-PM-1781892576927.jpeg	WhatsApp Image 2026-06-15 at 6.47.57 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-06-19 23:39:36.934423+05:30
5242c902-f0cb-424b-a12c-12c7affb55bf	local_public	/uploads/images	/uploads/images/move-vehicles-1782404420590.jpeg	move-vehicles.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-25 21:50:20.629664+05:30
33bb19a7-0b9e-4bf9-b256-c157cb431841	local_public	/uploads/documents	/uploads/documents/move-vehicles-1782405062978.jpeg	move-vehicles.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "73ad7488-1fd7-4f2d-8f05-fdd81b700199"}	2026-06-25 22:01:03.00064+05:30
cba949aa-6860-4106-a1db-d1ba7de2de1a	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_02_46-PM-1782714779213.png	ChatGPT Image Jun 29, 2026, 12_02_46 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 12:02:59.23402+05:30
70abffd5-0b9c-4fa7-acc2-44e4012adb96	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_10_29-PM-1782715236111.png	ChatGPT Image Jun 29, 2026, 12_10_29 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 12:10:36.120485+05:30
7c694347-08dc-4b2f-98ea-a614c2a1bca4	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_13_13-PM-1782715399502.png	ChatGPT Image Jun 29, 2026, 12_13_13 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 12:13:19.511474+05:30
57c96268-1c6c-4490-9fa4-c96ceaefaba3	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_20_10-PM-1782715821772.png	ChatGPT Image Jun 29, 2026, 12_20_10 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 12:20:21.788883+05:30
63d901fb-7bbc-4525-a5ea-1bb983f14f18	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-01_43_53-PM-1782720932335.png	ChatGPT Image Jun 29, 2026, 01_43_53 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 13:45:32.367735+05:30
e76e15ae-d1bd-420c-b2c6-17bae984e415	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_10_29-PM-1782720941858.png	ChatGPT Image Jun 29, 2026, 12_10_29 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 13:45:41.863439+05:30
85695966-b6cf-410c-89c6-5c170748b000	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_13_13-PM-1782720950566.png	ChatGPT Image Jun 29, 2026, 12_13_13 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 13:45:50.573426+05:30
c8c1817d-aff3-457e-a5a9-8e59857890eb	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_20_10-PM-1782720958939.png	ChatGPT Image Jun 29, 2026, 12_20_10 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 13:45:58.94483+05:30
6c04f0f4-81d6-4dd8-82f6-a4947ca89035	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-02_40_43-PM-1782724312970.png	ChatGPT Image Jun 29, 2026, 02_40_43 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-06-29 14:41:52.984056+05:30
fd1b19ce-7f35-4656-bb8d-d9c96525ed4e	local_public	/uploads/images	/uploads/images/ZIGO-Post-Home-Help-1782984780405.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 15:03:00.412986+05:30
154e9163-bce7-48df-8b23-fe703d6e2291	local_public	/uploads/images	/uploads/images/ZIGO-Post-Urgent-Help-1783000354838.png	ZIGO-Post-Urgent-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 19:22:34.85447+05:30
df8cd856-f63e-4cda-a143-af688de58bd2	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783002998425.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-02 20:06:38.434931+05:30
dcf31502-863a-47a9-9777-25113df1339e	local_public	/uploads/images	/uploads/images/Personal-Assistance-1783014047328.png	Personal Assistance.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:10:47.347153+05:30
74139e75-6505-43a3-8ba2-9ed005ffb8ac	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014062219.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:02.235477+05:30
b0644409-88fe-4ebc-a0f3-099c0f94b3e5	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014064850.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:04.864489+05:30
ebe8595f-4360-43d8-bba4-e4ba32309be4	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014068293.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:08.308522+05:30
c720efd2-1410-4eda-af57-ce0e10268a21	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014062219.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:11:11.614169+05:30
907d017f-54ab-4cda-8bc4-7edc4dddcd80	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014064850.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:11:11.668596+05:30
02dfd50d-2899-4882-981e-30cc35ff9d23	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014068293.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:11:11.683359+05:30
7680ea36-407b-4e80-963d-7847445fd8f5	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014089296.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:29.31175+05:30
cbb5783e-3e09-42ad-a95d-01c91a253b52	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Personal-Help-Story-1783014101614.png	ZIGO-Post-Personal-Help-Story.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:41.620284+05:30
70f72aa7-84eb-423d-bfca-2d30fbe7370b	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014108814.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:11:48.820967+05:30
112915e4-5c04-4538-b362-5b4d1acba680	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014126504.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:12:06.510226+05:30
a07871f8-50cd-4d6e-890e-98e2ed63b05c	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014129547.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:12:09.556283+05:30
7a362054-14e1-4ef6-bd66-bef959eb3c17	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1080x1350-1783014132445.png	ZIGO-Post-Home-Help-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:12:12.453115+05:30
7a0bef73-e93e-44e0-ac58-da2abb5f664b	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014160341.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:12:40.35338+05:30
3eeec50d-f23a-49f2-a91e-53187dd04a97	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783014911745.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:25:11.810002+05:30
ab82d010-2158-4d8e-8332-d5235e783438	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1080x1350-1783015132254.png	ZIGO-Post-Home-Help-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:28:52.281073+05:30
f4add353-0f83-4b34-9736-b2ef42607cc5	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1080x1350-1783015132254.png	ZIGO-Post-Home-Help-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:28:53.959473+05:30
27196ad8-9541-4f24-8c2b-1b898a19a0f9	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783015142409.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:29:02.464768+05:30
e9d88f2b-4055-4578-a9b8-d497710b755c	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783015148069.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-02 23:29:08.104308+05:30
d4ef7811-6adf-4380-be14-7cff45ea7d38	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783015142409.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:29:09.215123+05:30
2cc0e3ab-d473-4f48-9b81-622adc76945e	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783015148069.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-02 23:29:09.648961+05:30
d3e3368f-b2fb-4ca1-8cf7-14d4d1b0a3fc	local_public	/uploads/images	/uploads/images/ZIGO-Post-Urgent-Help-1783022244920.png	ZIGO-Post-Urgent-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:24.92906+05:30
8ae05fe1-ac48-425b-b927-f07236ec3fcf	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-01_43_53-PM-1783022250440.png	ChatGPT Image Jun 29, 2026, 01_43_53 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:30.448605+05:30
a9b1affe-41a9-4940-9eef-04c6e95a7c88	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783022259138.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:39.148505+05:30
c8d3f02a-8417-48be-93db-555c594edb38	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783022263045.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:43.052865+05:30
01be3387-ecd6-4077-be60-df6a008595cc	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-25-PM-1783022265684.jpeg	WhatsApp Image 2026-06-30 at 1.17.25 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:45.69004+05:30
dbd09729-64ce-47bb-b60c-40ac56b09f2b	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-26-PM-1783022269264.jpeg	WhatsApp Image 2026-06-30 at 1.17.26 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:49.271046+05:30
bd56c05b-f55b-4287-ba82-9932a5285d8a	local_public	/uploads/documents	/uploads/documents/ChatGPT-Image-Jun-29-2026-02_40_43-PM-1783022273294.png	ChatGPT Image Jun 29, 2026, 02_40_43 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:53.300893+05:30
0b0e11c7-6f9e-4899-a6c3-be05b93573a8	local_public	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-25-PM-1783022275928.jpeg	WhatsApp Image 2026-06-30 at 1.17.25 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-03 01:27:55.933583+05:30
fac13114-8a0a-4d2d-8040-8d8405ddc66b	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783022259138.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.561039+05:30
ac83816a-4456-4d1c-903b-9e0e237e7753	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-25-PM-1783022265684.jpeg	WhatsApp Image 2026-06-30 at 1.17.25 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.592167+05:30
0f290dc9-71f1-4719-aaee-2d1616fa6f7e	external_url	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783022263045.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.611717+05:30
960d2d62-dc84-4627-ae9a-675f1e12c06d	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-26-PM-1783022269264.jpeg	WhatsApp Image 2026-06-30 at 1.17.26 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.63171+05:30
4706d164-45bd-47a2-b93b-21da291592f9	external_url	/uploads/documents	/uploads/documents/WhatsApp-Image-2026-06-30-at-1-17-25-PM-1783022275928.jpeg	WhatsApp Image 2026-06-30 at 1.17.25 PM.jpeg	image/jpeg	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.646739+05:30
d08136b2-48d0-47f1-af7a-b108862d6e72	external_url	/uploads/documents	/uploads/documents/ChatGPT-Image-Jun-29-2026-02_40_43-PM-1783022273294.png	ChatGPT Image Jun 29, 2026, 02_40_43 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents"}	2026-07-03 01:28:04.66625+05:30
2d64ae5f-9b5a-469d-860f-66919106d438	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1080x1350-1783056167192.png	ZIGO-Post-Mogambo-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-03 10:52:47.210344+05:30
ec289970-21e9-4663-8fd6-40f8ff95d771	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1080x1350-1783056169535.png	ZIGO-Post-Mogambo-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-03 10:52:49.550264+05:30
f0abfc79-883b-491f-aaa2-0ea4e3672d8a	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1783056818957.png	ZIGO-Post-Mogambo.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-03 11:03:38.967812+05:30
5c23ab13-40e2-4756-b5d0-5784102bab12	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1783059117790.png	ZIGO-Post-Mogambo.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-03 11:41:57.798912+05:30
a6a479cb-48b0-4e5b-a968-7265ae919ced	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1783061986080.png	ZIGO-Post-Mogambo.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-03 12:29:46.334582+05:30
eaa89a36-960e-4a19-ba25-179efc80009a	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1783194399104.png	ZIGO-Post-Home-Help.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-05 01:16:39.115162+05:30
3a48bcff-be7c-47ab-8a5b-c04f003de1e4	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Help-1080x1350-1783241809609.png	ZIGO-Post-Home-Help-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "f7cc7ce8-51f6-48dd-a391-0b32e7ab4d29"}	2026-07-05 14:26:49.625604+05:30
2cd9dab0-3d21-42f7-b8bf-3fcac14dafe6	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1783273634830.png	ZIGO-Post-Mogambo.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "f7cc7ce8-51f6-48dd-a391-0b32e7ab4d29"}	2026-07-05 23:17:14.846881+05:30
cecfd213-7727-43c9-802f-fc9ddea8841d	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Mogambo-1080x1350-1783310613995.png	ZIGO-Post-Mogambo-1080x1350.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-06 09:33:34.017823+05:30
38a71f4d-9cb0-4f37-9ff3-271c8237d41c	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-State-Empire-1783333160969.png	ZIGO-Post-State-Empire.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-06 15:49:20.977464+05:30
7a80e729-aadd-454b-993b-6d1601f4c804	local_public	/uploads/documents	/uploads/documents/ChatGPT-Image-Jun-29-2026-12_10_29-PM-1783335110845.png	ChatGPT Image Jun 29, 2026, 12_10_29 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-07-06 16:21:50.854509+05:30
31d7d4fc-b14f-43f7-8994-bc8d68fd32c5	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_13_13-PM-1783584023683.png	ChatGPT Image Jun 29, 2026, 12_13_13 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 13:30:23.707842+05:30
3129ff42-6101-4df1-975b-02b87d04e417	local_public	/uploads/images	/uploads/images/Family-1783584418109.png	Family.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 13:36:58.121671+05:30
8d6ced18-9243-4e79-aee4-dd4616e97827	local_public	/uploads/images	/uploads/images/Health-1783589768180.png	Health.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 15:06:08.20847+05:30
c96c1fce-2d0a-476b-95e9-cd422b887416	local_public	/uploads/images	/uploads/images/Health-1783589809466.png	Health.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 15:06:49.471045+05:30
12e3e9cc-04b2-4875-88ec-abd79668b4ec	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jun-29-2026-12_13_13-PM-1783590397464.png	ChatGPT Image Jun 29, 2026, 12_13_13 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 15:16:37.47798+05:30
a8543e32-66d7-417c-b7f9-31d08369f513	local_public	/uploads/images	/uploads/images/Business-1783592869964.png	Business.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 15:57:49.989179+05:30
7bd09f8b-c089-4d8b-8f05-642f28c337a4	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-9-2026-03_59_27-PM-1783593000390.png	ChatGPT Image Jul 9, 2026, 03_59_27 PM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 16:00:00.396564+05:30
e734a79f-2cc3-48dd-a451-c0ca11910f36	local_public	/uploads/images	/uploads/images/Urgent-1783600431527.png	Urgent.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 18:03:51.551178+05:30
28856f8e-4dec-4d78-b946-a1a271490444	local_public	/uploads/images	/uploads/images/Urgent-1783600823085.png	Urgent.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 18:10:23.110032+05:30
4af7bf70-8dd9-48aa-8e1a-83276da577d2	local_public	/uploads/images	/uploads/images/Tell-Us-1783601159326.png	Tell Us.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-09 18:15:59.349718+05:30
9e08e323-1575-4f10-b246-a78776ee2ebe	local_public	/uploads/documents	/uploads/documents/image-0-4-1784045883813.png	image-0 (4).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "2899aac9-c2c6-44db-be82-d6dfd2b88428"}	2026-07-14 21:48:03.83808+05:30
eeb8d055-1cb8-4b4f-b5f8-7ebcc305d41d	local_public	/uploads/documents	/uploads/documents/image-0-4-1784045887813.png	image-0 (4).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "2899aac9-c2c6-44db-be82-d6dfd2b88428"}	2026-07-14 21:48:07.818268+05:30
652352b2-a2af-42d7-98de-a62e3dc35d9a	local_public	/uploads/images	/uploads/images/image-0-14-1784288480814.png	image-0 (14).png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 17:11:20.827713+05:30
c438e5bf-5deb-4122-a139-f017ba25901b	local_public	/uploads/images	/uploads/images/flash-icon-1784289428594.png	flash-icon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 17:27:08.675996+05:30
b47496c5-d7b5-4649-979a-062f6cd330a1	local_public	/uploads/images	/uploads/images/Family---Copy-1784310514124.png	Family - Copy.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 23:18:34.135138+05:30
cf780368-a4fd-40ac-8fb8-9478be2d58d8	local_public	/uploads/images	/uploads/images/Family-1784310846237.png	Family.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 23:24:06.2421+05:30
f52df06d-546b-4c48-994a-d380d9fcc80c	local_public	/uploads/images	/uploads/images/Health-icon-1784311096225.png	Health-icon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 23:28:16.261648+05:30
0f9b8cea-e2b3-4104-a627-574498a40a0a	local_public	/uploads/images	/uploads/images/health-icon-2-1784311301429.png	health-icon-2.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-17 23:31:41.448757+05:30
211ed09b-f1ae-4d59-9d8d-b1b177fb7ffd	local_public	/uploads/images	/uploads/images/flash-icon-1784314119499.png	flash-icon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 00:18:39.509116+05:30
6051acc3-fbbc-463b-bdce-e8f052895866	local_public	/uploads/images	/uploads/images/flash-3d-icon-png-download-11597500-1784314124312.webp	flash-3d-icon-png-download-11597500.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 00:18:44.316195+05:30
9dff4864-9254-4fdd-865e-11749676e76c	local_public	/uploads/images	/uploads/images/flash-icon-1784314177132.png	flash-icon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 00:19:37.138856+05:30
2d00b6e6-57cd-4532-8a56-6b11e5ae4816	local_public	/uploads/images	/uploads/images/Be-there-1784318838277.png	Be there.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 01:37:18.293904+05:30
15057e2d-6611-4c42-9158-654458e58c63	local_public	/uploads/images	/uploads/images/Urgent-1784318847385.png	Urgent.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 01:37:27.392077+05:30
0cf99fdb-cc1d-4d5b-90db-a525023197e3	local_public	/uploads/images	/uploads/images/Family-1784318914361.png	Family.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 01:38:34.373225+05:30
daef86ca-5cde-45cb-92c4-779abaee4021	local_public	/uploads/images	/uploads/images/Health-1784318921886.png	Health.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 01:38:41.897578+05:30
0e36f957-4335-4b95-82f4-c847b56903aa	local_public	/uploads/images	/uploads/images/4664403-1784321279264.png	4664403.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:17:59.278911+05:30
ab0679bc-b9ed-4589-a9ad-731748080e2e	local_public	/uploads/images	/uploads/images/pngtree-open-door-3d-style-graphic-clipart-png-image_13604980-1784321466133.png	pngtree-open-door-3d-style-graphic-clipart-png-image_13604980.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:21:06.139893+05:30
87ca4ae0-318c-4105-9ca9-a1cb7f983daa	local_public	/uploads/images	/uploads/images/flash-3d-icon-png-download-11597500-1784321891489.png	flash-3d-icon-png-download-11597500.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:28:11.493052+05:30
ca2733e7-8798-4b35-a000-4a823b09f5e0	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_34_08-AM-1784322328013.png	ChatGPT Image Jul 18, 2026, 02_34_08 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:35:28.017539+05:30
9de2ef38-b71b-44f1-b16f-4db0e811574d	local_public	/uploads/images	/uploads/images/Family---Copy-1784322759348.png	Family - Copy.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:42:39.355988+05:30
d92babca-5437-41ae-8613-8a699dc9ef54	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_34_08-AM-1784322830757.png	ChatGPT Image Jul 18, 2026, 02_34_08 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:43:50.762824+05:30
c6b4367c-9a7f-4472-b7a2-5476caa2cbfa	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_40_16-AM-1784322950710.png	ChatGPT Image Jul 18, 2026, 02_40_16 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:45:50.714184+05:30
96567f3b-001f-4f8f-ae07-710298c6428c	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_34_08-AM-1784322991624.png	ChatGPT Image Jul 18, 2026, 02_34_08 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:46:31.628744+05:30
1b901f11-f484-4654-ae56-4fb6898a7fbb	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_40_16-AM-1784322994972.png	ChatGPT Image Jul 18, 2026, 02_40_16 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:46:34.975151+05:30
e02fad36-89b9-4648-8907-7361e24a8acd	local_public	/uploads/images	/uploads/images/Be-there-1784323167201.png	Be there.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:49:27.213186+05:30
dbf9e7d4-8215-4b05-a323-24393162a363	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_54_38-AM-1784323493627.png	ChatGPT Image Jul 18, 2026, 02_54_38 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:54:53.647612+05:30
0bcb132a-2e4c-4074-ab75-211db8b185ff	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_56_29-AM-1784323604936.png	ChatGPT Image Jul 18, 2026, 02_56_29 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 02:56:44.951561+05:30
701ebab1-fe81-4992-af2e-b6b2fb50ab67	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-03_00_28-AM-1784323844837.png	ChatGPT Image Jul 18, 2026, 03_00_28 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:00:44.863159+05:30
ec8c6b03-a5cf-4787-a7c5-fe2e09709c91	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-03_04_38-AM-1784324100886.png	ChatGPT Image Jul 18, 2026, 03_04_38 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:05:00.898913+05:30
7cbcb9b0-f5e7-45ad-a3b8-c605a628fc69	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-03_06_15-AM-1784324190865.png	ChatGPT Image Jul 18, 2026, 03_06_15 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:06:30.870533+05:30
b81c33b8-f9e5-42d3-b638-3bdda7f274ca	local_public	/uploads/images	/uploads/images/ChatGPT-Image-Jul-18-2026-02_54_38-AM-1784324306671.png	ChatGPT Image Jul 18, 2026, 02_54_38 AM.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:08:26.683749+05:30
76a0851f-cfd1-493d-9d44-2151aed50723	local_public	/uploads/images	/uploads/images/conversation-3d-rendering-isometric-icon-png-1784324930861.png	conversation-3d-rendering-isometric-icon-png.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:18:50.874011+05:30
d025ff00-c5b8-4bfb-a076-89d78c576401	local_public	/uploads/images	/uploads/images/badge-3d-icon-png-download-5431315-1784325159923.png	badge-3d-icon-png-download-5431315.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 03:22:39.935509+05:30
b201cad2-406c-4b6f-875a-aa95536855e0	local_public	/uploads/images	/uploads/images/blue-check-mark-verified-profile-account-social-media-symbol-user-interface-them-1784361674275.png	blue-check-mark-verified-profile-account-social-media-symbol-user-interface-theme-3d-icon-render-illustration-isolated-png.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-07-18 13:31:14.286122+05:30
e2d4c42d-61e0-400b-9c66-c23bb95288e5	local_public	/uploads/documents	/uploads/documents/blue-check-mark-verified-profile-account-social-media-symbol-user-interface-them-1784563470383.webp	blue-check-mark-verified-profile-account-social-media-symbol-user-interface-theme-3d-icon-render-illustration-isolated-png.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "2899aac9-c2c6-44db-be82-d6dfd2b88428"}	2026-07-20 21:34:30.402112+05:30
efefae22-1309-41d1-b57f-a1c96ee72a0c	local_public	/uploads/documents	/uploads/documents/badge-3d-icon-png-download-5431315-1784563470433.png	badge-3d-icon-png-download-5431315.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "2899aac9-c2c6-44db-be82-d6dfd2b88428"}	2026-07-20 21:34:30.449674+05:30
3019464c-505d-4bc5-b919-b6df2e460559	local_public	/uploads/documents	/uploads/documents/badge-3d-icon-png-download-5431315-1784563496786.webp	badge-3d-icon-png-download-5431315.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "2899aac9-c2c6-44db-be82-d6dfd2b88428"}	2026-07-20 21:34:56.802895+05:30
a1e49356-ff7e-413a-b724-a44beae13859	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Visit-1785603136155.png	ZIGO-Post-Home-Visit.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-08-01 22:22:16.177272+05:30
1b1ac92c-6cb3-41f3-b480-ec793ddfd2f5	local_public	/uploads/documents	/uploads/documents/ZIGO-Post-Home-Visit-1785608244551.png	ZIGO-Post-Home-Visit.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "0fa93d2c-db6c-4a2c-b7e7-29bca07bd04b"}	2026-08-01 23:47:24.562409+05:30
20e38df6-9b1e-49c0-bac6-cfadce991358	local_public	/uploads/images	/uploads/images/flash-3d-icon-png-download-11597500-1785610429823.webp	flash-3d-icon-png-download-11597500.webp	image/webp	\N	\N	{"preview": true, "savePath": "/uploads/images", "uploadedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42"}	2026-08-02 00:23:49.838033+05:30
e4aeb5b9-2069-49fe-bf28-36edabe0931c	local_public	/uploads/documents	/uploads/documents/accompany-icon-1786025706521.png	accompany-icon.png	image/png	\N	\N	{"preview": true, "savePath": "/uploads/documents", "uploadedBy": "c5f28036-7620-4f39-856b-4ad91b206edb"}	2026-08-06 19:45:06.562114+05:30
\.


--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.idempotency_keys (id, key, actor_user_id, request_hash, response_status, response_body, locked_until, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: invoice_lines; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.invoice_lines (id, invoice_id, line_type_id, description, quantity, unit_amount, total_amount, metadata) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.invoices (id, request_id, customer_id, invoice_number, status_id, subtotal, tax_amount, discount_amount, total_amount, currency, issued_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: lookup_groups; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.lookup_groups (id, code, name, description, is_system, created_at, updated_at) FROM stdin;
c22d35bc-faa5-4753-a203-a91061645fc2	status	Status	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
c37d31c0-fd8a-42fa-bd46-6ae4ac6ea334	app_type	Application Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
fb419ec1-188c-4c8d-9732-3f9c2e1216fc	booking_mode	Booking Mode	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
6c049eab-f2f9-48c1-8a71-704447789c8a	actor_type	Actor Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
82dbda81-da3a-4ce0-bd3c-622e381955e3	place_type	Place Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
ffe76899-d271-47f9-bebe-ec21985ef3fe	stop_type	Stop Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
c8e0def5-7eda-48be-876c-e10088596d03	payment_gateway	Payment Gateway	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
8d4ca169-58bd-434d-a682-fb777c137663	notification_channel	Notification Channel	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
d65e8398-1563-4164-b75e-5db2352590e8	proof_type	Proof Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
425e4400-b0e8-4c6f-9789-02e3e707545d	policy_type	Policy Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
ea9058ae-d957-4a03-8e3d-b0756094cc24	pricing_rule_type	Pricing Rule Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
8590b62f-d017-4601-a60b-b00a9f096e5f	admin_action_type	Admin Action Type	\N	t	2026-05-15 12:23:11.276519+05:30	2026-05-15 12:23:11.276519+05:30
b17a1475-246b-413b-a464-d8c61df878f1	delivery_type	Delivery Type	Delivery type master	t	2026-05-15 17:57:54.756766+05:30	2026-07-29 20:20:06.691141+05:30
\.


--
-- Data for Name: lookup_values; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.lookup_values (id, group_id, code, name, description, sort_order, color, icon, is_active, is_system, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: membership_plans; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.membership_plans (id, code, name, priority_level, free_minutes_per_task, support_sla_minutes, pricing_policy_id, cancellation_policy_id, is_active, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: module_permissions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.module_permissions (module_id, permission_id, created_at) FROM stdin;
2c5c50f0-8aaf-44d2-908c-895621613c61	862f248d-e813-4030-a7be-91fb08f30d49	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	c2e62b9c-c66a-43ff-9df8-ee3cd21f74bc	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	c1f80c24-843c-44c1-9dd5-c635e93184e2	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	cdfb267b-f594-4d42-b2f2-a41fad0779cb	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	23f07774-afd7-4c6e-a939-84c15e2cd1f2	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	279a5080-5af4-4943-b42f-a981d7fdcd73	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	299b4d74-ca8e-42a3-97a6-11e9aafd19b9	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	a9a50b8c-a151-4182-9d49-35115603135b	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	275837db-7132-4268-afdb-9bc332ccfb60	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	ec80a208-ec72-4e92-98de-40fad59c1903	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	373fae1f-b774-4c23-9cef-25568047317c	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	119ac34f-cb48-4f1b-8840-e1df24a48be4	2026-05-16 16:13:13.754199+05:30
c5248736-a224-422e-ae90-55be39e4740c	90121e4d-5f4d-4a95-a819-cdc1c067a82d	2026-05-16 16:13:13.754199+05:30
68cca97b-d5eb-4505-8048-bc5084ddc82e	d6a51a03-6c7d-4714-9078-e8618c66a884	2026-05-16 16:13:13.754199+05:30
68cca97b-d5eb-4505-8048-bc5084ddc82e	c4b0f537-702e-435d-a056-99270bea1356	2026-05-16 16:13:13.754199+05:30
68cca97b-d5eb-4505-8048-bc5084ddc82e	eafc74da-41a4-4201-81a9-2ffedabdc7bc	2026-05-16 16:13:13.754199+05:30
68cca97b-d5eb-4505-8048-bc5084ddc82e	bc62ac0a-6211-4d71-8fd3-560a19458eec	2026-05-16 16:13:13.754199+05:30
68cca97b-d5eb-4505-8048-bc5084ddc82e	8119c885-6424-4594-aeba-67c261a82121	2026-05-16 16:13:13.754199+05:30
5db18bf1-d949-46da-ab1d-d48baf159955	1d90a618-7e70-4975-9de5-e6712a22b69a	2026-05-16 16:13:13.754199+05:30
5db18bf1-d949-46da-ab1d-d48baf159955	170eafd1-c9e6-417f-86bb-154889daace1	2026-05-16 16:13:13.754199+05:30
5db18bf1-d949-46da-ab1d-d48baf159955	49d6c0da-7df5-424c-a0d4-5850dd665a04	2026-05-16 16:13:13.754199+05:30
5db18bf1-d949-46da-ab1d-d48baf159955	2f4f5d52-82e6-4c83-9da1-e0dd5ce610f4	2026-05-16 16:13:13.754199+05:30
5db18bf1-d949-46da-ab1d-d48baf159955	5aa564e4-030b-4bef-8740-a5b7101631aa	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	5dccc688-6bf5-4bf3-b0bf-a638980c1928	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	35351d24-f9df-42b1-9fee-7f9303d8016c	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	ba6c38ce-a8eb-4a60-a62e-0a8f22290427	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	da8a080a-abe3-4d89-ab55-e3d2a530c86d	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	0308f6c2-8e7d-4280-8ea5-53d19b73b98c	2026-05-16 16:13:13.754199+05:30
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	9b68b813-b4af-4351-92c4-019bd863510c	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	d22a5f21-0ddb-4264-ab77-5b4cb5fbfaba	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	3dcfb8d3-799d-438e-8901-faafe7614084	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	13b98ff5-498b-41d7-9ea4-32b10228c2f9	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	0792d3c2-ce09-4ff3-ac7d-d8b08a51c39a	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	1f8417c3-413b-4de0-b24e-69bed69ef092	2026-05-16 16:13:13.754199+05:30
bce23272-5ead-417d-94d8-49b48392f3ae	08c5d23e-4f57-4342-8c02-895d1923f52d	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	bb02ac84-ab6c-478f-a18f-d690613937a8	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	b88ecbae-5515-436a-b720-0a9195158301	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	e1d490a9-b860-46d8-8681-807dc8002a42	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	b5e66dce-bd2c-42b5-b6d1-b122dbcddd98	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	09d34905-ed9d-4eb7-8a91-d92073bf32f5	2026-05-16 16:13:13.754199+05:30
f35abcb7-3b44-4939-91d3-d3039556483b	97e00fae-34c7-42b5-a24e-0fe959076596	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	b74fcd7d-41f7-4e8b-ae7b-bcca0d67a2a7	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	eb2a2e46-4dd7-4bbc-a683-7a6f9a773705	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	f7a5528d-0f47-46c7-9442-a8f8916e28ac	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	89750879-1c15-4a3d-97b4-f8746f861a4e	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	aac6910a-3508-4367-845f-57c7df0515bb	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	db185052-0214-4815-89e2-36c1533d2c19	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	451725e4-33e2-4923-9ed8-0489a8ef9eed	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	b9446e22-d5cf-40df-baad-b23a946e4f01	2026-05-16 16:13:13.754199+05:30
0ef806ca-3ba8-43a3-a893-2bdbde85e069	bba80e6e-a631-4809-87d6-ac82995a18fb	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	27fdc2ac-792c-4ba5-8bb8-ea6183052536	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	5097285c-b5e5-466a-9592-c90ebff3b01b	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	2054df65-7e75-4e9b-9f1a-acb185c2019f	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	e0d0511b-27f0-430f-b0ec-07a1e6d49e66	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	bd4bf192-cd38-48cc-9984-23116b52373b	2026-05-16 16:13:13.754199+05:30
99c062b6-3584-48b5-bbfe-7886bd82ffd9	a520a36e-da32-42bc-963d-e23da6e75111	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	240bd245-df84-4fcf-9d2f-75eeba06bedc	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	6bb47618-2a2e-4aea-a3d8-f399190b82e9	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	8c95e657-7151-4e71-a5c3-f877bba2307c	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	68328adf-d6e5-443e-be5a-2f2e9e4de851	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	0e8754dd-45de-4cf8-99ca-958741b5cb8c	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	d9d725c7-fc40-4811-a9e5-eb5149076039	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	c844e701-02a3-4d64-b8a3-4f472e973a7a	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	aa5d71a1-3738-4bac-b6ba-9e48f22adff8	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	f641182b-4295-4195-badd-9a44eb655868	2026-05-16 16:13:13.754199+05:30
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	2ecb508a-8a77-4173-abdb-11dd93749874	2026-05-16 16:13:13.754199+05:30
7ea3e43e-8979-4325-88f2-9392ff8f6518	a40f17ec-90bc-4008-a79c-74280953eb45	2026-05-16 16:13:13.754199+05:30
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	45ccd203-f351-439b-a4e6-9724aebfd7b5	2026-05-16 16:13:13.754199+05:30
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	d685caa8-6a19-4417-ac45-2a97c3a157ce	2026-05-16 16:13:13.754199+05:30
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	b64dd7ff-f627-4b99-ab9b-47e843a5b823	2026-05-16 16:13:13.754199+05:30
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	2ccc1e84-b1e7-4d74-b77c-9c61f17e26ba	2026-05-16 16:13:13.754199+05:30
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	a5358b58-9998-49f7-8755-cecb1cb39abe	2026-05-16 16:13:13.754199+05:30
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	a4ccf195-bc15-45d7-920e-d9f1bff4dce6	2026-05-16 16:13:13.754199+05:30
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	950fde98-02a8-4c82-ae68-f94f09276f68	2026-05-16 16:13:13.754199+05:30
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	0165b2d5-b5df-459b-9601-8299d670e289	2026-05-16 16:13:13.754199+05:30
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	05b04b18-b4ac-423b-97ee-70f554708ef3	2026-05-16 16:13:13.754199+05:30
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	9015f0d0-5574-42a3-bb1a-c89488e7eb95	2026-05-16 16:13:13.754199+05:30
a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	79f5150a-704c-42b5-9e29-d054b73255d4	2026-05-16 16:13:13.754199+05:30
a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	b1458cf0-e600-47f7-ae51-f5b2905d70f5	2026-05-16 16:13:13.754199+05:30
a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	050d14ab-972b-416d-a34d-ccbc24de1e7e	2026-05-16 16:13:13.754199+05:30
a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	29ca70cb-a202-4e4d-9514-e6e7c63489e0	2026-05-16 16:13:13.754199+05:30
7acecae1-3d58-4ad8-8335-bef68979e8ac	6a409ce8-bfe5-49b3-9e3b-8afb451b07ce	2026-05-16 16:13:13.754199+05:30
7acecae1-3d58-4ad8-8335-bef68979e8ac	a960946d-f81d-4e0b-8e0e-b7a9d8a8d45b	2026-05-16 16:13:13.754199+05:30
7acecae1-3d58-4ad8-8335-bef68979e8ac	49336c4d-7121-4450-b42a-915537ffb5f9	2026-05-16 16:13:13.754199+05:30
7acecae1-3d58-4ad8-8335-bef68979e8ac	8b525d1b-8fc9-424c-8665-8bb5c8ebf111	2026-05-16 16:13:13.754199+05:30
7acecae1-3d58-4ad8-8335-bef68979e8ac	537b2ee5-d9a9-47ec-9572-6f97df2856d5	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	616c3e2e-73ce-4bcc-a8c0-9427d6554aed	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	4594b0c6-cd74-450f-b7ce-a43474552cd1	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	3fe85e2c-a730-4c31-83f7-b36270fcf9d9	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	e288a7af-6aa2-4d2a-a26d-64c1d56d0099	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	f85c1f8c-6dc7-4722-813b-c2138c96d4f0	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	62bcc3e5-d2b5-4605-a745-8c9180ef57a1	2026-05-16 16:13:13.754199+05:30
963466ea-6624-4a27-b9af-ac1acb37526c	61a705fb-cf85-451f-b83f-1ed83152f050	2026-05-16 16:13:13.754199+05:30
963466ea-6624-4a27-b9af-ac1acb37526c	5fd7fd3d-da16-49fd-a0f9-0d00977fb320	2026-05-16 16:13:13.754199+05:30
963466ea-6624-4a27-b9af-ac1acb37526c	731e39ab-ea65-4e1b-a429-0364f476f8a2	2026-05-16 16:13:13.754199+05:30
963466ea-6624-4a27-b9af-ac1acb37526c	3fc8233a-8283-46e0-9814-1a0123bf5fac	2026-05-16 16:13:13.754199+05:30
f735f877-6755-4404-a601-3640dbcd632c	62fb3290-6911-4902-ab65-f176ffdc1d85	2026-05-16 16:13:13.754199+05:30
f735f877-6755-4404-a601-3640dbcd632c	9ad8d5aa-9f69-4bcc-b76d-b328b11475cf	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	64125155-d343-4851-b15e-d80701b87562	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	f461ca05-df36-409b-8fcf-9d5640b1b146	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	bbee18d9-ad72-407f-9935-4c927aeed84f	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	bd9d0069-0d18-4efb-b821-8fe06136b52c	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	ace10930-7d4e-4cca-a7f5-d26f840b67ff	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	31add8d1-ee92-44a0-b7e7-bb978d6c02ed	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	928fa792-0c2f-40fc-8565-be7b64ac826e	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	808c48c1-6697-4f80-a0cb-d8731f51329c	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	39a5f1ee-cff3-42d0-8ab9-190d8aabb064	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	8d1d3474-1342-4509-8cb0-fb496462651b	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	2f2e69e6-1dd3-4b25-bea5-a4e1df8f1a55	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	09a7a248-05c5-4f56-a884-f8efe3d9a862	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	bff8c22d-a2da-4192-ae57-8962002c4e74	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	2d53e3d8-589c-4a51-b80b-fd44b5668510	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	30d634af-7a91-4cb0-b8d8-34d04d9054f1	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	2ffa98d4-c0b3-4ef3-b4e2-634027052dce	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	c7b979e1-1fe0-430e-bf17-f9e61c69319d	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	57cee495-547e-4726-98e4-15a737e08a4a	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	0cced2c9-2597-4865-95a5-17d2373a19ac	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	03bf0d9e-795f-4180-9032-fc0fecdc886f	2026-05-16 16:13:13.754199+05:30
2c5c50f0-8aaf-44d2-908c-895621613c61	74d6824d-02b5-4750-9810-fb258ef8b2c0	2026-05-16 16:13:13.754199+05:30
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	d4abd3f4-76e0-41b2-a5d9-677187c33499	2026-05-16 16:13:13.754199+05:30
f735f877-6755-4404-a601-3640dbcd632c	a91e9a9d-5aa4-41ca-a911-57da5cce10c9	2026-05-16 16:13:13.754199+05:30
\.


--
-- Data for Name: modules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.modules (id, code, name, description, is_active, sort_order, created_at, updated_at, created_by, updated_by, deleted_by, deleted_at, is_deleted) FROM stdin;
422ae9e0-a652-4f1a-92ad-db09d16d1774	customer_app	Customer App	\N	t	20	2026-05-15 19:30:24.937357+05:30	2026-05-15 19:30:24.937357+05:30	\N	\N	\N	\N	f
a11c4c52-8b51-4ef9-9e91-29ce95115852	assistant_app	Assistant App	\N	t	30	2026-05-15 19:30:24.937357+05:30	2026-05-15 19:30:24.937357+05:30	\N	\N	\N	\N	f
be0d067f-2d42-41c9-a866-bab4f38b6f2c	admin_panel	Admin Panel	\N	t	10	2026-05-15 19:30:24.937357+05:30	2026-05-15 23:45:31.276586+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f
2c5c50f0-8aaf-44d2-908c-895621613c61	system_control	System Control	Access control, modules, roles, and permissions	t	10	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
c5248736-a224-422e-ae90-55be39e4740c	users	Users	Platform user management	t	20	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
68cca97b-d5eb-4505-8048-bc5084ddc82e	customers	Customers	Customer profile and customer operations	t	30	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
5db18bf1-d949-46da-ab1d-d48baf159955	assistants	Assistants	Assistant profile, verification, and operations	t	40	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	verification	Verification	Role verification rules, document types, assistant vehicle verification	t	45	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
bce23272-5ead-417d-94d8-49b48392f3ae	locations	Locations	States, cities, clusters, zones, and service geography	t	50	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
f35abcb7-3b44-4939-91d3-d3039556483b	stores	Stores	Store setup, store clusters, and store activation	t	60	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
0ef806ca-3ba8-43a3-a893-2bdbde85e069	services	Services	Services, categories, duration, price, and active cluster mapping	t	70	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
99c062b6-3584-48b5-bbfe-7886bd82ffd9	service_requests	Service Requests	Customer requests and workflow state	t	80	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
ad0976f7-ef0e-4e18-a99c-f0c133d776a2	tasks	Tasks	Task generation, assignment, switching, closing, review, and issue resolution	t	90	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
7ea3e43e-8979-4325-88f2-9392ff8f6518	orders	Orders	Orders and customer order view	t	100	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	payments	Payments	Payments, refunds, invoices, and settlements	t	110	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
24042ccf-dfa0-4273-9d9b-99fdfd99dc10	discounts	Discounts	Discounts, compensation, and customer issue resolution credits	t	120	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
708c4b30-d23e-4680-85d9-d5d7b8ba71ed	reports	Reports	Customer, assistant, admin-created roles, and user reports	t	130	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	wallets	Wallets	Wallets and wallet ledger	t	140	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
7acecae1-3d58-4ad8-8335-bef68979e8ac	notifications	Notifications	Notifications, templates, and delivery logs	t	150	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
963466ea-6624-4a27-b9af-ac1acb37526c	settings	Settings	Configuration, feature flags, and policy setup	t	160	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
f735f877-6755-4404-a601-3640dbcd632c	audit_logs	Audit Logs	Admin actions and event history	t	170	2026-05-16 16:13:13.754199+05:30	2026-07-08 09:02:26.340362+05:30	\N	\N	\N	\N	f
\.


--
-- Data for Name: notification_deliveries; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.notification_deliveries (id, notification_event_id, template_id, user_id, channel_id, status_id, provider_reference, sent_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: notification_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.notification_events (id, event_code, entity_type, entity_id, payload, created_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.notification_templates (id, code, name, channel_id, audience_id, subject_template, body_template, is_active, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.organizations (id, name, code, organization_type_id, status_id, config, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.outbox_events (id, event_name, aggregate_type, aggregate_id, payload, status_id, attempts, available_at, processed_at, created_at) FROM stdin;
\.


--
-- Data for Name: payment_intents; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.payment_intents (id, request_id, customer_id, intent_type_id, amount, currency, status_id, gateway_id, gateway_reference, metadata, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: payment_mode_masters; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.payment_mode_masters (id, code, name, scope_type, state_id, city_id, zone_id, cluster_id, sort_order, description, metadata, is_enabled, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
564be149-c36f-4dab-ac2e-832091b40762	ONLINE	Online Payments	all	\N	\N	\N	\N	3	\N	{"icon": "receipt", "handler": "razorpay", "subtitle": "Cards, UPI, Wallet and Netbanking", "customerSelectable": true}	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 00:15:21.618347+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 00:38:38.881641+05:30	\N	\N	f
f4ccf9cf-ec53-4979-914d-e6ec6e7ff16d	WALLET	ZIGO Wallet	all	\N	\N	\N	\N	1	\N	{"icon": "wallet", "handler": "wallet", "subtitle": null, "customerSelectable": true}	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 00:14:28.38129+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 00:38:51.039469+05:30	\N	\N	f
a8747723-927f-49bd-97f9-76f1fcc0b444	CASH	Cash	all	\N	\N	\N	\N	2	\N	{"icon": "receipt", "handler": "cash", "subtitle": null, "customerSelectable": true}	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 00:14:08.224374+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-21 14:22:53.920258+05:30	\N	\N	f
\.


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.payment_transactions (id, service_request_id, provider, merchant_order_id, provider_transaction_id, amount_paise, currency, status_code, checksum, return_payload, webhook_payload, verified_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_webhooks; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.payment_webhooks (id, provider, merchant_order_id, provider_transaction_id, event_status, payload, received_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.payments (id, payment_intent_id, request_id, customer_id, amount, currency, status_id, gateway_id, gateway_payment_id, paid_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.permissions (id, code, name, description, module, created_at, is_active, created_by, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
e2c31cb3-c2c2-49a1-8134-d168bf54eea5	roles.add	Add Roles	Add Role	Roles	2026-05-15 23:04:36.329641+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:04:36.329641+05:30	\N	\N	f
d310307c-5abf-466d-b1c5-61338877335c	roles.update	Update Roles	Update Roles	Roles	2026-05-15 23:05:00.392339+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:05:00.392339+05:30	\N	\N	f
862f248d-e813-4030-a7be-91fb08f30d49	system_control.view	View System Control	View System Control permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
c2e62b9c-c66a-43ff-9df8-ee3cd21f74bc	system_control.create	Create System Control	Create System Control permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
c1f80c24-843c-44c1-9dd5-c635e93184e2	system_control.edit	Edit System Control	Edit System Control permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
cdfb267b-f594-4d42-b2f2-a41fad0779cb	system_control.delete	Delete System Control	Delete System Control permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
23f07774-afd7-4c6e-a939-84c15e2cd1f2	system_control.assign	Assign System Control	Assign System Control permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
299b4d74-ca8e-42a3-97a6-11e9aafd19b9	users.create	Create Users	Create Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a9a50b8c-a151-4182-9d49-35115603135b	users.edit	Edit Users	Edit Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
275837db-7132-4268-afdb-9bc332ccfb60	users.delete	Delete Users	Delete Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
ec80a208-ec72-4e92-98de-40fad59c1903	users.activate	Activate Users	Activate Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
373fae1f-b774-4c23-9cef-25568047317c	users.deactivate	Deactivate Users	Deactivate Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
119ac34f-cb48-4f1b-8840-e1df24a48be4	users.assign_role	Assign Role Users	Assign Role Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
90121e4d-5f4d-4a95-a819-cdc1c067a82d	users.assign_permission	Assign Permission Users	Assign Permission Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
d6a51a03-6c7d-4714-9078-e8618c66a884	customers.view	View Customers	View Customers permission	customers	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
c4b0f537-702e-435d-a056-99270bea1356	customers.create	Create Customers	Create Customers permission	customers	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
eafc74da-41a4-4201-81a9-2ffedabdc7bc	customers.edit	Edit Customers	Edit Customers permission	customers	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bc62ac0a-6211-4d71-8fd3-560a19458eec	customers.delete	Delete Customers	Delete Customers permission	customers	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
8119c885-6424-4594-aeba-67c261a82121	customers.block	Block Customers	Block Customers permission	customers	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
1d90a618-7e70-4975-9de5-e6712a22b69a	assistants.view	View Assistants	View Assistants permission	assistants	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
170eafd1-c9e6-417f-86bb-154889daace1	assistants.create	Create Assistants	Create Assistants permission	assistants	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
49d6c0da-7df5-424c-a0d4-5850dd665a04	assistants.edit	Edit Assistants	Edit Assistants permission	assistants	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2f4f5d52-82e6-4c83-9da1-e0dd5ce610f4	assistants.delete	Delete Assistants	Delete Assistants permission	assistants	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
5aa564e4-030b-4bef-8740-a5b7101631aa	assistants.verify	Verify Assistants	Verify Assistants permission	assistants	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
5dccc688-6bf5-4bf3-b0bf-a638980c1928	verification.view	View Verification	View Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
35351d24-f9df-42b1-9fee-7f9303d8016c	verification.create	Create Verification	Create Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
ba6c38ce-a8eb-4a60-a62e-0a8f22290427	verification.edit	Edit Verification	Edit Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
da8a080a-abe3-4d89-ab55-e3d2a530c86d	verification.delete	Delete Verification	Delete Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
0308f6c2-8e7d-4280-8ea5-53d19b73b98c	verification.approve	Approve Verification	Approve Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
9b68b813-b4af-4351-92c4-019bd863510c	verification.reject	Reject Verification	Reject Verification permission	verification	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
d22a5f21-0ddb-4264-ab77-5b4cb5fbfaba	locations.view	View Locations	View Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
3dcfb8d3-799d-438e-8901-faafe7614084	locations.create	Create Locations	Create Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
13b98ff5-498b-41d7-9ea4-32b10228c2f9	locations.edit	Edit Locations	Edit Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
0792d3c2-ce09-4ff3-ac7d-d8b08a51c39a	locations.delete	Delete Locations	Delete Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
1f8417c3-413b-4de0-b24e-69bed69ef092	locations.activate	Activate Locations	Activate Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
08c5d23e-4f57-4342-8c02-895d1923f52d	locations.deactivate	Deactivate Locations	Deactivate Locations permission	locations	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bb02ac84-ab6c-478f-a18f-d690613937a8	stores.view	View Stores	View Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b88ecbae-5515-436a-b720-0a9195158301	stores.create	Create Stores	Create Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
e1d490a9-b860-46d8-8681-807dc8002a42	stores.edit	Edit Stores	Edit Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b5e66dce-bd2c-42b5-b6d1-b122dbcddd98	stores.delete	Delete Stores	Delete Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
09d34905-ed9d-4eb7-8a91-d92073bf32f5	stores.activate	Activate Stores	Activate Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
97e00fae-34c7-42b5-a24e-0fe959076596	stores.deactivate	Deactivate Stores	Deactivate Stores permission	stores	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b74fcd7d-41f7-4e8b-ae7b-bcca0d67a2a7	services.view	View Services	View Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
eb2a2e46-4dd7-4bbc-a683-7a6f9a773705	services.create	Create Services	Create Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
f7a5528d-0f47-46c7-9442-a8f8916e28ac	services.edit	Edit Services	Edit Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
89750879-1c15-4a3d-97b4-f8746f861a4e	services.delete	Delete Services	Delete Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
aac6910a-3508-4367-845f-57c7df0515bb	services.activate	Activate Services	Activate Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
db185052-0214-4815-89e2-36c1533d2c19	services.deactivate	Deactivate Services	Deactivate Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
451725e4-33e2-4923-9ed8-0489a8ef9eed	services.map_cluster	Map Cluster Services	Map Cluster Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b9446e22-d5cf-40df-baad-b23a946e4f01	services.price	Price Services	Price Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bba80e6e-a631-4809-87d6-ac82995a18fb	services.duration	Duration Services	Duration Services permission	services	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
27fdc2ac-792c-4ba5-8bb8-ea6183052536	service_requests.view	View Service Requests	View Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
5097285c-b5e5-466a-9592-c90ebff3b01b	service_requests.create	Create Service Requests	Create Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2054df65-7e75-4e9b-9f1a-acb185c2019f	service_requests.edit	Edit Service Requests	Edit Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
e0d0511b-27f0-430f-b0ec-07a1e6d49e66	service_requests.delete	Delete Service Requests	Delete Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bd4bf192-cd38-48cc-9984-23116b52373b	service_requests.assign	Assign Service Requests	Assign Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a520a36e-da32-42bc-963d-e23da6e75111	service_requests.cancel	Cancel Service Requests	Cancel Service Requests permission	service_requests	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
240bd245-df84-4fcf-9d2f-75eeba06bedc	tasks.view	View Tasks	View Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
6bb47618-2a2e-4aea-a3d8-f399190b82e9	tasks.create	Create Tasks	Create Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
8c95e657-7151-4e71-a5c3-f877bba2307c	tasks.edit	Edit Tasks	Edit Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
68328adf-d6e5-443e-be5a-2f2e9e4de851	tasks.delete	Delete Tasks	Delete Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
0e8754dd-45de-4cf8-99ca-958741b5cb8c	tasks.generate	Generate Tasks	Generate Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
d9d725c7-fc40-4811-a9e5-eb5149076039	tasks.assign	Assign Tasks	Assign Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
c844e701-02a3-4d64-b8a3-4f472e973a7a	tasks.switch	Switch Tasks	Switch Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
aa5d71a1-3738-4bac-b6ba-9e48f22adff8	tasks.close	Close Tasks	Close Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
f641182b-4295-4195-badd-9a44eb655868	tasks.review	Review Tasks	Review Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2ecb508a-8a77-4173-abdb-11dd93749874	tasks.resolve_issue	Resolve Issue Tasks	Resolve Issue Tasks permission	tasks	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a40f17ec-90bc-4008-a79c-74280953eb45	orders.view	View Orders	View Orders permission	orders	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
45ccd203-f351-439b-a4e6-9724aebfd7b5	payments.view	View Payments	View Payments permission	payments	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
d685caa8-6a19-4417-ac45-2a97c3a157ce	payments.create	Create Payments	Create Payments permission	payments	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b64dd7ff-f627-4b99-ab9b-47e843a5b823	payments.edit	Edit Payments	Edit Payments permission	payments	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2ccc1e84-b1e7-4d74-b77c-9c61f17e26ba	payments.delete	Delete Payments	Delete Payments permission	payments	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a5358b58-9998-49f7-8755-cecb1cb39abe	payments.refund	Refund Payments	Refund Payments permission	payments	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a4ccf195-bc15-45d7-920e-d9f1bff4dce6	discounts.view	View Discounts	View Discounts permission	discounts	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
950fde98-02a8-4c82-ae68-f94f09276f68	discounts.create	Create Discounts	Create Discounts permission	discounts	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
0165b2d5-b5df-459b-9601-8299d670e289	discounts.edit	Edit Discounts	Edit Discounts permission	discounts	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
05b04b18-b4ac-423b-97ee-70f554708ef3	discounts.delete	Delete Discounts	Delete Discounts permission	discounts	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
9015f0d0-5574-42a3-bb1a-c89488e7eb95	discounts.compensate	Compensate Discounts	Compensate Discounts permission	discounts	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
79f5150a-704c-42b5-9e29-d054b73255d4	wallets.view	View Wallets	View Wallets permission	wallets	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
b1458cf0-e600-47f7-ae51-f5b2905d70f5	wallets.create	Create Wallets	Create Wallets permission	wallets	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
050d14ab-972b-416d-a34d-ccbc24de1e7e	wallets.edit	Edit Wallets	Edit Wallets permission	wallets	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
29ca70cb-a202-4e4d-9514-e6e7c63489e0	wallets.delete	Delete Wallets	Delete Wallets permission	wallets	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
6a409ce8-bfe5-49b3-9e3b-8afb451b07ce	notifications.view	View Notifications	View Notifications permission	notifications	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a960946d-f81d-4e0b-8e0e-b7a9d8a8d45b	notifications.create	Create Notifications	Create Notifications permission	notifications	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
49336c4d-7121-4450-b42a-915537ffb5f9	notifications.edit	Edit Notifications	Edit Notifications permission	notifications	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
8b525d1b-8fc9-424c-8665-8bb5c8ebf111	notifications.delete	Delete Notifications	Delete Notifications permission	notifications	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
537b2ee5-d9a9-47ec-9572-6f97df2856d5	notifications.send	Send Notifications	Send Notifications permission	notifications	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
616c3e2e-73ce-4bcc-a8c0-9427d6554aed	reports.view	View Reports	View Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
4594b0c6-cd74-450f-b7ce-a43474552cd1	reports.export	Export Reports	Export Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
3fe85e2c-a730-4c31-83f7-b36270fcf9d9	reports.customers	Customers Reports	Customers Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
e288a7af-6aa2-4d2a-a26d-64c1d56d0099	reports.assistants	Assistants Reports	Assistants Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
f85c1f8c-6dc7-4722-813b-c2138c96d4f0	reports.admin_roles	Admin Roles Reports	Admin Roles Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
62bcc3e5-d2b5-4605-a745-8c9180ef57a1	reports.admin_users	Admin Users Reports	Admin Users Reports permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
61a705fb-cf85-451f-b83f-1ed83152f050	settings.view	View Settings	View Settings permission	settings	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
5fd7fd3d-da16-49fd-a0f9-0d00977fb320	settings.create	Create Settings	Create Settings permission	settings	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
731e39ab-ea65-4e1b-a429-0364f476f8a2	settings.edit	Edit Settings	Edit Settings permission	settings	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
3fc8233a-8283-46e0-9814-1a0123bf5fac	settings.delete	Delete Settings	Delete Settings permission	settings	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
62fb3290-6911-4902-ab65-f176ffdc1d85	audit_logs.view	View Audit Logs	View Audit Logs permission	audit_logs	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
9ad8d5aa-9f69-4bcc-b76d-b328b11475cf	audit_logs.export	Export Audit Logs	Export Audit Logs permission	audit_logs	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
64125155-d343-4851-b15e-d80701b87562	modules.view	View Modules	View Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
f461ca05-df36-409b-8fcf-9d5640b1b146	modules.create	Create Modules	Create Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bbee18d9-ad72-407f-9935-4c927aeed84f	modules.edit	Edit Modules	Edit Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
bd9d0069-0d18-4efb-b821-8fe06136b52c	modules.delete	Delete Modules	Delete Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
ace10930-7d4e-4cca-a7f5-d26f840b67ff	permissions.view	View Permissions	View Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
31add8d1-ee92-44a0-b7e7-bb978d6c02ed	permissions.create	Create Permissions	Create Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
928fa792-0c2f-40fc-8565-be7b64ac826e	permissions.edit	Edit Permissions	Edit Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
808c48c1-6697-4f80-a0cb-d8731f51329c	permissions.delete	Delete Permissions	Delete Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
39a5f1ee-cff3-42d0-8ab9-190d8aabb064	module_permissions.view	View Module Permissions	View Module Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
8d1d3474-1342-4509-8cb0-fb496462651b	module_permissions.create	Assign Permissions To Modules	Assign Permissions To Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2f2e69e6-1dd3-4b25-bea5-a4e1df8f1a55	module_permissions.delete	Remove Permissions From Modules	Remove Permissions From Modules permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
09a7a248-05c5-4f56-a884-f8efe3d9a862	roles.view	View Roles	View Roles permission	system_control	2026-05-15 23:04:13.966286+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:04:13.966286+05:30	\N	\N	f
bff8c22d-a2da-4192-ae57-8962002c4e74	roles.create	Create Roles	Create Roles permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
2d53e3d8-589c-4a51-b80b-fd44b5668510	roles.edit	Edit Roles	Edit Roles permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
30d634af-7a91-4cb0-b8d8-34d04d9054f1	roles.delete	Delete Roles	Delete Roles permission	system_control	2026-05-15 23:05:20.961348+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:05:20.961348+05:30	\N	\N	f
2ffa98d4-c0b3-4ef3-b4e2-634027052dce	role_permissions.view	View Role Permissions	View Role Permissions permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
c7b979e1-1fe0-430e-bf17-f9e61c69319d	role_permissions.create	Assign Permissions To Roles	Assign Permissions To Roles permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
57cee495-547e-4726-98e4-15a737e08a4a	role_permissions.delete	Remove Permissions From Roles	Remove Permissions From Roles permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
0cced2c9-2597-4865-95a5-17d2373a19ac	user_roles.view	View User Roles	View User Roles permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
03bf0d9e-795f-4180-9032-fc0fecdc886f	user_roles.create	Assign Roles To Users	Assign Roles To Users permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
74d6824d-02b5-4750-9810-fb258ef8b2c0	user_roles.delete	Remove Roles From Users	Remove Roles From Users permission	system_control	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
279a5080-5af4-4943-b42f-a981d7fdcd73	users.view	View Users	View Users permission	users	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
d4abd3f4-76e0-41b2-a5d9-677187c33499	admin.dashboard.view	View Admin Dashboard	View Admin Dashboard permission	reports	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
a91e9a9d-5aa4-41ca-a911-57da5cce10c9	admin.actions.read	Read Admin Actions	Read Admin Actions permission	audit_logs	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
\.


--
-- Data for Name: places; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.places (id, place_type_id, name, address_text, latitude, longitude, city_id, cluster_id, status_id, metadata, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: policy_configs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.policy_configs (id, policy_type_id, code, name, config, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: portal_favorites; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.portal_favorites (user_id, actor_type, favorite_type, object_id, created_at) FROM stdin;
\.


--
-- Data for Name: price_master_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.price_master_rules (id, price_type, service_id, category_id, store_id, base_price, discount_type, discount_value, selling_price, cart_added, complexity_base, complexity_multiplier, description, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, scope_type, state_id, city_id, zone_id, cluster_id, max_stores_per_category, max_stores_total, time_slabs, complexity_slabs) FROM stdin;
eae3819e-30fd-4f60-9028-507383a97e0b	task	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	\N	79.00	flat	30.00	49.00	t	base	0.5000	\N	{}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 12:30:51.071111+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:12:14.690115+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:12:14.690115+05:30	t	all	\N	\N	\N	\N	1	10	[]	[]
aa5d481e-c761-4fde-90c5-5d83e8d67b1d	task	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	\N	79.00	none	0.00	79.00	f	base	0.1000	\N	{}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:26:03.194712+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:30:48.349398+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:30:48.349398+05:30	t	all	\N	\N	\N	\N	5	10	[]	[]
125c382d-83c1-432c-bb1e-e17c74e188e2	task	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	\N	79.00	flat	30.00	49.00	f	base	0.5000	\N	{}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:30:38.470088+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:36:50.830732+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:36:50.830732+05:30	t	cluster	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	3	10	[]	[]
787a22c5-29b6-47c3-9ea2-42106fa43743	task	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	\N	79.00	flat	30.00	49.00	f	base	0.5000	\N	{}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:24:31.361797+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:36:56.139535+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:36:56.139535+05:30	t	cluster	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4	1	10	[]	[]
5103deb6-b7a7-40da-b4dc-fc678353edbd	time	c5398c5e-75f6-4b50-bd1d-9ffd4f1d9ba3	\N	\N	0.00	none	0.00	0.00	f	none	0.0000	\N	{}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 14:51:36.563894+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 15:33:50.222927+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 15:33:50.222927+05:30	t	all	\N	\N	\N	\N	1	10	[{"label": "30 min", "price": 99, "basePrice": 120, "discountType": "flat", "sellingPrice": 99, "discountValue": 21, "durationMinutes": 30}, {"label": "1 hr", "price": 199, "basePrice": 240, "discountType": "flat", "sellingPrice": 199, "discountValue": 41, "durationMinutes": 60}, {"label": "1.5 hrs", "price": 289, "basePrice": 350, "discountType": "flat", "sellingPrice": 289, "discountValue": 61, "durationMinutes": 90}, {"label": "2 hrs", "price": 369, "basePrice": 450, "discountType": "flat", "sellingPrice": 369, "discountValue": 81, "durationMinutes": 120}]	[]
f9358c2a-1ddf-44ad-be81-a1fccc900870	task	02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "taskDurationMinutes": 0, "categoryGroupPricing": {"slabs": [{"basePrice": 399, "categoryId": "d3d3c307-1580-498a-8ecf-7b4e9568abde", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "Admission or Discharge Help", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}, {"basePrice": 399, "categoryId": "1cdbbf63-2985-4340-8758-f6aae31b5fda", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "Ambulance & Care Coordination", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}, {"basePrice": 399, "categoryId": "cb45fd6c-02a8-40a9-bd41-f79b69712bf2", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "Diagnostic Coordination", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}, {"basePrice": 399, "categoryId": "ac6954e3-5558-4f5f-a57a-1b321c89de19", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "Elderly Hospital Companion", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}, {"basePrice": 399, "categoryId": "bd620e09-b655-4336-9ac5-c9c63bc2bab1", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "Medicine Refill Management", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}, {"basePrice": 399, "categoryId": "0cb70531-d24c-4519-af52-a3e54088f56e", "allottedTime": {"enabled": true, "durationMinutes": 45}, "categoryName": "OPD Visit Assistance", "discountType": "flat", "sellingPrice": 299, "discountValue": 100, "waitingCharge": {"amount": 149, "enabled": true, "chargePerMinutes": 30}}], "enabled": true, "maxCategoriesAllowed": "3"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 15:49:00.941929+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:01.619649+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:01.619649+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
cec0f179-8047-4a93-8172-f35c3ec84648	task	b8af3437-b5be-4de9-906d-fb15a1204ab2	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "categoryGroupPricing": {"slabs": [{"basePrice": 0, "categoryId": "20b75169-9d58-40d5-8f05-08f16e638c15", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Clothes Exchange", "discountType": "none", "sellingPrice": 0, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}, {"basePrice": 0, "categoryId": "4e1061c3-c072-4bc8-9d6e-afccc9ea6750", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Courier Dispatch", "discountType": "none", "sellingPrice": 0, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}, {"basePrice": 0, "categoryId": "5e778120-836c-4ee6-b2f0-9315b486a47e", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Product Return", "discountType": "none", "sellingPrice": 0, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}], "enabled": true, "maxCategoriesAllowed": "2"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 22:48:56.845757+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 23:43:22.594173+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 23:43:22.594173+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
1ad89445-82aa-420e-bfd9-af78fea0367a	task	bb61a52e-af7e-485a-bf75-d371f889ed89	de52d3a1-7745-4423-8230-c9f1208be094	\N	120.00	flat	31.00	89.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": true, "waitingCharge": 25, "durationMinutes": 30, "chargePerMinutes": 10}, "taskDurationMinutes": 30, "categoryGroupPricing": {"slabs": [], "enabled": false, "maxCategoriesAllowed": "all"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 14:59:41.038078+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:56.126315+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:56.126315+05:30	t	all	\N	\N	\N	\N	3	9999	[]	[{"multiplier": 0.5, "storeNumber": 1, "durationMinutes": 15}, {"multiplier": 0.3, "storeNumber": 1, "durationMinutes": 10}]
6a35f96c-36d9-45c0-adef-39ebb31f674b	task	b8af3437-b5be-4de9-906d-fb15a1204ab2	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "categoryGroupPricing": {"slabs": [{"basePrice": 10, "categoryId": "20b75169-9d58-40d5-8f05-08f16e638c15", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Clothes Exchange", "discountType": "none", "sellingPrice": 10, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}, {"basePrice": 10, "categoryId": "4e1061c3-c072-4bc8-9d6e-afccc9ea6750", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Courier Dispatch", "discountType": "none", "sellingPrice": 10, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}, {"basePrice": 10, "categoryId": "5e778120-836c-4ee6-b2f0-9315b486a47e", "allottedTime": {"enabled": true, "durationMinutes": 1}, "categoryName": "Product Return", "discountType": "none", "sellingPrice": 10, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}], "enabled": true, "maxCategoriesAllowed": "all"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 23:47:30.181679+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 23:50:02.01574+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 23:50:02.01574+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
823e523c-4b87-461f-9b55-f1e56d059978	task	b8af3437-b5be-4de9-906d-fb15a1204ab2	20b75169-9d58-40d5-8f05-08f16e638c15	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": true, "waitingCharge": 3, "durationMinutes": 30, "chargePerMinutes": 1}, "categoryGroupPricing": {"slabs": [{"basePrice": 150, "categoryId": "20b75169-9d58-40d5-8f05-08f16e638c15", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Clothes Exchange", "discountType": "flat", "sellingPrice": 100, "discountValue": 50, "waitingCharge": {"amount": 3, "enabled": true, "chargePerMinutes": 1}}, {"basePrice": 120, "categoryId": "4e1061c3-c072-4bc8-9d6e-afccc9ea6750", "allottedTime": {"enabled": true, "durationMinutes": 40}, "categoryName": "Courier Dispatch", "discountType": "flat", "sellingPrice": 110, "discountValue": 10, "waitingCharge": {"amount": 2, "enabled": true, "chargePerMinutes": 1}}, {"basePrice": 99, "categoryId": "5e778120-836c-4ee6-b2f0-9315b486a47e", "allottedTime": {"enabled": false, "durationMinutes": 0}, "categoryName": "Product Return", "discountType": "none", "sellingPrice": 99, "discountValue": 0, "waitingCharge": {"amount": 0, "enabled": false, "chargePerMinutes": 0}}], "enabled": true, "maxCategoriesAllowed": "2"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 21:50:05.571713+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 23:36:29.371176+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 23:36:29.371176+05:30	t	all	\N	\N	\N	\N	2	9999	[]	[]
54c81ea6-d254-4c4f-8a62-c3f1762803fe	task	ece963f6-5b99-4f44-9722-88b10bfeb641	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "taskDurationMinutes": 0, "categoryGroupPricing": {"slabs": [{"basePrice": 199, "categoryId": "f34f8518-d8e5-4cab-870e-35ef6bba0356", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Govt Office Queue", "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "waitingCharge": {"amount": 79, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 199, "categoryId": "3b7e4394-b029-4338-a370-5c82d941ae87", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Home Presence Assistance", "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "waitingCharge": {"amount": 79, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 199, "categoryId": "102f4005-20fe-41ec-aec4-dd91879c7986", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Hospital & Diagnostic Queue", "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "waitingCharge": {"amount": 79, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 199, "categoryId": "bef41855-263f-446b-af8d-b273dff065f3", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "School & College Queue", "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "waitingCharge": {"amount": 79, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 199, "categoryId": "7acd9ebb-b397-404f-b5cf-2ac537b0db34", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Utility & Service Queue", "discountType": "flat", "sellingPrice": 149, "discountValue": 50, "waitingCharge": {"amount": 79, "enabled": true, "chargePerMinutes": 15}}], "enabled": true, "maxCategoriesAllowed": "3"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-16 11:58:55.025735+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:04.322392+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:04.322392+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
6af6a96d-98d8-4324-97ce-23b6a2c107ca	task	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	\N	99.00	flat	50.00	49.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": true, "waitingCharge": 20, "durationMinutes": 30, "chargePerMinutes": 10}, "taskDurationMinutes": 30, "categoryGroupPricing": {"slabs": [], "enabled": false, "maxCategoriesAllowed": "all"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-16 15:03:37.21682+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:52.284282+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:52.284282+05:30	t	all	\N	\N	\N	\N	3	9999	[]	[{"multiplier": 0.5, "storeNumber": 1, "durationMinutes": 20}, {"multiplier": 0.3, "storeNumber": 1, "durationMinutes": 15}]
0b60e5ac-668b-4a29-9ee3-e69e743f8a2e	task	b8af3437-b5be-4de9-906d-fb15a1204ab2	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "taskDurationMinutes": 30, "categoryGroupPricing": {"slabs": [{"basePrice": 109, "categoryId": "7b956bd8-69b7-446c-aaee-4273f30313a3", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Clothing Exchange", "discountType": "flat", "sellingPrice": 99, "discountValue": 10, "waitingCharge": {"amount": 49, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 109, "categoryId": "eef0a395-1bd3-4395-917d-2c0015f0a1a1", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Courier & Parcel Help", "discountType": "flat", "sellingPrice": 79, "discountValue": 30, "waitingCharge": {"amount": 49, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 109, "categoryId": "91c84110-8bf5-48a9-b6a3-c9c4924d9a82", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "E-commerce Returns", "discountType": "flat", "sellingPrice": 79, "discountValue": 30, "waitingCharge": {"amount": 49, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 109, "categoryId": "e6f8ff42-df63-4bf5-9d46-1755803f50ff", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Laundry & Dry Cleaning Help", "discountType": "flat", "sellingPrice": 79, "discountValue": 30, "waitingCharge": {"amount": 49, "enabled": true, "chargePerMinutes": 15}}, {"basePrice": 109, "categoryId": "b056612a-f65f-4fad-923c-1f38454f4469", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Service Centre Visit", "discountType": "flat", "sellingPrice": 79, "discountValue": 30, "waitingCharge": {"amount": 49, "enabled": true, "chargePerMinutes": 15}}], "enabled": true, "maxCategoriesAllowed": "3"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-15 23:52:47.902628+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:07.408148+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:07.408148+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
5fac6ca1-0893-4a42-8761-808dc0bed56e	time	f3bf3ab2-01e2-401f-9561-fea760bdc80a	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": true, "waitingCharge": 25, "durationMinutes": 0, "chargePerMinutes": 10}, "taskDurationMinutes": 0, "categoryGroupPricing": {"slabs": [], "enabled": false, "maxCategoriesAllowed": "all"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-16 14:34:04.720499+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:10.193483+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:10.193483+05:30	t	all	\N	\N	\N	\N	1	9999	[{"label": "30 min", "price": 69, "isActive": true, "basePrice": 119, "discountType": "flat", "sellingPrice": 69, "discountValue": 50, "durationMinutes": 30}]	[]
5993b5e4-7aea-4781-b333-44388f72a242	time	c5398c5e-75f6-4b50-bd1d-9ffd4f1d9ba3	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": true, "waitingCharge": 38, "durationMinutes": 0, "chargePerMinutes": 10}, "taskDurationMinutes": 0, "categoryGroupPricing": {"slabs": [], "enabled": false, "maxCategoriesAllowed": "all"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 15:57:26.667476+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:12.572528+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:12.572528+05:30	t	all	\N	\N	\N	\N	1	9999	[{"label": "30 min", "price": 99, "isActive": true, "basePrice": 149, "discountType": "flat", "sellingPrice": 99, "discountValue": 50, "durationMinutes": 30}, {"label": "1 hr", "price": 199, "isActive": true, "basePrice": 249, "discountType": "flat", "sellingPrice": 199, "discountValue": 50, "durationMinutes": 60}, {"label": "1.5 hrs", "price": 299, "isActive": true, "basePrice": 349, "discountType": "flat", "sellingPrice": 299, "discountValue": 50, "durationMinutes": 90}, {"label": "2 hrs", "price": 399, "isActive": true, "basePrice": 449, "discountType": "flat", "sellingPrice": 399, "discountValue": 50, "durationMinutes": 120}, {"label": "2.5 hrs", "price": 499, "isActive": true, "basePrice": 549, "discountType": "flat", "sellingPrice": 499, "discountValue": 50, "durationMinutes": 150}, {"label": "3 hrs", "price": 599, "isActive": true, "basePrice": 649, "discountType": "flat", "sellingPrice": 599, "discountValue": 50, "durationMinutes": 180}, {"label": "3.5 hrs", "price": 699, "isActive": true, "basePrice": 749, "discountType": "flat", "sellingPrice": 699, "discountValue": 50, "durationMinutes": 210}, {"label": "4 hrs", "price": 799, "isActive": false, "basePrice": 849, "discountType": "flat", "sellingPrice": 799, "discountValue": 50, "durationMinutes": 240}]	[]
08367508-5920-406c-bd8f-ed0a56d03620	task	8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	\N	\N	0.00	none	0.00	0.00	f	selling	0.0000	\N	{"allottedTime": {"enabled": false, "waitingCharge": 0, "durationMinutes": 0, "chargePerMinutes": 0}, "taskDurationMinutes": 0, "categoryGroupPricing": {"slabs": [{"basePrice": 149, "categoryId": "9dc62332-770e-424b-ba09-5856eb7cf5d7", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Office Essentials", "discountType": "flat", "sellingPrice": 99, "discountValue": 50, "waitingCharge": {"amount": 38, "enabled": true, "chargePerMinutes": 10}}, {"basePrice": 119, "categoryId": "93ca55fe-2c31-4607-ae75-c81406098ce7", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Personal Items", "discountType": "flat", "sellingPrice": 59, "discountValue": 60, "waitingCharge": {"amount": 22, "enabled": true, "chargePerMinutes": 10}}, {"basePrice": 99, "categoryId": "dac9f113-122f-48a9-827a-cad540a40696", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Small Essentials", "discountType": "flat", "sellingPrice": 49, "discountValue": 50, "waitingCharge": {"amount": 20, "enabled": true, "chargePerMinutes": 10}}, {"basePrice": 169, "categoryId": "10d51866-0f30-4803-a566-9593b98fe168", "allottedTime": {"enabled": true, "durationMinutes": 30}, "categoryName": "Urgent Essentials", "discountType": "flat", "sellingPrice": 119, "discountValue": 50, "waitingCharge": {"amount": 40, "enabled": true, "chargePerMinutes": 10}}], "enabled": true, "maxCategoriesAllowed": "3"}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-16 14:32:31.423289+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:58.791589+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:15:58.791589+05:30	t	all	\N	\N	\N	\N	1	9999	[]	[]
\.


--
-- Data for Name: pricing_policies; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.pricing_policies (id, code, name, description, is_active, config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.pricing_rules (id, pricing_policy_id, service_id, category_id, cluster_id, membership_plan_id, rule_type_id, amount, currency, condition, effective_from, effective_to, priority, is_active) FROM stdin;
\.


--
-- Data for Name: ratings; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.ratings (id, request_id, rated_by_user_id, rated_entity_type, rated_entity_id, rating, comment, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: razorpay_downtimes; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.razorpay_downtimes (id, method, status_code, severity, instrument, begin_at, end_at, payload, updated_at) FROM stdin;
\.


--
-- Data for Name: razorpay_payments; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.razorpay_payments (id, service_request_id, customer_user_id, provider_order_id, provider_payment_id, amount_paise, currency, receipt, status_code, method, bank, wallet, vpa, email, contact, error_code, error_description, captured_at, verified_at, last_reconciled_at, metadata, raw_order, raw_payment, webhook_payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: razorpay_webhook_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.razorpay_webhook_events (id, event_id, event_name, provider_order_id, provider_payment_id, payload, processed_at, received_at) FROM stdin;
\.


--
-- Data for Name: reason_codes; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.reason_codes (id, code, name, reason_group_id, applies_to_entity, requires_notes, is_active, config, created_at) FROM stdin;
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.refunds (id, payment_id, request_id, amount, currency, status_id, reason_id, gateway_refund_id, processed_at, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: request_attachments; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_attachments (id, request_id, stop_id, file_id, attachment_type_id, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: request_items; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_items (id, request_id, stop_id, item_name, quantity, notes, estimated_amount, approved_amount, status_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: request_locations; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_locations (id, service_request_id, sequence, location_type, name, address, latitude, longitude, notes, metadata, created_at, cluster_id) FROM stdin;
\.


--
-- Data for Name: request_status_history; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_status_history (id, request_id, from_state_id, to_state_id, transition_id, actor_user_id, reason_id, notes, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: request_stops; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_stops (id, request_id, sequence_no, place_id, stop_type_id, custom_address_text, latitude, longitude, cluster_id, state_id, instructions, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: request_timeline_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.request_timeline_events (id, request_id, event_type_id, actor_user_id, title, description, visibility_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: role_modules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.role_modules (role_id, module_id, created_at) FROM stdin;
e1b01a1c-c36a-4685-984a-1a64b59d8540	be0d067f-2d42-41c9-a866-bab4f38b6f2c	2026-05-15 19:30:24.937357+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	422ae9e0-a652-4f1a-92ad-db09d16d1774	2026-05-15 19:30:24.937357+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a11c4c52-8b51-4ef9-9e91-29ce95115852	2026-05-15 19:30:24.937357+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2c5c50f0-8aaf-44d2-908c-895621613c61	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c5248736-a224-422e-ae90-55be39e4740c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	68cca97b-d5eb-4505-8048-bc5084ddc82e	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	5db18bf1-d949-46da-ab1d-d48baf159955	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bce23272-5ead-417d-94d8-49b48392f3ae	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f35abcb7-3b44-4939-91d3-d3039556483b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0ef806ca-3ba8-43a3-a893-2bdbde85e069	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	99c062b6-3584-48b5-bbfe-7886bd82ffd9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	ad0976f7-ef0e-4e18-a99c-f0c133d776a2	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	7ea3e43e-8979-4325-88f2-9392ff8f6518	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	24042ccf-dfa0-4273-9d9b-99fdfd99dc10	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	708c4b30-d23e-4680-85d9-d5d7b8ba71ed	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a8bc91dc-7a9f-4208-874a-ddbb2bbb72f4	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	7acecae1-3d58-4ad8-8335-bef68979e8ac	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	963466ea-6624-4a27-b9af-ac1acb37526c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f735f877-6755-4404-a601-3640dbcd632c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	708c4b30-d23e-4680-85d9-d5d7b8ba71ed	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	c5248736-a224-422e-ae90-55be39e4740c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	ad0976f7-ef0e-4e18-a99c-f0c133d776a2	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	bce23272-5ead-417d-94d8-49b48392f3ae	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	f35abcb7-3b44-4939-91d3-d3039556483b	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	99c062b6-3584-48b5-bbfe-7886bd82ffd9	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	7ea3e43e-8979-4325-88f2-9392ff8f6518	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	798c4bed-fa12-45ba-852f-e7b1bcb6d7ff	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	0ef806ca-3ba8-43a3-a893-2bdbde85e069	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	68cca97b-d5eb-4505-8048-bc5084ddc82e	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	5db18bf1-d949-46da-ab1d-d48baf159955	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	ab017c43-3ce0-4ef8-8214-ae6d60c73a3e	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	24042ccf-dfa0-4273-9d9b-99fdfd99dc10	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	963466ea-6624-4a27-b9af-ac1acb37526c	2026-05-16 16:13:13.754199+05:30
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.role_permissions (role_id, permission_id, created_at) FROM stdin;
e1b01a1c-c36a-4685-984a-1a64b59d8540	862f248d-e813-4030-a7be-91fb08f30d49	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c2e62b9c-c66a-43ff-9df8-ee3cd21f74bc	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c1f80c24-843c-44c1-9dd5-c635e93184e2	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	cdfb267b-f594-4d42-b2f2-a41fad0779cb	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	23f07774-afd7-4c6e-a939-84c15e2cd1f2	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	279a5080-5af4-4943-b42f-a981d7fdcd73	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	299b4d74-ca8e-42a3-97a6-11e9aafd19b9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a9a50b8c-a151-4182-9d49-35115603135b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	275837db-7132-4268-afdb-9bc332ccfb60	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	ec80a208-ec72-4e92-98de-40fad59c1903	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	373fae1f-b774-4c23-9cef-25568047317c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	119ac34f-cb48-4f1b-8840-e1df24a48be4	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	90121e4d-5f4d-4a95-a819-cdc1c067a82d	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	d6a51a03-6c7d-4714-9078-e8618c66a884	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c4b0f537-702e-435d-a056-99270bea1356	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	eafc74da-41a4-4201-81a9-2ffedabdc7bc	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bc62ac0a-6211-4d71-8fd3-560a19458eec	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	8119c885-6424-4594-aeba-67c261a82121	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	1d90a618-7e70-4975-9de5-e6712a22b69a	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	170eafd1-c9e6-417f-86bb-154889daace1	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	49d6c0da-7df5-424c-a0d4-5850dd665a04	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2f4f5d52-82e6-4c83-9da1-e0dd5ce610f4	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	5aa564e4-030b-4bef-8740-a5b7101631aa	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	5dccc688-6bf5-4bf3-b0bf-a638980c1928	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	35351d24-f9df-42b1-9fee-7f9303d8016c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	ba6c38ce-a8eb-4a60-a62e-0a8f22290427	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	da8a080a-abe3-4d89-ab55-e3d2a530c86d	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0308f6c2-8e7d-4280-8ea5-53d19b73b98c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	9b68b813-b4af-4351-92c4-019bd863510c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	d22a5f21-0ddb-4264-ab77-5b4cb5fbfaba	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	3dcfb8d3-799d-438e-8901-faafe7614084	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	13b98ff5-498b-41d7-9ea4-32b10228c2f9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0792d3c2-ce09-4ff3-ac7d-d8b08a51c39a	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	1f8417c3-413b-4de0-b24e-69bed69ef092	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	08c5d23e-4f57-4342-8c02-895d1923f52d	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bb02ac84-ab6c-478f-a18f-d690613937a8	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b88ecbae-5515-436a-b720-0a9195158301	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	e1d490a9-b860-46d8-8681-807dc8002a42	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b5e66dce-bd2c-42b5-b6d1-b122dbcddd98	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	09d34905-ed9d-4eb7-8a91-d92073bf32f5	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	97e00fae-34c7-42b5-a24e-0fe959076596	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b74fcd7d-41f7-4e8b-ae7b-bcca0d67a2a7	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	eb2a2e46-4dd7-4bbc-a683-7a6f9a773705	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f7a5528d-0f47-46c7-9442-a8f8916e28ac	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	89750879-1c15-4a3d-97b4-f8746f861a4e	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	aac6910a-3508-4367-845f-57c7df0515bb	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	db185052-0214-4815-89e2-36c1533d2c19	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	451725e4-33e2-4923-9ed8-0489a8ef9eed	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b9446e22-d5cf-40df-baad-b23a946e4f01	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bba80e6e-a631-4809-87d6-ac82995a18fb	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	27fdc2ac-792c-4ba5-8bb8-ea6183052536	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	5097285c-b5e5-466a-9592-c90ebff3b01b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2054df65-7e75-4e9b-9f1a-acb185c2019f	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	e0d0511b-27f0-430f-b0ec-07a1e6d49e66	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bd4bf192-cd38-48cc-9984-23116b52373b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a520a36e-da32-42bc-963d-e23da6e75111	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	240bd245-df84-4fcf-9d2f-75eeba06bedc	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	6bb47618-2a2e-4aea-a3d8-f399190b82e9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	8c95e657-7151-4e71-a5c3-f877bba2307c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	68328adf-d6e5-443e-be5a-2f2e9e4de851	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0e8754dd-45de-4cf8-99ca-958741b5cb8c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	d9d725c7-fc40-4811-a9e5-eb5149076039	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c844e701-02a3-4d64-b8a3-4f472e973a7a	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	aa5d71a1-3738-4bac-b6ba-9e48f22adff8	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f641182b-4295-4195-badd-9a44eb655868	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2ecb508a-8a77-4173-abdb-11dd93749874	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a40f17ec-90bc-4008-a79c-74280953eb45	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	45ccd203-f351-439b-a4e6-9724aebfd7b5	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	d685caa8-6a19-4417-ac45-2a97c3a157ce	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b64dd7ff-f627-4b99-ab9b-47e843a5b823	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2ccc1e84-b1e7-4d74-b77c-9c61f17e26ba	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a5358b58-9998-49f7-8755-cecb1cb39abe	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a4ccf195-bc15-45d7-920e-d9f1bff4dce6	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	950fde98-02a8-4c82-ae68-f94f09276f68	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0165b2d5-b5df-459b-9601-8299d670e289	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	05b04b18-b4ac-423b-97ee-70f554708ef3	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	9015f0d0-5574-42a3-bb1a-c89488e7eb95	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	79f5150a-704c-42b5-9e29-d054b73255d4	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	b1458cf0-e600-47f7-ae51-f5b2905d70f5	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	050d14ab-972b-416d-a34d-ccbc24de1e7e	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	29ca70cb-a202-4e4d-9514-e6e7c63489e0	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	6a409ce8-bfe5-49b3-9e3b-8afb451b07ce	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a960946d-f81d-4e0b-8e0e-b7a9d8a8d45b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	49336c4d-7121-4450-b42a-915537ffb5f9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	8b525d1b-8fc9-424c-8665-8bb5c8ebf111	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	537b2ee5-d9a9-47ec-9572-6f97df2856d5	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	616c3e2e-73ce-4bcc-a8c0-9427d6554aed	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	4594b0c6-cd74-450f-b7ce-a43474552cd1	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	3fe85e2c-a730-4c31-83f7-b36270fcf9d9	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	e288a7af-6aa2-4d2a-a26d-64c1d56d0099	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f85c1f8c-6dc7-4722-813b-c2138c96d4f0	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	62bcc3e5-d2b5-4605-a745-8c9180ef57a1	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	61a705fb-cf85-451f-b83f-1ed83152f050	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	5fd7fd3d-da16-49fd-a0f9-0d00977fb320	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	731e39ab-ea65-4e1b-a429-0364f476f8a2	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	3fc8233a-8283-46e0-9814-1a0123bf5fac	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	62fb3290-6911-4902-ab65-f176ffdc1d85	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	9ad8d5aa-9f69-4bcc-b76d-b328b11475cf	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	64125155-d343-4851-b15e-d80701b87562	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	f461ca05-df36-409b-8fcf-9d5640b1b146	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bbee18d9-ad72-407f-9935-4c927aeed84f	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bd9d0069-0d18-4efb-b821-8fe06136b52c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	ace10930-7d4e-4cca-a7f5-d26f840b67ff	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	31add8d1-ee92-44a0-b7e7-bb978d6c02ed	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	928fa792-0c2f-40fc-8565-be7b64ac826e	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	808c48c1-6697-4f80-a0cb-d8731f51329c	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	39a5f1ee-cff3-42d0-8ab9-190d8aabb064	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	8d1d3474-1342-4509-8cb0-fb496462651b	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2f2e69e6-1dd3-4b25-bea5-a4e1df8f1a55	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	09a7a248-05c5-4f56-a884-f8efe3d9a862	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	bff8c22d-a2da-4192-ae57-8962002c4e74	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2d53e3d8-589c-4a51-b80b-fd44b5668510	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	30d634af-7a91-4cb0-b8d8-34d04d9054f1	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	2ffa98d4-c0b3-4ef3-b4e2-634027052dce	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	c7b979e1-1fe0-430e-bf17-f9e61c69319d	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	57cee495-547e-4726-98e4-15a737e08a4a	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	0cced2c9-2597-4865-95a5-17d2373a19ac	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	03bf0d9e-795f-4180-9032-fc0fecdc886f	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	74d6824d-02b5-4750-9810-fb258ef8b2c0	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	d4abd3f4-76e0-41b2-a5d9-677187c33499	2026-05-16 16:13:13.754199+05:30
e1b01a1c-c36a-4685-984a-1a64b59d8540	a91e9a9d-5aa4-41ca-a911-57da5cce10c9	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	d4abd3f4-76e0-41b2-a5d9-677187c33499	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	279a5080-5af4-4943-b42f-a981d7fdcd73	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	299b4d74-ca8e-42a3-97a6-11e9aafd19b9	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	ec80a208-ec72-4e92-98de-40fad59c1903	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	373fae1f-b774-4c23-9cef-25568047317c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	275837db-7132-4268-afdb-9bc332ccfb60	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	90121e4d-5f4d-4a95-a819-cdc1c067a82d	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	240bd245-df84-4fcf-9d2f-75eeba06bedc	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	0e8754dd-45de-4cf8-99ca-958741b5cb8c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	d9d725c7-fc40-4811-a9e5-eb5149076039	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	c844e701-02a3-4d64-b8a3-4f472e973a7a	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	aa5d71a1-3738-4bac-b6ba-9e48f22adff8	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	2ecb508a-8a77-4173-abdb-11dd93749874	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	f641182b-4295-4195-badd-9a44eb655868	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	d22a5f21-0ddb-4264-ab77-5b4cb5fbfaba	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	3dcfb8d3-799d-438e-8901-faafe7614084	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	13b98ff5-498b-41d7-9ea4-32b10228c2f9	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	1f8417c3-413b-4de0-b24e-69bed69ef092	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	08c5d23e-4f57-4342-8c02-895d1923f52d	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	bb02ac84-ab6c-478f-a18f-d690613937a8	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	b88ecbae-5515-436a-b720-0a9195158301	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	e1d490a9-b860-46d8-8681-807dc8002a42	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	09d34905-ed9d-4eb7-8a91-d92073bf32f5	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	97e00fae-34c7-42b5-a24e-0fe959076596	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	27fdc2ac-792c-4ba5-8bb8-ea6183052536	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	5097285c-b5e5-466a-9592-c90ebff3b01b	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	2054df65-7e75-4e9b-9f1a-acb185c2019f	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	bd4bf192-cd38-48cc-9984-23116b52373b	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	a40f17ec-90bc-4008-a79c-74280953eb45	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	45ccd203-f351-439b-a4e6-9724aebfd7b5	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	b74fcd7d-41f7-4e8b-ae7b-bcca0d67a2a7	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	eb2a2e46-4dd7-4bbc-a683-7a6f9a773705	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	f7a5528d-0f47-46c7-9442-a8f8916e28ac	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	aac6910a-3508-4367-845f-57c7df0515bb	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	db185052-0214-4815-89e2-36c1533d2c19	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	451725e4-33e2-4923-9ed8-0489a8ef9eed	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	b9446e22-d5cf-40df-baad-b23a946e4f01	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	bba80e6e-a631-4809-87d6-ac82995a18fb	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	d6a51a03-6c7d-4714-9078-e8618c66a884	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	eafc74da-41a4-4201-81a9-2ffedabdc7bc	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	1d90a618-7e70-4975-9de5-e6712a22b69a	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	49d6c0da-7df5-424c-a0d4-5850dd665a04	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	5aa564e4-030b-4bef-8740-a5b7101631aa	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	5dccc688-6bf5-4bf3-b0bf-a638980c1928	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	ba6c38ce-a8eb-4a60-a62e-0a8f22290427	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	0308f6c2-8e7d-4280-8ea5-53d19b73b98c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	9b68b813-b4af-4351-92c4-019bd863510c	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	a4ccf195-bc15-45d7-920e-d9f1bff4dce6	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	950fde98-02a8-4c82-ae68-f94f09276f68	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	0165b2d5-b5df-459b-9601-8299d670e289	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	9015f0d0-5574-42a3-bb1a-c89488e7eb95	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	616c3e2e-73ce-4bcc-a8c0-9427d6554aed	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	4594b0c6-cd74-450f-b7ce-a43474552cd1	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	3fe85e2c-a730-4c31-83f7-b36270fcf9d9	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	e288a7af-6aa2-4d2a-a26d-64c1d56d0099	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	f85c1f8c-6dc7-4722-813b-c2138c96d4f0	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	62bcc3e5-d2b5-4605-a745-8c9180ef57a1	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	61a705fb-cf85-451f-b83f-1ed83152f050	2026-05-16 16:13:13.754199+05:30
d219dd99-57d8-4a72-8c9f-1935390939ac	731e39ab-ea65-4e1b-a429-0364f476f8a2	2026-05-16 16:13:13.754199+05:30
\.


--
-- Data for Name: role_verification_requirements; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.role_verification_requirements (role_id, document_type_id, is_required, created_at) FROM stdin;
fc676efe-eaef-4323-9058-eeceb2a07e43	d7c534e2-f5d8-4b32-bef8-a849f6834dc1	t	2026-05-16 22:14:48.79697+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	5d8500e0-6337-4c60-8da7-d39c3188d82c	t	2026-05-16 22:14:48.830481+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	a4d25506-fa6f-4d96-ac5c-0fed7c91387f	t	2026-05-16 22:14:48.831708+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	24d99e8a-5da9-4ac5-b3c5-94cc8d3c1b07	t	2026-05-16 22:14:48.832552+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	19a4aec6-8420-4365-9768-93834fd4b8fc	t	2026-05-16 22:14:48.834394+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	aa38c8bd-71d4-4a20-9ff8-d7af8e12f957	t	2026-05-17 12:32:11.778472+05:30
fc676efe-eaef-4323-9058-eeceb2a07e43	7839b9e8-6119-4c87-9c7d-4a6ddb7f1a6f	t	2026-05-17 12:32:11.7869+05:30
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.roles (id, code, name, description, is_system, created_at, is_active, created_by, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
e1b01a1c-c36a-4685-984a-1a64b59d8540	super_admin	Super Admin	Full platform access across all modules and permissions	t	2026-05-15 19:30:24.937357+05:30	t	\N	\N	2026-05-15 23:00:11.98889+05:30	\N	\N	f
d219dd99-57d8-4a72-8c9f-1935390939ac	admin	Admin	Operations admin access without system-control deletion rights	t	2026-05-15 23:02:03.772493+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:02:03.772493+05:30	\N	\N	f
eab1cd1f-3978-4ae3-9d05-7520f988bd13	customer	Customer	Customer app role; access should be ownership-scoped	t	2026-05-15 23:02:43.935371+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:02:43.935371+05:30	\N	\N	f
fc676efe-eaef-4323-9058-eeceb2a07e43	assistant	Assistant	Assistant app role; access should be assignment-scoped	t	2026-05-15 23:02:26.670904+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-15 23:02:26.670904+05:30	\N	\N	f
666dd44b-81ac-4715-b977-efb40d4300d0	manager	Manager	Manager role for operational supervision	f	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
f2c225a2-6dda-479d-a4b1-f7920ab1876f	staff	Staff	Staff role for limited operational work	f	2026-05-16 16:13:13.754199+05:30	t	\N	\N	2026-05-16 16:13:13.754199+05:30	\N	\N	f
\.


--
-- Data for Name: service_categories; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.service_categories (service_id, category_id, is_visible, config) FROM stdin;
\.


--
-- Data for Name: service_requests; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.service_requests (id, request_number, customer_id, service_id, category_id, task_type_id, cluster_id, workflow_id, current_state_id, booking_mode_id, scheduled_at, estimated_duration_min, free_duration_min, paid_duration_min, priority_level, customer_notes, source_app_id, metadata, created_at, updated_at, cancelled_at, closed_at, delivery_type_id, status_code, notes, duration_minutes, estimated_amount_paise, currency, accepted_assignment_id, cancelled_reason, completed_at, booking_at, booking_type, booking_date, booking_time_slot, booking_amount_paise, base_price_paise, discount_paise, selling_price_paise, waiting_time_minutes, waiting_charges_paise, payment_type, payment_status, is_paid, service_details, category_details, store_details, customer_details, payment_details, location_details, upload_details, additional_details, booking_start_at, booking_end_at, booking_available_at, eta_minutes, wrap_up_minutes, travel_buffer_minutes, actual_task_started_at, assistant_start_delay_minutes, delay_credit_minutes, initiate_minutes) FROM stdin;
\.


--
-- Data for Name: service_task_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.service_task_rules (id, service_id, task_type_id, allows_multi_stop, allows_custom_location, requires_customer_approval, requires_purchase_payment, proof_policy_id, config) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.services (id, code, name, description, status_id, sort_order, config, created_at, updated_at, is_active, metadata, created_by, updated_by, deleted_by, deleted_at, is_deleted, image_url, priority, is_recommended, is_enabled) FROM stdin;
02f7b9f6-a3ff-42bb-a5e4-bfc4157e28fa	SHCA	Hospital & Care Assistance	Token, registration, doctor queue, billing	\N	3	{}	2026-06-15 14:39:49.693907+05:30	2026-06-15 14:40:08.528891+05:30	t	{"bookingLocation": {"mode": "multi", "maxLocationsLimit": 3}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Hospital-Care-Assistance-1781514568099.png	3	f	t
bb61a52e-af7e-485a-bf75-d371f889ed89	S001	Buy & Bring	Seed service for booking testing	\N	0	{}	2026-05-16 12:10:32.838029+05:30	2026-06-15 14:40:50.95992+05:30	t	{"seeded": true, "pricing": {"priceType": "task"}, "bookingLocation": {"mode": "current", "maxLocationsLimit": 1}}	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Buy-Bring-1781514021978.png	0	f	t
8a0f6a78-a008-4293-af6b-2c0f92b8b6bf	FID	Forgotten Item Delivery	Delivery forgotten items on time	\N	5	{}	2026-06-15 14:45:19.046478+05:30	2026-06-15 14:45:19.046478+05:30	t	{"bookingLocation": {"mode": "multi", "maxLocationsLimit": 3}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Forgotten-Item-Delivery-1781514884422.png	5	f	t
f3bf3ab2-01e2-401f-9561-fea760bdc80a	FNB	Find Nearby Me	Find nearby services, stores, pharmacies, hospitals and more all around you	\N	6	{}	2026-06-15 14:49:31.725951+05:30	2026-06-15 14:49:31.725951+05:30	t	{"bookingLocation": {"mode": "current", "maxLocationsLimit": 1}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Find-Nearby-Me-1781515169318.png	6	f	t
b8af3437-b5be-4de9-906d-fb15a1204ab2	RPEX001	Returns, Pickup & Exchange	\N	\N	1	{}	2026-05-25 20:10:00.826937+05:30	2026-06-15 14:49:57.396664+05:30	t	{"pricing": {"priceType": "task"}, "bookingLocation": {"mode": "multi", "maxLocationsLimit": 3}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Return-Pickup-Exchange-1781514235344.png	1	f	t
c5398c5e-75f6-4b50-bd1d-9ffd4f1d9ba3	S003	Personal Assistant	Can't find help? Tell ZIGO what you need	\N	7	{}	2026-05-16 17:18:00.757017+05:30	2026-06-15 14:53:20.113324+05:30	t	{"pricing": {"priceType": "time"}, "bookingLocation": {"mode": "multi", "maxLocationsLimit": 5}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Personal-Assistance-1781515398238.png	7	f	t
ece963f6-5b99-4f44-9722-88b10bfeb641	S002	Queue & Presence Assistance	Book a task, we'll wait for you 	\N	2	{}	2026-05-16 16:21:40.27602+05:30	2026-06-15 14:36:37.789889+05:30	t	{"pricing": {"priceType": "time"}, "bookingLocation": {"mode": "multi", "maxLocationsLimit": 3}}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	\N	f	/uploads/images/Queue-Standing-Appointment-Assistance-1781514391880.png	2	f	t
\.


--
-- Data for Name: settlements; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.settlements (id, request_id, customer_total, assistant_earning_total, platform_fee_total, refund_total, status_id, settled_at, metadata, created_at, service_request_id) FROM stdin;
\.


--
-- Data for Name: sla_breach_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.sla_breach_events (id, request_id, breach_type_id, threshold_seconds, actual_seconds, status_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: states; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.states (id, code, name, country_name, is_active, metadata, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
069ef8b1-de3f-4138-9ede-b4a1469397f0	001	Gurgaon	India	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-15 23:52:39.710873+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-15 23:53:03.300107+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-15 23:53:03.300107+05:30	t
c89a7f1d-241e-47e7-9829-b1e5316fee43	HR	Haryana	India	f	{"seeded": true}	\N	2026-05-16 12:10:32.838029+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:12:26.501467+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:12:26.501467+05:30	t
454b92a0-ad47-44df-94df-eb1719e9a500	ST002	New Delhi	India	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:12:41.922755+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:12:41.922755+05:30	\N	\N	f
e236489e-dd7c-4286-a944-6114eeb3fe56	ST001	Haryana	India	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-15 23:53:17.101009+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:12:48.548946+05:30	\N	\N	f
a43ef94e-af52-437a-b852-c8e19d5ca017	18	Jammu & Kashmir (UT)	India	t	{}	a6290b06-9d07-4093-98af-a2051e52fa8b	2026-05-22 11:07:39.166126+05:30	a6290b06-9d07-4093-98af-a2051e52fa8b	2026-05-22 11:08:16.828536+05:30	\N	\N	f
\.


--
-- Data for Name: store_categories; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_categories (id, code, name, image_url, description, priority, is_active, metadata, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted, service_id, service_category_id) FROM stdin;
36081889-b1c4-4a77-8ec0-816faa2e5d43	TEST_STORE_CAT_1875132834	Test Store Category	\N	Smoke test	999	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 17:57:54.386175+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 17:57:54.408068+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 17:57:54.408068+05:30	t	\N	\N
7fefdef5-e32b-4951-ae7a-872694eb7e7f	SC002	Banquet	/uploads/images/banquet-1778934828620.png	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:03:50.833108+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:21.532104+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:21.532104+05:30	t	\N	\N
a06b8352-4d68-4ae4-bd80-51c70f7f576b	CHINES001	Chinese	/uploads/images/download-3-1779701931640.jpg	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:08:55.266436+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:25.105689+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:25.105689+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
d7569b00-2b00-40e4-9b87-6642d1d0c503	PVEG001	Pure Veg	\N	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:28:41.128477+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:29.321472+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:29.321472+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
e7af6da8-1c65-43d8-a6fd-c5e45a850cdc	INDREST001	Indian Restaurant	\N	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:25:51.806145+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:33.326391+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:33.326391+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
2ba1b5cb-7b11-4d67-94f5-ac6c57d4bbe6	SC004	Dry Cleaner	/uploads/images/dry-cleaner-1778935002628.png	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:06:53.355435+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:37.250596+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:37.250596+05:30	t	\N	\N
94b4b18d-d0e7-41b1-8f85-60471f5e6c5b	DHAB001	Dhaba	\N	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:25:27.373237+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:41.327634+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:41.327634+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
85babc39-e1f8-4e17-9faf-7ed4ef9626c7	SC005	Health Care	/uploads/images/health-care-1778936895275.png	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:38:31.43302+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:44.185025+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:44.185025+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	de52d3a1-7745-4423-8230-c9f1208be094
82496949-4fa5-441e-91b7-22648c737ddf	INDFD001	Indian Food	/uploads/images/download-2-1779651689570.jpg	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:11:31.111641+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:47.239492+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:47.239492+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
9cbdcc52-d0ed-4d4e-938e-a5862cb6946e	ITLFD001	Italian Food	/uploads/images/download-1779651624119.jpg	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:10:26.072058+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:49.971143+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:49.971143+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
fb509d07-1519-4e5e-b6ac-79cdd9672c89	ITAL001	Italian 	/uploads/images/download-4-1779702751230.jpg	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:22:32.923992+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:53.140919+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:53.140919+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
808be8b6-6ab2-4c8d-b81e-512627c19094	SC003	Play Station	/uploads/images/play-station-1778934903051.png	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:05:13.622732+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:56.057513+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:56.057513+05:30	t	\N	\N
974c0a03-ff7f-4f32-ba4c-9bce44be1af0	SC001	Saloon	/uploads/images/saloon-1778934690957.png	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 18:01:39.336921+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:58.954955+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:16:58.954955+05:30	t	\N	\N
87faab53-faac-44e8-989f-b91c86ffa908	STHIND001	South Indian	/uploads/images/download-1-1779651583453.jpg	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:09:54.708833+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:02.331938+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:02.331938+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
607ac3ae-5ca7-499d-8c6c-1993aeb58365	NINDF001	North Indian Food	\N	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:26:28.266179+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:05.768756+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:05.768756+05:30	t	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293
\.


--
-- Data for Name: store_category_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_category_map (id, store_category_id, store_id, is_active, created_by, created_at, deleted_by, deleted_at, is_deleted) FROM stdin;
c70a61db-b96b-4e07-a5a8-88be9a842dc7	d7569b00-2b00-40e4-9b87-6642d1d0c503	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:40.964376+05:30	t
e02b1829-7258-4d7b-948b-47a98ad52364	d7569b00-2b00-40e4-9b87-6642d1d0c503	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:42.883228+05:30	t
00f77109-4f47-4e04-811f-17b02d5ea7be	a06b8352-4d68-4ae4-bd80-51c70f7f576b	be7f502c-d686-4237-b3e4-b492fc05a833	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:09.846175+05:30	t
37237ba1-53f2-4036-9cf9-64ff7292304b	94b4b18d-d0e7-41b1-8f85-60471f5e6c5b	a501062b-a597-4875-8688-85e0a2efd8c2	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:11.77837+05:30	t
dd79543c-6d2a-4eba-8d9f-23b2f7601822	94b4b18d-d0e7-41b1-8f85-60471f5e6c5b	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:13.619956+05:30	t
70ab4414-f85a-496a-9870-e5e49a7a98d8	85babc39-e1f8-4e17-9faf-7ed4ef9626c7	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 19:46:30.666744+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:16.110551+05:30	t
ca3349ec-88cc-48f0-84e0-9215d4a62964	82496949-4fa5-441e-91b7-22648c737ddf	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:18.328494+05:30	t
bbee0d31-91e5-46f6-85d5-7ee68b68cf8a	82496949-4fa5-441e-91b7-22648c737ddf	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:20.17937+05:30	t
4337bc2b-cd8a-4df7-b37c-2924536ee3b4	e7af6da8-1c65-43d8-a6fd-c5e45a850cdc	eb8a8b2b-3849-4320-9525-f2314658b9ac	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:21.721255+05:30	t
8c17411e-d1a9-477b-8df7-3142e20d9fcc	e7af6da8-1c65-43d8-a6fd-c5e45a850cdc	a501062b-a597-4875-8688-85e0a2efd8c2	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:23.299563+05:30	t
7827d132-2912-4810-80e5-c998a5dd3664	e7af6da8-1c65-43d8-a6fd-c5e45a850cdc	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:25.232661+05:30	t
111fb83d-9f17-4eb4-9561-4c3781b8f147	d7569b00-2b00-40e4-9b87-6642d1d0c503	a501062b-a597-4875-8688-85e0a2efd8c2	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:29.415862+05:30	t
6c828530-9af4-4122-81f7-b1b107d5b6d7	607ac3ae-5ca7-499d-8c6c-1993aeb58365	fb9b054d-3958-41d5-b130-91175c3f098b	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:31.340838+05:30	t
da2e81e0-b937-45bc-a51f-6c5050977c97	607ac3ae-5ca7-499d-8c6c-1993aeb58365	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:33.346882+05:30	t
02bc7e9d-b777-41f2-9e92-a7eec538b3c4	607ac3ae-5ca7-499d-8c6c-1993aeb58365	a501062b-a597-4875-8688-85e0a2efd8c2	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:35.482091+05:30	t
48492f96-72bb-412e-8669-55a5a361a5d7	9cbdcc52-d0ed-4d4e-938e-a5862cb6946e	28906383-ec9f-4b7d-87d7-e45e46d3f912	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:24:05.057631+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:37.015858+05:30	t
f08f6e4e-d5c8-49b1-acb7-23f5fa8a70da	87faab53-faac-44e8-989f-b91c86ffa908	eb8a8b2b-3849-4320-9525-f2314658b9ac	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:39.071362+05:30	t
\.


--
-- Data for Name: store_cluster_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_cluster_map (store_id, cluster_id, is_visible, priority, config) FROM stdin;
\.


--
-- Data for Name: store_images; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_images (id, store_id, file_id, image_url, is_primary, priority, is_active, metadata, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
8b8f8fbe-c9f8-4f7a-9a14-47073686827e	28906383-ec9f-4b7d-87d7-e45e46d3f912	\N	/uploads/images/download-4-1779702795051.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:24:05.057631+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:36:09.232129+05:30	\N	\N	f
3f6821bc-9455-42fd-a17d-f074892e295e	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	\N	/uploads/images/pharmacy-or-clinic-interior-illustration-vector-1778940888156.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 19:46:30.666744+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:37:16.441215+05:30	\N	\N	f
935d6e0b-e244-4eae-8380-7be4050d1e8c	fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	\N	/uploads/images/medical-shop-1778940895715.png	f	1	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-16 19:46:30.666744+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:37:16.441215+05:30	\N	\N	f
b589957e-27f1-4cba-bf1a-e9ec854d852e	be7f502c-d686-4237-b3e4-b492fc05a833	\N	/uploads/images/download-3-1779702364243.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:37:40.538755+05:30	\N	\N	f
96c8ae58-ef70-47ae-90c3-4b76b98f9cd0	a501062b-a597-4875-8688-85e0a2efd8c2	\N	/uploads/images/WhatsApp-Image-2026-05-24-at-12-24-18-AM-1779564197978.jpeg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:38:17.224854+05:30	\N	\N	f
dd3cc665-6dc3-4686-b32c-5d493bbffbfb	fb9b054d-3958-41d5-b130-91175c3f098b	\N	/uploads/images/download-2-1779702531251.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-19 23:38:36.507889+05:30	\N	\N	f
8ca81b1d-bbc3-439a-85ad-695082df433e	eb8a8b2b-3849-4320-9525-f2314658b9ac	\N	/uploads/images/download-1-1779652073724.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
898eb4c8-065b-438d-8b9e-4788d6f5f6f1	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	\N	/uploads/images/download-1779703058502.jpg	t	0	t	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-06-13 12:33:50.894752+05:30	\N	\N	f
\.


--
-- Data for Name: store_keyword_map; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_keyword_map (id, store_keyword_id, store_id, is_active, created_by, created_at, deleted_by, deleted_at, is_deleted) FROM stdin;
723d58f8-5fda-48dd-b334-7c7c7a3d312e	f98a34d4-1243-438b-8502-02f681f04cf7	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
936ad77e-cf05-4c22-a92d-fae5e23a9408	c84785ab-fbb2-4f35-a30a-ac30eaa04b4e	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
e95f1a15-369c-42f6-9078-96a7b3661cab	2d45ed12-12c6-45a5-a008-a37b5c1c1f76	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
5efba34d-2fe6-4940-9334-11a105a92463	45f6fc6b-c8d0-41ae-9ac6-a6eb5b2417ed	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
3ceae494-e0f4-4250-bd01-e67e3667ab01	13ca13a2-ea69-4955-98ae-46f8ed36f2b5	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
28bb76fa-c189-4459-850b-4fb3cb8b02e3	c1402a6b-8a09-46b5-930f-e6e56f918987	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
a25b9e10-541a-4c73-bfa2-69c152f9ec55	6d5d25d3-5a77-461e-ba46-711cb03ac374	eb8a8b2b-3849-4320-9525-f2314658b9ac	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:20:02.353716+05:30	\N	\N	f
e9219e99-9041-412b-915a-49d805a5f004	0e2ab156-590f-4280-bcf8-382b467ccfa6	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
0f2aeb60-c797-49e5-afc9-40c8fc48b716	1a566de0-16d8-48a7-b9ff-0259e5295238	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
f7810f8b-df2d-40f9-982b-95f0c01b35d3	00be531f-c786-4cc3-b3dd-15eae0c70ad2	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
59636254-dbb5-46ec-8f38-1fe350895d64	45f6fc6b-c8d0-41ae-9ac6-a6eb5b2417ed	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
396add2a-66cf-488b-b912-0965237c0646	6d5d25d3-5a77-461e-ba46-711cb03ac374	dd9ae17a-7499-44eb-80c0-0a1e14d6d940	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:28:42.193618+05:30	\N	\N	f
5d359723-ae9b-4e97-819e-18d8b68df75d	24cca882-306f-4acc-840e-37a28e8b8f25	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
ba54b0ff-d5f2-4239-95ae-617800409349	863f2e67-e2cb-4d76-a1ac-6df49d48b6bf	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
b5e2293b-4a0d-477f-846e-63031d8360c8	ea4ada2a-fe71-49c7-9a65-87ec23bd25c1	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
8ea27ed0-28ef-4c2f-afef-b36fc578f367	1a566de0-16d8-48a7-b9ff-0259e5295238	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
db8bba8a-c385-41e6-8dd0-bf79567ca27a	00be531f-c786-4cc3-b3dd-15eae0c70ad2	be7f502c-d686-4237-b3e4-b492fc05a833	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:17:42.394779+05:30	\N	\N	f
64297b3e-c41f-4220-9ea6-b62c9ed0a687	0e2ab156-590f-4280-bcf8-382b467ccfa6	a501062b-a597-4875-8688-85e0a2efd8c2	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	\N	\N	f
6c972270-92fa-40ac-8384-e9727a3e3b82	45f6fc6b-c8d0-41ae-9ac6-a6eb5b2417ed	a501062b-a597-4875-8688-85e0a2efd8c2	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	\N	\N	f
3e829b49-efed-4808-928b-be7b5f43a360	6d5d25d3-5a77-461e-ba46-711cb03ac374	a501062b-a597-4875-8688-85e0a2efd8c2	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:54:00.130193+05:30	\N	\N	f
efc6c3d5-336c-43d3-9f75-1d609dcbc487	24cca882-306f-4acc-840e-37a28e8b8f25	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
89f76a3c-e3e7-4633-a526-53caecd7bd58	0e2ab156-590f-4280-bcf8-382b467ccfa6	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
f6d9c679-b66f-4bc4-8ef3-ed6ca5b710f3	1a566de0-16d8-48a7-b9ff-0259e5295238	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
d7d7b46c-e50a-4535-9cb9-54feb520d153	b6289a39-35e0-444f-aab0-e08d72040d8f	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
15ce383f-e21d-462c-be03-cfcd3910d72b	45f6fc6b-c8d0-41ae-9ac6-a6eb5b2417ed	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
0a3674ba-8cab-42ab-a3ac-a5a72075efdf	6d5d25d3-5a77-461e-ba46-711cb03ac374	fb9b054d-3958-41d5-b130-91175c3f098b	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:20:12.729229+05:30	\N	\N	f
\.


--
-- Data for Name: store_keywords; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.store_keywords (id, service_id, service_category_id, code, name, description, priority, is_active, metadata, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
24cca882-306f-4acc-840e-37a28e8b8f25	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	CHICKEN_FRIED_RICE	Chicken Fried Rice	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:15:02.162021+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:10.715241+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:10.715241+05:30	t
ea4ada2a-fe71-49c7-9a65-87ec23bd25c1	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	CHOWMIN	Chowmin	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:09:32.587712+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:14.605198+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:14.605198+05:30	t
0e2ab156-590f-4280-bcf8-382b467ccfa6	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	DAL_MAKHNI	Dal Makhni	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:27:40.938215+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:18.182081+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:18.182081+05:30	t
1a566de0-16d8-48a7-b9ff-0259e5295238	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	FRIES_RICE	Fries Rice	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:14:45.525433+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:22.368284+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:22.368284+05:30	t
f98a34d4-1243-438b-8502-02f681f04cf7	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	DOSA	Dosa	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:14:02.128376+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:26.035939+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:26.035939+05:30	t
00be531f-c786-4cc3-b3dd-15eae0c70ad2	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	MOM001	Momos	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:09:20.578386+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:30.167707+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:30.167707+05:30	t
2d45ed12-12c6-45a5-a008-a37b5c1c1f76	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	SAMBAR	Sambar	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:14:45.49647+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:33.235532+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:33.235532+05:30	t
c84785ab-fbb2-4f35-a30a-ac30eaa04b4e	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	IDLI	Idli	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:14:13.154577+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:36.699152+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:36.699152+05:30	t
45f6fc6b-c8d0-41ae-9ac6-a6eb5b2417ed	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	SPECIAL_VEG_THALI	Special Veg Thali	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:28:09.592749+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:40.351598+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:40.351598+05:30	t
b6289a39-35e0-444f-aab0-e08d72040d8f	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	NON_VEG_THALI	Non Veg Thali	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:28:20.24821+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:44.933748+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:44.933748+05:30	t
c1402a6b-8a09-46b5-930f-e6e56f918987	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	VADA	Vada	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:15:13.986213+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:48.358144+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:48.358144+05:30	t
6d5d25d3-5a77-461e-ba46-711cb03ac374	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	VEG_THALI	Veg Thali	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 00:27:55.320776+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:51.480752+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:51.480752+05:30	t
863f2e67-e2cb-4d76-a1ac-6df49d48b6bf	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	CHICKEN_MOMOS	Chicken Momos	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 15:09:49.36655+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:55.797942+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:17:55.797942+05:30	t
13ca13a2-ea69-4955-98ae-46f8ed36f2b5	bb61a52e-af7e-485a-bf75-d371f889ed89	504100dc-21ec-4fba-80be-4c5680ff6293	UTTAPAM	Uttapam	\N	0	f	{}	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-25 01:14:58.093226+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:01.88153+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:01.88153+05:30	t
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.stores (id, place_id, store_code, category_id, phone, operating_hours, is_partner, metadata, created_at, updated_at, code, name, address, latitude, longitude, is_active, created_by, updated_by, deleted_by, deleted_at, is_deleted, description, contact, website, priority) FROM stdin;
28906383-ec9f-4b7d-87d7-e45e46d3f912	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "15:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "tuesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "saturday": {"enabled": true, "openTime": "07:00", "closeTime": "03:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}}	f	{}	2026-05-25 15:24:05.057631+05:30	2026-07-29 20:19:08.682903+05:30	ITALIAN_PIZZERIA	Italian Pizzeria	gg-89, H.No.787, Gurgaon 	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:08.682903+05:30	t	\N	7788556699	italianpizzeria.in	0
eb8a8b2b-3849-4320-9525-f2314658b9ac	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}, "tuesday": {"enabled": false, "openTime": "12:00", "closeTime": "22:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "22:00"}}	f	{}	2026-05-25 01:20:02.353716+05:30	2026-07-29 20:18:58.183685+05:30	KRISHNA_SOUTH_INDIA	Krishna South India	Shop No.231, Sector 55, Gurgaon 	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:58.183685+05:30	t	\N	8899556633	southindiafoods.com	0
dd9ae17a-7499-44eb-80c0-0a1e14d6d940	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "13:00", "closeTime": "20:00"}, "monday": {"enabled": true, "openTime": "13:00", "closeTime": "20:00"}, "sunday": {"enabled": false, "openTime": "13:00", "closeTime": "20:00"}, "tuesday": {"enabled": true, "openTime": "13:00", "closeTime": "20:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "20:00"}, "thursday": {"enabled": true, "openTime": "13:00", "closeTime": "20:00"}, "wednesday": {"enabled": true, "openTime": "13:00", "closeTime": "20:00"}}	f	{}	2026-05-25 15:28:42.193618+05:30	2026-07-29 20:19:12.608044+05:30	MUMMIES_KITCHEN	Mummies Kitchen	Sector 45, Gurgaon	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:12.608044+05:30	t	\N	9685748596	mummieskitchen.co.in	0
be7f502c-d686-4237-b3e4-b492fc05a833	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "tuesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}}	f	{}	2026-05-25 15:17:42.394779+05:30	2026-07-29 20:18:49.671222+05:30	DOLMA_AUNTY_MOMOS	Dolma Aunty Momos	Shop no. 33, Sector 55, Gurgaon	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:49.671222+05:30	t	\N	7845121245	damomomos.in	0
a501062b-a597-4875-8688-85e0a2efd8c2	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "tuesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}}	f	{}	2026-05-24 00:54:00.130193+05:30	2026-07-29 20:19:01.53085+05:30	MAKHAN_DA_DHABA	Makhan Da Dhaba	Sector 55, Gurgaon	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:01.53085+05:30	t	Desi Indian Dhaba	9865326598	makhandadhaba.in	0
fb9b054d-3958-41d5-b130-91175c3f098b	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "tuesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}}	f	{}	2026-05-25 15:20:12.729229+05:30	2026-07-29 20:18:54.498341+05:30	PUNJABI_KING	Punjabi King	12/B, Sector 44, Gurgaon	28.4336522	77.1073502	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:18:54.498341+05:30	t	\N	7755663322	punjabiking.in	0
fbded4fa-d2d3-4b35-9f74-380e3a6c2e15	\N	\N	\N	\N	{"friday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "monday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "sunday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "tuesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "saturday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "thursday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}, "wednesday": {"enabled": true, "openTime": "12:00", "closeTime": "03:00"}}	f	{}	2026-05-16 19:01:07.01153+05:30	2026-07-29 20:19:05.463585+05:30	STR001	Healthbuddy Healthcare Pharmacy Gurugram	Shop No 2, HEWO -1 Apartment, Sector 56, Gurugram, Haryana 122011	28.4291950	77.1013675	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-29 20:19:05.463585+05:30	t	Medical supply store	08800371829	\N	0
\.


--
-- Data for Name: support_issues; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.support_issues (id, service_request_id, opened_by_type, opened_by_id, status_code, reason, resolution, created_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.support_tickets (id, ticket_number, request_id, customer_id, assistant_id, category_id, priority_id, status_id, assigned_to_user_id, subject, description, metadata, created_at, updated_at, closed_at) FROM stdin;
\.


--
-- Data for Name: surge_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.surge_rules (id, name, code, rule_type, days, start_time, end_time, adjustment_type, adjustment_value, priority, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
b9069824-9283-4dc9-9c58-bfc084bfbcdb	Assistant High Demand	003	demand	{}	\N	\N	percent	50.00	0	{"dayTimes": {}, "dateTimes": [], "demandSlabs": [{"minOrders": 80, "adjustmentType": "percent", "adjustmentValue": 30, "maxAvailableAssistants": 20}, {"minOrders": 70, "adjustmentType": "percent", "adjustmentValue": 20, "maxAvailableAssistants": 30}, {"minOrders": 60, "adjustmentType": "percent", "adjustmentValue": 10, "maxAvailableAssistants": 40}], "scheduleMode": "date_time", "selectedDates": [], "weeklyCalendar": {}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 16:32:17.231152+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:34.157483+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:34.157483+05:30	t
4e05a7f3-9ed7-4b66-acec-3d612794c681	Multiple Stores	MLTISTR001	time	{mon,tue,wed,thu,fri,sat,sun}	06:00:00	23:59:00	percent	50.00	0	{"dayTimes": {"fri": {"endTime": "23:59", "startTime": "06:00"}, "mon": {"endTime": "23:59", "startTime": "06:00"}, "sat": {"endTime": "23:59", "startTime": "06:00"}, "sun": {"endTime": "23:59", "startTime": "06:00"}, "thu": {"endTime": "23:59", "startTime": "06:00"}, "tue": {"endTime": "23:59", "startTime": "06:00"}, "wed": {"endTime": "23:59", "startTime": "06:00"}}, "dateTimes": [], "demandSlabs": [], "scheduleMode": "date_time", "selectedDates": [], "weeklyCalendar": {}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 01:31:43.848205+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:37.010284+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:37.010284+05:30	t
9969552b-4b31-49b5-b44c-ddccd0cd424a	Peak Day Surge 	001	holiday	{}	\N	\N	percent	50.00	0	{"dayTimes": {}, "dateTimes": [{"date": "2026-05-20", "endTime": "05:00", "startTime": "02:00"}], "scheduleMode": "date_time", "selectedDates": ["2026-05-20"], "weeklyCalendar": {}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 16:25:42.65883+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:39.945193+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:39.945193+05:30	t
58b37985-0910-4d95-b789-6db05685cf9e	Saturday & Sunday Evening Surge	002	day	{sun}	05:00:00	10:00:00	flat	10.00	0	{"dayTimes": {"sun": {"endTime": "10:00", "startTime": "05:00"}}, "dateTimes": [], "scheduleMode": "date_time", "selectedDates": [], "weeklyCalendar": {}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 16:31:03.532551+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:42.81286+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 18:56:42.81286+05:30	t
1e6caa9c-2e0e-4584-a009-069c968fe9b1	Sunday Evening Peak Hours	SUNDEVNPKHRS001	time	{sun}	05:00:00	22:00:00	percent	50.00	100	{"scope": {"cityId": null, "zoneId": null, "stateId": null, "clusterId": null, "scopeType": "all", "serviceId": null, "categoryId": null, "clusterIds": [], "serviceIds": [], "categoryIds": []}, "dayTimes": {"sun": {"endTime": "22:00", "startTime": "05:00"}}, "dateTimes": [], "demandSlabs": [], "scheduleMode": "weekly", "selectedDates": [], "weeklyCalendar": {}, "demandAnalytics": {"days": ["sun"], "endTime": "22:00", "startTime": "05:00", "lookbackDays": 3, "selectedDates": [], "includeHolidays": false}}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 19:05:58.074094+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-24 19:07:44.79402+05:30	\N	\N	f
\.


--
-- Data for Name: task_assignments; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_assignments (id, request_id, assistant_id, assignment_status_id, assignment_type_id, assigned_by_user_id, reason_id, assigned_at, released_at, metadata, service_request_id, status_code, offered_at, responded_at, expires_at, reject_reason, admin_reason, created_by_user_id, actual_started_at, start_delay_minutes, delay_credit_minutes) FROM stdin;
\.


--
-- Data for Name: task_events; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_events (id, service_request_id, assignment_id, actor_type, actor_id, event_type, notes, latitude, longitude, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: task_execution_sessions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_execution_sessions (id, request_id, assistant_id, started_at, completed_at, status_id, timer_started_at, total_active_seconds, metadata) FROM stdin;
\.


--
-- Data for Name: task_proofs; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_proofs (id, request_id, stop_id, assistant_id, proof_type_id, file_id, gps_latitude, gps_longitude, otp_verified, verified_by_user_id, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: task_stop_visits; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_stop_visits (id, request_id, stop_id, assistant_id, reached_at, left_at, gps_verified, status_id, metadata) FROM stdin;
\.


--
-- Data for Name: task_types; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_types (id, code, name, description, status_id, config, created_at) FROM stdin;
\.


--
-- Data for Name: task_updates; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.task_updates (id, request_id, stop_id, assistant_id, update_type_id, message, amount_requested, requires_customer_action, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: tax_master_rules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.tax_master_rules (id, tax_applicable_on, tax_applicability, tax_type, tax_value, formula, tax_label, tax_note, metadata, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
2918d143-7000-41bb-84dc-a78c78f1a1a0	selling_price	exclusive	percent	5.00	(SellingPrice * TaxValue / 100)	GST & Service Fees	Applicable GST is excluded in the total amount.	{"formula": "(SellingPrice * TaxValue / 100)"}	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-20 11:06:37.449095+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-20 18:44:25.234871+05:30	\N	\N	f
6a3b8d40-e67b-445b-a4f2-356eff45b178	selling_price	inclusive	percent	5.00	(SellingPrice * TaxValue / (100 + TaxValue))	GST & Service Fees	Applicable GST is included in the total amount.	{"formula": "(SellingPrice * TaxValue / (100 + TaxValue))"}	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-05 16:46:17.425647+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-07-20 18:44:30.861664+05:30	\N	\N	f
\.


--
-- Data for Name: time_slot_masters; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.time_slot_masters (id, code, name, config, is_active, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
\.


--
-- Data for Name: user_modules; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.user_modules (user_id, module_id, created_at) FROM stdin;
b8451c9b-a9ee-4df1-b33f-2281a5536f42	be0d067f-2d42-41c9-a866-bab4f38b6f2c	2026-05-15 19:30:24.937357+05:30
b8451c9b-a9ee-4df1-b33f-2281a5536f42	422ae9e0-a652-4f1a-92ad-db09d16d1774	2026-05-15 19:30:24.937357+05:30
b8451c9b-a9ee-4df1-b33f-2281a5536f42	a11c4c52-8b51-4ef9-9e91-29ce95115852	2026-05-15 19:30:24.937357+05:30
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.user_permissions (user_id, permission_id, granted_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.user_roles (id, user_id, role_id, scope_type, scope_id, created_at, is_active, is_primary, created_by, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
3939dbf7-a53f-4908-ba5f-efe62bdde4ca	fb698017-57a2-4c52-9651-9afdf51443f9	eab1cd1f-3978-4ae3-9d05-7520f988bd13	\N	\N	2026-05-16 16:15:20.998151+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-16 16:15:20.998151+05:30	\N	\N	f
8fa89ec9-e8f7-4af2-b578-d138382813b7	d93e56cd-29e7-43ce-9e76-9cc3acc24fbc	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-16 23:46:16.30992+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-16 23:46:16.30992+05:30	\N	\N	f
cc9e606d-0ed5-4e42-9425-87c74744b9e0	05fb11bd-857b-478a-96a2-ea0462f499c6	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-20 11:01:53.043024+05:30	f	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 11:06:46.912775+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 11:06:46.912775+05:30	t
a4746343-8b7d-4a86-8537-bf0bcac311ca	05fb11bd-857b-478a-96a2-ea0462f499c6	eab1cd1f-3978-4ae3-9d05-7520f988bd13	\N	\N	2026-05-20 10:58:47.55802+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-20 11:06:46.912775+05:30	\N	\N	f
be22bc15-504e-469f-99b6-ae3d8e42abaf	a6290b06-9d07-4093-98af-a2051e52fa8b	666dd44b-81ac-4715-b977-efb40d4300d0	\N	\N	2026-05-22 11:02:34.315205+05:30	f	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-22 11:05:02.124474+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-22 11:05:02.124474+05:30	t
484887f2-d97a-40d6-a4ae-c49b0dcdfa34	a6290b06-9d07-4093-98af-a2051e52fa8b	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-22 11:05:02.124474+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-22 11:05:02.124474+05:30	\N	\N	f
e929f218-c105-41a8-9dca-a5ac7068463c	3f5df268-3018-4abf-9c45-90025e1d5ec5	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:02:31.395713+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:02:31.395713+05:30	\N	\N	f
e645261b-6a8a-46d2-89e3-c4eafd8e0947	2158223b-c4ba-412a-be7a-03202e9c559f	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:19:46.469346+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:19:46.469346+05:30	\N	\N	f
238c9289-a649-4810-bb65-557a9899a536	9fafacc1-1775-4770-b319-2082bdc17766	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:23:45.089042+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:23:45.089042+05:30	\N	\N	f
32639230-9626-4faf-9d47-f7ca9d6b7361	1e06c5f6-9412-4422-a4e4-7168a1440e27	666dd44b-81ac-4715-b977-efb40d4300d0	\N	\N	2026-05-29 18:28:33.966603+05:30	t	t	9fafacc1-1775-4770-b319-2082bdc17766	\N	2026-05-29 18:28:33.966603+05:30	\N	\N	f
cbce6720-7674-4b62-a597-4bf89ed898a4	24bddbaf-2277-43b9-a9ea-9facdd0bbc74	666dd44b-81ac-4715-b977-efb40d4300d0	\N	\N	2026-05-29 18:28:34.300293+05:30	t	t	9fafacc1-1775-4770-b319-2082bdc17766	\N	2026-05-29 18:28:34.300293+05:30	\N	\N	f
fc121b03-ea1e-4004-8b72-bc7fc5402151	afe33464-d06d-48f5-b47d-eefcb47c7d6b	666dd44b-81ac-4715-b977-efb40d4300d0	\N	\N	2026-05-29 18:30:09.355172+05:30	t	t	9fafacc1-1775-4770-b319-2082bdc17766	\N	2026-05-29 18:30:09.355172+05:30	\N	\N	f
c6289d7a-51ef-431e-b200-15e026cc77b1	d4ddd7e5-cde9-4dad-adf2-3134495db63c	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:31:27.6316+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:31:27.6316+05:30	\N	\N	f
b06f464a-5e56-4220-9a64-272ccdc13338	6c6f699b-c7d8-4cbc-a139-90ce29fea51a	666dd44b-81ac-4715-b977-efb40d4300d0	\N	\N	2026-05-29 18:38:57.895571+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:38:57.895571+05:30	\N	\N	f
e73bc27e-0dbf-46c0-8c1b-9c80ca6e4b3e	98d2f5b2-85c3-4ab5-9cb4-557fef79cf76	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:41:29.853029+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:41:29.853029+05:30	\N	\N	f
ebb0e40c-c0b5-4b68-b657-d90869248478	6f48c1a5-839d-4fbe-95d2-dcfd672db119	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 18:47:00.549708+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 18:47:00.549708+05:30	\N	\N	f
b0d68d2b-9470-48bb-8abc-0825e79d8bb1	1e4d905b-5651-41ea-baa7-1b3d86da0f0d	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 19:08:29.297823+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 19:08:29.297823+05:30	\N	\N	f
fa8804fd-b49e-490c-8077-1e384b4cf6f7	12620997-82ca-40f1-80db-e0d8ca2a6adb	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 19:30:52.54474+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	2026-05-29 19:30:52.54474+05:30	\N	\N	f
d249bd7a-2ea8-4708-b476-deb912bfdf18	f5dd989c-be17-4ca5-9af8-bc31ffe3d288	d219dd99-57d8-4a72-8c9f-1935390939ac	\N	\N	2026-05-29 22:30:01.428878+05:30	t	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-29 23:11:55.860966+05:30	\N	\N	f
e4893499-afd6-4039-adef-6e4c93166492	b8451c9b-a9ee-4df1-b33f-2281a5536f42	e1b01a1c-c36a-4685-984a-1a64b59d8540	\N	\N	2026-05-15 19:30:24.937357+05:30	t	t	\N	\N	2026-05-15 23:00:11.98889+05:30	\N	\N	f
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.users (id, organization_id, phone, email, password_hash, display_name, avatar_file_id, status_id, last_login_at, metadata, created_at, updated_at, deleted_at, created_by, updated_by, deleted_by) FROM stdin;
b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N	9999999999	gourav@zigonow.in	$2b$12$qce0d4flL9/4O6wgbuVZYOND5OALKqY2lNL/qxt.JF7YzAt8rxrda	Customer	\N	\N	\N	{"app": "admin", "seeded": true, "accountStatus": "active", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/0882f182-1c29-41cc-81fe-08616d7eaf8f-1780077880518.jpg", "isDocumentRequired": false, "isLoginWithPassword": true}	2026-05-15 19:28:56.864353+05:30	2026-07-08 09:06:30.735839+05:30	\N	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
d93e56cd-29e7-43ce-9e76-9cc3acc24fbc	\N	8899339137	gourav.admin@zigonow.in	$2b$12$3Hmf8Rg85ZJq6ZBj80BphuaKHpl1JWZu94.fto8wcV7Cz81o2Z2dq	Gourav	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": null, "isDocumentRequired": false, "isLoginWithPassword": true}	2026-05-16 23:46:16.30992+05:30	2026-08-04 19:42:02.329385+05:30	2026-08-04 19:42:02.329385+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
abb54f2c-7728-4007-99b6-7b8d1ca20610	\N	8855223366	staff@zigo.local	$2b$12$VI.8WbTdSR05rTG0gMGCVeXvbJLHsVd7Az1OyZnp/9BRPmo85X9xK	Staff ZIGO	\N	\N	\N	{"accountStatus": "deleted"}	2026-05-15 18:30:25.7754+05:30	2026-05-15 23:05:49.337383+05:30	2026-05-15 23:05:49.337383+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
d9dac68f-895e-43e0-9127-b9eae0db623a	\N	deleted-d9dac68f895e43e09127b9eae0db623a	d9dac68f895e43e09127b9eae0db623a@deleted.zigo.local	$2b$12$Kuwsj5ohz7A3857vN8TrDu8T7P/ahIVYJXkhHGHAaZequc//ynvlG	Reuse First	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": false, "profilePictureUrl": null, "isDocumentRequired": false, "isLoginWithPassword": false, "deletedOriginalEmail": "reuse-1778952710533@example.com", "deletedOriginalPhone": "8952710533"}	2026-05-16 23:01:51.323384+05:30	2026-05-16 23:01:52.135417+05:30	2026-05-16 23:01:51.501218+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
aea973c1-01c8-4b26-9bbe-5de2fa249e45	\N	8952710533	reuse-1778952710533@example.com	$2b$12$mzIF6FZ0sTcBiW7HutsR7el7D6BxeUrEDlY0Lvb7vZPIOP7LbVDsi	Reuse Second	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": false, "profilePictureUrl": null, "isDocumentRequired": false, "isLoginWithPassword": false}	2026-05-16 23:01:52.135417+05:30	2026-05-16 23:01:52.147724+05:30	2026-05-16 23:01:52.147724+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
4f032e28-7c8c-45d7-b355-617e626367b1	\N	deleted-4f032e287c8c45d7b355617e626367b1	ravi@zigonow.in	\N	ravi kumar	\N	\N	\N	{"accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "", "isDocumentRequired": true, "isLoginWithPassword": true, "deletedOriginalPhone": "8899339136"}	2026-05-15 18:56:10.953066+05:30	2026-05-20 10:58:47.55802+05:30	2026-05-15 23:05:43.730688+05:30	\N	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
fb698017-57a2-4c52-9651-9afdf51443f9	\N	deleted-fb69801757a24c5296519afdf51443f9	\N	\N	Gourav	\N	\N	\N	{"accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "", "isDocumentRequired": false, "isLoginWithPassword": false, "deletedOriginalPhone": "8899339136"}	2026-05-16 16:15:20.998151+05:30	2026-05-20 10:58:47.55802+05:30	2026-05-16 22:26:50.320417+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
96e45a3b-7ec8-458c-8020-7a4bb998744d	\N	deleted-96e45a3b7ec8458c80207a4bb998744d	\N	\N	sourav	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/zigo-white-logo-1-2-1779255437593.png", "isDocumentRequired": false, "isLoginWithPassword": false, "deletedOriginalPhone": "8899339136"}	2026-05-20 11:07:23.509253+05:30	2026-05-20 11:12:37.346648+05:30	2026-05-20 11:08:13.908317+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
05fb11bd-857b-478a-96a2-ea0462f499c6	\N	deleted-05fb11bd857b478a96a2ea0462f499c6	\N	\N	Gourav	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/WhatsApp-Image-2026-05-15-at-12-05-08-PM-1779255110832.jpeg", "isDocumentRequired": false, "isLoginWithPassword": false, "deletedOriginalPhone": "8899339136"}	2026-05-20 10:58:47.55802+05:30	2026-05-20 11:12:37.346648+05:30	2026-05-20 11:11:34.883811+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
3f5df268-3018-4abf-9c45-90025e1d5ec5	\N	deleted-3f5df26830184abf9c4590025e1d5ec5	3f5df26830184abf9c4590025e1d5ec5@deleted.zigo.local	$2b$12$au9I.q73e9gkfnT32D3PVu75IhaoPZ0cJy3NfiR/531Krn65zFMUK	ZIGO 62	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780057948918.png", "isDocumentRequired": false, "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662"}	2026-05-29 18:02:31.395713+05:30	2026-05-29 18:19:46.469346+05:30	2026-05-29 18:06:11.250719+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
a6290b06-9d07-4093-98af-a2051e52fa8b	\N	8448865036	\N	$2b$12$8HhDn.aJjbukGnHG/Cr/OehXZPFWG1JociCJYCNw2KIzV1I3DJWr2	Kanshu	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/ZIGO-Partner-1779427942245.png", "isDocumentRequired": false, "isLoginWithPassword": true}	2026-05-22 11:02:34.315205+05:30	2026-05-29 23:11:41.439284+05:30	2026-05-29 23:11:41.439284+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
2158223b-c4ba-412a-be7a-03202e9c559f	\N	deleted-2158223bc4ba412abe7a03202e9c559f	2158223bc4ba412abe7a03202e9c559f@deleted.zigo.local	\N	ZIGO 62	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780058956652.png", "isDocumentRequired": false, "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662"}	2026-05-29 18:19:46.469346+05:30	2026-05-29 18:23:45.089042+05:30	2026-05-29 18:23:20.767873+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
24bddbaf-2277-43b9-a9ea-9facdd0bbc74	\N	8449514014	codex.59514014@example.com	$2b$12$ROxmKCptK0vYzsCXOnaYee1aQ3pxpTWVjiGFi8qKda0cCoTMPSkgu	Codex Manager 59514014	\N	\N	\N	{"isActive": true, "otpChallenge": {"sentAt": "2026-05-29 18:29:15.616209+05:30", "codeHash": "$2b$10$TTrVWDuVPqmDIQUg6clgsuVHfQYVtHb6WMMsquW1e1i0Xw5aAYOg2", "createdBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "expiresAt": "2026-05-29T13:09:14.895Z", "deliveries": {"email": {"reason": "Email OTP provider is not configured.", "skipped": true}, "mobile": {"error": "fetch failed", "status": "failed"}}}, "accountStatus": "inactive", "isLoginWithOtp": true, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/assets/zigo-logo.png", "deletedByCodexTest": true, "isDocumentRequired": false, "isLoginWithPassword": true, "otpVerificationStatus": "pending"}	2026-05-29 18:28:34.300293+05:30	2026-05-29 18:30:25.5531+05:30	2026-05-29 18:30:25.5531+05:30	9fafacc1-1775-4770-b319-2082bdc17766	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N
1e06c5f6-9412-4422-a4e4-7168a1440e27	\N	deleted-1e06c5f694124422a4e47168a1440e27	1e06c5f694124422a4e47168a1440e27@deleted.zigo.local	$2b$12$isxarUQB/c0nfgSi7qfNxu1YY8YUJ6o0tM.zshTP2gxjOsbtpTymS	ZIGO Duplicate Test	\N	\N	\N	{"isActive": true, "accountStatus": "inactive", "isLoginWithOtp": true, "profilePictureUrl": "/assets/zigo-logo.png", "deletedByCodexTest": true, "isDocumentRequired": false, "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662"}	2026-05-29 18:28:33.966603+05:30	2026-05-29 18:31:27.6316+05:30	2026-05-29 18:30:25.5531+05:30	9fafacc1-1775-4770-b319-2082bdc17766	9fafacc1-1775-4770-b319-2082bdc17766	\N
9fafacc1-1775-4770-b319-2082bdc17766	\N	deleted-9fafacc117754770b3192082bdc17766	9fafacc117754770b3192082bdc17766@deleted.zigo.local	$2b$12$.JdaMTngbi2Sb8ipkRrAL.iV9AQYmenOQu5orOqw36oNJurPpjmsq	ZIGO	\N	\N	\N	{"isActive": true, "accountStatus": "deleted", "isLoginWithOtp": true, "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780059219823.png", "isDocumentRequired": false, "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662"}	2026-05-29 18:23:45.089042+05:30	2026-05-29 18:31:27.6316+05:30	2026-05-29 18:30:57.581476+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
afe33464-d06d-48f5-b47d-eefcb47c7d6b	\N	8450609031	codex.59609031@example.com	$2b$12$MF6fw8oYZrI7PrMIinSfx.d1xAWtG9FJ2tPVcMnUH.pcD70/7DEdG	Codex OTP 59609031	\N	\N	\N	{"isActive": true, "otpChallenge": {"sentAt": "2026-05-29 18:30:09.960055+05:30", "codeHash": "$2b$10$h02Oce/OlRa5g2ZV35r/X.iXQcUoMu9EqSLf6N25t6xRo9wwykD12", "createdBy": "9fafacc1-1775-4770-b319-2082bdc17766", "expiresAt": "2026-05-29T13:10:09.485Z", "deliveries": {"email": {"reason": "Email OTP provider is not configured.", "skipped": true}, "mobile": {"error": "Failed to send mobile OTP.", "status": "failed"}}}, "accountStatus": "inactive", "isLoginWithOtp": true, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/assets/zigo-logo.png", "deletedByCodexTest": true, "isDocumentRequired": false, "isLoginWithPassword": true, "otpVerificationStatus": "pending"}	2026-05-29 18:30:09.355172+05:30	2026-05-29 18:30:25.5531+05:30	2026-05-29 18:30:25.5531+05:30	9fafacc1-1775-4770-b319-2082bdc17766	9fafacc1-1775-4770-b319-2082bdc17766	\N
6f48c1a5-839d-4fbe-95d2-dcfd672db119	\N	deleted-6f48c1a5839d4fbe95d2dcfd672db119	6f48c1a5839d4fbe95d2dcfd672db119@deleted.zigo.local	$2b$12$wFuBz0dzVHP1AzLNkwcyx.SmSnnmUeqsfmWOvsiqEYBMvSZ/SuF8K	ZIGO 62	\N	\N	\N	{"isActive": true, "otpChallenge": {"email": {"sentAt": "2026-05-29T13:17:04.582Z", "codeHash": "$2b$10$Yr.mWFt5nJoL/MwlsDesf.gBfQjeUWx/wNrw7Gkid0ilrwQp5RwY2", "expiresAt": "2026-05-29T13:27:00.616Z"}, "mobile": {"sentAt": "2026-05-29T13:17:00.743Z", "codeHash": "$2b$10$/8/TTSa8Sa9jOJIgOE7/b.DAhqADDTllLC22oGATG8o9GJ78W9BwK", "expiresAt": "2026-05-29T13:27:00.616Z"}}, "accountStatus": "deleted", "isLoginWithOtp": true, "otpChannelStatus": {"email": "pending", "mobile": "pending"}, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780060615380.png", "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 18:47:06.617942+05:30", "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662", "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "pending", "otpChallengeDeliveries": {"email": {"error": "Failed to send email OTP.", "status": "failed"}, "mobile": {"response": {"data": {"status": "sent", "createdAt": "2026-05-29T13:17:01.998Z", "messageId": "547f6d0f-d0fb-41b9-a0ca-a1356fa3bec7", "phoneNumber": "+918448736662", "otpRequestId": "0d3b924f-ac57-46ab-83d9-6303ab4d9b26"}, "success": true, "requestId": "req_ca664ca30c664f07", "timestamp": "2026-05-29T13:17:02.018Z", "statusCode": 201}, "messageId": "547f6d0f-d0fb-41b9-a0ca-a1356fa3bec7", "providerId": "startmessaging", "providerName": "StartMessaging"}}}	2026-05-29 18:47:00.549708+05:30	2026-05-29 19:08:29.297823+05:30	2026-05-29 19:06:45.909659+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
12620997-82ca-40f1-80db-e0d8ca2a6adb	\N	8899339136	gourav@zigonow.in	\N	ZIGO 62	\N	\N	\N	{"isActive": true, "duplicateOf": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpChallenge": {}, "accountStatus": "inactive", "otpVerifiedAt": "2026-05-29 22:12:37.45234+05:30", "otpVerifiedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "isLoginWithOtp": true, "otpChannelStatus": {"email": "verified", "mobile": "verified"}, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780063249699.png", "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 22:05:52.330445+05:30", "isLoginWithPassword": true, "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "verified", "otpChallengeDeliveries": {"email": {"status": "sent", "providerId": "zigo-godaddy-smtp", "providerName": "ZIGO GoDaddy SMTP"}, "mobile": {"response": {"data": {"status": "sent", "createdAt": "2026-05-29T16:35:36.433Z", "messageId": "846e1886-ce3f-4574-9e2c-bb036e4df743", "phoneNumber": "+918899339136", "otpRequestId": "81c042fd-1bab-44cc-9262-cebafb7c7d37"}, "success": true, "requestId": "req_47c7336af40b4134", "timestamp": "2026-05-29T16:35:36.436Z", "statusCode": 201}, "messageId": "846e1886-ce3f-4574-9e2c-bb036e4df743", "providerId": "startmessaging", "providerName": "StartMessaging"}}}	2026-05-29 19:30:52.54474+05:30	2026-07-08 09:06:30.735839+05:30	2026-07-08 09:06:30.735839+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
1e4d905b-5651-41ea-baa7-1b3d86da0f0d	\N	deleted-1e4d905b565141eabaa71b3d86da0f0d	1e4d905b565141eabaa71b3d86da0f0d@deleted.zigo.local	$2b$12$MVDmLHi65LA8I1iAnAaaUOmHHAf7H0Dpe8B9H7l0whINIIRC4fS0a	ZIGO 62	\N	\N	\N	{"isActive": true, "otpChallenge": {"email": {"sentAt": "2026-05-29T13:42:00.432Z", "codeHash": "$2b$10$QxhdJaY8zZwW//cugLu7sOsBQ0unx8vR8YuBpHX1hdljd3ve0ltCS", "expiresAt": "2026-05-29T13:52:00.345Z"}}, "accountStatus": "deleted", "isLoginWithOtp": true, "otpChannelStatus": {"email": "pending"}, "otpVerifyChannels": ["email"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780061837070.png", "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 19:12:08.690592+05:30", "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662", "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "pending", "otpChallengeDeliveries": {"email": {"status": "sent", "providerId": "zigo-godaddy-smtp", "providerName": "ZIGO GoDaddy SMTP"}}}	2026-05-29 19:08:29.297823+05:30	2026-05-29 22:30:01.428878+05:30	2026-05-29 19:30:12.049816+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
d4ddd7e5-cde9-4dad-adf2-3134495db63c	\N	deleted-d4ddd7e5cde94dadadf23134495db63c	d4ddd7e5cde94dadadf23134495db63c@deleted.zigo.local	$2b$12$mPj1Dfme4pxfE2NOSG/dj.WVdMZmMIYfd0WiEsYyrXwjlzEUvpaAi	ZIGO 62	\N	\N	\N	{"isActive": true, "otpChallenge": {"sentAt": "2026-05-29 18:31:28.394158+05:30", "codeHash": "$2b$10$663zFAmw9I9BSTxMBwsJCekkiTeEeyaRrhE3FrBmLBbEz7Lroa4/e", "createdBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "expiresAt": "2026-05-29T13:11:27.923Z", "deliveries": {"email": {"reason": "Email OTP provider is not configured.", "skipped": true}, "mobile": {"error": "Failed to send mobile OTP.", "status": "failed"}}}, "accountStatus": "deleted", "isLoginWithOtp": true, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780059681640.png", "isDocumentRequired": false, "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662", "otpVerificationStatus": "pending"}	2026-05-29 18:31:27.6316+05:30	2026-05-29 18:41:29.853029+05:30	2026-05-29 18:40:52.067095+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
6c6f699b-c7d8-4cbc-a139-90ce29fea51a	\N	8460137503	codex.otp.60137503@example.com	$2b$12$hV5FXwSJiRHVy9FcdFR9pOLEKzMfgsjG/8KTys4m/911HQ9N74v8.	Codex OTP Split 60137503	\N	\N	\N	{"isActive": true, "otpChallenge": {}, "accountStatus": "active", "otpVerifiedAt": "2026-05-29 18:38:58.801615+05:30", "otpVerifiedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "isLoginWithOtp": true, "otpChannelStatus": {"email": "verified", "mobile": "verified"}, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/assets/zigo-logo.png", "deletedByCodexTest": true, "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 18:38:58.488258+05:30", "isLoginWithPassword": true, "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "verified", "otpChallengeDeliveries": {"email": {"reason": "Email OTP provider is not configured.", "skipped": true}, "mobile": {"error": "fetch failed", "status": "failed"}}}	2026-05-29 18:38:57.895571+05:30	2026-05-29 18:38:58.801615+05:30	2026-05-29 18:38:58.805252+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N
f5dd989c-be17-4ca5-9af8-bc31ffe3d288	\N	8448736662	gourav@zigonow.in	$2b$12$VwoVrhfjEB5JKlhtWWLvQuvTYyxJ1fGRi6fJsFsCsctFmJLzj0fZe	ZIGO 62	\N	\N	\N	{"isActive": true, "duplicateOf": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpChallenge": {}, "accountStatus": "inactive", "otpVerifiedAt": "2026-05-29 23:17:56.418925+05:30", "otpVerifiedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "isLoginWithOtp": true, "otpChannelStatus": {"email": "verified"}, "passwordSharedAt": "2026-05-29 23:18:21.84993+05:30", "otpVerifyChannels": ["email"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780073993944.png", "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 23:17:36.726574+05:30", "isLoginWithPassword": true, "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "verified", "otpChallengeDeliveries": {"email": {"status": "sent", "providerId": "zigo-godaddy-smtp", "providerName": "ZIGO GoDaddy SMTP"}}, "passwordShareDeliveries": {"email": {"status": "sent", "providerId": "zigo-godaddy-smtp", "providerName": "ZIGO GoDaddy SMTP"}}, "passwordResetBySuperAdminAt": "2026-05-29 23:18:13.913316+05:30"}	2026-05-29 22:30:01.428878+05:30	2026-07-08 09:06:30.735839+05:30	2026-07-08 09:06:30.735839+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	\N
98d2f5b2-85c3-4ab5-9cb4-557fef79cf76	\N	deleted-98d2f5b285c34ab59cb4557fef79cf76	98d2f5b285c34ab59cb4557fef79cf76@deleted.zigo.local	$2b$12$Rcl.1R4xvHgl0eyOGbcy1.vZBrTlmcmnx1EW.TjntVfwqXucsdxW6	ZIGO 62	\N	\N	\N	{"isActive": true, "otpChallenge": {"email": {"sentAt": "2026-05-29T13:11:31.955Z", "codeHash": "$2b$10$8.CNyTyNxCvbU47x3RHptusS551NloJnzjAXOa07MayXxOmUo7l6m", "expiresAt": "2026-05-29T13:21:29.943Z"}, "mobile": {"sentAt": "2026-05-29T13:11:30.093Z", "codeHash": "$2b$10$RiPBMjBoRsbRbPyIAU/29OYQGUZz5lYjNB/tXVg7JNEFQDvZH.eJ.", "expiresAt": "2026-05-29T13:21:29.943Z"}}, "accountStatus": "deleted", "isLoginWithOtp": true, "otpChannelStatus": {"email": "pending", "mobile": "pending"}, "otpVerifyChannels": ["email", "mobile"], "profilePictureUrl": "/uploads/images/ZIGO_split_1-1780060281785.png", "isDocumentRequired": false, "otpChallengeSentAt": "2026-05-29 18:41:31.963554+05:30", "isLoginWithPassword": true, "deletedOriginalEmail": "gourav@zigonow.in", "deletedOriginalPhone": "8448736662", "otpChallengeCreatedBy": "b8451c9b-a9ee-4df1-b33f-2281a5536f42", "otpVerificationStatus": "pending", "otpChallengeDeliveries": {"email": {"reason": "Email OTP provider is not configured.", "skipped": true}, "mobile": {"error": "Failed to send mobile OTP.", "status": "failed"}}}	2026-05-29 18:41:29.853029+05:30	2026-05-29 18:47:00.549708+05:30	2026-05-29 18:46:06.722462+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42
\.


--
-- Data for Name: vehicle_master; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.vehicle_master (id, vehicle_name, company, vehicle_number, model, fuel_type, color, picture_urls, owner_type, rental_company_name, rental_company_address, rental_company_number, rent_slab, rent_charges, is_active, is_deleted, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at, zigo_slab, zigo_charges, cluster_id) FROM stdin;
f17b8ed7-918f-4c61-9552-df89c4b75d62	ATHER 2.0	ATHER	DL12CH8978	2025	EV	Black	["/uploads/images/ather-1779003443281.webp"]	Rented	DELIVEGO	Dwarka, Sector 14, New Delhi - 110078	8899556565	Weekly	500.00	f	t	d93e56cd-29e7-43ce-9e76-9cc3acc24fbc	2026-05-17 13:08:23.112543+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 13:13:47.963984+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 13:13:47.963984+05:30	\N	\N	\N
c4e0fd9a-46f2-4c6d-a199-5d9b5db8e4cb	ATHZ Xpress	ATHER	DL10GH8934	2025	EV	Black	["/uploads/images/ather-1779003930323.webp"]	Own	\N	\N	\N	\N	\N	t	f	d93e56cd-29e7-43ce-9e76-9cc3acc24fbc	2026-05-17 13:15:34.05515+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 18:07:39.368632+05:30	\N	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4
7deaf88f-19fa-4f01-b2b0-febcd805c37e	VIDA	Hero	DL14GH7878	2026	EV	White	["/uploads/images/hero-VIDA-1779003609878.webp", "/uploads/images/VIDA-2-1779003756721.jpg"]	Rent	Hero EV Services Private Limited	Sector - 56, Gurgaon, Haryana - 120044	9685698563	Monthly	3000.00	t	f	d93e56cd-29e7-43ce-9e76-9cc3acc24fbc	2026-05-17 13:11:36.305464+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 01:22:05.505583+05:30	\N	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4
6d7ff17c-5b96-408b-a925-139e7862a113	APACHE	TVS	DL12JU9090	2024	Petrol	Red	["/uploads/images/WhatsApp-Image-2026-05-30-at-1-27-53-AM-1780084684284.jpeg"]	Own	\N	\N	\N	\N	\N	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 01:28:45.171108+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 01:28:45.171108+05:30	\N	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4
965b89f0-de72-4261-991a-5897590ca6e2	SUZE	Suzuki	DL01UH8889	2026	EV	Light Green	["/uploads/images/WhatsApp-Image-2026-05-30-at-1-29-49-AM-1780084809132.jpeg"]	Own	\N	\N	\N	\N	\N	t	f	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 01:30:19.646434+05:30	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-30 01:30:19.646434+05:30	\N	\N	\N	\N	f7965377-9d4c-4fe2-ba62-ca8611ece9e4
\.


--
-- Data for Name: wallet_ledger; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.wallet_ledger (id, wallet_id, request_id, entry_type_id, direction_id, amount, currency, reference_type, reference_id, notes, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.wallets (id, owner_type, owner_id, currency, status_id, created_at) FROM stdin;
\.


--
-- Data for Name: webhook_deliveries; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.webhook_deliveries (id, webhook_endpoint_id, outbox_event_id, status_id, attempt_count, request_payload, response_status, response_body, next_retry_at, delivered_at, created_at) FROM stdin;
\.


--
-- Data for Name: webhook_endpoints; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.webhook_endpoints (id, organization_id, api_client_id, url, subscribed_events, secret_reference, status_id, retry_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workflow_states; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.workflow_states (id, workflow_id, code, name, is_initial, is_terminal, sort_order, config) FROM stdin;
\.


--
-- Data for Name: workflow_transitions; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.workflow_transitions (id, workflow_id, from_state_id, to_state_id, action_code, actor_type_id, requires_reason, requires_payment, requires_proof, rule_config) FROM stdin;
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.workflows (id, code, name, entity_type, version, is_active, config, created_at) FROM stdin;
\.


--
-- Data for Name: zones; Type: TABLE DATA; Schema: zigo; Owner: -
--

COPY zigo.zones (id, city_id, name, code, status_id, metadata, created_at, is_active, created_by, updated_by, updated_at, deleted_by, deleted_at, is_deleted) FROM stdin;
4066a462-e317-4185-b31e-f7607485db96	21ead40b-98c2-4bbb-b179-ca74f427a206	Dwarka Zone 1	ZN002	\N	{}	2026-05-17 14:14:09.215232+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:14:09.215232+05:30	\N	\N	f
118b1cca-1ce1-43d4-81c2-a879284b1607	8071a1a7-dc7f-41dd-9a70-f42e1d175c25	Gurgaon Zone 1	ZN001	\N	{}	2026-05-16 00:16:44.202508+05:30	t	b8451c9b-a9ee-4df1-b33f-2281a5536f42	b8451c9b-a9ee-4df1-b33f-2281a5536f42	2026-05-17 14:14:20.996672+05:30	\N	\N	f
c79bea54-ed97-4f82-86a6-c8bad657c876	eef25e78-da34-48e2-a46d-8a6d6a127ead	Jammu Zone 1	ZNJKJ01	\N	{}	2026-05-22 11:09:18.94303+05:30	t	a6290b06-9d07-4093-98af-a2051e52fa8b	a6290b06-9d07-4093-98af-a2051e52fa8b	2026-05-22 11:09:46.25921+05:30	\N	\N	f
\.


--
-- Name: booking_invoice_email_jobs_id_seq; Type: SEQUENCE SET; Schema: zigo; Owner: -
--

SELECT pg_catalog.setval('zigo.booking_invoice_email_jobs_id_seq', 1, false);


--
-- Name: booking_realtime_events_id_seq; Type: SEQUENCE SET; Schema: zigo; Owner: -
--

SELECT pg_catalog.setval('zigo.booking_realtime_events_id_seq', 1, false);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: api_clients api_clients_client_key_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.api_clients
    ADD CONSTRAINT api_clients_client_key_key UNIQUE (client_key);


--
-- Name: api_clients api_clients_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.api_clients
    ADD CONSTRAINT api_clients_pkey PRIMARY KEY (id);


--
-- Name: app_config_values app_config_values_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_config_values
    ADD CONSTRAINT app_config_values_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approval_responses approval_responses_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_responses
    ADD CONSTRAINT approval_responses_pkey PRIMARY KEY (id);


--
-- Name: assignment_policies assignment_policies_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policies
    ADD CONSTRAINT assignment_policies_code_key UNIQUE (code);


--
-- Name: assignment_policies assignment_policies_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policies
    ADD CONSTRAINT assignment_policies_pkey PRIMARY KEY (id);


--
-- Name: assignment_policy_rules assignment_policy_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policy_rules
    ADD CONSTRAINT assignment_policy_rules_pkey PRIMARY KEY (id);


--
-- Name: assignment_runs assignment_runs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_runs
    ADD CONSTRAINT assignment_runs_pkey PRIMARY KEY (id);


--
-- Name: assistant_availability assistant_availability_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_availability
    ADD CONSTRAINT assistant_availability_pkey PRIMARY KEY (id);


--
-- Name: assistant_calendar_blocks assistant_calendar_blocks_no_overlap; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_calendar_blocks
    ADD CONSTRAINT assistant_calendar_blocks_no_overlap EXCLUDE USING gist (assistant_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE (((status_code = 'active'::text) AND (block_type = ANY (ARRAY['BOOKING'::text, 'TEMPORARY_HOLD'::text, 'TRAVEL'::text, 'WRAP_UP'::text, 'BREAK'::text, 'TIME_OFF'::text, 'ADMIN_BLOCK'::text]))));


--
-- Name: assistant_calendar_blocks assistant_calendar_blocks_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_calendar_blocks
    ADD CONSTRAINT assistant_calendar_blocks_pkey PRIMARY KEY (id);


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_pkey PRIMARY KEY (id);


--
-- Name: assistant_cluster_map assistant_cluster_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_cluster_map
    ADD CONSTRAINT assistant_cluster_map_pkey PRIMARY KEY (assistant_id, cluster_id);


--
-- Name: assistant_delay_credits assistant_delay_credits_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_pkey PRIMARY KEY (id);


--
-- Name: assistant_delay_credits assistant_delay_credits_task_assignment_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_task_assignment_id_key UNIQUE (task_assignment_id);


--
-- Name: assistant_document_verification_events assistant_document_verification_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_document_verification_events
    ADD CONSTRAINT assistant_document_verification_events_pkey PRIMARY KEY (id);


--
-- Name: assistant_documents assistant_documents_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_pkey PRIMARY KEY (id);


--
-- Name: assistant_earnings assistant_earnings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_earnings
    ADD CONSTRAINT assistant_earnings_pkey PRIMARY KEY (id);


--
-- Name: assistant_location_pings assistant_location_pings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_location_pings
    ADD CONSTRAINT assistant_location_pings_pkey PRIMARY KEY (id);


--
-- Name: assistant_master_logs assistant_master_logs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_master_logs
    ADD CONSTRAINT assistant_master_logs_pkey PRIMARY KEY (id);


--
-- Name: assistant_shift_plans assistant_shift_plans_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_shift_plans
    ADD CONSTRAINT assistant_shift_plans_pkey PRIMARY KEY (id);


--
-- Name: assistant_skill_map assistant_skill_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_skill_map
    ADD CONSTRAINT assistant_skill_map_pkey PRIMARY KEY (assistant_id, skill_id);


--
-- Name: assistant_skills assistant_skills_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_skills
    ADD CONSTRAINT assistant_skills_code_key UNIQUE (code);


--
-- Name: assistant_skills assistant_skills_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_skills
    ADD CONSTRAINT assistant_skills_pkey PRIMARY KEY (id);


--
-- Name: assistant_task_offers assistant_task_offers_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_pkey PRIMARY KEY (id);


--
-- Name: assistant_training_records assistant_training_records_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_training_records
    ADD CONSTRAINT assistant_training_records_pkey PRIMARY KEY (id);


--
-- Name: assistant_vehicle_assignments assistant_vehicle_assignments_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_assignments
    ADD CONSTRAINT assistant_vehicle_assignments_pkey PRIMARY KEY (id);


--
-- Name: assistant_vehicle_damage_reports assistant_vehicle_damage_reports_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_damage_reports
    ADD CONSTRAINT assistant_vehicle_damage_reports_pkey PRIMARY KEY (id);


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_pkey PRIMARY KEY (id);


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_vehicle_id_document_type_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_vehicle_id_document_type_id_key UNIQUE (vehicle_id, document_type_id);


--
-- Name: assistant_vehicles assistant_vehicles_assistant_id_registration_number_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicles
    ADD CONSTRAINT assistant_vehicles_assistant_id_registration_number_key UNIQUE (assistant_id, registration_number);


--
-- Name: assistant_vehicles assistant_vehicles_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicles
    ADD CONSTRAINT assistant_vehicles_pkey PRIMARY KEY (id);


--
-- Name: assistants assistants_assistant_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_assistant_code_key UNIQUE (assistant_code);


--
-- Name: assistants assistants_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_pkey PRIMARY KEY (id);


--
-- Name: assistants assistants_user_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_user_id_key UNIQUE (user_id);


--
-- Name: booking_billing_snapshots booking_billing_snapshots_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_billing_snapshots
    ADD CONSTRAINT booking_billing_snapshots_pkey PRIMARY KEY (id);


--
-- Name: booking_billing_snapshots booking_billing_snapshots_service_request_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_billing_snapshots
    ADD CONSTRAINT booking_billing_snapshots_service_request_id_key UNIQUE (service_request_id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_pkey PRIMARY KEY (id);


--
-- Name: booking_engine_rules booking_engine_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_pkey PRIMARY KEY (id);


--
-- Name: booking_invoice_email_jobs booking_invoice_email_jobs_booking_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_invoice_email_jobs
    ADD CONSTRAINT booking_invoice_email_jobs_booking_id_key UNIQUE (booking_id);


--
-- Name: booking_invoice_email_jobs booking_invoice_email_jobs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_invoice_email_jobs
    ADD CONSTRAINT booking_invoice_email_jobs_pkey PRIMARY KEY (id);


--
-- Name: booking_orchestration_state booking_orchestration_state_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_orchestration_state
    ADD CONSTRAINT booking_orchestration_state_pkey PRIMARY KEY (service_request_id);


--
-- Name: booking_realtime_events booking_realtime_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_realtime_events
    ADD CONSTRAINT booking_realtime_events_pkey PRIMARY KEY (id);


--
-- Name: booking_reviews booking_reviews_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_reviews
    ADD CONSTRAINT booking_reviews_pkey PRIMARY KEY (id);


--
-- Name: booking_reviews booking_reviews_service_request_id_customer_user_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_reviews
    ADD CONSTRAINT booking_reviews_service_request_id_customer_user_id_key UNIQUE (service_request_id, customer_user_id);


--
-- Name: booking_route_sessions booking_route_sessions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_pkey PRIMARY KEY (id);


--
-- Name: booking_route_sessions booking_route_sessions_service_request_id_assistant_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_service_request_id_assistant_id_key UNIQUE (service_request_id, assistant_id);


--
-- Name: booking_task_update_reads booking_task_update_reads_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_update_reads
    ADD CONSTRAINT booking_task_update_reads_pkey PRIMARY KEY (update_id, user_id);


--
-- Name: booking_task_updates booking_task_updates_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_updates
    ADD CONSTRAINT booking_task_updates_pkey PRIMARY KEY (id);


--
-- Name: booking_type_masters booking_type_masters_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_type_masters
    ADD CONSTRAINT booking_type_masters_code_key UNIQUE (code);


--
-- Name: booking_type_masters booking_type_masters_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_type_masters
    ADD CONSTRAINT booking_type_masters_pkey PRIMARY KEY (id);


--
-- Name: categories categories_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_code_key UNIQUE (code);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_price_rules category_price_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_pkey PRIMARY KEY (id);


--
-- Name: category_service_masters category_service_masters_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_service_masters
    ADD CONSTRAINT category_service_masters_pkey PRIMARY KEY (id);


--
-- Name: category_store_map category_store_map_category_id_store_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_category_id_store_id_key UNIQUE (category_id, store_id);


--
-- Name: category_store_map category_store_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_threads chat_threads_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (id);


--
-- Name: cities cities_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_code_key UNIQUE (code);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cluster_access_rules cluster_access_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_access_rules
    ADD CONSTRAINT cluster_access_rules_pkey PRIMARY KEY (id);


--
-- Name: cluster_access_rules cluster_access_rules_source_cluster_id_allowed_cluster_id_r_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_access_rules
    ADD CONSTRAINT cluster_access_rules_source_cluster_id_allowed_cluster_id_r_key UNIQUE (source_cluster_id, allowed_cluster_id, rule_type_id);


--
-- Name: cluster_boundaries cluster_boundaries_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_boundaries
    ADD CONSTRAINT cluster_boundaries_pkey PRIMARY KEY (id);


--
-- Name: cluster_category_settings cluster_category_settings_cluster_id_category_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_cluster_id_category_id_key UNIQUE (cluster_id, category_id);


--
-- Name: cluster_category_settings cluster_category_settings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_pkey PRIMARY KEY (id);


--
-- Name: cluster_launch_configs cluster_launch_configs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_launch_configs
    ADD CONSTRAINT cluster_launch_configs_pkey PRIMARY KEY (id);


--
-- Name: cluster_service_settings cluster_service_settings_cluster_id_service_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_cluster_id_service_id_key UNIQUE (cluster_id, service_id);


--
-- Name: cluster_service_settings cluster_service_settings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_pkey PRIMARY KEY (id);


--
-- Name: cluster_service_visibility cluster_service_visibility_cluster_id_service_id_category_i_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_visibility
    ADD CONSTRAINT cluster_service_visibility_cluster_id_service_id_category_i_key UNIQUE (cluster_id, service_id, category_id);


--
-- Name: cluster_service_visibility cluster_service_visibility_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_visibility
    ADD CONSTRAINT cluster_service_visibility_pkey PRIMARY KEY (id);


--
-- Name: cluster_store_map cluster_store_map_cluster_id_store_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_cluster_id_store_id_key UNIQUE (cluster_id, store_id);


--
-- Name: cluster_store_map cluster_store_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_pkey PRIMARY KEY (id);


--
-- Name: clusters clusters_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_code_key UNIQUE (code);


--
-- Name: clusters clusters_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customer_approvals customer_approvals_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_approvals
    ADD CONSTRAINT customer_approvals_pkey PRIMARY KEY (id);


--
-- Name: customer_auth_sessions customer_auth_sessions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_auth_sessions
    ADD CONSTRAINT customer_auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_cart customer_cart_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_cart
    ADD CONSTRAINT customer_cart_pkey PRIMARY KEY (customer_id);


--
-- Name: customer_disputes customer_disputes_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_disputes
    ADD CONSTRAINT customer_disputes_pkey PRIMARY KEY (id);


--
-- Name: customer_favorite_places customer_favorite_places_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_favorite_places
    ADD CONSTRAINT customer_favorite_places_pkey PRIMARY KEY (customer_id, place_id);


--
-- Name: customer_memberships customer_memberships_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_memberships
    ADD CONSTRAINT customer_memberships_pkey PRIMARY KEY (id);


--
-- Name: customer_notes customer_notes_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_notes
    ADD CONSTRAINT customer_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_support_messages customer_support_messages_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_messages
    ADD CONSTRAINT customer_support_messages_pkey PRIMARY KEY (id);


--
-- Name: customer_support_tickets customer_support_tickets_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_tickets
    ADD CONSTRAINT customer_support_tickets_pkey PRIMARY KEY (id);


--
-- Name: customer_support_tickets customer_support_tickets_ticket_number_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_tickets
    ADD CONSTRAINT customer_support_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: customer_unserviceable_locations customer_unserviceable_locations_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_unserviceable_locations
    ADD CONSTRAINT customer_unserviceable_locations_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);


--
-- Name: daily_assistant_metrics daily_assistant_metrics_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.daily_assistant_metrics
    ADD CONSTRAINT daily_assistant_metrics_pkey PRIMARY KEY (metric_date, assistant_id);


--
-- Name: daily_cluster_metrics daily_cluster_metrics_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.daily_cluster_metrics
    ADD CONSTRAINT daily_cluster_metrics_pkey PRIMARY KEY (metric_date, cluster_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.document_types
    ADD CONSTRAINT document_types_code_key UNIQUE (code);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);


--
-- Name: exception_events exception_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.feature_flags
    ADD CONSTRAINT feature_flags_code_key UNIQUE (code);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: file_links file_links_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.file_links
    ADD CONSTRAINT file_links_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: files files_storage_provider_bucket_object_key_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.files
    ADD CONSTRAINT files_storage_provider_bucket_object_key_key UNIQUE (storage_provider, bucket, object_key);


--
-- Name: idempotency_keys idempotency_keys_key_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.idempotency_keys
    ADD CONSTRAINT idempotency_keys_key_key UNIQUE (key);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lookup_groups lookup_groups_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.lookup_groups
    ADD CONSTRAINT lookup_groups_code_key UNIQUE (code);


--
-- Name: lookup_groups lookup_groups_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.lookup_groups
    ADD CONSTRAINT lookup_groups_pkey PRIMARY KEY (id);


--
-- Name: lookup_values lookup_values_group_id_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.lookup_values
    ADD CONSTRAINT lookup_values_group_id_code_key UNIQUE (group_id, code);


--
-- Name: lookup_values lookup_values_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.lookup_values
    ADD CONSTRAINT lookup_values_pkey PRIMARY KEY (id);


--
-- Name: membership_plans membership_plans_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.membership_plans
    ADD CONSTRAINT membership_plans_code_key UNIQUE (code);


--
-- Name: membership_plans membership_plans_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.membership_plans
    ADD CONSTRAINT membership_plans_pkey PRIMARY KEY (id);


--
-- Name: module_permissions module_permissions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.module_permissions
    ADD CONSTRAINT module_permissions_pkey PRIMARY KEY (module_id, permission_id);


--
-- Name: modules modules_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.modules
    ADD CONSTRAINT modules_code_key UNIQUE (code);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_events
    ADD CONSTRAINT notification_events_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_templates
    ADD CONSTRAINT notification_templates_code_key UNIQUE (code);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: payment_mode_masters payment_mode_masters_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_merchant_order_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_transactions
    ADD CONSTRAINT payment_transactions_merchant_order_id_key UNIQUE (merchant_order_id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_webhooks payment_webhooks_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_webhooks
    ADD CONSTRAINT payment_webhooks_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: policy_configs policy_configs_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.policy_configs
    ADD CONSTRAINT policy_configs_code_key UNIQUE (code);


--
-- Name: policy_configs policy_configs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.policy_configs
    ADD CONSTRAINT policy_configs_pkey PRIMARY KEY (id);


--
-- Name: portal_favorites portal_favorites_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.portal_favorites
    ADD CONSTRAINT portal_favorites_pkey PRIMARY KEY (user_id, actor_type, favorite_type, object_id);


--
-- Name: price_master_rules price_master_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_pkey PRIMARY KEY (id);


--
-- Name: pricing_policies pricing_policies_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_policies
    ADD CONSTRAINT pricing_policies_code_key UNIQUE (code);


--
-- Name: pricing_policies pricing_policies_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_policies
    ADD CONSTRAINT pricing_policies_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: razorpay_downtimes razorpay_downtimes_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_downtimes
    ADD CONSTRAINT razorpay_downtimes_pkey PRIMARY KEY (id);


--
-- Name: razorpay_payments razorpay_payments_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_payments
    ADD CONSTRAINT razorpay_payments_pkey PRIMARY KEY (id);


--
-- Name: razorpay_payments razorpay_payments_provider_order_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_payments
    ADD CONSTRAINT razorpay_payments_provider_order_id_key UNIQUE (provider_order_id);


--
-- Name: razorpay_webhook_events razorpay_webhook_events_event_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_webhook_events
    ADD CONSTRAINT razorpay_webhook_events_event_id_key UNIQUE (event_id);


--
-- Name: razorpay_webhook_events razorpay_webhook_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_webhook_events
    ADD CONSTRAINT razorpay_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: reason_codes reason_codes_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.reason_codes
    ADD CONSTRAINT reason_codes_code_key UNIQUE (code);


--
-- Name: reason_codes reason_codes_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.reason_codes
    ADD CONSTRAINT reason_codes_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- Name: request_items request_items_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_items
    ADD CONSTRAINT request_items_pkey PRIMARY KEY (id);


--
-- Name: request_locations request_locations_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_locations
    ADD CONSTRAINT request_locations_pkey PRIMARY KEY (id);


--
-- Name: request_locations request_locations_service_request_id_sequence_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_locations
    ADD CONSTRAINT request_locations_service_request_id_sequence_key UNIQUE (service_request_id, sequence);


--
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (id);


--
-- Name: request_stops request_stops_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_pkey PRIMARY KEY (id);


--
-- Name: request_stops request_stops_request_id_sequence_no_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_request_id_sequence_no_key UNIQUE (request_id, sequence_no);


--
-- Name: request_timeline_events request_timeline_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_timeline_events
    ADD CONSTRAINT request_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: role_modules role_modules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_modules
    ADD CONSTRAINT role_modules_pkey PRIMARY KEY (role_id, module_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: role_verification_requirements role_verification_requirements_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_verification_requirements
    ADD CONSTRAINT role_verification_requirements_pkey PRIMARY KEY (role_id, document_type_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (service_id, category_id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_request_number_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_request_number_key UNIQUE (request_number);


--
-- Name: service_task_rules service_task_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_task_rules
    ADD CONSTRAINT service_task_rules_pkey PRIMARY KEY (id);


--
-- Name: service_task_rules service_task_rules_service_id_task_type_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_task_rules
    ADD CONSTRAINT service_task_rules_service_id_task_type_id_key UNIQUE (service_id, task_type_id);


--
-- Name: services services_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_code_key UNIQUE (code);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.settlements
    ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_request_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.settlements
    ADD CONSTRAINT settlements_request_id_key UNIQUE (request_id);


--
-- Name: sla_breach_events sla_breach_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.sla_breach_events
    ADD CONSTRAINT sla_breach_events_pkey PRIMARY KEY (id);


--
-- Name: states states_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.states
    ADD CONSTRAINT states_code_key UNIQUE (code);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: store_categories store_categories_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_code_key UNIQUE (code);


--
-- Name: store_categories store_categories_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_pkey PRIMARY KEY (id);


--
-- Name: store_category_map store_category_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_pkey PRIMARY KEY (id);


--
-- Name: store_category_map store_category_map_store_category_id_store_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_store_category_id_store_id_key UNIQUE (store_category_id, store_id);


--
-- Name: store_cluster_map store_cluster_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_cluster_map
    ADD CONSTRAINT store_cluster_map_pkey PRIMARY KEY (store_id, cluster_id);


--
-- Name: store_images store_images_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_pkey PRIMARY KEY (id);


--
-- Name: store_keyword_map store_keyword_map_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_pkey PRIMARY KEY (id);


--
-- Name: store_keyword_map store_keyword_map_store_keyword_id_store_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_store_keyword_id_store_id_key UNIQUE (store_keyword_id, store_id);


--
-- Name: store_keywords store_keywords_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_code_key UNIQUE (code);


--
-- Name: store_keywords store_keywords_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_place_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_place_id_key UNIQUE (place_id);


--
-- Name: stores stores_store_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);


--
-- Name: support_issues support_issues_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_issues
    ADD CONSTRAINT support_issues_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_ticket_number_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: surge_rules surge_rules_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.surge_rules
    ADD CONSTRAINT surge_rules_code_key UNIQUE (code);


--
-- Name: surge_rules surge_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.surge_rules
    ADD CONSTRAINT surge_rules_pkey PRIMARY KEY (id);


--
-- Name: task_assignments task_assignments_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_pkey PRIMARY KEY (id);


--
-- Name: task_events task_events_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_events
    ADD CONSTRAINT task_events_pkey PRIMARY KEY (id);


--
-- Name: task_execution_sessions task_execution_sessions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_execution_sessions
    ADD CONSTRAINT task_execution_sessions_pkey PRIMARY KEY (id);


--
-- Name: task_execution_sessions task_execution_sessions_request_id_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_execution_sessions
    ADD CONSTRAINT task_execution_sessions_request_id_key UNIQUE (request_id);


--
-- Name: task_proofs task_proofs_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_pkey PRIMARY KEY (id);


--
-- Name: task_stop_visits task_stop_visits_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_stop_visits
    ADD CONSTRAINT task_stop_visits_pkey PRIMARY KEY (id);


--
-- Name: task_types task_types_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_types
    ADD CONSTRAINT task_types_code_key UNIQUE (code);


--
-- Name: task_types task_types_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_types
    ADD CONSTRAINT task_types_pkey PRIMARY KEY (id);


--
-- Name: task_updates task_updates_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_updates
    ADD CONSTRAINT task_updates_pkey PRIMARY KEY (id);


--
-- Name: tax_master_rules tax_master_rules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.tax_master_rules
    ADD CONSTRAINT tax_master_rules_pkey PRIMARY KEY (id);


--
-- Name: time_slot_masters time_slot_masters_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.time_slot_masters
    ADD CONSTRAINT time_slot_masters_code_key UNIQUE (code);


--
-- Name: time_slot_masters time_slot_masters_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.time_slot_masters
    ADD CONSTRAINT time_slot_masters_pkey PRIMARY KEY (id);


--
-- Name: user_modules user_modules_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_modules
    ADD CONSTRAINT user_modules_pkey PRIMARY KEY (user_id, module_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_master vehicle_master_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.vehicle_master
    ADD CONSTRAINT vehicle_master_pkey PRIMARY KEY (id);


--
-- Name: wallet_ledger wallet_ledger_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallet_ledger
    ADD CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_owner_type_owner_id_currency_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallets
    ADD CONSTRAINT wallets_owner_type_owner_id_currency_key UNIQUE (owner_type, owner_id, currency);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: webhook_endpoints webhook_endpoints_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id);


--
-- Name: workflow_states workflow_states_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_states
    ADD CONSTRAINT workflow_states_pkey PRIMARY KEY (id);


--
-- Name: workflow_states workflow_states_workflow_id_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_states
    ADD CONSTRAINT workflow_states_workflow_id_code_key UNIQUE (workflow_id, code);


--
-- Name: workflow_transitions workflow_transitions_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_transitions workflow_transitions_workflow_id_from_state_id_to_state_id__key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_workflow_id_from_state_id_to_state_id__key UNIQUE (workflow_id, from_state_id, to_state_id, action_code);


--
-- Name: workflows workflows_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflows
    ADD CONSTRAINT workflows_code_key UNIQUE (code);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: zones zones_city_id_code_key; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_city_id_code_key UNIQUE (city_id, code);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: customer_auth_sessions_customer_active_idx; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX customer_auth_sessions_customer_active_idx ON zigo.customer_auth_sessions USING btree (customer_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: customer_auth_sessions_user_active_idx; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX customer_auth_sessions_user_active_idx ON zigo.customer_auth_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_admin_actions_entity; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_admin_actions_entity ON zigo.admin_actions USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_app_settings_active_key; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_app_settings_active_key ON zigo.app_settings USING btree (key, is_active, is_deleted);


--
-- Name: idx_assistant_availability_latest; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_availability_latest ON zigo.assistant_availability USING btree (assistant_id, changed_at DESC);


--
-- Name: idx_assistant_availability_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_availability_location ON zigo.assistant_availability USING gist (location);


--
-- Name: idx_assistant_calendar_blocks_assistant_window; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_calendar_blocks_assistant_window ON zigo.assistant_calendar_blocks USING btree (assistant_id, start_at, end_at) WHERE (status_code = 'active'::text);


--
-- Name: idx_assistant_calendar_blocks_cluster_window; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_calendar_blocks_cluster_window ON zigo.assistant_calendar_blocks USING btree (cluster_id, start_at, end_at) WHERE (status_code = 'active'::text);


--
-- Name: idx_assistant_calendar_blocks_source; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_calendar_blocks_source ON zigo.assistant_calendar_blocks USING btree (source_type, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_assistant_damage_reports_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_damage_reports_assistant ON zigo.assistant_vehicle_damage_reports USING btree (assistant_id, created_at DESC);


--
-- Name: idx_assistant_delay_credits_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_delay_credits_assistant ON zigo.assistant_delay_credits USING btree (assistant_id, created_at DESC);


--
-- Name: idx_assistant_delay_credits_booking; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_delay_credits_booking ON zigo.assistant_delay_credits USING btree (service_request_id);


--
-- Name: idx_assistant_doc_events_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_doc_events_assistant ON zigo.assistant_document_verification_events USING btree (assistant_id, created_at DESC);


--
-- Name: idx_assistant_document_verification_events_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_document_verification_events_assistant ON zigo.assistant_document_verification_events USING btree (assistant_id, created_at DESC);


--
-- Name: idx_assistant_document_verification_events_document; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_document_verification_events_document ON zigo.assistant_document_verification_events USING btree (assistant_document_id, created_at DESC);


--
-- Name: idx_assistant_location_pings_assistant_created; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_location_pings_assistant_created ON zigo.assistant_location_pings USING btree (assistant_id, created_at DESC);


--
-- Name: idx_assistant_location_pings_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_location_pings_location ON zigo.assistant_location_pings USING gist (location);


--
-- Name: idx_assistant_location_pings_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_location_pings_request ON zigo.assistant_location_pings USING btree (service_request_id, created_at DESC);


--
-- Name: idx_assistant_master_logs_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_assistant_master_logs_assistant ON zigo.assistant_master_logs USING btree (assistant_id, created_at DESC);


--
-- Name: idx_booking_billing_snapshots_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_billing_snapshots_request ON zigo.booking_billing_snapshots USING btree (service_request_id);


--
-- Name: idx_booking_engine_quick_replies_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_engine_quick_replies_active ON zigo.booking_engine_quick_replies USING btree (is_deleted, is_active, actor, booking_stage);


--
-- Name: idx_booking_engine_quick_replies_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_engine_quick_replies_scope ON zigo.booking_engine_quick_replies USING btree (scope_type, state_id, city_id, zone_id, cluster_id, category_id);


--
-- Name: idx_booking_engine_quick_replies_sort; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_engine_quick_replies_sort ON zigo.booking_engine_quick_replies USING btree (actor, booking_stage, sort_order, title);


--
-- Name: idx_booking_engine_rules_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_engine_rules_active ON zigo.booking_engine_rules USING btree (is_deleted, is_active, scope_type);


--
-- Name: idx_booking_engine_rules_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_engine_rules_scope ON zigo.booking_engine_rules USING btree (scope_type, state_id, city_id, zone_id, cluster_id, category_id);


--
-- Name: idx_booking_invoice_email_jobs_due; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_invoice_email_jobs_due ON zigo.booking_invoice_email_jobs USING btree (next_attempt_at, id) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text, 'processing'::text]));


--
-- Name: idx_booking_orchestration_state_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_orchestration_state_assistant ON zigo.booking_orchestration_state USING btree (assistant_id);


--
-- Name: idx_booking_orchestration_state_cluster_risk; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_orchestration_state_cluster_risk ON zigo.booking_orchestration_state USING btree (cluster_id, risk_status, next_check_at);


--
-- Name: idx_booking_realtime_events_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_realtime_events_assistant ON zigo.booking_realtime_events USING btree (assistant_id);


--
-- Name: idx_booking_realtime_events_booking; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_realtime_events_booking ON zigo.booking_realtime_events USING btree (booking_id);


--
-- Name: idx_booking_realtime_events_cluster; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_realtime_events_cluster ON zigo.booking_realtime_events USING btree (cluster_id);


--
-- Name: idx_booking_realtime_events_created; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_realtime_events_created ON zigo.booking_realtime_events USING btree (created_at DESC);


--
-- Name: idx_booking_reviews_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_reviews_assistant ON zigo.booking_reviews USING btree (assistant_id, updated_at DESC);


--
-- Name: idx_booking_reviews_customer; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_reviews_customer ON zigo.booking_reviews USING btree (customer_user_id, updated_at DESC);


--
-- Name: idx_booking_route_sessions_assistant_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_route_sessions_assistant_status ON zigo.booking_route_sessions USING btree (assistant_id, status_code, updated_at DESC);


--
-- Name: idx_booking_route_sessions_booking_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_route_sessions_booking_status ON zigo.booking_route_sessions USING btree (service_request_id, status_code, updated_at DESC);


--
-- Name: idx_booking_task_update_reads_user; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_task_update_reads_user ON zigo.booking_task_update_reads USING btree (user_id, read_at DESC);


--
-- Name: idx_booking_task_updates_actor; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_task_updates_actor ON zigo.booking_task_updates USING btree (actor_user_id, created_at DESC);


--
-- Name: idx_booking_task_updates_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_task_updates_request ON zigo.booking_task_updates USING btree (service_request_id, created_at DESC);


--
-- Name: idx_booking_type_masters_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_booking_type_masters_active ON zigo.booking_type_masters USING btree (is_deleted, is_active, booking_type);


--
-- Name: idx_capacity_reservations_assistant_window; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_capacity_reservations_assistant_window ON zigo.assistant_capacity_reservations USING btree (assistant_id, reserved_from, reserved_until) WHERE (status_code = ANY (ARRAY['held'::text, 'reserved'::text, 'assigned'::text]));


--
-- Name: idx_capacity_reservations_booking; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_capacity_reservations_booking ON zigo.assistant_capacity_reservations USING btree (service_request_id);


--
-- Name: idx_capacity_reservations_cluster_window; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_capacity_reservations_cluster_window ON zigo.assistant_capacity_reservations USING btree (cluster_id, reserved_from, reserved_until) WHERE (status_code = ANY (ARRAY['held'::text, 'reserved'::text, 'assigned'::text]));


--
-- Name: idx_capacity_reservations_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_capacity_reservations_status ON zigo.assistant_capacity_reservations USING btree (status_code, updated_at DESC);


--
-- Name: idx_categories_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_categories_active ON zigo.categories USING btree (is_deleted, is_active, sort_order, name);


--
-- Name: idx_category_price_rules_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_category_price_rules_active ON zigo.category_price_rules USING btree (is_deleted, is_active, category_id);


--
-- Name: idx_category_price_rules_location_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_category_price_rules_location_scope ON zigo.category_price_rules USING btree (scope_type, state_id, city_id, zone_id, cluster_id);


--
-- Name: idx_category_service_masters_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_category_service_masters_active ON zigo.category_service_masters USING btree (is_deleted, is_active, is_enabled, service_position);


--
-- Name: idx_cities_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_cities_active ON zigo.cities USING btree (is_deleted, is_active, name);


--
-- Name: idx_cluster_boundaries_geometry; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_cluster_boundaries_geometry ON zigo.cluster_boundaries USING gist (boundary_geometry);


--
-- Name: idx_cluster_category_settings_cluster; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_cluster_category_settings_cluster ON zigo.cluster_category_settings USING btree (cluster_id, is_deleted, is_active);


--
-- Name: idx_cluster_service_settings_cluster; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_cluster_service_settings_cluster ON zigo.cluster_service_settings USING btree (cluster_id, is_deleted, is_active);


--
-- Name: idx_customer_addresses_customer_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_addresses_customer_active ON zigo.customer_addresses USING btree (customer_id, deleted_at, is_default);


--
-- Name: idx_customer_addresses_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_addresses_location ON zigo.customer_addresses USING gist (location);


--
-- Name: idx_customer_cart_user; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_cart_user ON zigo.customer_cart USING btree (user_id, updated_at DESC);


--
-- Name: idx_customer_disputes_booking; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_disputes_booking ON zigo.customer_disputes USING btree (service_request_id, created_at DESC);


--
-- Name: idx_customer_disputes_customer; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_disputes_customer ON zigo.customer_disputes USING btree (customer_user_id, created_at DESC);


--
-- Name: idx_customer_disputes_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_disputes_status ON zigo.customer_disputes USING btree (status_code, created_at DESC);


--
-- Name: idx_customer_support_messages_ticket; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_support_messages_ticket ON zigo.customer_support_messages USING btree (ticket_id, created_at);


--
-- Name: idx_customer_support_tickets_customer; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_support_tickets_customer ON zigo.customer_support_tickets USING btree (customer_id, last_message_at DESC);


--
-- Name: idx_customer_support_tickets_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_support_tickets_status ON zigo.customer_support_tickets USING btree (status_code, priority_code, last_message_at DESC);


--
-- Name: idx_customer_unserviceable_locations_area; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_unserviceable_locations_area ON zigo.customer_unserviceable_locations USING btree (state_name, city_name, postal_code);


--
-- Name: idx_customer_unserviceable_locations_coords; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_unserviceable_locations_coords ON zigo.customer_unserviceable_locations USING btree (customer_id, latitude, longitude);


--
-- Name: idx_customer_unserviceable_locations_customer; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_unserviceable_locations_customer ON zigo.customer_unserviceable_locations USING btree (customer_id, last_seen_at DESC);


--
-- Name: idx_customer_unserviceable_locations_seen; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_customer_unserviceable_locations_seen ON zigo.customer_unserviceable_locations USING btree (last_seen_at DESC);


--
-- Name: idx_event_log_name_time; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_event_log_name_time ON zigo.event_log USING btree (event_name, occurred_at DESC);


--
-- Name: idx_event_log_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_event_log_request ON zigo.event_log USING btree (request_id, occurred_at DESC);


--
-- Name: idx_file_links_entity; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_file_links_entity ON zigo.file_links USING btree (entity_type, entity_id);


--
-- Name: idx_location_pings_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_location_pings_request ON zigo.assistant_location_pings USING btree (service_request_id, created_at DESC);


--
-- Name: idx_modules_code_active_unique; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX idx_modules_code_active_unique ON zigo.modules USING btree (lower(code)) WHERE (is_deleted = false);


--
-- Name: idx_outbox_events_available; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_outbox_events_available ON zigo.outbox_events USING btree (status_id, available_at, created_at);


--
-- Name: idx_payment_mode_masters_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_payment_mode_masters_active ON zigo.payment_mode_masters USING btree (is_deleted, is_active, is_enabled, scope_type, sort_order);


--
-- Name: idx_payment_transactions_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_payment_transactions_request ON zigo.payment_transactions USING btree (service_request_id, created_at DESC);


--
-- Name: idx_permissions_code_active_unique; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX idx_permissions_code_active_unique ON zigo.permissions USING btree (lower(code)) WHERE (is_deleted = false);


--
-- Name: idx_places_cluster_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_places_cluster_status ON zigo.places USING btree (cluster_id, status_id);


--
-- Name: idx_places_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_places_location ON zigo.places USING gist (location);


--
-- Name: idx_portal_favorites_user; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_portal_favorites_user ON zigo.portal_favorites USING btree (user_id, actor_type, favorite_type);


--
-- Name: idx_price_master_rules_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_price_master_rules_active ON zigo.price_master_rules USING btree (is_deleted, is_active, price_type);


--
-- Name: idx_price_master_rules_location_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_price_master_rules_location_scope ON zigo.price_master_rules USING btree (scope_type, state_id, city_id, zone_id, cluster_id);


--
-- Name: idx_price_master_rules_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_price_master_rules_scope ON zigo.price_master_rules USING btree (service_id, category_id, store_id);


--
-- Name: idx_razorpay_payments_booking; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_razorpay_payments_booking ON zigo.razorpay_payments USING btree (service_request_id, created_at DESC);


--
-- Name: idx_razorpay_payments_payment; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_razorpay_payments_payment ON zigo.razorpay_payments USING btree (provider_payment_id);


--
-- Name: idx_razorpay_payments_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_razorpay_payments_status ON zigo.razorpay_payments USING btree (status_code, updated_at DESC);


--
-- Name: idx_razorpay_webhook_order; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_razorpay_webhook_order ON zigo.razorpay_webhook_events USING btree (provider_order_id, received_at DESC);


--
-- Name: idx_request_locations_cluster; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_request_locations_cluster ON zigo.request_locations USING btree (cluster_id);


--
-- Name: idx_request_stops_cluster; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_request_stops_cluster ON zigo.request_stops USING btree (cluster_id);


--
-- Name: idx_request_stops_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_request_stops_location ON zigo.request_stops USING gist (location);


--
-- Name: idx_roles_code_active_unique; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX idx_roles_code_active_unique ON zigo.roles USING btree (lower(code)) WHERE (is_deleted = false);


--
-- Name: idx_service_requests_cluster_state; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_service_requests_cluster_state ON zigo.service_requests USING btree (cluster_id, current_state_id, created_at DESC);


--
-- Name: idx_service_requests_customer; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_service_requests_customer ON zigo.service_requests USING btree (customer_id, created_at DESC);


--
-- Name: idx_service_requests_live; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_service_requests_live ON zigo.service_requests USING btree (cluster_id, status_code, created_at DESC);


--
-- Name: idx_services_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_services_active ON zigo.services USING btree (is_deleted, is_active, sort_order, name);


--
-- Name: idx_settlements_request_unique; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX idx_settlements_request_unique ON zigo.settlements USING btree (service_request_id);


--
-- Name: idx_states_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_states_active ON zigo.states USING btree (is_deleted, is_active, name);


--
-- Name: idx_store_categories_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_store_categories_active ON zigo.store_categories USING btree (is_deleted, is_active, priority, name);


--
-- Name: idx_store_categories_parent_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_store_categories_parent_active ON zigo.store_categories USING btree (service_id, service_category_id, is_deleted, is_active);


--
-- Name: idx_store_images_store; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_store_images_store ON zigo.store_images USING btree (store_id, is_deleted, is_primary, priority);


--
-- Name: idx_store_keyword_map_store; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_store_keyword_map_store ON zigo.store_keyword_map USING btree (store_id, is_deleted, is_active);


--
-- Name: idx_store_keywords_parent_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_store_keywords_parent_active ON zigo.store_keywords USING btree (service_id, service_category_id, is_deleted, is_active, priority, name);


--
-- Name: idx_stores_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_stores_active ON zigo.stores USING btree (is_deleted, is_active, name);


--
-- Name: idx_surge_rules_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_surge_rules_active ON zigo.surge_rules USING btree (is_deleted, is_active, priority);


--
-- Name: idx_task_assignments_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_task_assignments_active ON zigo.task_assignments USING btree (request_id, assistant_id) WHERE (released_at IS NULL);


--
-- Name: idx_task_assignments_assistant_live; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_task_assignments_assistant_live ON zigo.task_assignments USING btree (assistant_id, status_code, offered_at DESC);


--
-- Name: idx_task_events_request; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_task_events_request ON zigo.task_events USING btree (service_request_id, created_at DESC);


--
-- Name: idx_task_offers_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_task_offers_assistant ON zigo.assistant_task_offers USING btree (assistant_id, offer_status_id, offered_at DESC);


--
-- Name: idx_task_proofs_gps_location; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_task_proofs_gps_location ON zigo.task_proofs USING gist (gps_location);


--
-- Name: idx_tax_master_rules_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_tax_master_rules_active ON zigo.tax_master_rules USING btree (is_deleted, is_active, created_at DESC);


--
-- Name: idx_time_slot_masters_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_time_slot_masters_active ON zigo.time_slot_masters USING btree (is_deleted, is_active);


--
-- Name: idx_user_roles_role_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_user_roles_role_active ON zigo.user_roles USING btree (role_id, is_deleted, is_active);


--
-- Name: idx_user_roles_user_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_user_roles_user_active ON zigo.user_roles USING btree (user_id, is_deleted, is_active);


--
-- Name: idx_users_account_status; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_users_account_status ON zigo.users USING btree (((metadata ->> 'accountStatus'::text)));


--
-- Name: idx_users_created_at; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_users_created_at ON zigo.users USING btree (created_at DESC);


--
-- Name: idx_users_email_lookup; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_users_email_lookup ON zigo.users USING btree (lower((email)::text)) WHERE ((deleted_at IS NULL) AND (email IS NOT NULL));


--
-- Name: idx_users_phone_lookup; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_users_phone_lookup ON zigo.users USING btree (phone) WHERE ((deleted_at IS NULL) AND (phone IS NOT NULL));


--
-- Name: idx_vehicle_master_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_vehicle_master_active ON zigo.vehicle_master USING btree (is_deleted, is_active, created_at DESC);


--
-- Name: idx_vehicle_master_cluster_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_vehicle_master_cluster_active ON zigo.vehicle_master USING btree (cluster_id, is_deleted, is_active);


--
-- Name: idx_zones_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE INDEX idx_zones_active ON zigo.zones USING btree (is_deleted, is_active, name);


--
-- Name: uq_app_config_values_scope; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_app_config_values_scope ON zigo.app_config_values USING btree (config_key, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: uq_assistant_availability_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_assistant_availability_assistant ON zigo.assistant_availability USING btree (assistant_id);


--
-- Name: uq_assistant_vehicle_assignment_active_assistant; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_assistant_vehicle_assignment_active_assistant ON zigo.assistant_vehicle_assignments USING btree (assistant_id) WHERE (is_active = true);


--
-- Name: uq_assistant_vehicle_assignment_active_vehicle; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_assistant_vehicle_assignment_active_vehicle ON zigo.assistant_vehicle_assignments USING btree (vehicle_master_id) WHERE (is_active = true);


--
-- Name: uq_user_roles_scoped; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_user_roles_scoped ON zigo.user_roles USING btree (user_id, role_id, COALESCE(scope_type, ''::text), COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: uq_vehicle_master_number_active; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX uq_vehicle_master_number_active ON zigo.vehicle_master USING btree (lower(vehicle_number)) WHERE ((vehicle_number IS NOT NULL) AND (is_deleted = false));


--
-- Name: ux_payment_mode_masters_scope_code; Type: INDEX; Schema: zigo; Owner: -
--

CREATE UNIQUE INDEX ux_payment_mode_masters_scope_code ON zigo.payment_mode_masters USING btree (lower(code), scope_type, COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(zone_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (COALESCE(is_deleted, false) = false);


--
-- Name: admin_actions admin_actions_action_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.admin_actions
    ADD CONSTRAINT admin_actions_action_type_id_fkey FOREIGN KEY (action_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: admin_actions admin_actions_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.admin_actions
    ADD CONSTRAINT admin_actions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: admin_actions admin_actions_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.admin_actions
    ADD CONSTRAINT admin_actions_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: api_clients api_clients_organization_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.api_clients
    ADD CONSTRAINT api_clients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES zigo.organizations(id);


--
-- Name: api_clients api_clients_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.api_clients
    ADD CONSTRAINT api_clients_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: app_settings app_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_settings
    ADD CONSTRAINT app_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: app_settings app_settings_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_settings
    ADD CONSTRAINT app_settings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.app_settings
    ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: approval_requests approval_requests_approval_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_approval_type_id_fkey FOREIGN KEY (approval_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: approval_requests approval_requests_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_requested_by_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_requested_by_assistant_id_fkey FOREIGN KEY (requested_by_assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: approval_requests approval_requests_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: approval_requests approval_requests_task_update_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_requests
    ADD CONSTRAINT approval_requests_task_update_id_fkey FOREIGN KEY (task_update_id) REFERENCES zigo.task_updates(id) ON DELETE SET NULL;


--
-- Name: approval_responses approval_responses_approval_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_responses
    ADD CONSTRAINT approval_responses_approval_request_id_fkey FOREIGN KEY (approval_request_id) REFERENCES zigo.approval_requests(id) ON DELETE CASCADE;


--
-- Name: approval_responses approval_responses_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_responses
    ADD CONSTRAINT approval_responses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: approval_responses approval_responses_response_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.approval_responses
    ADD CONSTRAINT approval_responses_response_type_id_fkey FOREIGN KEY (response_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assignment_policies assignment_policies_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policies
    ADD CONSTRAINT assignment_policies_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: assignment_policies assignment_policies_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policies
    ADD CONSTRAINT assignment_policies_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: assignment_policy_rules assignment_policy_rules_assignment_policy_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policy_rules
    ADD CONSTRAINT assignment_policy_rules_assignment_policy_id_fkey FOREIGN KEY (assignment_policy_id) REFERENCES zigo.assignment_policies(id) ON DELETE CASCADE;


--
-- Name: assignment_policy_rules assignment_policy_rules_rule_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_policy_rules
    ADD CONSTRAINT assignment_policy_rules_rule_type_id_fkey FOREIGN KEY (rule_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assignment_runs assignment_runs_assignment_policy_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_runs
    ADD CONSTRAINT assignment_runs_assignment_policy_id_fkey FOREIGN KEY (assignment_policy_id) REFERENCES zigo.assignment_policies(id);


--
-- Name: assignment_runs assignment_runs_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_runs
    ADD CONSTRAINT assignment_runs_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: assignment_runs assignment_runs_run_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_runs
    ADD CONSTRAINT assignment_runs_run_type_id_fkey FOREIGN KEY (run_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assignment_runs assignment_runs_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assignment_runs
    ADD CONSTRAINT assignment_runs_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_availability assistant_availability_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_availability
    ADD CONSTRAINT assistant_availability_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_availability assistant_availability_availability_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_availability
    ADD CONSTRAINT assistant_availability_availability_status_id_fkey FOREIGN KEY (availability_status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_availability assistant_availability_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_availability
    ADD CONSTRAINT assistant_availability_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: assistant_availability assistant_availability_next_available_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_availability
    ADD CONSTRAINT assistant_availability_next_available_cluster_id_fkey FOREIGN KEY (next_available_cluster_id) REFERENCES zigo.clusters(id) ON DELETE SET NULL;


--
-- Name: assistant_calendar_blocks assistant_calendar_blocks_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_calendar_blocks
    ADD CONSTRAINT assistant_calendar_blocks_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_calendar_blocks assistant_calendar_blocks_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_calendar_blocks
    ADD CONSTRAINT assistant_calendar_blocks_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE SET NULL;


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES zigo.task_assignments(id) ON DELETE SET NULL;


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE SET NULL;


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: assistant_capacity_reservations assistant_capacity_reservations_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_capacity_reservations
    ADD CONSTRAINT assistant_capacity_reservations_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: assistant_cluster_map assistant_cluster_map_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_cluster_map
    ADD CONSTRAINT assistant_cluster_map_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_cluster_map assistant_cluster_map_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_cluster_map
    ADD CONSTRAINT assistant_cluster_map_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: assistant_delay_credits assistant_delay_credits_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_delay_credits assistant_delay_credits_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: assistant_delay_credits assistant_delay_credits_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: assistant_delay_credits assistant_delay_credits_task_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_delay_credits
    ADD CONSTRAINT assistant_delay_credits_task_assignment_id_fkey FOREIGN KEY (task_assignment_id) REFERENCES zigo.task_assignments(id) ON DELETE CASCADE;


--
-- Name: assistant_document_verification_events assistant_document_verification_even_assistant_document_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_document_verification_events
    ADD CONSTRAINT assistant_document_verification_even_assistant_document_id_fkey FOREIGN KEY (assistant_document_id) REFERENCES zigo.assistant_documents(id) ON DELETE CASCADE;


--
-- Name: assistant_document_verification_events assistant_document_verification_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_document_verification_events
    ADD CONSTRAINT assistant_document_verification_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: assistant_document_verification_events assistant_document_verification_events_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_document_verification_events
    ADD CONSTRAINT assistant_document_verification_events_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_document_verification_events assistant_document_verification_events_document_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_document_verification_events
    ADD CONSTRAINT assistant_document_verification_events_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES zigo.document_types(id);


--
-- Name: assistant_documents assistant_documents_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_documents assistant_documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES zigo.document_types(id);


--
-- Name: assistant_documents assistant_documents_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: assistant_documents assistant_documents_verification_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_verification_status_id_fkey FOREIGN KEY (verification_status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_documents assistant_documents_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_documents
    ADD CONSTRAINT assistant_documents_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES zigo.users(id);


--
-- Name: assistant_earnings assistant_earnings_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_earnings
    ADD CONSTRAINT assistant_earnings_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: assistant_earnings assistant_earnings_earning_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_earnings
    ADD CONSTRAINT assistant_earnings_earning_type_id_fkey FOREIGN KEY (earning_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_earnings assistant_earnings_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_earnings
    ADD CONSTRAINT assistant_earnings_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: assistant_earnings assistant_earnings_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_earnings
    ADD CONSTRAINT assistant_earnings_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_location_pings assistant_location_pings_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_location_pings
    ADD CONSTRAINT assistant_location_pings_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_master_logs assistant_master_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_master_logs
    ADD CONSTRAINT assistant_master_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: assistant_master_logs assistant_master_logs_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_master_logs
    ADD CONSTRAINT assistant_master_logs_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_shift_plans assistant_shift_plans_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_shift_plans
    ADD CONSTRAINT assistant_shift_plans_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_shift_plans assistant_shift_plans_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_shift_plans
    ADD CONSTRAINT assistant_shift_plans_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: assistant_shift_plans assistant_shift_plans_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_shift_plans
    ADD CONSTRAINT assistant_shift_plans_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_skill_map assistant_skill_map_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_skill_map
    ADD CONSTRAINT assistant_skill_map_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_skill_map assistant_skill_map_skill_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_skill_map
    ADD CONSTRAINT assistant_skill_map_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES zigo.assistant_skills(id) ON DELETE CASCADE;


--
-- Name: assistant_task_offers assistant_task_offers_assignment_run_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_assignment_run_id_fkey FOREIGN KEY (assignment_run_id) REFERENCES zigo.assignment_runs(id) ON DELETE CASCADE;


--
-- Name: assistant_task_offers assistant_task_offers_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: assistant_task_offers assistant_task_offers_offer_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_offer_status_id_fkey FOREIGN KEY (offer_status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_task_offers assistant_task_offers_rejection_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_rejection_reason_id_fkey FOREIGN KEY (rejection_reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: assistant_task_offers assistant_task_offers_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_task_offers
    ADD CONSTRAINT assistant_task_offers_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: assistant_training_records assistant_training_records_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_training_records
    ADD CONSTRAINT assistant_training_records_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_training_records assistant_training_records_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_training_records
    ADD CONSTRAINT assistant_training_records_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_training_records assistant_training_records_training_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_training_records
    ADD CONSTRAINT assistant_training_records_training_type_id_fkey FOREIGN KEY (training_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistant_vehicle_assignments assistant_vehicle_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_assignments
    ADD CONSTRAINT assistant_vehicle_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES zigo.users(id);


--
-- Name: assistant_vehicle_assignments assistant_vehicle_assignments_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_assignments
    ADD CONSTRAINT assistant_vehicle_assignments_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_vehicle_assignments assistant_vehicle_assignments_removed_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_assignments
    ADD CONSTRAINT assistant_vehicle_assignments_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES zigo.users(id);


--
-- Name: assistant_vehicle_assignments assistant_vehicle_assignments_vehicle_master_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_assignments
    ADD CONSTRAINT assistant_vehicle_assignments_vehicle_master_id_fkey FOREIGN KEY (vehicle_master_id) REFERENCES zigo.vehicle_master(id);


--
-- Name: assistant_vehicle_damage_reports assistant_vehicle_damage_reports_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_damage_reports
    ADD CONSTRAINT assistant_vehicle_damage_reports_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_vehicle_damage_reports assistant_vehicle_damage_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_damage_reports
    ADD CONSTRAINT assistant_vehicle_damage_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: assistant_vehicle_damage_reports assistant_vehicle_damage_reports_vehicle_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_damage_reports
    ADD CONSTRAINT assistant_vehicle_damage_reports_vehicle_assignment_id_fkey FOREIGN KEY (vehicle_assignment_id) REFERENCES zigo.assistant_vehicle_assignments(id);


--
-- Name: assistant_vehicle_damage_reports assistant_vehicle_damage_reports_vehicle_master_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_damage_reports
    ADD CONSTRAINT assistant_vehicle_damage_reports_vehicle_master_id_fkey FOREIGN KEY (vehicle_master_id) REFERENCES zigo.vehicle_master(id);


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES zigo.document_types(id);


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES zigo.assistant_vehicles(id) ON DELETE CASCADE;


--
-- Name: assistant_vehicle_documents assistant_vehicle_documents_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicle_documents
    ADD CONSTRAINT assistant_vehicle_documents_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES zigo.users(id);


--
-- Name: assistant_vehicles assistant_vehicles_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicles
    ADD CONSTRAINT assistant_vehicles_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: assistant_vehicles assistant_vehicles_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_vehicles
    ADD CONSTRAINT assistant_vehicles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: assistants assistants_current_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_current_cluster_id_fkey FOREIGN KEY (current_cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: assistants assistants_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: assistants assistants_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: assistants assistants_verification_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistants
    ADD CONSTRAINT assistants_verification_status_id_fkey FOREIGN KEY (verification_status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: booking_billing_snapshots booking_billing_snapshots_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_billing_snapshots
    ADD CONSTRAINT booking_billing_snapshots_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_quick_replies booking_engine_quick_replies_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_quick_replies
    ADD CONSTRAINT booking_engine_quick_replies_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: booking_engine_rules booking_engine_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: booking_engine_rules booking_engine_rules_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: booking_engine_rules booking_engine_rules_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: booking_engine_rules booking_engine_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_rules booking_engine_rules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_rules booking_engine_rules_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: booking_engine_rules booking_engine_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: booking_engine_rules booking_engine_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_engine_rules
    ADD CONSTRAINT booking_engine_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: booking_invoice_email_jobs booking_invoice_email_jobs_booking_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_invoice_email_jobs
    ADD CONSTRAINT booking_invoice_email_jobs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_invoice_email_jobs booking_invoice_email_jobs_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_invoice_email_jobs
    ADD CONSTRAINT booking_invoice_email_jobs_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: booking_orchestration_state booking_orchestration_state_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_orchestration_state
    ADD CONSTRAINT booking_orchestration_state_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE SET NULL;


--
-- Name: booking_orchestration_state booking_orchestration_state_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_orchestration_state
    ADD CONSTRAINT booking_orchestration_state_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: booking_orchestration_state booking_orchestration_state_reservation_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_orchestration_state
    ADD CONSTRAINT booking_orchestration_state_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES zigo.assistant_capacity_reservations(id) ON DELETE SET NULL;


--
-- Name: booking_orchestration_state booking_orchestration_state_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_orchestration_state
    ADD CONSTRAINT booking_orchestration_state_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_reviews booking_reviews_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_reviews
    ADD CONSTRAINT booking_reviews_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE SET NULL;


--
-- Name: booking_reviews booking_reviews_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_reviews
    ADD CONSTRAINT booking_reviews_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: booking_reviews booking_reviews_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_reviews
    ADD CONSTRAINT booking_reviews_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_route_sessions booking_route_sessions_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id) ON DELETE CASCADE;


--
-- Name: booking_route_sessions booking_route_sessions_last_ping_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_last_ping_id_fkey FOREIGN KEY (last_ping_id) REFERENCES zigo.assistant_location_pings(id) ON DELETE SET NULL;


--
-- Name: booking_route_sessions booking_route_sessions_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_route_sessions booking_route_sessions_task_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_route_sessions
    ADD CONSTRAINT booking_route_sessions_task_assignment_id_fkey FOREIGN KEY (task_assignment_id) REFERENCES zigo.task_assignments(id) ON DELETE SET NULL;


--
-- Name: booking_task_update_reads booking_task_update_reads_update_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_update_reads
    ADD CONSTRAINT booking_task_update_reads_update_id_fkey FOREIGN KEY (update_id) REFERENCES zigo.booking_task_updates(id) ON DELETE CASCADE;


--
-- Name: booking_task_update_reads booking_task_update_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_update_reads
    ADD CONSTRAINT booking_task_update_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: booking_task_updates booking_task_updates_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_updates
    ADD CONSTRAINT booking_task_updates_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: booking_task_updates booking_task_updates_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_updates
    ADD CONSTRAINT booking_task_updates_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: booking_task_updates booking_task_updates_task_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_task_updates
    ADD CONSTRAINT booking_task_updates_task_assignment_id_fkey FOREIGN KEY (task_assignment_id) REFERENCES zigo.task_assignments(id) ON DELETE SET NULL;


--
-- Name: booking_type_masters booking_type_masters_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_type_masters
    ADD CONSTRAINT booking_type_masters_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: booking_type_masters booking_type_masters_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_type_masters
    ADD CONSTRAINT booking_type_masters_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: booking_type_masters booking_type_masters_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.booking_type_masters
    ADD CONSTRAINT booking_type_masters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: categories categories_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: categories categories_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: categories categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES zigo.categories(id);


--
-- Name: categories categories_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: categories categories_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: categories categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.categories
    ADD CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: category_price_rules category_price_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: category_price_rules category_price_rules_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: category_price_rules category_price_rules_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: category_price_rules category_price_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: category_price_rules category_price_rules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: category_price_rules category_price_rules_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: category_price_rules category_price_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: category_price_rules category_price_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_price_rules
    ADD CONSTRAINT category_price_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: category_service_masters category_service_masters_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_service_masters
    ADD CONSTRAINT category_service_masters_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: category_service_masters category_service_masters_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_service_masters
    ADD CONSTRAINT category_service_masters_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: category_service_masters category_service_masters_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_service_masters
    ADD CONSTRAINT category_service_masters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: category_store_map category_store_map_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id) ON DELETE CASCADE;


--
-- Name: category_store_map category_store_map_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: category_store_map category_store_map_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: category_store_map category_store_map_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.category_store_map
    ADD CONSTRAINT category_store_map_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_message_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_messages
    ADD CONSTRAINT chat_messages_message_type_id_fkey FOREIGN KEY (message_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: chat_messages chat_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_messages
    ADD CONSTRAINT chat_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES zigo.users(id);


--
-- Name: chat_messages chat_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_messages
    ADD CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES zigo.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_threads
    ADD CONSTRAINT chat_threads_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_threads
    ADD CONSTRAINT chat_threads_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: chat_threads chat_threads_thread_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.chat_threads
    ADD CONSTRAINT chat_threads_thread_type_id_fkey FOREIGN KEY (thread_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: cities cities_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: cities cities_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: cities cities_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: cities cities_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cities
    ADD CONSTRAINT cities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: cluster_access_rules cluster_access_rules_allowed_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_access_rules
    ADD CONSTRAINT cluster_access_rules_allowed_cluster_id_fkey FOREIGN KEY (allowed_cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_access_rules cluster_access_rules_rule_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_access_rules
    ADD CONSTRAINT cluster_access_rules_rule_type_id_fkey FOREIGN KEY (rule_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: cluster_access_rules cluster_access_rules_source_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_access_rules
    ADD CONSTRAINT cluster_access_rules_source_cluster_id_fkey FOREIGN KEY (source_cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_boundaries cluster_boundaries_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_boundaries
    ADD CONSTRAINT cluster_boundaries_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_boundaries cluster_boundaries_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_boundaries
    ADD CONSTRAINT cluster_boundaries_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id);


--
-- Name: cluster_category_settings cluster_category_settings_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id) ON DELETE CASCADE;


--
-- Name: cluster_category_settings cluster_category_settings_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_category_settings cluster_category_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: cluster_category_settings cluster_category_settings_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: cluster_category_settings cluster_category_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_category_settings
    ADD CONSTRAINT cluster_category_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: cluster_launch_configs cluster_launch_configs_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_launch_configs
    ADD CONSTRAINT cluster_launch_configs_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_launch_configs cluster_launch_configs_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_launch_configs
    ADD CONSTRAINT cluster_launch_configs_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id);


--
-- Name: cluster_service_settings cluster_service_settings_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_service_settings cluster_service_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: cluster_service_settings cluster_service_settings_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: cluster_service_settings cluster_service_settings_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id) ON DELETE CASCADE;


--
-- Name: cluster_service_settings cluster_service_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_settings
    ADD CONSTRAINT cluster_service_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: cluster_service_visibility cluster_service_visibility_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_visibility
    ADD CONSTRAINT cluster_service_visibility_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id) ON DELETE CASCADE;


--
-- Name: cluster_service_visibility cluster_service_visibility_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_visibility
    ADD CONSTRAINT cluster_service_visibility_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_service_visibility cluster_service_visibility_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_service_visibility
    ADD CONSTRAINT cluster_service_visibility_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id) ON DELETE CASCADE;


--
-- Name: cluster_store_map cluster_store_map_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_store_map cluster_store_map_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: cluster_store_map cluster_store_map_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: cluster_store_map cluster_store_map_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.cluster_store_map
    ADD CONSTRAINT cluster_store_map_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: clusters clusters_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: clusters clusters_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: clusters clusters_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: clusters clusters_launch_stage_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_launch_stage_id_fkey FOREIGN KEY (launch_stage_id) REFERENCES zigo.lookup_values(id);


--
-- Name: clusters clusters_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: clusters clusters_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: clusters clusters_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.clusters
    ADD CONSTRAINT clusters_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: customer_addresses customer_addresses_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT customer_addresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT customer_addresses_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: customer_addresses customer_addresses_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT customer_addresses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: customer_approvals customer_approvals_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_approvals
    ADD CONSTRAINT customer_approvals_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: customer_approvals customer_approvals_task_update_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_approvals
    ADD CONSTRAINT customer_approvals_task_update_id_fkey FOREIGN KEY (task_update_id) REFERENCES zigo.task_updates(id) ON DELETE SET NULL;


--
-- Name: customer_auth_sessions customer_auth_sessions_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_auth_sessions
    ADD CONSTRAINT customer_auth_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_auth_sessions customer_auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_auth_sessions
    ADD CONSTRAINT customer_auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: customer_cart customer_cart_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_cart
    ADD CONSTRAINT customer_cart_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_cart customer_cart_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_cart
    ADD CONSTRAINT customer_cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: customer_disputes customer_disputes_assigned_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_disputes
    ADD CONSTRAINT customer_disputes_assigned_admin_user_id_fkey FOREIGN KEY (assigned_admin_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: customer_disputes customer_disputes_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_disputes
    ADD CONSTRAINT customer_disputes_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: customer_disputes customer_disputes_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_disputes
    ADD CONSTRAINT customer_disputes_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: customer_disputes customer_disputes_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_disputes
    ADD CONSTRAINT customer_disputes_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_places customer_favorite_places_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_favorite_places
    ADD CONSTRAINT customer_favorite_places_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_places customer_favorite_places_place_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_favorite_places
    ADD CONSTRAINT customer_favorite_places_place_id_fkey FOREIGN KEY (place_id) REFERENCES zigo.places(id) ON DELETE CASCADE;


--
-- Name: customer_memberships customer_memberships_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_memberships
    ADD CONSTRAINT customer_memberships_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_memberships customer_memberships_membership_plan_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_memberships
    ADD CONSTRAINT customer_memberships_membership_plan_id_fkey FOREIGN KEY (membership_plan_id) REFERENCES zigo.membership_plans(id);


--
-- Name: customer_memberships customer_memberships_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_memberships
    ADD CONSTRAINT customer_memberships_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: customer_notes customer_notes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_notes
    ADD CONSTRAINT customer_notes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id);


--
-- Name: customer_notes customer_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_notes
    ADD CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE CASCADE;


--
-- Name: customer_notes customer_notes_note_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_notes
    ADD CONSTRAINT customer_notes_note_type_id_fkey FOREIGN KEY (note_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: customer_support_messages customer_support_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_messages
    ADD CONSTRAINT customer_support_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES zigo.users(id);


--
-- Name: customer_support_messages customer_support_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_messages
    ADD CONSTRAINT customer_support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES zigo.customer_support_tickets(id) ON DELETE CASCADE;


--
-- Name: customer_support_tickets customer_support_tickets_assigned_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_tickets
    ADD CONSTRAINT customer_support_tickets_assigned_admin_user_id_fkey FOREIGN KEY (assigned_admin_user_id) REFERENCES zigo.users(id);


--
-- Name: customer_support_tickets customer_support_tickets_booking_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_tickets
    ADD CONSTRAINT customer_support_tickets_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES zigo.service_requests(id);


--
-- Name: customer_support_tickets customer_support_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_support_tickets
    ADD CONSTRAINT customer_support_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: customer_unserviceable_locations customer_unserviceable_locations_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_unserviceable_locations
    ADD CONSTRAINT customer_unserviceable_locations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id) ON DELETE SET NULL;


--
-- Name: customer_unserviceable_locations customer_unserviceable_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_unserviceable_locations
    ADD CONSTRAINT customer_unserviceable_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: customers customers_default_membership_plan_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_default_membership_plan_id_fkey FOREIGN KEY (default_membership_plan_id) REFERENCES zigo.membership_plans(id);


--
-- Name: customers customers_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: daily_assistant_metrics daily_assistant_metrics_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.daily_assistant_metrics
    ADD CONSTRAINT daily_assistant_metrics_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: daily_cluster_metrics daily_cluster_metrics_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.daily_cluster_metrics
    ADD CONSTRAINT daily_cluster_metrics_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: devices devices_app_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.devices
    ADD CONSTRAINT devices_app_type_id_fkey FOREIGN KEY (app_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: devices devices_platform_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.devices
    ADD CONSTRAINT devices_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES zigo.lookup_values(id);


--
-- Name: devices devices_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.devices
    ADD CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: event_log event_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.event_log
    ADD CONSTRAINT event_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: event_log event_log_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.event_log
    ADD CONSTRAINT event_log_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: event_log event_log_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.event_log
    ADD CONSTRAINT event_log_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: exception_events exception_events_detected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_detected_by_user_id_fkey FOREIGN KEY (detected_by_user_id) REFERENCES zigo.users(id);


--
-- Name: exception_events exception_events_exception_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_exception_type_id_fkey FOREIGN KEY (exception_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: exception_events exception_events_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: exception_events exception_events_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: exception_events exception_events_severity_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_severity_id_fkey FOREIGN KEY (severity_id) REFERENCES zigo.lookup_values(id);


--
-- Name: exception_events exception_events_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.exception_events
    ADD CONSTRAINT exception_events_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: file_links file_links_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.file_links
    ADD CONSTRAINT file_links_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: assistant_location_pings fk_assistant_location_request; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.assistant_location_pings
    ADD CONSTRAINT fk_assistant_location_request FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE SET NULL;


--
-- Name: customer_addresses fk_customer_addresses_cluster; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.customer_addresses
    ADD CONSTRAINT fk_customer_addresses_cluster FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: idempotency_keys fk_idempotency_actor_user; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.idempotency_keys
    ADD CONSTRAINT fk_idempotency_actor_user FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: membership_plans fk_membership_cancellation_policy; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.membership_plans
    ADD CONSTRAINT fk_membership_cancellation_policy FOREIGN KEY (cancellation_policy_id) REFERENCES zigo.policy_configs(id);


--
-- Name: membership_plans fk_membership_pricing_policy; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.membership_plans
    ADD CONSTRAINT fk_membership_pricing_policy FOREIGN KEY (pricing_policy_id) REFERENCES zigo.pricing_policies(id);


--
-- Name: service_task_rules fk_service_task_proof_policy; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_task_rules
    ADD CONSTRAINT fk_service_task_proof_policy FOREIGN KEY (proof_policy_id) REFERENCES zigo.policy_configs(id);


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES zigo.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_line_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoice_lines
    ADD CONSTRAINT invoice_lines_line_type_id_fkey FOREIGN KEY (line_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: invoices invoices_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoices
    ADD CONSTRAINT invoices_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.invoices
    ADD CONSTRAINT invoices_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: lookup_values lookup_values_group_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.lookup_values
    ADD CONSTRAINT lookup_values_group_id_fkey FOREIGN KEY (group_id) REFERENCES zigo.lookup_groups(id);


--
-- Name: module_permissions module_permissions_module_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.module_permissions
    ADD CONSTRAINT module_permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES zigo.modules(id) ON DELETE CASCADE;


--
-- Name: module_permissions module_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.module_permissions
    ADD CONSTRAINT module_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES zigo.permissions(id) ON DELETE CASCADE;


--
-- Name: modules modules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.modules
    ADD CONSTRAINT modules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: modules modules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.modules
    ADD CONSTRAINT modules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: modules modules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.modules
    ADD CONSTRAINT modules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: notification_deliveries notification_deliveries_channel_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES zigo.lookup_values(id);


--
-- Name: notification_deliveries notification_deliveries_notification_event_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_notification_event_id_fkey FOREIGN KEY (notification_event_id) REFERENCES zigo.notification_events(id) ON DELETE CASCADE;


--
-- Name: notification_deliveries notification_deliveries_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: notification_deliveries notification_deliveries_template_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_template_id_fkey FOREIGN KEY (template_id) REFERENCES zigo.notification_templates(id);


--
-- Name: notification_deliveries notification_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_deliveries
    ADD CONSTRAINT notification_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id);


--
-- Name: notification_templates notification_templates_audience_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_templates
    ADD CONSTRAINT notification_templates_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES zigo.lookup_values(id);


--
-- Name: notification_templates notification_templates_channel_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.notification_templates
    ADD CONSTRAINT notification_templates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES zigo.lookup_values(id);


--
-- Name: organizations organizations_organization_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.organizations
    ADD CONSTRAINT organizations_organization_type_id_fkey FOREIGN KEY (organization_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: organizations organizations_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.organizations
    ADD CONSTRAINT organizations_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: outbox_events outbox_events_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.outbox_events
    ADD CONSTRAINT outbox_events_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: payment_intents payment_intents_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: payment_intents payment_intents_gateway_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES zigo.lookup_values(id);


--
-- Name: payment_intents payment_intents_intent_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_intent_type_id_fkey FOREIGN KEY (intent_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: payment_intents payment_intents_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE SET NULL;


--
-- Name: payment_intents payment_intents_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_intents
    ADD CONSTRAINT payment_intents_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: payment_mode_masters payment_mode_masters_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: payment_mode_masters payment_mode_masters_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: payment_mode_masters payment_mode_masters_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: payment_mode_masters payment_mode_masters_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: payment_mode_masters payment_mode_masters_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: payment_mode_masters payment_mode_masters_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: payment_mode_masters payment_mode_masters_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_mode_masters
    ADD CONSTRAINT payment_mode_masters_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: payment_transactions payment_transactions_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payment_transactions
    ADD CONSTRAINT payment_transactions_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: payments payments_gateway_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES zigo.lookup_values(id);


--
-- Name: payments payments_payment_intent_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_payment_intent_id_fkey FOREIGN KEY (payment_intent_id) REFERENCES zigo.payment_intents(id);


--
-- Name: payments payments_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE SET NULL;


--
-- Name: payments payments_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.payments
    ADD CONSTRAINT payments_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: permissions permissions_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.permissions
    ADD CONSTRAINT permissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: permissions permissions_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.permissions
    ADD CONSTRAINT permissions_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: permissions permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.permissions
    ADD CONSTRAINT permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: places places_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.places
    ADD CONSTRAINT places_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: places places_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.places
    ADD CONSTRAINT places_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: places places_place_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.places
    ADD CONSTRAINT places_place_type_id_fkey FOREIGN KEY (place_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: places places_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.places
    ADD CONSTRAINT places_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: policy_configs policy_configs_policy_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.policy_configs
    ADD CONSTRAINT policy_configs_policy_type_id_fkey FOREIGN KEY (policy_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: portal_favorites portal_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.portal_favorites
    ADD CONSTRAINT portal_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: price_master_rules price_master_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: price_master_rules price_master_rules_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id);


--
-- Name: price_master_rules price_master_rules_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: price_master_rules price_master_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: price_master_rules price_master_rules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: price_master_rules price_master_rules_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: price_master_rules price_master_rules_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.states(id);


--
-- Name: price_master_rules price_master_rules_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id);


--
-- Name: price_master_rules price_master_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: price_master_rules price_master_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.price_master_rules
    ADD CONSTRAINT price_master_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zigo.zones(id);


--
-- Name: pricing_rules pricing_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: pricing_rules pricing_rules_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: pricing_rules pricing_rules_membership_plan_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_membership_plan_id_fkey FOREIGN KEY (membership_plan_id) REFERENCES zigo.membership_plans(id);


--
-- Name: pricing_rules pricing_rules_pricing_policy_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_pricing_policy_id_fkey FOREIGN KEY (pricing_policy_id) REFERENCES zigo.pricing_policies(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_rule_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_rule_type_id_fkey FOREIGN KEY (rule_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: pricing_rules pricing_rules_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.pricing_rules
    ADD CONSTRAINT pricing_rules_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: ratings ratings_rated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.ratings
    ADD CONSTRAINT ratings_rated_by_user_id_fkey FOREIGN KEY (rated_by_user_id) REFERENCES zigo.users(id);


--
-- Name: ratings ratings_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.ratings
    ADD CONSTRAINT ratings_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: razorpay_payments razorpay_payments_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_payments
    ADD CONSTRAINT razorpay_payments_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES zigo.users(id) ON DELETE SET NULL;


--
-- Name: razorpay_payments razorpay_payments_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.razorpay_payments
    ADD CONSTRAINT razorpay_payments_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE SET NULL;


--
-- Name: reason_codes reason_codes_reason_group_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.reason_codes
    ADD CONSTRAINT reason_codes_reason_group_id_fkey FOREIGN KEY (reason_group_id) REFERENCES zigo.lookup_values(id);


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES zigo.payments(id);


--
-- Name: refunds refunds_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.refunds
    ADD CONSTRAINT refunds_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: refunds refunds_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.refunds
    ADD CONSTRAINT refunds_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: refunds refunds_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.refunds
    ADD CONSTRAINT refunds_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: request_attachments request_attachments_attachment_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_attachment_type_id_fkey FOREIGN KEY (attachment_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: request_attachments request_attachments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES zigo.users(id);


--
-- Name: request_attachments request_attachments_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_attachments request_attachments_stop_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_attachments
    ADD CONSTRAINT request_attachments_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES zigo.request_stops(id) ON DELETE CASCADE;


--
-- Name: request_items request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_items
    ADD CONSTRAINT request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_items request_items_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_items
    ADD CONSTRAINT request_items_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: request_items request_items_stop_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_items
    ADD CONSTRAINT request_items_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES zigo.request_stops(id) ON DELETE CASCADE;


--
-- Name: request_locations request_locations_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_locations
    ADD CONSTRAINT request_locations_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: request_locations request_locations_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_locations
    ADD CONSTRAINT request_locations_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_status_history request_status_history_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: request_status_history request_status_history_from_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_from_state_id_fkey FOREIGN KEY (from_state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: request_status_history request_status_history_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_status_history request_status_history_to_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_to_state_id_fkey FOREIGN KEY (to_state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: request_status_history request_status_history_transition_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_status_history
    ADD CONSTRAINT request_status_history_transition_id_fkey FOREIGN KEY (transition_id) REFERENCES zigo.workflow_transitions(id);


--
-- Name: request_stops request_stops_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: request_stops request_stops_place_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_place_id_fkey FOREIGN KEY (place_id) REFERENCES zigo.places(id);


--
-- Name: request_stops request_stops_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_stops request_stops_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_state_id_fkey FOREIGN KEY (state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: request_stops request_stops_stop_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_stops
    ADD CONSTRAINT request_stops_stop_type_id_fkey FOREIGN KEY (stop_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: request_timeline_events request_timeline_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_timeline_events
    ADD CONSTRAINT request_timeline_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES zigo.users(id);


--
-- Name: request_timeline_events request_timeline_events_event_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_timeline_events
    ADD CONSTRAINT request_timeline_events_event_type_id_fkey FOREIGN KEY (event_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: request_timeline_events request_timeline_events_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_timeline_events
    ADD CONSTRAINT request_timeline_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_timeline_events request_timeline_events_visibility_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.request_timeline_events
    ADD CONSTRAINT request_timeline_events_visibility_id_fkey FOREIGN KEY (visibility_id) REFERENCES zigo.lookup_values(id);


--
-- Name: role_modules role_modules_module_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_modules
    ADD CONSTRAINT role_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES zigo.modules(id) ON DELETE CASCADE;


--
-- Name: role_modules role_modules_role_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_modules
    ADD CONSTRAINT role_modules_role_id_fkey FOREIGN KEY (role_id) REFERENCES zigo.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES zigo.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES zigo.roles(id) ON DELETE CASCADE;


--
-- Name: role_verification_requirements role_verification_requirements_document_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_verification_requirements
    ADD CONSTRAINT role_verification_requirements_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES zigo.document_types(id) ON DELETE CASCADE;


--
-- Name: role_verification_requirements role_verification_requirements_role_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.role_verification_requirements
    ADD CONSTRAINT role_verification_requirements_role_id_fkey FOREIGN KEY (role_id) REFERENCES zigo.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.roles
    ADD CONSTRAINT roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: roles roles_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.roles
    ADD CONSTRAINT roles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: roles roles_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.roles
    ADD CONSTRAINT roles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: service_categories service_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_categories
    ADD CONSTRAINT service_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id) ON DELETE CASCADE;


--
-- Name: service_categories service_categories_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_categories
    ADD CONSTRAINT service_categories_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_booking_mode_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_booking_mode_id_fkey FOREIGN KEY (booking_mode_id) REFERENCES zigo.lookup_values(id);


--
-- Name: service_requests service_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: service_requests service_requests_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: service_requests service_requests_current_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_current_state_id_fkey FOREIGN KEY (current_state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: service_requests service_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: service_requests service_requests_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: service_requests service_requests_source_app_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_source_app_id_fkey FOREIGN KEY (source_app_id) REFERENCES zigo.lookup_values(id);


--
-- Name: service_requests service_requests_task_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_task_type_id_fkey FOREIGN KEY (task_type_id) REFERENCES zigo.task_types(id);


--
-- Name: service_requests service_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_requests
    ADD CONSTRAINT service_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES zigo.workflows(id);


--
-- Name: service_task_rules service_task_rules_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_task_rules
    ADD CONSTRAINT service_task_rules_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id) ON DELETE CASCADE;


--
-- Name: service_task_rules service_task_rules_task_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.service_task_rules
    ADD CONSTRAINT service_task_rules_task_type_id_fkey FOREIGN KEY (task_type_id) REFERENCES zigo.task_types(id) ON DELETE CASCADE;


--
-- Name: services services_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: services services_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: services services_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: services services_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.services
    ADD CONSTRAINT services_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: settlements settlements_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.settlements
    ADD CONSTRAINT settlements_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: settlements settlements_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.settlements
    ADD CONSTRAINT settlements_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: sla_breach_events sla_breach_events_breach_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.sla_breach_events
    ADD CONSTRAINT sla_breach_events_breach_type_id_fkey FOREIGN KEY (breach_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: sla_breach_events sla_breach_events_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.sla_breach_events
    ADD CONSTRAINT sla_breach_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: sla_breach_events sla_breach_events_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.sla_breach_events
    ADD CONSTRAINT sla_breach_events_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: states states_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.states
    ADD CONSTRAINT states_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: states states_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.states
    ADD CONSTRAINT states_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: states states_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.states
    ADD CONSTRAINT states_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: store_categories store_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: store_categories store_categories_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: store_categories store_categories_service_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES zigo.categories(id);


--
-- Name: store_categories store_categories_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: store_categories store_categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_categories
    ADD CONSTRAINT store_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: store_category_map store_category_map_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: store_category_map store_category_map_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: store_category_map store_category_map_store_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_store_category_id_fkey FOREIGN KEY (store_category_id) REFERENCES zigo.store_categories(id) ON DELETE CASCADE;


--
-- Name: store_category_map store_category_map_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_category_map
    ADD CONSTRAINT store_category_map_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: store_cluster_map store_cluster_map_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_cluster_map
    ADD CONSTRAINT store_cluster_map_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id) ON DELETE CASCADE;


--
-- Name: store_cluster_map store_cluster_map_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_cluster_map
    ADD CONSTRAINT store_cluster_map_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: store_images store_images_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: store_images store_images_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: store_images store_images_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: store_images store_images_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: store_images store_images_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_images
    ADD CONSTRAINT store_images_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: store_keyword_map store_keyword_map_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: store_keyword_map store_keyword_map_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: store_keyword_map store_keyword_map_store_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_store_id_fkey FOREIGN KEY (store_id) REFERENCES zigo.stores(id) ON DELETE CASCADE;


--
-- Name: store_keyword_map store_keyword_map_store_keyword_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keyword_map
    ADD CONSTRAINT store_keyword_map_store_keyword_id_fkey FOREIGN KEY (store_keyword_id) REFERENCES zigo.store_keywords(id) ON DELETE CASCADE;


--
-- Name: store_keywords store_keywords_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: store_keywords store_keywords_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: store_keywords store_keywords_service_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES zigo.categories(id);


--
-- Name: store_keywords store_keywords_service_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_service_id_fkey FOREIGN KEY (service_id) REFERENCES zigo.services(id);


--
-- Name: store_keywords store_keywords_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.store_keywords
    ADD CONSTRAINT store_keywords_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: stores stores_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.categories(id);


--
-- Name: stores stores_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: stores stores_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: stores stores_place_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_place_id_fkey FOREIGN KEY (place_id) REFERENCES zigo.places(id) ON DELETE CASCADE;


--
-- Name: stores stores_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.stores
    ADD CONSTRAINT stores_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: support_issues support_issues_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_issues
    ADD CONSTRAINT support_issues_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES zigo.users(id);


--
-- Name: support_tickets support_tickets_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: support_tickets support_tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES zigo.lookup_values(id);


--
-- Name: support_tickets support_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES zigo.customers(id);


--
-- Name: support_tickets support_tickets_priority_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES zigo.lookup_values(id);


--
-- Name: support_tickets support_tickets_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: support_tickets support_tickets_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.support_tickets
    ADD CONSTRAINT support_tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: surge_rules surge_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.surge_rules
    ADD CONSTRAINT surge_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: surge_rules surge_rules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.surge_rules
    ADD CONSTRAINT surge_rules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: surge_rules surge_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.surge_rules
    ADD CONSTRAINT surge_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: task_assignments task_assignments_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES zigo.users(id);


--
-- Name: task_assignments task_assignments_assignment_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_assignment_status_id_fkey FOREIGN KEY (assignment_status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_assignments task_assignments_assignment_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_assignment_type_id_fkey FOREIGN KEY (assignment_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_assignments task_assignments_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: task_assignments task_assignments_reason_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES zigo.reason_codes(id);


--
-- Name: task_assignments task_assignments_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_assignments
    ADD CONSTRAINT task_assignments_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_events task_events_assignment_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_events
    ADD CONSTRAINT task_events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES zigo.task_assignments(id) ON DELETE SET NULL;


--
-- Name: task_events task_events_service_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_events
    ADD CONSTRAINT task_events_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_execution_sessions task_execution_sessions_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_execution_sessions
    ADD CONSTRAINT task_execution_sessions_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: task_execution_sessions task_execution_sessions_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_execution_sessions
    ADD CONSTRAINT task_execution_sessions_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_execution_sessions task_execution_sessions_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_execution_sessions
    ADD CONSTRAINT task_execution_sessions_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_proofs task_proofs_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: task_proofs task_proofs_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_file_id_fkey FOREIGN KEY (file_id) REFERENCES zigo.files(id);


--
-- Name: task_proofs task_proofs_proof_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_proof_type_id_fkey FOREIGN KEY (proof_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_proofs task_proofs_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_proofs task_proofs_stop_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES zigo.request_stops(id) ON DELETE CASCADE;


--
-- Name: task_proofs task_proofs_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_proofs
    ADD CONSTRAINT task_proofs_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES zigo.users(id);


--
-- Name: task_stop_visits task_stop_visits_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_stop_visits
    ADD CONSTRAINT task_stop_visits_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: task_stop_visits task_stop_visits_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_stop_visits
    ADD CONSTRAINT task_stop_visits_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_stop_visits task_stop_visits_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_stop_visits
    ADD CONSTRAINT task_stop_visits_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_stop_visits task_stop_visits_stop_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_stop_visits
    ADD CONSTRAINT task_stop_visits_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES zigo.request_stops(id) ON DELETE CASCADE;


--
-- Name: task_types task_types_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_types
    ADD CONSTRAINT task_types_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: task_updates task_updates_assistant_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_updates
    ADD CONSTRAINT task_updates_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES zigo.assistants(id);


--
-- Name: task_updates task_updates_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_updates
    ADD CONSTRAINT task_updates_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_stop_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_updates
    ADD CONSTRAINT task_updates_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES zigo.request_stops(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_update_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.task_updates
    ADD CONSTRAINT task_updates_update_type_id_fkey FOREIGN KEY (update_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: tax_master_rules tax_master_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.tax_master_rules
    ADD CONSTRAINT tax_master_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: tax_master_rules tax_master_rules_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.tax_master_rules
    ADD CONSTRAINT tax_master_rules_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: tax_master_rules tax_master_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.tax_master_rules
    ADD CONSTRAINT tax_master_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: time_slot_masters time_slot_masters_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.time_slot_masters
    ADD CONSTRAINT time_slot_masters_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: time_slot_masters time_slot_masters_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.time_slot_masters
    ADD CONSTRAINT time_slot_masters_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: time_slot_masters time_slot_masters_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.time_slot_masters
    ADD CONSTRAINT time_slot_masters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: user_modules user_modules_module_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_modules
    ADD CONSTRAINT user_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES zigo.modules(id) ON DELETE CASCADE;


--
-- Name: user_modules user_modules_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_modules
    ADD CONSTRAINT user_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES zigo.users(id);


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES zigo.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: user_roles user_roles_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES zigo.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES zigo.users(id) ON DELETE CASCADE;


--
-- Name: users users_avatar_file_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_avatar_file_id_fkey FOREIGN KEY (avatar_file_id) REFERENCES zigo.files(id);


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: users users_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES zigo.organizations(id);


--
-- Name: users users_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: users users_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.users
    ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: vehicle_master vehicle_master_cluster_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.vehicle_master
    ADD CONSTRAINT vehicle_master_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES zigo.clusters(id);


--
-- Name: vehicle_master vehicle_master_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.vehicle_master
    ADD CONSTRAINT vehicle_master_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: vehicle_master vehicle_master_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.vehicle_master
    ADD CONSTRAINT vehicle_master_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: vehicle_master vehicle_master_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.vehicle_master
    ADD CONSTRAINT vehicle_master_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- Name: wallet_ledger wallet_ledger_direction_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallet_ledger
    ADD CONSTRAINT wallet_ledger_direction_id_fkey FOREIGN KEY (direction_id) REFERENCES zigo.lookup_values(id);


--
-- Name: wallet_ledger wallet_ledger_entry_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallet_ledger
    ADD CONSTRAINT wallet_ledger_entry_type_id_fkey FOREIGN KEY (entry_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: wallet_ledger wallet_ledger_request_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallet_ledger
    ADD CONSTRAINT wallet_ledger_request_id_fkey FOREIGN KEY (request_id) REFERENCES zigo.service_requests(id);


--
-- Name: wallet_ledger wallet_ledger_wallet_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallet_ledger
    ADD CONSTRAINT wallet_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES zigo.wallets(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.wallets
    ADD CONSTRAINT wallets_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: webhook_deliveries webhook_deliveries_outbox_event_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_outbox_event_id_fkey FOREIGN KEY (outbox_event_id) REFERENCES zigo.outbox_events(id) ON DELETE SET NULL;


--
-- Name: webhook_deliveries webhook_deliveries_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: webhook_deliveries webhook_deliveries_webhook_endpoint_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_endpoint_id_fkey FOREIGN KEY (webhook_endpoint_id) REFERENCES zigo.webhook_endpoints(id) ON DELETE CASCADE;


--
-- Name: webhook_endpoints webhook_endpoints_api_client_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_api_client_id_fkey FOREIGN KEY (api_client_id) REFERENCES zigo.api_clients(id) ON DELETE CASCADE;


--
-- Name: webhook_endpoints webhook_endpoints_organization_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES zigo.organizations(id);


--
-- Name: webhook_endpoints webhook_endpoints_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: workflow_states workflow_states_workflow_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_states
    ADD CONSTRAINT workflow_states_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES zigo.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_transitions workflow_transitions_actor_type_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_actor_type_id_fkey FOREIGN KEY (actor_type_id) REFERENCES zigo.lookup_values(id);


--
-- Name: workflow_transitions workflow_transitions_from_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_from_state_id_fkey FOREIGN KEY (from_state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: workflow_transitions workflow_transitions_to_state_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_to_state_id_fkey FOREIGN KEY (to_state_id) REFERENCES zigo.workflow_states(id);


--
-- Name: workflow_transitions workflow_transitions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.workflow_transitions
    ADD CONSTRAINT workflow_transitions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES zigo.workflows(id) ON DELETE CASCADE;


--
-- Name: zones zones_city_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_city_id_fkey FOREIGN KEY (city_id) REFERENCES zigo.cities(id) ON DELETE CASCADE;


--
-- Name: zones zones_created_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_created_by_fkey FOREIGN KEY (created_by) REFERENCES zigo.users(id);


--
-- Name: zones zones_deleted_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES zigo.users(id);


--
-- Name: zones zones_status_id_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_status_id_fkey FOREIGN KEY (status_id) REFERENCES zigo.lookup_values(id);


--
-- Name: zones zones_updated_by_fkey; Type: FK CONSTRAINT; Schema: zigo; Owner: -
--

ALTER TABLE ONLY zigo.zones
    ADD CONSTRAINT zones_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES zigo.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict J76FPCKJ9Inq3WuWjudYDkXozQF9ZLRtwAGevug397DJgqrVPXGDhqZDxLMUW3x

