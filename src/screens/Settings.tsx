import { useState } from 'react';
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, Toggle } from '../components/ui';
import { useVault } from '../lib/vault-store';
import { downloadBackup, parseBackupFile } from '../lib/backup';
import { applyTheme, getTheme, type ThemeChoice } from '../lib/prefs';
import { newId } from '../lib/ids';
import type { AiProviderId } from '../lib/types';

const PROVIDERS: { value: AiProviderId; label: string; model: string }[] = [
  { value: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini' },
  { value: 'anthropic', label: 'Anthropic', model: 'claude-haiku-5-5' },
  { value: 'openrouter', label: 'OpenRouter', model: 'openai/gpt-4.1-mini' },
];

export default function Settings() {
  const vault = useVault((s) => s.vault)!;
  const mutate = useVault((s) => s.mutate);
  const lock = useVault((s) => s.lock);
  const destroy = useVault((s) => s.destroy);
  const importBackup = useVault((s) => s.importBackup);
  const [theme, setTheme] = useState<ThemeChoice>(getTheme());
  const [name, setName] = useState(vault.profile.displayName);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function changeTheme(t: ThemeChoice) {
    setTheme(t);
    applyTheme(t);
    void mutate((d) => {
      d.profile.theme = t;
    });
  }

  async function saveName() {
    await mutate((d) => {
      d.profile.displayName = name.trim();
    });
    setMessage('Perfil salvo.');
  }

  async function restore(file: File) {
    setError(null);
    const password = window.prompt('Senha mestra do backup que você está restaurando:');
    if (!password) return;
    if (!window.confirm('Isso substitui TODO o cofre atual neste dispositivo. Continuar?')) return;
    try {
      await importBackup(await parseBackupFile(file), password);
      setMessage('Backup restaurado.');
    } catch (err) {
      setError(err instanceof Error && err.message === 'WRONG_PASSWORD' ? 'Senha do backup incorreta.' : 'Não foi possível restaurar este arquivo.');
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Cofre, IA, aparência e segurança" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-semibold">Perfil e aparência</h2>
          <Field label="Nome de exibição">
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
              <Button variant="ghost" onClick={saveName}>Salvar</Button>
            </div>
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tema claro</span>
            <Toggle checked={theme === 'light'} label="Tema claro" onChange={(v) => changeTheme(v ? 'light' : 'dark')} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Segurança</h2>
          <p className="text-sm text-muted">
            O cofre bloqueia sozinho após 15 minutos de inatividade. A chave de criptografia existe só na memória
            desta aba.
          </p>
          <Button variant="ghost" onClick={lock}>Bloquear agora</Button>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Provedores de IA</h2>
          <p className="text-sm text-muted">
            Use a sua própria chave. Ela é salva criptografada dentro do cofre e usada apenas em memória.
          </p>
          <AiProviderForm onAdd={(p) => mutate((d) => { d.aiProviders.push(p); })} />
          {vault.aiProviders.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {vault.aiProviders.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted"> · {p.model}</span>
                  </span>
                  <Button
                    variant="danger"
                    className="min-h-9"
                    onClick={() => mutate((d) => { d.aiProviders = d.aiProviders.filter((x) => x.id !== p.id); })}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Backup</h2>
          <p className="text-sm text-muted">
            O backup é o próprio cofre criptografado, protegido pela senha mestra. Ele pode ser guardado em qualquer lugar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={downloadBackup}>Exportar backup criptografado</Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-panel-strong px-4 text-sm hover:bg-panel">
              Restaurar backup…
              <input
                type="file"
                accept="application/json,.fhbackup"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void restore(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-4 border-danger/30 lg:col-span-2">
          <h2 className="font-semibold text-danger">Zona de perigo</h2>
          <p className="text-sm text-muted">Apaga o cofre deste dispositivo. Sem um backup, os dados são perdidos.</p>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('Apagar o cofre deste dispositivo permanentemente?')) void destroy();
            }}
          >
            Apagar cofre local
          </Button>
        </Card>
      </div>

      <div className="mt-4 space-y-2">
        {message && <p role="status" className="text-sm text-accent">{message}</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </>
  );
}

function AiProviderForm({ onAdd }: { onAdd: (p: { id: string; provider: AiProviderId; model: string; apiKey: string; label: string }) => Promise<void> }) {
  const [provider, setProvider] = useState<AiProviderId>('openai');
  const [model, setModel] = useState(PROVIDERS[0].model);
  const [apiKey, setApiKey] = useState('');
  const meta = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!apiKey.trim()) return;
        await onAdd({ id: newId('ai'), provider, model: model.trim() || meta.model, apiKey: apiKey.trim(), label: meta.label });
        setApiKey('');
      }}
    >
      <Field label="Provedor">
        <Select
          value={provider}
          onChange={(e) => {
            const next = e.target.value as AiProviderId;
            setProvider(next);
            setModel(PROVIDERS.find((p) => p.value === next)!.model);
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Modelo">
        <Input value={model} onChange={(e) => setModel(e.target.value)} />
      </Field>
      <Field label="Chave de API">
        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" required />
      </Field>
      <Button type="submit" variant="ghost">Adicionar</Button>
    </form>
  );
}
