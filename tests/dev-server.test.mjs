import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../tools/dev-server.mjs';

test('only /mabilat/api/ is proxied', () => {
  assert.deepEqual(route('/mabilat/api/overview?minutes=15'), { proxy: '/mabilat/api/overview?minutes=15' });
  assert.deepEqual(route('/mabilat/'), { file: 'mabilat/index.html' });
  assert.deepEqual(route('/mabilat'), { redirect: '/mabilat/' });
  assert.deepEqual(route('/_shared/site.css'), { file: '_shared/site.css' });
  assert.deepEqual(route('/'), { file: 'index.html' });
});

test('paths cannot escape public/', () => {
  assert.equal(route('/../package.json').file, undefined);
  assert.equal(route('/%2e%2e/package.json').file, undefined);
});
