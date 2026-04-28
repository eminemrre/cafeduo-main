import React from 'react';
import { ShieldCheck, Server, Gauge, Users, Building2 } from 'lucide-react';

const pillars = [
  {
    icon: <Server size={18} className="text-sky-300" />,
    title: 'Anlık Eşleşme',
    text: 'Aynı kafedeki oyuncuları düşük gecikmeyle buluşturur.',
  },
  {
    icon: <Gauge size={18} className="text-emerald-300" />,
    title: 'Kısa Tur Dinamiği',
    text: '1 dakikanın altındaki turlarla kesintisiz oyun akışı sağlar.',
  },
  {
    icon: <ShieldCheck size={18} className="text-slate-200" />,
    title: 'Güvenli Giriş',
    text: 'Rol ve oturum kontrolleriyle güvenli erişim sunar.',
  },
  {
    icon: <Users size={18} className="text-amber-300" />,
    title: 'Ödül Döngüsü',
    text: 'Maç puanı, kupon ve mağaza akışını tek ekonomide birleştirir.',
  },
];

export const About: React.FC = () => {
  return (
    <section id="about" className="cd-section" aria-label="Hakkımızda">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-4 items-stretch">
          <div className="cd-card rounded-md p-7 md:p-9 lg:col-span-7 relative overflow-hidden">
            <span className="cd-kicker">Neden CafeDuo?</span>
            <h2
              data-testid="about-main-heading"
              className="mt-4 text-3xl md:text-5xl font-display-tr text-white leading-tight"
            >
              Bekleyen kullanıcıyı aktif oyuncuya çeviren sosyal oyun altyapısı.
            </h2>
            <p className="mt-5 text-lg text-slate-400 leading-relaxed">
              CafeDuo, kafedeki bekleme anını eşleşmeli bir deneyime dönüştürür. Kullanıcı zamanı keyifli geçirir;
              kafe etkileşim ve sadakat kazanır.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-3">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-md border border-slate-700/50 bg-slate-950/35 p-4 transition-colors hover:bg-slate-950/55">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-950/70 border border-slate-700/50">
                    {pillar.icon}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <article className="cd-card rounded-md p-6">
              <div className="inline-flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                <Building2 size={14} />
                Değer Özeti
              </div>
              <h3 className="mt-3 text-xl font-display-tr text-white">Kullanıcı + kafe için net kazanım</h3>
              <p className="mt-2 text-sm text-slate-400">
                Kullanıcı oyunda kalır; kafe tekrar ziyaret ve masa başı etkileşim kazanır.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-slate-700/50 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">5</p>
                  <p className="text-[10px] text-slate-400 uppercase">Oyun</p>
                </div>
                <div className="rounded-md border border-slate-700/50 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">&lt;60 sn</p>
                  <p className="text-[10px] text-slate-400 uppercase">Tur süresi</p>
                </div>
                <div className="rounded-md border border-slate-700/50 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">Anlık</p>
                  <p className="text-[10px] text-slate-400 uppercase">Puan</p>
                </div>
              </div>
            </article>

            <article className="cd-card rounded-md p-5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kazanım Başlıkları</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>Canlı eşleşme ve skor güncellemesi</li>
                <li>Kısa tur, yüksek tekrar oynanış döngüsü</li>
                <li>Ödül ekonomisiyle kafe sadakati</li>
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};
