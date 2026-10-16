import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTransition, nextStatuses } from '../src/services/workflow.js';

const base = { requireClosure: true, reopenWindowDays: 14 };

test('happy path transitions are legal for staff', () => {
  const path = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved'];
  for (let i = 0; i < path.length - 1; i++) assert.ok(checkTransition({ ...base, from: path[i], to: path[i + 1], role: 'staff' }).ok);
});
test('illegal jumps are rejected', () => {
  assert.equal(checkTransition({ ...base, from: 'submitted', to: 'resolved', role: 'staff' }).code, 'ILLEGAL_TRANSITION');
  assert.equal(checkTransition({ ...base, from: 'closed', to: 'reopened', role: 'admin', note: 'because' }).code, 'ILLEGAL_TRANSITION');
});
test('residents can never resolve or close', () => {
  for (const to of ['resolved', 'closed', 'in_progress', 'assigned'])
    assert.equal(checkTransition({ ...base, from: 'in_progress', to, role: 'resident', isOwner: true }).ok, false);
  assert.equal(checkTransition({ ...base, from: 'resolved', to: 'closed', role: 'resident', isOwner: true }).code, 'FORBIDDEN_TRANSITION');
});
test('resident may reopen only own resolved complaint with a reason inside the window', () => {
  const r = { ...base, from: 'resolved', to: 'reopened', role: 'resident', isOwner: true, note: 'Pothole is back' };
  assert.ok(checkTransition(r).ok);
  assert.equal(checkTransition({ ...r, isOwner: false }).code, 'FORBIDDEN_TRANSITION');
  assert.equal(checkTransition({ ...r, note: '' }).code, 'REASON_REQUIRED');
  assert.equal(checkTransition({ ...r, resolvedAt: new Date(Date.now() - 30 * 86400000) }).code, 'REOPEN_WINDOW_EXPIRED');
});
test('rejection requires a reason', () => {
  assert.equal(checkTransition({ ...base, from: 'submitted', to: 'rejected', role: 'staff', note: '' }).code, 'REASON_REQUIRED');
  assert.ok(checkTransition({ ...base, from: 'submitted', to: 'rejected', role: 'staff', note: 'Not a civic issue' }).ok);
});
test('closure step can be disabled by configuration', () => {
  assert.deepEqual(nextStatuses('resolved', false), ['reopened']);
  assert.deepEqual(nextStatuses('resolved', true), ['closed', 'reopened']);
});
