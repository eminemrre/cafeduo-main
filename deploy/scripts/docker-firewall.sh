#!/usr/bin/env bash
set -euo pipefail
# Docker published ports can bypass UFW INPUT rules. Preserve Caddy's internal
# bridge access to Dokploy while blocking direct connections from the WAN.
interface="$(ip -j route show default | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["dev"])')"
rule=(-i "$interface" -p tcp --dport 3000 -j DROP)
iptables -C DOCKER-USER "${rule[@]}" 2>/dev/null || iptables -I DOCKER-USER 1 "${rule[@]}"
