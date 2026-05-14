export type RouteDefinition = {
    name: string;
    pattern: string;    // e.g. '/cal', '/event/:eventId', '/event/:eventId/edit', '/settings/:page?'
    guards?: string[];  // guard names, checked in order
    meta?: Record<string, unknown>;
};

export type Guard = {
    condition: () => boolean; // true = redirect should fire
    redirectTo: string;       // route name to redirect to
};

export type RouterConfig = {
    routes: RouteDefinition[];
    guards?: Record<string, Guard>;
    fallback: string; // route name to use when URL matches nothing
};
