"""Pure byte-preserving seven-variable transform. No network, subprocess or implicit writes."""
import base64
import hashlib
import re

KEYS = ('_APP_SMTP_HOST', '_APP_SMTP_PORT', '_APP_SMTP_SECURE',
        '_APP_SMTP_USERNAME', '_APP_SMTP_PASSWORD', '_APP_SYSTEM_EMAIL_NAME',
        '_APP_SYSTEM_EMAIL_ADDRESS')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fields(data):
    if not isinstance(data, bytes):
        raise ValueError('SMTP_BYTES_REQUIRED')
    found = {}
    for key in KEYS:
        pattern = rb'(?m)^[ \t]*(?:export[ \t]+)?' + key.encode() + rb'[ \t]*=[^\r\n]*(?:\r?\n|$)'
        rows = list(re.finditer(pattern, data))
        if len(rows) != 1:
            raise ValueError('SMTP_FIELD_COUNT')
        found[key] = rows[0]
    return found


def plan_env(before, replacements):
    if set(replacements) != set(KEYS):
        raise ValueError('SMTP_EXACT_SEVEN_REQUIRED')
    found = fields(before)
    changes = []
    state = {'version': 1, 'beforeSha256': digest(before), 'fields': {}}
    for key in KEYS:
        value = replacements[key]
        if not isinstance(value, bytes) or not re.fullmatch(rb'[A-Za-z0-9_@.%:/+\-=]*', value):
            raise ValueError('SMTP_UNSAFE_VALUE')
        match = found[key]
        old = match.group()
        prefix = old[:old.index(b'=') + 1]
        ending = b'\r\n' if old.endswith(b'\r\n') else b'\n' if old.endswith(b'\n') else b''
        new = prefix + value + ending
        state['fields'][key] = {'before': base64.b64encode(old).decode(), 'after': base64.b64encode(new).decode()}
        changes.append((match.start(), match.end(), new))
    after = before
    for start, end, replacement in sorted(changes, reverse=True):
        after = after[:start] + replacement + after[end:]
    state['afterSha256'] = digest(after)
    return after, state


def restore_env(current, state):
    if state.get('version') != 1 or set(state.get('fields', {})) != set(KEYS):
        raise ValueError('SMTP_INVALID_STATE')
    found = fields(current)
    changes = []
    for key in KEYS:
        expected = base64.b64decode(state['fields'][key]['after'], validate=True)
        original = base64.b64decode(state['fields'][key]['before'], validate=True)
        match = found[key]
        if match.group() != expected:
            raise ValueError('SMTP_TARGET_FIELD_DRIFT')
        changes.append((match.start(), match.end(), original))
    result = current
    for start, end, replacement in sorted(changes, reverse=True):
        result = result[:start] + replacement + result[end:]
    return result
