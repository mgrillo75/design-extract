// Plugin-manifest health: versions stay in lockstep with package.json, and
// every command the manifest advertises has a backing file.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkPluginVersions } from '../scripts/check-plugin-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

describe('plugin manifest', () => {
  it('keeps plugin.json and marketplace.json in sync with package.json', () => {
    const { ok, problems } = checkPluginVersions();
    assert.equal(ok, true, problems.join('; '));
  });

  it('ships a command file for every new command added in this release', () => {
    for (const cmd of ['site', 'studio', 'verify']) {
      assert.ok(existsSync(join(root, 'commands', `${cmd}.md`)), `commands/${cmd}.md missing`);
    }
  });

  it('describes the new commands in the plugin description', () => {
    const plugin = read('.claude-plugin/plugin.json');
    for (const cmd of ['/site', '/studio', '/verify']) {
      assert.ok(plugin.description.includes(cmd), `plugin.json description missing ${cmd}`);
    }
  });
});
