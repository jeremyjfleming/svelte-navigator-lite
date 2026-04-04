import { readable } from 'svelte/store';

/**
 * Minimal replacement for SvelteKit's `page` store.
 * Emits `{ url: URL }` and updates on history navigation.
 */
function createPageStore() {
    if (typeof window === 'undefined') {
        return readable({ url: new URL('http://localhost/') }, () => {});
    }

    const getValue = () => ({ url: new URL(window.location.href) });

    return readable(getValue(), (set) => {
        const update = () => set(getValue());

        window.addEventListener('popstate', update);
        window.addEventListener('hashchange', update);

        return () => {
            window.removeEventListener('popstate', update);
            window.removeEventListener('hashchange', update);
        };
    });
}

export const page = createPageStore();

export async function goto(path: string, { replaceState = false } = {}) {
  if (typeof window === 'undefined') return;

  // 1. Create a URL object based on the current origin to "clean" the input
  // This prevents 'http://login' from being treated as a new domain
  const url = new URL(path, window.location.origin);

  // 2. Ensure we only take the pathname and search params
  const cleanPath = url.pathname + url.search + url.hash;

  const push = replaceState 
    ? history.replaceState.bind(history) 
    : history.pushState.bind(history);

  // 3. Use the cleaned path
  push({}, '', cleanPath);

  window.dispatchEvent(new PopStateEvent('popstate'));
}

interface RouterState {
    current: string;
    params: Record<string, string>;
    notFound: boolean;
}

export type Route = {
    rootPath: string;
    segments: ({ name?: string, enforceVal?: string, optional?: boolean })[];
    searchParams?: string[];
    routeGuards?: RouteGuard[];
}

export type RouteGuard = {
    fn: () => boolean;
    redirectTo: string;
}

export type RouteList = Record<string, Route>;



export type Router = ReturnType<typeof _createRouter>;




export function _createRouter(routeList: RouteList = {} as RouteList) {
    let state = $state<RouterState>({
        current: '',
        params: {},
        notFound: false,
    });

    let routes: RouteList = {} as RouteList;
    let rootRoute = '';

    function parseUrl(url: string) {
        const parsed = new URL(url);
        const path = parsed.pathname.slice(1);
        const segments = path.split('/').filter(Boolean);
        const searchParams = parsed.searchParams;


        for (const [routeName, route] of Object.entries(routes)) {
            if (route.rootPath !== segments[0]) continue;

            let params: Record<string, string> = {};
            let match = true;

            // Check segment count: URL must be within [required + 1, total + 1]
            const minSegments = route.segments.filter(s => !s.optional).length + 1;
            const maxSegments = route.segments.length + 1;
            if (segments.length < minSegments || segments.length > maxSegments) {
                match = false;
            }

            // Check segments
            for (let i = 0; i < route.segments.length && match; i++) {
                const routeSegment = route.segments[i];
                const urlSegment = segments[i + 1];
                if (routeSegment.enforceVal) {
                    if (urlSegment === undefined) break; // optional trailing enforceVal absent
                    if (urlSegment !== routeSegment.enforceVal) { match = false; }
                } else if (routeSegment.name) {
                    if (urlSegment === undefined) break; // optional trailing param absent
                    params[routeSegment.name] = urlSegment;
                }
            }

            if (match && route.searchParams) {
                for (const key of route.searchParams) {
                    const val = searchParams.get(key);
                    params[key] = val;
                }
            }

            if (match) {
                state.current = routeName;
                state.params = params;
                state.notFound = false;
                return;
            }
        }

        state.current = rootRoute;
        state.params = {};
        state.notFound = true;

        
    }

    return {
        get route() {
            return state.current;;
        },

        get params() {
            return state.params;
        },

        get notFound() {
            return state.notFound;
        },

        set rootRoute(route: string) {
            rootRoute = route;
        },

        is(route: string) {
            return state.current === route;
        },

        matches(routes: string[]) {
            return routes.includes(state.current);
        },

        parseUrl,

        async navigate(route: string, params?: Record<string, string>) {
            let path: string = routes[route].rootPath;

            for (const guard of routes[route].routeGuards || []) {
                if (guard.fn()) {
                    await this.navigate(guard.redirectTo);
                    return;
                }
            }

            for (const segment of routes[route].segments) {
                if (segment.enforceVal) {
                    path += `/${segment.enforceVal}`;
                }
                else if (segment.name) {
                    if (!params || !params[segment.name]) {
                        throw new Error(`Missing parameter ${segment.name} for route ${route}`);
                    }
                    path += `/${params[segment.name]}`;
                }
                
            }

            if (routes[route].searchParams) {
                const searchParams = new URLSearchParams();
                for (const param of routes[route].searchParams) {
                    if (params && params[param]) {
                        searchParams.set(param, params[param]!);
                    }
                }
                path += `?${searchParams.toString()}`;
            }
            
            await goto(path);
        },

        registerRoute(name: string, route: Route) {
            routes[name] = route;
        },

    

    };
}


export let router: Router = _createRouter();

export function createRouter(RouteList: RouteList, defaultRoute: string) {
    for (const [name, route] of Object.entries(RouteList)) {
        router.registerRoute(name, route);
    }

    router.rootRoute = defaultRoute;
    router.parseUrl(window.location.href);

    page.subscribe((p) => router.parseUrl(p.url.toString()));
}