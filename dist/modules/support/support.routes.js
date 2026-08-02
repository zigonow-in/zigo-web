import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";
import { addAdminSupportMessage, getAdminSupportTicket, listAdminSupportTickets, updateAdminSupportTicket } from "./support.repository.js";
export const supportRouter = Router();
const idSchema = z.object({ ticketId: z.string().uuid() });
const listSchema = z.object({
    search: z.string().trim().max(120).optional(),
    status: z.string().trim().max(30).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(20)
});
const messageSchema = z.object({ message: z.string().trim().min(1).max(4000) });
const updateSchema = z.object({
    statusCode: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]).optional(),
    priorityCode: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignToMe: z.boolean().optional()
});
supportRouter.get("/tickets", requirePermission("customers.view"), async (req, res, next) => {
    try {
        res.json({ data: await listAdminSupportTickets(listSchema.parse(req.query)) });
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
        const result = await addAdminSupportMessage(req.auth.sub, ticketId, messageSchema.parse(req.body).message);
        await emitBookingRealtimeEvent({ type: "support.message.created", message: "ZIGO Support replied.", payload: { ticketId, customerUserId: result.ticket.customerUserId } });
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
        await emitBookingRealtimeEvent({ type: "support.ticket.updated", message: "Support ticket updated.", payload: { ticketId, customerUserId: result.ticket.customerUserId } });
        res.json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
