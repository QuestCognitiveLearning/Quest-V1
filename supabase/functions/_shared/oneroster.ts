// deno-lint-ignore-file no-explicit-any
//
// OneRoster v1.1 client for ClassLink's OAuth2 proxy
// (https://oneroster-proxy.apis.classlink.com). One partner-level bearer
// token authenticates everything; the proxy signs requests toward each
// district's Roster Server with OAuth1 on our behalf.
//
// Design constraints (see ClassLink "Roster Server Integrations" parts 3-5):
//   - Paginate with limit/offset, sorted by sourcedId for stability.
//   - Delta sync with filter=dateLastModified>'<ISO>' after the first full
//     sync.
//   - 429: back off honoring Retry-After, exponential + jitter otherwise.
//   - 502/503/504: retry with a smaller page size (offset is row-based, so
//     shrinking `limit` mid-walk is safe as long as offset advances by rows
//     actually received, which it does).
//   - Per-run request budget so a bug can never hammer the API all night.
//
// Data minimization is enforced HERE, at the parse boundary: pickFields()
// drops everything not listed for the entity, so fields Quest marked
// "Not Supported" in docs/classlink-roster-server-profile.md never even
// reach the sync engine, let alone the database.
//
// The proxy's data-path shape isn't documented precisely enough to hardcode,
// so resolveDataBaseUrl() probes the known candidates once per tenant and the
// caller persists the winner (classlink_sync_tenants.data_base_url).

const PROXY_BASE = Deno.env.get('CLASSLINK_PROXY_BASE') ??
  'https://oneroster-proxy.apis.classlink.com';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OneRosterClientOpts {
  apiKey: string;
  fetchImpl?: FetchLike;
  pageSize?: number;        // starting limit; shrinks on 5xx
  maxRetries?: number;
  requestBudget?: number;   // hard cap on HTTP requests per client instance
  sleep?: (ms: number) => Promise<void>;
}

// Only the fields Quest consumes, per entity. Everything else is dropped.
const ENTITY_FIELDS: Record<string, string[]> = {
  orgs: ['sourcedId', 'status', 'dateLastModified', 'name', 'type', 'parentSourcedId', 'parent'],
  academicSessions: [
    'sourcedId', 'status', 'dateLastModified', 'title', 'type',
    'startDate', 'endDate', 'schoolYear', 'parentSourcedId', 'parent',
  ],
  users: [
    'sourcedId', 'status', 'dateLastModified', 'enabledUser', 'orgSourcedIds',
    'orgs', 'role', 'username', 'givenName', 'familyName', 'email',
  ],
  classes: [
    'sourcedId', 'status', 'dateLastModified', 'title', 'classType',
    'courseSourcedId', 'course', 'schoolSourcedId', 'school',
    'termSourcedIds', 'terms', 'grades', 'location', 'subjects', 'periods',
  ],
  enrollments: [
    'sourcedId', 'status', 'dateLastModified', 'classSourcedId', 'class',
    'schoolSourcedId', 'school', 'userSourcedId', 'user', 'role', 'primary',
    'beginDate', 'endDate',
  ],
};

// OneRoster JSON wraps collections in a rootless envelope keyed by entity
// name ({"orgs": [...]}). The proxy occasionally returns the array bare.
function unwrap(entity: string, body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.[entity])) return body[entity];
  // v1.1 envelope keys are camelCase entity names; tolerate a few variants.
  for (const k of Object.keys(body ?? {})) {
    if (Array.isArray(body[k])) return body[k];
  }
  return [];
}

function pickFields(entity: string, raw: any): any {
  const keep = ENTITY_FIELDS[entity];
  if (!keep) return raw;
  const out: any = {};
  for (const k of keep) if (raw?.[k] !== undefined) out[k] = raw[k];
  return out;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class OneRosterClient {
  private apiKey: string;
  private fetchImpl: FetchLike;
  private pageSize: number;
  private maxRetries: number;
  private budget: number;
  private sleep: (ms: number) => Promise<void>;
  requestCount = 0;

  constructor(opts: OneRosterClientOpts) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.pageSize = opts.pageSize ?? 500;
    this.maxRetries = opts.maxRetries ?? 5;
    this.budget = opts.requestBudget ?? 2000;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  // Single GET with 429/5xx retry. Throws on budget exhaustion or terminal
  // failure. Never logs URLs with tokens or response bodies (PII).
  // Takes a URL *builder* so a 502-triggered pageSize shrink applies to the
  // retry of the failing request itself, not just to subsequent pages.
  private async get(
    buildUrl: string | ((pageSize: number) => string),
  ): Promise<{ status: number; body: any }> {
    let attempt = 0;
    while (true) {
      if (this.requestCount >= this.budget) {
        throw new Error(`OneRoster request budget (${this.budget}) exhausted`);
      }
      this.requestCount++;
      const url = typeof buildUrl === 'string' ? buildUrl : buildUrl(this.pageSize);
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        });
      } catch (e) {
        // Network-level failure — retry like a 5xx.
        if (++attempt > this.maxRetries) throw e;
        await this.sleep(1000 * 2 ** attempt + Math.random() * 500);
        continue;
      }
      if (res.status === 429) {
        if (++attempt > this.maxRetries) {
          throw new Error('OneRoster rate limit: retries exhausted (429)');
        }
        const retryAfter = Number(res.headers.get('Retry-After'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt + Math.random() * 500;
        await res.body?.cancel();
        await this.sleep(waitMs);
        continue;
      }
      if (res.status >= 500) {
        if (++attempt > this.maxRetries) {
          throw new Error(`OneRoster upstream error ${res.status}: retries exhausted`);
        }
        // ClassLink guidance: 502s usually mean the page is too heavy.
        this.pageSize = Math.max(50, Math.floor(this.pageSize / 2));
        await res.body?.cancel();
        await this.sleep(1000 * 2 ** attempt + Math.random() * 500);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OneRoster GET failed: ${res.status} ${text.slice(0, 200)}`);
      }
      return { status: res.status, body: await res.json() };
    }
  }

  // GET /applications — every district that granted Quest access.
  async listApplications(): Promise<any[]> {
    const { body } = await this.get(`${PROXY_BASE}/applications`);
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.applications)) return body.applications;
    for (const k of Object.keys(body ?? {})) {
      if (Array.isArray(body[k])) return body[k];
    }
    return [];
  }

  // The proxy routes data requests per application, but the exact path shape
  // varies; probe the known candidates with a 1-row orgs request and return
  // the first base URL that answers. Caller persists the result per tenant.
  async resolveDataBaseUrl(appId: string): Promise<string> {
    const encoded = encodeURIComponent(appId);
    const candidates = [
      `${PROXY_BASE}/${encoded}/ims/oneroster/v1p1`,
      `${PROXY_BASE}/applications/${encoded}/ims/oneroster/v1p1`,
      `${PROXY_BASE}/${encoded}`,
    ];
    for (const base of candidates) {
      try {
        const { body } = await this.get(`${base}/orgs?limit=1&offset=0`);
        if (body && typeof body === 'object') return base;
      } catch {
        // try the next shape
      }
    }
    throw new Error('Could not resolve OneRoster data base URL for application');
  }

  // Paged walk of one entity collection. Yields minimized records. `since`
  // (ISO timestamp) switches the walk to a delta pull.
  async *pages(
    dataBaseUrl: string,
    entity: keyof typeof ENTITY_FIELDS | string,
    since?: string | null,
  ): AsyncGenerator<any[]> {
    let offset = 0;
    while (true) {
      const buildUrl = (pageSize: number) => {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
          sort: 'sourcedId',
          orderBy: 'asc',
        });
        if (since) params.set('filter', `dateLastModified>'${since}'`);
        return `${dataBaseUrl}/${entity}?${params}`;
      };
      const { body } = await this.get(buildUrl);
      const items = unwrap(String(entity), body).map((r) => pickFields(String(entity), r));
      if (items.length === 0) return;
      yield items;
      // Offset is row-based; advance by rows actually received so shrinking
      // pageSize after a 502 stays aligned.
      offset += items.length;
      if (items.length < this.pageSize) return;
    }
  }

  async fetchAll(
    dataBaseUrl: string,
    entity: string,
    since?: string | null,
  ): Promise<any[]> {
    const all: any[] = [];
    for await (const page of this.pages(dataBaseUrl, entity, since)) all.push(...page);
    return all;
  }
}
