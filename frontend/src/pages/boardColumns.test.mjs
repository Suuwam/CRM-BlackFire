// Self-check for the board/stage ordering helpers. Run:
//   node frontend/src/pages/boardColumns.test.mjs
import assert from 'node:assert';
import { moveTo, resolveColumnIds, slugify } from './boardColumns.js';

const ids = ['a', 'b', 'c', 'd'];

// Dragging right lands the tab in the slot it was dropped on, not one past it.
assert.deepEqual(moveTo(ids, 'a', 'c'), ['b', 'c', 'a', 'd']);
// Dragging left does the same in the other direction.
assert.deepEqual(moveTo(ids, 'd', 'b'), ['a', 'd', 'b', 'c']);
// Neighbour swaps are what the old arrow buttons did; drag must still cover them.
assert.deepEqual(moveTo(ids, 'a', 'b'), ['b', 'a', 'c', 'd']);
assert.deepEqual(moveTo(ids, 'c', 'b'), ['a', 'c', 'b', 'd']);
// Ends stay in range.
assert.deepEqual(moveTo(ids, 'a', 'd'), ['b', 'c', 'd', 'a']);
// No-ops return the same array so the caller can skip the network round-trip.
assert.equal(moveTo(ids, 'b', 'b'), ids);
assert.equal(moveTo(ids, 'b', 'zz'), ids);
assert.equal(moveTo(ids, 'zz', 'b'), ids);
// Nothing is ever lost or duplicated.
for (const [f, t] of [['a','c'],['d','a'],['b','d']]) {
  assert.deepEqual([...moveTo(ids, f, t)].sort(), [...ids].sort());
}

// Renaming a saved stage keeps its id, so tasks filed under it stay put.
assert.deepEqual(
  resolveColumnIds([{ id: 'done', label: 'Shipped' }], [{ id: 'done', label: 'Done' }]),
  [{ id: 'done', label: 'Shipped' }],
);
// A new stage called "Done" slugs to done, which is what completion mail keys off.
assert.equal(resolveColumnIds([{ id: 'draft_1', label: 'Done' }], [])[0].id, 'done');
// Two stages cannot collide on one id.
assert.deepEqual(
  resolveColumnIds([{ id: 'x', label: 'QA' }, { id: 'y', label: 'QA' }], []).map(c => c.id),
  ['qa', 'qa2'],
);
assert.equal(slugify('QA / Review'), 'qareview');

console.log('✓ board ordering: drag both directions, ends, no-ops, no loss; stage ids stable on rename');
