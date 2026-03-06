# Frontend Audit Sprint 1

Last updated: 2026-03-06

## Scope

This audit uses Anthropic's `frontend-design` guidance as a rubric, with emphasis on:

- strong visual direction instead of generic UI
- expressive type hierarchy
- meaningful motion
- clear component primitives and repeated visual language
- mobile safety and interaction clarity

Inputs used for this audit:

- current screenshots:
  - `output/playwright/landing-desktop.png`
  - `output/playwright/auth-login-modal.png`
- source review:
  - [`components/Hero.tsx`](/home/emin/cafeduo-main/components/Hero.tsx)
  - [`components/Dashboard.tsx`](/home/emin/cafeduo-main/components/Dashboard.tsx)
  - [`components/Store.tsx`](/home/emin/cafeduo-main/components/Store.tsx)
  - [`components/dashboard/RewardSection.tsx`](/home/emin/cafeduo-main/components/dashboard/RewardSection.tsx)
  - [`tailwind.config.js`](/home/emin/cafeduo-main/tailwind.config.js)
  - [`index.css`](/home/emin/cafeduo-main/index.css)

Note:

- local authenticated dashboard/store screenshot capture was flaky under the in-memory dev auth setup, so those sections were evaluated from code structure and validated UI states rather than fresh local images

## Strong Parts

- The product already has a clear cyber-brutalist direction. It does not look template-driven.
- Typography is intentional. `Teko` and `Chakra Petch` produce a strong identity, especially in the hero.
- Color language is coherent: cyan, pink, dark navy, muted ink. The palette is recognizable and reusable.
- The landing page composition is asymmetrical and has hierarchy. Hero, side panel, lower modules, and footer do not collapse into a generic SaaS layout.
- Motion is mostly purposeful. Hero reveals and panel transitions support the fiction of a live system.
- The shared CSS variables in [`index.css`](/home/emin/cafeduo-main/index.css) are a solid base for a design system rather than one-off inline styling.

## Design Debt

- The visual system is still split between at least three dialects:
  - hero / landing cyber-brutalism
  - dashboard terminal/brutalist panels
  - store gradient-heavy cyber-market styling
- These are related, but not yet unified into a single component primitive system.
- Some surfaces rely on dense decorative effects at the same time:
  - noise overlay
  - gradients
  - neon borders
  - skew transforms
  - text shadows
  - grid overlays
- The result is stylish, but some regions are close to visual saturation.
- The auth modal reads as functional, but its overlay and card treatment feel less premium than the hero behind it.
- Mobile density is still risky. The system is visually rich, but vertical compression and large display type increase the chance of clipped or crowded states on smaller screens.

## Inconsistencies

- Hero cards use one border/shadow grammar, dashboard panels use another, store cards use a third.
- Buttons are not yet fully normalized:
  - hero CTA buttons
  - `RetroButton`
  - store purchase buttons
  - dashboard tab buttons
  all belong to the same universe, but they do not yet behave like one button family.
- The hero uses maximalist type and strong diagonal framing, while some later sections flatten into safer card grids.
- Reward and store views overlap conceptually but not visually. They feel authored by adjacent systems rather than one system.
- Focus affordance is not clearly standardized from the current source review. Hover styling is stronger than keyboard focus styling in several areas.

## Next Sprint Visual Work

### 1. Unify primitives

Create one shared visual primitive layer for:

- screen card
- muted card
- CTA button
- secondary button
- tab button
- terminal strip
- metric badge

These should live in reusable class patterns or small wrapper components rather than each screen redefining them.

### 2. Tighten hero-to-dashboard continuity

Move dashboard and store surfaces closer to the hero language:

- keep the cyan/pink terminal fiction
- reduce ad hoc shadow/border variants
- standardize corner accents and panel headers

### 3. Reduce decorative stacking

Keep the atmosphere, but reduce simultaneous effect layers in the same region.

Preferred rule:

- one dominant surface treatment
- one accent treatment
- one motion layer

not all available effects at once.

### 4. Standardize interaction affordance

Define one consistent pattern for:

- hover
- focus-visible
- disabled
- busy/loading
- selected/active

This is especially needed across hero CTAs, dashboard tabs, quick actions, and store purchase buttons.

### 5. Mobile-specific cleanup

Run a dedicated mobile pass for:

- hero type wrapping
- auth modal spacing
- dashboard tab compression
- reward/store card density
- bottom-nav overlap and safe-area padding

## Verdict

The frontend has a real point of view and already avoids generic UI. The next step is not “make it prettier”; it is “make the visual language more consistent and systematized.” That is a good place to be.
