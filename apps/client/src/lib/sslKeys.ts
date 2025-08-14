export type SSLKey = {
  id: string;
  name: string;
  createdAt: string;
};

const STORAGE_KEY = "OpsiMate-ssl-keys";

export function getSslKeys(): SSLKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SSLKey[];
  } catch {
    return [];
  }
}

export function addSslKey(name: string): SSLKey {
  const keys = getSslKeys();
  const key: SSLKey = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` , name, createdAt: new Date().toISOString() };
  const next = [key, ...keys];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return key;
}

export function deleteSslKey(id: string): void {
  const keys = getSslKeys();
  const next = keys.filter(k => k.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}


