# CafeDuo - Complete Project Documentation

> **Purpose**: This document provides a comprehensive technical overview of the CafeDuo project for AI assistants, developers, and maintainers.

---

## 1. Project Overview

**CafeDuo** is a gamified loyalty platform for cafes. Users earn points by playing games against other customers in the same cafe, then redeem those points for real rewards (free coffee, discounts, etc.).

### Core Features
- 🎮 **Multiplayer Games**: Rock-Paper-Scissors, Gladiator Arena, Shape Matching
- 📍 **Location Verification**: GPS-based check-in to verify users are physically in the cafe
- 🏆 **Points & Leaderboards**: Earn points from wins, compete on leaderboards
- 🎁 **Reward Shop**: Spend points on cafe rewards (coupons)
- 👨‍💼 **Admin Dashboard**: Manage users, games, cafes, and rewards

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | TailwindCSS |
| **Backend** | Node.js + Express.js |
| **Database** | PostgreSQL (Neon serverless) |
| **Auth** | bcrypt + Google OAuth + reCAPTCHA v2 |
| **Hosting** | Frontend: cPanel (cafeduotr.com), Backend: Render.com |
| **Email** | Nodemailer (Gmail SMTP) |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│  React + TypeScript + Vite                                      │
│  ├── components/          # UI Components                       │
│  ├── lib/api.ts           # API Client                          │
│  └── types.ts             # TypeScript Types                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (fetch)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                         │
│  backend/server.js                                              │
│  ├── /api/auth/*          # Authentication endpoints            │
│  ├── /api/games/*         # Game CRUD & moves                   │
│  ├── /api/users/*         # User management                     │
│  ├── /api/cafes/*         # Cafe & check-in                     │
│  ├── /api/rewards/*       # Shop items                          │
│  ├── /api/admin/*         # Admin operations                    │
│  └── /api/leaderboard     # Rankings                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ pg (node-postgres)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                        │
│  Hosted on: Neon (neon.tech)                                    │
│  ├── users                # User accounts                       │
│  ├── games                # Game sessions                       │
│  ├── cafes                # Cafe locations                      │
│  ├── rewards              # Shop items                          │
│  ├── user_items           # Purchased coupons                   │
│  ├── achievements         # Achievement definitions             │
│  └── user_achievements    # Unlocked achievements               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
cafeduo-main/
├── backend/
│   ├── server.js           # Express server (ALL API routes here)
│   └── db.js               # PostgreSQL connection pool
├── components/
│   ├── AuthModal.tsx       # Login/Register modal
│   ├── Dashboard.tsx       # Main user dashboard (game lobby, rewards)
│   ├── AdminDashboard.tsx  # Admin panel
│   ├── CafeDashboard.tsx   # Cafe admin panel
│   ├── CafeSelection.tsx   # GPS check-in screen
│   ├── GameRoom.tsx        # Rock-Paper-Scissors game
│   ├── GladiatorGame.tsx   # Turn-based arena game
│   ├── MatchingGame.tsx    # Memory matching game
│   ├── GameLobby.tsx       # Game list & join UI
│   ├── CreateGameModal.tsx # Create new game modal
│   ├── Leaderboard.tsx     # Rankings display
│   ├── Achievements.tsx    # User achievements
│   ├── Hero.tsx            # Landing page hero section
│   └── ...                 # Other UI components
├── lib/
│   └── api.ts              # Frontend API client (all fetch calls)
├── types.ts                # TypeScript interfaces
├── constants.ts            # Static data (university departments)
├── App.tsx                 # Main router & state management
├── index.tsx               # React entry point
├── index.css               # TailwindCSS imports
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── package.json            # Dependencies
└── .env                    # Environment variables (NOT in git)
```

---

## 5. Database Schema

### users
```sql
id SERIAL PRIMARY KEY
username VARCHAR(255)
email VARCHAR(255) UNIQUE
password_hash VARCHAR(255)
points INTEGER DEFAULT 0
wins INTEGER DEFAULT 0
games_played INTEGER DEFAULT 0
department VARCHAR(255)
is_admin BOOLEAN DEFAULT FALSE
role VARCHAR(50)               -- 'user', 'cafe_admin', 'admin'
cafe_id INTEGER                -- Current checked-in cafe
table_number VARCHAR(20)       -- e.g., 'MASA05'
avatar_url TEXT
last_daily_bonus TIMESTAMP
created_at TIMESTAMP
```

### games
```sql
id SERIAL PRIMARY KEY
host_name VARCHAR(255)
guest_name VARCHAR(255)
game_type VARCHAR(100)         -- 'Taş Kağıt Makas', 'Arena Düellosu', etc.
points INTEGER
table_code VARCHAR(20)
status VARCHAR(50)             -- 'waiting', 'active', 'finished'
winner VARCHAR(255)
player1_move VARCHAR(50)       -- For RPS
player2_move VARCHAR(50)
game_state JSONB               -- For complex games (Gladiator)
created_at TIMESTAMP
```

### cafes
```sql
id SERIAL PRIMARY KEY
name VARCHAR(255) UNIQUE
latitude DECIMAL(10, 8)
longitude DECIMAL(11, 8)
table_count INTEGER DEFAULT 20
radius INTEGER DEFAULT 500     -- Check-in radius in meters
created_at TIMESTAMP
```

### rewards
```sql
id SERIAL PRIMARY KEY
title VARCHAR(255)
cost INTEGER
description TEXT
icon VARCHAR(50)               -- 'coffee', 'discount', 'dessert', 'game'
is_active BOOLEAN DEFAULT TRUE
cafe_id INTEGER                -- NULL = available everywhere
created_at TIMESTAMP
```

### user_items (purchased coupons)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)
item_id INTEGER
item_title VARCHAR(255)
code VARCHAR(50)               -- Unique coupon code
status VARCHAR(50)             -- 'active', 'used'
redeemed_at TIMESTAMP DEFAULT NOW()
```

### achievements
```sql
id SERIAL PRIMARY KEY
title VARCHAR(255)
description TEXT
icon VARCHAR(50)
points_reward INTEGER
condition_type VARCHAR(50)     -- 'games_played', 'wins', 'points'
condition_value INTEGER
```

---

## 6. API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Step 1: Send verification email |
| POST | `/api/auth/verify` | Step 2: Verify code & create user |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/google` | Google OAuth login |

### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List waiting games |
| GET | `/api/games/:id` | Get single game (for polling) |
| POST | `/api/games` | Create new game |
| POST | `/api/games/:id/join` | Join game as guest |
| POST | `/api/games/:id/move` | Submit move/game state |
| POST | `/api/games/:id/finish` | Mark game as finished |
| DELETE | `/api/games/:id` | Cancel/delete game |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/users/:id` | Update user stats |
| GET | `/api/users/:username/active-game` | Check for active game |

### Cafes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cafes` | List all cafes |
| POST | `/api/cafes/check-in` | GPS-verified check-in |

### Shop
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rewards` | List shop items |
| POST | `/api/shop/buy` | Purchase reward |
| GET | `/api/shop/inventory/:userId` | User's coupons |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/games` | All games |
| PUT | `/api/admin/users/:id/role` | Change user role |
| POST | `/api/admin/cafes` | Create cafe |
| PUT | `/api/admin/cafes/:id` | Update cafe |

---

## 7. Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Register   │────▶│ Send Email   │────▶│ Verify Code  │
│   (Form)     │     │ (6-digit)    │     │ Create User  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                           ┌─────────────────────┘
                           ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Login     │────▶│  reCAPTCHA   │────▶│  Dashboard   │
│  (Email/PW)  │     │  Verify      │     │  (Logged In) │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │  OR
       ▼
┌──────────────┐
│ Google OAuth │──────────────────────────────────▶
└──────────────┘
```

---

## 8. Game Logic

### Rock-Paper-Scissors (`GameRoom.tsx`)
1. Host creates game → waits in lobby
2. Guest joins → both see game UI
3. Each player selects move (rock/paper/scissors)
4. Polling every 2s checks opponent's move
5. When both moved → reveal & determine winner
6. Winner gets 10 points

### Gladiator Arena (`GladiatorGame.tsx`)
1. Turn-based combat with HP/Energy bars
2. Actions: Light Attack (-20 energy, 15 damage), Heavy Attack (-50 energy, 35 damage), Defend (+shield), Rest (+HP/Energy)
3. Game state synced via `game_state` JSONB column
4. First to reduce opponent to 0 HP wins (150 points for real opponent, 0 for bot)

### Shape Matching (`MatchingGame.tsx`)
1. Memory card matching game
2. Solo with timer, no multiplayer sync
3. Points based on completion time

---

## 9. Location Verification

```javascript
// Haversine Formula (server.js)
const R = 6371e3; // Earth radius in meters
const distance = R * c; // Distance between user and cafe

// Check-in allowed if:
// 1. Cafe has no coordinates set (skip check), OR
// 2. Distance < cafe.radius (default 500m)
```

---

## 10. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Google OAuth
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com

# reCAPTCHA
VITE_RECAPTCHA_SITE_KEY=6Lxxx
RECAPTCHA_SECRET_KEY=6Lxxx

# Email (Gmail SMTP)
GMAIL_USER=your@gmail.com
GMAIL_PASS=xxxx xxxx xxxx xxxx  # App Password

# Server
PORT=3001
```

---

## 11. Deployment

### Frontend (cPanel)
1. `npm run build` locally
2. Upload `dist/` contents to `public_html/`

### Backend (Render.com)
- Auto-deploys from GitHub on push
- Build: `cd backend && npm install`
- Start: `cd backend && node server.js`
- Health check: `GET /` returns "CafeDuo API Sunucusu Aktif"

---

## 12. Known Issues & Solutions

| Issue | Root Cause | Solution |
|-------|------------|----------|
| "Failed to fetch" on login | reCAPTCHA network failure | Made verification "fail open" |
| Game auto-starts with bot | Wrong `waitingForOpponent` logic | Fixed conditional check |
| Location always fails | Cafe has null coordinates | Skip distance check if no coords |
| Turn order mixed up | Polling overwrites local state during animation | Block sync while `animating=true` |

---

## 13. Security Measures

- ✅ Helmet.js (HTTP headers)
- ✅ Rate limiting (100 req/15min per IP)
- ✅ bcrypt password hashing (10 rounds)
- ✅ reCAPTCHA v2 on auth forms
- ✅ CORS restricted to allowed origins
- ✅ SQL injection prevention (parameterized queries)
- ⚠️ No JWT tokens (session-less, stateless auth)

---

## 14. Maintenance Commands

```bash
# Development
npm run dev              # Start Vite dev server (port 5173)
cd backend && node server.js  # Start backend (port 3001)

# Production Build
npm run build            # Create dist/ folder

# Database Reset (Danger!)
# Connect to Neon and run fresh schema
```

---

## 15. Future Improvements

- [ ] WebSocket implementation (replace polling)
- [ ] JWT-based authentication
- [ ] Push notifications
- [ ] Real-time chat between players
- [ ] Tournament system
- [ ] Mobile app (React Native)

---

*Last Updated: December 2024*
*Maintainer: AI-Assisted Development*
