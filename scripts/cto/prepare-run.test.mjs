import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from './orchestrator.mjs';
import { evaluateRequest, summaryMarkdown } from './prepare-run.mjs';

const issues = [51, 52, 53, 54, 55].map((number) => ({
  number, state: 'open', title: `Issue ${number}`,
  html_url: `https://github.com/Manera01ad/emerald-property-hub/issues/${number}`,
}));
const queue = () => buildPlan({ issues });
const request = (overrides = {}) => ({
  mode: 'plan', issue: 'all', agent: 'auto',
  repository: 'Manera01ad/emerald-property-hub',
  ref: 'refs/heads/main', actor: 'Manera01ad',
  executionEnabled: 'false', ...overrides,
});

describe('CTO runner preflight is always nonexecuting', () => {
  it('allows read-only queue inspection without a specific issue', () => {
    const result = evaluateRequest(request(), queue());
    assert.equal(result.status, 'queue-inspected');
    assert.equal(result.launchPerformed, false);
    assert.equal(result.automaticDispatchEnabled, false);
    assert.equal(result.queue.tasks.length, 5);
  });
  it('prepares only an allowlisted, ready task with the correct owner', () => {
    const result = evaluateRequest(request({ issue: '53', agent: 'openhands' }), queue());
    assert.equal(result.status, 'packet-prepared');
    assert.equal(result.packet.agent, 'openhands');
    assert.equal(result.packet.approvalRequiredBeforeMerge, true);
    assert.equal(result.packet.automaticExecutionAuthorized, false);
  });
  it('blocks a different agent from claiming a task', () => {
    const result = evaluateRequest(request({ issue: '53', agent: 'deepseek' }), queue());
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /does not own/);
  });
  it('refuses an issue already covered by a pull request', () => {
    const plan = buildPlan({ issues, pullRequests: [{ number: 99, title: 'QA', body: 'Closes #53' }] });
    const result = evaluateRequest(request({ issue: '53' }), plan);
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /not ready/);
  });
  it('refuses R3 restricted work even if manually requested', () => {
    const result = evaluateRequest(request({ issue: '54', agent: 'auto' }), queue());
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /R3/);
  });
  it('refuses unknown issues and invalid agents', () => {
    assert.equal(evaluateRequest(request({ issue: '123' }), queue()).status, 'blocked');
    assert.equal(evaluateRequest(request({ agent: 'untrusted' }), queue()).status, 'blocked');
  });
  it('refuses a repository or branch mismatch', () => {
    assert.equal(evaluateRequest(request({ repository: 'somebody/else' }), queue()).status, 'blocked');
    assert.equal(evaluateRequest(request({ ref: 'refs/heads/feature' }), queue()).status, 'blocked');
  });
  it('refuses unauthorized actor execution', () => {
    const result = evaluateRequest(request({ mode: 'request-execution', issue: '53', agent: 'openhands', actor: 'other', executionEnabled: 'true' }), queue());
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /owner/);
    assert.equal(result.launchPerformed, false);
  });
  it('stays locked even for owner with an enabled repository variable', () => {
    const result = evaluateRequest(request({ mode: 'request-execution', issue: '53', agent: 'openhands', executionEnabled: 'true' }), queue());
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /separate owner-reviewed activation PR/);
    assert.equal(result.packet, null);
    assert.equal(result.launchPerformed, false);
  });
  it('rejects request-execution across the entire queue', () => {
    const result = evaluateRequest(request({ mode: 'request-execution', issue: 'all', executionEnabled: 'true' }), queue());
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons.join(' '), /one issue/);
  });
  it('handles a missing or malformed task queue safely', () => {
    const result = evaluateRequest(request({ issue: '53' }), {});
    assert.equal(result.status, 'blocked');
    assert.equal(result.packet, null);
  });
  it('reports preparation truthfully without claiming any launch', () => {
    const result = evaluateRequest(request({ issue: '53', agent: 'openhands' }), queue());
    const text = summaryMarkdown(result);
    assert.match(text, /Agent launched:\*\* No/);
    assert.match(text, /Automatic dispatch:\*\* Disabled/);
    assert.match(text, /Prepared only, not executed/);
  });
});
