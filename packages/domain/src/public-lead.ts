export function normalizePublicLeadPhone(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('PHONE_REQUIRED');

  if (raw.startsWith('+')) {
    const compact = `+${raw.slice(1).replace(/\D/g, '')}`;
    if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw new Error('PHONE_INVALID');
    return compact;
  }

  const digits = raw.replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  if (/^\d{10,11}$/.test(digits)) return `+55${digits}`;
  throw new Error('PHONE_INVALID');
}

export function normalizePublicLeadEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('EMAIL_INVALID');
  }
  return email;
}

export function normalizePublicLeadName(value: unknown): string {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 180) throw new Error('FULL_NAME_INVALID');
  return name;
}

export function optionalTrackingValue(value: unknown, max = 180): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error('TRACKING_VALUE_TOO_LONG');
  return text;
}

export function normalizeLandingPath(value: unknown): string | undefined {
  const text = optionalTrackingValue(value, 1000);
  if (!text) return undefined;
  if (!text.startsWith('/') || text.startsWith('//')) throw new Error('LANDING_PAGE_INVALID');
  return text;
}

export function normalizePublicSource(value: unknown): string {
  const source = optionalTrackingValue(value, 120)?.toLowerCase();
  return source ?? 'direct';
}
