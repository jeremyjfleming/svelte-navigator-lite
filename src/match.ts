import type { RouteDefinition } from './types.js';

type CompiledRoute = {
    name: string;
    pattern: string;
    regex: RegExp;
    paramNames: string[];
    guards: string[];
};

export type RouteMatch = {
    name: string;
    params: Record<string, string>;
};

export function compileRoutes(routes: RouteDefinition[]): CompiledRoute[] {
    return routes.map(route => {
        const paramNames: string[] = [];
        const regexStr = route.pattern
            // Escape regex special chars (except : and /)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            // Optional params /:name? — make the whole slash+segment optional together
            .replace(/\/:([a-zA-Z_][a-zA-Z0-9_]*)\?/g, (_, name) => {
                paramNames.push(name);
                return '(?:/([^/]*))?';
            })
            // Required params :name
            .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            });
        return {
            name: route.name,
            pattern: route.pattern,
            regex: new RegExp(`^${regexStr}/?$`),
            paramNames,
            guards: route.guards ?? [],
        };
    });
}

export function matchPath(compiled: CompiledRoute[], pathname: string): RouteMatch | null {
    for (const route of compiled) {
        const m = pathname.match(route.regex);
        if (!m) continue;
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
            const val = m[i + 1];
            if (val) params[name] = decodeURIComponent(val);
        });
        return { name: route.name, params };
    }
    return null;
}

// Build a URL path from a pattern and params.
// Optional params omitted from params are dropped cleanly.
export function buildPath(pattern: string, params: Record<string, string> = {}): string {
    const path = pattern
        .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)\?/g, (_, name) =>
            name in params ? encodeURIComponent(params[name]) : ''
        )
        .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
            if (!(name in params)) throw new Error(`[router] missing required param "${name}" for pattern "${pattern}"`);
            return encodeURIComponent(params[name]);
        })
        .replace(/\/+/g, '/')   // collapse double slashes left by dropped optional params
        .replace(/\/$/, '');    // strip trailing slash
    return path || '/';
}
