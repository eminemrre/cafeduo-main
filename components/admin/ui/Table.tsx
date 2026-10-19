/**
 * Admin Table — a dense data table in the v2 Masa register: an ice header
 * band with a 2 px ink rule under it, quiet ice-deep row rules, tabular
 * numbers. No outer frame.
 */
import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div className="overflow-x-auto bg-paper">
    <table {...rest} className={`w-full text-left font-candy-body ${className}`}>
      {children}
    </table>
  </div>
);

export const THead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-paper-deep shadow-[inset_0_-2px_0_#17140f]">
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
      'px-4 py-3 text-[0.8125rem] font-semibold font-candy-body ' +
      `text-carbon-soft ${className}`
    }
  >
    {children}
  </th>
);

export const TBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="[&>tr]:border-b [&>tr]:border-paper-dim [&>tr:last-child]:border-0 [&>tr]:transition-colors [&>tr:hover]:bg-paper-deep">
    {children}
  </tbody>
);

export const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <td {...rest} className={`px-4 py-3 text-[0.9375rem] text-carbon align-middle [font-variant-numeric:tabular-nums] ${className}`}>
    {children}
  </td>
);
