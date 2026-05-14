import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _createRouter } from './router.svelte';
import type { RouteDefinition, Guard, RouterConfig } from './types';

function makeRouter(
    routes: RouteDefinition[],
    guards: Record<string, Guard> = {},
    fallback: string = routes[0]?.name ?? '',
) {
    const r = _createRouter();
    r.init({ routes, guards, fallback } satisfies RouterConfig);
    return r;
}

// ─── parseUrl ─────────────────────────────────────────────────────────────────

describe('parseUrl — static routes', () => {
    it('matches a simple path', () => {
        const r = makeRouter([{ name: 'login', pattern: '/login' }], {}, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.route).toBe('login');
        expect(r.params).toEqual({});
        expect(r.notFound).toBe(false);
    });

    it('falls back to the fallback route on no match', () => {
        const r = makeRouter([
            { name: 'cal', pattern: '/cal' },
            { name: 'login', pattern: '/login' },
        ], {}, 'cal');
        r.parseUrl('http://localhost/unknown');
        expect(r.route).toBe('cal');
        expect(r.notFound).toBe(true);
    });

    it('clears params when falling back', () => {
        const r = makeRouter([{ name: 'event', pattern: '/event/:eventId' }], {}, 'event');
        r.parseUrl('http://localhost/event/123');
        expect(r.params).toEqual({ eventId: '123' });
        r.parseUrl('http://localhost/nowhere');
        expect(r.params).toEqual({});
    });

    it('sets notFound=false on a real match', () => {
        const r = makeRouter([{ name: 'cal', pattern: '/cal' }], {}, 'cal');
        r.parseUrl('http://localhost/cal');
        expect(r.notFound).toBe(false);
    });
});

describe('parseUrl — params', () => {
    it('captures a required param', () => {
        const r = makeRouter([{ name: 'event', pattern: '/event/:eventId' }], {}, 'event');
        r.parseUrl('http://localhost/event/abc');
        expect(r.params).toEqual({ eventId: 'abc' });
    });

    it('captures multiple params', () => {
        const r = makeRouter([{ name: 'cal-date', pattern: '/cal/:mm/:dd/:yyyy' }], {}, 'cal-date');
        r.parseUrl('http://localhost/cal/05/13/2026');
        expect(r.params).toEqual({ mm: '05', dd: '13', yyyy: '2026' });
    });

    it('captures an optional param when present', () => {
        const r = makeRouter([{ name: 'settings', pattern: '/settings/:page?' }], {}, 'settings');
        r.parseUrl('http://localhost/settings/account');
        expect(r.params).toEqual({ page: 'account' });
    });

    it('matches without an optional param', () => {
        const r = makeRouter([{ name: 'settings', pattern: '/settings/:page?' }], {}, 'settings');
        r.parseUrl('http://localhost/settings');
        expect(r.route).toBe('settings');
    });
});

describe('parseUrl — search params', () => {
    it('captures a search param', () => {
        const r = makeRouter([{ name: 'reset', pattern: '/password-reset' }], {}, 'reset');
        r.parseUrl('http://localhost/password-reset?token=xyz');
        expect(r.searchParams).toEqual({ token: 'xyz' });
    });

    it('captures multiple search params', () => {
        const r = makeRouter([{ name: 'items', pattern: '/items' }], {}, 'items');
        r.parseUrl('http://localhost/items?page=2&sort=asc');
        expect(r.searchParams).toEqual({ page: '2', sort: 'asc' });
    });

    it('returns empty object when no search params', () => {
        const r = makeRouter([{ name: 'cal', pattern: '/cal' }], {}, 'cal');
        r.parseUrl('http://localhost/cal');
        expect(r.searchParams).toEqual({});
    });

    it('captures search params alongside path params', () => {
        const r = makeRouter([{ name: 'event', pattern: '/event/:eventId' }], {}, 'event');
        r.parseUrl('http://localhost/event/42?tab=details');
        expect(r.params).toEqual({ eventId: '42' });
        expect(r.searchParams).toEqual({ tab: 'details' });
    });
});

// ─── is() / matches() ─────────────────────────────────────────────────────────

describe('is() and matches()', () => {
    it('is() returns true only for the active route', () => {
        const r = makeRouter([{ name: 'login', pattern: '/login' }], {}, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.is('login')).toBe(true);
        expect(r.is('cal')).toBe(false);
    });

    it('matches() returns true when the active route is in the list', () => {
        const r = makeRouter([
            { name: 'login', pattern: '/login' },
            { name: 'signup', pattern: '/signup' },
        ], {}, 'login');
        r.parseUrl('http://localhost/login');
        expect(r.matches(['login', 'signup'])).toBe(true);
        expect(r.matches(['signup', 'cal'])).toBe(false);
    });
});

// ─── navigate() ───────────────────────────────────────────────────────────────

describe('navigate()', () => {
    beforeEach(() => {
        vi.spyOn(history, 'pushState').mockImplementation(() => {});
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    });
    afterEach(() => vi.restoreAllMocks());

    it('navigates to a static route', async () => {
        const r = makeRouter([{ name: 'login', pattern: '/login' }], {}, 'login');
        await r.navigate('login');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('builds the correct path with a param', async () => {
        const r = makeRouter([{ name: 'event', pattern: '/event/:eventId' }], {}, 'event');
        await r.navigate('event', { eventId: '42' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/event/42');
    });

    it('builds a path with multiple params and a literal segment', async () => {
        const r = makeRouter([{ name: 'edit', pattern: '/event/:eventId/edit' }], {}, 'edit');
        await r.navigate('edit', { eventId: '7' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/event/7/edit');
    });

    it('appends search params', async () => {
        const r = makeRouter([{ name: 'reset', pattern: '/password-reset' }], {}, 'reset');
        await r.navigate('reset', {}, { token: 'abc' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/password-reset?token=abc');
    });

    it('does not append a query string when searchParams is empty', async () => {
        const r = makeRouter([{ name: 'cal', pattern: '/cal' }], {}, 'cal');
        await r.navigate('cal');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/cal');
    });

    it('warns and does nothing for an unknown route', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = makeRouter([{ name: 'cal', pattern: '/cal' }], {}, 'cal');
        await r.navigate('nonexistent');
        expect(history.pushState).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"nonexistent"'));
        warn.mockRestore();
    });
});

// ─── guards ───────────────────────────────────────────────────────────────────

describe('guards — navigate()', () => {
    beforeEach(() => {
        vi.spyOn(history, 'pushState').mockImplementation(() => {});
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    });
    afterEach(() => vi.restoreAllMocks());

    it('redirects when the guard condition is true', async () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['authenticated'] },
            ],
            { authenticated: { condition: () => true, redirectTo: 'login' } },
            'login',
        );
        await r.navigate('cal');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('proceeds when the guard condition is false', async () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['authenticated'] },
            ],
            { authenticated: { condition: () => false, redirectTo: 'login' } },
            'login',
        );
        await r.navigate('cal');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/cal');
    });

    it('does not forward params when redirected by a guard', async () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'event', pattern: '/event/:eventId', guards: ['authenticated'] },
            ],
            { authenticated: { condition: () => true, redirectTo: 'login' } },
            'login',
        );
        await r.navigate('event', { eventId: '99' });
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('stops at the first triggered guard', async () => {
        const secondGuard = vi.fn().mockReturnValue(false);
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['first', 'second'] },
            ],
            {
                first:  { condition: () => true,  redirectTo: 'login' },
                second: { condition: secondGuard, redirectTo: 'login' },
            },
            'login',
        );
        await r.navigate('cal');
        expect(secondGuard).not.toHaveBeenCalled();
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('chains through multiple guards, each passing', async () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['a', 'b'] },
            ],
            {
                a: { condition: () => false, redirectTo: 'login' },
                b: { condition: () => false, redirectTo: 'login' },
            },
            'login',
        );
        await r.navigate('cal');
        expect(history.pushState).toHaveBeenCalledWith({}, '', '/cal');
    });

    it('detects guard cycles and warns instead of hanging', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = makeRouter(
            [
                { name: 'a', pattern: '/a', guards: ['toB'] },
                { name: 'b', pattern: '/b', guards: ['toA'] },
            ],
            {
                toA: { condition: () => true, redirectTo: 'a' },
                toB: { condition: () => true, redirectTo: 'b' },
            },
            'a',
        );
        await r.navigate('a');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cycle'));
        warn.mockRestore();
    });
});

describe('guards — parseUrl()', () => {
    beforeEach(() => {
        vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('redirects on URL parse when guard fires', () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['authenticated'] },
            ],
            { authenticated: { condition: () => true, redirectTo: 'login' } },
            'login',
        );
        r.parseUrl('http://localhost/cal');
        expect(r.route).toBe('login');
        expect(history.replaceState).toHaveBeenCalledWith({}, '', '/login');
    });

    it('does not redirect when guard does not fire', () => {
        const r = makeRouter(
            [
                { name: 'login', pattern: '/login' },
                { name: 'cal', pattern: '/cal', guards: ['authenticated'] },
            ],
            { authenticated: { condition: () => false, redirectTo: 'login' } },
            'login',
        );
        r.parseUrl('http://localhost/cal');
        expect(r.route).toBe('cal');
        expect(history.replaceState).not.toHaveBeenCalled();
    });
});
