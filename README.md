# svelte-navigator-lite

[![Publish Package](https://github.com/jeremyjfleming/svelte-navigator-lite/actions/workflows/npm-publish-github-packages.yml/badge.svg)](https://github.com/jeremyjfleming/svelte-navigator-lite/actions/workflows/npm-publish-github-packages.yml)
[![npm version](https://img.shields.io/npm/v/svelte-navigator-lite)](https://www.npmjs.com/package/svelte-navigator-lite)

A lightweight, pattern-based router for Svelte 5. Routes are defined with familiar URL patterns, guards are reusable named functions, and the reactive `router` singleton integrates directly with Svelte runes.

## Installation

```bash
npm install svelte-navigator-lite
```

## Quick start

Define your routes and guards, then call `createRouter` on mount.

```svelte
<!-- App.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { createRouter, router } from 'svelte-navigator-lite';
    import { auth } from '$stores/auth.svelte';
    import AppShell from '$lib/components/AppShell.svelte';
    import { overlayMap } from '$lib/routes';

    let currentOverlay = $derived(overlayMap[router.route] ?? null);

    onMount(() => {
        createRouter({
            routes: [
                { name: 'cal',      pattern: '/cal'                                   },
                { name: 'cal-date', pattern: '/cal/:mm/:dd/:yyyy'                     },
                { name: 'event',    pattern: '/event/:eventId',      meta: { overlay: true } },
                { name: 'edit',     pattern: '/event/:eventId/edit', meta: { overlay: true } },
                { name: 'login',    pattern: '/login',  guards: ['unauth'], meta: { overlay: true } },
                { name: 'signup',   pattern: '/signup', guards: ['unauth'], meta: { overlay: true } },
            ],
            guards: {
                auth:   { condition: () => !auth.isValid(), redirectTo: 'login' },
                unauth: { condition: () =>  auth.isValid(), redirectTo: 'cal'   },
            },
            fallback: 'cal',
        });
    });
</script>

<AppShell />
{#if router.meta?.overlay}
    <svelte:component this={currentOverlay} />
{/if}
```

## Route patterns

Patterns follow standard URL conventions.

| Pattern | Example URL | Params |
|---|---|---|
| `/cal` | `/cal` | `{}` |
| `/event/:eventId` | `/event/abc-123` | `{ eventId: 'abc-123' }` |
| `/event/:eventId/edit` | `/event/abc-123/edit` | `{ eventId: 'abc-123' }` |
| `/cal/:mm/:dd/:yyyy` | `/cal/05/13/2026` | `{ mm: '05', dd: '13', yyyy: '2026' }` |
| `/settings/:page?` | `/settings` or `/settings/account` | `{}` or `{ page: 'account' }` |

Append `?` to a param name to make it optional. Optional params must come at the end of the pattern.

## Navigating

```typescript
import { router } from 'svelte-navigator-lite';

// Static route
router.navigate('login');

// With path params
router.navigate('event', { eventId: '123' });

// With path params + search params
router.navigate('edit', { eventId: '123' }, { from: 'calendar' });
```

`navigate` returns a `Promise<void>`. Guards are evaluated before navigation — if a guard fires, the router redirects instead and original params are not forwarded.

## Reading state

```typescript
import { router } from 'svelte-navigator-lite';

router.route        // current route name: string
router.params       // path params: Record<string, string>
router.searchParams // query params: Record<string, string>
router.meta         // meta object for the current route (or undefined)
router.notFound     // true if the URL matched no route and the fallback was used

router.is('cal')                 // true if current route === 'cal'
router.matches(['cal', 'event']) // true if current route is in the list
```

All properties are reactive — use them in Svelte templates or `$effect` blocks and they update automatically on navigation.

## Route meta

Attach arbitrary metadata to any route via the `meta` field. The router exposes `router.meta` so your components can read it reactively.

```typescript
routes: [
    { name: 'cal',   pattern: '/cal'                                              },
    { name: 'event', pattern: '/event/:eventId',      meta: { overlay: true }    },
    { name: 'edit',  pattern: '/event/:eventId/edit', meta: { overlay: true }    },
    { name: 'admin', pattern: '/admin',               meta: { role: 'admin' }    },
]
```

```svelte
<!-- The base layout always renders -->
<AppShell />

<!-- Use any meta value to drive rendering -->
{#if router.meta?.overlay}
    <svelte:component this={overlayMap[router.route]} />
{/if}
```

`meta` is not interpreted by the router — it is plain data for your components to use however they need.

## Guards

Guards are defined once in `createRouter` and referenced by name in route definitions.

```typescript
createRouter({
    routes: [
        { name: 'cal',          pattern: '/cal',          guards: ['auth']              },
        { name: 'login',        pattern: '/login',        guards: ['unauth']            },
        { name: 'verify-email', pattern: '/verify-email', guards: ['unauth']            },
        { name: 'login-check',  pattern: '/login',        guards: ['unauth', 'emailCheck'] },
    ],
    guards: {
        auth: {
            condition: () => !auth.isValid(),
            redirectTo: 'login',
        },
        unauth: {
            condition: () => auth.isValid(),
            redirectTo: 'cal',
        },
        emailCheck: {
            condition: () => auth.containsCreds() && !auth.user?.verified,
            redirectTo: 'verify-email',
        },
    },
    fallback: 'cal',
});
```

**`condition`** — called before entering the route. Return `true` to trigger the redirect.

**`redirectTo`** — route name to navigate to instead.

Multiple guards on a route are checked in order; the first one that fires wins. Guard redirects are also checked for guards (recursively), with cycle detection to prevent infinite loops.

## `page` store

A Svelte readable store that emits `{ url: URL }` on every navigation. Compatible with SvelteKit's `$app/stores` page store shape.

```typescript
import { page } from 'svelte-navigator-lite';

page.subscribe(({ url }) => {
    console.log(url.pathname);
});
```

## `goto`

Low-level path navigation. Prefer `router.navigate` for named routes.

```typescript
import { goto } from 'svelte-navigator-lite';

await goto('/some/path');
await goto('/some/path', { replaceState: true }); // replace instead of push
```

## Migrating from v1

The `rootPath` + `segments` route definition is replaced by a single `pattern` string, `routeGuards` inline on each route are replaced by named guards defined once, and the new `meta` field replaces any separate modal-route maps you maintained manually.

```typescript
// v1
'edit': {
    rootPath: 'event',
    segments: [{ name: 'eventId' }, { enforceVal: 'edit' }],
    routeGuards: [{ fn: () => !auth.isValid(), redirectTo: 'login' }],
}

// v2
{ name: 'edit', pattern: '/event/:eventId/edit', guards: ['auth'], meta: { overlay: true } }
// guard defined once: auth: { condition: () => !auth.isValid(), redirectTo: 'login' }
```
