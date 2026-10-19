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
      className="riso-focus mt-3 min-h-11 bg-carbon px-4 font-riso-body text-sm font-semibold text-paper hover:bg-carbon-soft transition-colors"
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
        className="riso-focus px-5 pt-6"
      >
        <h3 className="mb-3 flex items-center gap-2 font-riso-body text-[15px] font-semibold text-carbon">
          <Package size={16} aria-hidden="true" strokeWidth={2.2} /> Envanterin
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
                className="bg-riso-redox/10 px-3 py-2 font-riso-body text-sm text-carbon"
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
                  className="max-w-full break-words bg-riso-spring px-3 py-1.5 font-riso-body text-sm font-medium text-carbon"
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
        className="riso-focus px-5 pt-6"
      >
        <h3 className="mb-3 flex items-center gap-2 font-riso-body text-[15px] font-semibold text-carbon">
          <Clock size={16} aria-hidden="true" strokeWidth={2.2} /> Son oyunların
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
                className="bg-riso-redox/10 px-3 py-2 font-riso-body text-sm text-carbon"
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
                    className="bg-paper-deep p-3"
                  >
                    <p className="break-words font-riso-body text-sm font-semibold text-carbon">
                      {item.gameType}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${!item.winner ? 'text-carbon-muted' : item.didWin ? 'text-[#177A41]' : 'text-riso-redox'}`}
                    >
                      {outcome}
                    </p>
                    <p className="mt-2 break-words font-riso-body text-[13px] text-carbon-soft">
                      Rakip: {item.opponentName}
                    </p>
                    {validDate ? (
                      <time
                        dateTime={date.toISOString()}
                        className="mt-1 block text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]"
                      >
                        {dateFormat.format(date)}
                      </time>
                    ) : (
                      <span className="mt-1 block font-riso-body text-[13px] text-carbon-muted">
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
