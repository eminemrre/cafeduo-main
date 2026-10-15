#!/usr/bin/env python3
"""Normalize clipboard formatting without printing private key material."""
import base64
import binascii
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import textwrap


def normalize_key(value):
    if not value or len(value) > 32768:
        raise ValueError("DEPLOY_SSH_KEY is empty or too large")
    value = value.strip().lstrip("\ufeff")
    if value.startswith('"'):
        try:
            decoded = json.loads(value)
            if isinstance(decoded, str):
                value = decoded
        except ValueError:
            pass
    value = value.replace("\\r", "\r").replace("\\n", "\n")
    if "-----BEGIN " not in value:
        try:
            value = base64.b64decode(re.sub(r"\s", "", value), validate=True).decode("ascii")
        except (ValueError, UnicodeError, binascii.Error):
            raise ValueError("DEPLOY_SSH_KEY must contain the complete private key") from None
    match = re.search(
        r"-----BEGIN (OPENSSH PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|PRIVATE KEY)-----"
        r"([\s\S]*?)-----END \1-----", value
    )
    if not match:
        raise ValueError("DEPLOY_SSH_KEY is missing its private key header or footer")
    kind, body = match.groups()
    body = re.sub(r"\s", "", body)
    try:
        raw = base64.b64decode(body, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("DEPLOY_SSH_KEY contains an invalid private key body") from None
    if not raw or (kind == "OPENSSH PRIVATE KEY" and not raw.startswith(b"openssh-key-v1\0")):
        raise ValueError("DEPLOY_SSH_KEY is not a valid private key")
    return f"-----BEGIN {kind}-----\n" + "\n".join(textwrap.wrap(body, 70)) + f"\n-----END {kind}-----\n"


def prepare_key(value, destination):
    key = normalize_key(value)
    destination = Path(destination)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(key)
        result = subprocess.run(
            ["ssh-keygen", "-y", "-P", "", "-f", str(destination)],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if result.returncode:
            raise ValueError("DEPLOY_SSH_KEY is incomplete, invalid, or passphrase-protected; copy the complete supplied file")
    except Exception:
        destination.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    try:
        prepare_key(os.environ.get("DEPLOY_SSH_KEY", ""), sys.argv[1])
    except (ValueError, OSError, subprocess.TimeoutExpired, IndexError) as error:
        print(f"::error::{error}", file=sys.stderr)
        sys.exit(1)
    print("[deploy] SSH private key format validated.")
