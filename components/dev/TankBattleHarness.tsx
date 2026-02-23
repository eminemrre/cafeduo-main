import React, { useMemo, useState } from 'react';
import { TankBattle } from '../TankBattle';
import type { User } from '../../types';

const HARNESS_USER: User = {
  id: 'dev-harness',
  username: 'harness_player',
  email: 'harness@cafeduo.local',
  points: 0,
  wins: 0,
  gamesPlayed: 0,
  role: 'user',
};

export const TankBattleHarness: React.FC = () => {
  const [result, setResult] = useState<{ winner: string; points: number } | null>(null);
  const [instanceKey, setInstanceKey] = useState(0);
  const gameId = useMemo(() => `dev-tank-${instanceKey}`, [instanceKey]);

  return (
    <div className="min-h-screen rf-page-shell noise-bg text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="rf-screen-card p-5 mb-4">
          <p className="rf-terminal-strip mb-2">Develop Web Game Harness</p>
          <h1 className="font-display-tr text-3xl tracking-[0.08em]">Tank Battle Test Harness</h1>
          <p className="text-sm text-[var(--rf-muted)] mt-2">
            Bu ekran `develop-web-game` skill Playwright döngüsü için ayrılmıştır.
          </p>
          {result && (
            <p className="mt-3 text-sm text-cyan-200">
              Sonuç: <span className="text-white font-semibold">{result.winner}</span> ({result.points} puan)
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setInstanceKey((prev) => prev + 1);
            }}
            className="mt-4 px-4 py-2 text-sm border border-cyan-400/45 bg-cyan-900/25 hover:bg-cyan-800/35 transition-colors uppercase tracking-[0.1em]"
          >
            Maçı Sıfırla
          </button>
        </div>

        <TankBattle
          key={gameId}
          currentUser={HARNESS_USER}
          gameId={gameId}
          opponentName="BOT"
          isBot={true}
          onGameEnd={(winner, points) => setResult({ winner, points })}
          onLeave={() => {
            setResult(null);
            setInstanceKey((prev) => prev + 1);
          }}
        />
      </div>
    </div>
  );
};

export default TankBattleHarness;
