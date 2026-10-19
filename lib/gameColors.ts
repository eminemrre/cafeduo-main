/** Each game keeps its one colour everywhere (DESIGN.md): its chip in a lobby row
 * is the same fill as its toy and its sheet on the landing. */
export const gameChipFill = (gameType: string) => {
  if (gameType === 'Retro Satranç') return 'bg-riso-blue';
  if (gameType === 'Bilgi Yarışı') return 'bg-riso-mustard';
  if (gameType === 'Nişancı Düellosu') return 'bg-riso-pink';
  return 'bg-paper-dim';
};
