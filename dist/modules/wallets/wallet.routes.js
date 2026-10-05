import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { getBookingSettlementEligibility, settleCancelledBookingToWallet } from "./wallet.repository.js";
export const walletsRouter = Router();
const idSchema = z.object({ bookingId: z.string().uuid() });
walletsRouter.get("/bookings/:bookingId/settlement-eligibility", requirePermission("tasks.view"), async (req, res, next) => {
    try {
        res.json({ data: await getBookingSettlementEligibility(idSchema.parse(req.params).bookingId) });
    }
    catch (error) {
        next(error);
    }
});
walletsRouter.post("/bookings/:bookingId/settle", requirePermission("tasks.assign"), async (req, res, next) => {
    try {
        res.json({ data: await settleCancelledBookingToWallet({ bookingId: idSchema.parse(req.params).bookingId, actorUserId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
