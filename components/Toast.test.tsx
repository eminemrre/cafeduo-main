import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from './Toast';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    ),
  },
}));

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('auto closes after duration for non-loading toast', () => {
    const onClose = jest.fn();
    render(
      <Toast
        id="t1"
        message="saved"
        type="success"
        duration={1200}
        onClose={onClose}
      />
    );

    act(() => {
      jest.advanceTimersByTime(1199);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto close when type is loading', () => {
    const onClose = jest.fn();
    render(
      <Toast id="t2" message="processing" type="loading" duration={500} onClose={onClose} />
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on manual close button click', () => {
    const onClose = jest.fn();
    render(<Toast id="t3" message="manual" type="info" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies success styling class', () => {
    render(<Toast id="t4" message="ok" type="success" onClose={jest.fn()} />);

    const container = screen.getByText('ok').closest('div');
    expect(container).toHaveClass('border-green-500');
    expect(container).toHaveClass('bg-green-500/5');
  });

  it('uses info styling by default', () => {
    render(<Toast id="t5" message="info-default" onClose={jest.fn()} />);

    const container = screen.getByText('info-default').closest('div');
    expect(container).toHaveClass('border-blue-500');
    expect(container).toHaveClass('bg-blue-500/5');
  });
});
