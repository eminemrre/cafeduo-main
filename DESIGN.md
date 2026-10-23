---
version: alpha
name: CafeDuo — Masa Oyuncakları
description: A café table turned into a toy set. The page is the stationery of the café table — table tent, order slip, colour sheets, the menu — with real 3D toys (cup, knight, question card, target, ship, coin) as its objects.
colors:
  primary: '#FF5C8A'
  on-primary: '#17140F'
  ink: '#17140F'
  ink-soft: '#4A4540'
  paper: '#FFFFFF'
  ice: '#EEF6F8'
  ice-deep: '#D9EAEF'
  lokum: '#FF5C8A'
  limon: '#FFD23F'
  gok: '#1FB3FF'
  fistik: '#B6D31B'
  deniz: '#2EC4B6'
  gok-deep: '#1597D9'
  fistik-face: '#C8E23A'
  coffee: '#5A3424'
  board-light: '#F2F9FB'
  board-dark: '#7FC9EE'
  success: '#177A41'
  danger: '#D62F2F'
  ink-raised: '#2A251C'
  lokum-text: '#C4265F'
  gok-text: '#0B6AA8'
  limon-text: '#8A6608'
  fistik-text: '#5F7A0C'
  deniz-text: '#0B7A70'
  danger-text: '#B8241A'
  danger-wash: '#FCE8E8'
typography:
  display-xl:
    fontFamily: Baloo 2
    fontSize: 4.5rem
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: -0.01em
  display-xl-mobile:
    fontFamily: Baloo 2
    fontSize: 2.5rem
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Baloo 2
    fontSize: 4.25rem
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: -0.01em
  display-lg-mobile:
    fontFamily: Baloo 2
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: -0.01em
  masthead:
    fontFamily: Baloo 2
    fontSize: 15rem
    fontWeight: 800
    lineHeight: 0.76
    letterSpacing: -0.035em
  wordmark:
    fontFamily: Baloo 2
    fontSize: 1.75rem
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.02em
  title:
    fontFamily: Baloo 2
    fontSize: 2.5rem
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: -0.01em
  title-mobile:
    fontFamily: Baloo 2
    fontSize: 2rem
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: -0.01em
  heading:
    fontFamily: Baloo 2
    fontSize: 1.75rem
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.01em
  statement:
    fontFamily: Onest
    fontSize: 2.25rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0em
  lead:
    fontFamily: Onest
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body:
    fontFamily: Onest
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  label:
    fontFamily: Onest
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0em
  small:
    fontFamily: Onest
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  meta:
    fontFamily: Onest
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  button:
    fontFamily: Onest
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0em
  score:
    fontFamily: Onest
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
  stat:
    fontFamily: Onest
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
rounded:
  none: 0px
  notch: 34px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 80px
  3xl: 128px
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    height: 48px
    padding: 0 20px
  button-primary-on-candy:
    backgroundColor: '{colors.lokum}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    height: 48px
    padding: 0 22px
  button-quiet:
    backgroundColor: none
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    height: 44px
  table-tent:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: 96px 48px 56px
    width: 560px
  slip-sheet:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: 36px 32px 52px
  colour-sheet:
    backgroundColor: '{colors.gok}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
  menu-bar:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
    height: 56px
    padding: 0 18px
  action-cell:
    backgroundColor: '{colors.lokum}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    height: 72px
  cell-quiet-on-ink:
    backgroundColor: '{colors.ink-raised}'
    textColor: '{colors.paper}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    height: 72px
  input:
    backgroundColor: '{colors.ice}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
    height: 52px
    padding: 0 14px
  panel-surface:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
    padding: 20px
  panel-ground:
    backgroundColor: '{colors.ice}'
    textColor: '{colors.ink}'
  panel-well:
    backgroundColor: '{colors.ice-deep}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.none}'
    padding: 12px
  chip-satranc:
    backgroundColor: '{colors.gok}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    padding: 6px 12px
  chip-bilgi:
    backgroundColor: '{colors.limon}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    padding: 6px 12px
  chip-nisanci:
    backgroundColor: '{colors.lokum}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    padding: 6px 12px
  chip-odul:
    backgroundColor: '{colors.fistik}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.none}'
    padding: 6px 12px
  board-square-light:
    backgroundColor: '{colors.board-light}'
    textColor: '{colors.ink}'
  board-square-dark:
    backgroundColor: '{colors.board-dark}'
    textColor: '{colors.ink}'
  toy-knight-base:
    backgroundColor: '{colors.gok-deep}'
  toy-coin-face:
    backgroundColor: '{colors.fistik-face}'
    textColor: '{colors.ink}'
  toy-cup-coffee:
    backgroundColor: '{colors.coffee}'
  status-success:
    backgroundColor: '{colors.success}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
  status-danger:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
  status-danger-wash:
    backgroundColor: '{colors.danger-wash}'
    textColor: '{colors.danger-text}'
    typography: '{typography.body}'
    rounded: '{rounded.none}'
  text-link:
    textColor: '{colors.gok-text}'
    typography: '{typography.label}'
  text-emphasis:
    textColor: '{colors.lokum-text}'
  text-caution:
    textColor: '{colors.limon-text}'
    typography: '{typography.meta}'
  text-points:
    textColor: '{colors.fistik-text}'
    typography: '{typography.label}'
  text-loss:
    textColor: '{colors.danger-text}'
    typography: '{typography.label}'
---

## Overview

**Masa Oyuncakları (table toys).** CafeDuo turns the café table into a toy set: the cup, the chess
knight, the question card, the target, the battleship, the coin and the table tent with its code (`MASA07`) are
real 3D objects in soft, matte, vinyl-toy candy colours. The visitor plays with them before reading
about them; the opponent is the next table and the prize is that café's reward (see PRODUCT.md).

**The direction (v2, 2026-10-19): the page is the object.** The landing does not illustrate the
product — it _is_ the stationery of the café table. The first screen is the table tent (a 5:7
card, scalloped at the top corners, cropped by the fold, with a real QR to cafeduotr.com). Below
it, in order: the order slip (how it works, with dotted leaders and one inverted result bar), three
sticky colour sheets (one per game, stacking at −72 px steps while the headings stay in the visible
band), the live table (a square ice plate with the real 3D toy set and three text tabs), the menu
(the reward catalogue as a fillable price list under a container-sized "MENÜ" masthead), and a
sentence with a blank (the sign-up: the visitor's e-mail is the fill-in). The footer is the back of
the box: the wordmark built out of seven coloured rectangles, bottom-aligned letters, a dotted tear
line above the closing row.

Sources: The Tie-break (play first, the reward is revealed by playing), Léo Parpeix (one tactile 3D
toy inside a quiet interface), Anidachi (each section one drenched candy colour, giant cropped
objects), Aardvark Book Club (fat rounded type, tilted sticker cards, objects that move on scroll),
Butter (the product as collectable objects). Analysis: `docs/design/references/README.md`.
Taste-skill draw for the landing: seed 1485260991, sector consumer-app, tone playful, "keep palette
and type", with illustration → `page-is-the-object`.

The world has two registers, chosen by the surface's mode:

- **Vitrin (Persuade):** the landing and `/kafeler`. Whole sections are drenched in one candy
  colour, toys are huge and cropped by the screen edge, display type runs up to 72 px. Loud.
- **Masa (Operate):** auth, check-in, the player panel, the games, the café panel and admin. Ice
  ground, white surfaces, candy colours only as the identity of a game or the one primary action,
  display type only for screen titles and scores. Calm, dense enough for a phone held in one hand.

The scene that decides light or dark: a student at a bright café table in the afternoon, phone in
one hand, cup in the other. Light grounds; colour does the talking.

## Colors

Strategy: **Drenched** on Vitrin surfaces (a section _is_ its colour), **Restrained** on Masa
surfaces (ice and white, one candy accent per game).

- **Ink (#17140F)** is the only text colour on every candy field and on ice and white. It passes AA
  on all four candies, so text never turns white on a candy field.
- **Lokum (#FF5C8A)**, Turkish-delight pink, is the brand colour and **Nişancı Düellosu**'s colour.
- **Limon (#FFD23F)** is **Bilgi Yarışı**.
- **Gök (#1FB3FF)** is **Retro Satranç**; the board's dark squares are a paler gök (#7FC9EE).
- **Fıstık (#B6D31B)**, pistachio, is **points and rewards** (coins, coupons, the wheel, the menu).
- **Deniz (#2EC4B6)** is **Amiral Battı**, approved 2026-10-21. Ink on deniz
  has 8.47:1 contrast; deniz-text (#0B7A70) is 5.21:1 on paper and 4.76:1 on ice.
  It appears on the game's lobby marker, selected game card, own-turn band,
  hits and selected placement ship. Misses are ink dots; hits are ink crosses;
  sunk cells are ink with deniz crosses, so colour is never the only signal.
- **Ice (#EEF6F8)** and **ice-deep (#D9EAEF)** are the Masa ground and wells; **paper (#FFFFFF)**
  is the surface on top of them (the tent, the slip, the sheets' content, the menu bars).
- **Success (#177A41)** and **danger (#D62F2F)** are for states only, never decoration.
- **Candy as text** never runs at fill strength. Where a hue must colour text (a link, an
  emphasised word, a state word), it runs at its text depth, all AA on paper and ice:
  lokum-text #C4265F, gok-text #0B6AA8, limon-text #8A6608, fistik-text #5F7A0C,
  danger-text #B8241A. **Ink-raised (#2A251C)** is the quiet cell on ink.

A game keeps its colour on every surface: its chip, its lobby row marker, its 3D toy and its
sheet on the landing. No other colour is introduced for a game. The landing's running order is
limon (tent) → ice (slip) → gök / limon / lokum (sheets) → ink (live table) → fıstık (menu) →
paper (the sentence) → ink (footer).

## Typography

- **Baloo 2** (OFL, latin-ext, weight 800) is the display face: fat, rounded, toy-like. Headlines,
  the wordmark, sheet and panel titles, the giant "MENÜ" masthead, the footer mark. Never below
  28 px, never for running text, never italic.
- **Onest** (OFL, latin-ext, 400–700) is everything else: body, labels, buttons, inputs, tables and
  scores (`score`, weight 700, tabular figures).
- The former pair is retired and must not come back: **Bagel Fat One has no ğ, ş or İ glyphs at
  all**, and **Golos Text renders ğ as a plain g** — the visible production bug of v1.
- Both faces are self-hosted through `@fontsource`; every face must render
  `ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü`. Verify with `python3 /tmp/glyphcheck.py <woff2>` before adding a face.
- Vitrin uses seven steps: display-xl / display-lg / title / statement / lead / body / label, plus
  the wordmark and the container-sized masthead. Masa screens add the dense steps a panel needs:
  title-mobile (32 px) and heading (28 px, a panel section's name) in Baloo 2; small (14 px),
  meta (13 px, dates, codes, secondary lines) and stat (24 px tabular numbers) in Onest. The masthead (`.cdl-menu-masthead`) is `37.5cqw`
  because "MENÜ" measures 2.65em in Baloo 2 800.
- Sentence case everywhere. No letter-spaced uppercase labels. Nothing readable below 12 px;
  12–13 px only for secondary metadata. A statement (the closing sentence) stays at or below 36 px
  and never runs past four lines on a phone.

## Layout

- Phone first. Margins 20 px on phones, 28 px from 640 px, 40 px from 1100 px; the menu column is
  620 px and the sentence column 940 px, both centred. Vitrin fields and toys run edge to edge.
- Spacing scale 4 / 8 / 16 / 24 / 40 / 80 / 128. Sections on Vitrin are separated by a colour
  change, not by gaps or lines; inside a section, more space above a heading than below it.
- Masa screens: one column on phones, a 12-column grid from 900 px; the primary action sits in
  the lower half of a phone screen, within thumb reach.
- "Kaydol" (signed in: "Panele geç") and "Giriş yap" are always reachable on Vitrin (sticky
  header). There is exactly one sign-up button per screen area, never a duplicate pair.
- The sticky sheets slot their headings into the top band: sheet _i_ sticks at `88px + i·72px`
  (phones `56px + i·52px`), so 72 px of every sheet stays visible while it is covered.
- The landing ends with ink: the wordmark built from coloured blocks, four columns, the contact and
  a dotted tear line above the closing row.

## Elevation & Depth

Depth comes from the 3D toys, not from UI shadows. Toys carry their own soft studio light and one
soft contact shadow on the field below them. UI is flat: cards, sheets, bars and buttons have no
shadow at rest. Only things that float above the page (dialogs, menus, the toast, the cookie
notice) get one soft shadow (`0 16px 34px rgba(23,20,15,0.22)`).

## Shapes

- **Square (0 px) everywhere.** Buttons, inputs, cards, panels, chips, sheets and images are
  rectangles with real edges. No pills, no rounded corners, no outlined boxes, no gradients.
- **The only two curved things** are the tent's scalloped corner notches (`notch`, 34 px circles of
  the field colour cut into the tent's top corners) and the circles that are objects (the coin, the
  ball, the clock face).
- **Perforation is the system's decoration:** a torn zigzag bottom edge (`clip-path`) on the slip,
  4 px dotted leaders inside the slip and the menu, a 4 px dotted tear line above the footer's
  closing row. Nothing else draws a line.
- Type is staggered on purpose: the tent's title lines are offset ±7 %, the tent's foot sits at the
  card's bottom, the menu masthead fills its column edge to edge.
- Borders: 3 px ink underline on inputs, 3 px ink focus rings, 3 px underline on tab buttons.

## Components

- **Buttons:** `button-primary` (ink rectangle, paper text) on candy fields; `button-primary-on-candy`
  (lokum rectangle, ink text) on paper and ink; `button-quiet` (no box, underlined on hover) for
  the second action. One primary per screen area. Press: scale 0.98; hover: lift 2 px. 48 px tall
  (44 px small), 16–22 px padding, 0 radius.
- **Table tent:** the hero's object. Paper, 5:7, 560 px wide, scalloped top corners, everything
  centred; title at the top, the offer and the two real facts below, the QR at the bottom edge.
- **Slip:** paper with a torn bottom edge; group labels in Onest 600 15 px, rows as
  `what ··· value` with 4 px dotted leaders and tabular values; the closing row inverted (ink
  band, paper text).
- **Colour sheets:** one game each (gök, limon, lokum), full width, 84 svh, sticky; the game's
  name in the top-left band, the paragraph bottom-left, the toy bottom-right and clipped by the
  sheet's edge.
- **Live table:** a square ice plate holding the real ToyStage (the same toys as the hero of v1),
  with the play control at its top-left and the status line under it; three underline tabs plus a
  title and paragraph to the left; two 72 px action cells under it.
- **Menu bar:** a paper bar with a 56 px summary row (label left, a plus that becomes a minus right)
  and, when open, item rows with 4 px dotted separators and tabular prices.
- **Action cell:** a flat 72 px rectangle, one per action; the primary is lokum, the quiet one is
  `#2A251C` on ink.
- **Input:** ice fill, ink text, 3 px ink underline, 0 radius, 52 px tall, label above or inline
  (never only a placeholder). On the landing the input _is_ the blank of the closing sentence.
- **Panel surface:** paper on ice, 0 radius, 20 px padding, no shadow, no border.
- **Game chips:** the game's colour, ink text, square. The same chip appears in lobby rows, history
  and on the landing.
- **Chess board:** light squares `board-light`, dark squares `board-dark`, last move tinted limon,
  selection ring lokum, coordinates 11 px inside the squares (decorative; the board has screen-reader
  labels).
- **Battleship seas:** square 8×8 cells with 3 px water gaps and A–H / 1–8
  coordinates; the main sea fills the phone column, the own sea is a compact
  always-visible grid. Desktop uses two columns. Ships are top-down toy
  silhouettes spanning their cells (`components/battleship/ShipShape.tsx`): an
  ink hull with a pointed bow and white deck works — Zırhlı 4 (three turrets),
  Muhrip 3, Denizaltı 3 (cigar hull), Hücumbot 2. In battle they sit under the
  cells so hit and miss marks stay on top; sunk enemy ships appear the same way.
  Placement: drag a ship from the tray or on the sea (the held part stays under
  the finger; the landing cells show a deniz frame, red when blocked), tap a
  ship to pick it (deniz hull) and tap again or use its turn handle to rotate.
  The fleet is confirmed explicitly. A shot is tap to aim, tap again to fire.
  Ranked clocks/scores/hits are server snapshots; practice is labelled
  Antrenman and never pays points.
- **Coin and coupon:** points are shown as a fıstık coin with the number in `score`; a coupon is a
  paper ticket with a QR code and a fıstık edge.
- **Footer mark:** the wordmark built from seven coloured rectangles of different heights with the
  letters bottom-aligned inside them, on ink.

## Motion

- Toys move like toys: springy (overshoot, ~500 ms), a small squash on landing, an idle sway of a
  few degrees. One orchestrated entrance per screen, not scattered fades.
- The landing's entrance is authored: the tent's card rises, its title lines land, the toys stand
  still until touched. `[data-landing-reveal]` elements rise 28 px as they enter (700 ms), the
  diamond drops, the sheets stick and stack.
- Playing is the reward: a move, a correct answer or a hit makes the toy react (bounce, spin, coin
  pop). Scroll may turn and move toys on Vitrin, never hide text behind them.
- There is no motion toggle on any page. The public pages follow the system preference and
  pause themselves while the tab is hidden; `data-motion` on `.cdl-page` records the state.
- Transform and opacity only. `prefers-reduced-motion`: toys stand still, states change instantly,
  no `cdl-` animation runs.

## 3D Toys

Toy materials add three tones that never appear in the UI: `gok-deep` (the knight's base),
`fistik-face` (the coin's face) and `coffee` (the cup's contents).

The toy set is rendered with Three.js (already a dependency): matte vinyl material, rounded bevels,
candy colours from this file, one key light and one fill. Cap 30 fps and 1.5 DPR, load only when
visible, pause when hidden. Every toy has a static WebP fallback of the same pose, used without
WebGL, with reduced motion and before the scene loads; content and actions never depend on the
canvas. Canvas labels are drawn in Baloo 2, so re-render the fallbacks (`/tmp/cdl-scripts/render-toys.mjs`)
when the display face or its weight changes.

| Toy                    | Colour          | Meaning                    |
| ---------------------- | --------------- | -------------------------- |
| Chess knight           | gök             | Retro Satranç              |
| Question card / buzzer | limon           | Bilgi Yarışı               |
| Target with a dart     | lokum           | Nişancı Düellosu           |
| Coin "CD"              | fıstık          | Points                     |
| Cup                    | lokum and paper | The café, the coffee break |
| Table tent `MASA07`    | paper and ink   | The opponent is a table    |

## Do's and Don'ts

Do:

- Let the visitor touch a toy or play a move in the first viewport.
- Give each game its one colour everywhere.
- Keep text ink on candy, and keep Masa screens calm.
- Use only real rules and numbers (PRODUCT.md): 100 starting points, stakes, the reward catalogue.
- Keep square edges; let a torn, dotted or scalloped edge be the only decoration.

Don't:

- No cream or beige grounds, no italic serif headlines, no gradient text, no neon on near-black,
  no glassmorphism, no side-stripe cards, no hairline dividers, no tracked uppercase micro-labels.
- No pills, no outlined cards, no 32 px radius, no shadows in the flow.
- No motion toggle or other control without a real function.
- No icon-on-top feature card grids, no fake stats, players, testimonials or café names.
- No white text on candy fields; no candy fields behind long running text on Masa screens.
- No emoji as icons; no stock 3D blobs. Every object is one of the toys above.
- Never block "Kaydol" or "Giriş yap" with the game.
- Never set the display face below 28 px, and never set the wordmark in anything but Baloo 2 800.
