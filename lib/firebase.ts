// Firebase Configuration for CafeDuo
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, getDocsFromServer, getDocFromServer, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBBKBSFao0GwRPyJhEUPOp2EB-UmBJyWsQ",
    authDomain: "cafeduo.firebaseapp.com",
    projectId: "cafeduo",
    storageBucket: "cafeduo.firebasestorage.app",
    messagingSenderId: "943680554772",
    appId: "1:943680554772:web:5b0275a54bdb726d89a401",
    measurementId: "G-VR5GE64001"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const googleProvider = new GoogleAuthProvider();

// Force enable network on startup
if (typeof window !== 'undefined') {
    enableNetwork(db).then(() => {
        console.log('Firestore network enabled');
    }).catch((err) => {
        console.warn('Firestore network enable failed:', err);
    });
}

// ====================
// AUTH FUNCTIONS
// ====================

export const firebaseAuth = {
    // Email/Password Sign Up
    register: async (email: string, password: string, username: string): Promise<any> => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            id: user.uid,
            email,
            username,
            points: 0,
            wins: 0,
            gamesPlayed: 0,
            role: 'user',
            isAdmin: false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });

        return await firebaseAuth.getUserData(user.uid);
    },

    // Email/Password Sign In
    login: async (email: string, password: string): Promise<any> => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        try {
            // Try to get user data from Firestore
            let userData = await firebaseAuth.getUserData(uid);

            // If user doesn't exist in Firestore, create it
            if (!userData) {
                console.log('User not found in Firestore, creating...');
                await setDoc(doc(db, 'users', uid), {
                    id: uid,
                    email: userCredential.user.email,
                    username: userCredential.user.email?.split('@')[0] || 'user',
                    points: 0,
                    wins: 0,
                    gamesPlayed: 0,
                    role: 'user',
                    isAdmin: false,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });
                userData = await firebaseAuth.getUserData(uid);
            } else {
                // Update last login
                await updateDoc(doc(db, 'users', uid), {
                    lastLogin: serverTimestamp()
                });
            }

            return userData;
        } catch (firestoreError: any) {
            console.error('Firestore error during login:', firestoreError);
            // Return basic user data from Auth if Firestore fails
            return {
                id: uid,
                email: userCredential.user.email,
                username: userCredential.user.email?.split('@')[0] || 'user',
                points: 0,
                wins: 0,
                gamesPlayed: 0,
                role: 'user',
                isAdmin: false
            };
        }
    },

    // Google Sign In
    googleLogin: async (): Promise<any> => {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Check if user exists
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
            // Create new user
            await setDoc(doc(db, 'users', user.uid), {
                id: user.uid,
                email: user.email,
                username: user.displayName || user.email?.split('@')[0],
                points: 0,
                wins: 0,
                gamesPlayed: 0,
                role: 'user',
                isAdmin: false,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
        } else {
            // Update last login
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            });
        }

        return await firebaseAuth.getUserData(user.uid);
    },

    // Sign Out
    logout: async (): Promise<void> => {
        await signOut(auth);
    },

    // Get User Data
    getUserData: async (uid: string): Promise<any> => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return { id: uid, ...userDoc.data() };
        }
        return null;
    },

    // Get current user
    getCurrentUser: () => auth.currentUser,

    // Auth state listener
    onAuthStateChanged: (callback: (user: any) => void) => {
        return auth.onAuthStateChanged(callback);
    }
};

// ====================
// USERS FUNCTIONS
// ====================

export const firebaseUsers = {
    get: async (uid: string) => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        return userDoc.exists() ? { id: uid, ...userDoc.data() } : null;
    },

    update: async (uid: string, data: any) => {
        await updateDoc(doc(db, 'users', uid), data);
        return await firebaseUsers.get(uid);
    },

    getAll: async () => {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    getLeaderboard: async (limit = 10) => {
        const q = query(collection(db, 'users'), orderBy('points', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.slice(0, limit).map(doc => ({ id: doc.id, ...doc.data() }));
    }
};

// ====================
// CAFES FUNCTIONS
// ====================

// Hardcoded fallback data for when Firestore is unavailable
const FALLBACK_CAFES = [
    { id: 'iibf-kantin', name: 'İİBF Kantini', daily_pin: '1234', table_count: 20 },
    { id: 'merkez-kantin', name: 'Merkez Kantin', daily_pin: '9999', table_count: 30 },
    { id: 'muhendislik-kantin', name: 'Mühendislik Kantini', daily_pin: '5678', table_count: 15 }
];

export const firebaseCafes = {
    getAll: async () => {
        try {
            console.log('Fetching cafes from Firestore...');
            const cafesRef = collection(db, 'cafes');
            const snapshot = await getDocs(cafesRef);

            if (snapshot.empty) {
                console.log('Firestore returned empty, using fallback data');
                return FALLBACK_CAFES;
            }

            const cafes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Loaded cafes from Firestore:', cafes.length);
            return cafes;
        } catch (error: any) {
            console.warn('Firestore error, using fallback data:', error.message);
            return FALLBACK_CAFES;
        }
    },

    get: async (cafeId: string) => {
        const cafeDoc = await getDoc(doc(db, 'cafes', cafeId));
        return cafeDoc.exists() ? { id: cafeId, ...cafeDoc.data() } : null;
    },

    checkIn: async (userId: string, cafeId: string, tableNumber: number, pin: string) => {
        const cafe: any = await firebaseCafes.get(cafeId);
        if (!cafe) throw new Error('Kafe bulunamadı');
        if (cafe.daily_pin !== pin) throw new Error('Geçersiz PIN kodu');

        // Update user's cafe_id
        await updateDoc(doc(db, 'users', userId), {
            cafe_id: cafeId,
            table_number: `MASA${tableNumber}`,
            cafe_name: cafe.name
        });

        return { success: true, cafeName: cafe.name, table: `MASA${tableNumber}` };
    },

    updatePin: async (cafeId: string, pin: string) => {
        await updateDoc(doc(db, 'cafes', cafeId), { daily_pin: pin });
        return { success: true };
    },

    create: async (data: any) => {
        const docRef = await addDoc(collection(db, 'cafes'), {
            ...data,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, ...data };
    }
};

// ====================
// GAMES FUNCTIONS (with Realtime)
// ====================

export const firebaseGames = {
    getAll: async () => {
        const q = query(collection(db, 'games'), where('status', '==', 'waiting'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    get: async (gameId: string) => {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        return gameDoc.exists() ? { id: gameId, ...gameDoc.data() } : null;
    },

    create: async (data: any) => {
        const docRef = await addDoc(collection(db, 'games'), {
            ...data,
            status: 'waiting',
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, ...data, status: 'waiting' };
    },

    join: async (gameId: string, guestName: string) => {
        await updateDoc(doc(db, 'games', gameId), {
            guestName,
            status: 'playing'
        });
    },

    updateState: async (gameId: string, gameState: any) => {
        await updateDoc(doc(db, 'games', gameId), { gameState });
    },

    finish: async (gameId: string, winner: string) => {
        await updateDoc(doc(db, 'games', gameId), {
            winner,
            status: 'finished',
            finishedAt: serverTimestamp()
        });
    },

    delete: async (gameId: string) => {
        await deleteDoc(doc(db, 'games', gameId));
    },

    // REALTIME: Listen to game changes
    onGameChange: (gameId: string, callback: (game: any) => void) => {
        return onSnapshot(doc(db, 'games', gameId), (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() });
            }
        });
    },

    // REALTIME: Listen to lobby changes
    onLobbyChange: (callback: (games: any[]) => void) => {
        const q = query(collection(db, 'games'), where('status', '==', 'waiting'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(games);
        });
    }
};

// ====================
// REWARDS FUNCTIONS
// ====================

export const firebaseRewards = {
    getAll: async () => {
        const snapshot = await getDocs(collection(db, 'rewards'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    buy: async (userId: string, rewardId: string) => {
        const user: any = await firebaseUsers.get(userId);
        const rewardDoc = await getDoc(doc(db, 'rewards', rewardId));

        if (!rewardDoc.exists()) throw new Error('Ödül bulunamadı');
        const reward: any = rewardDoc.data();

        if (!user || user.points < reward.cost) throw new Error('Yetersiz puan');

        // Deduct points
        await updateDoc(doc(db, 'users', userId), {
            points: user.points - reward.cost
        });

        // Add to user's items
        await addDoc(collection(db, 'users', userId, 'items'), {
            rewardId,
            redeemedAt: serverTimestamp(),
            ...reward
        });

        return { success: true, newPoints: user.points - reward.cost };
    },

    getUserItems: async (userId: string) => {
        const snapshot = await getDocs(collection(db, 'users', userId, 'items'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
};

// Export instances
export { app, auth, db, analytics };
