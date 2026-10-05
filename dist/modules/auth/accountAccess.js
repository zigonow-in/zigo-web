const blockedStatuses = new Set(['inactive', 'deactive', 'deactivated', 'disabled', 'suspended', 'blocked', 'deleted']);
function flag(value) {
    if (typeof value === 'string')
        return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
    return value === true || value === 1;
}
export function isAccountAccessBlocked(metadata, allowPendingOtp = false) {
    if (flag(metadata?.isAdminDeactivated) || flag(metadata?.isDeleted)
        || String(metadata?.deactivationSource || '').trim().toLowerCase() === 'admin')
        return true;
    const active = metadata?.isActive;
    if (active === false || active === 0 || (typeof active === 'string' && ['false', '0', 'no'].includes(active.trim().toLowerCase())))
        return true;
    const statuses = [metadata?.accountStatus, metadata?.verificationStatus].filter(Boolean).map(value => String(value).trim().toLowerCase());
    return statuses.some(status => blockedStatuses.has(status)
        && !(status === 'inactive' && allowPendingOtp && String(metadata?.otpVerificationStatus || '').toLowerCase() === 'pending'));
}
