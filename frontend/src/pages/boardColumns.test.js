import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, resolveColumnIds } from './boardColumns.js';

test('slugify', () => {
  assert.equal(slugify('In Progress'), 'inprogress');
  assert.equal(slugify('QA / Review'), 'qareview');
});

test('existing stages keep their id when renamed', () => {
  const saved = [{ id: 'backlog', label: 'Backlog' }];
  assert.deepEqual(resolveColumnIds([{ id: 'backlog', label: 'Icebox' }], saved), [{ id: 'backlog', label: 'Icebox' }]);
});

test('new stages are slugged so "Done" gets the done id', () => {
  assert.deepEqual(resolveColumnIds([{ id: 'tmp', label: 'Done' }]), [{ id: 'done', label: 'Done' }]);
});

test('collisions are disambiguated, not dropped', () => {
  const out = resolveColumnIds([{ id: 'done', label: 'Done' }, { id: 'tmp', label: 'Done' }], [{ id: 'done', label: 'Done' }]);
  assert.deepEqual(out.map(c => c.id), ['done', 'done2']);
});

test('unsluggable labels still get an id', () => {
  assert.equal(resolveColumnIds([{ id: 'tmp', label: '???' }])[0].id, 'stage1');
});
