import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  theatreReducer,
  reduceEvents,
  initialTheatreState,
  MAX_SWATCHES,
} from './theatre-reducer.js';

test('start resets state and marks streaming', () => {
  const dirty = { ...initialTheatreState, swatches: [{ path: 'a', hex: '#fff' }], status: 'done' };
  const s = theatreReducer(dirty, { type: 'start' });
  assert.equal(s.status, 'streaming');
  assert.deepEqual(s.swatches, []);
});

test('frames only advance forward but every frame is counted', () => {
  let s = reduceEvents([
    { type: 'frame', seq: 0, data: 'a' },
    { type: 'frame', seq: 2, data: 'c' },
    { type: 'frame', seq: 1, data: 'b' }, // out of order — ignored for display
  ]);
  assert.equal(s.frame.seq, 2);
  assert.equal(s.frame.data, 'c');
  assert.equal(s.frameCount, 3);
});

test('a missing seq frame still paints', () => {
  const s = reduceEvents([{ type: 'frame', data: 'x' }]);
  assert.equal(s.frame.data, 'x');
  assert.equal(s.frameCount, 1);
});

test('color tokens dedupe by path and cap', () => {
  const events = [];
  for (let i = 0; i < MAX_SWATCHES + 10; i++) {
    events.push({ type: 'token', $type: 'color', value: `#0000${(i % 90) + 10}`, path: `c${i}` });
  }
  events.push({ type: 'token', $type: 'color', value: '#abcabc', path: 'c0' }); // dup path
  const s = reduceEvents(events);
  assert.equal(s.swatches.length, MAX_SWATCHES);
});

test('font + dimension tokens fold', () => {
  const s = reduceEvents([
    { type: 'token', $type: 'fontFamily', value: 'Inter' },
    { type: 'token', $type: 'fontFamily', value: 'Other' }, // first wins
    { type: 'token', $type: 'dimension', value: '16px', path: 'space.4' },
    { type: 'token', $type: 'dimension', value: 'not-a-number', path: 'space.x' },
  ]);
  assert.equal(s.fontSample, 'Inter');
  assert.equal(s.dimensions.length, 1);
  assert.equal(s.dimensions[0].px, 16);
});

test('stages are tracked uniquely and in order', () => {
  const s = reduceEvents([
    { type: 'stage', name: 'crawl' },
    { type: 'stage', name: 'colors' },
    { type: 'stage', name: 'crawl' },
  ]);
  assert.deepEqual(s.stagesSeen, ['crawl', 'colors']);
  assert.equal(s.stage, 'crawl');
});

test('files marks done; a later error after files still flips to error', () => {
  const done = reduceEvents([{ type: 'files', files: { 'a.json': '{}' } }]);
  assert.equal(done.status, 'done');
  const err = theatreReducer(done, { type: 'error', error: 'boom' });
  assert.equal(err.status, 'error');
  assert.equal(err.error, 'boom');
});

test('idle settles a started run back to idle', () => {
  const started = theatreReducer(initialTheatreState, { type: 'start' });
  assert.equal(started.status, 'streaming');
  const idle = theatreReducer(started, { type: 'idle' });
  assert.equal(idle.status, 'idle');
});

test('cache + permalink fold', () => {
  const s = reduceEvents([
    { type: 'cache', cached: true },
    { type: 'permalink', hash: 'deadbeef' },
  ]);
  assert.equal(s.cached, true);
  assert.equal(s.hash, 'deadbeef');
});
