import { createHmac, timingSafeEqual } from "node:crypto";

const parseSegment = (seg) => {
  try {
    return JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

// Vérifie un JWT HS256 (utilisé pour la signature des webhooks CamPay).
// Renvoie le payload si la signature est valide, sinon null. Ne lève jamais d'erreur.
export function verifyHs256(token, secret) {
  if (typeof token !== "string" || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  const header = parseSegment(h);
  if (!header || header.alg !== "HS256") return null;

  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const payload = parseSegment(p);
  if (!payload) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
