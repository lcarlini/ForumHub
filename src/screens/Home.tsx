import { Card, EmptyState, PageHeader } from '../components/ui';
import { useVault } from '../lib/vault-store';
import type { Forum } from '../lib/types';

export type Route = 'home' | 'forums' | 'alerts' | 'ai' | 'settings';

interface Props {
  go: (r: Route) => void;
}

export default function Home({ go }: Props) {
  const vault = useVault((s) => s.vault)!;
  const sync = useVault((s) => s.sync);
  const name = vault.profile.displayName;

  const favorites = vault.forums.filter((f) => f.favorite);
  const recent = [...vault.forums]
    .filter((f) => f.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    .slice(0, 5);
  const enabledAlerts = vault.alerts.filter((a) => a.enabled).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <PageHeader
        title={`${greeting}${name ? `, ${name}` : ''}`}
        subtitle={`Cofre criptografado · ${syncLabel(sync)}`}
      />

      <section aria-labelledby="fav-h" className="mb-6">
        <h2 id="fav-h" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Favoritos</h2>
        {favorites.length === 0 ? (
          <EmptyState
            title="Marque fóruns como favoritos"
            text="Eles aparecem aqui como atalhos grandes para acesso rápido."
            action={<button onClick={() => go('forums')} className="text-sm text-accent hover:underline">Ir para Fóruns →</button>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {favorites.map((f) => (
              <li key={f.id}>
                <FavoriteTile forum={f} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Alertas</h2>
          <p className="text-sm text-muted">
            {enabledAlerts} regra{enabledAlerts === 1 ? '' : 's'} ativa{enabledAlerts === 1 ? '' : 's'}.
            {' '}As verificações automáticas chegam na Fase 3.
          </p>
          <button onClick={() => go('alerts')} className="mt-3 text-sm text-accent hover:underline">Gerenciar alertas →</button>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Visitados recentemente</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Nada ainda. Abra um fórum para vê-lo aqui.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-accent">{f.name}</a>
                  <span className="shrink-0 text-xs text-muted">{new Date(f.lastOpenedAt!).toLocaleDateString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">Ações rápidas de IA</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <QuickAction label="Resumir texto colado" onClick={() => go('ai')} />
            <QuickAction label="Usar seleção da tela" onClick={() => go('ai')} />
          </div>
        </Card>
      </div>
    </>
  );
}

function FavoriteTile({ forum }: { forum: Forum }) {
  const mutate = useVault((s) => s.mutate);
  const host = (() => {
    try {
      return new URL(forum.url).hostname;
    } catch {
      return forum.url;
    }
  })();
  return (
    <a
      href={forum.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        mutate((d) => {
          const t = d.forums.find((x) => x.id === forum.id);
          if (t) {
            t.openCount += 1;
            t.lastOpenedAt = new Date().toISOString();
          }
        })
      }
      className="group flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-panel p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent/80 to-accent-2/80 text-sm font-bold text-slate-950">
        {forum.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="mt-3">
        <span className="block truncate font-semibold">{forum.name}</span>
        <span className="block truncate text-xs text-muted">{host}</span>
      </span>
    </a>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 rounded-xl border border-line bg-panel-strong px-3 text-left text-sm transition hover:border-accent/50"
    >
      {label}
    </button>
  );
}

function syncLabel(sync: 'local' | 'saving' | 'error'): string {
  switch (sync) {
    case 'saving':
      return 'salvando…';
    case 'error':
      return 'erro ao salvar';
    default:
      return 'salvo no dispositivo';
  }
}
