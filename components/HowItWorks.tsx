import React from 'react';
import { UserPlus, Coffee, Trophy, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: <UserPlus size={24} className="text-cyan-300" />,
    title: 'Hesabını aç',
    description: '30 saniyede profilini tamamla ve oyuncu kimliğini aktive et.',
    hint: '20 sn',
  },
  {
    id: '02',
    icon: <Coffee size={24} className="text-fuchsia-300" />,
    title: 'Kafeye bağlan',
    description: 'Kafeni seç, güvenli girişi tamamla ve lobiye düş.',
    hint: '15 sn',
  },
  {
    id: '03',
    icon: <Trophy size={24} className="text-amber-300" />,
    title: 'Eşleş ve kazan',
    description: 'Bekleyen oyuncuyla maça gir, turu bitir, puanı hesabına yaz.',
    hint: '45 sn',
  },
];

export const HowItWorks: React.FC = () => {
  const renderStepCard = (step: (typeof steps)[number], index: number, showConnector: boolean) => (
    <article
      key={step.id}
      data-testid={`how-step-${step.id}`}
      className="cd-panel rf-elevated p-5 sm:p-6 md:p-7 relative overflow-hidden border-cyan-400/26 w-full bg-[linear-gradient(155deg,rgba(8,18,40,0.96),rgba(8,24,56,0.84))]"
    >
      <div className="absolute top-3 right-4 text-cyan-900/70 font-display text-5xl md:text-6xl">{step.id}</div>
      <div className="absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" />
      <div className="absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl pointer-events-none" />

      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/35 flex items-center justify-center mb-5">
        {step.icon}
      </div>

      <h3 className="text-[1.6rem] md:text-[1.9rem] font-display text-white mb-3 tracking-tight">{step.title}</h3>
      <p className="text-[var(--rf-muted)] leading-relaxed text-sm md:text-base">{step.description}</p>

      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a1834]/80 border border-cyan-400/35">
        <span className="font-pixel text-[10px] tracking-[0.16em] text-cyan-300 uppercase">Ortalama</span>
        <span className="text-sm font-semibold text-white">{step.hint}</span>
      </div>

      {showConnector && (
        <div className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0a1834] border border-cyan-400/35">
          <ChevronRight size={14} className="text-cyan-300/90" />
        </div>
      )}
    </article>
  );

  return (
    <section id="features" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="cd-kicker">NASIL ÇALIŞIR</span>
          <h2
            data-testid="flow-main-heading"
            className="mt-4 text-3xl md:text-5xl font-display text-white"
          >
            3 adımda eşleş, oyna, ödüle yaklaş.
          </h2>
          <p className="mt-4 text-lg text-[var(--rf-muted)]">
            Arkadaşını beklerken boşta kalma; bağlan, eşleş ve puanı topla.
          </p>
        </div>

        <div className="hidden md:block h-px mb-6 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <div className="md:hidden grid grid-cols-1 gap-4">
          {steps.map((step, index) =>
            renderStepCard(step, index, false)
          )}
        </div>

        <div className="hidden md:grid md:grid-cols-3 gap-5">
          {steps.map((step, index) =>
            renderStepCard(step, index, index < steps.length - 1)
          )}
        </div>
      </div>
    </section>
  );
};
