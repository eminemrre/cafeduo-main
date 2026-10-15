"""Exercise real OpenSSH parsing with disposable, locally generated keys."""
import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare_ssh_key", Path(__file__).with_name("prepare-ssh-key.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrepareKeyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.original = self.root / "original"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(self.original)], check=True)
        self.key = self.original.read_text()
        self.public = self.original.with_suffix(".pub").read_text().split()[:2]

    def test_clipboard_formats_preserve_the_public_key_and_private_permissions(self):
        formats = [
            self.key, self.key.rstrip(), self.key.replace("\n", "\r\n"),
            self.key.replace("\n", "\\n"), self.key.replace("\n", " "),
            json.dumps(self.key), "```text\n" + self.key + "```",
            "\ufeff" + self.key, "\n".join("    " + line for line in self.key.splitlines()),
            base64.b64encode(self.key.encode()).decode(),
        ]
        for index, value in enumerate(formats):
            with self.subTest(format=index):
                target = self.root / "prepared"
                target.write_text("old")
                target.chmod(0o644)
                module.prepare_key(value, target)
                result = subprocess.run(["ssh-keygen", "-y", "-P", "", "-f", str(target)], capture_output=True, text=True, check=True)
                self.assertEqual(result.stdout.split()[:2], self.public)
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_incomplete_or_public_key_is_rejected(self):
        for value in ["", self.key.split("-----END")[0], "ssh-ed25519 AAAATEST", "-----BEGIN OPENSSH PRIVATE KEY-----\n!\n-----END OPENSSH PRIVATE KEY-----"]:
            with self.subTest(value_length=len(value)):
                with self.assertRaises(ValueError):
                    module.prepare_key(value, self.root / "invalid")

    def test_truncated_payload_does_not_leave_a_private_file(self):
        body = base64.b64encode(b"openssh-key-v1\0truncated").decode()
        value = f"-----BEGIN OPENSSH PRIVATE KEY-----\n{body}\n-----END OPENSSH PRIVATE KEY-----"
        target = self.root / "invalid"
        with self.assertRaises(ValueError):
            module.prepare_key(value, target)
        self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
