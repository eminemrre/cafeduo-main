# 🎮 CafeDuo

[![Tests](https://img.shields.io/badge/tests-145%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-34%25-yellow)]()
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)]()
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

> ☕ **Gamified cafe loyalty platform for university students**

Students check in at cafes, play multiplayer games with friends, earn points, and redeem real cafe rewards!

![Demo GIF Placeholder](https://via.placeholder.com/800x400/1a1a2e/ffffff?text=🎮+Demo+GIF+Coming+Soon)

---

## ✨ Features

### 🎮 Multiplayer Games
- **Rock Paper Scissors** - Classic game with real-time multiplayer
- **Gladiator Arena** - Turn-based battle game
- **Game Lobby** - Create or join games instantly
- **Live Matchmaking** - Find opponents in your cafe

### 📍 Cafe Check-in System
- **PIN Verification** - Secure table check-in with unique codes
- **Location-based** - Only valid cafe locations
- **Friend Discovery** - See who's checked in at the same cafe

### 🏆 Points & Leaderboard
- **Earn Points** - Win games to earn cafe points
- **Daily Rewards** - Check in daily for bonus points
- **Global Rankings** - Compete on the global leaderboard
- **Achievements** - Unlock badges and achievements

### 🎁 Reward Store
- **Cafe Rewards** - Exchange points for free drinks, snacks, discounts
- **Inventory System** - Manage your redeemed rewards
- **QR Code Redemption** - Easy reward claiming at counter

### 🎨 Modern UI/UX
- **Responsive Design** - Works perfectly on mobile & desktop
- **Micro-animations** - Smooth transitions with Framer Motion
- **Dark Theme** - Eye-catching arcade-style design
- **Toast Notifications** - Real-time feedback
- **Skeleton Loading** - Smooth loading states

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 + Framer Motion |
| **State** | React Context + Custom Hooks |
| **Backend** | Node.js + Express.js |
| **Real-time** | Socket.IO |
| **Database** | PostgreSQL |
| **Auth** | JWT + bcrypt |
| **Testing** | Jest + React Testing Library + Playwright |
| **DevOps** | Docker + GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or use Docker)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/cafeduo.git
cd cafeduo

# Start with Docker Compose
docker-compose up -d

# App will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Setup database
createdb cafeduo
psql cafeduo < schema.sql

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Start development server
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

---

## 📊 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

**Test Coverage:** 34% (145 tests passing)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   React     │  │  Socket.IO  │  │   React Router      │  │
│  │  Components │  │   Client    │  │    (Navigation)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Server                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Express   │  │  Socket.IO  │  │   JWT Auth          │  │
│  │   Routes    │  │   Server    │  │   Middleware        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Users    │  │    Games    │  │    Rewards          │  │
│  │   Tables    │  │   Tables    │  │    Tables           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
cafeduo/
├── components/           # React components
│   ├── dashboard/        # Dashboard sections
│   ├── ui/               # Reusable UI components
│   └── ...
├── hooks/                # Custom React hooks
├── contexts/             # React contexts (Auth, Toast)
├── backend/              # Express.js API
│   ├── server.js         # Main server
│   └── db.js             # Database connection
├── e2e/                  # Playwright E2E tests
├── schema.sql            # Database schema
└── docker-compose.yml    # Docker setup
```

---

## 📚 Documentation

- [API Documentation](./docs/API.md) (Coming Soon)
- [Architecture Decisions](./docs/ADR.md) (Coming Soon)
- [Contributing Guide](./CONTRIBUTING.md) (Coming Soon)
- [Deployment Guide](./docs/DEPLOYMENT.md) (Coming Soon)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Made with ☕ and 🎮 for university students
</p>
