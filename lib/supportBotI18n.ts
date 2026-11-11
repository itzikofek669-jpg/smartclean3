/**
 * The support assistant in English, Russian, Arabic, French, Hindi and
 * Ukrainian (Ofek, 11.11.2026: "the support bot in every language").
 *
 * The Hebrew assistant (app/support.tsx in the app, src/lib/supportBot.ts on
 * the website) stays exactly as it is — it matches Hebrew words and answers in
 * Hebrew. In the other six languages both screens ask this one instead: the
 * same topics, the same live answers (the booking's status, the provider, the
 * cleaner's jobs and earnings) and the same two actions (an e-mail to support,
 * a jump to the profile or home screen).
 *
 * Shared: byte-identical in the app (lib/) and the website (src/lib/).
 */

export type BotLang = 'en' | 'ru' | 'ar' | 'fr' | 'hi' | 'uk';
export const BOT_LANGS: BotLang[] = ['en', 'ru', 'ar', 'fr', 'hi', 'uk'];

export interface I18nBotCtx {
  userName: string;
  role: 'client' | 'cleaner' | 'admin' | null;
  activeBooking: any | null;
  allBookings: any[];
}

export interface I18nBotResp {
  text: string;
  quickReplies?: string[];
  navigateTo?: string;
  action?: 'sendEmail';
}

type L = Record<BotLang, string>;

// ── Words ─────────────────────────────────────────────────────────────────────

const STATUS: Record<string, L> = {
  pending:   { en: '⏳ Waiting for the provider to confirm', ru: '⏳ Ждёт подтверждения исполнителя', ar: '⏳ بانتظار تأكيد مقدم الخدمة', fr: '⏳ En attente de confirmation du prestataire', hi: '⏳ सेवा प्रदाता की पुष्टि का इंतज़ार', uk: '⏳ Чекає на підтвердження виконавця' },
  confirmed: { en: '✅ Confirmed', ru: '✅ Подтверждено', ar: '✅ مؤكد', fr: '✅ Confirmé', hi: '✅ पुष्टि हुई', uk: '✅ Підтверджено' },
  onway:     { en: '🚗 The provider is on the way to you now!', ru: '🚗 Исполнитель уже едет к вам!', ar: '🚗 مقدم الخدمة في الطريق إليك الآن!', fr: '🚗 Le prestataire est en route vers vous !', hi: '🚗 सेवा प्रदाता अभी आपके पास आ रहा है!', uk: '🚗 Виконавець уже їде до вас!' },
  active:    { en: '🧹 The cleaning is in progress', ru: '🧹 Уборка идёт сейчас', ar: '🧹 التنظيف جارٍ الآن', fr: '🧹 Le ménage est en cours', hi: '🧹 सफ़ाई चल रही है', uk: '🧹 Прибирання триває' },
  done:      { en: '✅ The cleaning is done', ru: '✅ Уборка завершена', ar: '✅ انتهى التنظيف', fr: '✅ Le ménage est terminé', hi: '✅ सफ़ाई पूरी हुई', uk: '✅ Прибирання завершено' },
  cancelled: { en: '❌ The booking was cancelled', ru: '❌ Заказ отменён', ar: '❌ تم إلغاء الحجز', fr: '❌ La réservation a été annulée', hi: '❌ बुकिंग रद्द हुई', uk: '❌ Замовлення скасовано' },
};

/** Quick-reply buttons. A tap sends the label back, and is recognised by it. */
const QR: Record<string, L> = {
  status:       { en: "What's my status?", ru: 'Какой у меня статус?', ar: 'ما حالة حجزي؟', fr: 'Où en est ma réservation ?', hi: 'मेरी स्थिति क्या है?', uk: 'Який у мене статус?' },
  cancel:       { en: 'I want to cancel', ru: 'Хочу отменить', ar: 'أريد الإلغاء', fr: 'Je veux annuler', hi: 'मैं रद्द करना चाहता हूँ', uk: 'Хочу скасувати' },
  price:        { en: 'How much does it cost?', ru: 'Сколько это стоит?', ar: 'كم التكلفة؟', fr: 'Combien ça coûte ?', hi: 'इसकी कीमत कितनी है?', uk: 'Скільки це коштує?' },
  provider:     { en: 'Provider details', ru: 'Данные исполнителя', ar: 'تفاصيل مقدم الخدمة', fr: 'Infos du prestataire', hi: 'सेवा प्रदाता का विवरण', uk: 'Дані виконавця' },
  urgent:       { en: 'Urgent cleaning', ru: 'Срочная уборка', ar: 'تنظيف عاجل', fr: 'Ménage urgent', hi: 'तत्काल सफ़ाई', uk: 'Термінове прибирання' },
  book:         { en: 'How do I book?', ru: 'Как заказать?', ar: 'كيف أحجز؟', fr: 'Comment réserver ?', hi: 'बुकिंग कैसे करें?', uk: 'Як замовити?' },
  payment:      { en: 'How do I pay?', ru: 'Как оплатить?', ar: 'كيف أدفع؟', fr: 'Comment payer ?', hi: 'भुगतान कैसे करें?', uk: 'Як оплатити?' },
  myBookings:   { en: 'My bookings', ru: 'Мои заказы', ar: 'حجوزاتي', fr: 'Mes réservations', hi: 'मेरी बुकिंग्स', uk: 'Мої замовлення' },
  earnings:     { en: 'How much did I earn?', ru: 'Сколько я заработал(а)?', ar: 'كم ربحت؟', fr: "Combien j'ai gagné ?", hi: 'मैंने कितना कमाया?', uk: 'Скільки я заробив(ла)?' },
  gettingPaid:  { en: 'How do I get paid?', ru: 'Как я получаю оплату?', ar: 'كيف أستلم أجري؟', fr: 'Comment suis-je payé(e) ?', hi: 'मुझे भुगतान कैसे मिलता है?', uk: 'Як я отримую оплату?' },
  availability: { en: 'Update my availability', ru: 'Обновить доступность', ar: 'تحديث أوقات التوفر', fr: 'Mettre à jour mes disponibilités', hi: 'उपलब्धता अपडेट करें', uk: 'Оновити доступність' },
  getJobs:      { en: 'How do I get more jobs?', ru: 'Как получать больше заказов?', ar: 'كيف أحصل على أعمال أكثر؟', fr: "Comment avoir plus de missions ?", hi: 'ज़्यादा काम कैसे मिले?', uk: 'Як отримувати більше замовлень?' },
  commission:   { en: 'Commission', ru: 'Комиссия', ar: 'العمولة', fr: 'Commission', hi: 'कमीशन', uk: 'Комісія' },
  contact:      { en: 'Contact us', ru: 'Связаться с нами', ar: 'تواصل معنا', fr: 'Nous contacter', hi: 'हमसे संपर्क करें', uk: "Зв'язатися з нами" },
  menu:         { en: 'Back to the menu', ru: 'Назад в меню', ar: 'العودة إلى القائمة', fr: 'Retour au menu', hi: 'मेनू पर वापस', uk: 'Назад до меню' },
};

/** Free text: words that point at a topic, per language (lower case). */
const KW: Record<string, Record<BotLang, string[]>> = {
  greet: {
    en: ['hello', 'hi ', 'hey', 'good morning', 'good evening', 'good afternoon'],
    ru: ['привет', 'здравств', 'добрый', 'доброе'],
    ar: ['مرحبا', 'مرحبًا', 'السلام', 'اهلا', 'أهلا', 'صباح', 'مساء'],
    fr: ['bonjour', 'salut', 'bonsoir', 'coucou'],
    hi: ['नमस्ते', 'हैलो', 'हाय', 'नमस्कार'],
    uk: ['привіт', 'вітаю', 'добрий', 'доброго'],
  },
  thanks: {
    en: ['thank', 'great', 'perfect', 'awesome'],
    ru: ['спасибо', 'отлично', 'супер'],
    ar: ['شكرا', 'شكرًا', 'ممتاز', 'رائع'],
    fr: ['merci', 'parfait', 'génial', 'super'],
    hi: ['धन्यवाद', 'शुक्रिया', 'बढ़िया'],
    uk: ['дякую', 'чудово', 'супер'],
  },
  earnings: {
    en: ['earn', 'income', 'made this month', 'how much did i'],
    ru: ['заработ', 'доход'],
    ar: ['ربحت', 'أرباح', 'ارباح', 'دخل'],
    fr: ['gagné', 'gagne', 'revenu'],
    hi: ['कमाया', 'कमाई', 'आय'],
    uk: ['заробив', 'заробила', 'заробі', 'дохід'],
  },
  gettingPaid: {
    en: ['get paid', 'receive payment', 'paid by the client', 'my money'],
    ru: ['получ оплат', 'получаю оплат', 'получить оплат', 'мне платят'],
    ar: ['أستلم أجري', 'استلام الدفع', 'أتقاضى', 'أجري'],
    fr: ['être payé', 'suis-je payé', 'recevoir le paiement', 'je suis payé'],
    hi: ['भुगतान मिल', 'पैसे मिल'],
    uk: ['отримую оплат', 'отримати оплат', 'мені платять'],
  },
  commission: {
    en: ['commission', 'fee', 'cut', 'percent'],
    ru: ['комисс', 'процент'],
    ar: ['عمولة', 'نسبة', 'رسوم'],
    fr: ['commission', 'frais', 'pourcentage'],
    hi: ['कमीशन', 'शुल्क', 'प्रतिशत'],
    uk: ['коміс', 'відсот'],
  },
  availability: {
    en: ['availab', 'working hours', 'work days', 'schedule', 'day off'],
    ru: ['доступн', 'график', 'рабочие дни', 'часы работы', 'выходн'],
    ar: ['التوفر', 'متاح', 'ساعات العمل', 'أيام العمل', 'جدول'],
    fr: ['disponib', 'horaires', 'jours de travail', 'planning'],
    hi: ['उपलब्ध', 'काम के घंटे', 'काम के दिन', 'शेड्यूल'],
    uk: ['доступн', 'графік', 'робочі дні', 'години роботи', 'вихідн'],
  },
  getJobs: {
    en: ['more jobs', 'get jobs', 'more work', 'job board', 'no jobs', 'more bookings'],
    ru: ['больше заказов', 'больше работы', 'доска', 'нет заказов'],
    ar: ['أعمال أكثر', 'المزيد من العمل', 'لوحة', 'لا يوجد عمل', 'حجوزات أكثر'],
    fr: ['plus de missions', 'plus de travail', 'tableau', 'pas de missions'],
    hi: ['ज़्यादा काम', 'अधिक काम', 'बोर्ड', 'काम नहीं'],
    uk: ['більше замовлень', 'більше роботи', 'дошка', 'немає замовлень'],
  },
  invoices: {
    en: ['invoice', 'receipt', 'tax'],
    ru: ['счёт', 'счет-факт', 'чек', 'налог'],
    ar: ['فاتورة', 'إيصال', 'ضريبة', 'ضرائب'],
    fr: ['facture', 'reçu', 'impôt', 'taxe'],
    hi: ['चालान', 'रसीद', 'टैक्स', 'कर'],
    uk: ['рахунок', 'чек', 'податк'],
  },
  status: {
    en: ['status', 'where is', 'when will', 'arrive', 'coming', 'on the way'],
    ru: ['статус', 'где ', 'когда приед', 'приедет', 'придёт', 'в пути'],
    ar: ['حالة', 'أين', 'متى يصل', 'يصل', 'في الطريق'],
    fr: ['statut', 'où en est', 'quand arrive', 'arrive', 'en route'],
    hi: ['स्थिति', 'कहाँ', 'कब आएगा', 'पहुँच', 'रास्ते में'],
    uk: ['статус', 'де ', 'коли приїде', 'приїде', 'прийде', 'в дорозі'],
  },
  myBookings: {
    en: ['my bookings', 'my jobs', 'my orders', 'history', 'past bookings', 'upcoming'],
    ru: ['мои заказы', 'мои работы', 'истори', 'прошлые'],
    ar: ['حجوزاتي', 'أعمالي', 'السجل', 'الحجوزات السابقة', 'القادمة'],
    fr: ['mes réservations', 'mes missions', 'historique', 'à venir'],
    hi: ['मेरी बुकिंग्स', 'मेरी बुकिंग', 'मेरे काम', 'इतिहास'],
    uk: ['мої замовлення', 'мої роботи', 'істор', 'минулі'],
  },
  cancel: {
    en: ['cancel', 'refund'],
    ru: ['отмен', 'возврат', 'вернуть деньги'],
    ar: ['إلغاء', 'الغاء', 'ألغي', 'الغي', 'استرداد', 'استرجاع'],
    fr: ['annul', 'rembours'],
    hi: ['रद्द', 'रिफंड', 'पैसे वापस'],
    uk: ['скасув', 'поверн'],
  },
  urgent: {
    en: ['urgent', 'today', 'right now', 'asap', 'express'],
    ru: ['срочн', 'сегодня', 'прямо сейчас'],
    ar: ['عاجل', 'اليوم', 'الآن', 'فورًا', 'فورا'],
    fr: ['urgent', "aujourd'hui", 'tout de suite', 'express'],
    hi: ['तत्काल', 'आज', 'अभी', 'जल्दी'],
    uk: ['термін', 'сьогодні', 'прямо зараз'],
  },
  price: {
    en: ['price', 'cost', 'how much', 'rate', 'expensive', 'cheap'],
    ru: ['цена', 'стоим', 'сколько', 'тариф', 'дорого'],
    ar: ['سعر', 'تكلفة', 'بكم', 'كم يكلف', 'كم السعر', 'كم التكلفة', 'تعرفة', 'غالي'],
    fr: ['prix', 'coût', 'coute', 'coûte', 'combien', 'tarif'],
    hi: ['कीमत', 'दाम', 'कितना', 'रेट', 'महंगा'],
    uk: ['ціна', 'вартість', 'скільки', 'тариф', 'дорого'],
  },
  provider: {
    en: ['provider', 'cleaner', 'who is coming', 'phone number'],
    ru: ['исполнител', 'уборщ', 'кто придёт', 'телефон'],
    ar: ['مقدم الخدمة', 'منظف', 'منظفة', 'من سيأتي', 'رقم الهاتف'],
    fr: ['prestataire', 'femme de ménage', 'qui vient', 'téléphone'],
    hi: ['सेवा प्रदाता', 'सफ़ाईकर्मी', 'कौन आएगा', 'फ़ोन नंबर'],
    uk: ['виконав', 'прибиральн', 'хто прийде', 'телефон'],
  },
  payment: {
    en: ['pay', 'cash', 'bit', 'paybox', 'bank transfer', 'card'],
    ru: ['оплат', 'налич', 'карт', 'перевод'],
    ar: ['دفع', 'أدفع', 'نقد', 'بطاقة', 'تحويل'],
    fr: ['payer', 'paiement', 'espèces', 'carte', 'virement'],
    hi: ['भुगतान', 'नकद', 'कार्ड', 'ट्रांसफ़र'],
    uk: ['оплат', 'готівк', 'картк', 'переказ'],
  },
  book: {
    en: ['book', 'order a', 'schedule a', 'new booking', 'hire'],
    ru: ['заказать', 'записаться', 'новый заказ', 'вызвать'],
    ar: ['أحجز', 'احجز', 'حجز جديد', 'أطلب'],
    fr: ['réserver', 'commander', 'nouvelle réservation'],
    hi: ['बुक', 'बुकिंग करें', 'नई बुकिंग'],
    uk: ['замовити', 'нове замовлення', 'викликати'],
  },
  rating: {
    en: ['rate', 'rating', 'review', 'stars'],
    ru: ['оцен', 'отзыв', 'звезд'],
    ar: ['تقييم', 'مراجعة', 'نجوم', 'نجمة'],
    fr: ['noter', 'note', 'avis', 'étoile'],
    hi: ['रेटिंग', 'समीक्षा', 'स्टार'],
    uk: ['оцін', 'відгук', 'зір'],
  },
  safety: {
    en: ['damage', 'insurance', 'broke', 'stolen', 'complaint', 'problem', 'unsafe', 'rude'],
    ru: ['ущерб', 'страхов', 'слома', 'разбил', 'украл', 'жалоб', 'проблем', 'груб'],
    ar: ['ضرر', 'تأمين', 'كسر', 'سرق', 'شكوى', 'مشكلة', 'وقح'],
    fr: ['dommage', 'assurance', 'cassé', 'volé', 'plainte', 'problème', 'impoli'],
    hi: ['नुकसान', 'बीमा', 'टूट', 'चोरी', 'शिकायत', 'समस्या', 'बदतमीज़'],
    uk: ['шкод', 'страху', 'злама', 'розбил', 'вкра', 'скарг', 'проблем', 'груб'],
  },
  account: {
    en: ['password', 'log in', 'login', 'sign in', 'account', 'email', 'delete my'],
    ru: ['пароль', 'войти', 'вход', 'аккаунт', 'учётн', 'почт', 'удалить'],
    ar: ['كلمة المرور', 'تسجيل الدخول', 'حساب', 'البريد', 'حذف'],
    fr: ['mot de passe', 'connexion', 'connecter', 'compte', 'e-mail', 'supprimer'],
    hi: ['पासवर्ड', 'लॉगिन', 'लॉग इन', 'खाता', 'ईमेल', 'हटाना'],
    uk: ['пароль', 'увійти', 'вхід', 'обліков', 'пошт', 'видалити'],
  },
  included: {
    en: ['included', 'materials', 'equipment', 'supplies', 'products', 'what do they bring'],
    ru: ['входит', 'материал', 'инвентар', 'средств'],
    ar: ['يشمل', 'مواد', 'معدات', 'أدوات'],
    fr: ['inclus', 'produits', 'matériel', 'équipement'],
    hi: ['शामिल', 'सामग्री', 'उपकरण', 'सामान'],
    uk: ['входить', 'матеріал', 'інвентар', 'засоб'],
  },
  join: {
    en: ['become a provider', 'work with you', 'join as', 'register as a provider', 'work as a cleaner'],
    ru: ['стать исполнител', 'работать у вас', 'работать с вами'],
    ar: ['أصبح مقدم', 'العمل معكم', 'أنضم', 'انضم'],
    fr: ['devenir prestataire', 'travailler avec vous', 'rejoindre'],
    hi: ['सेवा प्रदाता बनना', 'आपके साथ काम', 'जुड़ना'],
    uk: ['стати виконав', 'працювати з вами', 'працювати у вас'],
  },
  language: {
    en: ['language', 'hebrew', 'english'],
    ru: ['язык'],
    ar: ['لغة', 'اللغة'],
    fr: ['langue'],
    hi: ['भाषा'],
    uk: ['мова', 'мову'],
  },
  contact: {
    en: ['contact', 'human', 'agent', 'support', 'talk to', 'speak to', 'help me'],
    ru: ['связ', 'поддержк', 'оператор', 'человек', 'помогите'],
    ar: ['تواصل', 'اتصل', 'الدعم', 'موظف', 'إنسان', 'ساعدني'],
    fr: ['contact', 'support', 'humain', 'parler', 'aidez'],
    hi: ['संपर्क', 'सहायता', 'इंसान', 'बात करनी', 'मदद'],
    uk: ["зв'яз", 'звяз', 'підтрим', 'оператор', 'людин', 'допоможіть'],
  },
};

// ── Answers ───────────────────────────────────────────────────────────────────

const A: Record<string, L> = {
  welcomeClient: {
    en: 'Hi {name}! 👋\nI\'m the A&M Clean support assistant. How can we help you today?',
    ru: 'Здравствуйте, {name}! 👋\nЯ помощник поддержки A&M Clean. Чем можем помочь?',
    ar: 'مرحبًا {name}! 👋\nأنا مساعد الدعم في A&M Clean. كيف يمكننا مساعدتك اليوم؟',
    fr: 'Bonjour {name} ! 👋\nJe suis l\'assistant du support A&M Clean. Comment pouvons-nous vous aider ?',
    hi: 'नमस्ते {name}! 👋\nमैं A&M Clean का सहायता सहायक हूँ। आज हम आपकी कैसे मदद करें?',
    uk: 'Вітаю, {name}! 👋\nЯ помічник підтримки A&M Clean. Чим можемо допомогти?',
  },
  welcomeCleaner: {
    en: 'Hi {name}! 👋\nI\'m the A&M Clean support assistant. What can I help you with?',
    ru: 'Здравствуйте, {name}! 👋\nЯ помощник поддержки A&M Clean. С чем помочь?',
    ar: 'مرحبًا {name}! 👋\nأنا مساعد الدعم في A&M Clean. بماذا أساعدك؟',
    fr: 'Bonjour {name} ! 👋\nJe suis l\'assistant du support A&M Clean. Sur quoi puis-je vous aider ?',
    hi: 'नमस्ते {name}! 👋\nमैं A&M Clean का सहायता सहायक हूँ। किसमें मदद चाहिए?',
    uk: 'Вітаю, {name}! 👋\nЯ помічник підтримки A&M Clean. З чим допомогти?',
  },
  greet: {
    en: 'Hi {name}! 👋 Glad you reached out — what can we help with?',
    ru: 'Здравствуйте, {name}! 👋 Рады, что вы написали — чем помочь?',
    ar: 'مرحبًا {name}! 👋 سعداء بتواصلك — بماذا نساعدك؟',
    fr: 'Bonjour {name} ! 👋 Ravis de vous lire — en quoi pouvons-nous aider ?',
    hi: 'नमस्ते {name}! 👋 अच्छा लगा कि आपने संपर्क किया — क्या मदद करें?',
    uk: 'Вітаю, {name}! 👋 Раді, що ви написали — чим допомогти?',
  },
  thanks: {
    en: 'You\'re welcome, {name}! 🌟 Is there anything else we can help with?',
    ru: 'Пожалуйста, {name}! 🌟 Можем помочь с чем-то ещё?',
    ar: 'على الرحب والسعة يا {name}! 🌟 هل يمكننا المساعدة في شيء آخر؟',
    fr: 'Avec plaisir, {name} ! 🌟 Autre chose pour vous aider ?',
    hi: 'आपका स्वागत है, {name}! 🌟 क्या कुछ और मदद चाहिए?',
    uk: 'Будь ласка, {name}! 🌟 Можемо допомогти з чимось іще?',
  },
  noActive: {
    en: 'You have no active booking right now.\n\nTo book a cleaning, pick a provider on the home screen, or post a job and let providers come to you.',
    ru: 'Сейчас у вас нет активного заказа.\n\nЧтобы заказать уборку, выберите исполнителя на главном экране или опубликуйте заказ — исполнители откликнутся сами.',
    ar: 'لا يوجد لديك حجز نشط الآن.\n\nلحجز تنظيف، اختر مقدم خدمة من الشاشة الرئيسية، أو انشر طلبًا ودع مقدمي الخدمة يتواصلون معك.',
    fr: "Vous n'avez pas de réservation en cours.\n\nPour réserver, choisissez un prestataire sur l'écran d'accueil, ou publiez une demande et laissez les prestataires venir à vous.",
    hi: 'अभी आपकी कोई सक्रिय बुकिंग नहीं है।\n\nसफ़ाई बुक करने के लिए होम स्क्रीन पर सेवा प्रदाता चुनें, या काम पोस्ट करें और प्रदाता आपसे संपर्क करेंगे।',
    uk: 'Зараз у вас немає активного замовлення.\n\nЩоб замовити прибирання, оберіть виконавця на головному екрані або опублікуйте замовлення — виконавці відгукнуться самі.',
  },
  status: {
    en: '📋 Your booking:\n\n{status}\n📅 {when}\n✨ Provider: {provider}',
    ru: '📋 Ваш заказ:\n\n{status}\n📅 {when}\n✨ Исполнитель: {provider}',
    ar: '📋 حجزك:\n\n{status}\n📅 {when}\n✨ مقدم الخدمة: {provider}',
    fr: '📋 Votre réservation :\n\n{status}\n📅 {when}\n✨ Prestataire : {provider}',
    hi: '📋 आपकी बुकिंग:\n\n{status}\n📅 {when}\n✨ सेवा प्रदाता: {provider}',
    uk: '📋 Ваше замовлення:\n\n{status}\n📅 {when}\n✨ Виконавець: {provider}',
  },
  cancel: {
    en: '❌ Cancelling a booking:\n\nOpen the booking in your profile and tap "Cancel booking".\n\n• More than 24 hours before — free\n• Less than 24 hours before — please agree it with the provider in the chat\n\nPayment goes directly between you and the provider, so any refund is arranged with them.',
    ru: '❌ Отмена заказа:\n\nОткройте заказ в профиле и нажмите «Отменить заказ».\n\n• Более чем за 24 часа — бесплатно\n• Менее чем за 24 часа — согласуйте с исполнителем в чате\n\nОплата идёт напрямую между вами и исполнителем, поэтому возврат согласуется с ним.',
    ar: '❌ إلغاء حجز:\n\nافتح الحجز في ملفك الشخصي واضغط "إلغاء الحجز".\n\n• قبل أكثر من 24 ساعة — مجانًا\n• قبل أقل من 24 ساعة — يرجى الاتفاق مع مقدم الخدمة في المحادثة\n\nالدفع يتم مباشرة بينك وبين مقدم الخدمة، لذا يتم ترتيب أي استرداد معه.',
    fr: "❌ Annuler une réservation :\n\nOuvrez la réservation dans votre profil et touchez « Annuler la réservation ».\n\n• Plus de 24 h avant — gratuit\n• Moins de 24 h avant — merci de vous mettre d'accord avec le prestataire dans la discussion\n\nLe paiement se fait directement entre vous et le prestataire : un éventuel remboursement se règle avec lui.",
    hi: '❌ बुकिंग रद्द करना:\n\nप्रोफ़ाइल में बुकिंग खोलें और "बुकिंग रद्द करें" दबाएँ।\n\n• 24 घंटे से पहले — मुफ़्त\n• 24 घंटे से कम पहले — कृपया चैट में सेवा प्रदाता से तय करें\n\nभुगतान सीधे आपके और सेवा प्रदाता के बीच होता है, इसलिए रिफंड उन्हीं से तय होता है।',
    uk: '❌ Скасування замовлення:\n\nВідкрийте замовлення в профілі й натисніть «Скасувати замовлення».\n\n• Більш ніж за 24 години — безкоштовно\n• Менш ніж за 24 години — домовтеся з виконавцем у чаті\n\nОплата йде напряму між вами й виконавцем, тож повернення узгоджується з ним.',
  },
  price: {
    en: '💰 Prices:\n\nEach provider sets their own hourly rate — you see it on their card before booking. A&M Clean charges no commission: 100% goes to the provider.',
    ru: '💰 Цены:\n\nКаждый исполнитель сам устанавливает почасовую ставку — она видна на карточке до заказа. A&M Clean не берёт комиссию: 100% получает исполнитель.',
    ar: '💰 الأسعار:\n\nيحدد كل مقدم خدمة سعره بالساعة — تراه على بطاقته قبل الحجز. لا تأخذ A&M Clean أي عمولة: 100% تذهب لمقدم الخدمة.',
    fr: "💰 Les prix :\n\nChaque prestataire fixe son tarif horaire — vous le voyez sur sa fiche avant de réserver. A&M Clean ne prend aucune commission : 100 % vont au prestataire.",
    hi: '💰 कीमतें:\n\nहर सेवा प्रदाता अपनी प्रति घंटा दर खुद तय करता है — बुकिंग से पहले उसके कार्ड पर दिखती है। A&M Clean कोई कमीशन नहीं लेता: 100% प्रदाता को मिलता है।',
    uk: '💰 Ціни:\n\nКожен виконавець сам встановлює погодинну ставку — її видно на картці до замовлення. A&M Clean не бере комісії: 100% отримує виконавець.',
  },
  priceActive: {
    en: '💰 Your current booking: ₪{total}{hours}.',
    ru: '💰 Ваш текущий заказ: ₪{total}{hours}.',
    ar: '💰 حجزك الحالي: ₪{total}{hours}.',
    fr: '💰 Votre réservation en cours : ₪{total}{hours}.',
    hi: '💰 आपकी मौजूदा बुकिंग: ₪{total}{hours}।',
    uk: '💰 Ваше поточне замовлення: ₪{total}{hours}.',
  },
  hoursPart: { en: ' ({h} hours)', ru: ' ({h} ч)', ar: ' ({h} ساعات)', fr: ' ({h} h)', hi: ' ({h} घंटे)', uk: ' ({h} год)' },
  provider: {
    en: '✨ Your provider: {provider}\n\nYou can chat with them from the booking card — the phone and full address are shared once the booking is confirmed.',
    ru: '✨ Ваш исполнитель: {provider}\n\nНаписать ему можно с карточки заказа — телефон и полный адрес открываются после подтверждения заказа.',
    ar: '✨ مقدم الخدمة لديك: {provider}\n\nيمكنك محادثته من بطاقة الحجز — يتم مشاركة الهاتف والعنوان الكامل بعد تأكيد الحجز.',
    fr: "✨ Votre prestataire : {provider}\n\nVous pouvez lui écrire depuis la fiche de réservation — le téléphone et l'adresse complète sont partagés une fois la réservation confirmée.",
    hi: '✨ आपके सेवा प्रदाता: {provider}\n\nबुकिंग कार्ड से उनसे चैट कर सकते हैं — फ़ोन और पूरा पता बुकिंग की पुष्टि के बाद साझा होता है।',
    uk: '✨ Ваш виконавець: {provider}\n\nНаписати йому можна з картки замовлення — телефон і повна адреса відкриваються після підтвердження.',
  },
  noProvider: {
    en: 'You have no booking with a provider right now. Provider cards on the home screen show their rating, price, town and services.',
    ru: 'Сейчас у вас нет заказа с исполнителем. На главном экране в карточках видны рейтинг, цена, город и услуги.',
    ar: 'لا يوجد لديك حجز مع مقدم خدمة الآن. تعرض بطاقات مقدمي الخدمة في الشاشة الرئيسية التقييم والسعر والمدينة والخدمات.',
    fr: "Vous n'avez pas de réservation avec un prestataire pour le moment. Sur l'écran d'accueil, les fiches montrent la note, le prix, la ville et les services.",
    hi: 'अभी किसी सेवा प्रदाता के साथ आपकी बुकिंग नहीं है। होम स्क्रीन पर कार्ड में रेटिंग, कीमत, शहर और सेवाएँ दिखती हैं।',
    uk: 'Зараз у вас немає замовлення з виконавцем. На головному екрані в картках видно рейтинг, ціну, місто й послуги.',
  },
  payment: {
    en: '💳 Paying:\n\nYou pay the provider directly at the end of the cleaning — cash, Bit, PayBox or bank transfer, whichever their card lists. Nothing is charged through the app.',
    ru: '💳 Оплата:\n\nВы платите исполнителю напрямую в конце уборки — наличными, Bit, PayBox или переводом, как указано в его карточке. Через приложение ничего не списывается.',
    ar: '💳 الدفع:\n\nتدفع لمقدم الخدمة مباشرة في نهاية التنظيف — نقدًا أو Bit أو PayBox أو تحويل بنكي، حسب ما يظهر في بطاقته. لا يتم تحصيل أي مبلغ عبر التطبيق.',
    fr: "💳 Payer :\n\nVous payez le prestataire directement à la fin du ménage — espèces, Bit, PayBox ou virement, selon ce qu'indique sa fiche. Rien n'est prélevé via l'application.",
    hi: '💳 भुगतान:\n\nसफ़ाई के अंत में आप सीधे सेवा प्रदाता को भुगतान करते हैं — नकद, Bit, PayBox या बैंक ट्रांसफ़र, जो उनके कार्ड पर हो। ऐप से कुछ नहीं कटता।',
    uk: '💳 Оплата:\n\nВи платите виконавцю напряму після прибирання — готівкою, Bit, PayBox чи переказом, як указано в його картці. Через застосунок нічого не списується.',
  },
  book: {
    en: '🧹 Booking a cleaning:\n\n1️⃣ On the home screen pick a provider (by rating, price or distance)\n2️⃣ Tap "Book now"\n3️⃣ Choose the service, hours and date\n4️⃣ Confirm the address and send\n\nThe provider confirms, and you get a notification.',
    ru: '🧹 Как заказать уборку:\n\n1️⃣ На главном экране выберите исполнителя (по рейтингу, цене или расстоянию)\n2️⃣ Нажмите «Заказать»\n3️⃣ Выберите услугу, часы и дату\n4️⃣ Подтвердите адрес и отправьте\n\nИсполнитель подтвердит заказ, и вы получите уведомление.',
    ar: '🧹 حجز تنظيف:\n\n1️⃣ في الشاشة الرئيسية اختر مقدم خدمة (حسب التقييم أو السعر أو المسافة)\n2️⃣ اضغط "احجز الآن"\n3️⃣ اختر الخدمة والساعات والتاريخ\n4️⃣ أكد العنوان وأرسل\n\nيؤكد مقدم الخدمة الحجز وتصلك إشعار.',
    fr: "🧹 Réserver un ménage :\n\n1️⃣ Sur l'écran d'accueil, choisissez un prestataire (note, prix ou distance)\n2️⃣ Touchez « Réserver »\n3️⃣ Choisissez le service, les heures et la date\n4️⃣ Confirmez l'adresse et envoyez\n\nLe prestataire confirme et vous recevez une notification.",
    hi: '🧹 सफ़ाई बुक करना:\n\n1️⃣ होम स्क्रीन पर सेवा प्रदाता चुनें (रेटिंग, कीमत या दूरी से)\n2️⃣ "अभी बुक करें" दबाएँ\n3️⃣ सेवा, घंटे और तारीख चुनें\n4️⃣ पता पुष्टि करें और भेजें\n\nसेवा प्रदाता पुष्टि करेगा और आपको सूचना मिलेगी।',
    uk: '🧹 Як замовити прибирання:\n\n1️⃣ На головному екрані оберіть виконавця (за рейтингом, ціною чи відстанню)\n2️⃣ Натисніть «Замовити»\n3️⃣ Оберіть послугу, години й дату\n4️⃣ Підтвердьте адресу й надішліть\n\nВиконавець підтвердить замовлення, і ви отримаєте сповіщення.',
  },
  urgent: {
    en: '⚡ Urgent cleaning:\n\nNeed it today or tomorrow? On the home screen tap "Express Cleaning", choose the service, time and budget. Every available provider within 30 km gets the request — the first to take it arranges the details with you in the chat.',
    ru: '⚡ Срочная уборка:\n\nНужно сегодня или завтра? На главном экране нажмите «Срочная уборка», выберите услугу, время и бюджет. Запрос получат все свободные исполнители в радиусе 30 км — первый, кто примет, согласует детали с вами в чате.',
    ar: '⚡ تنظيف عاجل:\n\nتحتاجه اليوم أو غدًا؟ في الشاشة الرئيسية اضغط "تنظيف عاجل"، واختر الخدمة والوقت والميزانية. يصل الطلب لكل مقدمي الخدمة المتاحين ضمن 30 كم — أول من يقبله يرتب التفاصيل معك في المحادثة.',
    fr: "⚡ Ménage urgent :\n\nBesoin pour aujourd'hui ou demain ? Sur l'écran d'accueil, touchez « Ménage urgent », choisissez le service, l'heure et le budget. Tous les prestataires disponibles dans un rayon de 30 km reçoivent la demande — le premier qui l'accepte règle les détails avec vous dans la discussion.",
    hi: '⚡ तत्काल सफ़ाई:\n\nआज या कल चाहिए? होम स्क्रीन पर "तत्काल सफ़ाई" दबाएँ, सेवा, समय और बजट चुनें। 30 किमी के भीतर हर उपलब्ध प्रदाता को अनुरोध मिलता है — जो पहले लेता है, वह चैट में आपसे विवरण तय करता है।',
    uk: '⚡ Термінове прибирання:\n\nПотрібно сьогодні чи завтра? На головному екрані натисніть «Термінове прибирання», оберіть послугу, час і бюджет. Запит отримають усі вільні виконавці в радіусі 30 км — перший, хто прийме, узгодить деталі з вами в чаті.',
  },
  rating: {
    en: '⭐ Ratings:\n\nWhen a cleaning ends you are asked to rate the provider (1–5 stars) and leave a few words. Ratings help other clients choose and keep the quality high.',
    ru: '⭐ Оценки:\n\nПосле уборки вас попросят оценить исполнителя (1–5 звёзд) и оставить пару слов. Оценки помогают другим клиентам выбрать и поддерживают качество.',
    ar: '⭐ التقييمات:\n\nعند انتهاء التنظيف يُطلب منك تقييم مقدم الخدمة (1–5 نجوم) وكتابة بضع كلمات. تساعد التقييمات العملاء الآخرين على الاختيار وتحافظ على الجودة.',
    fr: "⭐ Les notes :\n\nÀ la fin du ménage, on vous demande de noter le prestataire (1 à 5 étoiles) et de laisser quelques mots. Les notes aident les autres clients à choisir et maintiennent la qualité.",
    hi: '⭐ रेटिंग:\n\nसफ़ाई पूरी होने पर आपसे सेवा प्रदाता को रेट करने (1–5 स्टार) और कुछ शब्द लिखने को कहा जाता है। रेटिंग से दूसरे ग्राहकों को चुनने में मदद मिलती है।',
    uk: '⭐ Оцінки:\n\nПісля прибирання вас попросять оцінити виконавця (1–5 зірок) і залишити кілька слів. Оцінки допомагають іншим клієнтам обирати й тримають якість.',
  },
  safety: {
    en: '🛡️ Something went wrong?\n\nA&M Clean connects clients and independent providers; damage or a dispute is settled directly between the two sides. If you want us to know about a problem or a person — use "Report" in the menu, or contact us and we will look into it.',
    ru: '🛡️ Что-то пошло не так?\n\nA&M Clean связывает клиентов и независимых исполнителей; ущерб или спор решаются напрямую между сторонами. Чтобы сообщить нам о проблеме или человеке — используйте «Сообщить» в меню или свяжитесь с нами, и мы разберёмся.',
    ar: '🛡️ حدث خطأ ما؟\n\nتربط A&M Clean بين العملاء ومقدمي خدمة مستقلين؛ يُحلّ الضرر أو الخلاف مباشرة بين الطرفين. إذا أردت إبلاغنا بمشكلة أو بشخص — استخدم "إبلاغ" في القائمة، أو تواصل معنا وسنتابع الأمر.',
    fr: "🛡️ Un souci ?\n\nA&M Clean met en relation clients et prestataires indépendants ; un dommage ou un litige se règle directement entre les deux. Pour nous signaler un problème ou une personne, utilisez « Signaler » dans le menu, ou contactez-nous et nous examinerons.",
    hi: '🛡️ कुछ गलत हुआ?\n\nA&M Clean ग्राहकों और स्वतंत्र सेवा प्रदाताओं को जोड़ता है; नुकसान या विवाद दोनों पक्षों के बीच सीधे सुलझाया जाता है। किसी समस्या या व्यक्ति की सूचना देने के लिए मेनू में "रिपोर्ट" का उपयोग करें, या हमसे संपर्क करें।',
    uk: '🛡️ Щось пішло не так?\n\nA&M Clean поєднує клієнтів і незалежних виконавців; шкода чи суперечка вирішуються напряму між сторонами. Щоб повідомити нам про проблему чи людину — скористайтеся «Повідомити» в меню або зв’яжіться з нами, і ми розберемося.',
  },
  account: {
    en: '🔑 Your account:\n\nForgot your password? On the sign-in screen tap "Forgot password" and we will e-mail you a reset link. Your name, phone and address can be changed in your profile under "Edit profile".',
    ru: '🔑 Ваш аккаунт:\n\nЗабыли пароль? На экране входа нажмите «Забыли пароль», и мы пришлём ссылку для сброса. Имя, телефон и адрес меняются в профиле — «Редактировать профиль».',
    ar: '🔑 حسابك:\n\nنسيت كلمة المرور؟ في شاشة تسجيل الدخول اضغط "نسيت كلمة المرور" وسنرسل لك رابطًا لإعادة تعيينها. يمكن تغيير الاسم والهاتف والعنوان في ملفك الشخصي عبر "تعديل الملف".',
    fr: "🔑 Votre compte :\n\nMot de passe oublié ? Sur l'écran de connexion, touchez « Mot de passe oublié » et nous vous enverrons un lien. Nom, téléphone et adresse se modifient dans votre profil, « Modifier le profil ».",
    hi: '🔑 आपका खाता:\n\nपासवर्ड भूल गए? साइन-इन स्क्रीन पर "पासवर्ड भूल गए" दबाएँ, हम रीसेट लिंक ईमेल करेंगे। नाम, फ़ोन और पता प्रोफ़ाइल में "प्रोफ़ाइल संपादित करें" से बदलें।',
    uk: '🔑 Ваш обліковий запис:\n\nЗабули пароль? На екрані входу натисніть «Забули пароль», і ми надішлемо посилання. Ім’я, телефон і адреса змінюються в профілі — «Редагувати профіль».',
  },
  included: {
    en: '🧴 What\'s included:\n\nEach service lists what it covers — tap the ℹ beside a service. Each provider says on their profile whether they bring their own products and equipment.',
    ru: '🧴 Что входит:\n\nУ каждой услуги указано, что в неё входит — нажмите ℹ рядом с услугой. Исполнитель в профиле указывает, приносит ли свои средства и инвентарь.',
    ar: '🧴 ما الذي يشمله:\n\nلكل خدمة قائمة بما تشمله — اضغط ℹ بجانب الخدمة. يذكر كل مقدم خدمة في ملفه إن كان يحضر مواده ومعداته.',
    fr: "🧴 Ce qui est inclus :\n\nChaque service indique ce qu'il comprend — touchez le ℹ à côté du service. Chaque prestataire précise sur son profil s'il apporte ses produits et son matériel.",
    hi: '🧴 क्या शामिल है:\n\nहर सेवा में बताया गया है कि उसमें क्या शामिल है — सेवा के पास ℹ दबाएँ। हर प्रदाता अपनी प्रोफ़ाइल में बताता है कि वह अपना सामान और उपकरण लाता है या नहीं।',
    uk: '🧴 Що входить:\n\nДля кожної послуги вказано, що до неї входить — натисніть ℹ біля послуги. Виконавець у профілі зазначає, чи приносить власні засоби й інвентар.',
  },
  join: {
    en: '🤝 Working with us:\n\nSign out, tap "New Registration" and choose "Service provider". Fill in your services, prices, area and working hours — clients will find you, and the job board shows work near you.',
    ru: '🤝 Работа с нами:\n\nВыйдите из аккаунта, нажмите «Новая регистрация» и выберите «Исполнитель». Укажите услуги, цены, район и часы работы — клиенты найдут вас, а на доске появятся заказы рядом.',
    ar: '🤝 العمل معنا:\n\nسجّل الخروج، اضغط "تسجيل جديد" واختر "مقدم خدمة". املأ خدماتك وأسعارك ومنطقتك وساعات عملك — سيجدك العملاء، وتعرض لوحة الأعمال الطلبات القريبة منك.',
    fr: "🤝 Travailler avec nous :\n\nDéconnectez-vous, touchez « Nouvelle inscription » et choisissez « Prestataire ». Indiquez vos services, tarifs, zone et horaires — les clients vous trouveront, et le tableau affiche les missions près de chez vous.",
    hi: '🤝 हमारे साथ काम:\n\nसाइन आउट करें, "नया पंजीकरण" दबाएँ और "सेवा प्रदाता" चुनें। अपनी सेवाएँ, कीमतें, क्षेत्र और काम के घंटे भरें — ग्राहक आपको ढूँढेंगे और बोर्ड पर पास के काम दिखेंगे।',
    uk: '🤝 Робота з нами:\n\nВийдіть з облікового запису, натисніть «Нова реєстрація» й оберіть «Виконавець». Вкажіть послуги, ціни, район і години роботи — клієнти знайдуть вас, а на дошці з’являться замовлення поруч.',
  },
  language: {
    en: '🌐 Language:\n\nOpen the menu (☰) and tap "Change language". The whole app — screens, messages and notifications — switches to it.',
    ru: '🌐 Язык:\n\nОткройте меню (☰) и нажмите «Сменить язык». Всё приложение — экраны, сообщения и уведомления — переключится на него.',
    ar: '🌐 اللغة:\n\nافتح القائمة (☰) واضغط "تغيير اللغة". يتحول التطبيق كله — الشاشات والرسائل والإشعارات — إليها.',
    fr: "🌐 La langue :\n\nOuvrez le menu (☰) et touchez « Changer de langue ». Toute l'application — écrans, messages et notifications — passe dans cette langue.",
    hi: '🌐 भाषा:\n\nमेनू (☰) खोलें और "भाषा बदलें" दबाएँ। पूरा ऐप — स्क्रीन, संदेश और सूचनाएँ — उसी भाषा में हो जाएगा।',
    uk: '🌐 Мова:\n\nВідкрийте меню (☰) і натисніть «Змінити мову». Увесь застосунок — екрани, повідомлення й сповіщення — перейде на неї.',
  },
  contact: {
    en: '📧 Contact us:\n\nI\'m opening an e-mail to our support team — write what happened and we will get back to you as soon as we can.',
    ru: '📧 Связаться с нами:\n\nОткрываю письмо в нашу поддержку — опишите, что произошло, и мы ответим как можно скорее.',
    ar: '📧 تواصل معنا:\n\nأفتح لك رسالة بريد إلى فريق الدعم — اكتب ما حدث وسنرد عليك بأسرع ما يمكن.',
    fr: "📧 Nous contacter :\n\nJ'ouvre un e-mail à notre support — décrivez ce qui s'est passé et nous vous répondrons au plus vite.",
    hi: '📧 हमसे संपर्क करें:\n\nमैं हमारी सहायता टीम के लिए ईमेल खोल रहा हूँ — बताइए क्या हुआ, हम जल्द से जल्द जवाब देंगे।',
    uk: '📧 Зв’язатися з нами:\n\nВідкриваю лист до нашої підтримки — опишіть, що сталося, і ми відповімо якнайшвидше.',
  },
  fallback: {
    en: "I'm not sure I understood 🤔\nTry one of the options below, or contact us and a person will answer.",
    ru: 'Не уверен, что понял 🤔\nВыберите один из вариантов ниже или свяжитесь с нами — ответит человек.',
    ar: 'لست متأكدًا أنني فهمت 🤔\nجرّب أحد الخيارات أدناه، أو تواصل معنا وسيرد عليك شخص.',
    fr: "Je ne suis pas sûr d'avoir compris 🤔\nEssayez une des options ci-dessous, ou contactez-nous : une personne vous répondra.",
    hi: 'मुझे यकीन नहीं कि मैं समझ पाया 🤔\nनीचे दिए विकल्पों में से कोई चुनें, या हमसे संपर्क करें — कोई व्यक्ति जवाब देगा।',
    uk: 'Не впевнений, що зрозумів 🤔\nОберіть один із варіантів нижче або зв’яжіться з нами — відповість людина.',
  },
  menu: {
    en: 'What else can I help with?', ru: 'Чем ещё помочь?', ar: 'بماذا يمكنني المساعدة أيضًا؟', fr: 'En quoi puis-je encore vous aider ?', hi: 'और किसमें मदद करूँ?', uk: 'Чим іще допомогти?',
  },
  myBookingsNone: {
    en: 'You have no bookings yet.', ru: 'У вас пока нет заказов.', ar: 'لا توجد لديك حجوزات بعد.', fr: "Vous n'avez pas encore de réservations.", hi: 'अभी आपकी कोई बुकिंग नहीं है।', uk: 'У вас поки немає замовлень.',
  },
  myBookingsHead: {
    en: '📋 Your latest bookings:', ru: '📋 Ваши последние заказы:', ar: '📋 آخر حجوزاتك:', fr: '📋 Vos dernières réservations :', hi: '📋 आपकी हाल की बुकिंग्स:', uk: '📋 Ваші останні замовлення:',
  },
  myBookingsMore: {
    en: 'All of them are in your profile.', ru: 'Все заказы — в вашем профиле.', ar: 'جميعها في ملفك الشخصي.', fr: 'Toutes sont dans votre profil.', hi: 'सभी आपकी प्रोफ़ाइल में हैं।', uk: 'Усі замовлення — у вашому профілі.',
  },
  // ── the cleaner's side ──
  jobsNone: {
    en: 'You have no upcoming jobs right now.\n\nMake sure your availability is up to date, and check the job board on the home screen — clients post work there.',
    ru: 'Сейчас у вас нет предстоящих работ.\n\nПроверьте, что доступность актуальна, и загляните на доску на главном экране — клиенты публикуют там заказы.',
    ar: 'لا توجد لديك أعمال قادمة الآن.\n\nتأكد من تحديث أوقات توفرك، وتفقد لوحة الأعمال في الشاشة الرئيسية — ينشر العملاء الطلبات هناك.',
    fr: "Vous n'avez pas de mission à venir pour le moment.\n\nVérifiez que vos disponibilités sont à jour et consultez le tableau sur l'écran d'accueil — les clients y publient des demandes.",
    hi: 'अभी आपका कोई आगामी काम नहीं है।\n\nअपनी उपलब्धता अपडेट रखें और होम स्क्रीन पर बोर्ड देखें — ग्राहक वहाँ काम पोस्ट करते हैं।',
    uk: 'Зараз у вас немає майбутніх робіт.\n\nПереконайтеся, що доступність актуальна, і перегляньте дошку на головному екрані — клієнти публікують там замовлення.',
  },
  jobsHead: {
    en: '📋 You have {n} upcoming job(s). Next:', ru: '📋 Предстоящих работ: {n}. Ближайшая:', ar: '📋 لديك {n} من الأعمال القادمة. الأقرب:', fr: '📋 Vous avez {n} mission(s) à venir. La prochaine :', hi: '📋 आपके {n} आगामी काम हैं। अगला:', uk: '📋 Майбутніх робіт: {n}. Найближча:',
  },
  earnings: {
    en: '💰 Your earnings:\n\nThis month: ₪{month} ({monthJobs} job(s))\nIn total: ₪{total} ({jobs} job(s))\n\nA&M Clean takes no commission — it is all yours.',
    ru: '💰 Ваш заработок:\n\nВ этом месяце: ₪{month} (работ: {monthJobs})\nВсего: ₪{total} (работ: {jobs})\n\nA&M Clean не берёт комиссию — всё ваше.',
    ar: '💰 أرباحك:\n\nهذا الشهر: ₪{month} ({monthJobs} من الأعمال)\nالإجمالي: ₪{total} ({jobs} من الأعمال)\n\nلا تأخذ A&M Clean أي عمولة — كل المبلغ لك.',
    fr: "💰 Vos gains :\n\nCe mois-ci : ₪{month} ({monthJobs} mission(s))\nAu total : ₪{total} ({jobs} mission(s))\n\nA&M Clean ne prend aucune commission — tout est pour vous.",
    hi: '💰 आपकी कमाई:\n\nइस महीने: ₪{month} ({monthJobs} काम)\nकुल: ₪{total} ({jobs} काम)\n\nA&M Clean कोई कमीशन नहीं लेता — सब आपका है।',
    uk: '💰 Ваш заробіток:\n\nЦього місяця: ₪{month} (робіт: {monthJobs})\nУсього: ₪{total} (робіт: {jobs})\n\nA&M Clean не бере комісії — усе ваше.',
  },
  gettingPaid: {
    en: '💳 Getting paid:\n\n💵 Cash — the client pays you at the end of the cleaning\n📱 Bit — an instant transfer to your phone\n💜 PayBox — the client pays through PayBox\n🏦 Bank transfer — straight to your account\n\nWhen the job ends you can send the client a payment request from the booking card.',
    ru: '💳 Как вы получаете оплату:\n\n💵 Наличные — клиент платит в конце уборки\n📱 Bit — мгновенный перевод на ваш телефон\n💜 PayBox — клиент платит через PayBox\n🏦 Банковский перевод — прямо на ваш счёт\n\nПосле работы можно отправить клиенту запрос на оплату с карточки заказа.',
    ar: '💳 استلام أجرك:\n\n💵 نقدًا — يدفع لك العميل في نهاية التنظيف\n📱 Bit — تحويل فوري إلى هاتفك\n💜 PayBox — يدفع العميل عبر PayBox\n🏦 تحويل بنكي — مباشرة إلى حسابك\n\nعند انتهاء العمل يمكنك إرسال طلب دفع للعميل من بطاقة الحجز.',
    fr: "💳 Être payé(e) :\n\n💵 Espèces — le client vous paie à la fin du ménage\n📱 Bit — un virement instantané sur votre téléphone\n💜 PayBox — le client paie via PayBox\n🏦 Virement — directement sur votre compte\n\nÀ la fin de la mission, vous pouvez envoyer une demande de paiement depuis la fiche de réservation.",
    hi: '💳 भुगतान पाना:\n\n💵 नकद — सफ़ाई के अंत में ग्राहक आपको देता है\n📱 Bit — आपके फ़ोन पर तुरंत ट्रांसफ़र\n💜 PayBox — ग्राहक PayBox से भुगतान करता है\n🏦 बैंक ट्रांसफ़र — सीधे आपके खाते में\n\nकाम खत्म होने पर बुकिंग कार्ड से ग्राहक को भुगतान अनुरोध भेज सकते हैं।',
    uk: '💳 Як ви отримуєте оплату:\n\n💵 Готівка — клієнт платить після прибирання\n📱 Bit — миттєвий переказ на ваш телефон\n💜 PayBox — клієнт платить через PayBox\n🏦 Банківський переказ — прямо на ваш рахунок\n\nПісля роботи можна надіслати клієнту запит на оплату з картки замовлення.',
  },
  commission: {
    en: '✅ No commission: A&M Clean takes 0% — 100% of what the client pays goes to you.',
    ru: '✅ Без комиссии: A&M Clean берёт 0% — 100% оплаты клиента получаете вы.',
    ar: '✅ بلا عمولة: تأخذ A&M Clean 0% — 100% مما يدفعه العميل يذهب إليك.',
    fr: "✅ Aucune commission : A&M Clean prend 0 % — 100 % de ce que paie le client vous revient.",
    hi: '✅ कोई कमीशन नहीं: A&M Clean 0% लेता है — ग्राहक जो देता है उसका 100% आपको मिलता है।',
    uk: '✅ Без комісії: A&M Clean бере 0% — 100% оплати клієнта отримуєте ви.',
  },
  availability: {
    en: '🗓️ Your availability:\n\nIn your profile set the days and hours you work — clients see whether you are available, and urgent requests reach you only within those hours. Taking you to your profile…',
    ru: '🗓️ Ваша доступность:\n\nВ профиле укажите рабочие дни и часы — клиенты видят, свободны ли вы, а срочные запросы приходят только в эти часы. Перехожу в профиль…',
    ar: '🗓️ أوقات توفرك:\n\nفي ملفك الشخصي حدد أيام وساعات عملك — يرى العملاء إن كنت متاحًا، وتصلك الطلبات العاجلة ضمن هذه الساعات فقط. أنقلك إلى ملفك…',
    fr: "🗓️ Vos disponibilités :\n\nDans votre profil, indiquez vos jours et heures de travail — les clients voient si vous êtes disponible, et les demandes urgentes ne vous parviennent que pendant ces heures. Je vous emmène à votre profil…",
    hi: '🗓️ आपकी उपलब्धता:\n\nप्रोफ़ाइल में काम के दिन और घंटे सेट करें — ग्राहक देखते हैं कि आप उपलब्ध हैं या नहीं, और तत्काल अनुरोध केवल उन्हीं घंटों में आते हैं। आपको प्रोफ़ाइल पर ले जा रहा हूँ…',
    uk: '🗓️ Ваша доступність:\n\nУ профілі вкажіть робочі дні й години — клієнти бачать, чи ви вільні, а термінові запити приходять лише в ці години. Переходжу до профілю…',
  },
  getJobs: {
    en: '🚀 More jobs:\n\n• Keep your availability and service area up to date\n• Add a photo and a short bio — clients choose people they can see\n• Check the job board on the home screen and take jobs near you\n• Keep alerts on: urgent requests go to the first to answer\n• Good ratings move you up',
    ru: '🚀 Больше заказов:\n\n• Держите доступность и район работы актуальными\n• Добавьте фото и короткое описание — клиенты выбирают тех, кого видят\n• Смотрите доску на главном экране и берите заказы рядом\n• Не отключайте уведомления: срочные запросы достаются первому\n• Хорошие оценки поднимают вас выше',
    ar: '🚀 أعمال أكثر:\n\n• حدّث أوقات توفرك ومنطقة عملك باستمرار\n• أضف صورة ونبذة قصيرة — يختار العملاء من يرونه\n• تفقد لوحة الأعمال في الشاشة الرئيسية وخذ الطلبات القريبة\n• أبقِ الإشعارات مفعّلة: الطلبات العاجلة لأول من يرد\n• التقييمات الجيدة ترفعك للأعلى',
    fr: "🚀 Plus de missions :\n\n• Gardez vos disponibilités et votre zone à jour\n• Ajoutez une photo et une courte présentation — les clients choisissent qui ils voient\n• Consultez le tableau sur l'écran d'accueil et prenez les missions proches\n• Laissez les notifications activées : les demandes urgentes vont au premier qui répond\n• De bonnes notes vous font monter",
    hi: '🚀 ज़्यादा काम:\n\n• अपनी उपलब्धता और कार्य क्षेत्र अपडेट रखें\n• फ़ोटो और छोटा परिचय जोड़ें — ग्राहक उन्हें चुनते हैं जिन्हें देख सकें\n• होम स्क्रीन पर बोर्ड देखें और पास के काम लें\n• सूचनाएँ चालू रखें: तत्काल अनुरोध पहले जवाब देने वाले को मिलते हैं\n• अच्छी रेटिंग आपको ऊपर ले जाती है',
    uk: '🚀 Більше замовлень:\n\n• Тримайте доступність і район роботи актуальними\n• Додайте фото й короткий опис — клієнти обирають тих, кого бачать\n• Переглядайте дошку на головному екрані й беріть замовлення поруч\n• Не вимикайте сповіщення: термінові запити дістаються першому\n• Добрі оцінки піднімають вас вище',
  },
  cancelJob: {
    en: "❌ Can't make it to a job?\n\nOpen the booking in your profile and cancel it as early as you can — a job the client posted goes back to the board for another provider. Please write to the client in the chat too.",
    ru: '❌ Не получается прийти?\n\nОткройте заказ в профиле и отмените его как можно раньше — заказ, опубликованный клиентом, вернётся на доску для другого исполнителя. Напишите клиенту в чате.',
    ar: '❌ لا تستطيع الحضور؟\n\nافتح الحجز في ملفك الشخصي وألغِه بأسرع ما يمكن — الطلب الذي نشره العميل يعود إلى اللوحة لمقدم خدمة آخر. يرجى إبلاغ العميل في المحادثة أيضًا.',
    fr: "❌ Vous ne pouvez pas venir ?\n\nOuvrez la réservation dans votre profil et annulez-la au plus tôt — une demande publiée par le client retourne sur le tableau pour un autre prestataire. Prévenez aussi le client dans la discussion.",
    hi: '❌ काम पर नहीं आ सकते?\n\nप्रोफ़ाइल में बुकिंग खोलें और जितना जल्दी हो सके रद्द करें — ग्राहक का पोस्ट किया काम दूसरे प्रदाता के लिए बोर्ड पर लौट जाता है। कृपया चैट में ग्राहक को भी बताएँ।',
    uk: '❌ Не виходить прийти?\n\nВідкрийте замовлення в профілі й скасуйте якомога раніше — замовлення, опубліковане клієнтом, повернеться на дошку для іншого виконавця. Напишіть клієнту в чаті.',
  },
  invoices: {
    en: "🧾 Invoices and tax:\n\nThe client pays you directly, so you are responsible for reporting the income. We recommend registering as a self-employed business and keeping a record of your income — your earnings are shown in the app.",
    ru: '🧾 Счета и налоги:\n\nКлиент платит вам напрямую, поэтому отчитываться о доходе — ваша ответственность. Рекомендуем открыть статус самозанятого (осек) и вести учёт доходов — заработок виден в приложении.',
    ar: '🧾 الفواتير والضرائب:\n\nيدفع لك العميل مباشرة، لذا أنت المسؤول عن الإبلاغ عن الدخل. ننصح بفتح ملف عمل حر (عوسيك) والاحتفاظ بسجل لدخلك — أرباحك تظهر في التطبيق.',
    fr: "🧾 Factures et impôts :\n\nLe client vous paie directement : la déclaration des revenus est à votre charge. Nous conseillons d'ouvrir un statut d'indépendant et de tenir un suivi de vos revenus — vos gains sont visibles dans l'application.",
    hi: '🧾 चालान और टैक्स:\n\nग्राहक आपको सीधे भुगतान करता है, इसलिए आय की रिपोर्टिंग आपकी ज़िम्मेदारी है। स्व-रोज़गार व्यवसाय के रूप में पंजीकरण और आय का रिकॉर्ड रखने की सलाह है — आपकी कमाई ऐप में दिखती है।',
    uk: '🧾 Рахунки й податки:\n\nКлієнт платить вам напряму, тож звітувати про дохід — ваша відповідальність. Радимо зареєструватися як самозайнятий і вести облік доходів — заробіток видно в застосунку.',
  },
  ratingCleaner: {
    en: '⭐ Ratings:\n\nClients rate you (1–5 stars) after each job. Good ratings move you up the list. Arriving on time, keeping in touch in the chat and finishing what was agreed are what clients mention most.',
    ru: '⭐ Оценки:\n\nКлиенты оценивают вас (1–5 звёзд) после каждой работы. Хорошие оценки поднимают вас в списке. Чаще всего клиенты отмечают пунктуальность, связь в чате и выполнение договорённостей.',
    ar: '⭐ التقييمات:\n\nيقيّمك العملاء (1–5 نجوم) بعد كل عمل. التقييمات الجيدة ترفعك في القائمة. أكثر ما يذكره العملاء: الالتزام بالموعد، والتواصل في المحادثة، وإنجاز ما تم الاتفاق عليه.',
    fr: "⭐ Les notes :\n\nLes clients vous notent (1 à 5 étoiles) après chaque mission. De bonnes notes vous font monter dans la liste. La ponctualité, le contact dans la discussion et le respect de ce qui était convenu sont ce que les clients citent le plus.",
    hi: '⭐ रेटिंग:\n\nहर काम के बाद ग्राहक आपको रेट करते हैं (1–5 स्टार)। अच्छी रेटिंग आपको सूची में ऊपर ले जाती है। समय पर पहुँचना, चैट में संपर्क रखना और तय काम पूरा करना — ग्राहक सबसे ज़्यादा इन्हीं का ज़िक्र करते हैं।',
    uk: '⭐ Оцінки:\n\nКлієнти оцінюють вас (1–5 зірок) після кожної роботи. Добрі оцінки піднімають вас у списку. Найчастіше клієнти відзначають пунктуальність, зв’язок у чаті й виконання домовленостей.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fill(s: string, vars: Record<string, string | number> = {}): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
const t = (key: string, lang: BotLang, vars?: Record<string, string | number>) => fill(A[key][lang], vars);
const q = (lang: BotLang, ...keys: string[]) => keys.map((k) => QR[k][lang]);

function norm(s: string): string {
  return ` ${String(s || '').toLowerCase().replace(/[?!.,;:؟،"«»()]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** The quick reply the text is, if it is one — in any language. */
function quickTopic(input: string): string | null {
  const s = String(input || '').trim().toLowerCase();
  for (const [key, labels] of Object.entries(QR)) {
    if (Object.values(labels).some((l) => l.toLowerCase() === s)) return key;
  }
  return null;
}

function topicOf(msg: string, lang: BotLang, order: string[]): string | null {
  for (const topic of order) {
    const words = KW[topic];
    if (!words) continue;
    // The chosen language first, then English (people mix it in).
    const list = [...words[lang], ...(lang === 'en' ? [] : words.en)];
    if (list.some((w) => msg.includes(w.toLowerCase()))) return topic;
  }
  return null;
}

const dateOf = (b: any) => String(b?.bookingDate || b?.date || '');
const whenOf = (b: any) => `${dateOf(b) || '—'}${b?.startTime ? ` · ${b.startTime}` : ''}`;
const statusOf = (b: any, lang: BotLang) => STATUS[b?.status]?.[lang] ?? String(b?.status ?? '');
const LIVE = ['pending', 'confirmed', 'onway', 'active'];

// ── Entry points ──────────────────────────────────────────────────────────────

export function isBotLang(lang: string): lang is BotLang {
  return (BOT_LANGS as string[]).includes(lang);
}

export function botWelcomeI18n(ctx: I18nBotCtx, lang: BotLang): I18nBotResp {
  const name = ctx.userName || '';
  if (ctx.role === 'cleaner' || ctx.role === 'admin') {
    return { text: t('welcomeCleaner', lang, { name }), quickReplies: q(lang, 'myBookings', 'earnings', 'gettingPaid', 'availability', 'contact') };
  }
  return { text: t('welcomeClient', lang, { name }), quickReplies: q(lang, 'status', 'cancel', 'price', 'provider', 'urgent', 'contact') };
}

/**
 * A line with no letter of its own ("📅 2026-11-12 · 10:00") takes its
 * direction from the screen, and in the app's mirrored left-to-right layout it
 * came out reversed. A left-to-right mark opens each line; it draws nothing.
 * Arabic reads right to left and is left as it is.
 */
function settle(r: I18nBotResp, lang: BotLang): I18nBotResp {
  if (lang === 'ar') return r;
  return { ...r, text: r.text.replace(/(^|\n)/g, '$1\u200E') };
}

export function botReplyI18n(input: string, ctx: I18nBotCtx, lang: BotLang): I18nBotResp {
  return settle(replyFor(input, ctx, lang), lang);
}

function replyFor(input: string, ctx: I18nBotCtx, lang: BotLang): I18nBotResp {
  const isCleaner = ctx.role === 'cleaner' || ctx.role === 'admin';
  const name = ctx.userName || '';
  const msg = norm(input);
  const clientMenu = q(lang, 'status', 'cancel', 'price', 'provider', 'contact');
  const cleanerMenu = q(lang, 'myBookings', 'earnings', 'gettingPaid', 'availability', 'contact');
  const menu = isCleaner ? cleanerMenu : clientMenu;

  // A tapped button is its own topic; typed text goes through the keywords.
  // Order matters: "my bookings" before "book", "get paid" before "pay",
  // "status" before "my booking".
  const order = isCleaner
    ? ['earnings', 'gettingPaid', 'commission', 'availability', 'getJobs', 'invoices', 'myBookings', 'cancel', 'rating', 'safety', 'account', 'language', 'contact', 'thanks', 'greet', 'payment', 'urgent']
    : ['status', 'myBookings', 'cancel', 'urgent', 'price', 'provider', 'gettingPaid', 'payment', 'join', 'book', 'rating', 'included', 'safety', 'account', 'language', 'contact', 'thanks', 'greet'];
  let topic = quickTopic(input) ?? topicOf(msg, lang, order);
  if (topic === 'menu') return { text: t('menu', lang), quickReplies: menu };

  if (isCleaner) {
    const mine = (ctx.allBookings || []).filter(Boolean);
    switch (topic) {
      case 'myBookings': {
        const upcoming = mine.filter((b) => LIVE.includes(b.status))
          .sort((a, b) => `${dateOf(a)} ${a.startTime || ''}`.localeCompare(`${dateOf(b)} ${b.startTime || ''}`));
        if (!upcoming.length) return { text: t('jobsNone', lang), quickReplies: q(lang, 'getJobs', 'availability', 'menu') };
        const n = upcoming[0];
        return {
          text: `${t('jobsHead', lang, { n: upcoming.length })}\n\n${statusOf(n, lang)}\n📅 ${whenOf(n)}${n.clientName ? `\n👤 ${n.clientName}` : ''}\n\n${t('myBookingsMore', lang)}`,
          quickReplies: q(lang, 'earnings', 'menu'),
          navigateTo: '/profile',
        };
      }
      case 'earnings': {
        const done = mine.filter((b) => b.status === 'done');
        const amount = (b: any) => Number(b.actualTotal ?? b.total) || 0;
        const ym = new Date().toISOString().slice(0, 7);
        const month = done.filter((b) => dateOf(b).startsWith(ym));
        return {
          text: t('earnings', lang, {
            month: month.reduce((s, b) => s + amount(b), 0), monthJobs: month.length,
            total: done.reduce((s, b) => s + amount(b), 0), jobs: done.length,
          }),
          quickReplies: q(lang, 'gettingPaid', 'menu'),
        };
      }
      case 'gettingPaid': case 'payment':
        return { text: t('gettingPaid', lang), quickReplies: q(lang, 'commission', 'earnings', 'menu') };
      case 'commission': case 'price':
        return { text: t('commission', lang), quickReplies: q(lang, 'gettingPaid', 'menu') };
      case 'availability':
        return { text: t('availability', lang), quickReplies: q(lang, 'menu'), navigateTo: '/profile' };
      case 'getJobs': case 'urgent':
        return { text: t('getJobs', lang), quickReplies: q(lang, 'availability', 'menu') };
      case 'invoices':
        return { text: t('invoices', lang), quickReplies: q(lang, 'earnings', 'menu') };
      case 'cancel':
        return { text: t('cancelJob', lang), quickReplies: q(lang, 'myBookings', 'menu') };
      case 'rating':
        return { text: t('ratingCleaner', lang), quickReplies: q(lang, 'getJobs', 'menu') };
      case 'safety':
        return { text: t('safety', lang), quickReplies: q(lang, 'contact', 'menu') };
      case 'account':
        return { text: t('account', lang), quickReplies: q(lang, 'menu') };
      case 'language':
        return { text: t('language', lang), quickReplies: q(lang, 'menu') };
      case 'contact':
        return { text: t('contact', lang), quickReplies: q(lang, 'menu'), action: 'sendEmail' };
      case 'thanks':
        return { text: t('thanks', lang, { name }), quickReplies: cleanerMenu };
      case 'greet':
        return { text: t('greet', lang, { name }), quickReplies: cleanerMenu };
      default:
        return { text: t('fallback', lang), quickReplies: cleanerMenu };
    }
  }

  const b = ctx.activeBooking;
  switch (topic) {
    case 'status':
      if (!b) return { text: t('noActive', lang), quickReplies: q(lang, 'book', 'urgent', 'menu') };
      return {
        text: t('status', lang, { status: statusOf(b, lang), when: whenOf(b), provider: b.cleanerName || '—' }),
        quickReplies: q(lang, 'provider', 'cancel', 'menu'),
      };
    case 'myBookings': {
      const list = (ctx.allBookings || []).slice(0, 3);
      if (!list.length) return { text: t('myBookingsNone', lang), quickReplies: q(lang, 'book', 'menu') };
      return {
        text: `${t('myBookingsHead', lang)}\n\n${list.map((x) => `• ${whenOf(x)} — ${statusOf(x, lang)}`).join('\n')}\n\n${t('myBookingsMore', lang)}`,
        quickReplies: q(lang, 'status', 'menu'),
        navigateTo: '/profile',
      };
    }
    case 'cancel':
      return { text: t('cancel', lang), quickReplies: q(lang, 'status', 'contact', 'menu') };
    case 'urgent':
      return { text: t('urgent', lang), quickReplies: q(lang, 'price', 'menu') };
    case 'price': {
      const active = b && Number(b.total) > 0
        ? `\n\n${t('priceActive', lang, { total: Number(b.total), hours: b.hours ? t('hoursPart', lang, { h: b.hours }) : '' })}`
        : '';
      return { text: t('price', lang) + active, quickReplies: q(lang, 'payment', 'book', 'menu') };
    }
    case 'provider':
      if (!b || !b.cleanerName) return { text: t('noProvider', lang), quickReplies: q(lang, 'book', 'menu') };
      return { text: t('provider', lang, { provider: b.cleanerName }), quickReplies: q(lang, 'status', 'menu') };
    case 'gettingPaid': case 'payment':
      return { text: t('payment', lang), quickReplies: q(lang, 'price', 'menu') };
    case 'join':
      return { text: t('join', lang), quickReplies: q(lang, 'menu') };
    case 'book':
      return { text: t('book', lang), quickReplies: q(lang, 'urgent', 'price', 'menu'), navigateTo: '/home' };
    case 'rating':
      return { text: t('rating', lang), quickReplies: q(lang, 'menu') };
    case 'included':
      return { text: t('included', lang), quickReplies: q(lang, 'price', 'menu') };
    case 'safety':
      return { text: t('safety', lang), quickReplies: q(lang, 'contact', 'menu') };
    case 'account':
      return { text: t('account', lang), quickReplies: q(lang, 'menu') };
    case 'language':
      return { text: t('language', lang), quickReplies: q(lang, 'menu') };
    case 'contact':
      return { text: t('contact', lang), quickReplies: q(lang, 'menu'), action: 'sendEmail' };
    case 'thanks':
      return { text: t('thanks', lang, { name }), quickReplies: clientMenu };
    case 'greet':
      return { text: t('greet', lang, { name }), quickReplies: clientMenu };
    default:
      return { text: t('fallback', lang), quickReplies: clientMenu };
  }
}
