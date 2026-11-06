import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./local-openhands-free-pilot.ps1', import.meta.url), 'utf8');

describe('free OpenHands local pilot safety checklist', () => {
  it('makes installation and container launch opt-in', () => {
    assert.match(source, /\[switch\]\$Start/);
    assert.match(source, /if \(-not \$Start\)/);
    assert.match(source, /CHECK ONLY: nothing downloaded, installed, cloned or started/);
  });

  it('checks hardware and local model server before launching', () => {
    assert.match(source, /Win32_ComputerSystem/);
    assert.match(source, /\$ramGb -lt 16/);
    assert.match(source, /http:\/\/127\.0\.0\.1:11434\/api\/tags/);
    assert.match(source, /if \(-not \$modelPresent\)/);
  });

  it('uses a bounded local UI and never auto-enables Cloud GitHub Action', () => {
    assert.match(source, /127\.0\.0\.1:8000:8000/);
    assert.match(source, /ghcr\.io\/openhands\/agent-canvas:1\.36\.0/);
    assert.doesNotMatch(source, /OPENHANDS_API_KEY\s*=/);
    assert.doesNotMatch(source, /CTO_AGENT_EXECUTION_ENABLED\s*=/);
  });

  it('isolates the checkout from the normal workspace and does not auto-push', () => {
    assert.match(source, /PropWise-OpenHands-Free-Pilot/);
    assert.match(source, /git -c credential\.helper= clone --depth 1/);
    assert.doesNotMatch(source, /git push|git reset --hard|git clean -fd/);
    assert.doesNotMatch(source, /--privileged|--network host/);
  });

  it('uses no admin elevation and no provider API secrets', () => {
    assert.doesNotMatch(source, /Start-Process .* -Verb RunAs|Set-ExecutionPolicy/);
    assert.doesNotMatch(source, /sk-[a-zA-Z0-9]{10,}/);
  });
});
