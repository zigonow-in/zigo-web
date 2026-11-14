import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";
import { addAdminAssistantSupportMessage, addAdminSupportMessage, getAdminAssistantSupportTicket, getAdminSupportTicket, createAdminSupportReplyTemplate, deleteAdminSupportReplyTemplate, listAdminSupportReplyTemplates, listAdminAssistantSupportTickets, listAdminSupportTickets, updateAdminSupportReplyTemplate, updateAdminAssistantSupportTicket, updateAdminSupportTicket } from "./support.repository.js";
export const supportRouter = Router();
const idSchema = z.object({ ticketId: z.string().uuid() });
const listSchema = z.object({
    search: z.string().trim().max(120).optional(),
    status: z.string().trim().max(30).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(20)
});
const supportAttachmentSchema = z.object({
    url: z.string().trim().min(1).max(2000),
    name: z.string().trim().max(255).optional(),
    type: z.string().trim().max(120).optional(),
    size: z.coerce.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional()
});
const messageSchema = z.object({
    message: z.string().trim().max(4000).default(""),
    attachments: z.array(supportAttachmentSchema).max(10).default([]),
    replyTemplateId: z.string().uuid().nullable().optional()
}).refine((value) => value.message.length > 0 || value.attachments.length > 0, { message: "Type a message or attach a file." });
const updateSchema = z.object({
    statusCode: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]).optional(),
    priorityCode: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignToMe: z.boolean().optional()
});
const assistantUpdateSchema = z.object({
    statusCode: z.enum(["open", "in_progress", "waiting_assistant", "resolved", "closed"]).optional(),
    priorityCode: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignToMe: z.boolean().optional()
});
const supportReplyTemplateParamsSchema = z.object({ id: z.string().uuid() });
const supportReplyTemplateBodySchema = z.object({
    channelCode: z.enum(["customer", "assistant"]),
    replyType: z.enum(["quick", "auto"]),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(4000),
    iconUrl: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional()
});
supportRouter.get("/assistant/reply-templates", requirePermission("assistants.view"), async (req, res, next) => {
    try {
        res.json({ data: await listAdminSupportReplyTemplates("assistant") });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.post("/assistant/reply-templates", requirePermission("assistants.edit"), async (req, res, next) => {
    try {
        const body = supportReplyTemplateBodySchema.parse({ ...req.body, channelCode: "assistant" });
        res.status(201).json({ data: await createAdminSupportReplyTemplate(req.auth.sub, body) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.put("/assistant/reply-templates/:id", requirePermission("assistants.edit"), async (req, res, next) => {
    try {
        const body = supportReplyTemplateBodySchema.parse({ ...req.body, channelCode: "assistant" });
        res.json({ data: await updateAdminSupportReplyTemplate(req.auth.sub, supportReplyTemplateParamsSchema.parse(req.params).id, body) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.delete("/assistant/reply-templates/:id", requirePermission("assistants.delete"), async (req, res, next) => {
    try {
        res.json({ data: await deleteAdminSupportReplyTemplate(req.auth.sub, supportReplyTemplateParamsSchema.parse(req.params).id) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.get("/assistant/tickets", requirePermission("assistants.view"), async (req, res, next) => {
    try {
        res.json({ data: await listAdminAssistantSupportTickets(listSchema.parse(req.query)) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.get("/assistant/tickets/:ticketId", requirePermission("assistants.view"), async (req, res, next) => {
    try {
        res.json({ data: await getAdminAssistantSupportTicket(idSchema.parse(req.params).ticketId) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.post("/assistant/tickets/:ticketId/messages", requirePermission("assistants.edit"), async (req, res, next) => {
    try {
        const { ticketId } = idSchema.parse(req.params);
        const body = messageSchema.parse(req.body);
        const result = await addAdminAssistantSupportMessage(req.auth.sub, ticketId, body);
        await emitBookingRealtimeEvent({
            type: "support.message.created",
            bookingId: result.ticket.bookingId || undefined,
            assistantId: result.ticket.assistantId,
            message: "ZIGO Support replied to the assistant.",
            payload: { ticketId, assistantId: result.ticket.assistantId, assistantUserId: result.ticket.assistantUserId, requesterType: "assistant", actor: "admin" }
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.patch("/assistant/tickets/:ticketId", requirePermission("assistants.edit"), async (req, res, next) => {
    try {
        const { ticketId } = idSchema.parse(req.params);
        const result = await updateAdminAssistantSupportTicket(req.auth.sub, ticketId, assistantUpdateSchema.parse(req.body));
        await emitBookingRealtimeEvent({
            type: "support.ticket.updated",
            bookingId: result.ticket.bookingId || undefined,
            assistantId: result.ticket.assistantId,
            message: "Assistant support chat updated.",
            payload: { ticketId, assistantId: result.ticket.assistantId, assistantUserId: result.ticket.assistantUserId, requesterType: "assistant" }
        });
        res.json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.get("/tickets", requirePermission("customers.view"), async (req, res, next) => {
    try {
        res.json({ data: await listAdminSupportTickets(listSchema.parse(req.query)) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.get("/reply-templates", requirePermission("customers.view"), async (req, res, next) => {
    try {
        res.json({ data: await listAdminSupportReplyTemplates("customer") });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.post("/reply-templates", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const body = supportReplyTemplateBodySchema.parse({ ...req.body, channelCode: "customer" });
        res.status(201).json({ data: await createAdminSupportReplyTemplate(req.auth.sub, body) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.put("/reply-templates/:id", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const body = supportReplyTemplateBodySchema.parse({ ...req.body, channelCode: "customer" });
        res.json({ data: await updateAdminSupportReplyTemplate(req.auth.sub, supportReplyTemplateParamsSchema.parse(req.params).id, body) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.delete("/reply-templates/:id", requirePermission("customers.delete"), async (req, res, next) => {
    try {
        res.json({ data: await deleteAdminSupportReplyTemplate(req.auth.sub, supportReplyTemplateParamsSchema.parse(req.params).id) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.get("/tickets/:ticketId", requirePermission("customers.view"), async (req, res, next) => {
    try {
        res.json({ data: await getAdminSupportTicket(idSchema.parse(req.params).ticketId) });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.post("/tickets/:ticketId/messages", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { ticketId } = idSchema.parse(req.params);
        const body = messageSchema.parse(req.body);
        const result = await addAdminSupportMessage(req.auth.sub, ticketId, body);
        await emitBookingRealtimeEvent({ type: "support.message.created", message: "ZIGO Support replied.", payload: { ticketId, customerUserId: result.ticket.customerUserId, actor: "admin" } });
        res.status(201).json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
supportRouter.patch("/tickets/:ticketId", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { ticketId } = idSchema.parse(req.params);
        const result = await updateAdminSupportTicket(req.auth.sub, ticketId, updateSchema.parse(req.body));
        await emitBookingRealtimeEvent({ type: "support.ticket.updated", message: "Support ticket updated.", payload: { ticketId, customerUserId: result.ticket.customerUserId, actor: "admin" } });
        res.json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
