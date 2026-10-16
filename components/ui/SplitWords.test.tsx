import React from 'react';
import { render, screen } from '@testing-library/react';
import { SplitWords } from './SplitWords';

test('keeps the heading text intact while wrapping each word for the reveal', () => {
  render(
    <h2>
      <SplitWords text="Masaya  nasıl" />{' '}
      <em>
        <SplitWords text="oturulur?" start={2} />
      </em>
    </h2>
  );
  const heading = screen.getByRole('heading', { name: 'Masaya nasıl oturulur?' });
  expect(heading.textContent).toBe('Masaya nasıl oturulur?');
  const words = heading.querySelectorAll<HTMLElement>('.club-split-word > span');
  expect(Array.from(words, (word) => word.textContent)).toEqual(['Masaya', 'nasıl', 'oturulur?']);
  expect(Array.from(words, (word) => word.style.getPropertyValue('--word-index'))).toEqual([
    '0',
    '1',
    '2',
  ]);
});
