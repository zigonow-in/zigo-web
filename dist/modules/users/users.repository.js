import bcrypt from "bcryptjs";
import { isAccountAccessBlocked } from "../auth/accountAccess.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";
import crypto from "node:crypto";
import tls from "node:tls";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { getOtpProviderSettings } from "../settings/settings.repository.js";
const userProjection = `
  u.id,
  u.organization_id as "organizationId",
  u.phone,
  u.email::text as email,
  u.display_name as "displayName",
  u.avatar_file_id as "avatarFileId",
  u.status_id as "statusId",
  u.last_login_at as "lastLoginAt",
  u.metadata,
  coalesce(u.metadata->>'accountStatus', 'active') as "accountStatus",
  coalesce(u.metadata->>'otpVerificationStatus', 'not_required') as "otpVerificationStatus",
  u.metadata->'otpChannelStatus' as "otpChannelStatus",
  coalesce(array_remove(array_agg(distinct r.code), null), '{}') as roles,
  (
    select a.id
    from zigo.assistants a
    where a.user_id = u.id
    order by a.created_at desc
    limit 1
  ) as "assistantId",
  (u.password_hash is not null) as "hasPassword",
  coalesce(
    u.metadata->>'profilePictureUrl',
    (
      select f.object_key
      from zigo.assistants a
      join zigo.assistant_documents ad on ad.assistant_id = a.id
      join zigo.document_types dt on dt.id = ad.document_type_id
      left join zigo.files f on f.id = ad.file_id
      where a.user_id = u.id and dt.code in ('profile_picture', 'profile_photo')
      order by ad.created_at desc
      limit 1
    )
  ) as "profilePictureUrl",
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', f.original_name,
          'mimeType', f.mime_type,
          'previewUrl', f.object_key,
          'documentTypeCode', dt.code,
          'documentTypeName', dt.name
        )
        order by dt.code
      )
      from zigo.assistants a
      join zigo.assistant_documents ad on ad.assistant_id = a.id
      join zigo.document_types dt on dt.id = ad.document_type_id
      left join zigo.files f on f.id = ad.file_id
      where a.user_id = u.id and dt.code in ('aadhaar_front', 'aadhaar_back', 'aadhaar_card_front', 'aadhaar_card_back', 'aadhaar_card')
    ),
    '[]'::jsonb
  ) as "aadhaarDocuments",
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', f.original_name,
          'mimeType', f.mime_type,
          'previewUrl', f.object_key,
          'documentTypeCode', dt.code,
          'documentTypeName', dt.name
        )
        order by dt.code
      )
      from zigo.assistants a
      join zigo.assistant_documents ad on ad.assistant_id = a.id
      join zigo.document_types dt on dt.id = ad.document_type_id
      left join zigo.files f on f.id = ad.file_id
      where a.user_id = u.id and dt.code in ('pan_front', 'pan_back', 'pan_card_front', 'pan_card_back', 'pan_card')
    ),
    '[]'::jsonb
  ) as "panDocuments",
  u.created_at as "createdAt",
  u.updated_at as "updatedAt",
  u.deleted_at as "deletedAt"
`;
async function ensureCustomerProfileForUser(db, userId) {
    await db.query(`
      insert into zigo.customers (user_id, customer_code)
      values ($1::uuid, 'CUS-' || upper(replace($1::text, '-', '')))
      on conflict (user_id) do nothing
    `, [userId]);
}
function normalizeOtpChannels(value) {
    return [...new Set((value || []).filter((item) => item === "email" || item === "mobile"))];
}
function normalizeIndianPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.length === 10)
        return `+91${digits}`;
    return digits.startsWith("91") ? `+${digits}` : `+${digits}`;
}
function activeProvider(providers = []) {
    return providers.find((provider) => provider.isActive !== false) ?? providers[0] ?? null;
}
function templateValue(value, variables) {
    if (typeof value === "string") {
        return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => variables[key] ?? "");
    }
    if (Array.isArray(value))
        return value.map((item) => templateValue(item, variables));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, templateValue(item, variables)]));
    }
    return value;
}
function valueAtPath(root, pathValue) {
    const path = String(pathValue || "").trim();
    if (!path)
        return undefined;
    return path.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), root);
}
function providerSuccessMatches(value) {
    if (value === true || value === 1)
        return true;
    const text = String(value ?? "").trim().toLowerCase();
    return ["true", "1", "success", "sent", "ok", "queued", "accepted"].includes(text);
}
function otpDeliveryFailure(error) {
    return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unable to send verification code"
    };
}
function deliveryFailed(value) {
    const delivery = value;
    return delivery?.status === "failed" || delivery?.skipped === true;
}
function smtpSafeLine(value) {
    return value.replace(/[\r\n]+/g, " ").trim();
}
function smtpSafeBody(value) {
    return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}
function emailHtmlEscape(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function zigoEmailLogoMarkup(color = "#0b55df", width = 184) {
    const height = Math.round((width * 260) / 900);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 900 260" role="img" aria-label="ZIGO">
    <g fill="${color}">
      <text x="20" y="188" font-family="Arial Black, Impact, Arial, sans-serif" font-size="178" font-style="italic" font-weight="900" letter-spacing="-10">ZIG</text>
      <g transform="translate(700 30)">
        <path d="M93 0c54 0 93 39 93 90 0 67-93 162-93 162S0 157 0 90C0 39 39 0 93 0Z"/>
        <path fill="#ffffff" d="M49 95 77 124 139 54 157 75 78 166 31 113Z"/>
      </g>
    </g>
  </svg>`;
}
function zigoVerificationEmailHtml(otp) {
    const digits = String(otp || "").padEnd(6, " ").slice(0, 6).split("");
    const digitBoxes = digits
        .map((digit) => `<td style="padding:0 8px;"><div style="width:72px;height:64px;border:1px solid #cfe0ff;border-radius:10px;background:#ffffff;text-align:center;line-height:64px;font-size:34px;font-weight:900;color:#0b55df;">${emailHtmlEscape(digit)}</div></td>`)
        .join("");
    const logo = zigoEmailLogoMarkup("#0b55df", 184);
    const footerLogo = zigoEmailLogoMarkup("#ffffff", 146);
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ZIGO Verification Code</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#090b2f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:760px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.10);">
            <tr>
              <td style="padding:30px 34px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      ${logo}
                      <div style="font-size:14px;color:#090b2f;margin-top:4px;">Personal help in minutes</div>
                    </td>
                    <td align="right" style="font-size:14px;line-height:20px;color:#090b2f;">
                      <div>Need help?</div>
                      <a href="mailto:admin@zigonow.in" style="color:#0b55df;text-decoration:none;">admin@zigonow.in</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:54px 46px;background:#064cdf;background:linear-gradient(135deg,#073fd0 0%,#075cff 100%);border-radius:18px;color:#ffffff;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="54%" valign="middle">
                            <div style="font-size:52px;line-height:1.08;font-weight:950;letter-spacing:-1px;">Verify Your<br>Email</div>
                            <div style="font-size:18px;line-height:1.55;margin-top:20px;">Thanks for choosing ZIGO.<br>Please use the verification code below to verify your email address.</div>
                          </td>
                          <td align="center" valign="middle" style="padding-left:24px;">
                            <div style="width:220px;height:150px;border-radius:24px;background:#0b64ff;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.22),0 20px 36px rgba(0,0,0,0.18);position:relative;">
                              <div style="margin:0 auto;transform:translateY(-18px);width:154px;height:108px;border-radius:18px;background:#ffffff;box-shadow:0 18px 34px rgba(0,0,0,0.20);text-align:center;">
                                <div style="display:inline-block;margin-top:26px;width:56px;height:56px;border-radius:50%;background:#0b55df;color:#ffffff;font-size:36px;line-height:56px;font-weight:900;">✓</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 34px 26px;">
                <div style="font-size:24px;font-weight:900;margin:8px 0 22px;">Your Verification Code</div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                  <tr>${digitBoxes}</tr>
                </table>
                <div style="font-size:14px;color:#4d5875;margin-top:18px;">This code will expire in 10 minutes.</div>
                <div style="display:inline-block;margin-top:22px;padding:15px 52px;border-radius:8px;background:#0b55df;color:#ffffff;font-size:18px;font-weight:850;">Verify Email Address</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 34px 26px;">
                <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background:#eef5ff;border-radius:12px;">
                  <tr>
                    <td width="86" align="center" style="padding:18px 0;">
                      <div style="width:52px;height:52px;border-radius:16px;background:#0b55df;color:#ffffff;line-height:52px;font-size:28px;">🔒</div>
                    </td>
                    <td style="padding:18px 18px 18px 0;text-align:left;">
                      <div style="font-size:16px;font-weight:900;color:#090b2f;">Keep your account secure</div>
                      <div style="font-size:14px;line-height:1.45;color:#27324f;margin-top:4px;">Never share this code with anyone.<br>ZIGO will never ask for your code or password.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 34px 26px;">
                <div style="font-size:16px;color:#4d5875;margin-bottom:22px;">With ZIGO, get real help for real-world tasks.</div>
                <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:100%;">
                  <tr>
                    <td align="center" style="font-size:15px;font-weight:850;color:#090b2f;">Real Person<br>Real Help</td>
                    <td align="center" style="font-size:15px;font-weight:850;color:#090b2f;">Trusted &<br>Verified</td>
                    <td align="center" style="font-size:15px;font-weight:850;color:#090b2f;">Quick &<br>Reliable</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#064cdf;background:linear-gradient(135deg,#073fd0 0%,#075cff 100%);color:#ffffff;">
                  <tr>
                    <td style="padding:26px 44px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            ${footerLogo}
                            <div style="font-size:14px;margin-top:4px;">Personal help in minutes</div>
                          </td>
                          <td align="center" style="font-size:16px;font-weight:850;">Download the ZIGO App</td>
                          <td align="right" style="font-size:24px;font-weight:900;">f &nbsp; ◎ &nbsp; in</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 28px 22px;color:#5f6b86;font-size:13px;line-height:1.6;">
                © 2024 ZIGO. All rights reserved.<br>
                This is an automated email. Please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
function otpChannelLabel(channel) {
    return channel === "mobile" ? "Mobile" : "Email";
}
function overallOtpStatus(channelStatus, channels) {
    if (!channels.length)
        return "not_required";
    return channels.every((channel) => channelStatus[channel] === "verified") ? "verified" : "pending";
}
async function sendSmsOtp(phone, otp) {
    const settings = await getOtpProviderSettings();
    const provider = activeProvider(settings.smsProviders);
    if (!provider)
        return { skipped: true, reason: "SMS verification code provider is not configured." };
    if (!provider.url)
        return { skipped: true, reason: "SMS verification code URL is not configured." };
    const variables = { phoneNumber: phone, otp, appName: "ZIGO" };
    const headers = templateValue(provider.headers || {}, variables);
    const body = templateValue(provider.bodyTemplate || {}, variables);
    const response = await fetch(String(provider.url || ""), {
        method: String(provider.method || "POST").toUpperCase(),
        headers,
        body: ["GET", "HEAD"].includes(String(provider.method || "POST").toUpperCase()) ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    const successPath = String(provider.successPath || "").trim();
    const mappedSuccess = successPath ? valueAtPath(payload, successPath) : undefined;
    if (!response.ok || (successPath && !providerSuccessMatches(mappedSuccess)))
        throw new HttpError(502, `Failed to send mobile verification code. Provider response: ${JSON.stringify(payload)}`);
    return {
        providerId: provider.id,
        providerName: provider.name,
        messageId: valueAtPath(payload, provider.messageIdPath),
        response: payload
    };
}
async function sendSmsPassword(phone, password) {
    const settings = await getOtpProviderSettings();
    const provider = activeProvider(settings.smsProviders);
    if (!provider)
        return { skipped: true, reason: "SMS provider is not configured." };
    if (!provider.url)
        return { skipped: true, reason: "SMS URL is not configured." };
    if (!provider.passwordBodyTemplate) {
        return {
            skipped: true,
            reason: "Mobile password SMS is not configured. Current SMS provider supports verification codes only."
        };
    }
    const variables = { phoneNumber: phone, otp: password, password, appName: "ZIGO", message: `ZIGO Password: ${password}` };
    const headers = templateValue(provider.headers || {}, variables);
    const body = templateValue(provider.passwordBodyTemplate, variables);
    const response = await fetch(String(provider.url || ""), {
        method: String(provider.method || "POST").toUpperCase(),
        headers,
        body: ["GET", "HEAD"].includes(String(provider.method || "POST").toUpperCase()) ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    const successPath = String(provider.successPath || "").trim();
    const mappedSuccess = successPath ? valueAtPath(payload, successPath) : undefined;
    if (!response.ok || (successPath && !providerSuccessMatches(mappedSuccess)))
        throw new HttpError(502, `Failed to send mobile password. Provider response: ${JSON.stringify(payload)}`);
    return {
        providerId: provider.id,
        providerName: provider.name,
        messageId: valueAtPath(payload, provider.messageIdPath),
        response: payload,
        status: "sent"
    };
}
function smtpRead(socket) {
    return new Promise((resolve, reject) => {
        let output = "";
        const onData = (chunk) => {
            output += chunk.toString("utf8");
            const lines = output.trimEnd().split(/\r?\n/);
            const last = lines[lines.length - 1] || "";
            if (/^\d{3}\s/.test(last))
                cleanup(resolve, output);
        };
        const cleanup = (done, value) => {
            socket.off("data", onData);
            socket.off("error", reject);
            done(value);
        };
        socket.on("data", onData);
        socket.once("error", reject);
    });
}
async function smtpCommand(socket, command, expected) {
    socket.write(`${command}\r\n`);
    const response = await smtpRead(socket);
    const code = Number(response.slice(0, 3));
    if (!expected.includes(code))
        throw new HttpError(502, `Failed to send email. SMTP response: ${response.trim()}`);
    return response;
}
export async function sendTransactionalEmail(input) {
    const settings = await getOtpProviderSettings();
    const provider = activeProvider(settings.emailProviders);
    if (!provider?.host || !provider.user || !provider.password) {
        return { skipped: true, reason: "Email provider is not configured." };
    }
    const recipient = smtpSafeLine(input.to);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw new HttpError(400, "A valid recipient email address is required.");
    }
    const host = String(provider.host);
    const port = Number(provider.port || 465);
    const socket = tls.connect({ host, port, servername: host });
    socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP connection timed out.")));
    try {
        await new Promise((resolve, reject) => {
            socket.once("secureConnect", resolve);
            socket.once("error", reject);
        });
        await smtpRead(socket);
        await smtpCommand(socket, `EHLO ${host}`, [250]);
        await smtpCommand(socket, "AUTH LOGIN", [334]);
        await smtpCommand(socket, Buffer.from(String(provider.user)).toString("base64"), [334]);
        await smtpCommand(socket, Buffer.from(String(provider.password)).toString("base64"), [235]);
        const from = smtpSafeLine(String(provider.from || provider.user));
        const fromName = smtpSafeLine(input.fromName || "ZIGO");
        const subject = smtpSafeLine(input.subject);
        const isHtml = Boolean(input.html);
        const message = smtpSafeBody(String(input.html || input.text || ""));
        await smtpCommand(socket, `MAIL FROM:<${from}>`, [250]);
        await smtpCommand(socket, `RCPT TO:<${recipient}>`, [250, 251]);
        await smtpCommand(socket, "DATA", [354]);
        const body = [
            `From: ${fromName} <${from}>`,
            `To: ${recipient}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=UTF-8`,
            "",
            message,
            "."
        ].join("\r\n");
        await smtpCommand(socket, body, [250]);
        await smtpCommand(socket, "QUIT", [221]);
        return { providerId: provider.id, providerName: provider.name, from, status: "sent" };
    }
    finally {
        socket.destroy();
    }
}
export async function sendEmailOtp(email, otp) {
    const settings = await getOtpProviderSettings();
    const provider = activeProvider(settings.emailProviders);
    const variables = { otp, email, appName: "ZIGO" };
    return sendTransactionalEmail({
        to: email,
        subject: String(templateValue(provider?.subjectTemplate || "ZIGO Verification Code", variables)),
        html: zigoVerificationEmailHtml(otp)
    });
}
async function sendEmailPassword(email, password) {
    return sendTransactionalEmail({
        to: email,
        subject: "ZIGO Password",
        text: `Your ZIGO password is: ${password}\n\nPlease keep it secure.`
    });
}
function toUserWriteError(error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        const detail = String(error.detail || "").toLowerCase();
        if (detail.includes("email"))
            return new HttpError(409, "Email already exists for this role. Please use another email or select a different role.");
        if (detail.includes("phone"))
            return new HttpError(409, "Mobile number already exists for this role. Please use another mobile number or select a different role.");
        if (detail.includes("assistant_code"))
            return new HttpError(409, "Assistant code already exists. Please try again.");
        return new HttpError(409, "A user with the same unique details already exists.");
    }
    return error;
}
let userContactRoleScopeReady = null;
async function ensureUserContactRoleScopeSchema() {
    if (!userContactRoleScopeReady) {
        userContactRoleScopeReady = (async () => {
            await pool.query("select pg_advisory_lock(hashtext('zigo_user_contact_role_scope'))");
            try {
                const constraints = await pool.query(`
            select conname as "constraintName"
            from pg_constraint
            where conrelid = 'zigo.users'::regclass
              and contype = 'u'
              and (
                lower(pg_get_constraintdef(oid)) like '%email%'
                or lower(pg_get_constraintdef(oid)) like '%phone%'
              )
          `);
                for (const row of constraints.rows) {
                    await pool.query(`alter table zigo.users drop constraint if exists ${quoteIdentifier(row.constraintName)}`);
                }
                const indexes = await pool.query(`
            select indexname as "indexName"
            from pg_indexes
            where schemaname = 'zigo'
              and tablename = 'users'
              and lower(indexdef) like 'create unique index%'
              and (
                lower(indexdef) like '%email%'
                or lower(indexdef) like '%phone%'
              )
          `);
                for (const row of indexes.rows) {
                    await pool.query(`drop index if exists zigo.${quoteIdentifier(row.indexName)}`);
                }
                await pool.query(`
          create index if not exists idx_users_email_lookup on zigo.users(lower(email::text)) where deleted_at is null and email is not null;
          create index if not exists idx_users_phone_lookup on zigo.users(phone) where deleted_at is null and phone is not null;
          create index if not exists idx_user_roles_role_active on zigo.user_roles(role_id, is_deleted, is_active);
        `);
            }
            finally {
                await pool.query("select pg_advisory_unlock(hashtext('zigo_user_contact_role_scope'))");
            }
        })().catch((error) => {
            userContactRoleScopeReady = null;
            throw error;
        });
    }
    await userContactRoleScopeReady;
}
function quoteIdentifier(value) {
    return `"${value.replace(/"/g, '""')}"`;
}
async function activeRoleIdsForUser(client, userId) {
    const result = await client.query(`
      select role_id as "roleId"
      from zigo.user_roles
      where user_id = $1
        and coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
    `, [userId]);
    return result.rows.map((row) => row.roleId);
}
async function assertContactAvailableForRoles(client, input) {
    const roleIds = input.roleIds.filter(Boolean);
    if (!roleIds.length)
        return;
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;
    if (!email && !phone)
        return;
    for (const roleId of roleIds) {
        if (email)
            await client.query("select pg_advisory_xact_lock(hashtext($1))", [`zigo:user-email-role:${roleId}:${email.toLowerCase()}`]);
        if (phone)
            await client.query("select pg_advisory_xact_lock(hashtext($1))", [`zigo:user-phone-role:${roleId}:${phone}`]);
    }
    const result = await client.query(`
      select
        bool_or($1::text is not null and lower(u.email::text) = lower($1)) as "emailConflict",
        bool_or($2::text is not null and u.phone = $2) as "phoneConflict"
      from zigo.users u
      join zigo.user_roles ur on ur.user_id = u.id
      where u.deleted_at is null
        and coalesce(ur.is_deleted, false) = false
        and coalesce(ur.is_active, true) = true
        and ur.role_id = any($3::uuid[])
        and ($4::uuid is null or u.id <> $4)
        and (
          ($1::text is not null and lower(u.email::text) = lower($1))
          or ($2::text is not null and u.phone = $2)
        )
    `, [email, phone, roleIds, input.excludeUserId ?? null]);
    const conflict = result.rows[0];
    if (conflict?.emailConflict) {
        throw new HttpError(409, "Email already exists for this role. Please use another email or select a different role.");
    }
    if (conflict?.phoneConflict) {
        throw new HttpError(409, "Mobile number already exists for this role. Please use another mobile number or select a different role.");
    }
}
async function releaseDeletedUserContactIdentifiers(client, input) {
    const email = input.email?.trim();
    if (email) {
        await client.query(`
        update zigo.users
        set metadata = jsonb_set(metadata, '{deletedOriginalEmail}', to_jsonb(email::text), true),
            email = (replace(id::text, '-', '') || '@deleted.zigo.local')::citext,
            updated_at = now()
        where deleted_at is not null
          and email is not null
          and lower(email::text) = lower($1)
      `, [email]);
    }
    const phone = input.phone?.trim();
    if (phone) {
        await client.query(`
        update zigo.users
        set metadata = jsonb_set(metadata, '{deletedOriginalPhone}', to_jsonb(phone::text), true),
            phone = 'deleted-' || replace(id::text, '-', ''),
            updated_at = now()
        where deleted_at is not null
          and phone = $1
      `, [phone]);
    }
}
function isSuperAdminUserSummary(user) {
    return user?.roles?.includes("super_admin") === true;
}
function buildUserFilters(filters) {
    const conditions = ["($1::boolean = true or u.deleted_at is null)"];
    const values = [filters.includeDeleted === true];
    const add = (condition, value) => {
        values.push(value);
        conditions.push(condition.replace("?", `$${values.length}`));
    };
    if (filters.role)
        add("exists (select 1 from zigo.user_roles ur2 join zigo.roles r2 on r2.id = ur2.role_id where ur2.user_id = u.id and coalesce(ur2.is_deleted, false) = false and r2.code = ?)", filters.role);
    if (filters.name)
        add("u.display_name ilike '%' || ? || '%'", filters.name);
    if (filters.mobileNo)
        add("u.phone ilike '%' || ? || '%'", filters.mobileNo);
    if (filters.email)
        add("u.email::text ilike '%' || ? || '%'", filters.email);
    if (filters.status)
        add("coalesce(u.metadata->>'accountStatus', 'active') = ?", filters.status);
    if (filters.createdFrom)
        add("u.created_at >= ?::timestamptz", filters.createdFrom);
    if (filters.createdTo)
        add("u.created_at <= ?::timestamptz", filters.createdTo);
    if (filters.excludeRoleCodes?.length) {
        values.push(filters.excludeRoleCodes);
        conditions.push(`
      not exists (
        select 1
        from zigo.user_roles ur3
        join zigo.roles r3 on r3.id = ur3.role_id
        where ur3.user_id = u.id
          and coalesce(ur3.is_deleted, false) = false
          and coalesce(ur3.is_active, true) = true
          and r3.code = any($${values.length}::text[])
      )
    `);
    }
    return { where: conditions.join(" and "), values };
}
export async function listUsers(filters) {
    const { where, values } = buildUserFilters(filters);
    const count = await pool.query(`select count(*) as total from zigo.users u where ${where}`, values);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const result = await pool.query(`
      select ${userProjection}
      from zigo.users u
      left join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false
      left join zigo.roles r on r.id = ur.role_id and coalesce(r.is_deleted, false) = false
      where ${where}
      group by u.id
      order by u.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `, [...values, filters.pageSize, (filters.page - 1) * filters.pageSize]);
    const totalRecords = Number(count.rows[0]?.total ?? 0);
    return {
        data: result.rows,
        pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            totalRecords,
            totalPages: Math.ceil(totalRecords / filters.pageSize)
        }
    };
}
export async function getUserById(id) {
    const result = await pool.query(`
      select ${userProjection}
      from zigo.users u
      left join zigo.user_roles ur on ur.user_id = u.id and coalesce(ur.is_deleted, false) = false
      left join zigo.roles r on r.id = ur.role_id and coalesce(r.is_deleted, false) = false
      where u.deleted_at is null and u.id = $1
      group by u.id
      limit 1
    `, [id]);
    return result.rows[0] ?? null;
}
export async function setUserActiveState(id, isActive, actorUserId) {
    const current = await getUserById(id);
    if (!current)
        return null;
    if (isSuperAdminUserSummary(current)) {
        throw new HttpError(403, "Super Admin account cannot be activated or deactivated.");
    }
    const result = await pool.query(`
      update zigo.users
      set metadata = case
            when $2::boolean then
              (coalesce(metadata, '{}'::jsonb)
                - 'isAdminDeactivated'
                - 'deactivationSource'
                - 'deactivatedAt'
                - 'deactivatedBy')
              || jsonb_build_object(
                'accountStatus', 'active',
                'isActive', true,
                'reactivatedAt', now()::text
              )
            else
              coalesce(metadata, '{}'::jsonb)
              || jsonb_build_object(
                'accountStatus', 'inactive',
                'isActive', false,
                'isAdminDeactivated', true,
                'deactivationSource', 'admin',
                'deactivatedAt', now()::text,
                'deactivatedBy', $3::uuid::text
              )
          end,
          updated_by = $3::uuid,
          updated_at = now()
      where id = $1 and deleted_at is null
      returning id
    `, [id, isActive, actorUserId]);
    if (result.rows[0] && !isActive) {
        await emitBookingRealtimeEvent({ type: 'user.session.revoked', payload: { userId: id }, message: 'Account access ended.' }).catch(error => console.warn('Account revocation notification failed', error));
        const assistant = await pool.query("select id as \"assistantId\" from zigo.assistants where user_id = $1 limit 1", [id]);
        if (!assistant.rows[0])
            return getUserById(id);
        await pool.query(`
        update zigo.users u
        set metadata = jsonb_set(coalesce(u.metadata, '{}'::jsonb), '{isLoggedIn}', 'false'::jsonb, true),
            updated_by = $2,
            updated_at = now()
        where u.id = $1
          and u.deleted_at is null
      `, [id, actorUserId]);
        await pool.query(`
        insert into zigo.assistant_availability
          (assistant_id, status_code, online_started_at, today_online_seconds, today_online_date, updated_at)
        values ($1, 'offline', null, 0, current_date, now())
        on conflict (assistant_id)
        do update set
          status_code = 'offline',
          today_online_seconds = case
            when zigo.assistant_availability.today_online_date = current_date
              and zigo.assistant_availability.status_code in ('available', 'online', 'active', 'working')
              and coalesce(zigo.assistant_availability.online_started_at, zigo.assistant_availability.updated_at) is not null
            then zigo.assistant_availability.today_online_seconds + greatest(0, extract(epoch from (now() - coalesce(zigo.assistant_availability.online_started_at, zigo.assistant_availability.updated_at)))::int)
            when zigo.assistant_availability.today_online_date = current_date
            then zigo.assistant_availability.today_online_seconds
            else 0
          end,
          today_online_date = current_date,
          online_started_at = null,
          updated_at = now()
      `, [assistant.rows[0].assistantId]);
    }
    return result.rows[0] ? getUserById(id) : null;
}
export async function updateOwnProfilePicture(input) {
    const result = await pool.query(`
      update zigo.users
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{profilePictureUrl}', to_jsonb($2::text), true),
          updated_by = $1,
          updated_at = now()
      where id = $1 and deleted_at is null
      returning id
    `, [input.userId, input.profilePictureUrl]);
    return result.rows[0] ? getUserById(input.userId) : null;
}
export async function resetOwnPassword(input) {
    const user = await pool.query("select password_hash as \"passwordHash\" from zigo.users where id = $1 and deleted_at is null limit 1", [input.userId]);
    if (!user.rows[0]?.passwordHash)
        throw new HttpError(401, "Current password verification failed.");
    const passwordMatches = await bcrypt.compare(input.currentPassword, user.rows[0].passwordHash);
    if (!passwordMatches)
        throw new HttpError(401, "Current password verification failed.");
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const result = await pool.query(`
      update zigo.users
      set password_hash = $2,
          metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{passwordResetAt}', to_jsonb(now()::text), true),
          updated_by = $1,
          updated_at = now()
      where id = $1 and deleted_at is null
      returning id
    `, [input.userId, passwordHash]);
    return result.rows[0] ? getUserById(input.userId) : null;
}
export async function sendUserOtpChallenge(input) {
    const channels = normalizeOtpChannels(input.channels);
    if (!channels.length)
        throw new HttpError(400, "Select Email or Mobile Number for verification code.");
    const user = await getUserById(input.userId);
    if (!user)
        throw new HttpError(404, "User not found");
    if (isAccountAccessBlocked({ ...user.metadata, accountStatus: user.accountStatus, otpVerificationStatus: user.otpVerificationStatus }, true))
        throw new HttpError(403, "User account is deactive. Contact admin.");
    const requestedEmail = input.email?.trim().toLowerCase();
    const emailForVerification = requestedEmail || user.email;
    if (channels.includes("email") && !emailForVerification)
        throw new HttpError(400, "Email is required to send email verification code.");
    if (channels.includes("mobile") && !user.phone)
        throw new HttpError(400, "Mobile number is required to send mobile verification code.");
    if (channels.includes("email") && requestedEmail && requestedEmail !== user.email) {
        const roleIds = await activeRoleIdsForUser(pool, input.userId);
        const emailConflict = await pool.query(`
        select u.id
        from zigo.users u
        join zigo.user_roles ur on ur.user_id = u.id
        where u.deleted_at is null
          and coalesce(ur.is_deleted, false) = false
          and coalesce(ur.is_active, true) = true
          and u.id <> $1
          and lower(u.email::text) = lower($2)
          and ur.role_id = any($3::uuid[])
        limit 1
      `, [input.userId, requestedEmail, roleIds]);
        if (emailConflict.rows[0])
            throw new HttpError(409, "Email already exists with another user in the same role. Please enter a different email.");
        await pool.query(`
        update zigo.users
        set email = $2,
            updated_by = $3,
            updated_at = now()
        where id = $1 and deleted_at is null
      `, [input.userId, requestedEmail, input.actorUserId]);
        user.email = requestedEmail;
    }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const deliveries = {};
    const existingChannels = normalizeOtpChannels(user.metadata?.otpVerifyChannels);
    const allChannels = normalizeOtpChannels([...existingChannels, ...channels]);
    const existingChallenges = (user.metadata?.otpChallenge || {}) || {};
    const challenges = { ...existingChallenges };
    const channelStatus = { ...(user.otpChannelStatus || user.metadata?.otpChannelStatus || {}) };
    channels.forEach((channel) => {
        channelStatus[channel] = "pending";
    });
    allChannels.forEach((channel) => {
        if (!channelStatus[channel])
            channelStatus[channel] = "pending";
    });
    if (channels.includes("mobile")) {
        const otp = crypto.randomInt(100000, 1000000).toString();
        challenges.mobile = { codeHash: await bcrypt.hash(otp, 10), expiresAt, sentAt: new Date().toISOString() };
        try {
            deliveries.mobile = await sendSmsOtp(normalizeIndianPhone(user.phone), otp);
        }
        catch (error) {
            deliveries.mobile = otpDeliveryFailure(error);
        }
    }
    if (channels.includes("email")) {
        const otp = crypto.randomInt(100000, 1000000).toString();
        challenges.email = { codeHash: await bcrypt.hash(otp, 10), expiresAt, sentAt: new Date().toISOString() };
        try {
            deliveries.email = await sendEmailOtp(emailForVerification, otp);
        }
        catch (error) {
            deliveries.email = otpDeliveryFailure(error);
        }
    }
    const savedChallenge = await pool.query(`
      update zigo.users
      set metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'accountStatus', 'inactive',
              'otpVerificationStatus', 'pending',
              'otpVerifyChannels', $2::jsonb,
              'otpChannelStatus', $3::jsonb,
              'otpChallenge', $4::jsonb,
              'otpChallengeDeliveries', $5::jsonb,
              'otpChallengeCreatedBy', $6::text,
              'otpChallengeSentAt', now()::text
            ),
          updated_by = $6::uuid,
          updated_at = now()
      where id = $1 and deleted_at is null and coalesce(metadata, '{}'::jsonb) = $7::jsonb
      returning id
    `, [input.userId, JSON.stringify(allChannels), JSON.stringify(channelStatus), JSON.stringify(challenges), JSON.stringify(deliveries), input.actorUserId, JSON.stringify(user.metadata || {})]);
    if (!savedChallenge.rows.length)
        throw new HttpError(409, "Account changed while sending verification code. Please retry.");
    return {
        userId: input.userId,
        channels: allChannels,
        sentChannels: channels,
        status: "pending",
        expiresAt,
        deliveries,
        channelStatus,
        sendWarning: Object.values(deliveries).some((delivery) => {
            const value = delivery;
            return value.status === "failed" || value.skipped === true;
        })
    };
}
export async function verifyUserOtpChallenge(input) {
    const user = await getUserById(input.userId);
    if (!user)
        throw new HttpError(404, "User not found");
    if (isAccountAccessBlocked({ ...user.metadata, accountStatus: user.accountStatus, otpVerificationStatus: user.otpVerificationStatus }, true))
        throw new HttpError(403, "User account is deactive. Contact admin.");
    const channels = normalizeOtpChannels(user.metadata?.otpVerifyChannels);
    const challenge = (user.metadata?.otpChallenge || {});
    const existingStatus = { ...(user.otpChannelStatus || user.metadata?.otpChannelStatus || {}) };
    const provided = {
        ...(input.otp ? Object.fromEntries(channels.map((channel) => [channel, input.otp])) : {}),
        ...(input.otps || {})
    };
    const providedChannels = normalizeOtpChannels(Object.entries(provided).filter(([, value]) => Boolean(value)).map(([channel]) => channel));
    if (!providedChannels.length)
        throw new HttpError(400, "Enter verification code for Email or Mobile Number.");
    const remainingChallenge = { ...challenge };
    for (const channel of providedChannels) {
        const channelChallenge = challenge[channel] || (channel === channels[0] ? challenge : undefined);
        if (!channelChallenge?.codeHash || !channelChallenge.expiresAt)
            throw new HttpError(400, `${otpChannelLabel(channel)} verification code is not pending.`);
        if (new Date(channelChallenge.expiresAt).getTime() < Date.now())
            throw new HttpError(400, `${otpChannelLabel(channel)} verification code expired. Send code again.`);
        const matched = await bcrypt.compare(provided[channel] || "", channelChallenge.codeHash);
        if (!matched)
            throw new HttpError(400, `Invalid ${otpChannelLabel(channel)} verification code.`);
        existingStatus[channel] = "verified";
        delete remainingChallenge[channel];
    }
    for (const channel of channels) {
        if (!existingStatus[channel])
            existingStatus[channel] = "pending";
    }
    const otpVerificationStatus = overallOtpStatus(existingStatus, channels);
    const accountStatus = otpVerificationStatus === "verified" ? "active" : "inactive";
    const verified = await pool.query(`
      update zigo.users
      set metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'accountStatus', $2::text,
              'otpVerificationStatus', $3::text,
              'otpChannelStatus', $4::jsonb,
              'otpChallenge', $5::jsonb,
              'otpVerifiedAt', now()::text,
              'otpVerifiedBy', $6::text
            ),
          updated_by = $6::uuid,
          updated_at = now()
      where id = $1 and deleted_at is null and coalesce(metadata, '{}'::jsonb) = $7::jsonb
      returning id
    `, [input.userId, accountStatus, otpVerificationStatus, JSON.stringify(existingStatus), JSON.stringify(remainingChallenge), input.actorUserId, JSON.stringify(user.metadata || {})]);
    if (!verified.rows.length)
        throw new HttpError(409, "Account changed during verification. Please request a new code.");
    return getUserById(input.userId);
}
export async function softDeleteUser(id, actorUserId) {
    const current = await getUserById(id);
    if (!current)
        return false;
    if (isSuperAdminUserSummary(current)) {
        throw new HttpError(403, "Super Admin account cannot be deleted.");
    }
    const result = await pool.query(`
      update zigo.users
      set deleted_at = now(),
          deleted_by = $2,
          metadata = jsonb_set(metadata, '{accountStatus}', '"deleted"'::jsonb, true),
          updated_by = $2,
          updated_at = now()
      where id = $1 and deleted_at is null
    `, [id, actorUserId]);
    if (result.rowCount)
        await emitBookingRealtimeEvent({ type: 'user.session.revoked', payload: { userId: id }, message: 'Account access ended.' }).catch(error => console.warn('Account revocation notification failed', error));
    return (result.rowCount ?? 0) > 0;
}
export async function createUser(input) {
    await ensureUserContactRoleScopeSchema();
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
    const metadata = {
        accountStatus: input.accountStatus ?? "verifying",
        isLoginWithOtp: input.isLoginWithOtp ?? false,
        isLoginWithPassword: input.isLoginWithPassword ?? false,
        profilePictureUrl: input.profilePictureUrl ?? null,
        isDocumentRequired: input.isDocumentRequired ?? false,
        isActive: input.isActive ?? true
    };
    const client = await pool.connect();
    try {
        await client.query("begin");
        await releaseDeletedUserContactIdentifiers(client, { email: input.email, phone: input.phone });
        await assertContactAvailableForRoles(client, {
            email: input.email,
            phone: input.phone,
            roleIds: input.roleId ? [input.roleId] : []
        });
        const result = await client.query(`
        insert into zigo.users (email, phone, password_hash, display_name, metadata, created_by, updated_by)
        values ($1, $2, $3, $4, $5::jsonb, $6, $6)
        returning id
      `, [input.email ?? null, input.phone ?? null, passwordHash, input.displayName ?? null, JSON.stringify(metadata), input.actorUserId]);
        let assignedRoleCode = null;
        if (input.roleId) {
            const role = await client.query("select code from zigo.roles where id = $1 and coalesce(is_deleted, false) = false limit 1", [input.roleId]);
            assignedRoleCode = role.rows[0]?.code ?? null;
            await client.query("insert into zigo.user_roles (user_id, role_id, created_by, is_primary) values ($1, $2, $3, true)", [result.rows[0].id, input.roleId, input.actorUserId]);
        }
        for (const moduleId of input.moduleIds ?? []) {
            await client.query("insert into zigo.user_modules (user_id, module_id) values ($1, $2) on conflict do nothing", [
                result.rows[0].id,
                moduleId
            ]);
        }
        let assistantId = null;
        if (assignedRoleCode === "assistant") {
            const assistantCode = `AST-${result.rows[0].id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
            const assistant = await client.query(`
          insert into zigo.assistants (user_id, assistant_code, metadata)
          values ($1, $2, jsonb_build_object('verificationStatus', $3::text))
          returning id
        `, [result.rows[0].id, assistantCode, input.accountStatus ?? "verifying"]);
            assistantId = assistant.rows[0].id;
        }
        if (assignedRoleCode === "customer") {
            await ensureCustomerProfileForUser(client, result.rows[0].id);
        }
        await client.query("commit");
        const user = await getUserById(result.rows[0].id);
        return user ? { ...user, assistantId } : null;
    }
    catch (error) {
        await client.query("rollback");
        throw toUserWriteError(error);
    }
    finally {
        client.release();
    }
}
export async function updateUser(id, input) {
    await ensureUserContactRoleScopeSchema();
    const current = await getUserById(id);
    if (!current)
        return null;
    if (isSuperAdminUserSummary(current)) {
        const requestedStatus = input.accountStatus ?? current.accountStatus;
        const requestedOtp = input.isLoginWithOtp ?? Boolean(current.metadata?.isLoginWithOtp);
        const requestedPassword = input.isLoginWithPassword ?? Boolean(current.metadata?.isLoginWithPassword);
        if (requestedStatus !== current.accountStatus ||
            requestedOtp !== Boolean(current.metadata?.isLoginWithOtp) ||
            requestedPassword !== Boolean(current.metadata?.isLoginWithPassword)) {
            throw new HttpError(403, "Super Admin status and login method cannot be changed.");
        }
    }
    if (isSuperAdminUserSummary(current) && input.roleId) {
        throw new HttpError(403, "Super Admin role cannot be changed.");
    }
    const metadata = {
        ...current.metadata,
        accountStatus: input.accountStatus ?? current.accountStatus,
        isLoginWithOtp: input.isLoginWithOtp ?? Boolean(current.metadata?.isLoginWithOtp),
        isLoginWithPassword: input.isLoginWithPassword ?? Boolean(current.metadata?.isLoginWithPassword),
        profilePictureUrl: input.profilePictureUrl ?? current.metadata?.profilePictureUrl ?? null,
        isDocumentRequired: input.isDocumentRequired ?? Boolean(current.metadata?.isDocumentRequired),
        isActive: input.isActive ?? Boolean(current.metadata?.isActive ?? current.accountStatus !== "inactive")
    };
    const requestedActiveState = typeof input.isActive === "boolean"
        ? input.isActive
        : input.accountStatus
            ? !["inactive", "deactive", "deactivated", "deleted", "blocked"].includes(input.accountStatus.toLowerCase())
            : undefined;
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
    const client = await pool.connect();
    try {
        await client.query("begin");
        const roleIdsForContactCheck = input.roleId ? [input.roleId] : await activeRoleIdsForUser(client, id);
        await assertContactAvailableForRoles(client, {
            email: input.email,
            phone: input.phone,
            roleIds: roleIdsForContactCheck,
            excludeUserId: id
        });
        const result = await client.query(`
        update zigo.users
        set email = $2,
            phone = $3,
            password_hash = coalesce($4, password_hash),
            display_name = $5,
            metadata = $6::jsonb,
            updated_by = $7,
            updated_at = now()
        where id = $1 and deleted_at is null
        returning id
      `, [
            id,
            input.email ?? null,
            input.phone ?? null,
            passwordHash,
            input.displayName ?? null,
            JSON.stringify(metadata),
            input.actorUserId
        ]);
        if (result.rows[0] && input.roleId) {
            const role = await client.query("select code from zigo.roles where id = $1 and coalesce(is_deleted, false) = false limit 1", [input.roleId]);
            await client.query(`
          update zigo.user_roles
          set is_active = false,
              is_deleted = true,
              deleted_by = $2,
              deleted_at = now(),
              updated_by = $2,
              updated_at = now()
          where user_id = $1
            and coalesce(is_deleted, false) = false
        `, [id, input.actorUserId]);
            const reactivatedRole = await client.query(`
          update zigo.user_roles
          set is_active = true,
              is_deleted = false,
              is_primary = true,
              deleted_by = null,
              deleted_at = null,
              updated_by = $3,
              updated_at = now()
          where user_id = $1
            and role_id = $2
        `, [id, input.roleId, input.actorUserId]);
            if (!reactivatedRole.rowCount) {
                await client.query(`
            insert into zigo.user_roles (user_id, role_id, created_by, updated_by, is_primary, is_active, is_deleted)
            values ($1, $2, $3, $3, true, true, false)
          `, [id, input.roleId, input.actorUserId]);
            }
            if (role.rows[0]?.code === "assistant") {
                const existingAssistant = await client.query("select id from zigo.assistants where user_id = $1 limit 1", [id]);
                if (!existingAssistant.rows[0]) {
                    const assistantCode = `AST-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
                    await client.query(`
              insert into zigo.assistants (user_id, assistant_code, metadata)
              values ($1, $2, jsonb_build_object('verificationStatus', $3::text))
            `, [id, assistantCode, input.accountStatus ?? "verifying"]);
                }
            }
            if (role.rows[0]?.code === "customer") {
                await ensureCustomerProfileForUser(client, id);
            }
        }
        await client.query("commit");
        if (result.rows[0] && typeof requestedActiveState === "boolean" && !isSuperAdminUserSummary(current)) {
            await setUserActiveState(id, requestedActiveState, input.actorUserId);
        }
        return result.rows[0] ? getUserById(id) : null;
    }
    catch (error) {
        await client.query("rollback");
        throw toUserWriteError(error);
    }
    finally {
        client.release();
    }
}
export async function resetUserPasswordWithSuperAdminConfirmation(input) {
    const target = await getUserById(input.targetUserId);
    if (!target)
        return null;
    const actor = await pool.query("select password_hash as \"passwordHash\" from zigo.users where id = $1 and deleted_at is null limit 1", [input.superAdminUserId]);
    if (!actor.rows[0]?.passwordHash) {
        throw new HttpError(401, "Super Admin password verification failed.");
    }
    const passwordMatches = await bcrypt.compare(input.superAdminPassword, actor.rows[0].passwordHash);
    if (!passwordMatches) {
        throw new HttpError(401, "Super Admin password verification failed.");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const result = await pool.query(`
      update zigo.users
      set password_hash = $2,
          metadata = jsonb_set(metadata, '{passwordResetBySuperAdminAt}', to_jsonb(now()::text), true),
          updated_by = $3,
          updated_at = now()
      where id = $1 and deleted_at is null
      returning id
    `, [input.targetUserId, passwordHash, input.superAdminUserId]);
    return result.rows[0] ? getUserById(input.targetUserId) : null;
}
export async function resetAndShareUserPasswordWithSuperAdminConfirmation(input) {
    const requestedChannels = input.channels?.length ? input.channels : ["email"];
    if (!requestedChannels.includes("email"))
        throw new HttpError(400, "Select Email to share password.");
    const targetUser = await getUserById(input.targetUserId);
    if (!targetUser)
        return { user: null, deliveries: {} };
    if (!targetUser.email)
        throw new HttpError(400, "Email is required to share password.");
    const channelStatus = (targetUser.otpChannelStatus || targetUser.metadata?.otpChannelStatus || {});
    if (channelStatus.email !== "verified")
        throw new HttpError(400, "Email must be verified before sharing password.");
    const user = await resetUserPasswordWithSuperAdminConfirmation(input);
    if (!user)
        return { user: null, deliveries: {} };
    const deliveries = {};
    if (user.email) {
        try {
            deliveries.email = await sendEmailPassword(user.email, input.newPassword);
        }
        catch (error) {
            deliveries.email = otpDeliveryFailure(error);
        }
    }
    await pool.query(`
      update zigo.users
      set metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'passwordSharedAt', now()::text,
              'passwordShareDeliveries', $2::jsonb
            ),
          updated_by = $3,
          updated_at = now()
      where id = $1 and deleted_at is null
    `, [user.id, JSON.stringify(deliveries), input.superAdminUserId]);
    return { user, deliveries, sendWarning: Object.values(deliveries).some(deliveryFailed) };
}
export async function actorCanGrantPermission(actorUserId, permissionId, isSuperAdmin) {
    if (isSuperAdmin)
        return true;
    const result = await pool.query(`
      select exists (
        select 1
        from zigo.user_roles ur
        join zigo.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = $1
          and rp.permission_id = $2
          and coalesce(ur.is_deleted, false) = false
        union
        select 1
        from zigo.user_permissions up
        where up.user_id = $1 and up.permission_id = $2
      ) as allowed
    `, [actorUserId, permissionId]);
    return result.rows[0]?.allowed === true;
}
export async function listUserPermissions(userId) {
    const result = await pool.query(`
      select
        up.user_id as "userId",
        p.id as "permissionId",
        p.code as "permissionCode",
        p.name as "permissionName",
        p.module,
        up.granted_by_user_id as "grantedByUserId",
        up.created_at as "createdAt"
      from zigo.user_permissions up
      join zigo.permissions p on p.id = up.permission_id
      where up.user_id = $1 and coalesce(p.is_deleted, false) = false
      order by p.module, p.code
    `, [userId]);
    return result.rows;
}
export async function assignPermissionToUser(userId, permissionId, grantedByUserId) {
    await pool.query(`
      insert into zigo.user_permissions (user_id, permission_id, granted_by_user_id)
      values ($1, $2, $3)
      on conflict (user_id, permission_id) do update
        set granted_by_user_id = excluded.granted_by_user_id
    `, [userId, permissionId, grantedByUserId]);
}
export async function removePermissionFromUser(userId, permissionId) {
    const result = await pool.query("delete from zigo.user_permissions where user_id = $1 and permission_id = $2", [
        userId,
        permissionId
    ]);
    return (result.rowCount ?? 0) > 0;
}
export async function listAssignableRoles(input) {
    const result = await pool.query(`
      select id, code, name, description, is_active as "isActive"
      from zigo.roles
      where coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
        and code <> all($1::text[])
      order by name
    `, [input.excludeRoleCodes]);
    return result.rows;
}
