import type { AiProvider, SummaryAction } from './types';

export const ACTION_LABELS: Record<SummaryAction, string> = {
  tldr: 'TL;DR',
  extract_links: 'Extrair links',
  solutions: 'Identificar soluções',
  compare_opinions: 'Comparar opiniões',
  translate: 'Traduzir (pt-BR)',
  explain_technical: 'Explicar tecnicamente',
};

const INSTRUCTIONS: Record<SummaryAction, string> = {
  tldr: 'Resuma o texto em no máximo 5 frases curtas.',
  extract_links: 'Liste todos os links e URLs presentes no texto, com uma breve descrição de cada um.',
  solutions: 'Identifique problemas descritos e as soluções ou respostas propostas, indicando as mais confiáveis.',
  compare_opinions: 'Compare as opiniões expressas no texto, agrupando prós e contras e quem defende cada posição.',
  translate: 'Traduza o texto para português do Brasil, mantendo o sentido original.',
  explain_technical: 'Explique o conteúdo técnico de forma didática, definindo os termos na primeira ocorrência.',
};

// Hard cap to keep prompts small and costs predictable.
export const MAX_INPUT_CHARS = 20_000;

/**
 * Sends only the selected text to the user's chosen provider, with the user's own key.
 * Runs in the browser for v1; a Worker proxy can replace this later without changing callers.
 */
export async function runSummary(provider: AiProvider, action: SummaryAction, text: string): Promise<string> {
  const input = text.slice(0, MAX_INPUT_CHARS);
  const system = `Você é um assistente que trabalha com conteúdo de fóruns. ${INSTRUCTIONS[action]} Responda em pt-BR.`;

  if (provider.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: input }],
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Erro ${res.status}`);
    return (json.content as { text?: string }[] | undefined)?.map((c) => c.text ?? '').join('').trim() ?? '';
  }

  // OpenAI-compatible endpoints (OpenAI and OpenRouter).
  const url =
    provider.provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Erro ${res.status}`);
  return ((json.choices?.[0]?.message?.content as string | undefined) ?? '').trim();
}
