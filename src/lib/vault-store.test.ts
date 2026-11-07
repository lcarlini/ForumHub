import { beforeEach, describe, expect, it } from 'vitest';
import { resetApp } from '../test/helpers';
import { useVault } from './vault-store';
import { db } from './db';
import { parseBackupFile } from './backup';

const PW = 'correct-horse-battery';

beforeEach(async () => {
  await resetApp();
  await useVault.getState().init();
});

describe('vault store', () => {
  it('starts in setup when no vault exists', () => {
    expect(useVault.getState().status).toBe('setup');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    await expect(useVault.getState().setup('short')).rejects.toThrow('8 caracteres');
    expect(useVault.getState().status).toBe('setup');
  });

  it('creates a vault, persists ciphertext only, and unlocks it', async () => {
    await useVault.getState().setup(PW);
    expect(useVault.getState().status).toBe('unlocked');
    const stored = await db.vault.get('main');
    expect(stored).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain('"forums"');
  });

  it('mutate() persists and survives lock + unlock', async () => {
    await useVault.getState().setup(PW);
    await useVault.getState().mutate((d) => {
      d.profile.displayName = 'Leandro';
    });
    useVault.getState().lock();
    expect(useVault.getState().vault).toBeNull();
    expect(useVault.getState().sessionKey).toBeNull();

    await useVault.getState().unlock(PW);
    expect(useVault.getState().vault?.profile.displayName).toBe('Leandro');
  });

  it('reloads the persisted vault after a simulated app restart', async () => {
    await useVault.getState().setup(PW);
    await useVault.getState().mutate((d) => {
      d.forums.push({
        id: 'f1',
        name: 'Adrenaline',
        url: 'https://www.adrenaline.com.br/',
        group: 'tech',
        description: '',
        favorite: true,
        credentials: { username: '', password: '', notes: '' },
        openCount: 0,
        createdAt: new Date().toISOString(),
      });
    });
    // Simulate a reload: forget all in-memory state, then re-read IndexedDB.
    useVault.setState({ record: null, sessionKey: null, vault: null, status: 'loading' });
    await useVault.getState().init();
    expect(useVault.getState().status).toBe('locked');
    await useVault.getState().unlock(PW);
    expect(useVault.getState().vault?.forums[0].name).toBe('Adrenaline');
  });

  it('rejects unlock with a wrong password and stays locked', async () => {
    await useVault.getState().setup(PW);
    useVault.getState().lock();
    await expect(useVault.getState().unlock('wrong-password-1')).rejects.toThrow('WRONG_PASSWORD');
    expect(useVault.getState().status).toBe('locked');
  });

  it('mutate() refuses to run while locked', async () => {
    await useVault.getState().setup(PW);
    useVault.getState().lock();
    await expect(useVault.getState().mutate(() => {})).rejects.toThrow('bloqueado');
  });

  it('destroy() wipes local data and returns to setup', async () => {
    await useVault.getState().setup(PW);
    await useVault.getState().destroy();
    expect(useVault.getState().status).toBe('setup');
    expect(await db.vault.count()).toBe(0);
  });

  it('restores an encrypted backup with its own password', async () => {
    await useVault.getState().setup(PW);
    await useVault.getState().mutate((d) => {
      d.profile.displayName = 'Backup User';
    });
    const file = new File([JSON.stringify({ format: 'forumhub-backup', ...useVault.getState().record })], 'b.fhbackup');
    const parsed = await parseBackupFile(file);

    await useVault.getState().destroy();
    await useVault.getState().importBackup(parsed, PW);
    expect(useVault.getState().status).toBe('unlocked');
    expect(useVault.getState().vault?.profile.displayName).toBe('Backup User');
  });

  it('refuses a backup opened with the wrong password', async () => {
    await useVault.getState().setup(PW);
    const file = new File([JSON.stringify({ format: 'forumhub-backup', ...useVault.getState().record })], 'b.fhbackup');
    const parsed = await parseBackupFile(file);
    await expect(useVault.getState().importBackup(parsed, 'not-the-password')).rejects.toThrow('WRONG_PASSWORD');
  });
});

describe('backup file validation', () => {
  it('rejects files that are not ForumHub backups', async () => {
    await expect(parseBackupFile(new File(['{"hello":1}'], 'x.json'))).rejects.toThrow('inválido');
    await expect(parseBackupFile(new File(['not json'], 'x.json'))).rejects.toThrow();
  });
});
