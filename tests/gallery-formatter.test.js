import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGallery } from '../src/gallery/index.js';
import {
  formatGalleryIndex, formatGalleryItemPage, renderGallerySite,
} from '../src/formatters/gallery.js';

const reports = [
  {
    host: 'stripe.com', url: 'https://stripe.com', cloneUrl: 'http://localhost:3000',
    overall: 88, grade: 'B', visual: 92, motion: 82,
    directives: [{ priority: 'high', area: 'motion', issue: 'missing spring', fix: 'Use a spring curve.' }],
    motionAspects: [{ aspect: 'feel', score: 0.5 }, { aspect: 'springs', score: 0 }],
  },
  { host: 'linear.app', url: 'https://linear.app', overall: 95, grade: 'A', visual: 96, motion: 94, directives: [], motionAspects: [] },
];

const gallery = buildGallery(reports);

describe('formatGalleryIndex', () => {
  it('renders a card grid sorted best-first with stats', () => {
    const html = formatGalleryIndex(gallery, { title: 'My Gallery' });
    assert.match(html, /<title>My Gallery<\/title>/);
    assert.ok(html.indexOf('linear.app') < html.indexOf('stripe.com'), 'best score first');
    assert.match(html, /href="stripe-com\/"/);
    assert.match(html, /avg fidelity/);
    assert.match(html, /<meta property="og:title"/);
  });
});

describe('formatGalleryItemPage', () => {
  it('embeds the card, OG image, motion table and correction plan', () => {
    const item = gallery.items.find(i => i.host === 'stripe.com');
    const html = formatGalleryItemPage(item, { baseUrl: 'https://gallery.example' });
    assert.match(html, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(html, /og:image" content="https:\/\/gallery\.example\/stripe-com\/card\.svg"/);
    assert.match(html, /missing spring/);
    assert.match(html, /Use a spring curve\./);
    assert.match(html, /source ↗/);
    assert.match(html, /clone ↗/);
  });

  it('says no corrections when the plan is empty', () => {
    const item = gallery.items.find(i => i.host === 'linear.app');
    const html = formatGalleryItemPage(item);
    assert.match(html, /No corrections outstanding/);
  });
});

describe('renderGallerySite', () => {
  it('emits index + per-item page + per-item card', () => {
    const files = renderGallerySite(gallery);
    const paths = files.map(f => f.path);
    assert.ok(paths.includes('index.html'));
    assert.ok(paths.includes('stripe-com/index.html'));
    assert.ok(paths.includes('stripe-com/card.svg'));
    assert.ok(paths.includes('linear-app/index.html'));
    assert.equal(files.length, 1 + gallery.items.length * 2);
    assert.ok(files.every(f => typeof f.content === 'string' && f.content.length > 0));
  });
});
