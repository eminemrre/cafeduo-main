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
  rewards: [],
  items: [],
};

module.exports = memoryState;
