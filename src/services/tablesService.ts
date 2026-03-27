/**
 * Tables list for POS — table number dropdown.
 * Fetch from API when base URL is set; otherwise use fallback list.
 */
import { Platform } from 'react-native';

export interface TableItem {
  id: string;
  number: string;
  name?: string;
}

const FALLBACK_TABLES: TableItem[] = [
  { id: '1', number: '1' },
  { id: '2', number: '2' },
  { id: '3', number: '3' },
  { id: '4', number: '4' },
  { id: '5', number: '5' },
  { id: '6', number: '6' },
  { id: '7', number: '7' },
  { id: '8', number: '8' },
  { id: '9', number: '9' },
  { id: '10', number: '10' },
];

/**
 * Fetch tables from API. Uses storeConfig.tablesApiBase + '/tables' when set. Returns fallback list when not set or request fails.
 */
export async function getTables(apiBase?: string): Promise<TableItem[]> {
  const base = (apiBase ?? '').trim();
  if (!base) {
    return FALLBACK_TABLES;
  }
  try {
    const normalizedBase =
      Platform.OS === 'android' &&
      (base.includes('localhost') || base.includes('127.0.0.1'))
        ? base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2')
        : base;
    const url = `${normalizedBase.replace(/\/$/, '')}/tables`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return FALLBACK_TABLES;
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((t: { id?: string; number?: string; name?: string }) => ({
        id: String(t.id ?? t.number ?? ''),
        number: String(t.number ?? t.id ?? ''),
        name: t.name != null ? String(t.name) : undefined,
      }));
    }
    if (data?.data && Array.isArray(data.data)) {
      return data.data.map(
        (t: { id?: string; number?: string; name?: string }) => ({
          id: String(t.id ?? t.number ?? ''),
          number: String(t.number ?? t.id ?? ''),
          name: t.name != null ? String(t.name) : undefined,
        }),
      );
    }
    return FALLBACK_TABLES;
  } catch {
    return FALLBACK_TABLES;
  }
}
