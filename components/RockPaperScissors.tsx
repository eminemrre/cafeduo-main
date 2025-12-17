import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Trophy, X } from 'lucide-react';

interface RockPaperScissorsProps {
    currentUser: User;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
}

type Choice = 'rock' | 'paper' | 'scissors' | null;

const CHOICES: Record<'rock' | 'paper' | 'scissors', { name: string; emoji: string }> = {
    rock: { name: 'TAŞ', emoji: '✊' },
    paper: { name: 'KAĞIT', emoji: '✋' },
    scissors: { name: 'MAKAS', emoji: '✌️' },
};

const getWinner = (p1: Choice, p2: Choice): 'p1' | 'p2' | 'draw' => {
    if (!p1 || !p2 || p1 === p2) return 'draw';
    if ((p1 === 'rock' && p2 === 'scissors') || (p1 === 'scissors' && p2 === 'paper') || (p1 === 'paper' && p2 === 'rock')) return 'p1';
    return 'p2';
};

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({ currentUser, isBot, onGameEnd, onLeave }) => {
    const [playerChoice, setPlayerChoice] = useState<Choice>(null);
    const [botChoice, setBotChoice] = useState<Choice>(null);
    const [playerScore, setPlayerScore] = useState(0);
    const [botScore, setBotScore] = useState(0);
    const [round, setRound] = useState(1);
    const [phase, setPhase] = useState<'select' | 'reveal'>('select');
    const [result, setResult] = useState('');
    const [gameOver, setGameOver] = useState(false);

    const MAX_ROUNDS = 5;
    const WIN_SCORE = 3;

    const handleChoice = (choice: Choice) => {
        if (phase !== 'select' || gameOver || !choice) return;

        const botPick = (['rock', 'paper', 'scissors'] as const)[Math.floor(Math.random() * 3)];
        setPlayerChoice(choice);
        setBotChoice(botPick);
        setPhase('reveal');

        const winner = getWinner(choice, botPick);
        let newPlayerScore = playerScore;
        let newBotScore = botScore;

        if (winner === 'p1') {
            newPlayerScore++;
            setPlayerScore(newPlayerScore);
            setResult(`🎉 ${CHOICES[choice].name} ${CHOICES[botPick].name}'ı yener!`);
        } else if (winner === 'p2') {
            newBotScore++;
            setBotScore(newBotScore);
            setResult(`💀 ${CHOICES[botPick].name} ${CHOICES[choice].name}'ı yener!`);
        } else {
            setResult('⚡ Berabere!');
        }

        setTimeout(() => {
            if (newPlayerScore >= WIN_SCORE || newBotScore >= WIN_SCORE || round >= MAX_ROUNDS) {
                setGameOver(true);
                const finalWinner = newPlayerScore > newBotScore ? currentUser.username : 'BOT';
                const points = newPlayerScore > newBotScore && !isBot ? 10 : 0;
                setTimeout(() => onGameEnd(finalWinner, points), 1500);
            } else {
                setPlayerChoice(null);
                setBotChoice(null);
                setRound(r => r + 1);
                setPhase('select');
                setResult('');
            }
        }, 1200);
    };

    return (
        <div className="flex flex-col items-center min-h-[450px] bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6">
            {/* Header */}
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">✊✋✌️</span>
                    <div>
                        <h2 className="text-white font-bold">Taş Kağıt Makas</h2>
                        <p className="text-gray-400 text-xs">Tur {round}/{MAX_ROUNDS}</p>
                    </div>
                </div>
                <button onClick={onLeave} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 p-2 rounded-lg">
                    <X size={18} />
                </button>
            </div>

            {/* Score */}
            <div className="w-full max-w-sm flex justify-between items-center bg-black/30 rounded-lg p-3 mb-4 border border-gray-700">
                <div className="text-center flex-1">
                    <div className="text-green-400 font-bold text-sm">{currentUser.username}</div>
                    <div className="text-3xl font-bold text-white">{playerScore}</div>
                </div>
                <div className="text-gray-600 font-bold">VS</div>
                <div className="text-center flex-1">
                    <div className="text-red-400 font-bold text-sm">BOT</div>
                    <div className="text-3xl font-bold text-white">{botScore}</div>
                </div>
            </div>

            {/* Choices Display */}
            <div className="flex justify-center items-center gap-8 mb-4 min-h-[100px]">
                <div className={`w-24 h-24 rounded-xl border-2 flex items-center justify-center text-5xl 
                    ${playerChoice ? 'border-green-500 bg-green-900/30' : 'border-gray-600 bg-gray-800/50'}`}>
                    {playerChoice ? CHOICES[playerChoice].emoji : '?'}
                </div>
                <span className="text-yellow-500 text-2xl">⚡</span>
                <div className={`w-24 h-24 rounded-xl border-2 flex items-center justify-center text-5xl 
                    ${botChoice ? 'border-red-500 bg-red-900/30' : 'border-gray-600 bg-gray-800/50'}`}>
                    {phase === 'reveal' && botChoice ? CHOICES[botChoice].emoji : '?'}
                </div>
            </div>

            {/* Result */}
            {result && <div className="text-xl font-bold text-white mb-4">{result}</div>}

            {/* Choice Buttons */}
            {phase === 'select' && !gameOver && (
                <div className="flex gap-3">
                    {(['rock', 'paper', 'scissors'] as const).map((c) => (
                        <button
                            key={c}
                            onClick={() => handleChoice(c)}
                            className="w-20 h-24 rounded-xl border-2 border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-white 
                                transition-all flex flex-col items-center justify-center gap-1 hover:scale-105"
                        >
                            <span className="text-4xl">{CHOICES[c].emoji}</span>
                            <span className="text-white text-xs font-bold">{CHOICES[c].name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Game Over */}
            {gameOver && (
                <div className="text-center mt-4">
                    <Trophy size={48} className={`mx-auto mb-2 ${playerScore > botScore ? 'text-yellow-500' : 'text-gray-500'}`} />
                    <h2 className={`text-2xl font-bold ${playerScore > botScore ? 'text-yellow-400' : 'text-red-400'}`}>
                        {playerScore > botScore ? '🎉 KAZANDIN!' : playerScore < botScore ? '💀 KAYBETTİN!' : '⚡ BERABERE!'}
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {playerScore > botScore && !isBot ? '+10 puan!' : 'Bir dahaki sefere!'}
                    </p>
                </div>
            )}

            {/* Bot Warning */}
            {isBot && !gameOver && (
                <div className="mt-4 text-xs text-gray-500 bg-black/30 px-3 py-1 rounded">
                    ⚠️ Bot oyunlarından puan kazanılmaz
                </div>
            )}
        </div>
    );
};
