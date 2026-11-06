import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, markdownReport, pathsOverlap, taskPacket } from './orchestrator.mjs';

const issue = (number, state = 'open') => ({ number, title: `Issue ${number}`, state, html_url: `https://github.com/Manera01ad/emerald-property-hub/issues/${number}` });
const issues = [51, 52, 53, 54, 55].map((n) => issue(n));

describe('CTO route planning safety gates', () => {
  it('recognizes directory and exact file overlap without confusing neighbors', () => {
    assert.equal(pathsOverlap('src/lib/assistant/', 'src/lib/assistant/chat.server.ts'), true);
    assert.equal(pathsOverlap('src/routes/_authenticated/my.tsx', 'src/routes/_authenticated/my.tsx'), true);
    assert.equal(pathsOverlap('src/lib/assistant/', 'src/lib/buyer.ts'), false);
    assert.equal(pathsOverlap('src/lib/assistant/', 'src/lib/assistant2.ts'), false);
  });
  it('keeps high-risk cleanup approval-gated and dependencies visible', () => {
    const plan = buildPlan({ issues });
    assert.equal(plan.tasks.find((t) => t.issue === 54).state, 'approval-required');
    assert.deepEqual(plan.tasks.find((t) => t.issue === 54).dependsOn, [51, 52]);
    assert.equal(plan.tasks.find((t) => t.issue === 51).state, 'ready');
    assert.equal(plan.tasks.find((t) => t.issue === 53).execution, 'safe-preparation');
  });
  it('prevents generating an execution packet for owner-required work', () => {
    const plan = buildPlan({ issues });
    assert.throws(() => taskPacket(plan, 54), /not ready|Owner approval/);
    const packet = taskPacket(plan, 53);
    assert.equal(packet.automaticExecutionAuthorized, false);
    assert.equal(packet.approvalRequiredBeforeMerge, true);
    assert.match(packet.instructions, /No production data/);
  });
  it('does not override in-review, completed, or conflicted work', () => {
    const prs = [
      { number: 77, title: 'Assistant tests', body: 'Closes #51', head: { sha: 'abc' } },
      { number: 78, title: 'Other lease PR', body: 'Unrelated work', head: { sha: 'def' } },
    ];
    const plan = buildPlan({ issues: issues.map((x) => x.number === 55 ? { ...x, state: 'closed' } : x), pullRequests: prs,
      filesByPR: { 77: ['src/lib/assistant/chat.server.test.ts'], 78: ['src/routes/_authenticated/my.tsx'] } });
    assert.equal(plan.tasks.find((t) => t.issue === 51).state, 'review');
    assert.equal(plan.tasks.find((t) => t.issue === 52).state, 'file-conflict');
    assert.equal(plan.tasks.find((t) => t.issue === 55).state, 'completed');
    assert.throws(() => taskPacket(plan, 52), /not ready/);
  });
  it('does not treat #510 or a generic title as a reference to #51', () => {
    const plan = buildPlan({ issues, pullRequests: [{ number: 99, title: 'AI 51', body: 'See #510', head: { sha: 'xyz' } }] });
    assert.equal(plan.tasks.find((t) => t.issue === 51).state, 'ready');
  });
  it('makes a readable status summary with no false run claims', () => {
    const out = markdownReport(buildPlan({ issues }));
    assert.match(out, /CTO queue/);
    assert.match(out, /READY means a task packet can be prepared/);
    assert.doesNotMatch(out, /Agent launched successfully/);
  });
});
