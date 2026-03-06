# Friend-AI Copilot Instructions

## Project Overview

**friend-ai** is a Next.js application with TypeScript and Tailwind CSS. The project is in early stages (v0.1.0) with a minimal structure focused on the main landing page. Future development should follow established patterns for Next.js App Router.

**Tech Stack:**
- **Framework:** Next.js 16.1.1 with App Router (file-based routing in `app/`)
- **Language:** TypeScript 5 with strict mode enabled
- **Styling:** Tailwind CSS v4 with PostCSS
- **Runtime:** React 19.2.3

## Architecture & Project Structure

### Directory Layout
- `app/` - Next.js App Router application root
  - `layout.tsx` - Root layout wrapper (metadata, fonts, global styles)
  - `page.tsx` - Home page component (main entry point)
  - `globals.css` - Global Tailwind styles and CSS variables
- `public/` - Static assets (images, icons)
- Config files at root: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`

### Key Architectural Decisions
1. **App Router Usage:** All new features should use the App Router pattern (`app/` directory), not the deprecated Pages Router
2. **Client vs Server Components:** Components default to Server Components in Next.js 13+; add `'use client'` only when interactivity is needed
3. **Font Loading:** Uses `next/font/google` for automatic font optimization (Geist family configured in [layout.tsx](app/layout.tsx#L5))
4. **Image Optimization:** Uses Next.js `Image` component for automatic optimization; see [page.tsx](app/page.tsx#L1) for usage pattern

## Development Workflows

### Getting Started
1. **Install dependencies:** `npm install`
2. **Start dev server:** `npm run dev` (watches for changes, runs on port 3000)
3. **Build for production:** `npm build` (creates optimized build in `.next/`)
4. **Start production server:** `npm start` (serves built assets)
5. **Lint code:** `npm run lint` (uses ESLint with Next.js presets)

### Debugging & Testing
- No test framework currently configured. If adding tests, use Jest (Next.js standard).
- Use `npm run build` to catch build-time TypeScript and Next.js errors before deployment.
- ESLint runs on `.ts` and `.tsx` files; ensure strict TS compilation catches errors early.

## Coding Conventions & Patterns

### TypeScript & Type Safety
- **Strict Mode Enabled:** All `tsconfig.json` strict checks are active; use proper type annotations
- **Path Aliases:** Use `@/*` for root-relative imports (e.g., `import { Component } from '@/components/...'`)
- **React Types:** Always import `type` for TypeScript types: `import type { Metadata } from 'next'`
- **Metadata Export:** Page/layout components should export `metadata` const for SEO: [layout.tsx example](app/layout.tsx#L15)

### Styling & Tailwind CSS
- **Utility-First Approach:** All styling uses Tailwind classes, no component-scoped CSS modules
- **CSS Globals:** Define global styles and CSS variables in [globals.css](app/globals.css)
- **Dark Mode:** Project includes dark mode utilities; use `dark:` prefix for dark variants (e.g., `dark:bg-black`)
- **Responsive Design:** Use Tailwind breakpoints (`sm:`, `md:`, `lg:`) for responsive layouts; see [page.tsx](app/page.tsx#L6) for patterns

### React Component Patterns
- **Server Components by Default:** Components are Server Components unless they need interactivity (`'use client'`)
- **Functional Components:** Use modern functional component syntax with TypeScript type annotations
- **Children Props:** Use `React.ReactNode` for children types: see [layout.tsx](app/layout.tsx#L20) pattern
- **Image Optimization:** Always use Next.js `Image` component for images in `public/` directory

## Integration Points & Dependencies

### External Dependencies
- **Next.js Built-ins:** Leverage `next/font`, `next/image`, `next/link` for optimizations
- **React 19:** Modern hooks and concurrent features available; no legacy patterns needed
- **Tailwind CSS v4:** Uses new `@tailwindcss/postcss` plugin; ensure PostCSS config is present

### Build & Deployment
- **Next.js Config:** [next.config.ts](next.config.ts) is empty (using defaults); extend here for custom Webpack or optimization rules
- **Environment Variables:** Create `.env.local` for local vars; use `process.env.VARIABLE_NAME` in server code
- **Vercel Integration:** Project is optimized for Vercel deployment (see Next.js template defaults)

## ESLint Configuration

- Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` presets
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts` (build artifacts)
- Run `npm run lint` to check compliance; most issues auto-fixable with `eslint --fix`

## Common Development Workflows

### Adding a New Page
1. Create `app/[route-name]/page.tsx` with default export component
2. Export metadata if SEO needed
3. Use Server Component pattern unless page needs interactivity
4. Import reusable components from future `components/` directory

### Adding Reusable Components
1. Create `components/ComponentName.tsx` for reusable pieces
2. Export as named export for tree-shaking
3. Use Server Components unless component uses hooks, event listeners, or browser APIs
4. Add `'use client'` at top of file if component needs interactivity

### Styling New Elements
1. Use Tailwind utility classes directly in JSX
2. Add global styles to [globals.css](app/globals.css) only for true globals (reset, fonts, CSS vars)
3. Component-specific Tailwind is preferred over scoped CSS

## Response Format Preferences

When providing solutions with multiple steps or points:
1. Use numbered lists for sequential tasks
2. Use bullet points for non-sequential items
3. Lead with the most critical action first
4. Provide code examples in separate blocks with file paths
5. End with a concise summary or next steps

---

**Last Updated:** January 2026  
**Applicable to:** Next.js 16.1.1, React 19.2.3, TypeScript 5.x
