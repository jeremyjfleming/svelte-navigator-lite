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
}

export type Route = {
    rootPath: string;
    segments: ({ name?: string, enforceVal?: string })[];
    searchParams?: string[];
    routeGuards?: RouteGuard[];
}

export type RouteGuard = {
    fn: () => boolean;
    redirectTo: string;
}

export type RouteList = Record<string, Route>;



export type Router = ReturnType<typeof _createRouter>;




export function _createRouter(RouteList: RouteList = {} as RouteList) {
    let state = $state<RouterState>({
        current: '',
        params: {},
    });

    let routes: RouteList = {} as RouteList;

    function parseUrl(url: string) {
        const path = new URL(url).pathname.slice(1);
        const segments = path.split('/').filter(Boolean);


        for (const [routeName, route] of Object.entries(routes)) {
            if (route.rootPath !== segments[0]) continue;

            let params: Record<string, string> = {};
            let match = true;

            // Check segments
            for (let i = 0; i < route.segments.length; i++) {
                const routeSegment = route.segments[i];
                const urlSegment = segments[i + 1];
                if (routeSegment.enforceVal) {
                    if (urlSegment !== routeSegment.enforceVal) {
                        match = false;
                        break;
                    }
                } else if (routeSegment.name) {
                    if (!urlSegment) {
                        match = false;
                        break;
                    }
                    params[routeSegment.name] = urlSegment;
                }
            }
            

            if (match) {
                state.current = routeName;
                state.params = params;
                return;
            }
        }

        // Fallback to cal route
        state.current = 'cal';
        state.params = {};

        // if (segments[0] === 'login') {
        //     state.current = 'login';
        //     state.params = {};
        // } else if (segments[0] === 'signup') {
        //     state.current = 'signup';
        //     state.params = {};
        // } else if (segments[0] === 'signup' && new URLSearchParams(new URL(url).search).get('redirect')) {
        //     state.current = 'signup';
        //     state.params = { redirect: new URLSearchParams(new URL(url).search).get('redirect')! };
        // } else if (segments[0] === 'verify-email') {
        //     state.current = 'verify-email';
        //     state.params = {};
        // } else if (segments[0] === 'cal' && segments.length === 4) {
        //     state.current = 'cal-date';
        //     state.params = { mm: segments[1], dd: segments[2], yyyy: segments[3] };
        // } else if (segments[0] === 'cal' && segments.length === 1) {
        //     state.current = 'cal';
        //     state.params = {};
        // } else if (segments[0] === 'event' && segments[1] && segments[2] === 'edit') {
        //     state.current = 'edit';
        //     state.params = { eventId: segments[1] };
        // } else if (segments[0] === 'event' && segments[1]) {
        //     state.current = 'event';
        //     state.params = { eventId: segments[1] };
        // } else if (segments[0] === 'settings') {
        //     state.current = 'settings';
        //     state.params = {};
        // } else if (segments[0] === 'forgot-password') {
        //     state.current = 'forgot-password';
        //     state.params = {};
        // } else if (segments[0] === 'password-reset' && new URLSearchParams(new URL(url).search).get('token')) {
        //     state.current = 'password-reset';
        //     state.params = { token: new URLSearchParams(new URL(url).search).get('token')! };
        // } else if (segments[0] === 'groups') {
        //     state.current = 'groups';
        //     state.params = {};
        // } else if (segments[0] === 'create') {
        //     state.current = 'create';
        //     state.params = {};
        // } else if (segments[0] === 'calendar' && segments[1] === 'create') {
        //     state.current = 'create-calendar';
        //     state.params = {};
        // } else if (segments[0] === 'calendar' && segments[1] && segments[2] === 'edit') {
        //     state.current = 'edit-calendar';
        //     state.params = { calendarId: segments[1] };
        // } else if (segments[0] === 'cal' && segments[1] === 'public' && segments[2]) {
        //     state.current = 'public-calendar';
        //     state.params = { calendarId: segments[2] };
        // } else {
        //     state.current = 'cal';
        //     state.params = {};
        // }
    }

    page.subscribe((p) => parseUrl(p.url.toString()));

    return {
        get route() {
            return state.current;;
        },

        get params() {
            return state.params;
        },
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
            
            // if (route === 'cal-date' && params) {
            //     path = `/cal/${params.mm}/${params.dd}/${params.yyyy}`;
            // } else if (route === 'event' && params) {
            //     path = `/event/${params.eventId}`;
            // } else if (route === 'edit' && params) {
            //     path = `/event/${params.eventId}/edit`;
            // } else if (route === 'create-calendar') {
            //     path = '/calendar/create';
            // } else if (route === 'edit-calendar' && params) {
            //     path = `/calendar/${params.calendarId}/edit`;
            // } else if (route === 'public-calendar' && params) {
            //     path = `/cal/public/${params.calendarId}`;
            // } else if (route === 'password-reset' && params) {
            //     path = '/password-reset?token=' + params.token;
            // } else if (route === 'cal') {
            //     path = '/cal';
            // } else {
            //     path = `/${route}`;
            // }
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

    router.navigate(defaultRoute);
}