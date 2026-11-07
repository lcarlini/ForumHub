import type { VaultRecord } from './crypto';
import { useVault } from './vault-store';

/** Encrypted backup = the same ciphertext record the vault already stores. No plaintext ever leaves the device. */
export function downloadBackup(): void {
  const record = useVault.getState().record;
  if (!record) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify({ format: 'forumhub-backup', ...record }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forumhub-backup-${stamp}.fhbackup`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<VaultRecord> {
  const json = JSON.parse(await file.text()) as Partial<VaultRecord> & { format?: string };
  if (json.format !== 'forumhub-backup' || !json.kdf || !json.payload || !json.verifier) {
    throw new Error('Arquivo de backup inválido.');
  }
  const { format: _format, ...record } = json;
  return { ...(record as VaultRecord), id: 'main' };
}
