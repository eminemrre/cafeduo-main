/**
 * Admin TabBar — underline tabs, the same as the player panel's (DESIGN.md:
 * 3 px ink underline on the active tab). Badges are small ice counts.
 */
import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface TabBarProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
}

export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  return (
    <div className="flex items-end gap-6 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.id)}
            className={
              'relative inline-flex min-h-12 items-center gap-2 px-0.5 ' +
              'font-candy-body font-semibold text-[0.9375rem] duo-focus transition-[color,box-shadow] duration-150 whitespace-nowrap ' +
              (active
                ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                : 'text-carbon-muted hover:text-carbon hover:shadow-[inset_0_-3px_0_#17140f40]')
            }
          >
            {t.icon && <span className="shrink-0">{t.icon}</span>}
            <span>{t.label}</span>
            {t.badge != null && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-paper-deep text-carbon text-[0.8125rem] font-semibold [font-variant-numeric:tabular-nums]">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
