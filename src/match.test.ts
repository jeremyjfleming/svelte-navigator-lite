import { describe, it, expect } from 'vitest';
import { compileRoutes, matchPath, buildPath } from './match';

// ─── matchPath ────────────────────────────────────────────────────────────────

describe('matchPath — static routes', () => {
    it('matches an exact path', () => {
        const compiled = compileRoutes([{ name: 'login', pattern: '/login' }]);
        expect(matchPath(compiled, '/login')).toEqual({ name: 'login', params: {} });
    });

    it('does not match a different path', () => {
        const compiled = compileRoutes([{ name: 'login', pattern: '/login' }]);
        expect(matchPath(compiled, '/signup')).toBeNull();
    });

    it('returns null when no routes match', () => {
        const compiled = compileRoutes([{ name: 'login', pattern: '/login' }]);
        expect(matchPath(compiled, '/unknown/path')).toBeNull();
    });

    it('returns the first matching route', () => {
        const compiled = compileRoutes([
            { name: 'first', pattern: '/cal' },
            { name: 'second', pattern: '/cal' },
        ]);
        expect(matchPath(compiled, '/cal')?.name).toBe('first');
    });
});

describe('matchPath — required params', () => {
    it('captures a single param', () => {
        const compiled = compileRoutes([{ name: 'event', pattern: '/event/:eventId' }]);
        expect(matchPath(compiled, '/event/abc-123')).toEqual({
            name: 'event',
            params: { eventId: 'abc-123' },
        });
    });

    it('does not match when a required param is absent', () => {
        const compiled = compileRoutes([{ name: 'event', pattern: '/event/:eventId' }]);
        expect(matchPath(compiled, '/event')).toBeNull();
    });

    it('captures multiple params', () => {
        const compiled = compileRoutes([{ name: 'cal-date', pattern: '/cal/:mm/:dd/:yyyy' }]);
        expect(matchPath(compiled, '/cal/05/13/2026')).toEqual({
            name: 'cal-date',
            params: { mm: '05', dd: '13', yyyy: '2026' },
        });
    });

    it('captures params mixed with literal segments', () => {
        const compiled = compileRoutes([{ name: 'edit', pattern: '/event/:eventId/edit' }]);
        expect(matchPath(compiled, '/event/99/edit')).toEqual({
            name: 'edit',
            params: { eventId: '99' },
        });
    });

    it('does not match when a literal segment differs', () => {
        const compiled = compileRoutes([{ name: 'edit', pattern: '/event/:eventId/edit' }]);
        expect(matchPath(compiled, '/event/99/delete')).toBeNull();
    });

    it('does not match when there are extra segments', () => {
        const compiled = compileRoutes([{ name: 'event', pattern: '/event/:eventId' }]);
        expect(matchPath(compiled, '/event/99/unexpected')).toBeNull();
    });

    it('differentiates routes with the same prefix by segment count', () => {
        const compiled = compileRoutes([
            { name: 'event', pattern: '/event/:eventId' },
            { name: 'edit', pattern: '/event/:eventId/edit' },
        ]);
        expect(matchPath(compiled, '/event/99')?.name).toBe('event');
        expect(matchPath(compiled, '/event/99/edit')?.name).toBe('edit');
    });

    it('URL-decodes param values', () => {
        const compiled = compileRoutes([{ name: 'search', pattern: '/search/:query' }]);
        expect(matchPath(compiled, '/search/hello%20world')?.params.query).toBe('hello world');
    });
});

describe('matchPath — optional params', () => {
    const compiled = compileRoutes([{ name: 'settings', pattern: '/settings/:page?' }]);

    it('matches when the optional param is present', () => {
        expect(matchPath(compiled, '/settings/account')).toEqual({
            name: 'settings',
            params: { page: 'account' },
        });
    });

    it('matches when the optional param is absent', () => {
        const result = matchPath(compiled, '/settings');
        expect(result?.name).toBe('settings');
        expect(result?.params).not.toHaveProperty('page');
    });
});

// ─── buildPath ────────────────────────────────────────────────────────────────

describe('buildPath — static patterns', () => {
    it('returns the pattern as-is', () => {
        expect(buildPath('/login')).toBe('/login');
    });

    it('returns / for an empty pattern', () => {
        expect(buildPath('')).toBe('/');
    });
});

describe('buildPath — required params', () => {
    it('substitutes a single param', () => {
        expect(buildPath('/event/:eventId', { eventId: '42' })).toBe('/event/42');
    });

    it('substitutes multiple params', () => {
        expect(buildPath('/cal/:mm/:dd/:yyyy', { mm: '05', dd: '13', yyyy: '2026' }))
            .toBe('/cal/05/13/2026');
    });

    it('substitutes params among literal segments', () => {
        expect(buildPath('/event/:eventId/edit', { eventId: '99' })).toBe('/event/99/edit');
    });

    it('URL-encodes param values', () => {
        expect(buildPath('/search/:query', { query: 'hello world' })).toBe('/search/hello%20world');
    });

    it('throws when a required param is missing', () => {
        expect(() => buildPath('/event/:eventId', {})).toThrow('missing required param "eventId"');
    });
});

describe('buildPath — optional params', () => {
    it('inserts the value when the optional param is provided', () => {
        expect(buildPath('/settings/:page?', { page: 'account' })).toBe('/settings/account');
    });

    it('drops the segment cleanly when the optional param is absent', () => {
        expect(buildPath('/settings/:page?', {})).toBe('/settings');
    });
});
