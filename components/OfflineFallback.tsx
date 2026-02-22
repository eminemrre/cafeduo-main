import { motion } from 'framer-motion';
import { WifiOff, RefreshCw, Gamepad2 } from 'lucide-react';
import RetroButton from './RetroButton';

/**
 * OfflineFallback - PWA offline mode fallback component
 * 
 * Shows when user is offline and provides options to:
 * - Retry connection
 * - Play offline games (if cached)
 * - View cached content
 */
export default function OfflineFallback() {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen rf-page-shell noise-bg flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500/30 flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-amber-400" />
          </div>
        </motion.div>

        {/* Title */}
        <div className="rf-terminal-strip mb-2 justify-center">Sistem TR-X // Çevrimdışı</div>
        <h1 className="text-2xl font-bold text-white mb-2 font-display uppercase tracking-[0.08em]">
          İnternet Bağlantısı Yok
        </h1>

        {/* Description */}
        <p className="text-[var(--rf-muted)] mb-6 leading-relaxed">
          Şu anda çevrimdışısınız. Daha önce ziyaret ettiğiniz sayfaları görüntüleyebilir veya bağlantıyı yeniden deneyebilirsiniz.
        </p>

        {/* Info Cards */}
        <div className="space-y-3 mb-8">
          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rf-screen-card-muted p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-400/35 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Oyunlar Çevrimdışı</p>
              <p className="text-xs text-[var(--rf-muted)]">Önbelleğe alınan oyunları oynayabilirsiniz</p>
            </div>
          </motion.div>

          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rf-screen-card-muted p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-400/35 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">☕</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Kafe Bilgileri</p>
              <p className="text-xs text-[var(--rf-muted)]">Daha önce görüntülediğiniz kafeler</p>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <RetroButton
            onClick={handleRetry}
            variant="primary"
            icon={<RefreshCw className="w-4 h-4" />}
            className="flex-1"
          >
            Yeniden Dene
          </RetroButton>
          
          <RetroButton
            onClick={handleGoHome}
            variant="secondary"
            className="flex-1"
          >
            Ana Sayfaya Dön
          </RetroButton>
        </div>

        {/* Connection Status */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]"
        >
          Çevrimdışı mod aktif • CafeDuo PWA
        </motion.p>
      </div>
    </motion.div>
  );
}

/**
 * Simple offline banner for inline usage
 */
export function OfflineBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm border-b border-amber-400/50">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-900" />
        <span className="text-sm font-medium text-amber-900">
          Çevrimdışı modu aktif
        </span>
      </div>
    </div>
  );
}

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}
