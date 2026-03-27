import type { AuthUser, SessionCompany } from '../types/auth';

import { Platform } from 'react-native';

const LOGIN_PATH = '/auth/login';
const DEFAULT_TIMEOUT_MS = 20_000;

export class LoginApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginApiError';
  }
}

function normalizeBaseUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (
    Platform.OS === 'android' &&
    (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))
  ) {
    return trimmed.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  if (Platform.OS === 'ios' && trimmed.includes('10.0.2.2')) {
    // `10.0.2.2` is Android emulator host loopback; for iOS simulator use localhost.
    return trimmed.replace(/10\.0\.2\.2/g, 'localhost');
  }
  return trimmed;
}

function swapHost(base: string, fromHost: string, toHost: string): string {
  return base.replace(new RegExp(fromHost.replace(/\./g, '\\.'), 'g'), toHost);
}

function buildFallbackBaseUrls(base: string): string[] {
  const out: string[] = [base];
  const hasLocalhost = base.includes('localhost');
  const hasLoopback = base.includes('127.0.0.1');
  const hasAndroidBridge = base.includes('10.0.2.2');

  // Always include loopback alternatives to survive wrong env values on iOS/Android simulators.
  if (hasLocalhost) {
    out.push(swapHost(base, 'localhost', '127.0.0.1'));
    out.push(swapHost(base, 'localhost', '10.0.2.2'));
  }
  if (hasLoopback) {
    out.push(swapHost(base, '127.0.0.1', 'localhost'));
    out.push(swapHost(base, '127.0.0.1', '10.0.2.2'));
  }
  if (hasAndroidBridge) {
    out.push(swapHost(base, '10.0.2.2', 'localhost'));
    out.push(swapHost(base, '10.0.2.2', '127.0.0.1'));
  }

  // If a LAN IP is configured but unreachable from emulator, add host loopback bridge as fallback.
  if (!hasAndroidBridge) {
    try {
      const u = new URL(base);
      const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
      if (isIpv4) {
        const auth = u.port ? `10.0.2.2:${u.port}` : '10.0.2.2';
        out.push(`${u.protocol}//${auth}${u.pathname}`.replace(/\/+$/, ''));
      }
    } catch {
      // Keep fallback best-effort only.
    }
  }

  // Preserve deterministic priority:
  // - Current platform preferred host first, then alternates.
  const deduped = Array.from(new Set(out));
  if (Platform.OS === 'ios') {
    deduped.sort((a, b) => {
      const rank = (v: string) =>
        v.includes('localhost') ? 0 : v.includes('127.0.0.1') ? 1 : v.includes('10.0.2.2') ? 2 : 3;
      return rank(a) - rank(b);
    });
  } else if (Platform.OS === 'android') {
    deduped.sort((a, b) => {
      const rank = (v: string) =>
        v.includes('10.0.2.2') ? 0 : v.includes('localhost') ? 1 : v.includes('127.0.0.1') ? 2 : 3;
      return rank(a) - rank(b);
    });
  }

  return deduped;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function pickData(root: Record<string, unknown>): Record<string, unknown> | null {
  const data = root.data;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return null;
}

function pickToken(root: Record<string, unknown>): string | null {
  const data = pickData(root);
  const fromData =
    data &&
    (asNonEmptyString(data.accessToken) ??
      asNonEmptyString(data.access_token) ??
      asNonEmptyString(data.token));
  if (fromData) return fromData;
  return (
    asNonEmptyString(root.accessToken) ??
    asNonEmptyString(root.access_token) ??
    asNonEmptyString(root.token) ??
    null
  );
}

function pickRefreshToken(root: Record<string, unknown>): string | null {
  const data = pickData(root);
  const fromData =
    data &&
    (asNonEmptyString(data.refreshToken) ?? asNonEmptyString(data.refresh_token));
  if (fromData) return fromData;
  return asNonEmptyString(root.refreshToken) ?? asNonEmptyString(root.refresh_token);
}

function pickAccessTokenExpiresAt(root: Record<string, unknown>): string | null {
  const data = pickData(root);
  const fromData =
    data &&
    (asNonEmptyString(data.accessTokenExpiresAt) ??
      asNonEmptyString(data.access_token_expires_at));
  if (fromData) return fromData;
  return (
    asNonEmptyString(root.accessTokenExpiresAt) ??
    asNonEmptyString(root.access_token_expires_at) ??
    null
  );
}

function pickUserObject(root: Record<string, unknown>): Record<string, unknown> | null {
  const u = root.user;
  if (u && typeof u === 'object') return u as Record<string, unknown>;
  const data = pickData(root);
  if (data) {
    const inner = data.user;
    if (inner && typeof inner === 'object') return inner as Record<string, unknown>;
  }
  return null;
}

function pickCompanyObject(root: Record<string, unknown>): Record<string, unknown> | null {
  const c = root.company;
  if (c && typeof c === 'object') return c as Record<string, unknown>;
  const data = pickData(root);
  if (data) {
    const inner = data.company;
    if (inner && typeof inner === 'object') return inner as Record<string, unknown>;
  }
  return null;
}

function buildDisplayName(raw: Record<string, unknown>): string {
  const name = asNonEmptyString(raw.name) ?? asNonEmptyString(raw.fullName);
  if (name) return name;
  const first = asNonEmptyString(raw.firstName) ?? asNonEmptyString(raw.first_name);
  const last = asNonEmptyString(raw.lastName) ?? asNonEmptyString(raw.last_name);
  if (first || last) return [first, last].filter(Boolean).join(' ').trim();
  return '';
}

/** Map common API user shapes into AuthUser + optional JSON snapshot for SQLite `profile_extra`. */
export function mapApiUserToAuthUser(raw: Record<string, unknown>): {
  authUser: AuthUser;
  profileExtraJson: string | null;
} {
  const idRaw = raw.id ?? raw.userId ?? raw.user_id ?? raw._id ?? raw.uuid;
  const id =
    idRaw != null && (typeof idRaw === 'string' || typeof idRaw === 'number')
      ? String(idRaw)
      : '';
  const email = asNonEmptyString(raw.email) ?? '';
  const name = buildDisplayName(raw) || email || id || 'User';
  const phone =
    asNonEmptyString(raw.phone) ?? asNonEmptyString(raw.phoneNumber) ?? asNonEmptyString(raw.mobile);
  const role = asNonEmptyString(raw.role) ?? asNonEmptyString(raw.userRole);
  const companyRaw = raw.companyId ?? raw.company_id ?? raw.companyID;
  const companyId =
    companyRaw != null && (typeof companyRaw === 'string' || typeof companyRaw === 'number')
      ? String(companyRaw).trim() || null
      : null;
  const avatarUrl =
    asNonEmptyString(raw.avatarUrl) ??
    asNonEmptyString(raw.avatar_url) ??
    asNonEmptyString(raw.photo) ??
    asNonEmptyString(raw.image);

  let profileExtraJson: string | null = null;
  try {
    profileExtraJson = JSON.stringify(raw);
  } catch {
    profileExtraJson = null;
  }

  return {
    authUser: {
      id: id || email,
      email,
      name,
      phone: phone ?? null,
      role: role ?? null,
      companyId,
      avatarUrl: avatarUrl ?? null,
    },
    profileExtraJson,
  };
}

export function mapApiCompany(raw: Record<string, unknown>): {
  company: SessionCompany;
  profileExtraJson: string | null;
} {
  const id =
    raw.id != null && (typeof raw.id === 'string' || typeof raw.id === 'number')
      ? String(raw.id).trim()
      : '';
  const name = asNonEmptyString(raw.name) ?? '';
  let profileExtraJson: string | null = null;
  try {
    profileExtraJson = JSON.stringify(raw);
  } catch {
    profileExtraJson = null;
  }
  return {
    company: {
      id,
      name,
      address: asNonEmptyString(raw.address),
      phone: asNonEmptyString(raw.phone),
      email: asNonEmptyString(raw.email),
      website: asNonEmptyString(raw.website),
      logo: asNonEmptyString(raw.logo),
    },
    profileExtraJson,
  };
}

function errorMessageFromBody(body: unknown, status: number): string {
  if (!body || typeof body !== 'object') return `Login failed (${status})`;
  const o = body as Record<string, unknown>;
  const msg = o.message ?? o.error ?? o.msg ?? o.detail;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  if (Array.isArray(o.message)) {
    const first = o.message[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'message' in first) {
      const m = (first as { message?: string }).message;
      if (typeof m === 'string') return m;
    }
  }
  return `Login failed (${status})`;
}

export type LoginSuccess = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  authUser: AuthUser;
  profileExtraJson: string | null;
  company: SessionCompany | null;
  companyExtraJson: string | null;
};

/**
 * POST JSON login. One round-trip; AbortController timeout; minimal parsing work on the JS thread.
 */
export async function postLogin(
  apiBase: string,
  email: string,
  password: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<LoginSuccess> {
  const normalizedBase = normalizeBaseUrl(apiBase.trim());
  if (!normalizedBase) throw new LoginApiError('Auth API base URL is empty');
  const candidateBases = buildFallbackBaseUrls(normalizedBase);
  let res: Response | null = null;
  let lastError: unknown = null;
  let lastUrl = '';

  for (const base of candidateBases) {
    const url = `${base}${LOGIN_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    lastUrl = url;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      break;
    } catch (e) {
      lastError = e;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!res) {
    if (lastError instanceof Error && lastError.name === 'AbortError') {
      let hint = '';
      if (Platform.OS === 'ios') {
        hint =
          ' On iOS physical device, use your Mac LAN IP (not localhost/10.0.2.2).';
      }
      throw new LoginApiError(`Login timed out at ${lastUrl}.${hint}`);
    }
    throw new LoginApiError(
      lastError instanceof Error ? `${lastError.message} (${lastUrl})` : `Network error (${lastUrl})`
    );
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    throw new LoginApiError(errorMessageFromBody(json ?? { message: text }, res.status));
  }

  if (!json) {
    throw new LoginApiError('Invalid response from server');
  }

  const statusField = asNonEmptyString(json.status);
  if (statusField && statusField.toLowerCase() !== 'success') {
    throw new LoginApiError(errorMessageFromBody(json, res.status));
  }

  const accessToken = pickToken(json);
  if (!accessToken) {
    throw new LoginApiError('No access token in response');
  }

  const userRaw = pickUserObject(json);
  if (!userRaw) {
    throw new LoginApiError('No user object in response');
  }

  const { authUser, profileExtraJson } = mapApiUserToAuthUser(userRaw);
  if (!authUser.email && !authUser.id) {
    throw new LoginApiError('User id/email missing in response');
  }

  const refreshToken = pickRefreshToken(json);
  const accessTokenExpiresAt = pickAccessTokenExpiresAt(json);

  let company: SessionCompany | null = null;
  let companyExtraJson: string | null = null;
  const companyRaw = pickCompanyObject(json);
  if (companyRaw) {
    const mapped = mapApiCompany(companyRaw);
    if (mapped.company.id) {
      company = mapped.company;
      companyExtraJson = mapped.profileExtraJson;
    }
  }

  const authUserWithCompany: AuthUser =
    company != null ? { ...authUser, companyId: company.id } : authUser;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    authUser: authUserWithCompany,
    profileExtraJson,
    company,
    companyExtraJson,
  };
}
