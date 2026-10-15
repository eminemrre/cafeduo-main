import React, { useRef } from 'react';
import { Clock, Package } from 'lucide-react';
import type { useProfileData } from '../../hooks/useProfileData';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function Retry({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="riso-focus mt-2 min-h-11 border-2 border-carbon bg-paper px-3 font-riso-body text-sm font-semibold text-carbon hover:bg-paper-deep transition-colors"
    >
      {label}
    </button>
  );
}

export function ProfileActivity({
  history,
  inventory,
  retryHistory,
  retryInventory,
}: ReturnType<typeof useProfileData>) {
  const inventoryRegion = useRef<HTMLElement>(null);
  const historyRegion = useRef<HTMLElement>(null);
  return (
    <>
      <section
        ref={inventoryRegion}
        tabIndex={-1}
        aria-label="Envanterin"
        className="riso-focus p-5 border-b-2 border-carbon bg-paper-deep"
      >
        <h3 className="font-riso-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] mb-3 flex items-center gap-1.5 text-carbon-soft">
          <Package size={11} aria-hidden="true" strokeWidth={2.5} /> Envanterin
        </h3>
        <div className="min-h-12">
          {inventory.status === 'loading' ? (
            <p role="status" className="font-riso-body text-sm text-carbon-soft">
              Envanter yükleniyor…
            </p>
          ) : inventory.status === 'error' ? (
            <>
              <p
                role="alert"
                className="border-l-2 border-riso-redox pl-2 font-riso-body text-sm text-carbon"
              >
                Envanter yüklenemedi.
              </p>
              <Retry
                label="Envanteri yeniden yükle"
                onRetry={() => {
                  inventoryRegion.current?.focus();
                  retryInventory();
                }}
              />
            </>
          ) : inventory.data.length === 0 ? (
            <p className="font-riso-body text-sm leading-6 text-carbon-soft">
              Henüz envanterinde bir ürün yok.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {inventory.data.map((item) => (
                <li
                  key={item.id}
                  className="max-w-full break-words border-2 border-carbon bg-paper px-2 py-1 font-riso-mono text-[0.65rem] font-bold uppercase tracking-wider text-carbon"
                >
                  {item.item_title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section
        ref={historyRegion}
        tabIndex={-1}
        aria-label="Son oyunların"
        className="riso-focus p-5 bg-paper"
      >
        <h3 className="font-riso-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] mb-3 flex items-center gap-1.5 text-carbon-soft">
          <Clock size={11} aria-hidden="true" strokeWidth={2.5} /> Son oyunların
        </h3>
        <div className="min-h-12">
          {history.status === 'loading' ? (
            <p role="status" className="font-riso-body text-sm text-carbon-soft">
              Oyun geçmişi yükleniyor…
            </p>
          ) : history.status === 'error' ? (
            <>
              <p
                role="alert"
                className="border-l-2 border-riso-redox pl-2 font-riso-body text-sm text-carbon"
              >
                Oyun geçmişi yüklenemedi.
              </p>
              <Retry
                label="Oyun geçmişini yeniden yükle"
                onRetry={() => {
                  historyRegion.current?.focus();
                  retryHistory();
                }}
              />
            </>
          ) : history.data.length === 0 ? (
            <p className="font-riso-body text-sm leading-6 text-carbon-soft">
              İlk oyunundan sonra sonuçlarını burada görebilirsin.
            </p>
          ) : (
            <ol className="space-y-2">
              {history.data.map((item) => {
                const outcome = !item.winner
                  ? 'Beraberlik'
                  : item.didWin
                    ? 'Galibiyet'
                    : 'Mağlubiyet';
                const date = new Date(item.createdAt);
                const validDate = Number.isFinite(date.getTime());
                return (
                  <li
                    key={item.id}
                    className={`border-2 border-carbon p-3 ${!item.winner ? 'bg-paper-deep' : item.didWin ? 'bg-riso-spring/15' : 'bg-riso-pink/10'}`}
                  >
                    <p className="break-words font-riso-body text-sm font-semibold text-carbon">
                      {item.gameType}
                    </p>
                    <p className="mt-1 font-riso-mono text-xs font-bold text-carbon">{outcome}</p>
                    <p className="mt-2 break-words font-riso-body text-xs text-carbon-soft">
                      Rakip: {item.opponentName}
                    </p>
                    {validDate ? (
                      <time
                        dateTime={date.toISOString()}
                        className="mt-1 block font-riso-mono text-[0.65rem] text-carbon-muted"
                      >
                        {dateFormat.format(date)}
                      </time>
                    ) : (
                      <span className="mt-1 block font-riso-body text-xs text-carbon-muted">
                        Tarih bilgisi yok
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </>
  );
}
