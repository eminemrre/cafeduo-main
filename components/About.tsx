import React from 'react';
import { ShieldCheck, Server, Gauge, Users, Building2 } from 'lucide-react';

const pillars = [
  {
    icon: <Server size={18} className="text-cyan-300" />,
    title: 'Operasyonel Altyapı',
    text: 'API, socket ve oyun akışlarını tek panelde yöneten omurga.',
  },
  {
    icon: <Gauge size={18} className="text-fuchsia-300" />,
    title: 'Hızlı Deneyim',
    text: 'Düşük gecikmeli mini oyun döngüsü ile yüksek tekrar oranı.',
  },
  {
    icon: <ShieldCheck size={18} className="text-emerald-300" />,
    title: 'Güvenli İşleyiş',
    text: 'Kimlik doğrulama, kupon doğrulama ve rol bazlı yetki modeli.',
  },
  {
    icon: <Users size={18} className="text-amber-300" />,
    title: 'B2B Uyum',
    text: 'Kafe yöneticisi odaklı panel ve raporlanabilir puan ekonomisi.',
  },
];

export const About: React.FC = () => {
  return (
    <section id="about" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 cd-panel p-7 md:p-9 border-cyan-400/25">
            <span className="cd-kicker">CafeDuo hakkında</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-display text-white leading-tight">
              Kafeleri oyun odaklı topluluk alanına çeviren dijital omurga.
            </h2>
            <p className="mt-5 text-lg text-[var(--rf-muted)] leading-relaxed">
              CafeDuo sadece bir oyun ekranı değil; mekan içi etkileşimi ölçülebilir hale getiren bir deneyim sistemi.
              Kullanıcı, personel ve yönetici aynı akışta buluşur.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-2xl border border-cyan-400/20 bg-[#0a1834]/76 p-4">
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
            <article className="cd-panel p-7 relative overflow-hidden border-cyan-400/20">
              <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-cyan-400/12" />
              <div className="inline-flex items-center gap-2 text-cyan-300/85 font-pixel text-[10px] uppercase tracking-[0.2em]">
                <Building2 size={14} />
                Platform özeti
              </div>
              <h3 className="mt-4 text-2xl font-display text-white">Kafe için net fayda modeli</h3>
              <p className="mt-2 text-[var(--rf-muted)]">
                Amaç: masa başı zamanı etkileşime çevirmek ve tekrar ziyaret oranını yükseltmek.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">3+</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Oyun</p>
                </div>
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">1 dk</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Tur süresi</p>
                </div>
                <div className="rounded-xl border border-cyan-400/22 bg-[#0a1834]/70 p-3">
                  <p className="font-display text-2xl text-white">B2B</p>
                  <p className="font-pixel text-[10px] text-cyan-300/80 uppercase">Model</p>
                </div>
              </div>
            </article>

            <article className="cd-panel p-6 border-cyan-400/20">
              <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Uzman yaklaşım</p>
              <ul className="mt-3 space-y-2 text-[var(--rf-muted)]">
                <li>Gerçek zamanlı skor ve kupon akışı</li>
                <li>Rol bazlı panel yapısı (kullanıcı, kafe admin, sistem admin)</li>
                <li>Deploy-ready Docker tabanlı canlı ortam</li>
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};
