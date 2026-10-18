---
version: alpha
name: CafeDuo — Masa Oyuncakları
description: A café table turned into a toy set. Candy-coloured fields, fat rounded type and real 3D toys (cup, knight, question card, target, coin) that the visitor can play with.
colors:
  primary: "#FF5C8A"
  on-primary: "#17140F"
  ink: "#17140F"
  ink-soft: "#4A4540"
  paper: "#FFFFFF"
  ice: "#EEF6F8"
  ice-deep: "#D9EAEF"
  lokum: "#FF5C8A"
  limon: "#FFD23F"
  gok: "#1FB3FF"
  fistik: "#B6D31B"
  board-light: "#F2F9FB"
  board-dark: "#7FC9EE"
  success: "#177A41"
  danger: "#D62F2F"
typography:
  display-xl:
    fontFamily: Bagel Fat One
    fontSize: 7.5rem
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Bagel Fat One
    fontSize: 4.5rem
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: -0.01em
  heading:
    fontFamily: Bagel Fat One
    fontSize: 2.25rem
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: 0em
  title:
    fontFamily: Golos Text
    fontSize: 1.375rem
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  body:
    fontFamily: Golos Text
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label:
    fontFamily: Golos Text
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0em
  score:
    fontFamily: Golos Text
    fontSize: 2.5rem
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
rounded:
  sm: 10px
  md: 20px
  lg: 32px
  pill: 999px
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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: 52px
    padding: 0 28px
  button-primary-on-ice:
    backgroundColor: "{colors.lokum}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: 52px
    padding: 0 28px
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: 44px
    padding: 0 20px
  chip-satranc:
    backgroundColor: "{colors.gok}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  chip-bilgi:
    backgroundColor: "{colors.limon}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  chip-nisanci:
    backgroundColor: "{colors.lokum}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  chip-odul:
    backgroundColor: "{colors.fistik}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  sticker-card:
    backgroundColor: "{colors.limon}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  panel-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 20px
  panel-ground:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.ink}"
  panel-well:
    backgroundColor: "{colors.ice-deep}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: 12px
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 52px
    padding: 0 16px
  board-square-light:
    backgroundColor: "{colors.board-light}"
    textColor: "{colors.ink}"
  board-square-dark:
    backgroundColor: "{colors.board-dark}"
    textColor: "{colors.ink}"
  status-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  status-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
---

## Overview

**Masa Oyuncakları (table toys).** CafeDuo turns the café table into a toy set: the cup, the chess
knight, the question card, the target, the coin and the table tent with its code (`MASA07`) are
real 3D objects in soft, matte, vinyl-toy candy colours. The visitor plays with them before reading
about them; the opponent is the next table and the prize is that café's reward (see PRODUCT.md).

Sources: The Tie-break (play first, the reward is revealed by playing), Léo Parpeix (one tactile 3D
toy inside a quiet interface), Anidachi (each section one drenched candy colour, giant cropped
objects), Aardvark Book Club (fat rounded type, tilted sticker cards, objects that move on scroll),
Butter (the product as collectable objects). Analysis: `docs/design/references/README.md`.

The world has two registers, chosen by the surface's mode:

- **Vitrin (Persuade):** the landing and `/kafeler`. Whole sections are drenched in one candy
  colour, toys are huge and cropped by the screen edge, display type runs up to 120 px. Loud.
- **Masa (Operate):** auth, check-in, the player panel, the games, the café panel and admin. Ice
  ground, white surfaces, candy colours only as the identity of a game or the one primary action,
  display type only for screen titles and scores. Calm, dense enough for a phone held in one hand.

The scene that decides light or dark: a student at a bright café table in the afternoon, phone in
one hand, cup in the other. Light grounds; colour does the talking.

## Colors

Strategy: **Drenched** on Vitrin surfaces (a section *is* its colour), **Restrained** on Masa
surfaces (ice and white, one candy accent per game).

- **Ink (#17140F)** is the only text colour on every candy field and on ice and white. It passes AA
  on all four candies, so text never turns white on a candy field.
- **Lokum (#FF5C8A)**, Turkish-delight pink, is the brand colour and **Nişancı Düellosu**'s colour.
- **Limon (#FFD23F)** is **Bilgi Yarışı**.
- **Gök (#1FB3FF)** is **Retro Satranç**; the board's dark squares are a paler gök (#7FC9EE).
- **Fıstık (#B6D31B)**, pistachio, is **points and rewards** (coins, coupons, the wheel).
- **Ice (#EEF6F8)** and **ice-deep (#D9EAEF)** are the Masa ground and wells; **paper (#FFFFFF)**
  is the surface on top of them.
- **Success (#177A41)** and **danger (#D62F2F)** are for states only, never decoration.

A game keeps its colour on every surface: its chip, its lobby row marker, its 3D toy and its
section on the landing. No other colour is introduced for a game.

## Typography

- **Bagel Fat One** (OFL, latin-ext) is the display face: fat, rounded, toy-like. Headlines, the
  wordmark, screen titles and big numerals on Vitrin. Never below 28 px, never for running text,
  never italic.
- **Golos Text** (OFL, latin-ext, 400–900) is everything else: body, labels, buttons, inputs,
  tables, and scores (`score`, weight 800, tabular figures).
- Both are self-hosted through `@fontsource`; every face must render `ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü`.
- Sentence case everywhere. No letter-spaced uppercase labels. Nothing readable below 12 px;
  12–13 px only for secondary metadata.
- Mobile sizes: `display-xl` 3.5 rem, `display-lg` 2.75 rem, `heading` 1.75 rem.

## Layout

- Phone first. Margins 20 px on phones, 40 px from 900 px, content up to 1280 px; Vitrin fields
  and toys run edge to edge.
- Spacing scale 4 / 8 / 16 / 24 / 40 / 80 / 128. Sections on Vitrin are separated by a colour
  change, not by gaps or lines; inside a section, more space above a heading than below it.
- Masa screens: one column on phones, a 12-column grid from 900 px; the primary action sits in
  the lower half of a phone screen, within thumb reach.
- "Masaya katıl" and "Giriş yap" are always reachable on Vitrin (sticky header).

## Elevation & Depth

Depth comes from the 3D toys, not from UI shadows. Toys carry their own soft studio light and one
soft contact shadow on the field below them. UI is flat: cards, chips and buttons have no shadow at
rest. Only things that float above the page (dialogs, menus, the toast) get one soft shadow
(`0 16px 40px rgba(23,20,15,0.18)`).

## Shapes

- **Pill** for every button, chip and tab.
- **lg (32 px)** for Vitrin fields that do not bleed and for sticker cards; **md (20 px)** for Masa
  surfaces; **sm (10 px)** for inputs, wells and board corners.
- **Sticker cards** (steps, game cards, rewards on Vitrin) may tilt between −4° and +4° and overlap
  a little, like stickers on a table. At most one row of them per screen; never on Masa surfaces.
- Borders: 2 px ink on inputs and focus rings only. No hairlines, no side stripes.

## Components

- **Buttons:** `button-primary` (ink pill, white text) on candy fields; `button-primary-on-ice`
  (lokum pill, ink text) on ice and white. One primary per screen. Press: scale 0.97; hover:
  lift 2 px. Minimum 44 px tall, 52 px for primary.
- **Game chips:** the game's colour, ink text, pill. The same chip appears in lobby rows, history
  and on the landing.
- **Sticker card:** a candy colour, ink text, 32 px radius, optional tilt (Vitrin only).
- **Panel surface:** white on ice, 20 px radius, 20 px padding, no shadow, no border.
- **Inputs:** white, 2 px ink border on focus, 10 px radius, 52 px tall, label above (never only a
  placeholder).
- **Chess board:** light squares `board-light`, dark squares `board-dark`, last move tinted limon,
  selection ring lokum, coordinates 11 px inside the squares (decorative; the board has screen-reader
  labels).
- **Coin and coupon:** points are shown as a fıstık coin with the number in `score`; a coupon is a
  white ticket with a QR code and a fıstık edge.
- **Logo:** a new wordmark "CafeDuo" in Bagel Fat One; the two o's may become a coin and a cup. To be
  drawn; the old cup-icon logo is retired.

## Motion

- Toys move like toys: springy (overshoot, ~500 ms), a small squash on landing, an idle sway of a
  few degrees. One orchestrated entrance per screen, not scattered fades.
- Playing is the reward: a move, a correct answer or a hit makes the toy react (bounce, spin, coin
  pop). Scroll may turn and move toys on Vitrin (GSAP-style), never hide text behind them.
- Transform and opacity only. `prefers-reduced-motion`: toys stand still, states change instantly.

## 3D Toys

The toy set is rendered with Three.js (already a dependency): matte vinyl material, rounded bevels,
candy colours from this file, one key light and one fill. Cap 30 fps and 1.5 DPR, load only when
visible, pause when hidden. Every toy has a static PNG/WebP fallback of the same pose, used without
WebGL, with reduced motion and before the scene loads; content and actions never depend on the
canvas.

| Toy | Colour | Meaning |
| --- | --- | --- |
| Chess knight | gök | Retro Satranç |
| Question card / buzzer | limon | Bilgi Yarışı |
| Target with a dart | lokum | Nişancı Düellosu |
| Coin "CD" | fıstık | Points |
| Cup | lokum and paper | The café, the coffee break |
| Table tent `MASA07` | paper and ink | The opponent is a table |

## Do's and Don'ts

Do:

- Let the visitor touch a toy or play a move in the first viewport.
- Give each game its one colour everywhere.
- Keep text ink on candy, and keep Masa screens calm.
- Use only real rules and numbers (PRODUCT.md): 100 starting points, stakes, the reward catalogue.

Don't:

- No cream or beige grounds, no italic serif headlines, no gradient text, no neon on near-black,
  no glassmorphism, no side-stripe cards, no hairline dividers, no tracked uppercase micro-labels.
- No icon-on-top feature card grids, no fake stats, players, testimonials or café names.
- No white text on candy fields; no candy fields behind long running text on Masa screens.
- No emoji as icons; no stock 3D blobs. Every object is one of the toys above.
- Never block "Masaya katıl" or "Giriş yap" with the game.
