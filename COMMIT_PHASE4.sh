#!/bin/bash
# Phase 4 Progress Commit

cd /home/emin/cafeduo-main

git add -A

git commit -m "feat: responsive UI with Framer Motion animations

- Navbar: Mobile slide-in menu with Framer Motion, backdrop blur
- Dashboard: Animated tab navigation with sliding indicator
- Dashboard: Responsive grid (xl:grid-cols-3), tab content transitions
- GameLobby: Responsive cards, hover animations, staggered list items
- Install framer-motion for micro-interactions
- Update AGENTS.md with Phase 4 progress"

echo "✅ Phase 4 progress committed!"
