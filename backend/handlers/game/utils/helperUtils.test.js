const { sanitizeLiveSubmission } = require('./helperUtils');

const AIM = 'Nişancı Düellosu';
const QUIZ = 'Bilgi Yarışı';
const CHESS = 'Retro Satranç';

describe('sanitizeLiveSubmission', () => {
  it('sınırın altındaki skoru ve turu olduğu gibi bırakır', () => {
    const result = sanitizeLiveSubmission(
      { score: 9, roundsWon: 3, round: 2, done: true, submissionKey: 'k1' },
      AIM
    );

    expect(result.score).toBe(9);
    expect(result.roundsWon).toBe(3);
    expect(result.round).toBe(2);
    expect(result.done).toBe(true);
    expect(result.submissionKey).toBe('k1');
  });

  it('sınırı aşan skoru, kazanılan turu ve tur numarasını kırpar', () => {
    const result = sanitizeLiveSubmission({ score: 99999, roundsWon: 99999, round: 99 }, AIM);

    expect(result.score).toBe(15);
    expect(result.roundsWon).toBe(15);
    expect(result.round).toBe(5);
  });

  it('negatif değerleri sıfıra çeker', () => {
    const result = sanitizeLiveSubmission({ score: -5, roundsWon: -2, round: -1 }, AIM);

    expect(result.score).toBe(0);
    expect(result.roundsWon).toBe(0);
    expect(result.round).toBe(0);
  });

  it('bilgi yarışında 320 üstünü kırpar', () => {
    const result = sanitizeLiveSubmission({ score: 9999, roundsWon: 9999, round: 9999 }, QUIZ);

    expect(result.score).toBe(320);
    expect(result.roundsWon).toBe(320);
    expect(result.round).toBe(10);
  });

  it('sayısal üst sınırı olmayan satrançta skoru kırpmaz', () => {
    const result = sanitizeLiveSubmission({ score: 99999, round: 99999 }, CHESS);

    expect(result.score).toBe(99999);
    expect(result.round).toBe(99999);
  });

  it('bilinmeyen oyun türünde üst sınır uygulamaz', () => {
    const result = sanitizeLiveSubmission({ score: 99999, round: 99999 }, 'Bilinmeyen Oyun');

    expect(result.score).toBe(99999);
    expect(result.round).toBe(99999);
  });

  it('sayısal olmayan skoru sıfır sayar', () => {
    const result = sanitizeLiveSubmission({ score: 'abc', roundsWon: null, round: 'x' }, AIM);

    expect(result.score).toBe(0);
    expect(result.roundsWon).toBe(0);
    expect(result.round).toBe(0);
  });

  it('oyun türünü verilen normalize fonksiyonuyla çözer', () => {
    const result = sanitizeLiveSubmission({ score: 1, mode: 'quiz' }, AIM, (mode) =>
      mode === 'quiz' ? QUIZ : null
    );

    expect(result.mode).toBe(QUIZ);
  });
});
