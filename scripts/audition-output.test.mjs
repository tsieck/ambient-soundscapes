import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditionOutput } from './audition-output.mjs';

test('defaults are unique private directories with private files', async (t) => {
  const a = await createAuditionOutput();
  const b = await createAuditionOutput();
  t.after(() => Promise.all([a, b].map(({ directory }) => rm(directory, { recursive: true, force: true }))));
  assert.notEqual(a.directory, b.directory);
  assert.equal((await stat(a.directory)).mode & 0o777, 0o700);
  await a.write('report.json', 'report');
  assert.equal((await stat(join(a.directory, 'report.json'))).mode & 0o777, 0o600);
  assert.equal(await readFile(join(a.directory, 'report.json'), 'utf8'), 'report');
});

test('existing roots and symlink roots are refused', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'audition-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const existing = join(base, 'existing');
  await mkdir(existing);
  await symlink(existing, join(base, 'alias'));
  await assert.rejects(createAuditionOutput(existing), { code: 'EEXIST' });
  await assert.rejects(createAuditionOutput(join(base, 'alias')), { code: 'EEXIST' });
  const output = await createAuditionOutput(join(base, 'fresh'));
  assert.equal((await stat(output.directory)).mode & 0o777, 0o700);
});

test('every renderer filename refuses links and preserves an external sentinel', async (t) => {
  const output = await createAuditionOutput();
  t.after(() => rm(output.directory, { recursive: true, force: true }));
  const external = await mkdtemp(join(tmpdir(), 'audition-sentinel-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  const sentinel = join(external, 'sentinel');
  await writeFile(sentinel, 'unchanged');
  const names = ['report.json', 'index.html'];
  for (const [slug, seconds] of [['tape-afternoon-floating', 90], ['open-horizon-floating', 90], ['tape-afternoon-bounce', 45]]) {
    for (const version of ['before', 'after']) names.push(`${slug}-${version}-${seconds}s.wav`);
  }
  for (const name of names) {
    await symlink(sentinel, join(output.directory, name));
    await assert.rejects(output.write(name, 'corrupted'), { code: 'EEXIST' });
    assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
  }
  await link(sentinel, join(output.directory, 'hard-link'));
  await assert.rejects(output.write('hard-link', 'corrupted'), { code: 'EEXIST' });
  await symlink(join(output.directory, 'missing'), join(output.directory, 'dangling'));
  await assert.rejects(output.write('dangling', 'corrupted'), { code: 'EEXIST' });
  await mkdir(join(output.directory, 'directory'));
  await assert.rejects(output.write('directory', 'corrupted'), { code: 'EEXIST' });
  await assert.rejects(output.write('../escape', 'corrupted'));
  await output.write('regular', 'original');
  await assert.rejects(output.write('regular', 'corrupted'), { code: 'EEXIST' });
  assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
});

test('unprotected shared parents are refused', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'audition-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  await chmod(base, 0o777);
  await assert.rejects(createAuditionOutput(join(base, 'output')), /Untrusted audition output parent/);
});
