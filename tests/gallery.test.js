import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, toGalleryItem, buildGallery } from '../src/gallery/index.js';

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    assert.equal(slugify('https://www.Stripe.com/pricing'), 'www-stripe-com-pricing');
    assert.equal(slugify('Acme Co!'), 'acme-co');
    assert.equal(slugify(''), 'site');
    assert.equal(slugify(null), 'site');
  });
});

describe('toGalleryItem', () => {
  it('maps a fidelity report to an item', () => {
    const item = toGalleryItem({
      host: 'stripe.com', url: 'https://stripe.com', cloneUrl: 'http://localhost:3000',
      overall: 88, grade: 'B', visual: 92, motion: 82,
      directives: [{ priority: 'high' }], motionAspects: [{ aspect: 'feel' }],
    });
    assert.equal(item.slug, 'stripe-com');
    assert.equal(item.overall, 88);
    assert.equal(item.grade, 'B');
    assert.equal(item.directiveCount, 1);
  });

  it('tolerates a partial report', () => {
    const item = toGalleryItem({ url: 'https://x.io' });
    assert.equal(item.host, 'x.io');
    assert.equal(item.overall, null);
    assert.equal(item.grade, 'unknown');
    assert.equal(item.directiveCount, 0);
  });
});

describe('buildGallery', () => {
  const reports = [
    { host: 'a.com', url: 'https://a.com', overall: 70, grade: 'C' },
    { host: 'b.com', url: 'https://b.com', overall: 95, grade: 'A' },
    { host: 'a.com', url: 'https://a.com/v2', overall: 80, grade: 'B' },
    { host: 'c.com', url: 'https://c.com' }, // unscored
  ];

  it('sorts best-first and disambiguates duplicate slugs', () => {
    const { items } = buildGallery(reports);
    assert.deepEqual(items.map(i => i.host), ['b.com', 'a.com', 'a.com', 'c.com']);
    const slugs = items.map(i => i.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'all slugs are unique');
    assert.ok(slugs.includes('a-com') && slugs.includes('a-com-2'), 'duplicate host slugs disambiguated');
  });

  it('computes stats over the scored items only', () => {
    const { stats } = buildGallery(reports);
    assert.equal(stats.count, 4);
    assert.equal(stats.scored, 3);
    assert.equal(stats.avg, Math.round((70 + 95 + 80) / 3));
    assert.equal(stats.best.host, 'b.com');
    assert.equal(stats.worst.host, 'a.com'); // the 70
  });

  it('handles an empty set', () => {
    const { items, stats } = buildGallery([]);
    assert.deepEqual(items, []);
    assert.equal(stats.count, 0);
    assert.equal(stats.avg, null);
    assert.equal(stats.best, null);
  });
});
