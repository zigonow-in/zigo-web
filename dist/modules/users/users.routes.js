import { Router } from "express";
import { z } from "zod";
import { assertCanAssignRole, assertCanManageUser, blockedRoleCodesForActor, isSuperAdmin, requirePermission } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { actorCanGrantPermission, assignPermissionToUser, createUser, getUserById, listAssignableRoles, listUserPermissions, listUsers, removePermissionFromUser, resetOwnPassword, resetUserPasswordWithSuperAdminConfirmation, resetAndShareUserPasswordWithSuperAdminConfirmation, sendUserOtpChallenge, setUserActiveState, softDeleteUser, updateOwnProfilePicture, updateUser, verifyUserOtpChallenge } from "./users.repository.js";
export const usersRouter = Router();
const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    includeDeleted: z.coerce.boolean().default(false),
    role: z.string().optional(),
    name: z.string().optional(),
    mobileNo: z.string().optional(),
    email: z.string().optional(),
    status: z.string().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional()
});
const userIdParamsSchema = z.object({
    id: z.string().uuid()
});
const userBodyBaseSchema = z.object({
    email: z.string().email().nullable().optional(),
    phone: z.string().min(6).max(20).nullable().optional(),
    password: z.string().min(8).nullable().optional(),
    displayName: z.string().min(2).max(120).nullable().optional(),
    isLoginWithOtp: z.coerce.boolean().optional(),
    isLoginWithPassword: z.coerce.boolean().optional(),
    profilePictureUrl: z.string().min(1, "Profile picture is required."),
    roleId: z.string().uuid("Role is required."),
    moduleIds: z.array(z.string().uuid()).optional(),
    isDocumentRequired: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    accountStatus: z
        .enum(["verifying", "verifying_document_processing", "rejected", "verified", "pending_document", "invalid_document", "active", "inactive"])
        .optional()
});
const createUserBodySchema = userBodyBaseSchema
    .refine((value) => value.email || value.phone, {
    message: "Email or phone is required"
});
const updateUserBodySchema = userBodyBaseSchema.omit({ moduleIds: true }).partial().required({ roleId: true });
const userPermissionParamsSchema = z.object({
    id: z.string().uuid(),
    permissionId: z.string().uuid()
});
const superAdminPasswordResetBodySchema = z.object({
    superAdminPassword: z.string().min(1, "Super Admin password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    channels: z.array(z.enum(["email"])).optional()
});
const ownProfilePictureBodySchema = z.object({
    profilePictureUrl: z.string().min(1, "Profile picture is required.")
});
const ownPasswordResetBodySchema = z.object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters.")
});
const otpSendBodySchema = z.object({
    channels: z.array(z.enum(["email", "mobile"])).min(1),
    email: z.string().email("Enter a valid email address.").optional()
});
const otpVerifyBodySchema = z.object({
    otp: z.string().regex(/^\d{6}$/, "Enter 6 digit verification code.").optional(),
    otps: z
        .object({
        email: z.string().regex(/^\d{6}$/, "Enter 6 digit Email verification code.").optional(),
        mobile: z.string().regex(/^\d{6}$/, "Enter 6 digit Mobile verification code.").optional()
    })
        .optional()
});
usersRouter.get("/me", async (req, res, next) => {
    try {
        const user = await getUserById(req.auth.sub);
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch("/me/profile-picture", async (req, res, next) => {
    try {
        const body = ownProfilePictureBodySchema.parse(req.body);
        const user = await updateOwnProfilePicture({ userId: req.auth.sub, profilePictureUrl: body.profilePictureUrl });
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch("/me/password", async (req, res, next) => {
    try {
        const body = ownPasswordResetBodySchema.parse(req.body);
        const user = await resetOwnPassword({ userId: req.auth.sub, currentPassword: body.currentPassword, newPassword: body.newPassword });
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.get("/", requirePermission("users.view"), async (req, res, next) => {
    try {
        const query = listUsersQuerySchema.parse(req.query);
        res.json(await listUsers({
            ...query,
            excludeRoleCodes: blockedRoleCodesForActor(req.auth?.roles)
        }));
    }
    catch (error) {
        next(error);
    }
});
usersRouter.get("/assignable-roles", requirePermission("users.view"), async (req, res, next) => {
    try {
        const excludeRoleCodes = isSuperAdmin(req) ? ["super_admin"] : blockedRoleCodesForActor(req.auth?.roles);
        res.json({ data: await listAssignableRoles({ excludeRoleCodes }) });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/", requirePermission("users.create"), async (req, res, next) => {
    try {
        const body = createUserBodySchema.parse(req.body);
        if (body.roleId)
            await assertCanAssignRole(req, body.roleId);
        const user = await createUser({ ...body, actorUserId: req.auth.sub });
        res.status(201).json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/:id/otp/send", requirePermission("users.create"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        const body = otpSendBodySchema.parse(req.body);
        res.status(201).json({ data: await sendUserOtpChallenge({ userId: params.id, channels: body.channels, email: body.email, actorUserId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/:id/otp/verify", requirePermission("users.create"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        const body = otpVerifyBodySchema.parse(req.body);
        res.json({ data: await verifyUserOtpChallenge({ userId: params.id, otp: body.otp, otps: body.otps, actorUserId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.put("/:id", requirePermission("users.edit"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const body = updateUserBodySchema.parse(req.body);
        if (body.roleId)
            await assertCanAssignRole(req, body.roleId, params.id);
        const user = await updateUser(params.id, { ...body, actorUserId: req.auth.sub });
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch("/:id/activate", requirePermission("users.activate"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const user = await setUserActiveState(params.id, true, req.auth.sub);
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch("/:id/deactivate", requirePermission("users.deactivate"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const user = await setUserActiveState(params.id, false, req.auth.sub);
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.delete("/:id", requirePermission("users.delete"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        if (!isSuperAdmin(req)) {
            throw new HttpError(403, "Only Super Admin can delete users");
        }
        await assertCanManageUser(req, params.id);
        const deleted = await softDeleteUser(params.id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "User not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/:id/password/reset-by-super-admin", requirePermission("users.edit"), async (req, res, next) => {
    try {
        if (!isSuperAdmin(req)) {
            throw new HttpError(403, "Only logged-in Super Admin can reset user passwords.");
        }
        const params = userIdParamsSchema.parse(req.params);
        const body = superAdminPasswordResetBodySchema.parse(req.body);
        const user = await resetUserPasswordWithSuperAdminConfirmation({
            targetUserId: params.id,
            superAdminUserId: req.auth.sub,
            superAdminPassword: body.superAdminPassword,
            newPassword: body.newPassword
        });
        if (!user)
            throw new HttpError(404, "User not found");
        res.json({ data: user });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/:id/password/share", requirePermission("users.edit"), async (req, res, next) => {
    try {
        if (!isSuperAdmin(req)) {
            throw new HttpError(403, "Only logged-in Super Admin can share user passwords.");
        }
        const params = userIdParamsSchema.parse(req.params);
        const body = superAdminPasswordResetBodySchema.parse(req.body);
        const result = await resetAndShareUserPasswordWithSuperAdminConfirmation({
            targetUserId: params.id,
            superAdminUserId: req.auth.sub,
            superAdminPassword: body.superAdminPassword,
            newPassword: body.newPassword,
            channels: body.channels
        });
        if (!result.user)
            throw new HttpError(404, "User not found");
        res.json({ data: result });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.get("/:id/permissions", requirePermission("users.view"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        res.json({ data: await listUserPermissions(params.id) });
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/:id/permissions/:permissionId", requirePermission("users.assign_permission"), async (req, res, next) => {
    try {
        const params = userPermissionParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const isSuperAdmin = req.auth?.roles.includes("super_admin") === true;
        const actorUserId = req.auth?.sub;
        if (!actorUserId)
            throw new HttpError(401, "Authorization token required");
        const canGrant = await actorCanGrantPermission(actorUserId, params.permissionId, isSuperAdmin);
        if (!canGrant)
            throw new HttpError(403, "Cannot assign a permission you do not have");
        await assignPermissionToUser(params.id, params.permissionId, actorUserId);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
usersRouter.delete("/:id/permissions/:permissionId", requirePermission("users.assign_permission"), async (req, res, next) => {
    try {
        const params = userPermissionParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const isSuperAdmin = req.auth?.roles.includes("super_admin") === true;
        const actorUserId = req.auth?.sub;
        if (!actorUserId)
            throw new HttpError(401, "Authorization token required");
        const canGrant = await actorCanGrantPermission(actorUserId, params.permissionId, isSuperAdmin);
        if (!canGrant)
            throw new HttpError(403, "Cannot remove a permission you do not have");
        const removed = await removePermissionFromUser(params.id, params.permissionId);
        if (!removed)
            throw new HttpError(404, "User permission not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
usersRouter.get("/:id", requirePermission("users.view"), async (req, res, next) => {
    try {
        const params = userIdParamsSchema.parse(req.params);
        await assertCanManageUser(req, params.id);
        const user = await getUserById(params.id);
        if (!user) {
            throw new HttpError(404, "User not found");
        }
        res.json({
            data: user
        });
    }
    catch (error) {
        next(error);
    }
});
