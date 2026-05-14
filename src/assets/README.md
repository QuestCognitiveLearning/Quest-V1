# `/src/assets`

Raw source assets that **get processed at build time** — SVG icons that need
recoloring, illustrations imported into components, unoptimized images you
want Vite to fingerprint and emit WebP/AVIF for.

## `/src/assets` vs `/public` — when to use which

| Goal | Put it in `/src/assets` | Put it in `/public` |
|---|---|---|
| Import into a component (`import logo from '@/assets/logo.svg'`) | ✅ | ❌ |
| Get a hashed filename in the build (cache-busting) | ✅ | ❌ |
| Inline as a React component via `?react` (SVGR) | ✅ | ❌ |
| Generate WebP/AVIF variants automatically | ✅ | ❌ |
| Reference by URL path at root (`/quest-logo.png`) | ❌ | ✅ |
| Loaded by `<img src="/...">` directly from HTML | ❌ | ✅ |
| Robots.txt, sitemap.xml, OG share images | ❌ | ✅ |

Today most images live in `/public` because they're referenced as URLs from
landing components. As we add real product imagery (icons, illustrations),
they'll come here so they go through the Vite asset pipeline.

## Conventions

- Subfolder per asset type: `icons/`, `illustrations/`, `logos/`, `images/`.
- Filenames: `kebab-case.svg`, `kebab-case.png`.
- One asset per file. No sprite-sheets unless intentional and documented.
- Prefer SVG over PNG for anything geometric (icons, logos, diagrams).
- For multi-state icons (filled/outline), name them
  `icon-name-filled.svg` and `icon-name-outline.svg`.

## TODO

- [ ] Install `vite-imagetools` so PNG/JPG imports emit WebP+AVIF variants
      automatically with a `<picture>` element wrapper.
- [ ] Install `vite-plugin-svgr` so `.svg?react` imports render as React
      components (lets us recolor via `currentColor`).
- [ ] Migrate `public/quest-logo.png` here once the above are wired up so
      we get cache-busting + WebP variants for the brand logo.
