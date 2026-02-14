<div align="center">

# CafeDuo

**Gamified cafe loyalty platform for university communities.**

Play real-time games in participating cafes, collect points, and redeem rewards.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?logo=socket.io)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

[Overview](#overview) · [Live](#live) · [Key Features](#key-features) · [Architecture](#architecture-and-tech-stack) · [Quick Start](#quick-start) · [Testing](#testing) · [Roadmap](#roadmap)

</div>

---

## Overview

CafeDuo combines cafe check-ins, multiplayer mini-games, and reward redemption in one full-stack system.

The product is designed for:

- increasing repeat visits,
- creating social engagement in-venue,
- and turning loyalty into measurable gameplay activity.

## Live

- Production web app: https://cafeduotr.com

## Key Features

- In-cafe check-in flow
: PIN-based session validation for cafe tables and local engagement.

- Real-time multiplayer gameplay
: Socket.IO powered game lobbies and live match state.

- Loyalty and rewards
: Point accumulation, leaderboard logic, and reward redemption flow.

- Cafe discovery and map support
: Nearby cafe browsing with map integration.

- Full-stack operational tooling
: Dockerized setup, smoke checks, and deployment documentation.

## Architecture and Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion |
| Backend | Node.js + Express |
| Real-Time | Socket.IO |
| Database | PostgreSQL |
| Cache | Redis |
| Auth & Security | JWT, bcrypt, Helmet, rate limiting, reCAPTCHA |
| Testing | Jest + React Testing Library + Playwright |
| DevOps | Docker + Docker Compose |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ (or Docker)

### Option A: Docker (recommended)

```bash
git clone https://github.com/eminemre35/cafeduo-main.git
cd cafeduo-main
cp .env.example .env
docker-compose up -d
```

Default local endpoints:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

### Option B: Local development

```bash
npm install
createdb cafeduo
psql cafeduo < schema.sql
cp .env.example .env
npm run dev
```

## Testing

```bash
npm test
npm run test:coverage
npm run test:e2e
npm run test:all
npm run smoke:live
```

## Deployment Status

| Target | Status | Notes |
|---|---|---|
| Web App | Live | Served at `https://cafeduotr.com` |
| API + Realtime | Active | Node/Express + Socket.IO backend |
| Containerized Deploy | Ready | Docker and deployment docs included |

## Roadmap

- Product roadmap: [ROADMAP.md](ROADMAP.md)
- Engineering roadmap: [ROADMAP_SENIOR.md](ROADMAP_SENIOR.md)
- Deployment playbook: [DEPLOYMENT.md](DEPLOYMENT.md)

## Contributing

Contributions are welcome.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md).
2. Open an issue for large features or behavior changes.
3. Submit a pull request with clear test coverage notes.

Additional project policies:

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

---

<div align="center">

Built for community-driven cafe engagement.

</div>
