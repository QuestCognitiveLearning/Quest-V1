# `/src/services`

API and external-service wrappers. **Components never call `quest.entities.*`
or `quest.functions.invoke()` directly** — they import named functions from
this folder.

## Why

1. **Testability**: a service module can be mocked in isolation; a component
   that fetches data inline cannot.
2. **Single source of truth**: if the backend contract changes, exactly one
   file changes.
3. **Type safety**: services have explicit JSDoc shapes; components stay
   focused on rendering.

## Current modules

| File | Responsibility |
|---|---|
| `auth-service.js` | sign-in, sign-out, role assignment, password reset |
| `subscription-service.js` | Stripe price fetch, checkout session, billing portal |

## How to migrate a component

Replace direct SDK calls:

```js
// ❌ before
const user = await quest.auth.me();

// ✅ after
import { getCurrentUser } from '@/services/auth-service';
const user = await getCurrentUser();
```

## TODO

- [ ] Migrate `curriculum-service.js` (CRUD on curricula, units, subunits)
- [ ] Migrate `session-service.js` (learning sessions, progress, reviews)
- [ ] Migrate `class-service.js` (class roster, enrollments, join codes)
- [ ] Migrate `llm-service.js` (consolidate `utils/openai.jsx` here)
- [ ] Then update each `pages/*.jsx` to import from `/services` instead of
      the SDK.
