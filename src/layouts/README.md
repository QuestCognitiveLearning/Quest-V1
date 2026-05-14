# `/src/layouts`

Page-level wrapper templates — the chrome that wraps page content (nav, sidebar, footer, auth gating).

## When to create a layout vs. a component

| Put it here if… | Put it in `/components` if… |
|---|---|
| It wraps `<Outlet />` or `children` representing a whole page | It's a reusable UI piece used inside pages |
| It owns shell concerns: nav, sidebar, header, footer | It's a primitive (button, card, modal) |
| It applies cross-cutting rules (auth redirect, role check) | It has no opinion on page-level layout |
| Multiple pages share the same outer frame | Only one page uses it |

## Current layouts

Right now the single layout (auth-gating + role-aware redirects + global chrome)
lives at [`src/Layout.jsx`](../Layout.jsx). It hasn't been moved here yet
because every page imports it from that path; moving it requires touching
every importer in one PR.

## Planned migration

```
src/Layout.jsx                      → src/layouts/main-layout.jsx
(maybe future) AuthLayout.jsx       → src/layouts/auth-layout.jsx       (signin/reset wrapper)
(maybe future) MarketingLayout.jsx  → src/layouts/marketing-layout.jsx  (landing/pricing/legal)
```

When you do the rename, update:
- `src/pages.config.js` (currently imports `./Layout.jsx`)
- Any direct `import Layout from "@/Layout"` references — none today, but
  grep before renaming.

## Naming convention

- File name: `kebab-case.jsx` (e.g., `main-layout.jsx`, `auth-layout.jsx`)
- Component name: `PascalCase` default export (e.g., `MainLayout`, `AuthLayout`)
- One layout per file. No bundling multiple layouts in one file.
