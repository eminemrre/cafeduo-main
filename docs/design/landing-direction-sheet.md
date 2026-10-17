# DIRECTION SHEET — The product performs
seed 2137974193 · drawn 2026-10-17 · sector consumer-app
Brief: CafeDuo: a game club inside Izmir's modern cafés; two people at the same café are matched for chess, a quiz or a duel, and points become café rewards

| | |
| --- | --- |
| Direction | The product performs |
| Hero | Fragment on a shaped stage |
| Type | Albert Sans |
| Colour | Sheet and biro |
| Sections | how-it-works (Pinned fragment, changing state) → showcase (Lit panel, dark row) → list (Two-ended rows, narrow column) → cta (The action tile) → footer (A single quiet line) |
| Motion | Shutter image |
| Photographs | the "Architecture" set, as atmosphere |

This is the direction for this build. Adopt it. Do not blend it with the layout you would have made anyway,
and do not redraw because it is unfamiliar: unfamiliar is the point. Redraw a slot only when it conflicts
with a stated brand constraint or needs an asset that does not exist, and say why in your report.

The parts of this sheet were written separately and will disagree in small ways. Settle every disagreement in this order:
**house rules** (including type no smaller than 13px and body text of 16px or more) → **the direction** (the idea, the composition habits, where the
one accent goes) → **the type system and the palette** (which face does which job, the five size steps, which colour is the ground and where the
accent goes) → **the hero blueprint** → **the section blueprints**. Under each blueprint below, "Adjusted for this page" lists where it disagrees.
In practice: take geometry from blueprints (columns, proportions, what sits where) and take everything else from above them. Map every size a
blueprint names onto one of your five type steps instead of adding a sixth. Use one button shape, one corner radius and one pair of page margins on
the whole page, whatever individual blueprints say. If a blueprint names a kind of typeface (a light serif, a heavy grotesk), use the dealt face.

## 1. The idea
Software is most convincing when it is doing its job in front of you. Instead of describing features, put small, true, working fragments of the product on the page: the actual control, with real content, responding to the pointer. A colour picker's loupe reads the page's own background and prints its value. A list tool lets you tick an item right there. A type-scale plugin sets the page's own headings. Find the one interaction that is the product and make the hero that interaction; then show each further capability as another fragment at real size. No dashboard collage, no browser frame, no screenshots shrunk until unreadable.

Before anything else, write one sentence in your notes: "On this page, <the subject's own material> becomes <the device>."
Fill the first blank from your inventory of what only this client has (its name and what it means, its street, its numbers, its
constraint), then put the nearest competitor in the sentence: if it still works, the idea is the category's, not the client's.
Then name the one live thing the visitor can do on the page (SKILL.md step 4).

## 2. Composition
Hero: a short plain headline (4–6vw, left-aligned, upper-left third) and one sentence; the rest of the first screen is the main fragment at actual interface size, sitting directly on the page or on one flat stage colour, large enough to read every label. The fragment is built in HTML and works. Below, capabilities are a single-column sequence, each a row of two parts on a 5/7 split: a two-line statement on one side and the relevant fragment on the other, with the fragments varying in size and shape so the column never becomes a zigzag of equal blocks. Fragments are cropped pieces of interface (a menu, a row, a control, a panel edge), not whole windows. One section pins a fragment while three short statements change it.

## 3. Type — Albert Sans
A geometric grotesque with Scandinavian restraint: round letters, even colour, nothing decorative. Suits logistics, health, property and corporate sites that need to look clear and dependable.
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```
- Display: **Albert Sans** — weight 600 · tracking -0.035em · leading 1.0 · sentence case
- Text: **Albert Sans** — 400 for body, 500 for emphasis · leading 1.5 · tracking 0
```css
:root {
  --step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);
  --step-body: clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem);
  --step-lead: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);
  --step-head: clamp(2rem, 1.3rem + 3.2vw, 4rem);
}
```
The marketing type matches the product's interface type so the fragments and the page feel like one thing. Headline modest; interface text at its true size (13–15px) inside fragments.
The direction decides sizes and how many of them; the type system decides how this face is set. Where the two give different tracking or leading, use the values of the type system: they are tuned to this face.
The display size itself comes from the hero blueprint below.

## 4. Colour — Sheet and biro
```css
:root {
  --bg: #ffffff;
  --surface: #f4f4f4;
  --ink: #111111;
  --muted: #6b6b6b;
  --accent: #1a4be0;
  --accent-ink: #ffffff;
  --field-1: #111111;  --field-1-ink: #ffffff;
}
```
White holds the whole page with black type, one grey for secondary lines and a pale grey step for tiles and inputs; the footer may invert to black. Blue is the colour of text links and the one button, and nothing else is tinted.
Neutral ground. The product's own interface colours provide the colour. At most one flat stage colour behind fragments.

## 5. Imagery
**This subject is software and there are no screenshots, so its pictures are its own interface.** Wherever this sheet says photograph, image or object, build a believable fragment of the product in HTML at real size (real labels, numbers that add up, one item hovered or selected), put the attribute `data-ui` on its root, and crop or scale it the way the blueprint treats a photograph: a full-bleed close crop, a tile, the fixed half of a split. Where a fragment makes no sense, use a flat colour field with type on it. Never a fake dashboard of grey bars, never a device frame. If the product works on something physical (ships, plants, buildings, a city), one real picture of that world can carry a section: find it with `node /home/eminemre/.claude/skills/taste-skill/scripts/assets.mjs "<that world>"`, download it with `--get`, credit it on the page, and never let it pass for the product or its customers.

The interface fragments are the main imagery: build them carefully with real labels, real numbers and sensible states (one hovered, one selected). Around them, two or three real pictures of the customer's world (found with scripts/assets.mjs), never stock of people at laptops.

**Floor (the inspector checks it):** at least four real pictures on the page, usually six to twelve; SVG drawings do not count. One moving picture where an honest clip exists: `node <skill>/scripts/assets.mjs --video "<query>"`, used as a muted loop with a poster frame. Whatever this direction says about pictures, it is carried out with real ones.

Optional atmosphere, two at most, from the "Architecture" set (structure, lines, bridges, facades and building interiors). The page does not need them.
Order of preference for imagery: (1) the project's own photographs and product shots; (2) images you generate, if an image tool is
available; (3) real pictures of the subject's world found in the open collections (assets.mjs, downloaded and credited on the page);
(4) drawings of the subject in code; (5) these. They are real photographs (Unsplash licence, served by picsum.photos) of places, light and
texture. They are atmosphere, never a stand-in for a specific product, dish, person or interface. List the ones you use in your report so
they can be replaced.
- `https://picsum.photos/id/1081/1600/1000` — Stepped white modern building corner rising into a pale blue sky · light tone · white, pale blue, soft grey · calm area: top · native landscape · photo: Julien Moreau
- `https://picsum.photos/id/508/1600/1000` — Tall pointed vaults and pale columns of a church interior · light tone · cream, warm grey, soft orange · native portrait · photo: Jeff Sheldon
- `https://picsum.photos/id/378/1600/1000` — Silhouetted people at tall windows overlooking a city, black and white · dark tone · black, grey, white · black-and-white · calm area: bottom · native landscape · photo: Charles Forerunner
- `https://picsum.photos/id/618/1600/1000` — Curving glass and steel lattice roof in black and white · light tone · white, grey, black · black-and-white · native landscape · photo: Mika Ruusunen
The last two path numbers are width and height: request the exact crop you render (`/1200/1500` for a 4:5 portrait, `/2400/1350` for a hero) and
add `?grayscale` to desaturate. Use at most two. Always set `width`, `height`, `alt` and `loading="lazy"` (not on the hero image).
Other sets that fit this brief: water, fog-and-quiet — `node draw.mjs --photos <set>` prints one in full; `--photos list` shows all sets. Taking photographs from another set is your call and is not a redraw; keep them to one light and one treatment.

## 6. Hero — Fragment on a shaped stage
A neutral ground. The headline occupies the upper-left third: two lines at clamp(52px, 5.2vw, 80px), medium weight, flush left on columns 1–6 at a 40px margin, starting 150px down. One supporting sentence at 18px, max 40ch, follows, then the single action as a small rectangular button. The rest of the screen belongs to one flat stage in a saturated colour: it spans columns 5–12, begins 42% down, and bleeds off the right and bottom edges. Its top-left corner is cut with the product's own shape using `clip-path` (a notch, a chamfer or a tab two columns wide), the only decoration on the page. On the stage, 56px in from its left and top edges, sits the main fragment of the interface at true size with labels at 13–15px, built in HTML and working: one panel or control about 620px wide, cropped by the bottom edge, never a whole window and never inside a browser or laptop frame. Mark its root with data-ui. Navigation is a plain row at 28px from the top: wordmark left and four text links right at 15px. Nothing overlaps the headline.

On a phone: The headline sits under the wordmark at 10vw on two lines, followed by the sentence at 16px and the button. The stage comes next at full width, bleeding off both sides and the bottom, its corner cut kept at 72px wide. The fragment sits 16px inside it at true size; if it is wider than the screen the right edge crops it rather than scaling it down.
Headline: A plain statement of what the product does in three to six words, two lines of up to about 16 characters each at 5.2vw.

## 7. Sections, in order
Each is a composition to rebuild with this project's content. Keep the geometry; change the subject. Re-order or drop a
section when the argument of the page needs it (see references/copy.md), never to fall back to a card grid.

### 1. how-it-works — Pinned fragment, changing state (pinned)
Two columns. Right, columns 7–12: a stage that is position: sticky; top: 14vh, holding one fragment of the real interface at true size on a single flat stage colour, about 520px square. Left, columns 1–5: three statements, each in its own block 80vh tall, so one is in view at a time. A statement is a two-line sentence at 28–32px that begins with its order word ('Paste a link.', 'Then pick the parts you want.', 'Share it when it looks right.') plus one supporting line at 16px. The statement nearest the viewport's centre is in full ink; the others sit at 30%. As each statement becomes active the fragment changes to the matching state: an empty field, a filled list with two rows selected, a finished result with its confirmation. Build the states in HTML and switch a class; do not swap screenshots. The heading, two to four words at 24–28px, sits above the first statement.
On a phone: The stage is sticky at the top, 46svh tall, the fragment fitted by cropping to its active region, not by shrinking its text. Statements scroll beneath it in blocks 60svh tall at 22px. The stage releases after the third statement.

Adjusted for this page:
- It fades text: anything a visitor reads, inactive items of a list included, is `--ink` or `--muted` at full strength (contrast 4.5:1 or more). The active item is told apart by `--ink` against `--muted`, weight or the accent, not by fading the rest.

### 2. showcase — Lit panel, dark row (carousel)
One dark field, 96svh tall. Across its middle runs a horizontal row of five to seven interface panels, each a different true-size fragment marked data-ui (an open menu, an inspector, a composer, a chart card), 320–460px wide at their natural heights, vertically centred and 26vw apart. The row scrolls sideways with scroll-snap-type: x mandatory and scroll-snap-align: center, and can be dragged. Only the panel at the centre is lit: full opacity, in the product's light theme, the brightest thing on screen. The others sit at 22% opacity and are inert. The viewport's edges crop the outermost panels. In the gap to the right of the centred panel, top-aligned with it, a 24ch column gives its name at 24px in a light weight and two lines at 16px in a lifted ink; this text changes as panels arrive. There is no heading above the row.
On a phone: The row is 62svh tall; panels snap one per screen at true size, capped at 86vw wide, with neighbours showing 7vw at each side at 22% opacity. The name and its two lines sit beneath the row on the left margin and change with the centred panel. Swiping moves the row.

Adjusted for this page:
- It fades text: anything a visitor reads, inactive items of a list included, is `--ink` or `--muted` at full strength (contrast 4.5:1 or more). The active item is told apart by `--ink` against `--muted`, weight or the accent, not by fading the rest.

### 3. list — Two-ended rows, narrow column (list)
A list in one narrow column, 520px wide, starting at 22% of the viewport width or centred. Every row is 34–38px tall with no box and nothing drawn between rows. Each row has two ends: at the left, a 16px round image (a face, a logo, a colour dot) followed after 8px by the name at 15–16px in full ink; at the far right of the column, a short value at 13px in the soft ink (a date, a price, a domain, an opening time) with tabular figures. Entries that need a sentence run to two lines at the left, and the value aligns with the first line. Groups are separated by 40px of space and begin with one plain word in the soft ink at the same size. A heading of two to four words at 24–28px in medium weight sits 32px above the first row. Holds 10–40 rows.
On a phone: The column fills the width with 20px margins. Rows are 44px tall for touch; the left image stays 16px. Long values wrap beneath the name at 13px, left-aligned with it, and the row grows. Group spacing is 32px.

### 4. cta — The action tile (grid)
The close is one row of the board. Three filled tiles sit side by side with 8–14px gaps, all 360px tall and sharing one radius: a wide centre tile spanning columns 3–10 in the accent colour, flanked by two narrow tiles (columns 1–2 and 11–12) that run off the left and right viewport edges, as if the row had been cropped from a longer one. The centre tile holds, left-aligned and vertically centred with 40px padding: a heading of three to five words at 40px, two lines at 17px, and the action. The action is either one rectangular button or an email field 420px wide in the paper colour with the submit button nested inside its right end. The flanking tiles hold no text: one is a photograph covering the tile, the other a flat palette colour. No shadows, no outlines.
On a phone: The accent tile runs full width, about 300px tall, heading at 28px, field and button stacked at full width. The two flanking tiles follow beneath as a pair, each half width and 120px tall, with the same gap and the same radius.

Adjusted for this page:
- It mentions a shadow: only on something open above the page (a menu, a dialog), never on a resting element.

### 5. footer — A single quiet line (strip)
No footer block at all. After at least 30svh of empty page ground, one baseline 30px above the bottom edge carries three items in the page's ordinary small text size (14–16px), the same size and weight as the navigation: at the left margin, what this is in three or four words; centred, two to five links separated by 24px of space; at the right margin, the year and a privacy link. Use a three-column grid (1fr auto 1fr) so the centre group is truly centred whatever the side lengths. No logo, no background change, no line above it, no columns. Links are in the full ink; the rest in the softer ink. If the page has a narrow text column, the three items may instead sit on that column's left edge as one wrapped line. The restraint only works if the page above has already made its invitation.
On a phone: Three short lines at 14px on the left margin with 8px between them: the description, the links on one wrapped line, then year and privacy. Links stay in the full ink. Leave 20svh of empty ground above and 24px below.

## 8. Motion — Shutter image
The one hero or showcase image opens from an edge with a clip-path over about 1.1 seconds while the picture inside settles from 1.12 scale to rest. Use it once, on the image that matters most; later images simply are there. Recipe: 'Image shutter' in references/motion.md.
This is the signature move, the one loud moment. Around it the page still needs the rest of the motion layer (SKILL.md step 9): an entrance for the parts of every section, feedback on every control, and one moving picture. The inspector fails a page that barely moves. Recipes: references/motion.md.

## 9. Where the richness comes from
Fidelity. A fragment with believable content and a real hover state is more interesting than any illustration. Spend the effort there.

## 10. How this direction goes wrong
A fake interface made of grey bars and circles is the worst outcome; if you cannot build a believable fragment, change direction. Mark each fragment's root element with the attribute data-ui: inside it the product's own conventions apply (1px control borders, small radii, a shadow on its open menu) and the inspector leaves them alone; outside it the house rules hold as usual. data-ui is for cropped fragments only, never for a page wrapper. Do not put the fragment in a browser or laptop frame.

## 11. Real references
Studied sites that work this way. Take the principle, never the specifics: no names, copy, images or signature assets of theirs.
- **Uni** (One Page Love, studied score 7.2) `opl-uni`
  Idea: The product lives in the laptop notch, so the page's navigation is a black notch and the hero is a laptop outline whose notch opens into the app.
  Hero: White page with the hero as a rounded-corner panel inset 24px on all sides, filled with a grainy pastel gradient (pink-peach centre, sky blue down the right edge, orange lower-left). A black pill 300×44px sits top-centre like a laptop notch, holding only the app icon; it is the entire nav. Centred below: a hand-scrawled caps eyebrow, a two-line 48px (3.3vw) headline, two white pill download buttons side by side, one line of tiny grey reassurance. The bottom 40% is a thick black outline of a laptop screen, 960px wide, cropped by the fold, its notch expanded into a dark input bar playing the demo.
  Worth taking: Shape the navigation like the product's own hardware habitat (here a black notch pill) so the nav itself demonstrates the product.
- **Typewave** (One Page Love, studied score 7.2) `opl-typewave`
  Idea: A plugin about type scales sold on a near-black page where flat saturated fields (orange, lime, blue) act as stages for the plugin's own dark interface.
  Hero: Near-black field. Nav row at the top: pixel-block logo and wordmark left, four plain links centred (one carrying a tiny lime tag), a cream rectangular button with a Figma glyph right. The headline sits centred around mid-height: three lines at about 6.7vw, medium weight, off-white, with the third line recoloured pale lime. Below it a three-line 18px paragraph held to about 45% of the width, then a small cream button repeating the nav action. About 150px lower, the top edge of a flat orange slab, 70% of the viewport wide with barely rounded corners, peeks over the fold; it holds the plugin window.
  Worth taking: Stage dark UI screenshots on flat saturated rectangles instead of on the page background, so the colour does the branding and the UI stays legible.
- **Mat** (One Page Love, studied score 7.2) `opl-mat`
  Idea: The app's scrapbook cut-outs invade the page itself: stickers interrupt the headline and a green cutting mat is both brand and container.
  Hero: Cream field, no navigation or logo; everything is centred. At 14% of the height a small tan caption with a cut-out camera to its left. Then a three-line lowercase headline in extra-bold rounded sans at 86px (6vw) in dark green, spanning 68% of the width, with four image cut-outs set inline at letter height: ransom-note letters spelling the name, a green cutting mat, a glass of matcha and a phone. Below, a green rectangular button with 4px radius, a faint grid texture and a soft drop shadow, carrying an apple sticker; then a two-line user count flanked by two fern leaves as a laurel. The bottom quarter is empty.
  Worth taking: Interrupt the headline with photographic cut-outs sized to the letter height, including the product name spelled in ransom-note letters.
Full notes on any of them: `node draw.mjs --site <id>`.

## Always
Headlines two lines or fewer at every width. No eyebrow labels, no monospace, no 01/02/03, no thin rules, no gradients, no shadows at rest,
no cream-and-terracotta, no violet. `inspect.mjs` measures all of it.

Saved to /home/eminemre/Projeler/cafeduo-worktrees/design-landing/.taste-skill/direction.json · reprint with `node draw.mjs --show`
