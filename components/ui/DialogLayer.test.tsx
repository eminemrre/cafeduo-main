import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DialogLayer } from './DialogLayer';

describe('DialogLayer lifecycle', () => {
  it('keeps the parent scroll lock when its child closes and restores the original style last', () => {
    document.body.style.overflow = 'scroll';
    const onClose = jest.fn();
    const View = ({ childOpen }: { childOpen: boolean }) => (
      <DialogLayer open onClose={onClose} label="Profil">
        <button>Avatar seç</button>
        <DialogLayer open={childOpen} onClose={onClose} label="Avatar">
          <button>Kapat</button>
        </DialogLayer>
      </DialogLayer>
    );
    const { rerender, unmount } = render(<View childOpen />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<View childOpen={false} />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('dialog', { name: 'Profil' })).toBeInTheDocument();
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('routes a child cancellation to the child only, even through the React portal tree', () => {
    const parentClose = jest.fn();
    const childClose = jest.fn();
    const { rerender } = render(
      <DialogLayer open label="Profil" onClose={parentClose}>
        <DialogLayer open label="Avatar" onClose={childClose}>
          <button>Kapat</button>
        </DialogLayer>
      </DialogLayer>
    );
    const event = new Event('cancel', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('dialog', { name: 'Avatar' }), event);
    expect(childClose).toHaveBeenCalledTimes(1);
    expect(parentClose).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    // Changing callback identity must not release the scroll lock or reopen the dialog.
    rerender(
      <DialogLayer open label="Profil" onClose={() => {}}>
        <button>Kapat</button>
      </DialogLayer>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });
});
