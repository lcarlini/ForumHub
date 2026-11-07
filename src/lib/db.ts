import Dexie, { type Table } from 'dexie';
import type { VaultRecord } from './crypto';

// IndexedDB only ever holds ciphertext + KDF metadata. No plaintext, no keys.
class ForumHubDB extends Dexie {
  vault!: Table<VaultRecord, 'main'>;

  constructor() {
    super('forumhub');
    this.version(1).stores({ vault: 'id' });
  }
}

export const db = new ForumHubDB();

export async function loadVaultRecord(): Promise<VaultRecord | undefined> {
  return db.vault.get('main');
}

export async function saveVaultRecord(record: VaultRecord): Promise<void> {
  await db.vault.put(record);
}
