// Whole-site synthesis tests — pure, no browser.
//
// Exercises the coverage-weighted canonicalization in src/site-synthesis.js:
// scope tagging, OKLab colour clustering, canonical election, drift grade,
// and graceful behaviour with missing fields / fewer than two pages.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeSite,
  scopeForCoverage,
  colorDistance,
  hexToOklab,
  clusterColorRows,
} from '../src/site-synthesis.js';

function page(url, type, overrides = {}) {
  return {
    url,
    type,
    design: {
      meta: { url },
      colors: {
        primary: { hex: '#ff4800', rgb: { r: 255, g: 72, b: 0 }, hsl: { h: 17, s: 100, l: 50 }, count: 20 },
        backgrounds: ['#ffffff'],
        text: ['#111111'],
        all: [
          { hex: '#ff4800', rgb: [255, 72, 0], count: 20, contexts: ['background'] },
          { hex: '#111111', rgb: [17, 17, 17], count: 30, contexts: ['color'] },
          { hex: '#ffffff', rgb: [255, 255, 255], count: 40, contexts: ['background'] },
        ],
      },
      typography: {
        families: [{ name: 'Inter', count: 40, usage: 'all' }],
        scale: [
          { size: 16, count: 10, tags: ['p'] },
          { size: 32, count: 3, tags: ['h1'] },
        ],
      },
      spacing: { base: 4, scale: [4, 8, 16, 24] },
      borders: { radii: [{ value: 8, label: 'md', count: 10 }] },
      shadows: { values: [{ label: 'md', raw: '0 4px 6px rgba(0,0,0,.1)' }] },
      ...overrides,
    },
  };
}

describe('scopeForCoverage', () => {
  it('tags by coverage thresholds', () => {
    assert.equal(scopeForCoverage(1), 'site-wide');
    assert.equal(scopeForCoverage(0.8), 'site-wide');
    assert.equal(scopeForCoverage(0.5), 'section');
    assert.equal(scopeForCoverage(0.4), 'section');
    assert.equal(scopeForCoverage(0.3), 'page-local');
    assert.equal(scopeForCoverage(0), 'page-local');
  });
});

describe('OKLab colour maths', () => {
  it('converts and finds near-identical colours close', () => {
    assert.ok(hexToOklab('#ffffff'));
    assert.equal(hexToOklab('not-a-color'), null);
    assert.ok(colorDistance('#ffffff', '#fefefe') < 0.04, 'white ~ near-white');
    assert.ok(colorDistance('#ffffff', '#000000') > 0.5, 'black far from white');
  });

  it('clusters perceptually-identical swatches into one representative', () => {
    const rows = [
      { key: '#ffffff', value: { hex: '#ffffff' }, pages: ['home'], count: 40 },
      { key: '#fefefe', value: { hex: '#fefefe' }, pages: ['blog'], count: 5 },
      { key: '#111111', value: { hex: '#111111' }, pages: ['home'], count: 30 },
    ];
    const clusters = clusterColorRows(rows);
    assert.equal(clusters.length, 2, 'white + near-white merge');
    const white = clusters.find((c) => c.key === '#ffffff');
    assert.equal(white.members.length, 2);
    assert.equal(white.pageSet.size, 2, 'union of pages');
  });
});

describe('synthesizeSite', () => {
  it('elects a canonical system shaped like a design object', () => {
    const pages = [page('https://x.com/', 'home'), page('https://x.com/pricing', 'pricing')];
    const r = synthesizeSite(pages);
    assert.equal(r.pagesAnalyzed, 2);
    assert.equal(r.canonical.colors.primary.hex, '#ff4800');
    assert.ok(r.canonical.colors.all.length >= 3);
    assert.ok(Array.isArray(r.canonical.typography.families));
    assert.ok(r.canonical.spacing.scale.length > 0);
    // sorted ascending
    const sp = r.canonical.spacing.scale;
    assert.deepEqual(sp, [...sp].sort((a, b) => a - b));
  });

  it('flags page-local tokens as outliers', () => {
    const blog = page('https://x.com/blog', 'blog', {
      colors: {
        primary: { hex: '#ff4800', count: 20 },
        backgrounds: ['#ffffff'],
        text: ['#111111'],
        all: [
          { hex: '#ff4800', count: 20 },
          { hex: '#111111', count: 30 },
          { hex: '#ffffff', count: 40 },
          { hex: '#00cc88', count: 6 }, // only here
        ],
      },
    });
    const pages = [page('https://x.com/', 'home'), page('https://x.com/pricing', 'pricing'), blog];
    const r = synthesizeSite(pages);
    const green = r.coverage.colors.find((c) => c.key === '#00cc88');
    assert.equal(green.scope, 'page-local');
    assert.ok(r.drift.outliers.some((o) => o.token === '#00cc88'));
  });

  it('produces a numeric grade and letter for 2+ pages', () => {
    const pages = [page('https://x.com/', 'home'), page('https://x.com/pricing', 'pricing')];
    const r = synthesizeSite(pages);
    assert.equal(typeof r.drift.grade, 'number');
    assert.ok('ABCDF'.includes(r.drift.letter));
    // identical pages → near-perfect consistency
    assert.ok(r.drift.grade >= 90, `expected high grade, got ${r.drift.grade}`);
  });

  it('declines to grade a single page', () => {
    const r = synthesizeSite([page('https://x.com/', 'home')]);
    assert.equal(r.drift.grade, null);
    assert.equal(r.drift.letter, null);
    assert.equal(r.pagesAnalyzed, 1);
  });

  it('ignores pages without a design and tolerates missing fields', () => {
    const pages = [
      page('https://x.com/', 'home'),
      { url: 'https://x.com/err', type: 'docs', error: 'timeout' },
      { url: 'https://x.com/bare', type: 'about', design: { meta: { url: 'x' } } },
    ];
    const r = synthesizeSite(pages);
    assert.equal(r.pagesAnalyzed, 2, 'errored page dropped, bare page kept');
    assert.ok(r.canonical.colors);
  });

  it('preserves full swatch fields (rgb/contexts) for downstream emitters', () => {
    // Regression: synthesis once reduced swatches to {hex,count}, dropping
    // `contexts`/`rgb` and crashing formatMarkdown (which reads c.contexts.join
    // and c.rgb). Canonical swatches must carry the original fields through.
    const r = synthesizeSite([page('https://x.com/', 'home'), page('https://x.com/p', 'pricing')]);
    assert.ok(r.canonical.colors.all.length > 0);
    for (const c of r.canonical.colors.all) {
      assert.ok('rgb' in c, 'swatch keeps rgb');
      assert.ok(Array.isArray(c.contexts), 'swatch keeps contexts array');
    }
  });

  it('is deterministic across runs', () => {
    const mk = () => [page('https://x.com/', 'home'), page('https://x.com/pricing', 'pricing')];
    const a = synthesizeSite(mk());
    const b = synthesizeSite(mk());
    assert.deepEqual(a.coverage.colors.map((c) => c.key), b.coverage.colors.map((c) => c.key));
    assert.equal(a.drift.grade, b.drift.grade);
  });
});
