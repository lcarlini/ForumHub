import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_INPUT_CHARS, runSummary } from './ai';
import type { AiProvider } from './types';

const openai: AiProvider = { id: 'a', provider: 'openai', model: 'gpt-4.1-mini', apiKey: 'sk-test', label: 'OpenAI' };
const anthropic: AiProvider = { id: 'b', provider: 'anthropic', model: 'claude-haiku-5-5', apiKey: 'ak-test', label: 'Anthropic' };

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('runSummary', () => {
  it('calls OpenAI with the user key and returns the message text', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: '  resumo  ' } }] });
    const out = await runSummary(openai, 'tldr', 'texto da thread');
    expect(out).toBe('resumo');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string).model).toBe('gpt-4.1-mini');
  });

  it('routes OpenRouter to its own endpoint', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: 'ok' } }] });
    await runSummary({ ...openai, provider: 'openrouter' }, 'tldr', 'x');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('calls Anthropic with the direct-browser header and joins text blocks', async () => {
    const fetchMock = mockFetch({ content: [{ text: 'parte 1 ' }, { text: 'parte 2' }] });
    const out = await runSummary(anthropic, 'translate', 'hello');
    expect(out).toBe('parte 1 parte 2');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ak-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('truncates input to MAX_INPUT_CHARS', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: 'ok' } }] });
    await runSummary(openai, 'tldr', 'a'.repeat(MAX_INPUT_CHARS + 500));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[1].content.length).toBe(MAX_INPUT_CHARS);
  });

  it('surfaces the provider error message', async () => {
    mockFetch({ error: { message: 'invalid api key' } }, 401);
    await expect(runSummary(openai, 'tldr', 'x')).rejects.toThrow('invalid api key');
  });
});
