---
version: 1
slug: "components-landing-clublanding-tsx"
primary_target: "components/landing/ClubLanding.tsx"
related_targets: ["styles/landing.css", "components/landing/landingContent.ts", "App.tsx"]
---

# Surface brief: public landing (/)

Mode: Persuade. Audience: students in a partner café, on a phone, often from a table QR code.
Action: "Kaydol" (register; signed in "Panele geç"); "Giriş yap" always reachable. Proof: the real
games, rules and reward catalogue in PRODUCT.md; no invented numbers, cafés or people. Constraints:
DESIGN.md "Masa Oyuncakları" (Vitrin register) is binding; works without WebGL, with reduced motion
and keyboard; routes, auth modal and lazyWithRetry unchanged.

## Direction contract

THESIS: **the page is the object.** The landing is not an illustration of the product; it is the
stationery of the café table — the table tent, the order slip, colour sheets, the live table, the
menu, a sentence with a blank. It refuses the category default of a headline over three feature
cards and a phone mockup, and it refuses a page that only describes toys it never shows.

OWN-WORLD: Drenched candy fields in running order limon → ice → gök/limon/lokum → ink → fıstık →
paper → ink; ink text on every field; **Baloo 2 800** display over **Onest** body (the v1 pair
Bagel Fat One / Golos Text is retired: Bagel Fat One has no ğ, ş or İ at all); square every edge,
perforation (zigzag, dotted leaders, dotted tear line) as the only decoration; scallop notches on
the tent; matte vinyl 3D toys (gök knight, limon question card, lokum target, fıstık coin, lokum
cup, paper MASA07 tent) with one soft contact shadow; no UI shadows in the flow.

STORY: The visitor lands on the table tent (a real QR to cafeduotr.com), reads the slip to learn
the rules in numbers, scrolls the three game sheets stacking under the header, plays the knight a
move on the live table, prices a reward in the menu, and types an e-mail into the blank of the
closing sentence — the modal opens with the address already typed.

FIRST VIEWPORT: Limon field, solver open. A white 5:7 tent card, scalloped at the top corners,
cropped by the fold: "Rakibin yan masada." (72 px desktop, 40 px phone, two staggered lines), one
sentence of offer, "İlk 100 puan hediye ◆ Her gün çark", the QR at the card's bottom edge. A still
pink cup is cropped by the fold at the bottom-left corner of the field. Below the card, three
plain links to the page's sections. Sticky white header with "Giriş yap" and the single ink
"Kaydol"; no motion control.

FORM: taste-skill draw, seed 1485260991, sector consumer-app, tone playful, `--keep palette,type`,
have illustration → dealt card **`page-is-the-object`** (chosen, not blended). Section blueprint
adopted from the same deal: slip → sticky colour sheets (−72 px steps) → the live table → menu →
sentence-with-a-blank → back of the box.

FINISH: unreviewed and undocumented is unfinished. Gate state 2026-10-19 (v2, `design/system-v2`):
`impeccable detect` 0 findings at 1440×900 and 390×844; `taste-skill inspect` 0 FAIL, 2 defended
WARN (type-size count; no video — the live 3D scene plays the role footage would);
`design.md lint` 0 errors / 0 warnings; `npm run quality`, 1467 unit tests, `npm run build` and the
landing e2e suite green. Every shipping raster (the six toy WebPs) is a render of the same scene as
the canvas, re-rendered when the display face changes.
