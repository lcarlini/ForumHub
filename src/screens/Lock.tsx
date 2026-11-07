import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';
import { useVault } from '../lib/vault-store';
import { parseBackupFile } from '../lib/backup';

export default function Lock() {
  const status = useVault((s) => s.status);
  const setup = useVault((s) => s.setup);
  const unlock = useVault((s) => s.unlock);
  const importBackup = useVault((s) => s.importBackup);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);

  const isSetup = status === 'setup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSetup && password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setBusy(true);
    try {
      if (restoring && backupFile) {
        await importBackup(await parseBackupFile(backupFile), password);
      } else if (isSetup) {
        await setup(password);
      } else {
        await unlock(password);
      }
      setPassword('');
      setConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === 'WRONG_PASSWORD' ? 'Senha incorreta.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-lg shadow-accent/20">
            <span className="text-2xl font-bold text-slate-950">FH</span>
          </div>
          <h1 className="text-2xl font-semibold">ForumHub</h1>
          <p className="mt-1 text-sm text-muted">
            {isSetup ? 'Crie a senha mestra do seu cofre.' : 'Desbloqueie seu cofre para continuar.'}
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            {isSetup && !restoring && (
              <p className="rounded-xl bg-accent/10 p-3 text-sm text-muted">
                Seu cofre é criptografado no próprio navegador com AES-256-GCM. A senha mestra nunca sai do
                dispositivo e não pode ser recuperada: guarde-a em um lugar seguro.
              </p>
            )}

            {isSetup && (
              <button
                type="button"
                onClick={() => setRestoring((r) => !r)}
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                {restoring ? '← Criar um cofre novo' : 'Restaurar de um backup criptografado'}
              </button>
            )}

            {restoring && (
              <Field label="Arquivo de backup">
                <Input
                  type="file"
                  accept="application/json,.fhbackup"
                  onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            )}

            <Field label={restoring ? 'Senha do backup' : 'Senha mestra'}>
              <Input
                type="password"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </Field>

            {isSetup && !restoring && (
              <Field label="Confirmar senha">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>
            )}

            <ErrorText>{error}</ErrorText>

            <Button type="submit" className="w-full" disabled={busy || (restoring && !backupFile)}>
              {busy ? 'Processando…' : isSetup ? (restoring ? 'Restaurar cofre' : 'Criar cofre') : 'Desbloquear'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
