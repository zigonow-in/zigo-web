import { Router } from "express";
import { z } from "zod";
import { assertCanAssignRole, assertCanManageUser, isAdmin, isSuperAdmin, requirePermission, requireSuperAdmin } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { assignPermissionToRole, assignPermissionToModule, assignRoleToUser, createModule, createPermission, createRole, deleteModule, deletePermission, deleteRole, getModuleById, getPermissionById, getRoleById, listModulePermissions, listModules, listPermissions, listRolePermissions, listRoles, listUserRoles, removePermissionFromModule, removePermissionFromRole, removeRoleFromUser, updateUserRole, updateModule, updateModuleStatus, updatePermission, updateRole } from "./access.repository.js";
export const accessRouter = Router();
const idParamsSchema = z.object({ id: z.string().uuid() });
const rolePermissionParamsSchema = z.object({
    roleId: z.string().uuid(),
    permissionId: z.string().uuid()
});
const modulePermissionParamsSchema = z.object({
    moduleId: z.string().uuid(),
    permissionId: z.string().uuid()
});
const moduleBodySchema = z.object({
    Name: z.string().trim().min(2).max(120),
    Description: z.string().trim().max(500).nullable().optional(),
    IsActive: z.coerce.boolean()
});
const moduleStatusBodySchema = z.object({
    IsActive: z.coerce.boolean()
});
const roleBodySchema = z.object({
    code: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional()
});
const permissionBodySchema = z.object({
    code: z.string().trim().min(2).max(120),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    module: z.string().trim().min(2).max(80)
});
const assignRoleBodySchema = z.object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    scopeType: z.string().trim().max(80).nullable().optional(),
    scopeId: z.string().uuid().nullable().optional(),
    isPrimary: z.coerce.boolean().default(false)
});
const userRolesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    userId: z.string().uuid().optional(),
    role: z.string().optional(),
    name: z.string().optional(),
    mobileNo: z.string().optional(),
    email: z.string().optional(),
    status: z.string().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional()
});
accessRouter.use("/modules", requireSuperAdmin);
accessRouter.use("/permissions", requireSuperAdmin);
accessRouter.use("/roles", requireSuperAdmin);
accessRouter.get("/modules", requirePermission("modules.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listModules() });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/modules/:id", requirePermission("modules.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const module = await getModuleById(id);
        if (!module)
            throw new HttpError(404, "Module not found");
        res.json({ data: module });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/modules", requirePermission("modules.create"), async (req, res, next) => {
    try {
        const body = moduleBodySchema.parse(req.body);
        res.status(201).json({
            data: await createModule({ ...body, userId: req.auth.sub })
        });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.put("/modules/:id", requirePermission("modules.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = moduleBodySchema.parse(req.body);
        const module = await updateModule(id, { ...body, userId: req.auth.sub });
        if (!module)
            throw new HttpError(404, "Module not found");
        res.json({ data: module });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/modules/:id", requirePermission("modules.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const module = await deleteModule(id, req.auth.sub);
        if (!module)
            throw new HttpError(404, "Module not found");
        res.json({ data: module });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.patch("/modules/:id/status", requirePermission("modules.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = moduleStatusBodySchema.parse(req.body);
        const module = await updateModuleStatus(id, { ...body, userId: req.auth.sub });
        if (!module)
            throw new HttpError(404, "Module not found");
        res.json({ data: module });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/roles", requirePermission("roles.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listRoles() });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/roles/:id", requirePermission("roles.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const role = await getRoleById(id);
        if (!role)
            throw new HttpError(404, "Role not found");
        res.json({ data: role });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/roles", requirePermission("roles.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createRole({ ...roleBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.put("/roles/:id", requirePermission("roles.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const role = await updateRole(id, { ...roleBodySchema.parse(req.body), userId: req.auth.sub });
        if (!role)
            throw new HttpError(404, "Role not found");
        res.json({ data: role });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/roles/:id", requirePermission("roles.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteRole(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Role not found or system role cannot be deleted");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/permissions", requirePermission("permissions.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listPermissions() });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/permissions/:id", requirePermission("permissions.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const permission = await getPermissionById(id);
        if (!permission)
            throw new HttpError(404, "Permission not found");
        res.json({ data: permission });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/permissions", requirePermission("permissions.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createPermission({ ...permissionBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.put("/permissions/:id", requirePermission("permissions.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const permission = await updatePermission(id, { ...permissionBodySchema.parse(req.body), userId: req.auth.sub });
        if (!permission)
            throw new HttpError(404, "Permission not found");
        res.json({ data: permission });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/permissions/:id", requirePermission("permissions.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deletePermission(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Permission not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/role-permissions", requirePermission("role_permissions.view"), async (req, res, next) => {
    try {
        const roleId = typeof req.query.roleId === "string" ? req.query.roleId : undefined;
        res.json({ data: await listRolePermissions(roleId) });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/roles/:roleId/permissions/:permissionId", requirePermission("role_permissions.create"), async (req, res, next) => {
    try {
        const params = rolePermissionParamsSchema.parse(req.params);
        await assignPermissionToRole(params.roleId, params.permissionId);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/roles/:roleId/permissions/:permissionId", requirePermission("role_permissions.delete"), async (req, res, next) => {
    try {
        const params = rolePermissionParamsSchema.parse(req.params);
        const deleted = await removePermissionFromRole(params.roleId, params.permissionId);
        if (!deleted)
            throw new HttpError(404, "Role permission not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/module-permissions", requirePermission("module_permissions.view"), async (req, res, next) => {
    try {
        const moduleId = typeof req.query.moduleId === "string" ? req.query.moduleId : undefined;
        res.json({ data: await listModulePermissions(moduleId) });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/modules/:moduleId/permissions/:permissionId", requirePermission("module_permissions.create"), async (req, res, next) => {
    try {
        const params = modulePermissionParamsSchema.parse(req.params);
        await assignPermissionToModule(params.moduleId, params.permissionId);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/modules/:moduleId/permissions/:permissionId", requirePermission("module_permissions.delete"), async (req, res, next) => {
    try {
        const params = modulePermissionParamsSchema.parse(req.params);
        const deleted = await removePermissionFromModule(params.moduleId, params.permissionId);
        if (!deleted)
            throw new HttpError(404, "Module permission not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
accessRouter.get("/user-roles", requirePermission("user_roles.view"), async (req, res, next) => {
    try {
        const query = userRolesQuerySchema.parse(req.query);
        res.json(await listUserRoles(query));
    }
    catch (error) {
        next(error);
    }
});
accessRouter.post("/user-roles", requirePermission("user_roles.create"), async (req, res, next) => {
    try {
        const body = assignRoleBodySchema.parse(req.body);
        await assertCanAssignRole(req, body.roleId, body.userId);
        res.status(201).json({ data: await assignRoleToUser({ ...body, actorUserId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.put("/user-roles/:id", requirePermission("user_roles.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = assignRoleBodySchema.omit({ userId: true }).parse(req.body);
        await assertCanAssignRole(req, body.roleId);
        const updated = await updateUserRole(id, { ...body, actorUserId: req.auth.sub });
        if (!updated)
            throw new HttpError(404, "User role not found");
        await assertCanManageUser(req, updated.userId);
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
accessRouter.delete("/user-roles/:id", requirePermission("user_roles.delete"), async (req, res, next) => {
    try {
        if (isAdmin(req) && !isSuperAdmin(req)) {
            throw new HttpError(403, "Admin cannot delete user-role mappings");
        }
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await removeRoleFromUser(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "User role not found");
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
