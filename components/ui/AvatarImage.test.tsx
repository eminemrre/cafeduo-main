import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarImage } from './AvatarImage';
import { getAvatarUrl } from '../../lib/avatars';

it('keeps initials while loading and removes them after a curated image loads', () => {
  const { container } = render(<AvatarImage src={getAvatarUrl('kahve')} initials="EM" />);
  const img = container.querySelector('img')!;
  expect(img).toHaveAttribute('src', '/avatars/pixel-art-v9/kahve.svg');
  expect(screen.getByText('EM')).toBeInTheDocument();
  expect(img).toHaveStyle({ opacity: 0 });
  fireEvent.load(img);
  expect(screen.queryByText('EM')).not.toBeInTheDocument();
  expect(img).toHaveStyle({ opacity: 1 });
  expect(img.parentElement).toHaveAttribute('aria-hidden', 'true');
});

it('shows initials after a legacy image fails and starts a fresh lifecycle when the source changes', () => {
  const { container, rerender } = render(
    <AvatarImage src={getAvatarUrl('legacy')} initials="EM" />
  );
  const img = container.querySelector('img')!;
  expect(img).toHaveAttribute('src', getAvatarUrl('legacy'));
  fireEvent.error(img);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('EM')).toBeInTheDocument();
  rerender(<AvatarImage src={getAvatarUrl('duo')} initials="DU" />);
  const next = container.querySelector('img')!;
  expect(next).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
  fireEvent.load(next);
  expect(screen.queryByText('DU')).not.toBeInTheDocument();
  rerender(<AvatarImage initials="ME" />);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('ME')).toBeInTheDocument();
});
