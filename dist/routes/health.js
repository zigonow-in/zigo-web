import { Router } from "express";
import { checkDatabaseConnection } from "../db/pool.js";
export const healthRouter = Router();
healthRouter.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "zigo-backend"
    });
});
healthRouter.get("/db", async (_req, res, next) => {
    try {
        const db = await checkDatabaseConnection();
        res.json({
            status: "ok",
            database: db
        });
    }
    catch (error) {
        next(error);
    }
});
