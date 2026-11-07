import { useState } from 'react';
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Toggle } from '../components/ui';
import { useVault } from '../lib/vault-store';
import { newId } from '../lib/ids';
import type { AlertRule } from '../lib/types';

const SCHEDULES: { value: AlertRule['schedule']; label: string }[] = [
  { value: 'hourly', label: 'A cada hora' },
  { value: 'every_6_hours', label: 'A cada 6 horas' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
];

const TYPES: { value: AlertRule['type']; label: string }[] = [
  { value: 'keyword', label: 'Palavras-chave' },
  { value: 'new_item', label: 'Novos tópicos' },
  { value: 'author', label: 'Autor' },
  { value: 'regex', label: 'Expressão regular' },
  { value: 'price', label: 'Preço' },
];

export default function Alerts() {
  const vault = useVault((s) => s.vault)!;
  const mutate = useVault((s) => s.mutate);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Alertas"
        subtitle="Regras de monitoramento. A entrega automática chega na Fase 3."
        action={<Button onClick={() => setAdding(true)}>+ Regra</Button>}
      />

      {vault.alerts.length === 0 ? (
        <EmptyState
          title="Nenhuma regra de alerta"
          text='Crie uma regra como "RTX" ou "promoção" para acompanhar um fórum.'
          action={<Button onClick={() => setAdding(true)}>Criar primeira regra</Button>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {vault.alerts.map((a) => {
            const source = vault.forums.find((f) => f.id === a.sourceId)?.name ?? 'Fórum removido';
            return (
              <li key={a.id}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{a.name}</h2>
                      <p className="text-xs text-muted">
                        {source} · {TYPES.find((t) => t.value === a.type)?.label} · {SCHEDULES.find((s) => s.value === a.schedule)?.label}
                      </p>
                    </div>
                    <Toggle
                      checked={a.enabled}
                      label={`Ativar ${a.name}`}
                      onChange={(v) =>
                        mutate((d) => {
                          const r = d.alerts.find((x) => x.id === a.id);
                          if (r) r.enabled = v;
                        })
                      }
                    />
                  </div>
                  {a.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {a.keywords.map((k) => (
                        <span key={k} className="rounded-full bg-accent-2/15 px-2.5 py-0.5 text-xs text-accent-2">{k}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="danger"
                      className="min-h-9"
                      onClick={() => {
                        if (window.confirm(`Remover a regra "${a.name}"?`))
                          void mutate((d) => {
                            d.alerts = d.alerts.filter((x) => x.id !== a.id);
                          });
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {adding && <RuleForm onClose={() => setAdding(false)} />}
    </>
  );
}

function RuleForm({ onClose }: { onClose: () => void }) {
  const forums = useVault((s) => s.vault!.forums);
  const mutate = useVault((s) => s.mutate);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState(forums[0]?.id ?? '');
  const [type, setType] = useState<AlertRule['type']>('keyword');
  const [keywords, setKeywords] = useState('');
  const [schedule, setSchedule] = useState<AlertRule['schedule']>('every_6_hours');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !sourceId) {
      setError('Informe um nome e um fórum de origem.');
      return;
    }
    const rule: AlertRule = {
      id: newId('alert'),
      name: name.trim(),
      sourceId,
      type,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      schedule,
      channels: ['in_app'],
      enabled: true,
    };
    await mutate((d) => {
      d.alerts.push(rule);
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Nova regra">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 sm:max-w-lg sm:rounded-3xl">
        <h2 className="mb-4 text-lg font-semibold">Nova regra de alerta</h2>
        <div className="space-y-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: GPUs em promoção" />
          </Field>
          <Field label="Fórum de origem" hint={forums.length === 0 ? 'Cadastre um fórum primeiro.' : undefined}>
            <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as AlertRule['type'])}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Palavras-chave" hint="Separadas por vírgula. Ex.: RTX, RX, promoção">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </Field>
          <Field label="Frequência">
            <Select value={schedule} onChange={(e) => setSchedule(e.target.value as AlertRule['schedule'])}>
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save}>Criar regra</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
