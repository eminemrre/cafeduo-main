import pty, os, sys, time

pid, fd = pty.fork()
if pid == 0:
    os.execlp("ssh", "ssh", "-o", "StrictHostKeyChecking=no", "root@217.60.254.141")
else:
    password_sent = False
    while True:
        try:
            data = os.read(fd, 1024)
            if not data: break
            if b'assword:' in data and not password_sent:
                os.write(fd, b"!lqt3dOLsbl9M\n")
                password_sent = True
                break
        except OSError:
            break
            
    time.sleep(2)
    os.write(fd, b"ls -la /opt\nexit\n")
    
    while True:
        try:
            data = os.read(fd, 1024)
            if not data: break
            sys.stdout.write(data.decode('utf-8', errors='ignore'))
            sys.stdout.flush()
        except OSError:
            break
    os.waitpid(pid, 0)
