// Firestore Initial Data Seed Script
// Run this once to populate Firestore with initial data

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with project ID (no service account needed for emulator)
// For production, you'll need a service account key
initializeApp({
    projectId: 'cafeduo'
});

const db = getFirestore();

async function seedDatabase() {
    console.log('🔥 Starting Firestore seed...\n');

    // 1. SEED CAFES
    console.log('📍 Creating cafes...');
    const cafes = [
        {
            id: 'iibf-kantin',
            name: 'İİBF Kantini',
            daily_pin: '1234',
            table_count: 20,
            latitude: 37.7749,
            longitude: 29.0875,
            radius: 100
        },
        {
            id: 'muhendislik-kantin',
            name: 'Mühendislik Kantini',
            daily_pin: '5678',
            table_count: 15,
            latitude: 37.7755,
            longitude: 29.0880,
            radius: 100
        },
        {
            id: 'merkez-kantin',
            name: 'Merkez Kantin',
            daily_pin: '9999',
            table_count: 30,
            latitude: 37.7760,
            longitude: 29.0885,
            radius: 150
        }
    ];

    for (const cafe of cafes) {
        await db.collection('cafes').doc(cafe.id).set({
            name: cafe.name,
            daily_pin: cafe.daily_pin,
            table_count: cafe.table_count,
            latitude: cafe.latitude,
            longitude: cafe.longitude,
            radius: cafe.radius,
            createdAt: new Date()
        });
        console.log(`  ✅ ${cafe.name} created`);
    }

    // 2. SEED REWARDS
    console.log('\n🎁 Creating rewards...');
    const rewards = [
        {
            id: 'reward-coffee',
            title: 'Bedava Kahve',
            cost: 100,
            type: 'coffee',
            icon: '☕',
            description: 'Herhangi bir kahve bedava!'
        },
        {
            id: 'reward-discount',
            title: '%20 İndirim',
            cost: 50,
            type: 'discount',
            icon: '🏷️',
            description: 'Tüm siparişlerde %20 indirim'
        },
        {
            id: 'reward-dessert',
            title: 'Bedava Tatlı',
            cost: 150,
            type: 'dessert',
            icon: '🍰',
            description: 'Seçtiğin bir tatlı bedava!'
        },
        {
            id: 'reward-sandwich',
            title: 'Bedava Sandviç',
            cost: 200,
            type: 'food',
            icon: '🥪',
            description: 'Günün sandviçi bedava!'
        }
    ];

    for (const reward of rewards) {
        await db.collection('rewards').doc(reward.id).set({
            title: reward.title,
            cost: reward.cost,
            type: reward.type,
            icon: reward.icon,
            description: reward.description,
            createdAt: new Date()
        });
        console.log(`  ✅ ${reward.title} created`);
    }

    console.log('\n✨ Seed complete!\n');
    console.log('Test PINs:');
    console.log('  İİBF Kantini: 1234');
    console.log('  Mühendislik Kantini: 5678');
    console.log('  Merkez Kantin: 9999');

    process.exit(0);
}

seedDatabase().catch(console.error);
