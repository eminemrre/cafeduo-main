const memoryState = {
  users: [
    {
      id: 1,
      username: 'DemoUser',
      email: 'demo@cafe.com',
      password: '123',
      points: 1250,
      wins: 12,
      gamesPlayed: 25,
      department: 'Demo',
      role: 'user',
      isAdmin: false,
      cafe_id: null,
      table_number: null,
    },
  ],
  games: [
    {
      id: 1,
      hostName: 'GamerTr_99',
      gameType: 'Refleks Avı',
      points: 150,
      table: 'MASA04',
      status: 'waiting',
    },
  ],
  rewards: [
    {
      id: 9001,
      title: 'Bedava Filtre Kahve',
      cost: 500,
      description: 'Günün yorgunluğunu at.',
      icon: 'coffee',
      is_active: true,
    },
    {
      id: 9002,
      title: '%20 Hesap İndirimi',
      cost: 850,
      description: 'Tüm masada geçerli.',
      icon: 'discount',
      is_active: true,
    },
    {
      id: 9003,
      title: 'Cheesecake İkramı',
      cost: 400,
      description: 'Tatlı bir mola ver.',
      icon: 'dessert',
      is_active: true,
    },
    {
      id: 9004,
      title: 'Oyun Jetonu x5',
      cost: 100,
      description: 'Ekstra oyun hakkı.',
      icon: 'game',
      is_active: true,
    },
  ],
  items: [],
};

module.exports = memoryState;
