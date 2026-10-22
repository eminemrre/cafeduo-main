/**
 * Unranked bot practice for Bilgi Yarışı.
 *
 * Ranked questions live only in `backend/gameEngine/data/quizQuestions.json`
 * and are never shipped to the browser. This small, non-secret set exists so
 * the local bot mode still works without importing the ranked bank. The score
 * rules below mirror the server for practice only; a multiplayer match always
 * reads its score from the server snapshot.
 */
export type QuizLevel = 'orta' | 'zor';

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  category: string;
  level: QuizLevel;
}

interface PracticeBankEntry {
  question: string;
  answer: string;
  wrong: [string, string, string];
  category: string;
  level: QuizLevel;
}

/** Seconds a player has for one question. */
export const QUESTION_TIME_SECONDS = 15;
/** Points for a correct answer, before the time bonus. */
export const CORRECT_POINTS = 10;
/** Extra points per correct answer from the third correct answer in a row. */
export const STREAK_BONUS = 5;
export const STREAK_FROM = 3;

const BOT_PRACTICE_BANK: readonly PracticeBankEntry[] = [
  {
    question: 'Türkiye Cumhuriyeti hangi yıl kuruldu?',
    answer: '1923',
    wrong: ['1919', '1920', '1938'],
    category: 'Tarih',
    level: 'orta',
  },
  {
    question: 'İstanbul hangi kıtalar üzerinde yer alır?',
    answer: 'Avrupa ve Asya',
    wrong: ['Avrupa ve Afrika', 'Asya ve Avustralya', 'Afrika ve Asya'],
    category: 'Coğrafya',
    level: 'orta',
  },
  {
    question: 'Bir üçgenin iç açıları toplamı kaç derecedir?',
    answer: '180',
    wrong: ['90', '270', '360'],
    category: 'Matematik',
    level: 'orta',
  },
  {
    question: 'Suyun kimyasal formülü nedir?',
    answer: 'H₂O',
    wrong: ['CO₂', 'O₂', 'NaCl'],
    category: 'Bilim',
    level: 'orta',
  },
  {
    question: '“Küçük Prens” kitabının yazarı kimdir?',
    answer: 'Antoine de Saint-Exupéry',
    wrong: ['Victor Hugo', 'Jules Verne', 'Albert Camus'],
    category: 'Edebiyat',
    level: 'orta',
  },
  {
    question: 'Türkiye’nin en yüksek dağı hangisidir?',
    answer: 'Ağrı Dağı',
    wrong: ['Erciyes Dağı', 'Uludağ', 'Kaçkar Dağı'],
    category: 'Coğrafya',
    level: 'orta',
  },
  {
    question: 'Güneş sistemindeki en büyük gezegen hangisidir?',
    answer: 'Jüpiter',
    wrong: ['Satürn', 'Dünya', 'Neptün'],
    category: 'Bilim',
    level: 'orta',
  },
  {
    question: 'Bir yılda kaç ay vardır?',
    answer: '12',
    wrong: ['10', '11', '13'],
    category: 'Genel kültür',
    level: 'orta',
  },
  {
    question: 'Türkiye’nin başkenti neresidir?',
    answer: 'Ankara',
    wrong: ['İstanbul', 'İzmir', 'Bursa'],
    category: 'Coğrafya',
    level: 'orta',
  },
  {
    question: 'İnsan vücudunda kanı pompalayan organ hangisidir?',
    answer: 'Kalp',
    wrong: ['Akciğer', 'Karaciğer', 'Böbrek'],
    category: 'Bilim',
    level: 'orta',
  },
  {
    question: 'Hangi sayı asal değildir?',
    answer: '21',
    wrong: ['17', '19', '23'],
    category: 'Matematik',
    level: 'zor',
  },
  {
    question: 'Osmanlı Devleti’nin ilk başkenti neresidir?',
    answer: 'Söğüt',
    wrong: ['Bursa', 'Edirne', 'İstanbul'],
    category: 'Tarih',
    level: 'zor',
  },
  {
    question: 'Işık boşlukta yaklaşık olarak saniyede kaç kilometre yol alır?',
    answer: '300.000',
    wrong: ['30.000', '3.000.000', '1.500'],
    category: 'Bilim',
    level: 'zor',
  },
  {
    question: '“İnce Memed” romanının yazarı kimdir?',
    answer: 'Yaşar Kemal',
    wrong: ['Orhan Kemal', 'Sabahattin Ali', 'Fakir Baykurt'],
    category: 'Edebiyat',
    level: 'zor',
  },
  {
    question: 'Dünyanın en uzun nehri hangisidir?',
    answer: 'Nil',
    wrong: ['Amazon', 'Yangtze', 'Mississippi'],
    category: 'Coğrafya',
    level: 'zor',
  },
  {
    question: 'Bir altıgenin iç açıları toplamı kaç derecedir?',
    answer: '720',
    wrong: ['540', '630', '900'],
    category: 'Matematik',
    level: 'zor',
  },
  {
    question: 'Türkiye’nin ilk kadın pilotu kimdir?',
    answer: 'Sabiha Gökçen',
    wrong: ['Halide Edip Adıvar', 'Afet İnan', 'Safiye Ali'],
    category: 'Tarih',
    level: 'zor',
  },
  {
    question: 'Periyodik tabloda “Au” hangi elementin sembolüdür?',
    answer: 'Altın',
    wrong: ['Gümüş', 'Bakır', 'Alüminyum'],
    category: 'Bilim',
    level: 'zor',
  },
  {
    question: 'Hangi ülke iki kıtada toprağa sahiptir ve başkenti iki kıtaya yayılır?',
    answer: 'Türkiye',
    wrong: ['Mısır', 'Rusya', 'Endonezya'],
    category: 'Coğrafya',
    level: 'zor',
  },
  {
    question: '“Suç ve Ceza” romanının yazarı kimdir?',
    answer: 'Dostoyevski',
    wrong: ['Tolstoy', 'Turgenyev', 'Çehov'],
    category: 'Edebiyat',
    level: 'zor',
  },
];

const hashSeed = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** The seed both players of a local bot match share. */
export const quizSeed = (gameId: string | number) => `bot-quiz:${String(gameId)}`;

const toQuestion = (entry: PracticeBankEntry, random: () => number): QuizQuestion => {
  const options = shuffle([entry.answer, ...entry.wrong], random) as QuizQuestion['options'];
  return {
    question: entry.question,
    options,
    answerIndex: options.indexOf(entry.answer),
    category: entry.category,
    level: entry.level,
  };
};

/**
 * A local practice set. This is deliberately not the ranked bank: it is small,
 * public trivia and only powers the bot mode.
 */
export const buildQuizRoundSet = (
  seedSource: string | number,
  roundCount: number
): QuizQuestion[] => {
  const random = mulberry32(hashSeed(String(seedSource || 'cafeduo-bot-practice')));
  const count = Math.max(1, Math.min(BOT_PRACTICE_BANK.length, Math.floor(roundCount || 0)));
  const picked = shuffle(BOT_PRACTICE_BANK, random).slice(0, count);
  return picked.map((entry) => toQuestion(entry, random));
};

/** "Yarı yarıya": the two wrong options to hide in bot practice. */
export const halfAndHalf = (question: QuizQuestion, seedSource: string): [number, number] => {
  const random = mulberry32(hashSeed(`${seedSource}|${question.question}`));
  const wrong = shuffle(
    [0, 1, 2, 3].filter((index) => index !== question.answerIndex),
    random
  );
  return [wrong[0], wrong[1]];
};

export interface AnswerScore {
  points: number;
  timeBonus: number;
  streakBonus: number;
  doubled: boolean;
  /** Correct answers in a row, this one included (0 after a wrong answer). */
  streak: number;
}

/** Practice-only scoring, kept in step with the server rules. */
export const scoreAnswer = ({
  correct,
  secondsLeft,
  streakBefore,
  isFinal,
}: {
  correct: boolean;
  secondsLeft: number;
  streakBefore: number;
  isFinal: boolean;
}): AnswerScore => {
  if (!correct) return { points: 0, timeBonus: 0, streakBonus: 0, doubled: false, streak: 0 };
  const streak = streakBefore + 1;
  const timeBonus = Math.max(0, Math.min(QUESTION_TIME_SECONDS, Math.floor(secondsLeft)));
  const streakBonus = streak >= STREAK_FROM ? STREAK_BONUS : 0;
  const subtotal = CORRECT_POINTS + timeBonus + streakBonus;
  return {
    points: isFinal ? subtotal * 2 : subtotal,
    timeBonus,
    streakBonus,
    doubled: isFinal,
    streak,
  };
};
