/**
 * PrivacyPolicy — Riso Kantin redesign.
 *
 * Previously rendered text-white on cream paper (invisible title) plus
 * leftover cyber-dark email box and a neon-shadow back button. Rewritten
 * here as a clean printed-zine document: ink text on paper-deep sections
 * with spot-coloured icon chips per section, ink-bordered cards, and a
 * proper Riso press-button back link.
 *
 * Also fixes "scroll to top on mount": when a user opens this route from
 * elsewhere in the SPA (e.g. footer link), browsers don't reset scroll
 * for client-side route changes — we force scroll(0,0) ourselves.
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router';
import {
  Lock,
  Eye,
  Trash2,
  Mail,
  Clock,
  Users,
  FileText,
  ArrowLeft,
  Cookie,
} from 'lucide-react';
import { Reveal } from './ui';

export const PrivacyPolicy: React.FC = () => {
  // Force scroll to top on mount — react-router doesn't do this for SPA
  // navigations, so users coming from the landing footer would otherwise
  // land mid-page on the privacy doc.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="riso-kantin min-h-screen bg-paper text-carbon py-12 sm:py-20 px-4 relative overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <header className="mb-10 bg-paper px-6 py-8 sm:mb-12 sm:px-10 sm:py-12 border-b-[3px] border-dotted border-carbon/35">
          <h1 className="font-riso-display text-3xl leading-[1.05] text-carbon sm:text-4xl md:text-5xl break-words">
            Gizlilik Politikası ve KVKK Aydınlatma Metni
          </h1>
          <p className="mt-4 text-sm text-carbon-muted font-riso-body">
            Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8 text-carbon font-riso-body">
          <PolicySection
            number={1}
            title="Veri Sorumlusu"
            icon={<Users size={20} />}
            iconBg="bg-riso-blue text-carbon"
          >
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, kişisel
              verileriniz; veri sorumlusu olarak <strong>CafeDuo</strong> tarafından aşağıda
              açıklanan kapsamda işlenebilecektir.
            </p>
          </PolicySection>

          <PolicySection
            number={2}
            title="Toplanan Kişisel Veriler"
            icon={<FileText size={20} />}
            iconBg="bg-riso-pink text-carbon"
          >
            <p className="mb-3">Platformumuz üzerinden aşağıdaki kişisel veriler toplanmaktadır:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 sm:ml-4">
              <li>
                <strong>Kimlik Bilgileri:</strong> Kullanıcı adı
              </li>
              <li>
                <strong>İletişim Bilgileri:</strong> E-posta adresi
              </li>
              <li>
                <strong>Hesap Güvenliği:</strong> Şifre (şifrelenmiş olarak saklanır)
              </li>
              <li>
                <strong>Oyun Verileri:</strong> Puan, kazanılan oyun sayısı, oynanan oyun sayısı
              </li>
              <li>
                <strong>Konum Verileri:</strong> Kafe check-in bilgileri (masa numarası)
              </li>
            </ul>
          </PolicySection>

          <PolicySection
            number={3}
            title="Verilerin İşlenme Amaçları"
            icon={<Eye size={20} />}
            iconBg="bg-riso-mustard text-carbon"
          >
            <ul className="list-disc list-inside space-y-2 ml-2 sm:ml-4">
              <li>Üyelik kaydının oluşturulması ve hesap yönetimi</li>
              <li>Platform hizmetlerinin sunulması</li>
              <li>Oyun ve puan sisteminin işletilmesi</li>
              <li>Kullanıcı deneyiminin iyileştirilmesi</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            </ul>
          </PolicySection>

          <PolicySection
            number={4}
            title="Kişisel Verilerin İşlenmesinin Hukuki Dayanağı"
            icon={<Lock size={20} />}
            iconBg="bg-riso-spring text-carbon"
          >
            <p className="mb-3">
              KVKK'nın 5. maddesinde belirtilen aşağıdaki hukuki sebeplere dayanılarak
              işlenmektedir:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 sm:ml-4">
              <li>Açık rızanızın bulunması</li>
              <li>Sözleşmenin kurulması veya ifası için gerekli olması</li>
              <li>Hukuki yükümlülüğün yerine getirilmesi</li>
              <li>Meşru menfaatlerimiz için zorunlu olması</li>
            </ul>
          </PolicySection>

          <PolicySection
            number={5}
            title="Verilerin Saklanma Süresi"
            icon={<Clock size={20} />}
            iconBg="bg-riso-mustard text-carbon"
          >
            <p>
              Kişisel verileriniz, işleme amaçlarının gerektirdiği süre boyunca ve yasal saklama
              süreleri çerçevesinde saklanmaktadır. Hesabınızı silmeniz durumunda verileriniz 30 gün
              içinde sistemlerimizden kalıcı olarak silinir.
            </p>
          </PolicySection>

          <PolicySection
            number={6}
            title="KVKK Kapsamındaki Haklarınız"
            icon={<Trash2 size={20} />}
            iconBg="bg-riso-redox text-paper"
          >
            <p className="mb-3">KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 sm:ml-4">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
              <li>
                İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi
                suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme
              </li>
              <li>
                Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın
                giderilmesini talep etme
              </li>
            </ul>
          </PolicySection>

          <PolicySection
            number={7}
            title="İletişim"
            icon={<Mail size={20} />}
            iconBg="bg-riso-pink text-carbon"
          >
            <p className="mb-3">
              KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki kanallardan bizimle iletişime
              geçebilirsiniz:
            </p>
            <div className="mt-3 bg-paper p-4">
              <p className="text-sm text-carbon">
                <strong className="font-semibold">E-posta:</strong> cafeduotr@gmail.com
              </p>
            </div>
          </PolicySection>

          <PolicySection
            number={8}
            title="Çerez Politikası"
            icon={<Cookie size={20} />}
            iconBg="bg-riso-mustard text-carbon"
          >
            <p className="mb-3">
              Web sitemiz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır.
              Kullandığımız çerez türleri:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 sm:ml-4">
              <li>
                <strong>Zorunlu Çerezler:</strong> Oturum yönetimi için gerekli
              </li>
              <li>
                <strong>Tercih Çerezleri:</strong> Dil ve tema tercihlerinizi hatırlamak için
              </li>
            </ul>
            <p className="mt-3 text-sm text-carbon-muted">
              Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz, ancak bu durumda bazı
              özellikler düzgün çalışmayabilir.
            </p>
          </PolicySection>
        </div>

        <div className="mt-10 sm:mt-12 text-center">
          <Link
            to="/"
            className="riso-focus inline-flex min-h-12 items-center gap-2 bg-carbon px-6 font-riso-body text-[0.9375rem] font-semibold text-paper transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
};

interface PolicySectionProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}

/** A single titled section of the policy. Ink-bordered paper-deep card with
 *  a numbered/iconned heading and a free-form body. Keeps the layout
 *  uniform across all 8 sections — change once, reflected everywhere. */
const PolicySection: React.FC<PolicySectionProps> = ({ number, title, icon, iconBg, children }) => (
  <Reveal as="section" className="bg-paper-deep p-5 sm:p-6">
    <header className="flex items-center gap-3 mb-4 pb-3 border-b-[3px] border-dotted border-carbon/35">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <h2 className="font-riso-display text-[1.75rem] leading-none text-carbon">
        <span className="text-carbon-muted mr-2">{number}.</span>
        {title}
      </h2>
    </header>
    <div className="text-carbon text-sm sm:text-base leading-relaxed max-w-[36rem]">{children}</div>
  </Reveal>
);

export default PrivacyPolicy;
