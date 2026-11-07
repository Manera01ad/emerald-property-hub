import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./local-agent-readiness.ps1', import.meta.url), 'utf8');

describe('Windows agent status checker is nonexecuting and privacy-safe', () => {
  it('never invokes headless agent tasks', () => {
    assert.doesNotMatch(source, /dsh\s+(?:--profile|headless)|agy\s+-p|openhands\s+(?:run|start)/);
    assert.match(source, /agents_started\s*=\s*\$false/);
    assert.match(source, /model_api_requests_sent\s*=\s*0/);
  });
  it('only makes a loopback read-only HTTP request', () => {
    assert.match(source, /http:\/\/127\.0\.0\.1:11434\/api\/tags/);
    assert.match(source, /-Method Get/);
    assert.doesNotMatch(source, /Invoke-RestMethod[\s\S]*-Method Post/);
  });
  it('does not install, pull models or write to source', () => {
    assert.doesNotMatch(source, /ollama\s+(?:pull|run)|docker\s+(?:run|pull|build)|git\s+(?:clone|push|commit|reset|clean)|Invoke-WebRequest|Start-Process/);
    assert.match(source, /git_changes_made\s*=\s*\$false/);
    assert.match(source, /check_only\s*=\s*\$true/);
  });
  it('checks model presence and distinguishes desktop apps from headless CLIs', () => {
    assert.match(source, /CommandAvailable 'dsh'/);
    assert.match(source, /CommandAvailable 'agy'/);
    assert.match(source, /CommandAvailable 'ollama'/);
    assert.match(source, /Ollama models:/);
    assert.match(source, /CLI presence does not prove authentication/);
  });
  it('does not expose secrets or disable permission gates', () => {
    assert.doesNotMatch(source, /Get-Secret|Get-Credential|Get-Item Env:|OPENHANDS_API_KEY|GITHUB_TOKEN|service_role/i);
    assert.doesNotMatch(source, /ExecutionPolicy Bypass|dangerously-skip-permissions|--privileged|CTO_AGENT_EXECUTION_ENABLED/);
  });
});
