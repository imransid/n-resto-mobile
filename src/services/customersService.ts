/**
 * Customers list for POS — customer dropdown.
 * Fetch from API when base URL is set; otherwise use fallback list.
 */

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
    const url = `${base.replace(/\/$/, '')}/customers`;
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
