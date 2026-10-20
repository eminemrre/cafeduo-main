/**
 * MatchResultCard — birim testleri
 *
 * framer-motion'ı passthrough olarak mock'larız; `animate` mock'u `onUpdate`'i
 * anında final değerle çağırır, böylece AnimatedPoints bileşeni test ortamında
 * doğru sayıyı gösterir.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchResultCard, MatchStats } from './MatchResultCard';

// framer-motion mock — motion.div + motion.button passthrough, animate final-değer, useReducedMotion=false
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  animate: (
    _from: number,
    to: number,
    opts?: { onUpdate?: (v: number) => void; [k: string]: any }
  ) => {
    opts?.onUpdate?.(to);
    return { stop() {} };
  },
  useReducedMotion: () => false,
}));

const baseProps = {
  winner: 'alice',
  earnedPoints: 10,
  currentUsername: 'alice',
  onDismiss: jest.fn(),
  dismissing: false,
};

describe('MatchResultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Outcome başlıkları ─────────────────────────────────────────────────────

  it('kazanınca "KAZANDIN" başlığını gösterir', () => {
    render(<MatchResultCard {...baseProps} winner="alice" currentUsername="alice" />);
    expect(screen.getByText('KAZANDIN')).toBeInTheDocument();
  });

  it('winner case-insensitive karşılaştırılır — büyük harf winner da "KAZANDIN" verir', () => {
    render(<MatchResultCard {...baseProps} winner="ALICE" currentUsername="alice" />);
    expect(screen.getByText('KAZANDIN')).toBeInTheDocument();
  });

  it('başka biri kazanınca "{winner} kazandı" gösterir', () => {
    render(<MatchResultCard {...baseProps} winner="bob" currentUsername="alice" />);
    expect(screen.getByText('bob kazandı')).toBeInTheDocument();
  });

  // ─── REGRESYON: "Berabere kazandı" bug'u ───────────────────────────────────

  it('[REGRESYON] winner="Berabere" iken "BERABERE" görünür, "kazandı" görünmez', () => {
    render(<MatchResultCard {...baseProps} winner="Berabere" currentUsername="alice" />);
    expect(screen.getByText('BERABERE')).toBeInTheDocument();
    expect(screen.queryByText(/kazandı/i)).not.toBeInTheDocument();
  });

  it('winner="" (boş string) → "BERABERE" gösterir', () => {
    render(<MatchResultCard {...baseProps} winner="" currentUsername="alice" />);
    expect(screen.getByText('BERABERE')).toBeInTheDocument();
  });

  it('winner="Sonuç Bekleniyor" → "SONUÇ BEKLENİYOR" gösterir', () => {
    render(<MatchResultCard {...baseProps} winner="Sonuç Bekleniyor" currentUsername="alice" />);
    expect(screen.getByText('SONUÇ BEKLENİYOR')).toBeInTheDocument();
  });

  // ─── AnimatedPoints ─────────────────────────────────────────────────────────

  it('earnedPoints > 0 iken "+N" biçiminde puan render eder', () => {
    render(<MatchResultCard {...baseProps} earnedPoints={10} />);
    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('earnedPoints = 0 iken "0" render eder (artı işareti yok)', () => {
    render(<MatchResultCard {...baseProps} earnedPoints={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('+0')).not.toBeInTheDocument();
  });

  // ─── Stat chip'leri ─────────────────────────────────────────────────────────

  it("quiz stats → Skor ve Soru chip'leri görünür", () => {
    const stats: MatchStats = {
      kind: 'quiz',
      playerScore: 7,
      opponentScore: 3,
      maxRounds: 10,
      durationMs: 0,
    };
    render(<MatchResultCard {...baseProps} stats={stats} />);
    expect(screen.getByText('Skor')).toBeInTheDocument();
    expect(screen.getByText('7–3')).toBeInTheDocument();
    expect(screen.getByText('Soru')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it("chess stats → Hamle chip'i görünür, Soru chip'i görünmez", () => {
    const stats: MatchStats = {
      kind: 'chess',
      playerScore: 1,
      opponentScore: 0,
      moveCount: 42,
    };
    render(<MatchResultCard {...baseProps} stats={stats} />);
    expect(screen.getByText('Hamle')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByText('Soru')).not.toBeInTheDocument();
  });

  it('stats yokken hiç chip render edilmez', () => {
    render(<MatchResultCard {...baseProps} stats={undefined} />);
    expect(screen.queryByText('Skor')).not.toBeInTheDocument();
    expect(screen.queryByText('Soru')).not.toBeInTheDocument();
    expect(screen.queryByText('Hamle')).not.toBeInTheDocument();
  });

  // ─── Dismiss butonu ─────────────────────────────────────────────────────────

  it('butona tıklanınca onDismiss çağrılır', () => {
    const onDismiss = jest.fn();
    render(<MatchResultCard {...baseProps} onDismiss={onDismiss} dismissing={false} />);
    fireEvent.click(screen.getByText('Sonucu gördüm, lobiye dön'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismissing=true iken buton metni "Lobiye dönülüyor..." ve disabled olur', () => {
    render(<MatchResultCard {...baseProps} dismissing={true} />);
    const btn = screen.getByText('Lobiye dönülüyor...');
    expect(btn).toBeInTheDocument();
    expect(btn.closest('button')).toBeDisabled();
  });

  // ─── Genel yapı ─────────────────────────────────────────────────────────────

  it('data-testid="match-result-card" render eder', () => {
    render(<MatchResultCard {...baseProps} />);
    expect(screen.getByTestId('match-result-card')).toBeInTheDocument();
  });

  it('"Maç sonucu" etiketini render eder', () => {
    render(<MatchResultCard {...baseProps} />);
    expect(screen.getByText('Maç sonucu')).toBeInTheDocument();
  });
});
