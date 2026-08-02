export async function calculateClusterCategoryPricing(client, input) {
    if (!input.categoryId)
        return emptyBreakdown();
    const pricing = await loadClusterCategoryPricing(client, input.clusterId, input.categoryId);
    if (!pricing)
        return emptyBreakdown();
    const baseAmount = money(pricing.basePrice);
    const additionalCharges = money(pricing.additionalCharges);
    const discountType = pricing.discountType ?? "none";
    const rawDiscount = money(pricing.discountValue);
    const discountAmount = discountType === "percent" ? money((baseAmount * Math.min(rawDiscount, 100)) / 100) : discountType === "flat" ? rawDiscount : 0;
    const configuredSelling = pricing.sellingPrice == null ? null : money(pricing.sellingPrice);
    const sellingAmount = configuredSelling == null ? Math.max(0, money(baseAmount - discountAmount)) : configuredSelling;
    const surgeBase = money(sellingAmount + additionalCharges);
    const rules = await loadSurgeRules(client, pricing.surgeRuleIds ?? []);
    const demandContexts = new Map();
    for (const rule of rules.filter((rule) => rule.ruleType === "demand")) {
        demandContexts.set(rule.id, await loadDemandContext(client, { rule, clusterId: input.clusterId, serviceId: pricing.serviceId ?? null, categoryId: input.categoryId ?? null }));
    }
    const appliedSurges = rules
        .filter((rule) => isSurgeRuleApplicable(rule, input.at ?? new Date(), demandContexts.get(rule.id) ?? null, input.clusterId, pricing.serviceId ?? null, input.categoryId ?? null))
        .map((rule) => {
        const demandSlab = rule.ruleType === "demand" ? matchingDemandSlab(rule, demandContexts.get(rule.id) ?? null) : null;
        const adjustmentType = demandSlab?.adjustmentType ?? rule.adjustmentType;
        const adjustmentValue = money(demandSlab?.adjustmentValue ?? rule.adjustmentValue);
        const surgeAmount = adjustmentType === "percent" ? money((surgeBase * adjustmentValue) / 100) : adjustmentValue;
        return {
            id: rule.id,
            name: rule.name,
            code: rule.code,
            ruleType: rule.ruleType,
            adjustmentType,
            adjustmentValue,
            surgeAmount
        };
    })
        .filter((rule) => rule.surgeAmount !== 0);
    const surgeAmount = money(appliedSurges.reduce((sum, rule) => sum + rule.surgeAmount, 0));
    const finalTotalAmount = Math.max(0, money(surgeBase + surgeAmount));
    return {
        baseAmount,
        additionalCharges,
        discountAmount,
        sellingAmount,
        surgeAmount,
        finalTotalAmount,
        finalTotalAmountPaise: Math.round(finalTotalAmount * 100),
        appliedSurges
    };
}
function emptyBreakdown() {
    return {
        baseAmount: 0,
        additionalCharges: 0,
        discountAmount: 0,
        sellingAmount: 0,
        surgeAmount: 0,
        finalTotalAmount: 0,
        finalTotalAmountPaise: 0,
        appliedSurges: []
    };
}
async function loadClusterCategoryPricing(client, clusterId, categoryId) {
    const result = await client.query(`
      select coalesce(m.config->'pricing', '{}'::jsonb) || jsonb_build_object('serviceId', c.service_id) as pricing
      from zigo.cluster_category_settings m
      join zigo.categories c on c.id = m.category_id
      where m.cluster_id = $1
        and m.category_id = $2
        and coalesce(m.is_deleted, false) = false
        and m.is_active = true
        and m.is_enabled = true
      limit 1
    `, [clusterId, categoryId]);
    return result.rows[0]?.pricing ?? null;
}
async function loadSurgeRules(client, ids) {
    if (!ids.length)
        return [];
    const result = await client.query(`
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
        metadata
      from zigo.surge_rules
      where id = any($1::uuid[])
        and coalesce(is_deleted, false) = false
        and is_active = true
      order by priority, name
    `, [ids]);
    return result.rows;
}
async function loadDemandContext(client, input) {
    const analytics = input.rule.metadata?.demandAnalytics && typeof input.rule.metadata.demandAnalytics === "object"
        ? input.rule.metadata.demandAnalytics
        : {};
    const lookbackDays = Math.max(1, Math.min(365, Number(analytics.lookbackDays ?? 3)));
    const startTime = analytics.startTime || input.rule.startTime;
    const endTime = analytics.endTime || input.rule.endTime;
    const days = analytics.days?.length ? analytics.days : input.rule.days ?? [];
    const selectedDates = analytics.selectedDates ?? [];
    const params = [input.clusterId, lookbackDays, startTime, endTime, days, selectedDates, input.serviceId ?? null, input.categoryId ?? null];
    const orders = await client.query(`
      select
        count(*) filter (
          where ($3::time is null or created_at::time >= $3::time)
            and ($4::time is null or created_at::time <= $4::time)
            and (cardinality($5::text[]) = 0 or lower(to_char(created_at, 'Dy')) = any($5::text[]))
            and (cardinality($6::date[]) = 0 or created_at::date = any($6::date[]))
        )::int as "slotCount",
        count(*)::int as "totalCount"
      from zigo.service_requests
      where cluster_id = $1
        and created_at >= now() - ($2::int || ' days')::interval
        and ($7::uuid is null or service_id = $7::uuid)
        and ($8::uuid is null or category_id = $8::uuid)
    `, params);
    const assistants = await client.query(`
      select
        count(*) filter (where a.current_cluster_id = $1)::int as "scopedCount",
        count(*)::int as "totalCount"
      from zigo.assistants a
      join zigo.users u on u.id = a.user_id
      where coalesce(a.metadata->>'verificationStatus', u.metadata->>'accountStatus', 'active') in ('active', 'verified', 'approved')
    `, [input.clusterId]);
    const orderRow = orders.rows[0];
    const assistantRow = assistants.rows[0];
    const ordersPercent = orderRow?.totalCount ? (Number(orderRow.slotCount) / Number(orderRow.totalCount)) * 100 : 0;
    const supplyPercent = assistantRow?.totalCount ? (Number(assistantRow.scopedCount) / Number(assistantRow.totalCount)) * 100 : 0;
    return {
        orders: Number(ordersPercent.toFixed(2)),
        availableAssistants: Number(supplyPercent.toFixed(2)),
        rawOrders: orderRow?.slotCount ?? 0,
        totalOrders: orderRow?.totalCount ?? 0,
        rawSupply: assistantRow?.scopedCount ?? 0,
        totalSupply: assistantRow?.totalCount ?? 0
    };
}
function isSurgeRuleApplicable(rule, at, demandContext, clusterId, serviceId, categoryId) {
    if (!isSurgeScopeApplicable(rule, clusterId, serviceId, categoryId))
        return false;
    if (rule.ruleType === "demand")
        return Boolean(matchingDemandSlab(rule, demandContext));
    const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][at.getDay()];
    const date = formatLocalDate(at);
    const time = formatLocalTime(at);
    const metadata = rule.metadata ?? {};
    const selectedDates = Array.isArray(metadata.selectedDates) ? metadata.selectedDates : [];
    const dateTimes = Array.isArray(metadata.dateTimes) ? metadata.dateTimes : [];
    const dayTimes = metadata.dayTimes && typeof metadata.dayTimes === "object" ? metadata.dayTimes : {};
    const weeklyCalendar = metadata.weeklyCalendar && typeof metadata.weeklyCalendar === "object" ? metadata.weeklyCalendar : {};
    if (dateTimes.length)
        return dateTimes.some((slot) => slot.date === date && timeInRange(time, slot.startTime, slot.endTime));
    if (selectedDates.length && !selectedDates.includes(date))
        return false;
    if (weeklyCalendar[day]?.length)
        return weeklyCalendar[day].some((slot) => timeInRange(time, slot.startTime, slot.endTime));
    if (dayTimes[day])
        return timeInRange(time, dayTimes[day].startTime, dayTimes[day].endTime);
    if (rule.days?.length && !rule.days.includes(day))
        return false;
    return timeInRange(time, rule.startTime, rule.endTime);
}
function matchingDemandSlab(rule, demandContext) {
    if (!demandContext)
        return null;
    const slabs = Array.isArray(rule.metadata?.demandSlabs) ? rule.metadata.demandSlabs : [];
    return slabs.find((slab) => demandContext.orders >= Number(slab.minOrders ?? 0) &&
        demandContext.orders <= Number(slab.maxOrders ?? 100) &&
        demandContext.availableAssistants >= Number(slab.minSupply ?? 0) &&
        demandContext.availableAssistants <= Number(slab.maxSupply ?? slab.maxAvailableAssistants ?? 100)) ?? null;
}
function isSurgeScopeApplicable(rule, clusterId, serviceId, categoryId) {
    const scope = rule.metadata?.scope && typeof rule.metadata.scope === "object"
        ? rule.metadata.scope
        : { scopeType: "all" };
    if (!scope.scopeType || scope.scopeType === "all")
        return true;
    if (scope.scopeType === "cluster")
        return (scope.clusterIds || []).includes(clusterId);
    if (scope.scopeType === "service")
        return Boolean(serviceId && (scope.serviceIds || []).includes(serviceId));
    if (scope.scopeType === "category")
        return Boolean(categoryId && (scope.categoryIds || []).includes(categoryId));
    return true;
}
function timeInRange(time, start, end) {
    if (start && time < start)
        return false;
    if (end && time > end)
        return false;
    return true;
}
function formatLocalDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function formatLocalTime(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function money(value) {
    return Math.round((Number(value ?? 0) || 0) * 100) / 100;
}
