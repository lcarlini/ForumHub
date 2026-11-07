import { create } from 'zustand';
import { createVaultRecord, sealPayload, unlockRecord, type VaultRecord } from './crypto';
import { db, loadVaultRecord, saveVaultRecord } from './db';
import type { Vault } from './types';

export type Status = 'loading' | 'setup' | 'locked' | 'unlocked';
export type SyncState = 'local' | 'saving' | 'error';

const AUTO_LOCK_MS = 15 * 60 * 1000;

export function emptyVault(): Vault {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: { displayName: '', theme: 'dark', language: 'pt-BR' },
    forums: [],
    favorites: [],
    alerts: [],
    aiProviders: [],
    summaries: [],
    activity: [],
  };
}

interface VaultState {
  status: Status;
  record: VaultRecord | null;
  // The CryptoKey is non-extractable and lives only in memory.
  sessionKey: CryptoKey | null;
  vault: Vault | null;
  sync: SyncState;
  error: string | null;

  init: () => Promise<void>;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  /** Applies a mutation to the vault, then encrypts and persists it. */
  mutate: (fn: (draft: Vault) => void) => Promise<void>;
  /** Replaces the whole vault from an encrypted backup record. */
  importBackup: (backup: VaultRecord, password: string) => Promise<void>;
  /** Wipes the local vault. Irreversible. */
  destroy: () => Promise<void>;
}

export const useVault = create<VaultState>((set, get) => ({
  status: 'loading',
  record: null,
  sessionKey: null,
  vault: null,
  sync: 'local',
  error: null,

  init: async () => {
    const record = (await loadVaultRecord()) ?? null;
    set({ record, status: record ? 'locked' : 'setup' });
  },

  setup: async (password) => {
    if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
    const vault = emptyVault();
    const { record, key } = await createVaultRecord(password, vault);
    await saveVaultRecord(record);
    set({ record, sessionKey: key, vault, status: 'unlocked', error: null, sync: 'local' });
  },

  unlock: async (password) => {
    const { record } = get();
    if (!record) throw new Error('Nenhum cofre encontrado.');
    const { key, data } = await unlockRecord<Vault>(password, record);
    set({ sessionKey: key, vault: data, status: 'unlocked', error: null });
  },

  lock: () => set({ sessionKey: null, vault: null, status: get().record ? 'locked' : 'setup' }),

  mutate: async (fn) => {
    const { vault, record, sessionKey } = get();
    if (!vault || !record || !sessionKey) throw new Error('Cofre bloqueado.');
    const draft = structuredClone(vault);
    fn(draft);
    draft.updatedAt = new Date().toISOString();
    set({ vault: draft, sync: 'saving' });
    try {
      const next = await sealPayload(sessionKey, record, draft);
      await saveVaultRecord(next);
      set({ record: next, sync: 'local' });
    } catch {
      set({ sync: 'error', error: 'Falha ao salvar o cofre localmente.' });
    }
  },

  importBackup: async (backup, password) => {
    const { key, data } = await unlockRecord<Vault>(password, backup);
    const next = await sealPayload(key, backup, data);
    await saveVaultRecord(next);
    set({ record: next, sessionKey: key, vault: data, status: 'unlocked', error: null });
  },

  destroy: async () => {
    await db.vault.clear();
    set({ record: null, sessionKey: null, vault: null, status: 'setup', error: null });
  },
}));

// Auto-lock after inactivity, and when the tab was hidden for longer than the limit.
let lockTimer: number | undefined;
let hiddenAt = 0;

function armAutoLock() {
  window.clearTimeout(lockTimer);
  if (useVault.getState().status !== 'unlocked') return;
  lockTimer = window.setTimeout(() => useVault.getState().lock(), AUTO_LOCK_MS);
}

export function startActivityWatch() {
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, armAutoLock, { passive: true }),
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) {
      useVault.getState().lock();
    }
  });
  useVault.subscribe((s, prev) => {
    if (s.status !== prev.status) armAutoLock();
  });
}
