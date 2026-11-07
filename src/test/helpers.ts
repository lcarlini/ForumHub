import { db } from '../lib/db';
import { useVault } from '../lib/vault-store';

/** Puts the store and IndexedDB back to a fresh first-run state. */
export async function resetApp(): Promise<void> {
  await db.vault.clear();
  useVault.setState({
    status: 'setup',
    record: null,
    sessionKey: null,
    vault: null,
    sync: 'local',
    error: null,
  });
}
