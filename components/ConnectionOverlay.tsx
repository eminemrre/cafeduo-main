import React, { useEffect, useRef, useState } from 'react';
import { socketService } from '../lib/socket';

interface ConnectionOverlayProps {
  gameId?: string | number | null;
}

export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = () => {
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [showReconnecting, setShowReconnecting] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasConnectedOnceRef = useRef(socketService.isConnected());

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const unsubscribe = socketService.onConnectionChange((connected) => {
      clearReconnectTimer();
      setIsConnected(connected);
      if (connected) {
        hasConnectedOnceRef.current = true;
        setShowReconnecting(false);
        return;
      }

      if (hasConnectedOnceRef.current) {
        // Only block gameplay after a real connected -> disconnected transition.
        reconnectTimerRef.current = window.setTimeout(() => {
          setShowReconnecting(true);
          reconnectTimerRef.current = null;
        }, 4500);
      } else {
        setShowReconnecting(false);
      }
    });
    return () => {
      clearReconnectTimer();
      unsubscribe();
    };
  }, []);

  if (isConnected || !showReconnecting) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-carbon/70">
      <div role="alert" className="duo-float mx-4 max-w-sm bg-paper p-6 text-carbon">
        <h3 className="mb-2 font-candy-display text-[28px] leading-none">Bağlantı kesildi</h3>
        <p className="mb-5 font-candy-body text-[15px] text-carbon-muted">
          Sunucuyla bağlantı yeniden kuruluyor. Lütfen bekleyin...
        </p>
        <div className="duo-meter">
          <span
            className="bg-candy-gok"
            style={{ width: '60%', animation: 'loading-bar 1.5s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  );
};

// Add loading-bar keyframes to index.css if not present
export const connectionStyles = `
@keyframes loading-bar {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(50%); }
  100% { transform: translateX(200%); }
}
`;
