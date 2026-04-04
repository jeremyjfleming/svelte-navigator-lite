import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _createRouter } from './router.svelte';
import type { RouteList } from './router.svelte';

// Creates a fresh isolated router instance with the given routes and default.
function makeRouter(routes: RouteList, defaultRoute: string) {
    const r = _createRouter();
    for (const [name, route] of Object.entries(routes)) {
        r.registerRoute(name, route);
    }
    r.rootRoute = defaultRoute;
    return r;
}

// ─── parseUrl ────────────────────────────────────────────────────────────────

describe('parseUrl — static routes', () => {
    it('matches a rootPath with no segments', () => {
        const r = makeRouter({ login: { rootPath: 'login', segments: [] } }, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.route).toBe('login');
        expect(r.params).toEqual({});
        expect(r.notFound).toBe(false);
    });

    it('does not match rootPath when extra segments are present', () => {
        const r = makeRouter({
            login: { rootPath: 'login', segments: [] },
            fallback: { rootPath: 'fallback', segments: [] },
        }, 'fallback');
        r.parseUrl('http://localhost/login/extra');
        expect(r.notFound).toBe(true);
        expect(r.route).toBe('fallback');
    });
});

describe('parseUrl — dynamic params', () => {
    it('captures a named segment into params', () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
        }, 'event');
        r.parseUrl('http://localhost/event/123');
        expect(r.route).toBe('event');
        expect(r.params).toEqual({ eventId: '123' });
        expect(r.notFound).toBe(false);
    });

    it('does not match when required named segment is absent', () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
            fallback: { rootPath: 'fallback', segments: [] },
        }, 'fallback');
        r.parseUrl('http://localhost/event');
        expect(r.notFound).toBe(true);
    });
});

describe('parseUrl — enforceVal segments', () => {
    it('matches when enforceVal is correct', () => {
        const r = makeRouter({
            'create-cal': { rootPath: 'calendar', segments: [{ enforceVal: 'create' }] },
        }, 'create-cal');
        r.parseUrl('http://localhost/calendar/create');
        expect(r.route).toBe('create-cal');
    });

    it('does not match when enforceVal differs', () => {
        const r = makeRouter({
            'create-cal': { rootPath: 'calendar', segments: [{ enforceVal: 'create' }] },
            fallback: { rootPath: 'fallback', segments: [] },
        }, 'fallback');
        r.parseUrl('http://localhost/calendar/delete');
        expect(r.notFound).toBe(true);
    });
});

describe('parseUrl — mixed segments', () => {
    it('matches name followed by enforceVal', () => {
        const r = makeRouter({
            'edit-event': {
                rootPath: 'event',
                segments: [{ name: 'eventId' }, { enforceVal: 'edit' }],
            },
        }, 'edit-event');
        r.parseUrl('http://localhost/event/123/edit');
        expect(r.route).toBe('edit-event');
        expect(r.params).toEqual({ eventId: '123' });
    });
});

describe('parseUrl — segment over-matching prevention', () => {
    it('does not match when URL has more segments than the route defines', () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
            fallback: { rootPath: 'fallback', segments: [] },
        }, 'fallback');
        r.parseUrl('http://localhost/event/123/unexpected');
        expect(r.notFound).toBe(true);
    });

    it('differentiates routes with the same rootPath but different segment counts', () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
            'edit-event': {
                rootPath: 'event',
                segments: [{ name: 'eventId' }, { enforceVal: 'edit' }],
            },
        }, 'event');

        r.parseUrl('http://localhost/event/123');
        expect(r.route).toBe('event');

        r.parseUrl('http://localhost/event/123/edit');
        expect(r.route).toBe('edit-event');
    });
});

describe('parseUrl — optional segments', () => {
    const routes: RouteList = {
        event: {
            rootPath: 'event',
            segments: [
                { name: 'eventId' },
                { enforceVal: 'edit', optional: true },
            ],
        },
        fallback: { rootPath: 'fallback', segments: [] },
    };

    it('matches when optional trailing segment is absent', () => {
        const r = makeRouter(routes, 'fallback');
        r.parseUrl('http://localhost/event/123');
        expect(r.route).toBe('event');
        expect(r.params).toEqual({ eventId: '123' });
    });

    it('matches when optional trailing segment is present', () => {
        const r = makeRouter(routes, 'fallback');
        r.parseUrl('http://localhost/event/123/edit');
        expect(r.route).toBe('event');
        expect(r.params).toEqual({ eventId: '123' });
    });

    it('does not match when optional enforceVal has wrong value', () => {
        const r = makeRouter(routes, 'fallback');
        r.parseUrl('http://localhost/event/123/delete');
        expect(r.notFound).toBe(true);
    });
});

describe('parseUrl — required searchParams', () => {
    const routes: RouteList = {
        'password-reset': {
            rootPath: 'password-reset',
            segments: [],
            searchParams: ['token'],
        },
        fallback: { rootPath: 'fallback', segments: [] },
    };

    it('captures a search param when present', () => {
        const r = makeRouter(routes, 'fallback');
        r.parseUrl('http://localhost/password-reset?token=abc123');
        expect(r.route).toBe('password-reset');
        expect(r.params).toEqual({ token: 'abc123' });
    });

    it('still matches when a search param is absent', () => {
        const r = makeRouter(routes, 'fallback');
        r.parseUrl('http://localhost/password-reset');
        expect(r.route).toBe('password-reset');
        expect(r.params).toEqual({});
    });

    it('captures multiple search params independently', () => {
        const r = makeRouter({
            page: {
                rootPath: 'items',
                segments: [],
                searchParams: ['page', 'sort'],
            },
        }, 'page');
        r.parseUrl('http://localhost/items?page=2');
        expect(r.params).toEqual({ page: '2' });
    });
});

describe('parseUrl — fallback and notFound', () => {
    it('falls back to defaultRoute and sets notFound=true on no match', () => {
        const r = makeRouter({ login: { rootPath: 'login', segments: [] } }, 'login');
        r.parseUrl('http://localhost/unknown/path');
        expect(r.route).toBe('login');
        expect(r.notFound).toBe(true);
        expect(r.params).toEqual({});
    });

    it('sets notFound=false on a real match', () => {
        const r = makeRouter({ login: { rootPath: 'login', segments: [] } }, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.notFound).toBe(false);
    });

    it('clears params when falling back', () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
        }, 'event');
        r.parseUrl('http://localhost/event/123');
        expect(r.params).toEqual({ eventId: '123' });

        r.parseUrl('http://localhost/nowhere');
        expect(r.params).toEqual({});
    });
});

// ─── is() and matches() ───────────────────────────────────────────────────────

describe('is() and matches()', () => {
    it('is() returns true only for the current route', () => {
        const r = makeRouter({ login: { rootPath: 'login', segments: [] } }, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.is('login')).toBe(true);
        expect(r.is('other')).toBe(false);
    });

    it('matches() returns true if current route is in the array', () => {
        const r = makeRouter({
            login: { rootPath: 'login', segments: [] },
            signup: { rootPath: 'signup', segments: [] },
        }, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.matches(['login', 'signup'])).toBe(true);
        expect(r.matches(['signup', 'other'])).toBe(false);
    });
});

// ─── navigate() ───────────────────────────────────────────────────────────────

describe('navigate()', () => {
    beforeEach(() => {
        vi.spyOn(history, 'pushState').mockImplementation(() => {});
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds the correct path for a static route', async () => {
        const r = makeRouter({ login: { rootPath: 'login', segments: [] } }, 'login');
        await r.navigate('login');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('builds the correct path with a dynamic segment', async () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
        }, 'event');
        await r.navigate('event', { eventId: '42' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/event/42');
    });

    it('includes enforceVal segments in the path', async () => {
        const r = makeRouter({
            'edit-event': {
                rootPath: 'event',
                segments: [{ name: 'eventId' }, { enforceVal: 'edit' }],
            },
        }, 'edit-event');
        await r.navigate('edit-event', { eventId: '42' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/event/42/edit');
    });

    it('throws when a required param is missing', async () => {
        const r = makeRouter({
            event: { rootPath: 'event', segments: [{ name: 'eventId' }] },
        }, 'event');
        await expect(r.navigate('event')).rejects.toThrow('Missing parameter eventId');
    });

    it('appends search params to the path', async () => {
        const r = makeRouter({
            'password-reset': {
                rootPath: 'password-reset',
                segments: [],
                searchParams: ['token'],
            },
        }, 'password-reset');
        await r.navigate('password-reset', { token: 'abc' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/password-reset?token=abc');
    });

    it('redirects when a guard fn returns true', async () => {
        const r = makeRouter({
            login: { rootPath: 'login', segments: [] },
            dashboard: {
                rootPath: 'dashboard',
                segments: [],
                routeGuards: [{ fn: () => true, redirectTo: 'login' }],
            },
        }, 'login');
        await r.navigate('dashboard');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('proceeds when a guard fn returns false', async () => {
        const r = makeRouter({
            login: { rootPath: 'login', segments: [] },
            dashboard: {
                rootPath: 'dashboard',
                segments: [],
                routeGuards: [{ fn: () => false, redirectTo: 'login' }],
            },
        }, 'login');
        await r.navigate('dashboard');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/dashboard');
    });

    it('stops at the first triggered guard', async () => {
        const secondGuard = vi.fn().mockReturnValue(false);
        const r = makeRouter({
            login: { rootPath: 'login', segments: [] },
            dashboard: {
                rootPath: 'dashboard',
                segments: [],
                routeGuards: [
                    { fn: () => true, redirectTo: 'login' },
                    { fn: secondGuard, redirectTo: 'login' },
                ],
            },
        }, 'login');
        await r.navigate('dashboard');
        expect(secondGuard).not.toHaveBeenCalled();
    });
});
