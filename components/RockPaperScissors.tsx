import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Hand, Scissors, FileText, Trophy, RotateCcw, X, Zap } from 'lucide-react';

interface RockPaperScissorsProps {
    currentUser: User;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
}

type Choice = 'rock' | 'paper' | 'scissors' | null;

const CHOICES = {
    rock: { name: 'TAŞ', emoji: '✊', icon: Hand, color: 'from-orange-600 to-orange-800' },
    paper: { name: 'KAĞIT', emoji: '✋', icon: FileText, color: 'from-blue-600 to-blue-800' },
    scissors: { name: 'MAKAS', emoji: '✌️', icon: Scissors, color: 'from-purple-600 to-purple-800' },
};

const getWinner = (p1: Choice, p2: Choice): 'p1' | 'p2' | 'draw' => {
    if (!p1 || !p2) return 'draw';
    if (p1 === p2) return 'draw';
    if (
        (p1 === 'rock' && p2 === 'scissors') ||
        (p1 === 'scissors' && p2 === 'paper') ||
        (p1 === 'paper' && p2 === 'rock')
    ) {
        return 'p1';
    }
    return 'p2';
};

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
    currentUser,
    isBot,
    onGameEnd,
    onLeave,
}) => {
    const [playerChoice, setPlayerChoice] = useState<Choice>(null);
    const [botChoice, setBotChoice] = useState<Choice>(null);
    const [playerScore, setPlayerScore] = useState(0);
    const [botScore, setBotScore] = useState(0);
    const [round, setRound] = useState(1);
    const [phase, setPhase] = useState<'select' | 'reveal' | 'result'>('select');
    const [roundResult, setRoundResult] = useState<string>('');
    const [gameOver, setGameOver] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    const MAX_ROUNDS = 5;
    const WIN_SCORE = 3;

    // Countdown animation
    useEffect(() => {
        if (countdown === null) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 500);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            revealChoices();
        }
    }, [countdown]);

    const handleChoice = (choice: Choice) => {
        if (phase !== 'select' || gameOver) return;

        setPlayerChoice(choice);

        // Bot makes random choice
        const choices: Choice[] = ['rock', 'paper', 'scissors'];
        const randomChoice = choices[Math.floor(Math.random() * 3)];
        setBotChoice(randomChoice);

        // Start countdown
        setCountdown(3);
        setPhase('reveal');
    };

    const revealChoices = () => {
        if (!playerChoice || !botChoice) return;

        const result = getWinner(playerChoice, botChoice);

        if (result === 'p1') {
            setPlayerScore(s => s + 1);
            setRoundResult(`🎉 ${CHOICES[playerChoice].name} ${CHOICES[botChoice].name}'ı yener!`);
        } else if (result === 'p2') {
            setBotScore(s => s + 1);
            setRoundResult(`💀 ${CHOICES[botChoice].name} ${CHOICES[playerChoice].name}'ı yener!`);
        } else {
            setRoundResult('⚡ Berabere!');
        }

        setPhase('result');

        // Check for game over
        setTimeout(() => {
            const newPlayerScore = result === 'p1' ? playerScore + 1 : playerScore;
            const newBotScore = result === 'p2' ? botScore + 1 : botScore;

            if (newPlayerScore >= WIN_SCORE || newBotScore >= WIN_SCORE || round >= MAX_ROUNDS) {
                setGameOver(true);
                const winner = newPlayerScore > newBotScore ? currentUser.username : 'BOT';
                const points = newPlayerScore > newBotScore ? (isBot ? 0 : 10) : 0;

                setTimeout(() => {
                    onGameEnd(winner, points);
                }, 2000);
            } else {
                // Next round
                setTimeout(() => {
                    setPlayerChoice(null);
                    setBotChoice(null);
                    setRound(r => r + 1);
                    setPhase('select');
                    setRoundResult('');
                    setCountdown(null);
                }, 1500);
            }
        }, 1000);
    };

    const handleLeave = () => {
        onLeave();
    };

    return (
        <div className="flex flex-col items-center min-h-[500px] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-xl p-6 relative overflow-hidden">
            {/* Background Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>

            {/* Header */}
            <div className="relative z-10 w-full flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="text-3xl">✊✋✌️</div>
                    <div>
                        <h2 className="text-white font-bold text-lg">Taş Kağıt Makas</h2>
                        <p className="text-gray-400 text-sm">Tur {round}/{MAX_ROUNDS}</p>
                    </div>
                </div>
                <button
                    onClick={handleLeave}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-2 rounded-lg transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Score Board */}
            <div className="relative z-10 w-full max-w-md flex justify-between items-center bg-black/40 rounded-xl p-4 mb-6 border border-gray-700">
                <div className="text-center flex-1">
                    <div className="text-green-400 font-bold text-lg">{currentUser.username}</div>
                    <div className="text-4xl font-bold text-white">{playerScore}</div>
                </div>
                <div className="text-gray-500 text-2xl font-bold px-4">VS</div>
                <div className="text-center flex-1">
                    <div className="text-red-400 font-bold text-lg">BOT</div>
                    <div className="text-4xl font-bold text-white">{botScore}</div>
                </div>
            </div>

            {/* Countdown Display */}
            {countdown !== null && countdown > 0 && (
                <div className="relative z-10 absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-8xl font-bold text-yellow-400 animate-pulse">
                        {countdown}
                    </div>
                </div>
            )}

            {/* Choice Display Area */}
            <div className="relative z-10 flex justify-center items-center gap-16 mb-8 min-h-[150px]">
                {/* Player Choice */}
                <div className={`w-32 h-32 rounded-2xl border-4 flex items-center justify-center transition-all duration-300
                    ${playerChoice ? `bg-gradient-to-br ${CHOICES[playerChoice].color} border-green-500` : 'border-gray-600 bg-gray-800/50'}`}
                >
                    {playerChoice ? (
                        <span className="text-6xl">{CHOICES[playerChoice].emoji}</span>
                    ) : (
                        <span className="text-gray-500 text-5xl">?</span>
                    )}
                </div>

                {/* VS Icon */}
                <Zap size={40} className="text-yellow-500" />

                {/* Bot Choice */}
                <div className={`w-32 h-32 rounded-2xl border-4 flex items-center justify-center transition-all duration-300
                    ${phase === 'result' && botChoice ? `bg-gradient-to-br ${CHOICES[botChoice].color} border-red-500` : 'border-gray-600 bg-gray-800/50'}`}
                >
                    {phase === 'result' && botChoice ? (
                        <span className="text-6xl">{CHOICES[botChoice].emoji}</span>
                    ) : phase === 'reveal' ? (
                        <span className="text-5xl animate-spin">🔄</span>
                    ) : (
                        <span className="text-gray-500 text-5xl">?</span>
                    )}
                </div>
            </div>

            {/* Round Result */}
            {roundResult && (
                <div className="relative z-10 text-2xl font-bold text-white mb-6 animate-bounce">
                    {roundResult}
                </div>
            )}

            {/* Choice Buttons */}
            {phase === 'select' && !gameOver && (
                <div className="relative z-10 flex gap-4">
                    {(['rock', 'paper', 'scissors'] as Choice[]).map((choice) => (
                        <button
                            key={choice}
                            onClick={() => handleChoice(choice)}
                            className={`w-28 h-36 rounded-2xl border-4 border-gray-600 bg-gradient-to-br ${CHOICES[choice!].color} 
                                hover:scale-110 hover:border-white transition-all duration-200 flex flex-col items-center justify-center gap-2
                                shadow-lg hover:shadow-xl`}
                        >
                            <span className="text-5xl">{CHOICES[choice!].emoji}</span>
                            <span className="text-white font-bold text-sm">{CHOICES[choice!].name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Game Over */}
            {gameOver && (
                <div className="relative z-10 text-center animate-fade-in">
                    <Trophy size={64} className={`mx-auto mb-4 ${playerScore > botScore ? 'text-yellow-500' : 'text-gray-500'}`} />
                    <h2 className={`text-3xl font-bold mb-2 ${playerScore > botScore ? 'text-yellow-400' : 'text-red-400'}`}>
                        {playerScore > botScore ? '🎉 KAZANDIN!' : playerScore < botScore ? '💀 KAYBETTİN!' : '⚡ BERABERE!'}
                    </h2>
                    <p className="text-gray-400 mb-6">
                        {playerScore > botScore
                            ? (isBot ? 'Bot oyunu - puan yok!' : '+10 puan kazandın!')
                            : 'Bir dahaki sefere!'}
                    </p>
                </div>
            )}

            {/* Bot Warning */}
            {isBot && !gameOver && (
                <div className="relative z-10 mt-4 text-center text-xs text-gray-500 bg-black/40 px-4 py-2 rounded">
                    ⚠️ Bot ile oynanan oyunlardan puan kazanılmaz
                </div>
            )}
        </div>
    );
};
