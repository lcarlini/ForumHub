import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, TextArea, Toggle } from '../components/ui';
import { useVault } from '../lib/vault-store';
import { newId } from '../lib/ids';
import type { Forum, ForumGroup } from '../lib/types';

const GROUPS: { value: ForumGroup; label: string }[] = [
  { value: 'tech', label: 'Tecnologia' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'deals', label: 'Promoções' },
  { value: 'gaming', label: 'Games' },
  { value: 'career', label: 'Carreira' },
  { value: 'other', label: 'Outros' },
];

const blankForm = (): Omit<Forum, 'id' | 'openCount' | 'createdAt' | 'favorite'> => ({
  name: '',
  url: '',
  group: 'tech',
  description: '',
  credentials: { username: '', password: '', notes: '' },
  feed: undefined,
});

export default function Forums() {
  const vault = useVault((s) => s.vault)!;
  const mutate = useVault((s) => s.mutate);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ForumGroup | 'all'>('all');
  const [editing, setEditing] = useState<Forum | 'new' | null>(null);

  const forums = useMemo(
    () =>
      vault.forums
        .filter((f) => group === 'all' || f.group === group)
        .filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [vault.forums, query, group],
  );

  async function toggleFavorite(f: Forum) {
    await mutate((d) => {
      const target = d.forums.find((x) => x.id === f.id);
      if (target) target.favorite = !target.favorite;
    });
  }

  return (
    <>
      <PageHeader
        title="Fóruns"
        subtitle={`${vault.forums.length} cadastrados`}
        action={<Button onClick={() => setEditing('new')}>+ Novo</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Buscar fóruns…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar fóruns" />
        <Select value={group} onChange={(e) => setGroup(e.target.value as ForumGroup | 'all')} aria-label="Grupo" className="sm:w-48">
          <option value="all">Todos os grupos</option>
          {GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
      </div>

      {vault.forums.length === 0 ? (
        <EmptyState
          title="Nenhum fórum ainda"
          text="Adicione seus fóruns favoritos — Outerspace, Hardmob, Adrenaline, Reddit ou qualquer outro."
          action={<Button onClick={() => setEditing('new')}>Adicionar primeiro fórum</Button>}
        />
      ) : forums.length === 0 ? (
        <EmptyState title="Nada encontrado" text="Tente outro termo ou grupo." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {forums.map((f) => (
            <li key={f.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setEditing(f)}>
                    <h2 className="truncate font-semibold">{f.name}</h2>
                    <p className="truncate text-xs text-muted">{new URL(f.url).hostname}</p>
                  </button>
                  <Toggle checked={f.favorite} onChange={() => toggleFavorite(f)} label={`Favoritar ${f.name}`} />
                </div>
                {f.description && <p className="line-clamp-2 text-sm text-muted">{f.description}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
                    {GROUPS.find((g) => g.value === f.group)?.label}
                  </span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      mutate((d) => {
                        const t = d.forums.find((x) => x.id === f.id);
                        if (t) {
                          t.openCount += 1;
                          t.lastOpenedAt = new Date().toISOString();
                        }
                      })
                    }
                    className="ml-auto inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-accent hover:bg-accent/10"
                  >
                    Abrir ↗
                  </a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && <ForumEditor target={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ForumEditor({ target, onClose }: { target: Forum | 'new'; onClose: () => void }) {
  const mutate = useVault((s) => s.mutate);
  const existing = target === 'new' ? null : target;
  const [form, setForm] = useState(() => (existing ? { ...existing } : { ...blankForm(), favorite: false }));
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCred = (k: 'username' | 'password' | 'notes', v: string) =>
    setForm((f) => ({ ...f, credentials: { ...f.credentials, [k]: v } }));

  async function save() {
    setError(null);
    let url: URL;
    try {
      url = new URL(form.url.trim().startsWith('http') ? form.url.trim() : `https://${form.url.trim()}`);
    } catch {
      setError('Informe uma URL válida.');
      return;
    }
    if (!form.name.trim()) {
      setError('O nome é obrigatório.');
      return;
    }
    await mutate((d) => {
      const data = { ...form, name: form.name.trim(), url: url.toString() };
      if (existing) {
        const i = d.forums.findIndex((f) => f.id === existing.id);
        if (i >= 0) d.forums[i] = { ...d.forums[i], ...data };
      } else {
        d.forums.push({ ...data, id: newId('forum'), openCount: 0, createdAt: new Date().toISOString() });
      }
    });
    onClose();
  }

  async function remove() {
    if (!existing) return;
    if (!window.confirm(`Remover "${existing.name}" e suas credenciais deste cofre?`)) return;
    await mutate((d) => {
      d.forums = d.forums.filter((f) => f.id !== existing.id);
      d.favorites = d.favorites.filter((f) => f.target !== existing.id);
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={existing ? 'Editar fórum' : 'Novo fórum'}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{existing ? 'Editar fórum' : 'Novo fórum'}</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel" aria-label="Fechar">✕</button>
        </div>

        <div className="space-y-4">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Hardmob" />
          </Field>
          <Field label="URL">
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" inputMode="url" />
          </Field>
          <Field label="Grupo">
            <Select value={form.group} onChange={(e) => set('group', e.target.value as ForumGroup)}>
              {GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição">
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <fieldset className="space-y-3 rounded-2xl border border-line p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Login (criptografado no cofre)</legend>
            <Field label="Usuário">
              <Input value={form.credentials.username} onChange={(e) => setCred('username', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Senha">
              <div className="flex gap-2">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={form.credentials.password}
                  onChange={(e) => setCred('password', e.target.value)}
                  autoComplete="off"
                  className="flex-1"
                />
                <Button variant="ghost" type="button" onClick={() => setShowSecret((s) => !s)}>
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              <span className="block text-xs text-muted">
                Para contas reais, prefira um gerenciador como o Bitwarden e use este campo só como referência.
              </span>
            </Field>
            <Field label="Notas">
              <TextArea value={form.credentials.notes} onChange={(e) => setCred('notes', e.target.value)} />
            </Field>
          </fieldset>

          <div className="flex items-center justify-between rounded-2xl border border-line p-4">
            <span className="text-sm">Favorito (aparece na Home)</span>
            <Toggle checked={form.favorite} onChange={(v) => set('favorite', v)} label="Favorito" />
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
            {existing ? <Button variant="danger" onClick={remove}>Remover</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
