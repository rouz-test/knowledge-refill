import crypto from "crypto";

const COOKIE_NAME = "admin_session";

/**
 * base64url helpers
 */
function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + pad;
  return Buffer.from(b64, "base64");
}

/**
 * 외부에서 쿠키 이름을 통일해서 쓰기 위함
 */
export function getAdminCookieName() {
  return COOKIE_NAME;
}

/**
 * 세션 생성 (서명)
 */
export function signAdminSession(ttlSeconds = 60 * 60 * 24 * 7) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing");
  }

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = base64url(JSON.stringify({ exp }));

  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest();

  const token = `${payload}.${base64url(sig)}`;

  return { token, exp };
}

/**
 * 세션 검증
 */
export function verifyAdminSession(token: string | undefined | null) {
  if (!token) return { ok: false as const, reason: "missing" as const };

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return { ok: false as const, reason: "secret_missing" as const };

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false as const, reason: "bad_format" as const };
  }

  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();

  const gotSig = base64urlToBuffer(sigB64);

  if (
    gotSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(gotSig, expectedSig)
  ) {
    return { ok: false as const, reason: "bad_sig" as const };
  }

  try {
    const payloadJson = Buffer.from(
      payloadB64.replaceAll("-", "+").replaceAll("_", "/") +
        "===".slice((payloadB64.length + 3) % 4),
      "base64"
    ).toString("utf8");

    const payload = JSON.parse(payloadJson) as { exp?: number };
    const exp = typeof payload.exp === "number" ? payload.exp : 0;

    if (!exp || Math.floor(Date.now() / 1000) > exp) {
      return { ok: false as const, reason: "expired" as const };
    }

    return { ok: true as const, exp };
  } catch {
    return { ok: false as const, reason: "bad_payload" as const };
  }
}