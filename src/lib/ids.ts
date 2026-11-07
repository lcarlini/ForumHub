export const newId = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().split('-')[0]}${Date.now().toString(36)}`;
