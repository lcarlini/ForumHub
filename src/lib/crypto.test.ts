import { describe, expect, it } from 'vitest';
import {
  createVaultRecord,
  decryptJson,
  encryptJson,
  fromB64,
  sealPayload,
  unlockRecord,
  type VaultRecord,
} from './crypto';

const PASSWORD = 'senha-forte-123';

describe('vault crypto', () => {
  it('round-trips data through create and unlock', async () => {
    const { record } = await createVaultRecord(PASSWORD, { forums: [{ name: 'Hardmob' }] });
    const copy = JSON.parse(JSON.stringify(record)) as VaultRecord;
    const { data } = await unlockRecord<{ forums: { name: string }[] }>(PASSWORD, copy);
    expect(data.forums[0].name).toBe('Hardmob');
  });

  it('rejects a wrong password with WRONG_PASSWORD', async () => {
    const { record } = await createVaultRecord(PASSWORD, { secret: 'x' });
    await expect(unlockRecord('outra-senha', record)).rejects.toThrow('WRONG_PASSWORD');
  });

  it('never stores plaintext in the record', async () => {
    const { record } = await createVaultRecord(PASSWORD, { apiKey: 'sk-PLAINTEXT-MARKER' });
    expect(JSON.stringify(record)).not.toContain('sk-PLAINTEXT-MARKER');
  });

  it('uses a fresh IV on every seal', async () => {
    const { record, key } = await createVaultRecord(PASSWORD, { a: 1 });
    const next = await sealPayload(key, record, { a: 2 });
    const again = await sealPayload(key, record, { a: 2 });
    expect(next.payload.iv).not.toBe(record.payload.iv);
    expect(again.payload.iv).not.toBe(next.payload.iv);
    expect(next.payload.ciphertext).not.toBe(again.payload.ciphertext);
  });

  it('detects tampering with the ciphertext (AES-GCM authentication)', async () => {
    const { record, key } = await createVaultRecord(PASSWORD, { a: 1 });
    const bytes = fromB64(record.payload.ciphertext);
    bytes[0] ^= 0xff;
    const tampered = { iv: record.payload.iv, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptJson(key, tampered)).rejects.toThrow();
  });

  it('encryptJson/decryptJson preserve unicode (pt-BR text)', async () => {
    const { key } = await createVaultRecord(PASSWORD, {});
    const value = { summary: 'Promoção de placa de vídeo — “ótimo” 🎮' };
    expect(await decryptJson(key, await encryptJson(key, value))).toEqual(value);
  });

  it('uses 600,000 PBKDF2 iterations by default', async () => {
    const { record } = await createVaultRecord(PASSWORD, {});
    expect(record.kdf.iterations).toBe(600_000);
    expect(record.kdf.hash).toBe('SHA-256');
    expect(record.cipher.length).toBe(256);
  });
});
