/**
 * RSA blind signatures (Chaum) — client-side implementation.
 *
 * Flow:
 *   1. GET  /votings/:id/signing-key          -> { modulus, exponent } (hex of n, e)
 *   2. genTokenPair()                          -> { tokenHex: T, r }
 *   3. blinded = blindToken(T, r, n, e)        -> T·r^e (mod n)
 *   4. POST /votings/:id/sign  { token: T, blinded, optionIds }
 *   5. sig = unblind(blindSig, r, n)           -> T^d (mod n)
 *   6. POST /votings/:id/vote  { token: T, signature: sig, optionIds }
 */

export interface BlindKeyParams {
  modulus: string; // hex of n
  exponent: string; // hex of e
}

export interface TokenPair {
  tokenHex: string; // T — 64 hex chars (256 bit)
  r: string; // decimal string of r
}

// ─── BigInt arithmetic ─────────────────────────────────────────────────────────

const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BIG_ONE;
  base %= mod;
  while (exp > BIG_ZERO) {
    if (exp & BIG_ONE) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= BIG_ONE;
  }
  return result;
}

function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === BIG_ZERO) return [a, BIG_ONE, BIG_ZERO];
  const [g, x1, y1] = egcd(b, a % b);
  return [g, y1, x1 - (a / b) * y1];
}

export function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = egcd(a % m, m);
  if (g !== BIG_ONE) throw new Error("r is not invertible mod n");
  return ((x % m) + m) % m;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randomBigInt(byteLength: number): bigint {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return BigInt(
    "0x" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  );
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== BIG_ZERO) {
    [a, b] = [b, a % b];
  }
  return a;
}

// ─── API ───────────────────────────────────────────────────────────────────────

/**
 * Generates the secret token T (256 bit) and a blinding factor r coprime to n.
 */
export function genTokenPair(modulusHex: string): TokenPair {
  const n = BigInt("0x" + modulusHex);
  const tokenHex = randomBigInt(32)
    .toString(16)
    .padStart(64, "0")
    .slice(0, 64);

  let r: bigint;
  do {
    r = (randomBigInt(32) % (n - BIG_ONE)) + BIG_ONE;
  } while (gcd(r, n) !== BIG_ONE);

  return {
    tokenHex,
    r: r.toString(10),
  };
}

/**
 * blinded = T · r^e (mod n)
 */
export function blindToken(
  tokenHex: string,
  r: bigint,
  modulusHex: string,
  exponentHex: string,
): string {
  const n = BigInt("0x" + modulusHex);
  const e = BigInt("0x" + exponentHex);
  const T = BigInt("0x" + tokenHex);
  const blinded = (T * modPow(r, e, n)) % n;
  return blinded.toString(16).padStart(modulusHex.length, "0");
}

/**
 * sig = blindSig · r⁻¹ (mod n) ≡ T^d (mod n)
 */
export function unblind(
  blindSigHex: string,
  r: bigint,
  modulusHex: string,
): string {
  const n = BigInt("0x" + modulusHex);
  const s = (BigInt("0x" + blindSigHex) * modInverse(r, n)) % n;
  return s.toString(16).padStart(modulusHex.length, "0");
}

/**
 * High-level helper: given key params, produce { token, r, blinded }.
 */
export function prepareBlind(
  params: BlindKeyParams,
): { token: string; r: bigint; blinded: string } {
  const { tokenHex, r: rDec } = genTokenPair(params.modulus);
  const r = BigInt(rDec);
  const blinded = blindToken(tokenHex, r, params.modulus, params.exponent);
  return { token: tokenHex, r, blinded };
}

/**
 * High-level helper: produce the final signature from a server blindSig.
 */
export function finalizeBlind(
  blindSigHex: string,
  r: bigint,
  modulusHex: string,
): string {
  return unblind(blindSigHex, r, modulusHex);
}
