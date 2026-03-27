/**
 * Customers list for POS — customer dropdown.
 * Fetch from API when base URL is set; otherwise prefer WatermelonDB rows synced from getMasterData, then demo list.
 */

import { Platform } from 'react-native';
import { database } from '../database/databaseInstance';
import type Customer from '../database/Customer';

export interface CustomerItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

const FALLBACK_CUSTOMERS: CustomerItem[] = [
  { id: 'c1', name: 'Walk-in' },
  { id: 'c2', name: 'John Doe', phone: '+1 555 0100' },
  { id: 'c3', name: 'Jane Smith', email: 'jane@example.com' },
];

/**
 * Fetch customers from API. Uses storeConfig.customersApiBase + '/customers' when set. Returns fallback list when not set or request fails.
 */
export async function getCustomers(apiBase?: string): Promise<CustomerItem[]> {
  const base = (apiBase ?? '').trim();
  if (!base) {
    return FALLBACK_CUSTOMERS;
  }
  try {
    const normalizedBase =
      Platform.OS === 'android' && (base.includes('localhost') || base.includes('127.0.0.1'))
        ? base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2')
        : base;
    const url = `${normalizedBase.replace(/\/$/, '')}/customers`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return FALLBACK_CUSTOMERS;
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.data;
    if (Array.isArray(list)) {
      return list.map((c: { id?: string; name?: string; phone?: string; email?: string; customer_name?: string }) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? c.customer_name ?? ''),
        phone: c.phone != null ? String(c.phone) : undefined,
        email: c.email != null ? String(c.email) : undefined,
      })).filter((c: CustomerItem) => c.id && c.name);
    }
    return FALLBACK_CUSTOMERS;
  } catch {
    return FALLBACK_CUSTOMERS;
  }
}

/** When REST customers API is not configured, load customers synced from Food Service `getMasterData.customerList`. */
export async function getCustomersFromDb(): Promise<CustomerItem[]> {
  const rows = await database.get<Customer>('customers').query().fetch();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
  }));
}

/**
 * POS: REST API when `customersApiBase` is set; otherwise DB (master data) if non-empty, else demo list.
 */
export async function getCustomersForPos(customersApiBase?: string): Promise<CustomerItem[]> {
  const base = (customersApiBase ?? '').trim();
  if (base) {
    return getCustomers(base);
  }
  const fromDb = await getCustomersFromDb();
  if (fromDb.length > 0) return fromDb;
  return FALLBACK_CUSTOMERS;
}
