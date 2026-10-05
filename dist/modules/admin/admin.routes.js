import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { getDashboardCounts, getDashboardRangeAnalytics, listAdminActions } from "./admin.repository.js";
export const adminRouter = Router();
const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0)
});
adminRouter.get("/dashboard", requirePermission("admin.dashboard.view"), async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const startDate = String(req.query.startDate || today.slice(0, 8) + "01");
        const endDate = String(req.query.endDate || today);
        const [counts, range] = await Promise.all([getDashboardCounts(), getDashboardRangeAnalytics(startDate, endDate)]);
        res.json({ data: { ...counts, ...range, startDate, endDate } });
    }
    catch (error) {
        next(error);
    }
});
adminRouter.get("/actions", requirePermission("admin.actions.read"), async (req, res, next) => {
    try {
        const query = listQuerySchema.parse(req.query);
        const actions = await listAdminActions(query.limit, query.offset);
        res.json({ data: actions, pagination: query });
    }
    catch (error) {
        next(error);
    }
});
