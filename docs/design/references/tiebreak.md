# Reference: The Tie-break

Reference for the CafeDuo landing redesign:
[The Tie-break](https://thetiebreak.merci-michel.com/) by Merci Michel, a New Balance x Miu Miu
launch with Coco Gauff (Awwwards Site of the Day, 2026-09-25). The measured profile is in
`reference-tiebreak.dna.json`. Analysed on 2026-10-17 from live captures at 1440x900, computed
styles and colour measurement. The captures are not committed because they contain third-party
campaign photography.

## What the visitor experiences

1. A grained, out-of-focus portrait fills the screen. A tennis court is drawn over it in thin
   white, blue and red lines. The only text is "The Tie-break!" in a large serif, one sentence
   and a small Start button.
2. Start does not lead to another page. The same stage says "You are about to play the
   Tie-break", then "Score 7 points to win", then "Press ← or → on your keyboard", then counts
   down from 3.
3. A Pong-style rally against the computer. Each half of the court shows its score (`00`) in the
   serif.
4. Winning a point pulls the photograph into sharp focus: a campaign shot of Gauff in the
   collection. "Click to continue →" returns to the rally on a new blurred photo.

## Why it works

- **The activity is the way in.** The brand's own sport is the interface. Nobody reads about the
  collection; they play, and the collection is what they win.
- **The reward is the brand's real world.** Blur is the waiting state, focus is the prize. The
  photographs are the content, and the game decides when the visitor sees them clearly.
- **The subject draws the grid.** The court lines lay out the text, the score and the controls,
  so the only ornament on the page is functional.
- **Restraint everywhere else.** Two typefaces (Instrument Serif, Work Sans), effectively three
  sizes, no cards, no shadows, no navigation. The palette is measured from the photo: navy
  `#283E6C`, ink `#0E0C13`, photo greys and white text `#F4F5F8`, with one blue accent
  `#4A79D8` on the player's side.
- **Time instead of scroll.** One stage changes state, and each sentence replaces the previous
  one. It feels like a broadcast, not a page.

## What we take, and what we must not

Take the principles, not the look:

| Tie-break | CafeDuo translation (direction, not spec) |
| --- | --- |
| The sport is the interface | A café game is the way in: the visitor makes a move before reading any pitch. The working chess board on today's landing already proves we can do this. |
| A point reveals a sharp photo | A move or a round reveals an İzmir district coming into focus (Kordon, Alsancak, Karşıyaka çarşı, Bornova, Urla, ...), shown as the place where your next opponent sits. |
| The court is the grid | The board or the café table is the grid; no decorative rules. |
| The photo is the palette | Colours come from İzmir's real pictures (sea, stone, evening light), not from a cream-and-terracotta default. |
| Two faces, three sizes | Replace the current 5 typefaces and 24 sizes. |

Places where CafeDuo differs and the reference is not a model:

- **It must convert.** "Masaya katıl" and "Giriş yap" stay reachable at all times. The Tie-break
  hides everything behind the game; we cannot.
- **Phones first.** Most visitors arrive on a phone in the café. The interaction must be
  thumb-sized and must not depend on a keyboard.
- **A fallback.** The Tie-break shows nothing without WebGL2. CafeDuo must stay readable and
  usable without WebGL, with reduced motion and with a screen reader.
- **Imagery is found, not shot.** We have no campaign photography. Open-licence pictures of
  İzmir districts exist on Wikimedia Commons (CC BY and CC BY-SA, credit required; checked with
  taste-skill `assets.mjs`). There are no usable open pictures of modern İzmir cafés, so the café
  itself is drawn in code. Found pictures show the city around the cafés and are never presented
  as a partner café.
- **Modern café, not kahvehane.** The feel is a contemporary café, not a traditional coffeehouse.
