// Zero-knowledge vault crypto: PBKDF2-SHA-256 -> AES-256-GCM, all in the browser via Web Crypto.

export const KDF_ITERATIONS = 600_000;
const VERIFIER_PLAINTEXT = 'forumhub-verifier-v1';

export interface EncryptedBlob {
  iv: string; // base64
  ciphertext: string; // base64
}

export interface VaultRecord {
  id: 'main';
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; length: 256 };
  verifier: EncryptedBlob;
  payload: EncryptedBlob;
  updatedAt: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

export const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function deriveKey(password: string, salt: Uint8Array, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  // extractable: false -> the raw key bytes can never be read back by page script.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(blob.iv) as BufferSource },
    key,
    fromB64(blob.ciphertext) as BufferSource,
  );
  return JSON.parse(dec.decode(pt)) as T;
}

/** Creates a new vault record for a password. Returns the record and the in-memory session key. */
export async function createVaultRecord(password: string, initial: unknown): Promise<{ record: VaultRecord; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const record: VaultRecord = {
    id: 'main',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', length: 256 },
    verifier: await encryptJson(key, VERIFIER_PLAINTEXT),
    payload: await encryptJson(key, initial),
    updatedAt: new Date().toISOString(),
  };
  return { record, key };
}

/** Derives the key for a record and checks the password. Throws 'WRONG_PASSWORD' on mismatch. */
export async function unlockRecord<T>(password: string, record: VaultRecord): Promise<{ key: CryptoKey; data: T }> {
  const key = await deriveKey(password, fromB64(record.kdf.salt), record.kdf.iterations);
  try {
    const check = await decryptJson<string>(key, record.verifier);
    if (check !== VERIFIER_PLAINTEXT) throw new Error('verifier mismatch');
    const data = await decryptJson<T>(key, record.payload);
    return { key, data };
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
}

/** Re-encrypts the payload with the existing session key (fresh IV each time). */
export async function sealPayload(key: CryptoKey, record: VaultRecord, data: unknown): Promise<VaultRecord> {
  return { ...record, payload: await encryptJson(key, data), updatedAt: new Date().toISOString() };
}
