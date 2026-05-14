export type RouteDefinition = {
    name: string;
    pattern: string;    // e.g. '/cal', '/event/:eventId', '/event/:eventId/edit', '/settings/:page?'
    guards?: string[];  // guard names, checked in order
    overlay?: boolean;  // true = renders as an overlay on top of the base layout
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
