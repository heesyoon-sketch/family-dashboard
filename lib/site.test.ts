import assert from 'node:assert/strict';
import test from 'node:test';
import { authCallbackUrl, safeReturnPath, SITE_ORIGIN } from './site';

test('login stays on the initiating origin so PKCE cookies are available on return', () => {
  assert.equal(authCallbackUrl('https://fambit.vercel.app', null), 'https://fambit.vercel.app/auth/callback');
  assert.equal(authCallbackUrl('http://localhost:3000', '/calendar'), 'http://localhost:3000/auth/callback?next=%2Fcalendar');
  const url = new URL(authCallbackUrl('https://fambit.vercel.app', '/stats?view=shield&member=example'));
  assert.equal(url.origin, SITE_ORIGIN);
  assert.equal(url.searchParams.get('next'), '/stats?view=shield&member=example');
});

test('authentication returns to supported app pages and preserves their filters', () => {
  for (const path of ['/', '/calendar', '/admin', '/join', '/setup', '/setup/set-pin', '/setup/welcome', '/stats?view=shield#progress']) {
    assert.equal(safeReturnPath(path), path);
  }
});

test('return URLs cannot leave the site or create authentication loops', () => {
  for (const path of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/%2fevil.example', '/%5cevil.example', '/login', '/auth/callback?code=old', '/home', '/admin/../../login', '/calendar\nLocation: https://evil.example']) {
    assert.equal(safeReturnPath(path), '/');
    assert.equal(new URL(authCallbackUrl(SITE_ORIGIN, path)).searchParams.get('next'), null);
  }
});
