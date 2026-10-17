# Landing redesign brief

Input for the landing prototype (plan step 4). Built with the taste-skill method on the
reference in `reference-tiebreak.md`. The direction sheet dealt by taste-skill is in
`landing-direction-sheet.md` (direction `product-performs`, seed 2137974193).

## Decisions already made

- Reference: The Tie-break. The activity is the way in, and the reward reveals the real world.
- Imagery: open-licence pictures plus drawing in code. A modern, current café feel, not a
  traditional kahvehane. The city is İzmir, all its districts, not Denizli.
- Direction: "The product performs". The hero is a working fragment of a CafeDuo game, not a
  description of one.
- PR #38 (3D scroll story) stays open; the two landings are compared side by side.

## Inventory: what only CafeDuo has

Checked against the code on 2026-10-17.

1. Two strangers in the **same café** are matched; check-in only works within the café's radius
   (150 m by default, `cafeController`).
2. Tables have codes: `MASA05`, `MASA12` (`hooks/useGames.ts`). The opponent is a table, not
   an avatar.
3. Three real games (`shared/gameRegistry.js`): **Retro Satranç** (real-time, validated moves),
   **Bilgi Yarışı** (short questions, fastest correct answer) and **Nişancı Düellosu** (lock the
   crosshair on centre, round by round).
4. Every new member starts with **100 points** (`authController.register`).
5. The winner takes `min(stake, loser's points)`: you cannot win more than your rival has.
6. A **daily reward wheel** (`DailyRewardWheel`).
7. Points become **that café's rewards**; the café staff scan a **QR coupon** to redeem
   (`CouponScanner`, `QrScannerModal`).
8. **Tournaments** run by the café and a **leaderboard** filterable by university department.
9. The city: İzmir districts as places where the next table sits (Alsancak, Kordon, Karşıyaka,
   Bostanlı, Bornova, Buca, Göztepe, Urla). Open-licence pictures exist for several of them.
10. The time it takes: a game fits into the time a coffee stays warm (current copy:
    "Kahven soğumadan bir açılış yap").

## The argument (one claim per section)

| Section | Claim | Proof on the page |
| --- | --- | --- |
| Hero | You can play right now, against a table in this café. | A working board: make a move, the "MASA07" opponent answers. |
| How it works | Check in, sit down, play, get paid in café rewards. | One pinned fragment changing state: check-in, matched with MASA07, points, QR coupon. |
| Showcase (games) | Three games, each finished in one coffee. | Real fragments of Satranç, Bilgi Yarışı and Nişancı Düellosu at true size. |
| List (districts) | There is a table waiting across İzmir. | District rows with a real picture each; sample content until the real partner list exists. |
| CTA | Join the club. | "Masaya katıl" with sign-up, "Giriş yap" beside it. |

## The idea

> On this page, **the café table and its code (MASA07)** becomes **the opponent in a working
> game fragment**; each move you make brings an İzmir district into focus as the place where
> that table sits.

**Competitor test:** a chess site has a board but no café table. A café loyalty app has points
but no opponent at the next table. The sentence only works for CafeDuo.

**The live thing:** one real move on the hero board against a café table. The answer brings a
district picture from blur into focus, as in the reference. It must work by touch and by
keyboard, and without WebGL. With reduced motion the picture is simply sharp.

## Constraints for the build

- "Masaya katıl" and "Giriş yap" stay reachable at all times; the game never blocks them.
- Phones first: thumb-sized controls; the phone layout is its own composition.
- Accessible: keyboard, visible focus, reduced motion, screen-reader text for the board.
- Keep the routes, the auth modal and the existing lazy loading (`lazyWithRetry`) as they are.
- Found pictures are credited on the page and never shown as a partner café. No invented
  customers, quotes or statistics.
- Gate: taste-skill `lint.mjs` and `inspect.mjs` with 0 FAIL, three look-and-fix rounds,
  `npm run quality`, `npm test`, `npm run build`, landing e2e smoke.
