import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInRoot } from '../src/path-safety.js';

test('resolves a file within an authorized root', () => {
  assert.equal(resolveInRoot('/media/library', 'RJ001/track.mp3'), '/media/library/RJ001/track.mp3');
});

test('rejects directory traversal outside the authorized root', () => {
  assert.throws(() => resolveInRoot('/media/library', '../private/secret.mp3'), /outside the authorized media directory/);
});

test('rejects an absolute requested path outside the authorized root', () => {
  assert.throws(() => resolveInRoot('/media/library', '/etc/passwd'), /outside the authorized media directory/);
});
