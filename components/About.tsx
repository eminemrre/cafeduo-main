import React from 'react';
import { ShieldCheck, Server, Gauge, Users, Building2 } from 'lucide-react';

const pillars = [
  {
    icon: <Server size={18} className="text-[#1f6f78]" />,
    title: 'Operasyonel Altyapi',
    text: 'API, socket ve oyun akislarini tek panelde yoneten yapi.',
  },
  {
    icon: <Gauge size={18} className="text-[#be7b43]" />,
    title: 'Hizli Deneyim',
    text: 'Dusuk gecikmeli mini oyun dongusu ile yuksek tekrar oranı.',
  },
  {
    icon: <ShieldCheck size={18} className="text-[#4f6980]" />,
    title: 'Guvenli Isleyis',
    text: 'Kimlik dogrulama, kupon dogrulama ve role-bazli yetki modeli.',
  },
  {
    icon: <Users size={18} className="text-[#7d6147]" />,
    title: 'B2B Uyum',
    text: 'Kafe yoneticisi odakli panel ve raporlanabilir puan ekonomisi.',
  },
];

export const About: React.FC = () => {
  return (
    <section id="about" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 cd-panel p-7 md:p-9">
            <span className="cd-kicker">CafeDuo hakkinda</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-display text-[#1f2328] leading-tight">
              Kafeleri oyun odakli bir topluluk alanina ceviren dijital omurga.
            </h2>
            <p className="mt-5 text-lg text-[#55616d] leading-relaxed">
              CafeDuo sadece bir oyun sayfasi degil; mekan ici etkileşimi olculebilir hale getiren bir deneyim sistemi.
              Kullanici, personel ve yonetici tarafinda tek bir akista ilerler.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {pillars.map((pillar) => (
                <article key={pillar.title} className="rounded-2xl border border-[#d7c2ab] bg-white/70 p-4">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#f5ece1] border border-[#dcc6ad]">
                    {pillar.icon}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#1f2328]">{pillar.title}</h3>
                  <p className="mt-1 text-sm text-[#5b6773]">{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-5">
            <article className="cd-panel p-7 relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-[#1f6f78]/14" />
              <div className="inline-flex items-center gap-2 text-[#7d6046] font-pixel text-[10px] uppercase tracking-[0.2em]">
                <Building2 size={14} />
                Platform snapshot
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-[#1f2328]">Kafe icin net fayda modeli</h3>
              <p className="mt-2 text-[#5b6773]">
                Amaç: masa başı zamanı etkileşime çevirip tekrar ziyaret oranını yükseltmek.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-[#d5bea6] bg-white/70 p-3">
                  <p className="font-display text-2xl text-[#1f2328]">3+</p>
                  <p className="font-pixel text-[10px] text-[#67727f] uppercase">Oyun</p>
                </div>
                <div className="rounded-xl border border-[#d5bea6] bg-white/70 p-3">
                  <p className="font-display text-2xl text-[#1f2328]">1 dk</p>
                  <p className="font-pixel text-[10px] text-[#67727f] uppercase">Tur suresi</p>
                </div>
                <div className="rounded-xl border border-[#d5bea6] bg-white/70 p-3">
                  <p className="font-display text-2xl text-[#1f2328]">B2B</p>
                  <p className="font-pixel text-[10px] text-[#67727f] uppercase">Model</p>
                </div>
              </div>
            </article>

            <article className="cd-panel p-6">
              <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-[#6f7b87]">Uzman yaklasim</p>
              <ul className="mt-3 space-y-2 text-[#55616d]">
                <li>Gercek zamanli skor ve kupon akisi</li>
                <li>Rol bazli panel yapisi (kullanici, cafe admin, sistem admin)</li>
                <li>Deploy-ready Docker tabanli canli ortam</li>
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};
