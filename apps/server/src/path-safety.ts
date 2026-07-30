import { relative, resolve, sep } from 'node:path';

export function resolveInRoot(root: string, requested: string) {
  const target = resolve(root, requested);
  const inside = relative(root, target);
  if (inside === '' || (!inside.startsWith(`..${sep}`) && inside !== '..' && !inside.includes(`${sep}..${sep}`))) return target;
  throw new Error('Requested file is outside the authorized media directory.');
}

export function isPathInside(parent: string, child: string) {
  try { resolveInRoot(parent, child); return true; } catch { return false; }
}
