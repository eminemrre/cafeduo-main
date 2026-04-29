import React from 'react';
import { ChevronRight, Coffee, Trophy, UserPlus } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: <UserPlus size={21} className="text-sky-200" />,
    title: 'Hesabını aç',
    description: 'Kısa profilini tamamla ve CafeDuo oyuncu kimliğini hazır hale getir.',
    hint: '20 sn',
  },
  {
    id: '02',
    icon: <Coffee size={21} className="text-emerald-200" />,
    title: 'Kafeye bağlan',
    description: 'Kafeni ve masanı seç, aynı ortamdaki oyuncularla lobiye gir.',
    hint: '15 sn',
  },
  {
    id: '03',
    icon: <Trophy size={21} className="text-amber-200" />,
    title: 'Eşleş ve kazan',
    description: 'Kısa turu tamamla, puanını cüzdana işle ve ödül hedefine yaklaş.',
    hint: '45 sn',
  },
];

export const HowItWorks: React.FC = () => (
  <section id="features" className="cd-section cd-section-band" aria-label="Nasıl çalışır">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-11 max-w-3xl text-center">
        <span className="cd-kicker justify-center">Nasıl çalışır</span>
        <h2
          data-testid="flow-main-heading"
          className="mt-4 font-display-tr text-3xl leading-tight text-white md:text-5xl"
        >
          3 adımda eşleş, oyna, ödüle yaklaş.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">
          Kullanıcı aynı deneyimi takip eder: bağlanır, eşleşir, oynar ve puanını görür.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <article
            key={step.id}
            data-testid={`how-step-${step.id}`}
            className="cd-card relative rounded-md p-6 transition-colors duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                {step.icon}
              </div>
              <span className="font-display-tr text-4xl leading-none text-white/[0.08]">{step.id}</span>
            </div>

            <h3 className="mt-5 text-xl font-bold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/35 px-3 py-1.5 text-sm">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Ortalama</span>
              <span className="font-semibold text-white">{step.hint}</span>
            </div>

            {index < steps.length - 1 && (
              <div className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 bg-[#0b111b] md:flex">
                <ChevronRight size={14} className="text-slate-500" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  </section>
);
