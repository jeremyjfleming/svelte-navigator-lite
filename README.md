# svelte-navigator-lite

A lightweight, label-based router for Svelte 5. Define named routes that map to URL patterns, then use `router.route` reactively — not just to show components, but for any logic that depends on where you are.

## Installation

```bash
npm install svelte-navigator-lite
```

## Setup

Call `createRouter` once at your app's entry point (e.g. `App.svelte`):

```ts
import { createRouter, router } from 'svelte-navigator-lite';
import type { RouteList } from 'svelte-navigator-lite';

const routes: RouteList = {
    'login': {
        rootPath: 'login',
        segments: [],
    },
    'dashboard': {
        rootPath: 'dashboard',
        segments: [],
    },
};

createRouter(routes, 'dashboard'); // second argument is the default/fallback route
```

Then use `router.route` anywhere in your Svelte components — it's a reactive Svelte 5 `$state` value:

```svelte
{#if router.is('login')}
    <Login />
{:else if router.is('dashboard')}
    <Dashboard />
{/if}
```

---

## Defining Routes

Every route has a `rootPath` — the first URL segment — and an array of `segments` for everything after it.

### Static routes

```ts
'login': {
    rootPath: 'login',  // matches /login
    segments: [],
}
```

### Dynamic params

Use `name` to capture a URL segment into `router.params`:

```ts
'event': {
    rootPath: 'event',
    segments: [{ name: 'eventId' }],  // matches /event/123
}
// router.params.eventId === '123'
```

### Enforced static segments

Use `enforceVal` to require a literal string at that position:

```ts
'create-calendar': {
    rootPath: 'calendar',
    segments: [{ enforceVal: 'create' }],  // matches /calendar/create only
}
```

### Mixed segments

`enforceVal` and `name` segments can be combined in any order:

```ts
'edit-event': {
    rootPath: 'event',
    segments: [
        { name: 'eventId' },        // matches /event/:eventId/edit
        { enforceVal: 'edit' },
    ],
}
```

### Optional segments

Add `optional: true` to make a trailing segment optional. Optional segments must come after all required segments.

```ts
'event': {
    rootPath: 'event',
    segments: [
        { name: 'eventId' },
        { enforceVal: 'edit', optional: true },  // matches /event/123 AND /event/123/edit
    ],
}
```

---

## Search Params

### Required search params

Declared in `searchParams`. The route only matches if all listed params are present in the URL. Their values are captured into `router.params`.

```ts
'password-reset': {
    rootPath: 'password-reset',
    segments: [],
    searchParams: ['token'],  // matches /password-reset?token=abc only
}
// router.params.token === 'abc'
```

### Optional search params

Declared in `optionalSearchParams`. Captured into `router.params` if present, silently ignored if absent. Do not affect whether the route matches.

```ts
'signup': {
    rootPath: 'signup',
    segments: [],
    optionalSearchParams: ['redirect'],  // matches /signup and /signup?redirect=/dashboard
}
// router.params.redirect === '/dashboard' (or undefined if absent)
```

---

## Navigating

### `router.navigate(route, params?)`

Navigate to a named route. Params are used to fill dynamic segments and search params.

```ts
router.navigate('event', { eventId: '123' });
// → /event/123

router.navigate('password-reset', { token: 'abc123' });
// → /password-reset?token=abc123
```

Throws if a required param is missing.

### `goto(path)`

Lower-level navigation to a raw path. Accepts an optional `{ replaceState: true }` option to replace instead of push.

```ts
import { goto } from 'svelte-navigator-lite';

goto('/login');
goto('/login', { replaceState: true });
```

---

## Route Guards

Guards run before navigation and redirect if their condition is met. `fn` returning `true` triggers the redirect.

```ts
import type { RouteGuard } from 'svelte-navigator-lite';

const guards = {
    authenticated: {
        fn: () => !auth.isValid(),   // redirect if NOT authenticated
        redirectTo: 'login',
    } satisfies RouteGuard,
    unauthenticated: {
        fn: () => auth.isValid(),    // redirect if already authenticated
        redirectTo: 'dashboard',
    } satisfies RouteGuard,
};

const routes: RouteList = {
    'login': {
        rootPath: 'login',
        segments: [],
        routeGuards: [guards.unauthenticated],
    },
    'dashboard': {
        rootPath: 'dashboard',
        segments: [],
        routeGuards: [guards.authenticated],
    },
};
```

Guards run in order and stop at the first redirect.

---

## API Reference

### `createRouter(routes, defaultRoute)`

Registers all routes and sets the fallback route. Parses the current URL immediately. Must be called once before using `router`.

### `router.route`

The label of the currently matched route. Falls back to `defaultRoute` if no route matches.

### `router.params`

An object containing all captured values — path params, required search params, and any present optional search params.

### `router.notFound`

`true` when the current URL did not match any defined route and the router fell back to `defaultRoute`. Use this to render a 404 state without needing a dedicated catch-all route.

```svelte
{#if router.notFound}
    <NotFound />
{:else if router.is('dashboard')}
    <Dashboard />
{/if}
```

### `router.navigate(route, params?)`

Navigate to a named route, applying guards and building the URL from the route definition.

### `router.is(route)`

Returns `true` if `router.route === route`. Useful for active link styling.

```ts
class:active={router.is('dashboard')}
```

### `router.matches(routes)`

Returns `true` if `router.route` is any of the provided route names.

```ts
class:active={router.matches(['dashboard', 'settings'])}
```

### `page`

A readable Svelte store that emits `{ url: URL }` and updates on every navigation. Useful when you need the raw URL.

```ts
import { page } from 'svelte-navigator-lite';

$page.url.pathname;
```

---

## Matching Rules

- Routes are matched in the order they are defined — first match wins.
- `rootPath` is always required and must match the first URL segment exactly.
- Segment count must be between `required segments + 1` and `total segments + 1` (the `+1` accounts for `rootPath`).
- A route with no segments only matches its `rootPath` with nothing after it (e.g. `/login` not `/login/extra`).
- Unmatched URLs fall back to the `defaultRoute`.
