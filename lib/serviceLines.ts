/**
 * "What the cleaning includes", in the screen's language. The Hebrew lines live
 * in serviceDescriptions (SERVICE_DESCRIPTIONS); every other language showed
 * them in Hebrew (translation sweep, 11.11.2026). Same order, same emoji.
 *
 * Shared: byte-identical in the app (lib/) and the website (src/lib/).
 */
import { SERVICE_DESCRIPTIONS } from './serviceDescriptions';

type Lines = Record<string, string[]>;

const LINES: Record<string, Lines> = {
  en: {
    'ניקיון רגיל': ['🫧 Mopping and wiping floors in every room', '🪣 Dusting surfaces, furniture and decor', '🚿 Bathrooms and toilets — tiles, sinks and toilets', '🛋️ Tidying up — general order in the rooms'],
    'ניקוי לפסח': ['🔍 A thorough clean of every corner of the home', '🍞 Checking for and removing chametz everywhere', '🧴 Disinfecting drawers, shelves and cupboards', '✨ Cleaning the oven, hob and appliances'],
    'חלונות': ['🪟 Washing panes inside and out', '🧹 Cleaning frames, sills and bars', '💧 Drying and polishing with no streaks'],
    'שטיפת רכב': ['🚗 Pressure-washing the outside of the car', '🧽 Cleaning the inside — seats, carpet and boot', '✨ Cleaning the windows and windscreen inside'],
    'לאחר שיפוץ': ['🔨 Clearing rubble, building dust and materials', '🧴 A deep wash of every floor — parquet, tiles and marble', '🪟 Windows and frames — removing plaster and paint stains', '🚪 Doors, frames and handles', '🪑 Cupboards and shelves inside and out', '🚿 Bathrooms and toilets — tiles, sinks and toilets', '🍳 Kitchen — worktops, sink and floor', '💡 Light fittings, sockets and switches', '✅ A thorough final clean — ready to move in'],
    'ניקיון משרדים': ['🏢 Washing floors and work surfaces', '🗑️ Emptying and refreshing bins', '🪟 Windows and the office space', '🧴 Disinfecting toilets and the kitchenette'],
    'ניקיון אחרי אירוע': ['🎉 Clearing dishes, leftover food and rubbish', '🧹 Washing floors and wiping surfaces', '🗑️ Stacking and clearing chairs and tables', '✨ Putting the home back to normal'],
    'מחסן ועליית גג': ['📦 Sorting and arranging the storeroom', '🧹 Washing and cleaning the floor and walls', '🗑️ Clearing rubbish and old items as the client chooses'],
    'סידורי בגדים וארונות': ['👔 Sorting clothes by category — tops, bottoms, seasons', '🗂️ Arranging wardrobes neatly and within reach', '👗 Folding and arranging shirts, trousers and dresses', '🧦 Socks and underwear in their own sections', '🧥 Organising coats, sweaters and seasonal clothes', '📦 Sorting clothes to donate / store for the season as the client chooses', '✨ A neat, uniform arrangement that is easy to use every day'],
    'ניקוי חדר מדרגות': ['🪜 Sweeping and washing stairs and landings on every floor', '🧽 Wiping railings, doors, switches and lights', '🚪 Cleaning the lobby, entrance door and mailboxes', '🪟 Cleaning the stairwell windows'],
  },
  ru: {
    'ניקיון רגיל': ['🫧 Мытьё и протирка полов во всех комнатах', '🪣 Удаление пыли с поверхностей, мебели и декора', '🚿 Ванные и туалеты — плитка, раковины и унитазы', '🛋️ Уборка — общий порядок в комнатах'],
    'ניקוי לפסח': ['🔍 Тщательная уборка всех уголков дома', '🍞 Проверка и удаление хамеца отовсюду', '🧴 Дезинфекция ящиков, полок и шкафов', '✨ Чистка духовки, плиты и техники'],
    'חלונות': ['🪟 Мытьё стёкол изнутри и снаружи', '🧹 Чистка рам, подоконников и решёток', '💧 Сушка и полировка без разводов'],
    'שטיפת רכב': ['🚗 Мойка кузова под давлением', '🧽 Уборка салона — обивка, коврики и багажник', '✨ Мытьё стёкол изнутри'],
    'לאחר שיפוץ': ['🔨 Вывоз мусора, строительной пыли и материалов', '🧴 Глубокая мойка всех полов — паркет, плитка и мрамор', '🪟 Окна и рамы — удаление извести и пятен краски', '🚪 Двери, наличники и ручки', '🪑 Шкафы и полки внутри и снаружи', '🚿 Ванные и туалеты — плитка, раковины и унитазы', '🍳 Кухня — столешницы, раковина и пол', '💡 Светильники, розетки и выключатели', '✅ Финальная тщательная уборка — можно въезжать'],
    'ניקיון משרדים': ['🏢 Мытьё полов и рабочих поверхностей', '🗑️ Вынос мусора и обновление корзин', '🪟 Окна и офисное пространство', '🧴 Дезинфекция туалетов и кухни'],
    'ניקיון אחרי אירוע': ['🎉 Уборка посуды, остатков еды и мусора', '🧹 Мытьё полов и протирка поверхностей', '🗑️ Расстановка и уборка стульев и столов', '✨ Возвращение дома в обычный вид'],
    'מחסן ועליית גג': ['📦 Сортировка и порядок в кладовой', '🧹 Мытьё пола и стен', '🗑️ Вывоз мусора и старых вещей по выбору клиента'],
    'סידורי בגדים וארונות': ['👔 Сортировка одежды по категориям — верх, низ, сезон', '🗂️ Аккуратная и удобная организация шкафов', '👗 Складывание рубашек, брюк и платьев', '🧦 Носки и бельё в отдельных секциях', '🧥 Организация пальто, свитеров и сезонной одежды', '📦 Отбор одежды на пожертвование / сезонное хранение по выбору клиента', '✨ Аккуратный единый порядок, удобный каждый день'],
    'ניקוי חדר מדרגות': ['🪜 Подметание и мытьё лестниц и площадок на всех этажах', '🧽 Протирка перил, дверей, выключателей и светильников', '🚪 Уборка холла, входной двери и почтовых ящиков', '🪟 Мытьё окон на лестнице'],
  },
  ar: {
    'ניקיון רגיל': ['🫧 مسح الأرضيات وتجفيفها في كل الغرف', '🪣 إزالة الغبار عن الأسطح والأثاث والديكور', '🚿 الحمامات والمراحيض — البلاط والمغاسل والمراحيض', '🛋️ ترتيب البيت — ترتيب عام للغرف'],
    'ניקוי לפסח': ['🔍 تنظيف شامل لكل زوايا البيت', '🍞 فحص وإزالة الخميرة (حاميتس) من كل الزوايا', '🧴 تعقيم الأدراج والرفوف والخزائن', '✨ تنظيف الفرن والموقد والأجهزة الكهربائية'],
    'חלונות': ['🪟 غسل الزجاج من الداخل والخارج', '🧹 تنظيف الإطارات وحواف النوافذ والقضبان', '💧 تجفيف وتلميع بدون خطوط'],
    'שטיפת רכב': ['🚗 غسل خارج السيارة بضغط الماء', '🧽 تنظيف داخل السيارة — المقاعد والسجاد والصندوق', '✨ تنظيف النوافذ والزجاج من الداخل'],
    'לאחר שיפוץ': ['🔨 إزالة المخلفات وغبار البناء ومواد الترميم', '🧴 غسل عميق لكل الأرضيات — باركيه وبلاط ورخام', '🪟 تنظيف النوافذ والإطارات — إزالة الجير وبقع الطلاء', '🚪 تنظيف الأبواب والإطارات والمقابض', '🪑 تنظيف الخزائن والرفوف من الداخل والخارج', '🚿 الحمامات والمراحيض — البلاط والمغاسل والمراحيض', '🍳 المطبخ — أسطح العمل والمغسلة والأرضية', '💡 تنظيف وحدات الإنارة والمقابس والمفاتيح', '✅ تنظيف نهائي شامل — البيت جاهز للسكن'],
    'ניקיון משרדים': ['🏢 غسل الأرضيات وأسطح العمل', '🗑️ إفراغ سلال المهملات وتجديدها', '🪟 تنظيف النوافذ ومساحة المكتب', '🧴 تعقيم المراحيض والمطبخ الصغير'],
    'ניקיון אחרי אירוע': ['🎉 إزالة الأطباق وبقايا الطعام والنفايات', '🧹 غسل الأرضيات ومسح الأسطح', '🗑️ ترتيب الكراسي والطاولات وإزالتها', '✨ إعادة البيت إلى وضعه الطبيعي'],
    'מחסן ועליית גג': ['📦 فرز محتويات المخزن وترتيبها', '🧹 غسل الأرضية والجدران وتنظيفها', '🗑️ إزالة النفايات والأغراض القديمة حسب اختيار العميل'],
    'סידורי בגדים וארונות': ['👔 فرز الملابس حسب الفئات — علوية وسفلية ومواسم', '🗂️ ترتيب الخزائن بشكل منظم وسهل الوصول', '👗 طي وترتيب القمصان والسراويل والفساتين', '🧦 ترتيب الجوارب والملابس الداخلية في أقسام خاصة', '🧥 تنظيم المعاطف والكنزات وملابس المواسم', '📦 فرز الملابس للتبرع / التخزين الموسمي حسب اختيار العميل', '✨ ترتيب موحد وأنيق ومريح للاستخدام اليومي'],
    'ניקוי חדר מדרגות': ['🪜 كنس وغسل الدرج والبسطات في كل الطوابق', '🧽 مسح الدرابزين والأبواب والمفاتيح والإنارة', '🚪 تنظيف المدخل وباب الدخول وصناديق البريد', '🪟 تنظيف نوافذ بيت الدرج'],
  },
  fr: {
    'ניקיון רגיל': ['🫧 Lavage et essuyage des sols dans toutes les pièces', '🪣 Dépoussiérage des surfaces, meubles et objets déco', '🚿 Salles de bain et WC — carrelage, lavabos et toilettes', '🛋️ Rangement — ordre général dans les pièces'],
    'ניקוי לפסח': ['🔍 Nettoyage approfondi de tous les recoins', '🍞 Recherche et élimination du hamets partout', '🧴 Désinfection des tiroirs, étagères et placards', '✨ Nettoyage du four, des plaques et des appareils'],
    'חלונות': ['🪟 Lavage des vitres intérieur et extérieur', '🧹 Nettoyage des cadres, rebords et barreaux', '💧 Séchage et lustrage sans traces'],
    'שטיפת רכב': ['🚗 Lavage extérieur haute pression', '🧽 Nettoyage intérieur — sièges, tapis et coffre', '✨ Nettoyage des vitres et du pare-brise à l\'intérieur'],
    'לאחר שיפוץ': ['🔨 Évacuation des gravats, poussière et matériaux', '🧴 Lavage en profondeur de tous les sols — parquet, carrelage et marbre', '🪟 Fenêtres et cadres — retrait du plâtre et des taches de peinture', '🚪 Portes, chambranles et poignées', '🪑 Placards et étagères intérieur et extérieur', '🚿 Salles de bain et WC — carrelage, lavabos et toilettes', '🍳 Cuisine — plans de travail, évier et sol', '💡 Luminaires, prises et interrupteurs', '✅ Nettoyage final complet — prêt à emménager'],
    'ניקיון משרדים': ['🏢 Lavage des sols et des plans de travail', '🗑️ Vidage et renouvellement des poubelles', '🪟 Fenêtres et espace de bureau', '🧴 Désinfection des WC et de la kitchenette'],
    'ניקיון אחרי אירוע': ['🎉 Débarrasser vaisselle, restes et déchets', '🧹 Lavage des sols et essuyage des surfaces', '🗑️ Ranger et retirer chaises et tables', '✨ Remettre la maison en état'],
    'מחסן ועליית גג': ['📦 Tri et rangement du débarras', '🧹 Lavage du sol et des murs', '🗑️ Évacuation des déchets et vieux objets au choix du client'],
    'סידורי בגדים וארונות': ['👔 Tri des vêtements par catégorie — hauts, bas, saisons', '🗂️ Rangement des armoires, ordonné et accessible', '👗 Pliage des chemises, pantalons et robes', '🧦 Chaussettes et sous-vêtements dans leurs cases', '🧥 Organisation des manteaux, pulls et vêtements de saison', '📦 Tri des vêtements à donner / à ranger pour la saison au choix du client', '✨ Un rangement uniforme et pratique au quotidien'],
    'ניקוי חדר מדרגות': ['🪜 Balayage et lavage des marches et paliers à chaque étage', '🧽 Essuyage des rampes, portes, interrupteurs et luminaires', '🚪 Nettoyage du hall, de la porte d\'entrée et des boîtes aux lettres', '🪟 Nettoyage des fenêtres de la cage d\'escalier'],
  },
  hi: {
    'ניקיון רגיל': ['🫧 सभी कमरों में फ़र्श पोंछना और साफ़ करना', '🪣 सतहों, फ़र्नीचर और सजावट की धूल साफ़ करना', '🚿 बाथरूम और शौचालय — टाइल, सिंक और टॉयलेट', '🛋️ घर सँवारना — कमरों में सामान्य व्यवस्था'],
    'ניקוי לפסח': ['🔍 घर के हर कोने की गहरी सफ़ाई', '🍞 हर कोने से खमीर (हामेत्स) की जाँच और सफ़ाई', '🧴 दराज़, अलमारियों और शेल्फ़ का कीटाणुशोधन', '✨ ओवन, चूल्हा और उपकरणों की सफ़ाई'],
    'חלונות': ['🪟 कांच अंदर और बाहर से धोना', '🧹 फ़्रेम, खिड़की के किनारे और ग्रिल की सफ़ाई', '💧 बिना धारियों के सुखाना और चमकाना'],
    'שטיפת רכב': ['🚗 कार का बाहरी हिस्सा प्रेशर से धोना', '🧽 अंदर की सफ़ाई — सीटें, कालीन और डिक्की', '✨ अंदर से खिड़कियाँ और शीशे साफ़ करना'],
    'לאחר שיפוץ': ['🔨 मलबा, निर्माण धूल और सामग्री हटाना', '🧴 सभी फ़र्शों की गहरी धुलाई — पार्केट, टाइल और संगमरमर', '🪟 खिड़कियाँ और फ़्रेम — चूना और पेंट के दाग हटाना', '🚪 दरवाज़े, चौखट और हैंडल', '🪑 अलमारियाँ और शेल्फ़ अंदर-बाहर', '🚿 बाथरूम और शौचालय — टाइल, सिंक और टॉयलेट', '🍳 रसोई — काउंटर, सिंक और फ़र्श', '💡 लाइट फ़िटिंग, सॉकेट और स्विच', '✅ अंतिम गहरी सफ़ाई — रहने के लिए तैयार'],
    'ניקיון משרדים': ['🏢 फ़र्श और कार्य सतहें धोना', '🗑️ कूड़ेदान खाली करना और बदलना', '🪟 खिड़कियाँ और दफ़्तर की जगह', '🧴 शौचालय और किचनेट का कीटाणुशोधन'],
    'ניקיון אחרי אירוע': ['🎉 बर्तन, बचा खाना और कूड़ा हटाना', '🧹 फ़र्श धोना और सतहें पोंछना', '🗑️ कुर्सियाँ और मेज़ें व्यवस्थित करना और हटाना', '✨ घर को सामान्य स्थिति में लाना'],
    'מחסן ועליית גג': ['📦 स्टोर रूम का सामान छाँटना और जमाना', '🧹 फ़र्श और दीवारें धोना और साफ़ करना', '🗑️ ग्राहक की पसंद से कूड़ा और पुराना सामान हटाना'],
    'סידורי בגדים וארונות': ['👔 कपड़ों को श्रेणी के अनुसार छाँटना — ऊपर, नीचे, मौसम', '🗂️ अलमारियों को व्यवस्थित और सुलभ बनाना', '👗 शर्ट, पैंट और ड्रेस तह करके रखना', '🧦 मोज़े और अंतर्वस्त्र अलग खानों में', '🧥 कोट, स्वेटर और मौसमी कपड़े व्यवस्थित करना', '📦 ग्राहक की पसंद से दान / मौसमी भंडारण के कपड़े छाँटना', '✨ एक-सी सुंदर व्यवस्था जो रोज़ इस्तेमाल में आसान हो'],
    'ניקוי חדר מדרגות': ['🪜 हर मंज़िल पर सीढ़ियों और लैंडिंग की झाड़ू और धुलाई', '🧽 रेलिंग, दरवाज़े, स्विच और लाइटें पोंछना', '🚪 लॉबी, प्रवेश द्वार और मेलबॉक्स की सफ़ाई', '🪟 सीढ़ियों की खिड़कियों की सफ़ाई'],
  },
  uk: {
    'ניקיון רגיל': ['🫧 Миття та протирання підлоги в усіх кімнатах', '🪣 Прибирання пилу з поверхонь, меблів і декору', '🚿 Ванні й туалети — плитка, раковини та унітази', '🛋️ Прибирання — загальний порядок у кімнатах'],
    'ניקוי לפסח': ['🔍 Ретельне прибирання всіх куточків дому', '🍞 Перевірка й прибирання хамецу звідусіль', '🧴 Дезінфекція шухляд, полиць і шаф', '✨ Чищення духовки, плити й техніки'],
    'חלונות': ['🪟 Миття шибок зсередини й ззовні', '🧹 Чищення рам, підвіконь і ґрат', '💧 Сушіння й полірування без розводів'],
    'שטיפת רכב': ['🚗 Миття кузова під тиском', '🧽 Прибирання салону — оббивка, килимки й багажник', '✨ Миття вікон і скла зсередини'],
    'לאחר שיפוץ': ['🔨 Вивезення сміття, будівельного пилу й матеріалів', '🧴 Глибоке миття всіх підлог — паркет, плитка й мармур', '🪟 Вікна й рами — видалення вапна та плям фарби', '🚪 Двері, лутки й ручки', '🪑 Шафи й полиці зсередини та ззовні', '🚿 Ванні й туалети — плитка, раковини та унітази', '🍳 Кухня — стільниці, раковина й підлога', '💡 Світильники, розетки й вимикачі', '✅ Фінальне ретельне прибирання — можна заселятися'],
    'ניקיון משרדים': ['🏢 Миття підлоги й робочих поверхонь', '🗑️ Винесення сміття й оновлення кошиків', '🪟 Вікна й офісний простір', '🧴 Дезінфекція туалетів і кухні'],
    'ניקיון אחרי אירוע': ['🎉 Прибирання посуду, залишків їжі та сміття', '🧹 Миття підлоги й протирання поверхонь', '🗑️ Розстановка й прибирання стільців і столів', '✨ Повернення дому до звичайного вигляду'],
    'מחסן ועליית גג': ['📦 Сортування й порядок у коморі', '🧹 Миття підлоги та стін', '🗑️ Вивезення сміття й старих речей на вибір клієнта'],
    'סידורי בגדים וארונות': ['👔 Сортування одягу за категоріями — верх, низ, сезон', '🗂️ Охайна й зручна організація шаф', '👗 Складання сорочок, штанів і суконь', '🧦 Шкарпетки й білизна в окремих секціях', '🧥 Організація пальт, светрів і сезонного одягу', '📦 Відбір одягу на пожертву / сезонне зберігання на вибір клієнта', '✨ Охайний єдиний порядок, зручний щодня'],
    'ניקוי חדר מדרגות': ['🪜 Підмітання й миття сходів і майданчиків на всіх поверхах', '🧽 Протирання поручнів, дверей, вимикачів і світильників', '🚪 Прибирання холу, вхідних дверей і поштових скриньок', '🪟 Миття вікон на сходах'],
  },
};

/** The lines for one service in `lang`; Hebrew when there is no translation. */
export function serviceLinesFor(key: string, lang: string): string[] {
  const he = SERVICE_DESCRIPTIONS[key] ?? [];
  const tr = LINES[lang]?.[key];
  return tr && tr.length === he.length ? tr : he;
}
