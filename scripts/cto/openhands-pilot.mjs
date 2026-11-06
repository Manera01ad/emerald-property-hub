/**
 * Read-only OpenHands QA pilot preview.
 * Creates a fixed, allowlisted QA prompt ONLY from the reviewed CTO registry.
 * No agent API calls, production access, paid work, GitHub writes or shell execution.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRequest } from './prepare-run.mjs';

const REPO = 'Manera01ad/emerald-property-hub';
const ISSUE = 53;
const OWNER = 'Manera01ad';
const ALLOWED_SCOPES = ['e2e/', 'src/test/'];

export function buildOpenHandsPreview(queue, context) {
  const reasons = [];
  if (context?.repository !== REPO) reasons.push('Repository mismatch.');
  if (context?.ref !== 'refs/heads/main') reasons.push('Only reviewed main may prepare the pilot.');
  if (context?.actor !== OWNER) reasons.push('Only the repository owner can prepare this pilot.');
  if (Number(context?.issue) !== ISSUE) reasons.push('Only the QA pilot issue #53 is allowed.');

  const check = evaluateRequest({
    mode: 'plan', issue: String(ISSUE), agent: 'openhands',
    repository: context?.repository, ref: context?.ref, actor: context?.actor,
    executionEnabled: 'false',
  }, queue);
  if (check.status !== 'packet-prepared') reasons.push(...check.reasons, 'The issue is not currently available for dispatch.');
  if (check.packet && (
    check.packet.risk !== 'R1' ||
    check.packet.agent !== 'openhands' ||
    JSON.stringify(check.packet.allowedScopes) !== JSON.stringify(ALLOWED_SCOPES)
  )) reasons.push('Task ownership, risk or permitted paths changed; review the CTO registry first.');

  // Deliberately do not interpolate untrusted GitHub issue titles or descriptions.
  const prompt = reasons.length ? null : [
    '# OpenHands QA pilot: Issue #53',
    '',
    'Repository: Manera01ad/emerald-property-hub',
    'Task: https://github.com/Manera01ad/emerald-property-hub/issues/53',
    '',
    'Read AGENTS.md and docs/CTO_TEAM.md. PropWise AI already left Lovable.dev and Lovable Cloud.',
    'Create only a small, reviewable QA/test PR. Do not edit application source.',
    'Permitted changed paths only: e2e/ and src/test/.',
    'Focus on public listing visibility, private photos, enquiry consent and authenticated access using mocks or a nonproduction test backend.',
    'Never access production data, service credentials, paid models, database migrations, auth/RLS code, deployment or workflow files.',
    'Never push directly to main, self-merge, or deploy. Stop if permissions or safety limits block tests.',
    'Report exact tests actually run, missing evidence, risks and rollback.',
    'If an integration needs real accounts or live secrets, stop and report a human-owned acceptance check.',
  ].join('\n') + '\n';

  return {
    status: reasons.length ? 'blocked' : 'prompt-prepared',
    issue: ISSUE, agent: 'openhands', risk: 'R1', reasons,
    launchPerformed: false, externalAgentAuthorized: false,
    ownerApprovalBeforeMergeRequired: true, prompt,
  };
}

export function summary(preview) {
  const lines = [
    '## OpenHands pilot preparation',
    '',
    `**State:** ${preview.status}`,
    '**Agent launched:** No',
    '**Model/API cost:** No model call made by this preview',
    '**Auto-execution:** Disabled in workflow source',
    '',
  ];
  if (preview.reasons.length) lines.push('### Not ready', ...preview.reasons.map((r) => `- ${r}`), '');
  if (preview.prompt) lines.push('### Work order', 'Prepared a fixed QA-only prompt for issue #53; no execution has occurred.', '');
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 2) throw new Error('Usage: node openhands-pilot.mjs QUEUE_JSON OUTPUT_DIRECTORY');
  const queue = JSON.parse(readFileSync(resolve(argv[0]), 'utf8'));
  const result = buildOpenHandsPreview(queue, {
    repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF,
    actor: env.GITHUB_ACTOR, issue: env.CTO_ISSUE,
  });
  const dir = resolve(argv[1]);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'status.json'), JSON.stringify({ ...result, prompt: undefined }, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(resolve(dir, 'summary.md'), summary(result) + '\n', { mode: 0o600 });
  if (result.prompt) writeFileSync(resolve(dir, 'task.md'), result.prompt, { mode: 0o600 });
  console.log(`OpenHands pilot: ${result.status}; launchPerformed=false`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`OpenHands QA pilot preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
