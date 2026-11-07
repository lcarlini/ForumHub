import { useState } from 'react';
import { Button, Card, EmptyState, ErrorText, Field, PageHeader, Select, TextArea } from '../components/ui';
import { ACTION_LABELS, MAX_INPUT_CHARS, runSummary } from '../lib/ai';
import { useVault } from '../lib/vault-store';
import { newId } from '../lib/ids';
import type { SummaryAction } from '../lib/types';

export default function AI() {
  const vault = useVault((s) => s.vault)!;
  const mutate = useVault((s) => s.mutate);
  const [providerId, setProviderId] = useState(vault.aiProviders[0]?.id ?? '');
  const [action, setAction] = useState<SummaryAction>('tldr');
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = vault.aiProviders.find((p) => p.id === providerId);

  function useSelection() {
    const sel = window.getSelection()?.toString().trim() ?? '';
    if (sel) setText(sel);
    else setError('Selecione um trecho desta tela antes de usar a seleção.');
  }

  async function run() {
    setError(null);
    setResult(null);
    if (!provider) return setError('Configure um provedor de IA em Ajustes.');
    if (!text.trim()) return setError('Cole ou selecione um texto primeiro.');
    setBusy(true);
    try {
      setResult(await runSummary(provider, action, text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na chamada à IA.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result || !provider) return;
    await mutate((d) => {
      d.summaries.unshift({
        id: newId('sum'),
        title: text.slice(0, 80).replace(/\s+/g, ' '),
        model: provider.model,
        provider: provider.provider,
        promptType: action,
        summary: result,
        createdAt: new Date().toISOString(),
      });
    });
  }

  if (vault.aiProviders.length === 0) {
    return (
      <>
        <PageHeader title="IA" subtitle="Resumos com a sua própria chave" />
        <EmptyState
          title="Nenhum provedor configurado"
          text="Adicione uma chave de API (OpenAI, Anthropic ou OpenRouter) em Ajustes. Ela fica criptografada no cofre."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="IA" subtitle="O texto selecionado é enviado só para o provedor escolhido." />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="space-y-4 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provedor">
              <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {vault.aiProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} · {p.model}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ação">
              <Select value={action} onChange={(e) => setAction(e.target.value as SummaryAction)}>
                {(Object.keys(ACTION_LABELS) as SummaryAction[]).map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Texto" hint={`${text.length.toLocaleString('pt-BR')} / ${MAX_INPUT_CHARS.toLocaleString('pt-BR')} caracteres enviados`}>
            <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole o texto da thread aqui…" />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={useSelection}>Usar seleção da tela</Button>
            <Button variant="ghost" onClick={async () => setText(await navigator.clipboard.readText().catch(() => ''))}>
              Colar da área de transferência
            </Button>
            <Button onClick={run} disabled={busy} className="ml-auto">
              {busy ? 'Gerando…' : 'Resumir com IA'}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Resultado</h2>
            {result && (
              <div className="flex gap-1">
                <Button variant="ghost" className="min-h-9" onClick={() => navigator.clipboard.writeText(result)}>Copiar</Button>
                <Button variant="ghost" className="min-h-9" onClick={save}>Salvar</Button>
              </div>
            )}
          </div>
          {result ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
          ) : (
            <p className="text-sm text-muted">O resumo aparece aqui.</p>
          )}
        </Card>
      </div>

      {vault.summaries.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Resumos salvos</h2>
          <ul className="space-y-3">
            {vault.summaries.slice(0, 20).map((s) => (
              <li key={s.id}>
                <Card>
                  <p className="text-xs text-muted">
                    {ACTION_LABELS[s.promptType]} · {s.model} · {new Date(s.createdAt).toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{s.title}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{s.summary}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
