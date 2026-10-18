#!/usr/local/bin/python3
"""User-operated capture of a NEW Penpot MCP URL. Never echo, accept argv secrets or copy the old token."""
import getpass
import json
import os
from pathlib import Path
import re
import sys
import tomllib
from urllib.parse import urlsplit, parse_qs
ORIGIN='https://very-server.tailb0ea56.ts.net:8443'
def validate_url(value):
    if not isinstance(value,str) or len(value)>8192 or any(c in value for c in '\r\n'):
        raise ValueError('Invalid input')
    u=urlsplit(value)
    query=parse_qs(u.query,keep_blank_values=True)
    if u.scheme+'://'+u.netloc!=ORIGIN or u.path!='/mcp/stream' or u.fragment or set(query)!={'userToken'} or len(query['userToken'])!=1:
        raise ValueError('Unexpected MCP target')
    token=query['userToken'][0]
    if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',token):
        raise ValueError('Expected Penpot MCP key')
    return token

def normalize_input(value):
    value=value.strip()
    if re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',value):
        value=ORIGIN+'/mcp/stream?userToken='+value
    validate_url(value)
    return value

def main():
    if len(sys.argv)!=1 or not sys.stdin.isatty():
        raise ValueError('Run in your own Terminal; no URL arguments or piped secrets')
    value=normalize_input(getpass.getpass('Paste the NEW Penpot MCP server URL or key (hidden): '))
    token=validate_url(value)
    cfg=Path.home()/'.codex/config.toml'
    old=tomllib.loads(cfg.read_text()).get('mcp_servers',{}).get('penpot',{})
    candidates=[old.get('url',''),*old.get('args',[])]
    for candidate in candidates:
        if isinstance(candidate,str):
            q=parse_qs(urlsplit(candidate).query)
            if token in q.get('userToken',[]):
                raise ValueError('New key must differ from the configured key')
    directory=Path.home()/'.codex/secrets'
    directory.mkdir(mode=0o700,exist_ok=True)
    if directory.is_symlink() or directory.stat().st_uid!=os.getuid() or directory.stat().st_mode&0o077:
        raise ValueError('Protected directory required')
    path=directory/'penpot-mcp-rotated-url.json'
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:
        json.dump({'url':value,'service':'Penpot MCP','pendingConfigUpdate':True},f)
    print('New MCP URL saved to a protected file. It was not printed. Tell Codex only: capture complete.')
if __name__=='__main__':
    try:main()
    except Exception as error:
        reasons={'New key must differ from the configured key':'The key matches the old configuration; use the newly generated key.', 'Unexpected MCP target':'Use the new key itself or the exact Penpot server URL, not a JSON snippet.', 'Expected Penpot MCP key':'Expected the new key or its server URL.', 'Protected directory required':'The secrets directory permissions need review.'}
        reason=reasons.get(str(error),'Capture stopped; no credential was printed or existing file overwritten.')
        print(reason,file=sys.stderr)
        sys.exit(1)
