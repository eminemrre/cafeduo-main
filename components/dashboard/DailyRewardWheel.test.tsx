/**
 * DailyRewardWheel — birim testleri
 *
 * Davranış odaklı: çark gerçek bir SVG pasta olarak çizilir (her dilim bir
 * <path>), iniş kazanılan dilimde durur. Testler render edilen yapıyı ve
 * kullanıcıya görünen sonucu doğrular — CSS uygulama detayını (conic-gradient,
 * clipPath) değil.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DailyRewardWheel } from './DailyRewardWheel';

// framer-motion — passthrough mock. animate/transition gibi motion-only
// prop'ları DOM'a sızdırmadan çocukları render eder.
jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      animate: _animate,
      transition: _transition,
      whileInView: _whileInView,
      initial: _initial,
      exit: _exit,
      ...props
    }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true, // testlerde animasyon/suspense gecikmesini sıfırla
}));

// api mock
jest.mock('../../lib/api', () => ({
  api: {
    wheel: {
      get: jest.fn(),
      spin: jest.fn(),
    },
  },
}));

import { api } from '../../lib/api';

const WHEEL_SLICES = [
  { points: 10, weight: 75 },
  { points: 50, weight: 20 },
  { points: 100, weight: 4 },
  { points: 500, weight: 1 },
];

const makeStatus = (overrides = {}) => ({
  cafeId: 1,
  cafeName: 'Test Kafe',
  wheel: WHEEL_SLICES,
  alreadySpunToday: false,
  lastSpin: null as { id: number; points_won: number; spun_at: string } | null,
  ...overrides,
});

describe('DailyRewardWheel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cafeId yoksa hiçbir şey render etmez', () => {
    const { container } = render(<DailyRewardWheel cafeId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('yükleme sırasında skeleton gösterir', async () => {
    // get asla resolve etmesin
    (api.wheel.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<DailyRewardWheel cafeId={1} />);
    expect(screen.getByText(/Çark yükleniyor/i)).toBeInTheDocument();
  });

  it('status yüklendikten sonra ÇEVİR butonunu gösterir', async () => {
    (api.wheel.get as jest.Mock).mockResolvedValue(makeStatus());

    render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => expect(screen.getByTestId('wheel-spin-button')).toBeInTheDocument());
    expect(screen.getByTestId('wheel-spin-button')).toHaveTextContent('Çevir');
  });

  // ─── SVG render: gerçek pasta dilimleri ──────────────────────────────────

  it('her dilim için bir SVG <path> çizer (dairesel, kare değil)', async () => {
    (api.wheel.get as jest.Mock).mockResolvedValue(makeStatus());

    const { container } = render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => screen.getByTestId('wheel-slice-0'));

    const paths = container.querySelectorAll('path[data-testid^="wheel-slice-"]');
    expect(paths.length).toBe(WHEEL_SLICES.length);
    // Her dilim bir yay (arc) komutu içermeli — pasta dilimi geometrisi.
    paths.forEach((p) => expect(p.getAttribute('d')).toMatch(/A\d+,\d+/));
  });

  it('her dilimin puan etiketi görünür', async () => {
    (api.wheel.get as jest.Mock).mockResolvedValue(makeStatus());

    render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => screen.getByTestId('wheel-slice-0'));

    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.getByText('+500')).toBeInTheDocument();
  });

  it('hediye dilimi yıldız (★) etiketi gösterir, emoji değil', async () => {
    (api.wheel.get as jest.Mock).mockResolvedValue(
      makeStatus({
        wheel: [
          { points: 10, weight: 90 },
          { points: 0, weight: 10, gift: { label: 'Bedava Kahve' } },
        ],
      })
    );

    render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => screen.getByTestId('wheel-slice-1'));
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  // ─── Spin sonucu ─────────────────────────────────────────────────────────

  it('çevirince kazanılan puan overlay olarak gösterilir', async () => {
    jest.useFakeTimers();
    try {
      (api.wheel.get as jest.Mock).mockResolvedValue(makeStatus());
      (api.wheel.spin as jest.Mock).mockResolvedValue({
        pointsWon: 50,
        spin: { id: 1, points_won: 50, spun_at: '' },
      });
      const onPointsWon = jest.fn();

      render(<DailyRewardWheel cafeId={1} onPointsWon={onPointsWon} />);
      await act(async () => {
        await Promise.resolve();
      });

      const btn = screen.getByTestId('wheel-spin-button');
      await act(async () => {
        fireEvent.click(btn);
      });
      // reduced-motion → 60ms suspense; ilerlet ve promise'leri boşalt.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });

      expect(screen.getByText('+50 puan')).toBeInTheDocument();
      expect(onPointsWon).toHaveBeenCalledWith(50);
    } finally {
      jest.useRealTimers();
    }
  });

  // ─── Disabled state ────────────────────────────────────────────────────────

  it('bugün çevrilmişse buton disabled', async () => {
    (api.wheel.get as jest.Mock).mockResolvedValue(
      makeStatus({ alreadySpunToday: true, lastSpin: { id: 1, points_won: 10, spun_at: '' } })
    );

    render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => screen.getByTestId('wheel-spin-button'));
    expect(screen.getByTestId('wheel-spin-button')).toBeDisabled();
  });

  // ─── API hatası ────────────────────────────────────────────────────────────

  it('API hatasında hata mesajı gösterir', async () => {
    (api.wheel.get as jest.Mock).mockRejectedValue(new Error('Sunucu hatası'));

    render(<DailyRewardWheel cafeId={1} />);
    await waitFor(() => expect(screen.getByText('Sunucu hatası')).toBeInTheDocument());
  });
});
