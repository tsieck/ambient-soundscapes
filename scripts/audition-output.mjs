import { mkdir, mkdtemp, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Canonicalize parents, then require that other users cannot replace our root.
async function trustedParent(path) {
  const parent = await realpath(path);
  for (let current = parent; ; current = dirname(current)) {
    const info = await stat(current);
    const uid = process.getuid?.();
    const trustedOwner = uid !== undefined && (info.uid === uid || info.uid === 0);
    const shared = (info.mode & 0o022) !== 0;
    const sticky = (info.mode & 0o1000) !== 0;
    if (!info.isDirectory() || !trustedOwner || (shared && !sticky)) {
      throw new Error(`Untrusted audition output parent: ${current}`);
    }
    if (dirname(current) === current) break;
  }
  return parent;
}

export async function createAuditionOutput(requested) {
  let directory;
  if (requested === undefined) {
    const parent = await trustedParent(tmpdir());
    directory = await mkdtemp(join(parent, 'stillroom-depth-auditions-'));
  } else {
    const absolute = resolve(requested);
    const parent = await trustedParent(dirname(absolute));
    directory = join(parent, basename(absolute));
    // Never accept an existing directory, symlink, or other filesystem entry.
    await mkdir(directory, { mode: 0o700 });
  }
  return {
    directory,
    async write(filename, data) {
      if (!filename || basename(filename) !== filename || filename === '.' || filename === '..') {
        throw new Error('Audition output filenames must be plain child names.');
      }
      // Exclusive creation rejects existing links (including dangling links) and hard links.
      await writeFile(join(directory, filename), data, { flag: 'wx', mode: 0o600 });
    },
  };
}
