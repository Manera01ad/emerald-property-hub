/**
 * Preflight for the PropWise CTO GitHub Actions runner.
 *
 * This file intentionally never invokes an agent, shells out, pushes, merges,
 * handles credentials, or modifies GitHub. Run approvals require a separate
 * owner-reviewed agent adapter PR; the disabled execution job fails closed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { DEFAULT_REPO, WORK_ORDERS, taskPacket } from './orchestrator.mjs';

export const OWNER = 'Manera01ad';
export const ALLOWED_MODES = ['plan', 'request-execution'];
export const ALLOWED_ISSUES = ['all', ...WORK_ORDERS.map((t) => String(t.issue))];
export const ALLOWED_AGENTS = ['auto', 'antigravity', 'deepseek', 'openhands', 'chatgpt'];

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

/** A pure, testable policy check: no network calls and no side effects. */
export function evaluateRequest(request, queue) {
  const mode = safeString(request.mode);
  const issue = safeString(request.issue);
  const agent = safeString(request.agent);
  const reasons = [];
  let packet = null;

  if (!ALLOWED_MODES.includes(mode)) reasons.push('Invalid mode.');
  if (!ALLOWED_ISSUES.includes(issue)) reasons.push('Issue is not in the reviewed CTO allowlist.');
  if (!ALLOWED_AGENTS.includes(agent)) reasons.push('Agent is not in the reviewed allowlist.');
  if (request.repository !== DEFAULT_REPO) reasons.push('Workflow repository mismatch.');
  if (request.ref !== 'refs/heads/main') reasons.push('Task preparation requires main.');
  if (request.actor !== OWNER && mode === 'request-execution') {
    reasons.push('Only the repository owner can request an execution approval.');
  }
  if (!queue || !Array.isArray(queue.tasks)) reasons.push('A valid CTO queue is required.');

  if (issue === 'all') {
    if (mode === 'request-execution') reasons.push('Execution requests must name one issue.');
  } else if (ALLOWED_ISSUES.includes(issue) && queue?.tasks) {
    const number = Number(issue);
    const task = queue.tasks.find((row) => row.issue === number);
    const registered = WORK_ORDERS.find((row) => row.issue === number);
    if (!task || !registered) {
      reasons.push('Selected issue is missing from the live queue.');
    } else {
      if (task.agent !== registered.agent || task.risk !== registered.risk) reasons.push('Queue assignment disagrees with the reviewed registry.');
      if (agent !== 'auto' && agent !== registered.agent) reasons.push('The requested agent does not own this issue.');
      if (registered.risk === 'R3') reasons.push('R3 work requires separate owner approval; no agent run is allowed.');
      if (task.state !== 'ready') reasons.push(`Issue is not ready (${task.state}).`);
      if (reasons.length === 0) {
        try {
          packet = taskPacket(queue, number);
        } catch (error) {
          reasons.push(`Task packet refused: ${error.message}`);
        }
      }
    }
  }

  if (mode === 'request-execution') {
    // Never publish an executable task packet while external execution is locked.
    packet = null;
    if (request.executionEnabled !== 'true') reasons.push('CTO_AGENT_EXECUTION_ENABLED is not explicitly enabled.');
    // Hard lock: no credentials or paid executors are wired in this PR.
    reasons.push('No external coding-agent adapter is connected. A separate owner-reviewed activation PR is required.');
  }

  const status = reasons.length ? 'blocked' : (packet ? 'packet-prepared' : 'queue-inspected');
  return {
    status,
    mode,
    issue,
    agent,
    launchPerformed: false,
    automaticDispatchEnabled: false,
    ownerApprovalBeforeMergeRequired: true,
    reasons,
    packet,
    queue: { generatedAt: queue?.generatedAt ?? null, tasks: queue?.tasks?.map((t) => ({
      issue: t.issue, agent: t.agent, risk: t.risk, state: t.state,
    })) ?? [] },
  };
}

export function summaryMarkdown(result) {
  const lines = [
    '## CTO GitHub Actions preflight',
    '',
    `**Result:** ${result.status}`,
    `**Mode:** ${result.mode}`,
    `**Issue:** ${result.issue}`,
    `**Agent:** ${result.agent}`,
    '**Agent launched:** No',
    '**Automatic dispatch:** Disabled',
    '',
  ];
  if (result.reasons.length) lines.push('### Blockers', ...result.reasons.map((r) => `- ${r}`), '');
  if (result.packet) lines.push('### Task packet', `- ${result.packet.instructions.split('\n')[0]}`, '- Prepared only, not executed.', '');
  lines.push('This run never writes to production, modifies GitHub, invokes paid models, or merges changes.');
  return lines.join('\n') + '\n';
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--queue', '--mode', '--issue', '--agent', '--repository', '--ref', '--actor', '--output', '--summary'].includes(key)) {
      throw new Error(`Unknown preflight argument: ${key}`);
    }
    if (i + 1 >= args.length) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = args[++i];
  }
  if (!options.queue || !options.output || !options.summary) {
    throw new Error('Preflight requires --queue, --output and --summary.');
  }
  return options;
}

export function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  const queue = JSON.parse(readFileSync(resolve(opts.queue), 'utf8'));
  const result = evaluateRequest({
    mode: opts.mode, issue: opts.issue, agent: opts.agent,
    repository: opts.repository, ref: opts.ref, actor: opts.actor,
    executionEnabled: process.env.CTO_AGENT_EXECUTION_ENABLED,
  }, queue);
  writeFileSync(resolve(opts.output), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(resolve(opts.summary), summaryMarkdown(result), { mode: 0o600 });
  console.log(`CTO preflight: ${result.status}. Agent launched: no.`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`CTO preflight error: ${error.message}`);
    process.exitCode = 1;
  }
}
