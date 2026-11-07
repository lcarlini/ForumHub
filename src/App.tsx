import { useState, type ComponentType } from 'react';
import { useVault } from './lib/vault-store';
import Lock from './screens/Lock';
import Home, { type Route } from './screens/Home';
import Forums from './screens/Forums';
import Alerts from './screens/Alerts';
import AI from './screens/AI';
import Settings from './screens/Settings';

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'Início', icon: '◉' },
  { route: 'forums', label: 'Fóruns', icon: '▤' },
  { route: 'alerts', label: 'Alertas', icon: '◔' },
  { route: 'ai', label: 'IA', icon: '✦' },
  { route: 'settings', label: 'Ajustes', icon: '⚙' },
];

export default function App() {
  const status = useVault((s) => s.status);
  const [route, setRoute] = useState<Route>('home');

  if (status === 'loading') {
    return (
      <div className="grid h-full place-items-center">
        <div className="size-10 animate-pulse rounded-full bg-gradient-to-br from-accent to-accent-2" aria-label="Carregando" />
      </div>
    );
  }
  if (status !== 'unlocked') return <Lock />;

  const screens: Record<Route, ComponentType<{ go: (r: Route) => void }>> = {
    home: Home,
    forums: Forums,
    alerts: Alerts,
    ai: AI,
    settings: Settings,
  };
  const Screen = screens[route];

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-line bg-panel p-4 backdrop-blur-md lg:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-slate-950">FH</span>
          <span className="font-semibold">ForumHub</span>
        </div>
        {NAV.map((n) => (
          <button
            key={n.route}
            onClick={() => setRoute(n.route)}
            aria-current={route === n.route ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition ${
              route === n.route ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-panel-strong hover:text-fg'
            }`}
          >
            <span aria-hidden className="w-5 text-center">{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div className="mt-auto px-2 text-xs text-muted">Cofre criptografado · AES-256-GCM</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">
          <Screen go={setRoute} />
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Principal"
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {NAV.map((n) => (
              <li key={n.route}>
                <button
                  onClick={() => setRoute(n.route)}
                  aria-current={route === n.route ? 'page' : undefined}
                  className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] transition ${
                    route === n.route ? 'text-accent' : 'text-muted'
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">{n.icon}</span>
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
