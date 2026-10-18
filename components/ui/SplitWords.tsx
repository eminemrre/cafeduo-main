import React from 'react';

/**
 * Wraps each word in a clipping mask so CSS can raise the words one after another.
 * The words stay real text separated by real spaces: the accessible name, text
 * selection and `toHaveTextContent` read exactly as the plain string would.
 * `start` continues the stagger index across several SplitWords in one heading.
 */
export const SplitWords: React.FC<{ text: string; start?: number }> = ({ text, start = 0 }) => {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && ' '}
          <span className="club-split-word">
            <span style={{ '--word-index': start + index } as React.CSSProperties}>{word}</span>
          </span>
        </React.Fragment>
      ))}
    </>
  );
};
