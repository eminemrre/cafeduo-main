import {
  STORY_END,
  STORY_START,
  chapterFromStory,
  confettiProgress,
  easeOutBack,
  easeOutExpo,
  knightHop,
  seeded,
  smoothstep,
  storyFromScroll,
  storyPose,
  tokenSpin,
} from './cafeStory';

test('poses hit their keyframes exactly and clamp outside the story', () => {
  expect(storyPose(STORY_START).camera).toEqual([0, 3.1, 8.3]);
  expect(storyPose(-5)).toEqual(storyPose(STORY_START));
  expect(storyPose(1).board).toBe(1);
  expect(storyPose(1).rival.scale).toBe(0.85);
  expect(storyPose(STORY_END).token.face).toBe(1);
  expect(storyPose(9)).toEqual(storyPose(STORY_END));
});

test('poses ease between keyframes instead of jumping', () => {
  const before = storyPose(0.25).board;
  const middle = storyPose(0.5).board;
  const after = storyPose(0.75).board;
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThan(middle);
  expect(middle).toBeCloseTo(0.5, 10);
  expect(after).toBeGreaterThan(middle);
  // smoothstep: slow at both ends of a chapter.
  expect(storyPose(0.1).board).toBeLessThan(0.1);
});

test('the knight only leaps between the first two chapters, highest halfway', () => {
  expect(knightHop(-0.5)).toBe(0);
  expect(knightHop(0)).toBe(0);
  expect(knightHop(0.5)).toBeCloseTo(1.3, 10);
  expect(knightHop(1)).toBe(0);
  expect(knightHop(1.5)).toBe(0);
});

test('the token spins and the confetti bursts only in the reward chapter', () => {
  expect(tokenSpin(0.9)).toBe(0);
  expect(tokenSpin(2)).toBeCloseTo(Math.PI * 2, 10);
  expect(confettiProgress(1.2)).toBe(0);
  expect(confettiProgress(1.675)).toBeCloseTo(0.5, 10);
  expect(confettiProgress(2)).toBeCloseTo(1, 10);
});

test('scroll position maps to the opening shot, the chapters and the end', () => {
  // List still below the anchor: the opening shot.
  expect(storyFromScroll(900, 600, 450)).toBe(STORY_START);
  // Anchor at the centre of the first, second and third block.
  expect(storyFromScroll(350, 600, 450)).toBeCloseTo(0, 10);
  expect(storyFromScroll(150, 600, 450)).toBeCloseTo(1, 10);
  expect(storyFromScroll(-50, 600, 450)).toBeCloseTo(2, 10);
  expect(storyFromScroll(-2000, 600, 450)).toBe(STORY_END);
  expect(chapterFromStory(-1)).toBe(0);
  expect(chapterFromStory(1.4)).toBe(1);
  expect(chapterFromStory(1.6)).toBe(2);
});

test('easing and the seeded sequence are stable', () => {
  expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  expect(easeOutBack(0)).toBeCloseTo(0, 10);
  expect(easeOutBack(1)).toBe(1);
  expect(Math.max(...[0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  expect(easeOutExpo(0)).toBe(0);
  expect(easeOutExpo(1)).toBe(1);
  const a = seeded(7);
  const b = seeded(7);
  const values = [a(), a(), a()];
  expect([b(), b(), b()]).toEqual(values);
  values.forEach((value) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
