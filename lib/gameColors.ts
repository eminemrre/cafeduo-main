/** Each game keeps its one colour everywhere (DESIGN.md): its chip in a lobby row
 * is the same fill as its toy and its sheet on the landing. */
export const gameChipFill = (gameType: string) => {
  if (gameType === 'Retro Satranç') return 'bg-candy-gok';
  if (gameType === 'Bilgi Yarışı') return 'bg-candy-limon';
  if (gameType === 'Nişancı Düellosu') return 'bg-candy-lokum';
  if (gameType === 'Amiral Battı') return 'bg-candy-deniz';
  if (gameType === 'Adam Asmaca') return 'bg-candy-lavanta';
  return 'bg-paper-dim';
};
