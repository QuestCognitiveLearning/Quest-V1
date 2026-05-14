// Strict, schema-based input validator for Supabase Edge Functions.
//
// Goals (OWASP-aligned)
//   - Type enforcement (string / number / boolean / enum / array / object / url / email / iso-date)
//   - Length / range limits (prevent buffer & abuse-pattern attacks)
//   - Whitelist enums (reject anything unexpected)
//   - Strict field policy by default (reject unknown keys — no mass-assignment)
//   - Email normalization (lowercase, trim)
//   - URL scheme allowlist (http/https only)
//
// Usage
//   const { ok, value, errors } = validate(body, {
//     priceId:    { type: 'string', maxLength: 64, pattern: /^price_[A-Za-z0-9]+$/ },
//     successUrl: { type: 'url' },
//     cancelUrl:  { type: 'url' },
//   });
//   if (!ok) return json({ error: 'Bad request', details: errors }, 400);
//
// Returns the validated/normalized value. Anything not in the schema is dropped.
// deno-lint-ignore-file no-explicit-any

export type FieldType =
  | 'string' | 'number' | 'integer' | 'boolean'
  | 'email' | 'url' | 'iso-date'
  | 'enum' | 'array' | 'object';

export interface FieldSpec {
  type: FieldType;
  required?: boolean;
  /** strings */
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /** numbers */
  min?: number;
  max?: number;
  /** enums */
  values?: readonly string[];
  /** arrays */
  items?: FieldSpec;
  maxItems?: number;
  /** objects */
  properties?: Record<string, FieldSpec>;
  /** url scheme allowlist (defaults to http/https) */
  schemes?: readonly string[];
}

export type Schema = Record<string, FieldSpec>;

export interface ValidationResult {
  ok: boolean;
  value: Record<string, any>;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function validateField(name: string, raw: unknown, spec: FieldSpec, errors: string[]): any {
  if (raw === undefined || raw === null) {
    if (spec.required) errors.push(`${name} is required`);
    return undefined;
  }
  switch (spec.type) {
    case 'string': {
      if (typeof raw !== 'string') { errors.push(`${name} must be a string`); return undefined; }
      const v = raw.trim();
      if (spec.minLength != null && v.length < spec.minLength) errors.push(`${name} too short`);
      if (spec.maxLength != null && v.length > spec.maxLength) errors.push(`${name} too long`);
      if (spec.pattern && !spec.pattern.test(v)) errors.push(`${name} has invalid format`);
      return v;
    }
    case 'number': {
      const n = typeof raw === 'string' ? Number(raw) : raw;
      if (typeof n !== 'number' || Number.isNaN(n)) { errors.push(`${name} must be a number`); return undefined; }
      if (spec.min != null && n < spec.min) errors.push(`${name} below minimum`);
      if (spec.max != null && n > spec.max) errors.push(`${name} above maximum`);
      return n;
    }
    case 'integer': {
      const n = typeof raw === 'string' ? Number(raw) : raw;
      if (!Number.isInteger(n)) { errors.push(`${name} must be an integer`); return undefined; }
      if (spec.min != null && (n as number) < spec.min) errors.push(`${name} below minimum`);
      if (spec.max != null && (n as number) > spec.max) errors.push(`${name} above maximum`);
      return n;
    }
    case 'boolean':
      if (typeof raw !== 'boolean') { errors.push(`${name} must be a boolean`); return undefined; }
      return raw;
    case 'email': {
      if (typeof raw !== 'string') { errors.push(`${name} must be an email string`); return undefined; }
      const v = raw.trim().toLowerCase();
      if (!EMAIL_RE.test(v) || v.length > 254) errors.push(`${name} is not a valid email`);
      return v;
    }
    case 'url': {
      if (typeof raw !== 'string') { errors.push(`${name} must be a url string`); return undefined; }
      try {
        const u = new URL(raw);
        const allowed = spec.schemes ?? ['http:', 'https:'];
        if (!allowed.includes(u.protocol)) errors.push(`${name} scheme not allowed`);
        if (raw.length > 2048) errors.push(`${name} too long`);
        return u.toString();
      } catch {
        errors.push(`${name} is not a valid URL`);
        return undefined;
      }
    }
    case 'iso-date': {
      if (typeof raw !== 'string' || !ISO_RE.test(raw)) { errors.push(`${name} must be ISO datetime`); return undefined; }
      return raw;
    }
    case 'enum': {
      if (typeof raw !== 'string' || !spec.values?.includes(raw)) {
        errors.push(`${name} must be one of: ${spec.values?.join(', ')}`);
        return undefined;
      }
      return raw;
    }
    case 'array': {
      if (!Array.isArray(raw)) { errors.push(`${name} must be an array`); return undefined; }
      if (spec.maxItems != null && raw.length > spec.maxItems) {
        errors.push(`${name} too many items`); return undefined;
      }
      if (!spec.items) return raw;
      return raw.map((item, i) => validateField(`${name}[${i}]`, item, spec.items!, errors))
                .filter((v) => v !== undefined);
    }
    case 'object': {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push(`${name} must be an object`); return undefined;
      }
      const out: Record<string, any> = {};
      for (const [k, s] of Object.entries(spec.properties ?? {})) {
        out[k] = validateField(`${name}.${k}`, (raw as any)[k], s, errors);
      }
      return out;
    }
  }
}

/** Strict by default: keys NOT in the schema are silently dropped. */
export function validate(input: unknown, schema: Schema): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, value: {}, errors: ['body must be a JSON object'] };
  }
  const out: Record<string, any> = {};
  for (const [name, spec] of Object.entries(schema)) {
    const v = validateField(name, (input as any)[name], spec, errors);
    if (v !== undefined) out[name] = v;
  }
  return { ok: errors.length === 0, value: out, errors };
}
