import os
import pty
import sys
import time


def _required_env(key: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {key}")
    return value


def main() -> None:
    host = _required_env("DEPLOY_HOST")
    user = os.getenv("DEPLOY_USER", "root").strip() or "root"
    password = os.getenv("DEPLOY_PASSWORD", "")
    list_path = os.getenv("DEPLOY_LIST_PATH", "/opt").strip() or "/opt"

    pid, fd = pty.fork()
    if pid == 0:
        os.execlp("ssh", "ssh", "-o", "StrictHostKeyChecking=no", f"{user}@{host}")
        return

    password_sent = False
    while True:
        try:
            data = os.read(fd, 1024)
            if not data:
                break
            if b"assword:" in data and not password_sent:
                if not password:
                    raise RuntimeError("Password prompt received but DEPLOY_PASSWORD is empty.")
                os.write(fd, f"{password}\n".encode("utf-8"))
                password_sent = True
                break
        except OSError:
            break

    time.sleep(1)
    os.write(fd, f"ls -la {list_path}\nexit\n".encode("utf-8"))

    while True:
        try:
            data = os.read(fd, 1024)
            if not data:
                break
            sys.stdout.write(data.decode("utf-8", errors="ignore"))
            sys.stdout.flush()
        except OSError:
            break
    os.waitpid(pid, 0)


if __name__ == "__main__":
    main()
