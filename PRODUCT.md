# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players (primary):** university students sitting in a partner café, on their phone, during a coffee break. They want a short two-player game with someone at another table and something real (a café reward) for winning. Most arrive on a phone; many arrive from a table QR code.
- **Café owners and staff (`cafe_admin`):** run the café's CafeDuo account: tables and location radius, rewards, tournaments, and scanning players' QR coupons at the counter. They evaluate CafeDuo first on the public `/kafeler` page.
- **Platform admins (`admin`):** manage cafés, users and café-admin assignments.

## Product Purpose

CafeDuo is a game club inside partner cafés. Two people in the same café are matched for a short game; points won become that café's rewards. Success: a player sits down, checks in, plays a game and comes back for the reward; a café sees more time and repeat visits from students.

## Positioning

The opponent is another table in the same café, not an online stranger. Check-in only works inside the café (location radius, 150 m by default, or the table's verification code), and the points are spent on that café's own rewards. A chess site has the game but no café; a café loyalty app has points but no opponent at the next table.

## Operating Context

- Check-in by location or table code; table codes normalise to `MASA##` (`5` → `MASA05`).
- Lobby of open games in the same café; Socket.IO keeps it live.
- Three games: **Retro Satranç** (real-time, server-validated moves, 3+2 / 5+0 tempos), **Bilgi Yarışı** (10 short questions, fastest correct answer), **Nişancı Düellosu** (lock the crosshair on centre, 5 rounds).
- Stakes: the player chooses a stake; the winner gets `min(stake, loser's points)`.
- Every new member starts with 100 points. A daily reward wheel pays 15, 50 or 250 points or, rarely, a free coffee.
- Rewards belong to a café (default catalogue: Oyun Jetonu x5 100, Cheesecake İkramı 400, Bedava Filtre Kahve 500 points); redeeming creates a QR coupon that staff scan.
- Tournaments run by the café; leaderboards filterable by university department.

## Capabilities and Constraints

- Stack is fixed: React + Vite + TypeScript frontend, Node/Express backend, PostgreSQL, Redis, Socket.IO, Tailwind present. Routes, the auth modal and `lazyWithRetry` loading stay.
- Scope of the redesign: every surface (landing, auth, check-in, player panel, the three games, `/kafeler`, café panel, admin), replacing the current look.
- City-neutral: the product and its design must not be tied to one city or university. The department list is currently Pamukkale University's (`constants.ts`); generalising it is an open product decision, not a design one.
- Turkish UI and content. PWA with auto-update.
- WebGL may enhance but never carry essential content: every action and text works without it, with reduced motion and with a keyboard.

## Brand Commitments

- Name: **CafeDuo**. The existing logo is not binding; a new mark may be designed.
- Voice: informal Turkish second person ("sen"), short and direct. Primary player action is "Masaya katıl"; "Giriş yap" stays reachable.
- `/kafeler` content is fixed by the business: Pro plan ₺800/ay, yearly ₺6.400; first month free for the first two pilot cafés in exchange for a 20-minute feedback session and permission to use the café's name; contact by WhatsApp and e-mail. Design work does not change these terms.

## Evidence on Hand

- Real: the three games, the rules and numbers above, the reward catalogue defaults, `/kafeler` pricing and pilot terms.
- Absent, never to be fabricated: partner café names or photos, player counts, testimonials, ratings, press, statistics of any kind.
- No product photography exists. Open-licence pictures must be credited and never presented as a partner café.

## Product Principles

1. The game is the way in: show a real game before explaining it.
2. The café is the arena: the opponent and the reward are both in the room.
3. Short sessions: a game fits into one coffee.
4. Honest rewards: only real rules and real catalogue items; no invented numbers.
5. Joining is always one tap away.

## Accessibility & Inclusion

Phones first (320 px upward, landscape included), touch targets of at least 44 px, visible keyboard focus, reduced-motion respected, WCAG AA contrast, screen-reader text for game boards.
