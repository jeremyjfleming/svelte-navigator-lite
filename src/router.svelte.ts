import { readable } from 'svelte/store';
import type { RouterConfig, Guard } from './types.js';
import { compileRoutes, matchPath, buildPath } from './match.js';

// Minimal page store — emits { url } on every navigation, compatible with SvelteKit's $app/stores shape.
function createPageStore() {
    if (typeof window === 'undefined') {
        return readable({ url: new URL('http://localhost/') }, () => {});
    }
    const getValue = () => ({ url: new URL(window.location.href) });
    return readable(getValue(), (set) => {
        const update = () => set(getValue());
        window.addEventListener('popstate', update);
        return () => window.removeEventListener('popstate', update);
    });
}

export const page = createPageStore();

export async function goto(path: string, { replaceState = false } = {}) {
    if (typeof window === 'undefined') return;
    const url = new URL(path, window.location.origin);
    const cleanPath = url.pathname + url.search + url.hash;
    const push = replaceState ? history.replaceState.bind(history) : history.pushState.bind(history);
    push({}, '', cleanPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

function _createRouter() {
    let state = $state({
        current: '',
        params: {} as Record<string, string>,
        searchParams: {} as Record<string, string>,
        notFound: false,
    });

    let compiled: ReturnType<typeof compileRoutes> = [];
    let guards: Record<string, Guard> = {};
    let fallback = '';

    // Recursively apply guards, detecting cycles.
    function applyGuards(routeName: string, visited = new Set<string>()): string {
        if (visited.has(routeName)) {
            console.warn(`[router] guard cycle detected at "${routeName}"`);
            return routeName;
        }
        visited.add(routeName);
        const route = compiled.find(r => r.name === routeName);
        if (!route) return fallback;
        for (const guardName of route.guards) {
            const guard = guards[guardName];
            if (guard?.condition()) return applyGuards(guard.redirectTo, visited);
        }
        return routeName;
    }

    function parseUrl(url: string) {
        const parsed = new URL(url);
        const match = matchPath(compiled, parsed.pathname);
        const rawName = match?.name ?? fallback;
        const resolved = applyGuards(rawName);

        // If a guard redirected, update the URL to reflect where we actually are.
        if (resolved !== rawName) {
            const target = compiled.find(r => r.name === resolved);
            if (target) history.replaceState({}, '', buildPath(target.pattern));
        }

        state.current = resolved;
        state.params = resolved === rawName ? (match?.params ?? {}) : {};
        state.searchParams = Object.fromEntries(parsed.searchParams.entries());
        state.notFound = !match && resolved === fallback;
    }

    return {
        get route()        { return state.current; },
        get params()       { return state.params; },
        get searchParams() { return state.searchParams; },
        get notFound()     { return state.notFound; },
        get meta()         { return compiled.find(r => r.name === state.current)?.meta; },

        is(route: string)            { return state.current === route; },
        matches(routes: string[])    { return routes.includes(state.current); },

        parseUrl,

        async navigate(routeName: string, params: Record<string, string> = {}, searchParams: Record<string, string> = {}) {
            if (!compiled.some(r => r.name === routeName)) {
                console.warn(`[router] unknown route: "${routeName}"`);
                return;
            }
            const resolved = applyGuards(routeName);
            const route = compiled.find(r => r.name === resolved);
            if (!route) return;
            // If guards redirected us to a different route, don't forward the original params.
            const resolvedParams = resolved === routeName ? params : {};
            const path = buildPath(route.pattern, resolvedParams);
            const qs = new URLSearchParams(searchParams).toString();
            await goto(path + (qs ? `?${qs}` : ''));
        },

        init(config: RouterConfig) {
            compiled = compileRoutes(config.routes);
            guards = config.guards ?? {};
            fallback = config.fallback;
            parseUrl(window.location.href);
            page.subscribe(p => parseUrl(p.url.toString()));
        },
    };
}

export { _createRouter };

export const router = _createRouter();

export function createRouter(config: RouterConfig) {
    router.init(config);
}
