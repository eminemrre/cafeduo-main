import React, { useEffect, useRef } from 'react';
import { useLandingMotion } from './LandingExperience';
import { clamp, damp, marqueeOffset } from '../lib/landingMotion';

const BASE_SPEED = 38;
const VELOCITY_GAIN = 0.35;
const MAX_SKEW = 7;

/**
 * A ticker that idles slowly, speeds up with the scroll and follows its direction.
 * Driven by requestAnimationFrame rather than a CSS animation so the speed can follow
 * the scroll; it runs only while the landing motion runs and the band is on screen.
 * The visible text is decorative; `label` carries the same content for assistive tech.
 */
export const ScrollMarquee: React.FC<{ items: string[]; label: string }> = ({ items, label }) => {
  const host = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const motion = useLandingMotion();
  const running = !!motion?.running;

  useEffect(() => {
    const element = host.current;
    const strip = track.current;
    if (!element || !strip || !running) return;
    let frame = 0;
    let visible = typeof IntersectionObserver === 'undefined';
    let offset = 0;
    let velocity = 0;
    let direction = 1;
    let lastTime = 0;
    let lastScroll = window.scrollY;

    const step = (time: number) => {
      frame = 0;
      if (!visible) return;
      const seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 1 / 60;
      lastTime = time;
      const scrolled = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      velocity = damp(velocity, scrolled / Math.max(seconds, 1 / 240), 8, seconds);
      if (Math.abs(velocity) > 40) direction = Math.sign(velocity);
      const speed = BASE_SPEED * direction + velocity * VELOCITY_GAIN;
      // The track holds the items twice, so one copy's width is a seamless loop.
      offset = marqueeOffset(offset, speed, seconds, strip.scrollWidth / 2);
      const skew = clamp(-velocity / 300, -MAX_SKEW, MAX_SKEW);
      strip.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      frame = requestAnimationFrame(step);
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            if (visible && !frame) {
              lastTime = 0;
              lastScroll = window.scrollY;
              frame = requestAnimationFrame(step);
            }
          });
    observer?.observe(element);
    if (visible) frame = requestAnimationFrame(step);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      strip.style.removeProperty('transform');
    };
  }, [running]);

  const sequence = items.map((item, index) => (
    <span key={`${item}-${index}`} className="club-marquee-item">
      {item}
      <i aria-hidden="true">✦</i>
    </span>
  ));

  return (
    <div ref={host} className="club-marquee">
      <span className="sr-only">{label}</span>
      <div ref={track} className="club-marquee-track" aria-hidden="true">
        {sequence}
        {sequence}
      </div>
    </div>
  );
};
