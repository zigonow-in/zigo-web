import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
const schemaVersion = "service-identification.v1";
const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "get", "have", "help",
    "i", "in", "is", "it", "me", "my", "need", "of", "on", "please", "someone", "the", "to", "with", "would",
    "home", "them", "local", "order", "from", "need", "want", "se", "hai", "hain"
]);
const multilingualIntentAliases = [
    [/\b(?:mujhe|muje|mujhko|mujko|chahiye)\b/gi, "need"],
    [/\b(?:mishtan|misthan|mithai|jalebi|rasgulla|sweets?)\b/gi, "food"],
    [/\b(?:mangwana|mangwani|mangvaana|mangvaani|order)\b/gi, "pickup"],
    [/\b(?:lana|laana|leana|le aana|bhejna|bhijwana|pahuchana|pahunchana)\b/gi, "delivery"],
    [/\b(?:buy|buying|purchase|purchasing|kharidna|kharidni|khareedna|khareedni)\b/gi, "purchase"],
    [/\b(?:laptop|computer|phone|mobile|tablet|electronics?)\b/gi, "shopping product retail"],
    [/\b(?:dukan|dukkan|shop|store)\b/gi, "shop"],
    [new RegExp("(?:\\u092e\\u0941\\u091d\\u0947|\\u091a\\u093e\\u0939\\u093f\\u090f)", "g"), "need"],
    [new RegExp("(?:\\u092e\\u093f\\u0920\\u093e\\u0908|\\u092e\\u093f\\u0937\\u094d\\u0920\\u093e\\u0928|\\u091c\\u0932\\u0947\\u092c\\u0940)", "g"), "food"],
    [new RegExp("(?:\\u092e\\u0902\\u0917\\u0935\\u093e\\u0928\\u093e|\\u092e\\u0902\\u0917\\u0935\\u093e\\u0928\\u0940)", "g"), "pickup"],
    [new RegExp("(?:\\u0932\\u093e\\u0928\\u093e|\\u092d\\u0947\\u091c\\u0928\\u093e|\\u092a\\u0939\\u0941\\u0902\\u091a\\u093e\\u0928\\u093e)", "g"), "delivery"],
    [new RegExp("(?:\\u0916\\u0930\\u0940\\u0926\\u0928\\u093e|\\u0916\\u0930\\u0940\\u0926\\u0928\\u0940)", "g"), "purchase"],
    [new RegExp("(?:\\u0938\\u0947|\\u0939\\u0948|\\u0939\\u0948\\u0902|\\u0918\\u0930)", "g"), "from home"]
];
function normalizedTokens(value) {
    let canonicalText = String(value || "")
        .toLowerCase()
        .replace(/\bpick\s+up\b/g, "pickup")
        .replace(/\bdrop\s+off\b/g, "dropoff");
    for (const [pattern, replacement] of multilingualIntentAliases) {
        canonicalText = canonicalText.replace(pattern, replacement);
    }
    return [...new Set(canonicalText
            .replace(/[^a-z0-9]+/g, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 1 && !stopWords.has(token))
            .map((token) => token.endsWith("ies") && token.length > 4 ? `${token.slice(0, -3)}y` : token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token))];
}
function clampConfidence(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.min(1, Math.round(parsed * 100) / 100));
}
async function loadServiceCatalogue(clusterId) {
    const result = await pool.query(`
      select
        service.id,
        service.code,
        service.name,
        coalesce(service.description, '') as description,
        coalesce(jsonb_agg(jsonb_build_object(
          'code', task.code,
          'name', task.name,
          'description', coalesce(task.description, '')
        ) order by task.code) filter (where task.code is not null), '[]'::jsonb) as tasks
      from zigo.services service
      join zigo.service_task_mappings service_task on service_task.service_id = service.id
      join zigo.task_definitions task on task.id = service_task.task_id
      where coalesce(service.is_deleted, false) = false
        and coalesce(service.is_active, true) = true
        and coalesce(service.is_enabled, true) = true
        and service.status = 'active'
        and service.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
        and task.status = 'active'::zigo.lifecycle_status
        and ($1::uuid is null or exists (
          select 1
          from zigo.cluster_service_settings cluster_service
          where cluster_service.service_id = service.id
            and cluster_service.cluster_id = $1::uuid
            and coalesce(cluster_service.is_deleted, false) = false
            and coalesce(cluster_service.is_active, true) = true
            and coalesce(cluster_service.is_visible, true) = true
            and coalesce(cluster_service.is_enabled, true) = true
        ))
      group by service.id
      order by coalesce(service.sort_order, 0), lower(service.name), service.code
      limit 100
    `, [clusterId || null]);
    return result.rows.map((row) => ({
        ...row,
        tasks: Array.isArray(row.tasks) ? row.tasks.map((task) => ({
            code: String(task.code || ""),
            name: String(task.name || ""),
            description: String(task.description || "")
        })) : []
    }));
}
async function loadWorkCatalogue() {
    const result = await pool.query(`
    select
      service.id,
      service.code,
      service.name,
      coalesce(service.description, '') as description,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', pillar.code,
          'name', pillar.name,
          'description', coalesce(pillar.description, '')
        ) order by pillar.display_order, pillar.name)
        from zigo.service_pillar_mappings pillar_mapping
        join zigo.service_pillars pillar on pillar.id = pillar_mapping.pillar_id
        where pillar_mapping.service_id = service.id
          and pillar.status = 'active'::zigo.lifecycle_status
      ), '[]'::jsonb) as pillars,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', task.code,
          'name', task.name,
          'description', coalesce(task.description, ''),
          'actions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'code', action.code,
              'name', action.name,
              'description', coalesce(action.description, '')
            ) order by task_mapping.sequence_no)
            from zigo.task_primitive_mappings task_mapping
            join zigo.task_primitives action on action.id = task_mapping.primitive_id
            where task_mapping.task_id = task.id
              and action.status = 'active'::zigo.lifecycle_status
          ), '[]'::jsonb)
        ) order by service_task.display_order, task.name)
        from zigo.service_task_mappings service_task
        join zigo.task_definitions task on task.id = service_task.task_id
        where service_task.service_id = service.id
          and task.status = 'active'::zigo.lifecycle_status
      ), '[]'::jsonb) as tasks
    from zigo.services service
    where coalesce(service.is_deleted, false) = false
      and coalesce(service.is_active, true) = true
      and coalesce(service.is_enabled, true) = true
      and service.status = 'active'::zigo.lifecycle_status
      and service.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
    order by coalesce(service.sort_order, 0), lower(service.name), service.code
    limit 100
  `);
    return result.rows.map((row) => ({
        ...row,
        pillars: Array.isArray(row.pillars) ? row.pillars : [],
        tasks: Array.isArray(row.tasks) ? row.tasks : []
    }));
}
function workCatalogueText(catalogue) {
    return catalogue.map((service) => [
        `SERVICE ${service.code}: ${service.name} - ${service.description}`,
        `PILLARS: ${service.pillars.map((pillar) => `${pillar.code}: ${pillar.name} - ${pillar.description}`).join(" | ")}`,
        service.tasks.map((task) => `TASK ${task.code}: ${task.name} - ${task.description}\nACTIONS: ${task.actions.map((action) => `${action.code}: ${action.name} - ${action.description}`).join(" | ")}`).join("\n")
    ].join("\n")).join("\n\n");
}
function fallbackWorkOutput(query, catalogue) {
    const queryTokens = normalizedTokens(query);
    const scored = catalogue.map((service) => {
        const serviceIdentityText = [
            service.code, service.name, service.description,
            ...service.pillars.flatMap((pillar) => [pillar.code, pillar.name, pillar.description])
        ].join(" ");
        const taskText = service.tasks.flatMap((task) => [task.code, task.name, task.description]).join(" ");
        const identityTokens = new Set(normalizedTokens(serviceIdentityText));
        const taskTokens = new Set(normalizedTokens(taskText));
        const matchedIdentityTokens = queryTokens.filter((token) => identityTokens.has(token));
        const matchedTaskTokens = queryTokens.filter((token) => taskTokens.has(token));
        const matchedTokens = [...new Set([...matchedIdentityTokens, ...matchedTaskTokens])];
        const weightedMatches = matchedIdentityTokens.length * 2 + matchedTaskTokens.length;
        return { service, matchedTokens, score: queryTokens.length ? weightedMatches / (queryTokens.length * 2) : 0 };
    }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.service.name.localeCompare(right.service.name));
    const topScore = scored[0]?.score || 0;
    const relevant = scored.filter((item) => item.score >= Math.max(0.5, topScore * 0.75)).slice(0, 3);
    return {
        normalizedRequest: query.trim(),
        interpretationSummary: relevant.length ? "Matched against the active master catalogue." : "No safe catalogue match found.",
        matches: relevant.map(({ service, matchedTokens, score }) => {
            const matchedTasks = service.tasks.filter((task) => {
                const tokens = new Set(normalizedTokens(`${task.code} ${task.name} ${task.description}`));
                return queryTokens.some((token) => tokens.has(token));
            });
            const actionCodes = matchedTasks.flatMap((task) => task.actions).filter((action) => {
                const tokens = new Set(normalizedTokens(`${action.code} ${action.name} ${action.description}`));
                return queryTokens.some((token) => tokens.has(token));
            }).map((action) => action.code);
            return {
                serviceCode: service.code,
                pillarCodes: service.pillars.map((pillar) => pillar.code),
                taskCodes: matchedTasks.map((task) => task.code),
                actionCodes,
                confidence: clampConfidence(Math.min(0.89, 0.3 + score * 0.55)),
                reason: matchedTokens.length ? `Matched: ${matchedTokens.slice(0, 6).join(", ")}.` : "Related active service."
            };
        }),
        needsClarification: relevant.length === 0,
        clarificationQuestion: relevant.length === 0 ? "What would you like the assistant to do?" : ""
    };
}
async function callOpenAiForWork(query, catalogue) {
    if (!env.OPENAI_API_KEY)
        return { output: null, error: "OPENAI_API_KEY is not configured on the server." };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);
    try {
        const response = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, "")}/responses`, {
            method: "POST",
            signal: controller.signal,
            headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: env.OPENAI_MODEL,
                input: [
                    {
                        role: "system",
                        content: [{
                                type: "input_text",
                                text: "Understand the user's request in Hindi or English. Identify every active Zigo pillar, service, executable task, and reusable action required. Use only codes from the supplied catalogue. Do not invent codes. Return only the best matching services. Keep the summary and reasons concise and in English."
                            }]
                    },
                    {
                        role: "user",
                        content: [{ type: "input_text", text: JSON.stringify({ customerRequest: query, activeCatalogue: workCatalogueText(catalogue) }) }]
                    }
                ],
                text: {
                    format: {
                        type: "json_schema",
                        name: "zigo_work_identification",
                        strict: true,
                        schema: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                normalizedRequest: { type: "string" },
                                interpretationSummary: { type: "string" },
                                matches: {
                                    type: "array",
                                    maxItems: 5,
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            serviceCode: { type: "string" },
                                            pillarCodes: { type: "array", items: { type: "string" }, maxItems: 10 },
                                            taskCodes: { type: "array", items: { type: "string" }, maxItems: 30 },
                                            actionCodes: { type: "array", items: { type: "string" }, maxItems: 50 },
                                            confidence: { type: "number", minimum: 0, maximum: 1 },
                                            reason: { type: "string" }
                                        },
                                        required: ["serviceCode", "pillarCodes", "taskCodes", "actionCodes", "confidence", "reason"]
                                    }
                                },
                                needsClarification: { type: "boolean" },
                                clarificationQuestion: { type: "string" }
                            },
                            required: ["normalizedRequest", "interpretationSummary", "matches", "needsClarification", "clarificationQuestion"]
                        }
                    }
                },
                max_output_tokens: 1400
            })
        });
        if (!response.ok) {
            console.warn("OpenAI work identification failed", { status: response.status });
            return {
                output: null,
                error: response.status === 429
                    ? "OpenAI returned 429: the API project is rate-limited or has no available quota."
                    : `OpenAI returned HTTP ${response.status}.`
            };
        }
        const parsed = JSON.parse(responseOutputText(await response.json()));
        if (!parsed || !Array.isArray(parsed.matches))
            return { output: null, error: "OpenAI returned an invalid structured result." };
        return { output: {
                normalizedRequest: String(parsed.normalizedRequest || query).trim().slice(0, 2000),
                interpretationSummary: String(parsed.interpretationSummary || "").trim().slice(0, 500),
                matches: parsed.matches.slice(0, 5).map((match) => ({
                    serviceCode: String(match.serviceCode || "").trim().toUpperCase(),
                    pillarCodes: Array.isArray(match.pillarCodes) ? match.pillarCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 10) : [],
                    taskCodes: Array.isArray(match.taskCodes) ? match.taskCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 30) : [],
                    actionCodes: Array.isArray(match.actionCodes) ? match.actionCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 50) : [],
                    confidence: clampConfidence(match.confidence),
                    reason: String(match.reason || "Related active service.").trim().slice(0, 300)
                })),
                needsClarification: Boolean(parsed.needsClarification),
                clarificationQuestion: String(parsed.clarificationQuestion || "").trim().slice(0, 300)
            } };
    }
    catch (error) {
        console.warn("OpenAI work identification unavailable", { message: error instanceof Error ? error.message : "Unknown error" });
        return { output: null, error: "OpenAI could not be reached from the server." };
    }
    finally {
        clearTimeout(timeout);
    }
}
function validateWorkOutput(output, catalogue) {
    const serviceByCode = new Map(catalogue.map((service) => [service.code.toUpperCase(), service]));
    const matches = output.matches.flatMap((rawMatch) => {
        const service = serviceByCode.get(rawMatch.serviceCode.toUpperCase());
        if (!service)
            return [];
        const pillarByCode = new Map(service.pillars.map((pillar) => [pillar.code.toUpperCase(), pillar]));
        const taskByCode = new Map(service.tasks.map((task) => [task.code.toUpperCase(), task]));
        const allowedActions = new Map(service.tasks.flatMap((task) => task.actions).map((action) => [action.code.toUpperCase(), action]));
        const pillarCodes = [...new Set(rawMatch.pillarCodes.map((code) => code.toUpperCase()).filter((code) => pillarByCode.has(code)))];
        const taskCodes = [...new Set(rawMatch.taskCodes.map((code) => code.toUpperCase()).filter((code) => taskByCode.has(code)))];
        const actionCodes = [...new Set(rawMatch.actionCodes.map((code) => code.toUpperCase()).filter((code) => allowedActions.has(code)))];
        const taskRows = taskCodes.map((code) => {
            const task = taskByCode.get(code);
            const taskActionCodes = task.actions.map((action) => action.code.toUpperCase()).filter((actionCode) => actionCodes.includes(actionCode));
            return { code: task.code, name: task.name, description: task.description, actionCodes: taskActionCodes };
        });
        const actions = actionCodes.map((code) => {
            const action = allowedActions.get(code);
            return { code: action.code, name: action.name, description: action.description };
        });
        return [{
                service: { id: service.id, code: service.code, name: service.name, description: service.description },
                pillars: pillarCodes.map((code) => pillarByCode.get(code)),
                tasks: taskRows,
                actions,
                confidence: clampConfidence(rawMatch.confidence),
                reason: rawMatch.reason || "Related active service."
            }];
    });
    const uniqueMatches = [...new Map(matches.map((match) => [match.service.id, match])).values()];
    return {
        normalizedRequest: output.normalizedRequest,
        interpretationSummary: output.interpretationSummary,
        matches: uniqueMatches,
        needsClarification: uniqueMatches.length === 0 || output.needsClarification,
        clarificationQuestion: uniqueMatches.length === 0 ? (output.clarificationQuestion || "What would you like the assistant to do?") : output.clarificationQuestion
    };
}
function catalogueText(catalogue) {
    return catalogue.map((service) => [
        `SERVICE ${service.code}: ${service.name}`,
        service.description,
        service.tasks.map((task) => `TASK ${task.code}: ${task.name} - ${task.description}`).join("\n")
    ].filter(Boolean).join("\n")).join("\n\n");
}
function fallbackMatches(query, catalogue) {
    const queryTokens = normalizedTokens(query);
    const scored = catalogue.map((service) => {
        const serviceText = [service.code, service.name, service.description, ...service.tasks.flatMap((task) => [task.code, task.name, task.description])].join(" ").toLowerCase();
        const serviceTokens = new Set(normalizedTokens(serviceText));
        const matchedTokens = queryTokens.filter((token) => serviceTokens.has(token));
        const phraseMatch = serviceText.includes(query.trim().toLowerCase()) ? 0.3 : 0;
        const score = queryTokens.length ? matchedTokens.length / queryTokens.length + phraseMatch : 0;
        return { service, matchedTokens, score };
    }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.service.name.localeCompare(right.service.name));
    return {
        normalizedRequest: query.trim(),
        matches: scored.slice(0, 3).map(({ service, matchedTokens, score }) => ({
            serviceCode: service.code,
            taskCodes: service.tasks.filter((task) => {
                const taskTokens = new Set(normalizedTokens(`${task.code} ${task.name} ${task.description}`));
                return matchedTokens.some((token) => taskTokens.has(token));
            }).map((task) => task.code),
            confidence: clampConfidence(Math.min(0.89, 0.35 + score * 0.5)),
            reason: matchedTokens.length ? `Matched: ${matchedTokens.slice(0, 5).join(", ")}.` : "Related active service."
        })),
        needsClarification: scored.length === 0,
        clarificationQuestion: scored.length === 0 ? "What would you like the assistant to do?" : ""
    };
}
function responseOutputText(response) {
    if (typeof response?.output_text === "string" && response.output_text.trim())
        return response.output_text;
    const chunks = [];
    for (const item of Array.isArray(response?.output) ? response.output : []) {
        for (const content of Array.isArray(item?.content) ? item.content : []) {
            if (typeof content?.text === "string")
                chunks.push(content.text);
        }
    }
    return chunks.join("\n");
}
function ollamaOutputText(response) {
    const text = response?.message?.content;
    if (typeof text !== "string")
        return "";
    return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
async function callOllamaJson(systemPrompt, userPrompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OLLAMA_TIMEOUT_MS);
    try {
        const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: env.OLLAMA_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                stream: false,
                think: false,
                format: "json",
                options: { temperature: 0, num_predict: 1600 }
            })
        });
        if (!response.ok) {
            return { output: null, error: `Ollama returned HTTP ${response.status}. Is the local Ollama service running?` };
        }
        const parsedResponse = await response.json();
        const text = ollamaOutputText(parsedResponse);
        if (!text)
            return { output: null, error: "Ollama returned an empty response." };
        try {
            return { output: JSON.parse(text), error: undefined };
        }
        catch {
            return { output: null, error: "Ollama returned invalid JSON." };
        }
    }
    catch (error) {
        console.warn("Ollama unavailable", { message: error instanceof Error ? error.message : "Unknown error" });
        return { output: null, error: "Ollama is unavailable. Start the local Ollama service and try again." };
    }
    finally {
        clearTimeout(timeout);
    }
}
async function callOllamaForWork(query, catalogue) {
    const result = await callOllamaJson("Understand the user's request in Hindi or English. Identify every active Zigo pillar, service, executable task, and reusable action required. Use only codes from the supplied catalogue. Do not invent codes. Return only JSON with normalizedRequest, interpretationSummary, matches, needsClarification, and clarificationQuestion. Each match must contain serviceCode, pillarCodes, taskCodes, actionCodes, confidence, and reason. Do not include markdown or commentary.", JSON.stringify({ customerRequest: query, activeCatalogue: workCatalogueText(catalogue) }));
    if (!result.output || typeof result.output !== "object")
        return { output: null, error: result.error };
    const parsed = result.output;
    if (!Array.isArray(parsed.matches))
        return { output: null, error: "Ollama returned an invalid structured result." };
    return { output: {
            normalizedRequest: String(parsed.normalizedRequest || query).trim().slice(0, 2000),
            interpretationSummary: String(parsed.interpretationSummary || "").trim().slice(0, 500),
            matches: parsed.matches.slice(0, 5).map((match) => ({
                serviceCode: String(match.serviceCode || "").trim().toUpperCase(),
                pillarCodes: Array.isArray(match.pillarCodes) ? match.pillarCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 10) : [],
                taskCodes: Array.isArray(match.taskCodes) ? match.taskCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 30) : [],
                actionCodes: Array.isArray(match.actionCodes) ? match.actionCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 50) : [],
                confidence: clampConfidence(match.confidence),
                reason: String(match.reason || "Related active service.").trim().slice(0, 300)
            })),
            needsClarification: Boolean(parsed.needsClarification),
            clarificationQuestion: String(parsed.clarificationQuestion || "").trim().slice(0, 300)
        } };
}
async function callOllama(query, catalogue) {
    const result = await callOllamaJson("Identify which active Zigo services and executable tasks match the customer's request in Hindi or English. Use only serviceCode and taskCodes present in the supplied catalogue. Return an empty match list when there is no safe match. Never invent a code. A service may have multiple matching tasks. Return only JSON with normalizedRequest, matches, needsClarification, and clarificationQuestion. Do not include markdown or commentary.", JSON.stringify({ customerRequest: query, activeCatalogue: catalogueText(catalogue) }));
    if (!result.output || typeof result.output !== "object")
        return null;
    const parsed = result.output;
    if (!Array.isArray(parsed.matches))
        return null;
    return {
        normalizedRequest: String(parsed.normalizedRequest || query).trim().slice(0, 2000),
        matches: parsed.matches.slice(0, 5).map((match) => ({
            serviceCode: String(match.serviceCode || "").trim().toUpperCase(),
            taskCodes: Array.isArray(match.taskCodes) ? match.taskCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 20) : [],
            confidence: clampConfidence(match.confidence),
            reason: String(match.reason || "Related active service.").trim().slice(0, 300)
        })),
        needsClarification: Boolean(parsed.needsClarification),
        clarificationQuestion: String(parsed.clarificationQuestion || "").trim().slice(0, 300)
    };
}
async function callOpenAi(query, catalogue) {
    if (!env.OPENAI_API_KEY)
        return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);
    try {
        const response = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, "")}/responses`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: env.OPENAI_MODEL,
                input: [
                    {
                        role: "system",
                        content: [{
                                type: "input_text",
                                text: "Identify which active Zigo services and executable tasks match the customer's request. Use only serviceCode and taskCodes present in the supplied catalogue. Return an empty match list when there is no safe match. Never invent a code. A service may have multiple matching tasks. Keep reasons short."
                            }]
                    },
                    {
                        role: "user",
                        content: [{
                                type: "input_text",
                                text: JSON.stringify({ customerRequest: query, activeCatalogue: catalogueText(catalogue) })
                            }]
                    }
                ],
                text: {
                    format: {
                        type: "json_schema",
                        name: "service_identification",
                        strict: true,
                        schema: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                normalizedRequest: { type: "string" },
                                matches: {
                                    type: "array",
                                    maxItems: 5,
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            serviceCode: { type: "string" },
                                            taskCodes: { type: "array", items: { type: "string" }, maxItems: 20 },
                                            confidence: { type: "number", minimum: 0, maximum: 1 },
                                            reason: { type: "string" }
                                        },
                                        required: ["serviceCode", "taskCodes", "confidence", "reason"]
                                    }
                                },
                                needsClarification: { type: "boolean" },
                                clarificationQuestion: { type: "string" }
                            },
                            required: ["normalizedRequest", "matches", "needsClarification", "clarificationQuestion"]
                        }
                    }
                },
                max_output_tokens: 900
            })
        });
        if (!response.ok) {
            console.warn("OpenAI service identification failed", { status: response.status });
            return null;
        }
        const parsed = JSON.parse(responseOutputText(await response.json()));
        if (!parsed || !Array.isArray(parsed.matches))
            return null;
        return {
            normalizedRequest: String(parsed.normalizedRequest || query).trim().slice(0, 2000),
            matches: parsed.matches.slice(0, 5).map((match) => ({
                serviceCode: String(match.serviceCode || "").trim().toUpperCase(),
                taskCodes: Array.isArray(match.taskCodes) ? match.taskCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean).slice(0, 20) : [],
                confidence: clampConfidence(match.confidence),
                reason: String(match.reason || "Related active service.").trim().slice(0, 300)
            })),
            needsClarification: Boolean(parsed.needsClarification),
            clarificationQuestion: String(parsed.clarificationQuestion || "").trim().slice(0, 300)
        };
    }
    catch (error) {
        console.warn("OpenAI service identification unavailable", { message: error instanceof Error ? error.message : "Unknown error" });
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
function validateModelOutput(output, catalogue) {
    const byCode = new Map(catalogue.map((service) => [service.code.toUpperCase(), service]));
    const matches = [];
    for (const rawMatch of output.matches) {
        const service = byCode.get(String(rawMatch.serviceCode || "").toUpperCase());
        if (!service)
            continue;
        const allowedTasks = new Map(service.tasks.map((task) => [task.code.toUpperCase(), task]));
        const taskCodes = [...new Set(rawMatch.taskCodes.map((code) => code.toUpperCase()).filter((code) => allowedTasks.has(code)))];
        const taskNames = taskCodes.map((code) => allowedTasks.get(code)?.name || "").filter(Boolean);
        matches.push({
            serviceId: service.id,
            serviceCode: service.code,
            serviceName: service.name,
            reason: rawMatch.reason || "Related active service.",
            confidence: clampConfidence(rawMatch.confidence),
            taskCodes,
            taskNames
        });
    }
    const uniqueMatches = [...new Map(matches.map((match) => [match.serviceId, match])).values()]
        .sort((left, right) => right.confidence - left.confidence || left.serviceName.localeCompare(right.serviceName));
    return {
        normalizedRequest: output.normalizedRequest,
        matches: uniqueMatches,
        needsClarification: uniqueMatches.length === 0 || output.needsClarification,
        clarificationQuestion: uniqueMatches.length === 0
            ? (output.clarificationQuestion || "What would you like the assistant to do?")
            : output.clarificationQuestion
    };
}
export async function identifyCustomerServices(query, clusterId) {
    const normalizedQuery = String(query || "").trim();
    const catalogue = await loadServiceCatalogue(clusterId);
    if (!catalogue.length) {
        return {
            normalizedRequest: normalizedQuery,
            matches: [],
            needsClarification: true,
            clarificationQuestion: "No active services are available in this service area.",
            provider: "catalogue",
            model: "",
            schemaVersion
        };
    }
    const modelOutput = env.AI_PROVIDER === "openai"
        ? await callOpenAi(normalizedQuery, catalogue)
        : await callOllama(normalizedQuery, catalogue);
    const output = modelOutput || fallbackMatches(normalizedQuery, catalogue);
    const validated = validateModelOutput(output, catalogue);
    return {
        ...validated,
        provider: modelOutput ? env.AI_PROVIDER : "local",
        model: modelOutput
            ? (env.AI_PROVIDER === "openai" ? env.OPENAI_MODEL : env.OLLAMA_MODEL)
            : "local-catalogue-match",
        schemaVersion
    };
}
export async function identifyAdminWork(query) {
    const normalizedQuery = String(query || "").trim();
    const catalogue = await loadWorkCatalogue();
    if (!catalogue.length) {
        return {
            normalizedRequest: normalizedQuery,
            interpretationSummary: "No active Service Master records are available.",
            matches: [],
            needsClarification: true,
            clarificationQuestion: "Create or activate a Pillar, Service, Task, and Action catalogue first.",
            provider: "catalogue",
            model: "",
            schemaVersion
        };
    }
    const aiResult = env.AI_PROVIDER === "openai"
        ? await callOpenAiForWork(normalizedQuery, catalogue)
        : await callOllamaForWork(normalizedQuery, catalogue);
    const modelOutput = aiResult.output;
    const output = modelOutput || fallbackWorkOutput(normalizedQuery, catalogue);
    const validated = validateWorkOutput(output, catalogue);
    return {
        ...validated,
        provider: modelOutput ? env.AI_PROVIDER : "local",
        model: modelOutput
            ? (env.AI_PROVIDER === "openai" ? env.OPENAI_MODEL : env.OLLAMA_MODEL)
            : "local-catalogue-match",
        aiError: modelOutput ? null : aiResult.error || null,
        schemaVersion
    };
}
