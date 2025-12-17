import React from 'react';
import { Shield, Lock, Eye, Trash2, Mail, Clock, Users, FileText } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#0f141a] text-white py-20 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold mb-2">Gizlilik Politikası ve KVKK Aydınlatma Metni</h1>
                    <p className="text-gray-400">Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
                </div>

                <div className="space-y-8 text-gray-300">
                    {/* Veri Sorumlusu */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Users size={20} className="text-blue-400" /> 1. Veri Sorumlusu
                        </h2>
                        <p>
                            6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, kişisel verileriniz;
                            veri sorumlusu olarak <strong>CafeDuo</strong> tarafından aşağıda açıklanan kapsamda işlenebilecektir.
                        </p>
                    </section>

                    {/* Toplanan Veriler */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-purple-400" /> 2. Toplanan Kişisel Veriler
                        </h2>
                        <p className="mb-4">Platformumuz üzerinden aşağıdaki kişisel veriler toplanmaktadır:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Kimlik Bilgileri:</strong> Kullanıcı adı</li>
                            <li><strong>İletişim Bilgileri:</strong> E-posta adresi</li>
                            <li><strong>Hesap Güvenliği:</strong> Şifre (şifrelenmiş olarak saklanır)</li>
                            <li><strong>Oyun Verileri:</strong> Puan, kazanılan oyun sayısı, oynanan oyun sayısı</li>
                            <li><strong>Konum Verileri:</strong> Kafe check-in bilgileri (masa numarası)</li>
                        </ul>
                    </section>

                    {/* İşleme Amaçları */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Eye size={20} className="text-yellow-400" /> 3. Verilerin İşlenme Amaçları
                        </h2>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Üyelik kaydının oluşturulması ve hesap yönetimi</li>
                            <li>Platform hizmetlerinin sunulması</li>
                            <li>Oyun ve puan sisteminin işletilmesi</li>
                            <li>Kullanıcı deneyiminin iyileştirilmesi</li>
                            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
                        </ul>
                    </section>

                    {/* Hukuki Dayanak */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Lock size={20} className="text-green-400" /> 4. Kişisel Verilerin İşlenmesinin Hukuki Dayanağı
                        </h2>
                        <p className="mb-4">KVKK'nın 5. maddesinde belirtilen aşağıdaki hukuki sebeplere dayanılarak işlenmektedir:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Açık rızanızın bulunması</li>
                            <li>Sözleşmenin kurulması veya ifası için gerekli olması</li>
                            <li>Hukuki yükümlülüğün yerine getirilmesi</li>
                            <li>Meşru menfaatlerimiz için zorunlu olması</li>
                        </ul>
                    </section>

                    {/* Veri Saklama */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-orange-400" /> 5. Verilerin Saklanma Süresi
                        </h2>
                        <p>
                            Kişisel verileriniz, işleme amaçlarının gerektirdiği süre boyunca ve yasal saklama
                            süreleri çerçevesinde saklanmaktadır. Hesabınızı silmeniz durumunda verileriniz
                            30 gün içinde sistemlerimizden kalıcı olarak silinir.
                        </p>
                    </section>

                    {/* Kullanıcı Hakları */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Trash2 size={20} className="text-red-400" /> 6. KVKK Kapsamındaki Haklarınız
                        </h2>
                        <p className="mb-4">KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                            <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
                            <li>İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                            <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
                            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
                            <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
                            <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
                            <li>Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
                        </ul>
                    </section>

                    {/* İletişim */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Mail size={20} className="text-cyan-400" /> 7. İletişim
                        </h2>
                        <p>
                            KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki kanallardan bizimle iletişime geçebilirsiniz:
                        </p>
                        <div className="mt-4 bg-black/30 p-4 rounded-lg">
                            <p><strong>E-posta:</strong> kvkk@cafeduo.com</p>
                        </div>
                    </section>

                    {/* Çerezler */}
                    <section className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4">8. Çerez Politikası</h2>
                        <p className="mb-4">
                            Web sitemiz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır.
                            Kullandığımız çerez türleri:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Zorunlu Çerezler:</strong> Oturum yönetimi için gerekli</li>
                            <li><strong>Tercih Çerezleri:</strong> Dil ve tema tercihlerinizi hatırlamak için</li>
                        </ul>
                        <p className="mt-4 text-sm text-gray-400">
                            Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz, ancak bu durumda
                            bazı özellikler düzgün çalışmayabilir.
                        </p>
                    </section>
                </div>

                <div className="mt-12 text-center">
                    <a href="/" className="inline-block bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition-colors">
                        Ana Sayfaya Dön
                    </a>
                </div>
            </div>
        </div>
    );
};
