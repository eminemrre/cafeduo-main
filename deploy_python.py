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
    commands = """
        D_PATH="/opt/cafeduo-main"
        echo "Working inside $D_PATH"
        cd "$D_PATH"
        
        # Build without cache
        docker compose -f deploy/docker-compose.prod.yml --env-file .env build --no-cache web
        
        # Recreate containers
        docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --force-recreate
        
        # Restart Caddy
        docker compose -f deploy/docker-compose.prod.yml restart caddy
        
        # Prune old images
        docker image prune -a -f
        
        echo "DEPLOYMENT COMPLETE!"
        exit
    """
    for line in commands.strip().split('\n'):
        os.write(fd, line.encode('utf-8') + b'\r')
        time.sleep(0.5)
    
    while True:
        try:
            data = os.read(fd, 1024)
            if not data: break
            sys.stdout.write(data.decode('utf-8', errors='ignore'))
            sys.stdout.flush()
        except OSError:
            break
    os.waitpid(pid, 0)
