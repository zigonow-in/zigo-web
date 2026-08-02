import { Router } from "express";
import { z } from "zod";
import { requirePermission, requireSuperAdmin } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import {
  createVehicleMaster,
  deleteVehicleMaster,
  getVehicleMaster,
  listVehicleMasters,
  updateVehicleMaster
} from "./vehicles.repository.js";

export const vehiclesRouter = Router();

const vehicleIdParamsSchema = z.object({
  id: z.string().uuid()
});

const vehicleBodySchema = z
  .object({
    vehicleName: z.string().trim().min(1, "Vehicle name is required."),
    clusterId: z.string().uuid("Select a valid Cluster for this vehicle.").optional().nullable(),
    company: z.string().trim().optional().nullable(),
    vehicleNumber: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    fuelType: z.enum(["EV", "Petrol", "Diesel"], {
      required_error: "Fuel type is required."
    }),
    color: z.string().trim().optional().nullable(),
    pictureUrls: z.array(z.string().trim().min(1)).default([]),
    ownerType: z.enum(["Own", "Rent", "ZIGO", "Self", "Rented"], {
      required_error: "Owner type is required."
    }),
    rentalCompanyName: z.string().trim().optional().nullable(),
    rentalCompanyAddress: z.string().trim().optional().nullable(),
    rentalCompanyNumber: z.string().trim().optional().nullable(),
    rentSlab: z.enum(["Hourly", "Daily", "Weekly", "Monthly"]).optional().nullable(),
    rentCharges: z.coerce.number().nonnegative("Rent charges cannot be negative.").optional().nullable(),
    zigoSlab: z.enum(["Hourly", "Daily", "Weekly", "Monthly"]).optional().nullable(),
    zigoCharges: z.coerce.number().nonnegative("ZIGO charges cannot be negative.").optional().nullable(),
    isActive: z.boolean().default(true)
  })
  .superRefine((value, context) => {
    const ownerType = value.ownerType === "Rented" ? "Rent" : value.ownerType === "Self" ? "Own" : value.ownerType;
    if (ownerType === "Rent") {
      if (!value.rentalCompanyName) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["rentalCompanyName"], message: "Rental company name is required for rent vehicles." });
      }
      if (!value.rentSlab) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["rentSlab"], message: "Rent slab is required for rent vehicles." });
      }
      if (value.rentCharges == null) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["rentCharges"], message: "Rent charges are required for rent vehicles." });
      }
    }
    if (ownerType === "ZIGO") {
      if (!value.zigoSlab) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["zigoSlab"], message: "ZIGO slab is required for ZIGO vehicles." });
      }
      if (value.zigoCharges == null) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["zigoCharges"], message: "ZIGO charges are required for ZIGO vehicles." });
      }
    }
  });

vehiclesRouter.get("/", requirePermission("verification.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listVehicleMasters() });
  } catch (error) {
    next(error);
  }
});

vehiclesRouter.get("/:id", requirePermission("verification.view"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    const vehicle = await getVehicleMaster(params.id);
    if (!vehicle) throw new HttpError(404, "Vehicle record not found.");
    res.json({ data: vehicle });
  } catch (error) {
    next(error);
  }
});

vehiclesRouter.post("/", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createVehicleMaster({
        ...vehicleBodySchema.parse(req.body),
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

vehiclesRouter.put("/:id", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    const vehicle = await updateVehicleMaster(params.id, {
      ...vehicleBodySchema.parse(req.body),
      actorUserId: req.auth!.sub
    });
    if (!vehicle) throw new HttpError(404, "Vehicle record not found.");
    res.json({ data: vehicle });
  } catch (error) {
    next(error);
  }
});

vehiclesRouter.delete("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    const deleted = await deleteVehicleMaster(params.id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Vehicle record not found.");
    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
