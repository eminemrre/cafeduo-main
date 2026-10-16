import {
  clamp,
  createLandingMotion,
  damp,
  exitProgress,
  magneticOffset,
  marqueeOffset,
  viewportProgress,
} from './landingMotion';

describe('landing motion maths', () => {
  test('viewport progress runs from entering at the bottom to leaving at the top', () => {
    expect(viewportProgress(800, 200, 800)).toBe(0);
    expect(viewportProgress(300, 200, 800)).toBe(0.5);
    expect(viewportProgress(-200, 200, 800)).toBe(1);
    expect(viewportProgress(-900, 200, 800)).toBe(1);
  });

  test('exit progress is the share of the element already scrolled past the top', () => {
    expect(exitProgress(100, 400)).toBe(0);
    expect(exitProgress(-100, 400)).toBe(0.25);
    expect(exitProgress(-800, 400)).toBe(1);
  });

  test('damp settles towards the target independent of frame size', () => {
    const oneStep = damp(0, 10, 5, 0.1);
    const twoSteps = damp(damp(0, 10, 5, 0.05), 10, 5, 0.05);
    expect(oneStep).toBeCloseTo(twoSteps, 10);
    expect(damp(0, 10, 5, 10)).toBeCloseTo(10, 5);
  });

  test('magnetic offset pulls towards the pointer and stays within its limit', () => {
    const rect = { left: 0, top: 0, width: 100, height: 40 };
    expect(magneticOffset(rect, 60, 20)).toEqual({ x: 3, y: 0 });
    expect(magneticOffset(rect, 400, -400)).toEqual({ x: 14, y: -14 });
  });

  test('marquee offset loops without drifting out of range in either direction', () => {
    expect(marqueeOffset(0, 100, 1, 300)).toBe(-100);
    expect(marqueeOffset(-250, 100, 1, 300)).toBe(-50);
    expect(marqueeOffset(-10, -100, 1, 300)).toBe(-210);
    expect(marqueeOffset(5, 10, 1, 0)).toBe(0);
    expect(clamp(5)).toBe(1);
  });
});

describe('createLandingMotion', () => {
  let frames: FrameRequestCallback[];
  let now = 0;
  const flush = (count = 1) => {
    for (let i = 0; i < count; i++) {
      const queued = frames;
      frames = [];
      now += 16;
      queued.forEach((callback) => callback(now));
    }
  };
  const rect = (element: Element, top: number, height: number, left = 0, width = 100) =>
    jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top,
      height,
      left,
      width,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
  const pointer = (type: string, target: EventTarget, props: Record<string, unknown>) => {
    const event = new MouseEvent(type, { bubbles: true, ...props });
    Object.defineProperty(event, 'pointerType', { value: props.pointerType });
    target.dispatchEvent(event);
  };

  beforeEach(() => {
    frames = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      frames = [];
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    document.body.innerHTML = `
      <div id="root">
        <section id="section" data-landing-track>
          <span id="deco" data-depth="10" data-scroll-depth="40"></span>
          <button id="cta" data-magnetic><span>Join</span></button>
          <button id="game" data-cursor-label="♞"><span id="game-text">Chess</span></button>
          <p id="copy">Text</p>
        </section>
      </div>
      <div id="cursor"><span></span></div>
      <div id="ink"></div>`;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('writes scroll progress to tracked elements and drifts depth elements with it', () => {
    const root = document.getElementById('root')!;
    rect(document.getElementById('section')!, 300, 200);
    const stop = createLandingMotion(root, { finePointer: false });
    flush();
    const section = document.getElementById('section')!;
    expect(section.style.getPropertyValue('--p')).toBe('0.5000');
    expect(section.style.getPropertyValue('--exit')).toBe('0.0000');
    expect(document.getElementById('deco')!.style.translate).toBe('0.00px 0.00px');

    rect(section, -100, 200);
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(section.style.getPropertyValue('--exit')).toBe('0.5000');
    expect(document.getElementById('deco')!.style.translate).toBe('0.00px 16.00px');

    stop();
    expect(section.style.getPropertyValue('--p')).toBe('');
    expect(document.getElementById('deco')!.style.translate).toBe('');
  });

  test('a fine pointer drives parallax, the magnet and the cursor label', () => {
    const root = document.getElementById('root')!;
    const cursor = document.getElementById('cursor')!;
    const cta = document.getElementById('cta')!;
    rect(cta, 100, 40, 100, 100);
    const stop = createLandingMotion(root, { finePointer: true, cursor });

    pointer('pointermove', cta, { clientX: 190, clientY: 120, pointerType: 'mouse' });
    flush(120);
    expect(cta.dataset.magnetActive).toBe('true');
    expect(cta.style.getPropertyValue('--mag-x')).toBe('12.00px');
    expect(cursor.dataset.visible).toBe('true');
    expect(cursor.dataset.state).toBe('link');
    expect(cursor.style.translate).toBe('190.0px 120.0px');
    // Pointer at (190, 120) of 1000x800 gives (-0.62, -0.7); the zero-height section adds
    // the full +20px scroll drift.
    const [x, y] = document.getElementById('deco')!.style.translate.split(' ').map(parseFloat);
    expect(x).toBeCloseTo(-6.2, 1);
    expect(y).toBeCloseTo(13, 1);

    pointer('pointermove', document.getElementById('game-text')!, {
      clientX: 500,
      clientY: 400,
      pointerType: 'mouse',
    });
    flush();
    expect(cta.dataset.magnetActive).toBeUndefined();
    expect(cta.style.getPropertyValue('--mag-x')).toBe('0px');
    expect(cursor.dataset.state).toBe('label');
    expect(cursor.textContent).toBe('♞');

    pointer('pointerout', document, { relatedTarget: null, pointerType: 'mouse' });
    expect(cursor.dataset.visible).toBe('false');
    stop();
  });

  test('touch input leaves ink that cleans itself up while mouse clicks do not', () => {
    jest.useFakeTimers();
    const root = document.getElementById('root')!;
    const inkLayer = document.getElementById('ink')!;
    const stop = createLandingMotion(root, { finePointer: false, inkLayer });

    pointer('pointerdown', document.getElementById('copy')!, {
      clientX: 40,
      clientY: 60,
      pointerType: 'mouse',
    });
    expect(inkLayer.childElementCount).toBe(0);

    pointer('pointerdown', document.getElementById('copy')!, {
      clientX: 40,
      clientY: 60,
      pointerType: 'touch',
    });
    const ink = inkLayer.firstElementChild as HTMLElement;
    expect(ink.className).toBe('club-touch-ink');
    expect(ink.style.left).toBe('40px');
    expect(ink.style.top).toBe('60px');
    jest.advanceTimersByTime(900);
    expect(inkLayer.childElementCount).toBe(0);

    for (let i = 0; i < 9; i++) {
      pointer('pointerdown', root, { clientX: i, clientY: i, pointerType: 'touch' });
    }
    expect(inkLayer.childElementCount).toBe(6);
    stop();
    expect(inkLayer.childElementCount).toBe(0);
  });

  test('without a fine pointer the engine ignores mouse movement entirely', () => {
    const root = document.getElementById('root')!;
    const cursor = document.getElementById('cursor')!;
    const stop = createLandingMotion(root, { finePointer: false, cursor });
    pointer('pointermove', document.getElementById('cta')!, {
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    flush();
    expect(document.getElementById('cta')!.dataset.magnetActive).toBeUndefined();
    expect(cursor.style.translate).toBe('');
    stop();
  });
});
