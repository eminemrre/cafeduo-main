import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Coffee, Trophy, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: <UserPlus size={24} className="text-cyan-300" />,
    title: 'Hesabını aç',
    description: 'Kayıt ol, profilini tamamla ve oyuncu kimliğini saniyeler içinde aktive et.',
    hint: '20 sn',
  },
  {
    id: '02',
    icon: <Coffee size={24} className="text-fuchsia-300" />,
    title: 'Masanı doğrula',
    description: 'Kafeyi seç, masa bilgisini gir, günlük PIN ile oturumu güvenli şekilde doğrula.',
    hint: '15 sn',
  },
  {
    id: '03',
    icon: <Trophy size={24} className="text-amber-300" />,
    title: 'Yarış ve kazan',
    description: 'Mini turu tamamla, puan topla ve kuponunu kasada okut.',
    hint: '45 sn',
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="features" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="cd-kicker">Sistem akışı</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-display text-white">Akışı 3 adımda çalıştır.</h2>
          <p className="mt-4 text-lg text-[var(--rf-muted)]">
            Kafe içinde bekleme yaratmadan çalışan, ölçülebilir ve personel dostu bir deneyim hattı.
          </p>
        </div>

        <motion.div
          className="hidden md:block h-px mb-6 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
          initial={{ opacity: 0.25, scaleX: 0.7 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, index) => (
            <motion.article
              key={step.id}
              className="cd-panel p-6 md:p-7 relative overflow-hidden border-cyan-400/20"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: index * 0.08, ease: 'easeOut' }}
            >
              <div className="absolute top-4 right-4 text-slate-700 font-display text-5xl">{step.id}</div>

              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/35 flex items-center justify-center mb-5">
                {step.icon}
              </div>

              <h3 className="text-2xl font-display text-white mb-3">{step.title}</h3>
              <p className="text-[var(--rf-muted)] leading-relaxed">{step.description}</p>

              <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a1834]/80 border border-cyan-400/35">
                <span className="font-pixel text-[10px] tracking-[0.16em] text-cyan-300 uppercase">Ortalama</span>
                <span className="text-sm font-semibold text-white">{step.hint}</span>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0a1834] border border-cyan-400/35">
                  <ChevronRight size={14} className="text-cyan-300/90" />
                </div>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};
