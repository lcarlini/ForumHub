// End-to-end user journeys, driven through the real UI in jsdom.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { resetApp } from './test/helpers';
import { useVault } from './lib/vault-store';

const PW = 'simulated-pass-42';
type User = ReturnType<typeof userEvent.setup>;

async function bootApp(): Promise<User> {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(useVault.getState().status).not.toBe('loading'));
  return user;
}

// Navigation exists twice (sidebar + bottom bar); either one works.
async function go(user: User, label: string) {
  await user.click(screen.getAllByRole('button', { name: label })[0]);
}

async function createVaultThroughUi(user: User) {
  await user.type(screen.getByLabelText('Senha mestra'), PW);
  await user.type(screen.getByLabelText('Confirmar senha'), PW);
  await user.click(screen.getByRole('button', { name: 'Criar cofre' }));
  await waitFor(() => expect(useVault.getState().status).toBe('unlocked'));
}

describe('simulated user journeys', () => {
  beforeEach(async () => {
    await resetApp();
    await useVault.getState().init();
  });

  it('first run: create vault, add a favorite forum, see it on Home', async () => {
    const user = await bootApp();
    expect(screen.getByText(/Crie a senha mestra/)).toBeInTheDocument();
    await createVaultThroughUi(user);

    await go(user, 'Fóruns');
    expect(screen.getByText('Nenhum fórum ainda')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adicionar primeiro fórum' }));

    const dialog = screen.getByRole('dialog', { name: 'Novo fórum' });
    await user.type(within(dialog).getByLabelText('Nome'), 'Hardmob');
    await user.type(within(dialog).getByLabelText('URL'), 'hardmob.com.br');
    await user.click(within(dialog).getByRole('switch', { name: 'Favorito' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useVault.getState().vault?.forums).toHaveLength(1));
    const saved = useVault.getState().vault!.forums[0];
    expect(saved.url).toBe('https://hardmob.com.br/');
    expect(saved.favorite).toBe(true);

    await go(user, 'Início');
    expect(await screen.findByText('Hardmob')).toBeInTheDocument();
  });

  it('lock, wrong password, then unlock restores the same data', async () => {
    const user = await bootApp();
    await createVaultThroughUi(user);

    await go(user, 'Ajustes');
    await user.click(screen.getByRole('button', { name: 'Bloquear agora' }));
    await waitFor(() => expect(useVault.getState().status).toBe('locked'));

    await user.type(screen.getByLabelText('Senha mestra'), 'senha-errada-1');
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');

    const field = screen.getByLabelText('Senha mestra');
    await user.clear(field);
    await user.type(field, PW);
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(useVault.getState().status).toBe('unlocked'));
    expect(await screen.findByText('Favoritos')).toBeInTheDocument();
  });

  it('alert journey: create a keyword rule, then disable it', async () => {
    const user = await bootApp();
    await createVaultThroughUi(user);

    await useVault.getState().mutate((d) => {
      d.forums.push({
        id: 'f-hw',
        name: 'Hardmob',
        url: 'https://hardmob.com.br/',
        group: 'hardware',
        description: '',
        favorite: false,
        credentials: { username: '', password: '', notes: '' },
        openCount: 0,
        createdAt: new Date().toISOString(),
      });
    });

    await go(user, 'Alertas');
    await user.click(screen.getByRole('button', { name: 'Criar primeira regra' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova regra' });
    await user.type(within(dialog).getByLabelText('Nome'), 'GPUs');
    await user.type(within(dialog).getByLabelText(/Palavras-chave/), 'RTX, promoção');
    await user.click(within(dialog).getByRole('button', { name: 'Criar regra' }));

    await waitFor(() => expect(useVault.getState().vault?.alerts).toHaveLength(1));
    expect(useVault.getState().vault!.alerts[0].keywords).toEqual(['RTX', 'promoção']);
    expect(await screen.findByText('RTX')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Ativar GPUs' }));
    await waitFor(() => expect(useVault.getState().vault!.alerts[0].enabled).toBe(false));
  });

  it('AI tab without a provider shows the empty state', async () => {
    const user = await bootApp();
    await createVaultThroughUi(user);
    await go(user, 'IA');
    expect(screen.getByText('Nenhum provedor configurado')).toBeInTheDocument();
  });
});
