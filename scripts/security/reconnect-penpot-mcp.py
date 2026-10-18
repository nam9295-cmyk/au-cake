#!/usr/local/bin/python3
"""Use a protected, user-captured NEW URL as native HTTP; never pass it in argv."""
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import tomllib

def render_native_http_config(text, new_url):
    try:
        parsed = tomllib.loads(text)
        current = parsed['mcp_servers']['penpot']
        if set(current) not in ({'command', 'args'}, {'url'}):
            raise ValueError()
        headers = list(re.finditer(r'(?m)^[ \t]*\[[A-Za-z_][A-Za-z0-9_. -]*\][ \t]*(?:#.*)?$', text))
        own = [i for i, h in enumerate(headers) if h.group().strip() == '[mcp_servers.penpot]']
        if len(own) != 1:
            raise ValueError()
        i = own[0]
        start = headers[i].start()
        end = headers[i+1].start() if i+1 < len(headers) else len(text)
        updated = text[:start] + '[mcp_servers.penpot]\nurl = ' + json.dumps(new_url) + '\n\n' + text[end:]
        after = tomllib.loads(updated)
        expected = dict(parsed['mcp_servers'])
        expected['penpot'] = {'url': new_url}
        if after != {**parsed, 'mcp_servers': expected}:
            raise ValueError()
        return updated
    except Exception:
        raise ValueError('Penpot configuration requires review') from None

def protected_file(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError()
    s = path.stat()
    if s.st_uid != os.getuid() or s.st_mode & 0o077:
        raise ValueError()

def main():
    sys.dont_write_bytecode = True
    if sys.argv[1:] != ['--apply-verified-rotation']:
        raise ValueError()
    root = Path.home()/'.codex'
    config = root/'config.toml'
    capture = root/'secrets/penpot-mcp-rotated-url.json'
    for file in (config, capture):
        protected_file(file)
    spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-penpot-mcp-url.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    new_url = json.loads(capture.read_text())['url']
    new_token = module.validate_url(new_url)
    before = config.read_text()
    old = tomllib.loads(before)['mcp_servers']['penpot']
    if any(new_token in x for x in [old.get('url', ''), *old.get('args', [])] if isinstance(x, str)):
        raise ValueError()
    after = render_native_http_config(before, new_url)
    # No backup of the old credential-bearing config is created.
    fd, name = tempfile.mkstemp(prefix='.penpot-native-', dir=root)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(after)
            f.flush()
            os.fsync(f.fileno())
        if config.read_text() != before:
            raise ValueError()
        os.replace(name, config)
    finally:
        if os.path.exists(name):
            os.unlink(name)
    protected_file(config)
    if tomllib.loads(config.read_text())['mcp_servers']['penpot'] != {'url': new_url}:
        raise ValueError()
    print('Penpot native HTTP configured; credential omitted from process arguments. Other configuration preserved.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Reconnect stopped; credential and configuration diagnostics suppressed.', file=sys.stderr)
        sys.exit(1)
