import React from 'react';
import { Building2, Gauge, Server, ShieldCheck, Users } from 'lucide-react';

const pillars = [
  {
    icon: <Server size={18} className="text-sky-200" />,
    title: 'Anlık Eşleşme',
    text: 'Aynı kafedeki oyuncuları düşük gecikmeyle ortak oyuna taşır.',
  },
  {
    icon: <Gauge size={18} className="text-emerald-200" />,
    title: 'Kısa Tur Dinamiği',
    text: 'Dakikalar içinde başlayıp biten oyunlarla akışı hafif tutar.',
  },
  {
    icon: <ShieldCheck size={18} className="text-slate-200" />,
    title: 'Güvenli Giriş',
    text: 'Rol, oturum ve masa kontrolleriyle kontrollü erişim sunar.',
  },
  {
    icon: <Users size={18} className="text-amber-200" />,
    title: 'Ödül Döngüsü',
    text: 'Maç puanı, kupon ve mağaza akışını tek ekonomide birleştirir.',
  },
];

export const About: React.FC = () => {
  return (
    <section id="about" className="cd-section cd-section-band" aria-label="Hakkımızda">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-4 lg:grid-cols-12">
          <div className="cd-card relative overflow-hidden rounded-md p-7 md:p-9 lg:col-span-7">
            <span className="cd-kicker">Neden CafeDuo?</span>
            <h2
              data-testid="about-main-heading"
              className="mt-4 font-display-tr text-3xl leading-tight text-white md:text-5xl"
            >
              Bekleyen kullanıcıyı aktif oyuncuya çeviren sosyal oyun altyapısı.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
              CafeDuo, kafedeki bekleme anını eşleşmeli bir deneyime dönüştürür. Kullanıcı zamanı keyifli geçirir;
              kafe de masadaki etkileşimi, tekrar ziyareti ve ödül döngüsünü güçlendirir.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-md border border-white/10 bg-white/[0.035] p-4 transition-colors hover:bg-white/[0.055]">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-slate-950/55">
                    {pillar.icon}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <article className="cd-card rounded-md p-6">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <Building2 size={14} />
                Değer özeti
              </div>
              <h3 className="mt-3 font-display-tr text-2xl text-white">Kullanıcı + kafe için net kazanım</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Oyuncu bekleme süresini değerlendirir; kafe etkileşim, sadakat ve tekrar ziyaret motivasyonu kazanır.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-white/10 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">3</p>
                  <p className="text-[10px] uppercase text-slate-400">Oyun</p>
                </div>
                <div className="rounded-md border border-white/10 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">&lt;60 sn</p>
                  <p className="text-[10px] uppercase text-slate-400">Tur</p>
                </div>
                <div className="rounded-md border border-white/10 bg-slate-950/35 p-3">
                  <p className="font-display-tr text-xl text-white">Anlık</p>
                  <p className="text-[10px] uppercase text-slate-400">Puan</p>
                </div>
              </div>
            </article>

            <article className="cd-card rounded-md p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Kazanım başlıkları</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
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
