import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { socketService } from '../lib/socket';
import { playGameSfx } from '../lib/gameAudio';

interface MemoryDuelProps {
    currentUser: User;
    gameId: string | number | null;
    opponentName?: string;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
}

const EMOJIS = ['🚀', '🛸', '👾', '🎮', '⚡', '🔮', '🎲', '🏆'];

interface CardObj {
    id: number;
    emoji: string;
    flippedBy: string | null;
    matchedBy: string | null;
}

export const MemoryDuel: React.FC<MemoryDuelProps> = ({
    currentUser,
    gameId,
    opponentName,
    isBot,
    onGameEnd,
    onLeave,
}) => {
    const [cards, setCards] = useState<CardObj[]>([]);
    const [playerScore, setPlayerScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('Kartları eşleştir!');
    const [resolvingMatch, setResolvingMatch] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);

    const target = opponentName || 'Rakip';
    const finishHandledRef = useRef(false);
    const matchStartedAtRef = useRef(Date.now());

    const isHostRef = useRef<boolean>(false);
    const lockRef = useRef<boolean>(false); // Prevent clicking during local validation

    // Game Setup & Synchronization
    useEffect(() => {
        let mounted = true;

        const initCards = () => {
            const deck = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
            return deck.map((emoji, idx) => ({
                id: idx,
                emoji,
                flippedBy: null,
                matchedBy: null
            }));
        };

        const fetchGameRole = async () => {
            if (!gameId || isBot) {
                setCards(initCards());
                setIsReady(true);
                return;
            }

            try {
                const snapshot = await api.games.get(gameId);
                const hostName = typeof snapshot === 'object' && snapshot !== null && 'hostName' in snapshot
                    ? String(snapshot.hostName)
                    : '';

                isHostRef.current = hostName === currentUser.username;

                if (isHostRef.current) {
                    // Host generates and broadcasts the initial board
                    const initialCards = initCards();
                    setCards(initialCards);
                    setIsReady(true);
                    // Wait a bit for guest to be connected
                    setTimeout(() => {
                        socketService.emitMove(String(gameId), { action: 'init_board', board: initialCards });
                    }, 500);
                } else {
                    setMessage('Kurucunun kartları dağıtması bekleniyor...');
                }
            } catch (err) {
                console.error('Failed to fetch game details', err);
                setCards(initCards());
                setIsReady(true);
            }
        };

        void fetchGameRole();
        return () => { mounted = false; };
    }, [gameId, isBot, currentUser.username]);

    useEffect(() => {
        const socket = socketService.getSocket();
        const handleMove = (payload: any) => {
            if (String(payload?.gameId) !== String(gameId)) return;

            const move = payload?.move;
            const player = payload?.player;
            if (!move) return;

            if (move.action === 'init_board') {
                if (!isHostRef.current) {
                    setCards(move.board);
                    setIsReady(true);
                    setMessage('Kartlar dağıtıldı, başla!');
                }
            } else if (move.action === 'flip') {
                if (player !== currentUser.username) {
                    flipCardInternal(move.index, player, true);
                }
            } else if (move.action === 'unflip') {
                if (player !== currentUser.username) {
                    unflipCardsInternal(move.indices, true);
                }
            } else if (move.action === 'match') {
                if (player !== currentUser.username) {
                    matchCardsInternal(move.indices, player, true);
                }
            }
        };

        socket.on('opponent_move', handleMove);
        return () => { socket.off('opponent_move', handleMove); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    const checkGameOver = useCallback(async (currentCards: CardObj[], pScore: number, oScore: number) => {
        if (currentCards.every(c => c.matchedBy !== null) && !done) {
            setDone(true);
            const localWinner = pScore > oScore ? currentUser.username : (oScore > pScore ? target : 'Berabere');
            const isDraw = pScore === oScore;

            if (isBot) {
                setMessage(isDraw ? 'Berabere!' : (pScore > oScore ? 'Kazandın!' : 'Kaybettin!'));
                setTimeout(() => onGameEnd(localWinner, pScore > oScore ? 10 : 0), 1000);
                return;
            }

            setResolvingMatch(true);
            setMessage('Oyun bitti, sonuçlar kaydediliyor...');

            try {
                if (gameId) {
                    await api.games.move(gameId, {
                        liveSubmission: {
                            mode: 'Neon Hafıza',
                            score: pScore,
                            roundsWon: pScore,
                            round: 1,
                            done: true,
                            submissionKey: `memory|${String(gameId)}|${currentUser.username}|1|${pScore}|1`,
                        },
                    });
                }

                const { winner, finished } = await submitScoreAndWaitForWinner({
                    gameId,
                    username: currentUser.username,
                    score: pScore,
                    roundsWon: pScore,
                    durationMs: Math.max(1, Date.now() - matchStartedAtRef.current),
                });

                if (!finished) {
                    finishHandledRef.current = true;
                    setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
                    return;
                }

                const resolvedWinner = winner || 'Berabere';
                const points = winner === currentUser.username ? 10 : 0;
                setMessage(!winner ? 'Berabere tamamlandı.' : (points > 0 ? 'Kazandın!' : 'Kaybettin!'));

                finishHandledRef.current = true;
                setTimeout(() => onGameEnd(resolvedWinner, points), 1000);
            } catch (e) {
                setMessage('Bağlantı sorunu: Sonuç kaydedilemedi.');
                setTimeout(() => onGameEnd('Hata', 0), 1000);
            }
        }
    }, [currentUser.username, target, isBot, done, gameId, onGameEnd]);

    // Internal state mutators for opponent syncing
    const flipCardInternal = (index: number, byPlayer: string, isSilent = false) => {
        if (!isSilent) playGameSfx('select', 0.2);
        setCards(prev => {
            const next = [...prev];
            next[index] = { ...next[index], flippedBy: byPlayer };
            return next;
        });
    };

    const unflipCardsInternal = (indices: number[], isSilent = false) => {
        setCards(prev => {
            const next = [...prev];
            indices.forEach(idx => {
                next[idx] = { ...next[idx], flippedBy: null };
            });
            return next;
        });
    };

    const matchCardsInternal = (indices: number[], byPlayer: string, isSilent = false) => {
        if (!isSilent) playGameSfx('success', 0.3);
        setCards(prev => {
            const next = [...prev];
            indices.forEach(idx => {
                next[idx] = { ...next[idx], matchedBy: byPlayer, flippedBy: null };
            });
            return next;
        });
        if (byPlayer === currentUser.username) {
            setPlayerScore(prev => {
                const newScore = prev + 1;
                // Use functional update to get accurate scores
                setCards(currentCards => {
                    const allMatched = currentCards.every(c => c.matchedBy !== null);
                    if (allMatched) {
                        checkGameOver(currentCards, newScore, opponentScore);
                    }
                    return currentCards;
                });
                return newScore;
            });
            setMessage('Eşleşme buldun!');
        } else {
            setOpponentScore(prev => {
                const newScore = prev + 1;
                setCards(currentCards => {
                    const allMatched = currentCards.every(c => c.matchedBy !== null);
                    if (allMatched) {
                        checkGameOver(currentCards, playerScore, newScore);
                    }
                    return currentCards;
                });
                return newScore;
            });
            setMessage(`${target} eşleşme buldu!`);
        }
    };

    // Local interaction handler
    const handleCardClick = (index: number) => {
        if (done || !isReady || resolvingMatch || lockRef.current) return;
        const card = cards[index];
        if (card.flippedBy || card.matchedBy) return; // Already flipped or matched

        const myFlipped = cards.map((c, i) => c.flippedBy === currentUser.username ? i : -1).filter(i => i !== -1);
        if (myFlipped.length >= 2) return; // Can't flip more than 2

        // Flip it
        flipCardInternal(index, currentUser.username);
        if (gameId && !isBot) {
            socketService.emitMove(String(gameId), { action: 'flip', index });
        }

        const activeFlipped = [...myFlipped, index];
        if (activeFlipped.length === 2) {
            lockRef.current = true;
            const [idx1, idx2] = activeFlipped;
            const card1 = cards[idx1];
            // card2 is the current one we just added locally, wait for state to update? 
            // We can use the data we have since state updates are batched, `cards[index].emoji` is accessible.
            const card2 = cards[index];

            if (card1.emoji === card2.emoji) {
                // Match!
                setTimeout(() => {
                    matchCardsInternal(activeFlipped, currentUser.username);
                    if (gameId && !isBot) {
                        socketService.emitMove(String(gameId), { action: 'match', indices: activeFlipped });
                    }
                    lockRef.current = false;
                }, 400); // Short delay for visual polish
            } else {
                // No Match
                setTimeout(() => {
                    unflipCardsInternal(activeFlipped);
                    if (gameId && !isBot) {
                        socketService.emitMove(String(gameId), { action: 'unflip', indices: activeFlipped });
                    }
                    lockRef.current = false;
                    // In bot mode, let bot take a turn after player fails
                    if (isBot) {
                        setIsPlayerTurn(false);
                        setTimeout(() => botTurn(), 600);
                    }
                }, 1000);
            }
        }
    };

    // Bot AI: pick two random unmatched cards
    const botTurn = useCallback(() => {
        if (done || !isBot) return;
        setMessage(`${target} düşünüyor...`);

        setTimeout(() => {
            setCards(currentCards => {
                const unmatchedIndices = currentCards
                    .map((c, i) => c.matchedBy === null ? i : -1)
                    .filter(i => i !== -1);

                if (unmatchedIndices.length < 2) return currentCards;

                // Shuffle and pick two
                const shuffled = [...unmatchedIndices].sort(() => Math.random() - 0.5);
                const idx1 = shuffled[0];
                const idx2 = shuffled[1];

                // Flip first card
                const next1 = [...currentCards];
                next1[idx1] = { ...next1[idx1], flippedBy: target };

                // Schedule second flip
                setTimeout(() => {
                    setCards(prev => {
                        const next2 = [...prev];
                        next2[idx2] = { ...next2[idx2], flippedBy: target };
                        return next2;
                    });

                    // Check match
                    setTimeout(() => {
                        const card1 = currentCards[idx1];
                        const card2 = currentCards[idx2];

                        if (card1.emoji === card2.emoji) {
                            matchCardsInternal([idx1, idx2], target, true);
                            playGameSfx('fail', 0.2);
                            setMessage(`${target} eşleşme buldu!`);
                            // Bot gets another turn on match
                            setCards(latest => {
                                const still = latest.filter(c => c.matchedBy === null).length;
                                if (still >= 2) {
                                    setTimeout(() => botTurn(), 800);
                                }
                                return latest;
                            });
                        } else {
                            unflipCardsInternal([idx1, idx2], true);
                            setMessage('Rakip ıskaladı! Senin sıran.');
                        }
                        setIsPlayerTurn(true);
                    }, 800);
                }, 600);

                return next1;
            });
        }, 500);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done, isBot, target]);

    return (
        <div className="max-w-xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white relative overflow-hidden" data-testid="memory-duel">
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_95%,rgba(34,211,238,0.09)_100%)] [background-size:100%_4px] opacity-60" />

            <div className="relative z-10">
                <div className="rf-terminal-strip mb-2">Sistem TR-X // Hafıza Matrisi</div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] leading-none">
                        Neon Hafıza
                    </h2>
                    <button
                        onClick={onLeave}
                        className="text-rose-200 hover:text-rose-100 text-xs px-3 py-2 border border-rose-400/45 bg-rose-500/12 hover:bg-rose-500/24 transition-colors uppercase tracking-[0.16em]"
                    >
                        Oyundan Çık
                    </button>
                </div>

                {/* Scoreboard */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-center">
                    <div className="rf-screen-card-muted p-3">
                        <div className="text-xs text-[var(--rf-muted)] mb-1">Sen</div>
                        <div className="font-pixel text-3xl text-cyan-300">
                            {playerScore}
                        </div>
                    </div>
                    <div className="rf-screen-card-muted p-3">
                        <div className="text-xs text-[var(--rf-muted)] mb-1">{target}</div>
                        <div className="font-pixel text-3xl text-pink-400">
                            {opponentScore}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-center text-cyan-200/80 mb-6 min-h-[1.5rem] tracking-wider pl-3 border-l-2 border-cyan-400/55">{message}</p>

                {/* Board */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 perspective-1000 mb-6">
                    {cards.map((card, idx) => {
                        const myFlipped = card.flippedBy === currentUser.username;
                        const opponentFlipped = card.flippedBy && card.flippedBy !== currentUser.username;
                        const isMatched = card.matchedBy !== null;

                        const isVisible = myFlipped || opponentFlipped || isMatched;
                        const borderColor = isMatched
                            ? (card.matchedBy === currentUser.username ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]')
                            : (myFlipped ? 'border-cyan-300' : (opponentFlipped ? 'border-pink-400' : 'border-cyan-800/40 hover:border-cyan-500/50'));

                        const opacity = isMatched ? 'opacity-50 scale-95' : 'opacity-100';

                        return (
                            <button
                                key={idx}
                                onClick={() => handleCardClick(idx)}
                                disabled={!isReady || done}
                                className={`relative aspect-square bg-[#040a16] border-2 ${borderColor} ${opacity} transition-all duration-300 transform-gpu preserve-3d cursor-pointer focus:outline-none`}
                            >
                                <div className={`absolute inset-0 backface-hidden flex items-center justify-center text-3xl sm:text-4xl transition-transform duration-500 ${isVisible ? '[transform:rotateY(180deg)]' : ''}`}>
                                    {/* Back of card */}
                                    <div className="w-full h-full bg-[linear-gradient(45deg,rgba(34,211,238,0.05)_25%,transparent_25%,transparent_50%,rgba(34,211,238,0.05)_50%,rgba(34,211,238,0.05)_75%,transparent_75%,transparent_100%)] [background-size:20px_20px]" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 font-pixel text-cyan-800 text-xs">?</div>
                                </div>

                                <div className={`absolute inset-0 backface-hidden flex items-center justify-center text-4xl sm:text-5xl bg-[#0a1732] transition-transform duration-500 ${isVisible ? '' : '[transform:rotateY(-180deg)]'}`}>
                                    {/* Front of card */}
                                    <span className={isMatched ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110 transition-transform' : ''}>
                                        {card.emoji}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {done && (
                    <div className="flex justify-center mt-4">
                        <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
                    </div>
                )}
            </div>
        </div>
    );
};
