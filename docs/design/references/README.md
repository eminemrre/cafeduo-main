# References for the CafeDuo redesign

Chosen by the user on 2026-10-19 from five offered directions: **A, game scene / cinematic** and
**B, toy-like / candy colours**. Captured at 1440×900 and 390×844 and measured (computed styles,
`design-dna` colour measurement). Captures are not committed: they are third-party work.

| Site | What it does | Measured | What CafeDuo takes |
| --- | --- | --- | --- |
| [The Tie-break](https://thetiebreak.merci-michel.com/) (`tiebreak.md`) | The visitor plays a tennis rally first; a won point brings a blurred campaign photo into focus. | Navy photo field `#283E6C`, ink `#0E0C13`, one blue accent `#4A79D8`; two faces, three sizes. | The activity is the way in; the reward is revealed by playing. |
| [Léo Parpeix](https://leoparpeix.com/) | A soft clay 3D world with one creature you can poke ("click to feed the bee"); the rest of the page is calm type. | Ground `#F7F7F7`, deep green ink `#022016`, yellow `#F6E016`; 14 px text against 162 px condensed display; WebGL2. | One tactile 3D toy you can touch, surrounded by quiet, confident UI. |
| [Anidachi](https://anidachi.com/) | A toy brand where every section is one full-bleed candy colour; a giant 3D device is cropped by the screen. | Sky `#24C0FE`, lime `#B5C615`, pink `#F95F80`, icy ground `#EFF9FB`; custom modular display at 101–138 px; body 20 px; pill buttons. | Drenched section colour, giant cropped 3D objects, a display face with character. |
| [Aardvark Book Club](https://aardvarkbookclub.com/) | A book club dressed as a sweet shop: fat type, tumbling 3D books and an opening box, tilted candy cards. | Lemon `#FFD24A`, magenta `#FD48F2`, aqua `#A4F6F8`, deep blue `#3B308F`; Champ 700 at 96–120 px, Degular body, handwritten asides; radii 6/18/24 px; GSAP + ScrollTrigger. | Maximal warmth, fat rounded display, tilted "sticker" cards for steps, objects that move on scroll. |
| [Butter](https://www.butter.video/) | A video editor shown as collectable 3D keychain charms; the interface stays quiet. | Grey ground `#E9E9E9`/`#FAFAFA`, ink `#1A1A19`; Die Grotesk 60–108 px; 32 px tiles; OGL. | The product as collectable objects; restraint around the objects. |

## What the five agree on

- **Objects, not illustrations.** Every site has a real rendered object (ball, bee, device, book box, charms). CafeDuo's are its own: the cup, the chess knight, the question card, the target, the coin, the table tent with its code.
- **One loud thing per screen.** Colour fields and giant objects are loud; the text around them is quiet and small.
- **Play before reading.** The best of them (Tie-break, Léo Parpeix) let the visitor do something before explaining anything.
- **Fat, characterful display type** (Anidachi, Aardvark) over a plain, readable text face.

## What CafeDuo must not take

- Hiding everything behind the game (Tie-break): "Masaya katıl" and "Giriş yap" stay reachable.
- Their names, copy, images, characters or fonts. Commercial faces (Champ, Degular, Die Grotesk, Ease) are replaced with open-licence faces that cover Turkish.
- WebGL as the only path: every object has a static fallback.
