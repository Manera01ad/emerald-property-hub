/**
 * PropWise AI CTO router (read-only, standard Node.js, no dependencies).
 *
 * Turns live GitHub Issues and PRs into an actionable, conflict-aware queue.
 * This never invokes an LLM or coding agent, updates GitHub, approves, merges,
 * deploys, applies SQL, or starts a paid job. A separately approved runner may
 * consume the generated task packets once its own permission/cost gates exist.
 */
import process from 'node:process';

export const DEFAULT_REPO = 'Manera01ad/emerald-property-hub';
export const CONTROL_ISSUE = 50;

// Static, auditable routing. No instructions are accepted from issue comments.
export const WORK_ORDERS = Object.freeze([
  { issue: 51, priority: 0, agent: 'deepseek', risk: 'R2', status: 'triage',
    scopes: ['src/lib/assistant/', 'src/routes/api/assistant.ts'],
    objective: 'Reproduce assistant 503 and determine read-only whether the budget RPC exists. Preserve fail-closed AI budget; create only a verified, narrow fix PR.',
    dependencies: [] },
  { issue: 52, priority: 1, agent: 'antigravity', risk: 'R2', status: 'build',
    scopes: ['src/routes/_authenticated/my.tsx', 'src/components/TransactionSelector.tsx'],
    objective: 'Finish lease preference UI and validate buy/rent/lease user journey with accessible, responsive tests. Do not modify assistant or schema files.',
    dependencies: [] },
  { issue: 53, priority: 1, agent: 'openhands', risk: 'R1', status: 'test',
    scopes: ['e2e/', 'src/test/'],
    objective: 'Add narrow authenticated-jouney QA planning or mock regression tests without live credentials or production writes.',
    dependencies: [] },
  { issue: 54, priority: 2, agent: 'owner', risk: 'R3', status: 'hold',
    scopes: ['vite.config.ts', 'package.json', 'bun.lock', 'src/lib/mcp/'],
    objective: 'Plan legacy build/package cleanup, with explicit owner approval before modifying restricted config or deployment-related paths.',
    dependencies: [51, 52] },
  { issue: 55, priority: 2, agent: 'chatgpt', risk: 'R1', status: 'review',
    scopes: ['docs/CURRENT_STATE.md', 'docs/TESTING.md'],
    objective: 'Improve current-state and test documentation without deleting code or changing security/CI settings.',
    dependencies: [] },
]);

const TASK_BY_ISSUE = new Map(WORK_ORDERS.map((task) => [task.issue, task]));

export function pathsOverlap(a, b) {
  const left = a.replace(/\\/g, '/');
  const right = b.replace(/\\/g, '/');
  return left === right || (left.endsWith('/') && right.startsWith(left)) || (right.endsWith('/') && left.startsWith(right));
}

function referencesIssue(pr, number) {
  // Only count explicit issue references; never infer from generic PR titles.
  return new RegExp(\`(?:^|[^0-9])#\${number}(?![0-9])\`).test(pr.body || '');
}

function riskState(risk) {
  if (risk === 'R3') return 'owner-required';
  if (risk === 'R2') return 'prepare-pr-only';
  return 'safe-preparation';
}

export function buildPlan({ issues = [], pullRequests = [], filesByPR = {} } = {}) {
  const issueIndex = new Map(issues.map((x) => [x.number, x]));
  const rows = WORK_ORDERS.map((task) => {
    const issue = issueIndex.get(task.issue);
    const ownPRs = pullRequests.filter((pr) => referencesIssue(pr, task.issue));
    const conflictingPRs = pullRequests.filter((pr) =>
      !ownPRs.includes(pr) && (filesByPR[pr.number] || []).some((path) => task.scopes.some((scope) => pathsOverlap(path, scope))),
    );
    const missingDeps = task.dependencies.filter((n) => issueIndex.get(n)?.state !== 'closed');
    let state;
    if (!issue) state = 'not-found';
    else if (issue.state === 'closed') state = 'completed';
    else if (ownPRs.length) state = 'review';
    else if (task.risk === 'R3') state = 'approval-required';
    else if (missingDeps.length) state = 'dependency-blocked';
    else if (conflictingPRs.length) state = 'file-conflict';
    else state = 'ready';
    return {
      issue: task.issue, priority: task.priority, agent: task.agent, risk: task.risk,
      title: issue?.title || \`Issue #\${task.issue}\`, state, execution: riskState(task.risk),
      url: issue?.html_url || \`https://github.com/\${DEFAULT_REPO}/issues/\${task.issue}\`,
      dependsOn: missingDeps, relatedPRs: ownPRs.map((p) => p.number),
      conflictingPRs: conflictingPRs.map((p) => p.number), objective: task.objective,
      scopes: task.scopes,
    };
  });
  rows.sort((a, b) => a.priority - b.priority || a.issue - b.issue);
  return { generatedAt: new Date().toISOString(), tasks: rows,
    activePRs: pullRequests.map((p) => ({ number: p.number, title: p.title, url: p.html_url, draft: p.draft, head: p.head?.sha || null })) };
}

export function taskPacket(plan, issueNumber) {
  const task = plan.tasks.find((t) => t.issue === issueNumber);
  if (!task) throw new Error(\`Unregistered CTO issue #\${issueNumber}\`);
  if (task.state !== 'ready') throw new Error(\`Issue #\${issueNumber} is not ready (\${task.state})\`);
  if (task.risk === 'R3') throw new Error(\`Owner approval required for issue #\${issueNumber}\`);
  return {
    issue: task.issue, agent: task.agent, risk: task.risk,
    approvalRequiredBeforeMerge: true,
    automaticExecutionAuthorized: false,
    allowedScopes: task.scopes,
    instructions: [
      \`Repository: \${DEFAULT_REPO}. Work order: \${task.url}.\`,
      'Read AGENTS.md, docs/INDEPENDENCE_PLAN.md and docs/CTO_TEAM.md if merged.',
      'The product has already exited Lovable.dev and Lovable Cloud; do not redo the exit.',
      task.objective,
      \`Own only these files/scopes: \${task.scopes.join(', ')}. Coordinate before changing shared files.\`,
      'Create one branch/PR. Do not push to main; do not approve/merge/deploy.',
      'No production data, migrations, credentials, RLS/auth, CI settings, paid APIs, unrestricted host permissions or skipped safety gates.',
      'Report exact test commands/results, anything untested, risks, financial impact and rollback.',
    ].join('\n'),
  };
}

export function markdownReport(plan) {
  const lines = [
    '# PropWise AI CTO queue',
    \`Generated: \${plan.generatedAt}\`,
    '',
    '| Issue | Agent | Risk | State | PR/conflict |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const t of plan.tasks) {
    const related = t.relatedPRs.length ? \`PR \${t.relatedPRs.map((n) => \`#\${n}\`).join(', ')}\` :
      t.conflictingPRs.length ? \`Conflicts with \${t.conflictingPRs.map((n) => \`#\${n}\`).join(', ')}\` :
      t.dependsOn.length ? \`Needs \${t.dependsOn.map((n) => \`#\${n}\`).join(', ')}\` : '—';
    lines.push(\`| [#\${t.issue}](\${t.url}) | \${t.agent} | \${t.risk} | \${t.state} | \${related} |\`);
  }
  lines.push('', '## Handoff',
    'This program is read-only. READY means a task packet can be prepared, **not** that an agent process has been launched.',
    'Any external runner needs separately configured sandbox permissions, spend limits and owner approval before activation.',
    'No agent may automatically merge, deploy, run SQL or disable budget/security checks.');
  return lines.join('\n') + '\n';
}

async function gh(repo, path, token) {
  const url = \`https://api.github.com/repos/\${repo}\${path}\`;
  const response = await fetch(url, { headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'propwise-cto-readonly',
    ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
  } });
  if (!response.ok) throw new Error(\`GitHub API \${response.status} on \${path} (\${response.status === 403 ? 'check rate limit/token permissions' : 'request failed'})\`);
  return response.json();
}

async function livePlan(repo, token) {
  const [issues, pullRequests] = await Promise.all([
    Promise.all(WORK_ORDERS.map((t) => gh(repo, \`/issues/\${t.issue}\`, token))),
    gh(repo, '/pulls?state=open&per_page=100', token),
  ]);
  const pairs = await Promise.all(pullRequests.map(async (pr) => {
    const files = await gh(repo, \`/pulls/\${pr.number}/files?per_page=100\`, token);
    return [pr.number, files.map((f) => f.filename)];
  }));
  return buildPlan({ issues, pullRequests, filesByPR: Object.fromEntries(pairs) });
}

function parseArgs(argv) {
  const options = { mode: 'report', repo: DEFAULT_REPO, issue: null, format: 'markdown' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (['--mode', '--repo', '--issue', '--format'].includes(flag)) {
      if (i + 1 >= argv.length) throw new Error(\`Missing value for \${flag}\`);
      const key = flag.slice(2); options[key] = argv[++i];
    } else throw new Error(\`Unknown argument: \${flag}\`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) throw new Error('Invalid repository identifier');
  if (!['report', 'queue', 'packet'].includes(options.mode)) throw new Error('Unknown mode');
  if (!['markdown', 'json'].includes(options.format)) throw new Error('Unknown format');
  if (options.mode === 'packet' && !TASK_BY_ISSUE.has(Number(options.issue))) throw new Error('Packet mode requires a known --issue');
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const plan = await livePlan(args.repo, process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  if (args.mode === 'packet') {
    console.log(JSON.stringify(taskPacket(plan, Number(args.issue)), null, 2));
  } else if (args.mode === 'queue' || args.format === 'json') {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(markdownReport(plan));
  }
}

if (process.argv[1]?.endsWith('orchestrator.mjs')) {
  main().catch((error) => { console.error(\`CTO router failed: \${error.message}\`); process.exitCode = 1; });
}
