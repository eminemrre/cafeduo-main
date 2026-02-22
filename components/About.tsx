import React from 'react';
import { ShieldCheck, Server, Gauge, Users, Building2 } from 'lucide-react';

const pillars = [
  {
    icon: <Server size={18} className="text-cyan-300" />,
    title: 'Anlık Eşleşme',
    text: 'Aynı kafedeki oyuncuları düşük gecikmeyle buluşturur.',
  },
  {
    icon: <Gauge size={18} className="text-fuchsia-300" />,
    title: 'Kısa Tur Dinamiği',
    text: '1 dakikanın altındaki turlarla kesintisiz oyun akışı sağlar.',
  },
  {
    icon: <ShieldCheck size={18} className="text-emerald-300" />,
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
    <section id="about" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 cd-panel rf-elevated p-7 md:p-9 border-cyan-400/26 relative overflow-hidden">
            <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl pointer-events-none" />
            <span className="cd-kicker">NEDEN CAFE DUO?</span>
            <h2
              data-testid="about-main-heading"
              className="mt-4 text-3xl md:text-5xl font-display text-white leading-tight"
            >
              Bekleyen kullanıcıyı aktif oyuncuya çeviren sosyal oyun altyapısı.
            </h2>
            <p className="mt-5 text-lg text-[var(--rf-muted)] leading-relaxed">
              CafeDuo, kafedeki bekleme anını eşleşmeli bir deneyime dönüştürür. Kullanıcı zamanı keyifli geçirir;
              kafe etkileşim ve sadakat kazanır.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-2xl border border-cyan-400/24 bg-[#0a1834]/78 p-4">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#09132b] border border-cyan-400/30">
                    {pillar.icon}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-1 text-sm text-[var(--rf-muted)]">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-5">
            <article className="cd-panel rf-elevated p-7 relative overflow-hidden border-cyan-400/24">
              <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-cyan-400/12" />
              <div className="inline-flex items-center gap-2 text-cyan-300/85 font-pixel text-[10px] uppercase tracking-[0.2em]">
                <Building2 size={14} />
                Değer Özeti
              </div>
              <h3 className="mt-4 text-2xl font-display text-white">Kullanıcı + kafe için net kazanım</h3>
              <p className="mt-2 text-[var(--rf-muted)]">
                Kullanıcı oyunda kalır; kafe tekrar ziyaret ve masa başı etkileşim kazanır.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">5</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Oyun</p>
                </div>
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">&lt;60 sn</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Tur süresi</p>
                </div>
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">Anlık</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Puan</p>
                </div>
              </div>
            </article>

            <article className="cd-panel rf-elevated p-6 border-cyan-400/24">
              <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Kazanım Başlıkları</p>
              <ul className="mt-3 space-y-2 text-[var(--rf-muted)]">
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
