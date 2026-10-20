#!/bin/bash
set -Eeuo pipefail
umask 077
# Sole approved apply entry. No retry/fallback path after a failed prerequisite.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
SCOPE_DIR="$PWD/.superpowers/sdd/2026-10-19-customer-account-smtp-ui-final"
node /Users/nam9295/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js whoami > "$SCOPE_DIR/cloudflare-preapply-refresh.private.log" 2>&1
node "$SCOPE_DIR/read-policy.mjs" before-smtp
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {claim,read,DIR} from './.superpowers/sdd/2026-10-19-customer-account-smtp-ui-final/release-api.mjs';
const j=await read(DIR+'/journal.safe.json');assert.ok(Number.isSafeInteger(j.smtpApplyAttempts));assert.equal(j.smtpApplyAttempts,0);await claim('smtp-single-apply','smtpApplyAttempts',1);
JS
ssh -o BatchMode=yes very 'python3 -' <<'PYROOT'
from pathlib import Path
import json,os
p=Path('/home/john/.verygood-account-smtp-ui-final')
s=json.loads((p/'root-status.safe.json').read_bytes());assert s['phase']=='prepared' and s['rootTimerVerified'] and s['candidateExactSeven'];assert not (p/'keep-confirmation.private.json').exists()
fd=os.open(p/'apply.request.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump({'manifestSha256':'6a498278d9cef1cfc5b4aa1a937fac101db0387a7a5b41dd484a04914bb9725d'},f)
PYROOT
