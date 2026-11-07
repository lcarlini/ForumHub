// Decrypted vault document. Only ever exists in memory after unlock.
export interface Vault {
  version: 1;
  updatedAt: string;
  profile: { displayName: string; theme: 'dark' | 'light'; language: string };
  forums: Forum[];
  favorites: Favorite[];
  alerts: AlertRule[];
  aiProviders: AiProvider[];
  summaries: SavedSummary[];
  activity: ActivityEntry[];
}

export interface Forum {
  id: string;
  name: string;
  url: string;
  group: ForumGroup;
  description: string;
  favorite: boolean;
  credentials: { username: string; password: string; notes: string };
  feed?: { type: 'rss'; url: string; enabled: boolean };
  lastOpenedAt?: string;
  openCount: number;
  createdAt: string;
}

export type ForumGroup = 'tech' | 'hardware' | 'deals' | 'gaming' | 'career' | 'other';

export interface Favorite {
  id: string;
  kind: 'forum' | 'thread' | 'search' | 'shortcut';
  label: string;
  target: string; // forum id, thread URL, search query or shortcut URL
}

export interface AlertRule {
  id: string;
  name: string;
  sourceId: string;
  type: 'new_item' | 'keyword' | 'author' | 'regex' | 'price';
  keywords: string[];
  schedule: 'hourly' | 'every_6_hours' | 'daily' | 'weekly';
  channels: ('in_app' | 'push' | 'email' | 'telegram' | 'discord')[];
  enabled: boolean;
  quietHours?: { start: string; end: string };
  lastCheckedAt?: string;
  lastMatch?: string;
}

export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface AiProvider {
  id: string;
  provider: AiProviderId;
  model: string;
  apiKey: string;
  label: string;
}

export type SummaryAction =
  | 'tldr'
  | 'extract_links'
  | 'solutions'
  | 'compare_opinions'
  | 'translate'
  | 'explain_technical';

export interface SavedSummary {
  id: string;
  sourceUrl?: string;
  title: string;
  model: string;
  provider: AiProviderId;
  promptType: SummaryAction;
  summary: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  text: string;
}
