exports.up = (pgm) => {
  pgm.sql(`
    UPDATE games
    SET game_type = 'Nişancı Düellosu'
    WHERE game_type = 'Tank Düellosu'
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE games
    SET game_type = 'Tank Düellosu'
    WHERE game_type = 'Nişancı Düellosu'
  `);
};
