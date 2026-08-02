import { redisCommand } from "./redis.js";
const INVALIDATION_CHANNEL = "zigo:cache:invalidate";
const CUSTOMER_CACHE_PREFIXES = ["customer:catalog", "customer:locations"];
const CUSTOMER_CACHE_MUTATION_PATHS = ["/masters", "/stores", "/settings", "/vehicle-master"];
export async function publishCustomerCacheInvalidation(prefix) {
    await redisCommand([
        "PUBLISH",
        INVALIDATION_CHANNEL,
        JSON.stringify({
            prefix,
            source: "zigo-admin",
            timestamp: new Date().toISOString()
        })
    ]);
}
export const customerCacheInvalidationMiddleware = (req, res, next) => {
    if (!shouldInvalidateCustomerCache(req.method, req.path)) {
        next();
        return;
    }
    res.once("finish", () => {
        if (res.statusCode >= 400)
            return;
        for (const prefix of CUSTOMER_CACHE_PREFIXES) {
            void publishCustomerCacheInvalidation(prefix);
        }
    });
    next();
};
function shouldInvalidateCustomerCache(method, path) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()))
        return false;
    return CUSTOMER_CACHE_MUTATION_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
