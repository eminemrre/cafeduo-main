/**
 * Admin Table — Riso Kantin re-skin (PR #24). API preserved.
 *
 * Hard 2px ink border around the whole table, mustard-tinted header strip,
 * crisp row separators. No rounded corners anywhere.
 */
import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div className="overflow-x-auto border-2 border-carbon bg-paper">
    <table {...rest} className={`w-full text-left font-riso-body ${className}`}>
      {children}
    </table>
  </div>
);

export const THead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-paper-deep border-b-2 border-carbon">
    <tr>{children}</tr>
  </thead>
);

export const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <th
    {...rest}
    className={
      'px-4 py-3 text-xs uppercase tracking-[0.12em] font-bold font-riso-body ' +
      `text-carbon-soft ${className}`
    }
  >
    {children}
  </th>
);

export const TBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="[&>tr]:border-b-2 [&>tr]:border-paper-dim [&>tr:last-child]:border-0 [&>tr]:transition-colors [&>tr:hover]:bg-paper-deep">
    {children}
  </tbody>
);

export const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <td {...rest} className={`px-4 py-3 text-[0.9375rem] text-carbon align-middle ${className}`}>
    {children}
  </td>
);
