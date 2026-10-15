import fs from 'fs';
import path from 'path';
import { DURATION, EASE, STAGGER, TRANSITION } from './motion';

const css = fs.readFileSync(path.join(__dirname, '..', 'index.css'), 'utf8');

const cssVar = (name: string): string => {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} is missing from index.css`);
  return match[1].trim();
};

describe('motion tokens', () => {
  it('keeps the CSS easing variables in sync with EASE', () => {
    expect(cssVar('ease-brand')).toBe(`cubic-bezier(${EASE.brand.join(', ')})`);
    expect(cssVar('ease-out-quart')).toBe(`cubic-bezier(${EASE.outQuart.join(', ')})`);
    expect(cssVar('ease-in-out-expo')).toBe(`cubic-bezier(${EASE.inOutExpo.join(', ')})`);
  });

  it('keeps the CSS duration variables in sync with DURATION', () => {
    expect(cssVar('dur-fast')).toBe(`${Math.round(DURATION.fast * 1000)}ms`);
    expect(cssVar('dur-base')).toBe(`${Math.round(DURATION.base * 1000)}ms`);
    expect(cssVar('dur-slow')).toBe(`${Math.round(DURATION.slow * 1000)}ms`);
  });

  it('keeps the CSS stagger step in sync with STAGGER', () => {
    expect(cssVar('stagger-step')).toBe(`${Math.round(STAGGER * 1000)}ms`);
  });

  it('uses valid cubic-bezier control points', () => {
    Object.values(EASE).forEach((curve) => {
      expect(curve).toHaveLength(4);
      curve.forEach((value) => {
        expect(Number.isFinite(value)).toBe(true);
      });
      expect(curve[0]).toBeGreaterThanOrEqual(0);
      expect(curve[0]).toBeLessThanOrEqual(1);
      expect(curve[2]).toBeGreaterThanOrEqual(0);
      expect(curve[2]).toBeLessThanOrEqual(1);
    });
  });

  it('builds the ready-made transitions from the tokens', () => {
    expect(TRANSITION.fast).toEqual({ duration: DURATION.fast, ease: EASE.brand });
    expect(TRANSITION.base).toEqual({ duration: DURATION.base, ease: EASE.brand });
    expect(TRANSITION.slow).toEqual({ duration: DURATION.slow, ease: EASE.brand });
  });
});
