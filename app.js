(() => {
  'use strict';

  const SCHEMA_VERSION = 1;

  const TAG_META = {
    mandatory: { cls: '', label: 'חובה' },
    optional: { cls: 'tag-optional', label: 'אופציונלי' },
    weather: { cls: 'tag-weather', label: 'תלוי מזג אוויר' },
    hard: { cls: 'tag-hard', label: 'מאתגר' },
    firstcancel: { cls: 'tag-firstcancel', label: 'תחנה ראשונה לביטול' },
    drivinghard: { cls: 'tag-drivinghard', label: 'נהיגה תובענית' }
  };

  function mapsQ(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function mapsNav(q, mode) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q) + '&travelmode=' + (mode || 'driving'); }
  function mapsDayRoute(qs) {
    const origin = encodeURIComponent(qs[0]);
    const destination = encodeURIComponent(qs[qs.length - 1]);
    const mid = qs.slice(1, -1).map(encodeURIComponent).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (mid) url += `&waypoints=${mid}`;
    return url;
  }

  // navMode defaults to 'driving' when not set on a stop. Only stops with
  // navMode 'driving' can ever be routeable / part of the day's driving route.
  function stopNavMode(s) { return s.navMode || 'driving'; }
  function stopRouteable(s) { return stopNavMode(s) === 'driving' && s.routeable !== false; }
  function stopActiveDefault(s) { return s.activeByDefault !== false; }
  function stopIsSkippable(s) { return (s.tags || []).some(t => t === 'optional' || t === 'weather'); }

  const ICONS = {
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="44" height="44"><path d="M3 17V11l2-5h12l3 5v6"></path><path d="M5 17h14"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>',
    mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="44" height="44"><path d="M8 21L12 9l4 12"></path><path d="M5 21h14"></path><path d="M9.5 15.5l1.2-3 1 2 1-2 1.3 3"></path></svg>',
    waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="44" height="44"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"></path><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"></path></svg>',
    anchor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="44" height="44"><circle cx="12" cy="5" r="2"></circle><line x1="12" y1="7" x2="12" y2="21"></line><path d="M5 12H2a10 10 0 0020 0h-3"></path></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="44" height="44"><path d="M21 3L3 10.5l7.5 3L14 21l7-18z"></path></svg>'
  };

  const PHOTO_PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>';

  const ROUTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><circle cx="6" cy="19" r="2.5"></circle><circle cx="18" cy="5" r="2.5"></circle><path d="M6 16.5V13a4 4 0 0 1 4-4h4a4 4 0 0 0 4-4"></path></svg>';

  const OFFLINE_NOTE = "המסלול זמין אופליין. מפות, ניווט ותמונות דורשים אינטרנט.";

  const INFO_SOURCES = [
    { label: 'Kotor Cable Car — חוויית הרכבל', href: 'https://www.kotorcablecar.me/experience/adventures/cable-car' },
    { label: 'Kotor Cable Car — כרטיסים ושעות', href: 'https://www.kotorcablecar.me/plan-your-visit/tickets' },
    { label: 'Lipa Cave — לוח סיורים', href: 'https://lipa-cave.me/tour-timetable/' },
    { label: 'Lipa Cave — חוויית המערה', href: 'https://lipa-cave.me/tours/cave-experience/' },
    { label: 'Montenegro Travel — אתרים ספלאולוגיים (מערות)', href: 'https://www.montenegro.travel/en/explore-montenegro/nature-and-adventure/speleological-objects' },
    { label: 'Montenegro Travel — אתרים סקרליים (מנזרים וכנסיות)', href: 'https://www.montenegro.travel/en/explore-montenegro/culture-and-tours/sacral-objects' },
    { label: 'Montenegro Travel — פארק לאומי לובצ׳ן', href: 'https://www.montenegro.travel/es/explendido-montenegro/parques-nacionales-de-montenegro/parque-nacional-lovcen' },
    { label: 'Aman Sveti Stefan — חוויות', href: 'https://www.aman.com/resorts/aman-sveti-stefan/experiences' },
    { label: 'Port of Kotor — לוח הגעות אוניות קרוז', href: 'https://www.portofkotor.com/en/pdf/Kruzing/' },
    { label: 'Durmitor Adventure — רפטינג בטארה', href: 'https://durmitoradventure.com/tara-rafting/' }
  ];

  const FIELD_NOTES = [
    "בכבישים הרריים לא ממשיכים לקיצור דרך לא סלול או חד-נתיבי רק משום שאפליקציית הניווט מציעה אותו.",
    "מורידים מראש מפות אופליין של צפון מונטנגרו; באזורים הרריים עלולה להיות קליטה חלשה.",
    "מרחק קצר על המפה יכול לקחת זמן בגלל פיתולים, כביש צר ועצירות.",
    "לא מתכננים כביש הררי לא מוכר לאחר החשכה.",
    "דיווחי מטיילים הם ניסיון מהשטח, לא מקור לשעות, מחירים או מצב כבישים עדכני."
  ];

  const FIELD_SOURCES = [
    'https://www.lametayel.co.il/posts/40w14y',
    'https://adhatyul.com/2024/11/17/מונטנגרו-מסלול-טיול-והמלצות/',
    'https://www.sipurderech.co.il/מונטנגרו/7-ימים-במונטנגרו-ביוני',
    'https://www.sipurderech.co.il/מונטנגרו/מונטנגרו-בשישה-ימים',
    'https://www.sipurderech.co.il/מונטנגרו/שבוע-במונטנגרו',
    'https://adhatyul.com/2025/01/15/טיול-וחופשה-במונטנגרו-היפה-חלק-ב/'
  ];

  const DAYS = [
    // ---- 18.9 · טיוואט → ז'בליאק (מסלול יחיד) ----
    { top: "18.9", sub: "שישי", mapCenter: "Žabljak, Montenegro", icon: 'car',
      plans: [
        { id: 'default', name: "המסלול היחיד ליום זה", recommended: true, difficulty: 2,
          title: "טיוואט → ז'בליאק", badge: "עצירות נוף בדרך · הגעה כ-17:00–18:00",
          estimatedDriving: "כ-4 שעות (זמן משוער)", estimatedHotelArrival: "כ-17:00–18:00",
          routeStart: 'Tivat Airport, Montenegro', routeEnd: 'Villa Tara, Žabljak, Montenegro',
          photos: [
            { id: 'd1p1', caption: "Slano Jezero, ליד ניקשיץ'", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Slano%20jezero%20(Montenegro)%20-%20panoramio%20(412).jpg', credit: 'ines lukic, Wikimedia Commons (CC BY 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Slano_jezero_(Montenegro)_-_panoramio_(412).jpg' }
          ],
          stops: [
            { id: 'd1s1', name: "Tivat Airport", time: "08:00–09:00", desc: "איסוף הרכב. יוצאים ב-09:00.", tags: ['mandatory'], q: 'Tivat Airport, Montenegro', distNext: "כ-65 דק' נהיגה (זמן משוער)" },
            { id: 'd1s2', name: "Grahovsko Jezero", time: "10:05–10:25", desc: "עצירה קצרה לתמונות.", tags: ['optional', 'firstcancel'], q: 'Grahovsko Jezero, Montenegro', distNext: "כ-45 דק' נהיגה (זמן משוער)",
              alt: "תחנה ראשונה לביטול — אם לוחץ בזמן, מדלגים ישר ל-Slano Jezero." },
            { id: 'd1s3', name: "Slano Jezero – Vidikovac", time: "11:10–11:35", desc: "תצפית עיקרית של יום הנסיעה.", tags: ['mandatory'], q: 'Slano Jezero, Montenegro', distNext: "כ-20 דק' נהיגה (זמן משוער)" },
            { id: 'd1s4', name: "ארוחה וסופר ב-Nikšić", time: "11:55–13:10", desc: "עוצרים לאכול ולקנות בסופר. המקום הספציפי פתוח בשטח.", tags: ['mandatory'], navMode: 'none', q: 'Nikšić, Montenegro', distNext: "כ-65 דק' נהיגה (זמן משוער)" },
            { id: 'd1s5', name: "Šavnik", time: "14:15–14:45", desc: "עצירת שירות קצרה או חלופה ל-Pošćenje: הליכה קצרה ליד מפגש הנהרות ומדרגות המים. לא מבצעים גם ביקור מלא כאן וגם עצירה ארוכה ב-Pošćenje אם היום מתעכב.", tags: ['optional'], q: 'Šavnik, Montenegro', distNext: "כ-45 דק' נהיגה (זמן משוער)",
              routeable: false, activeByDefault: false,
              alt: "אין צורך? ממשיכים ישר ל-Villa Tara." },
            {
              id: "d1s8",
              time: "14:30–15:45",
              name: "Pošćensko Jezero / אזור הכניסה ל-Nevidio",
              desc: "עצירת טבע של 45–75 דקות ליד האגם והאזור החיצוני של הקניון. לא נכנסים לקניון ולא ממשיכים בדרך צדדית צרה אם הדרך אינה ברורה.",
              tags: ["optional", "weather"],
              q: "Etno Selo Nevidio, Pošćenje, Montenegro",
              navMode: "driving",
              activeByDefault: true,
              distNext: "כ-30–45 דק׳ ל-Villa Tara — זמן תכנון משוער",
              alt: "אם גשום, מתעכבים או לא רוצים להיכנס לכביש הצדדי — מדלגים או עוצרים במקום זאת ב-Šavnik."
            },
            { id: 'd1s6', name: "Villa Tara", time: "כ-17:00–18:00", desc: "הגעה, צ'ק-אין ולינה בז'בליאק.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro', distNext: "כ-15 דק' נהיגה, אם יוצאים לקניות" },
            { id: 'd1s7', name: "Žabljak / VOLI", time: "16:00–17:00", desc: "סופרמרקט VOLI, אם צריך.", tags: ['optional'], q: 'Voli, Žabljak, Montenegro', routeable: false }
          ] }
      ] },

    // ---- 19.9 · אגמי דורמיטור (2 אפשרויות) ----
    { top: "19.9", sub: "שבת", mapCenter: "Žabljak, Montenegro", icon: 'mountain',
      plans: [
        { id: 'full', name: "המסלול המלא", recommended: true, difficulty: 2,
          title: "אגמי דורמיטור — המסלול המלא", badge: "יום הליכה מלא · חזרה כ-16:35",
          estimatedDriving: "כ-1 שעה 20 דק' (זמן משוער)", estimatedFinish: "כ-16:10", estimatedReturn: "כ-16:35",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Villa Tara, Žabljak, Montenegro',
          chooseWhen: "מזג אוויר טוב וכולם במצב טוב.",
          avoidWhen: "אם עייפים, גשום, או רוצים יום קליל יותר.",
          changes: ["הקפה מלאה של האגם", "כולל Vražje Jezero", "יום ארוך יותר"],
          photos: [
            { id: 'd2p1f', caption: "Crno Jezero – האגם השחור, דורמיטור", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Durmitor%20-%20Crno%20jezero.jpg', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Durmitor_-_Crno_jezero.jpg' },
            { id: 'd2p2f', caption: "Savin Kuk – תצפית מהרכבל, אם פועל", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Durmitor%20-%20Savin%20kuk.jpg', credit: 'Mercy, Wikimedia Commons (CC BY-SA 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Durmitor_-_Savin_kuk.jpg' }
          ],
          stops: [
            { id: 'd2s1-f', name: "Crno Jezero (האגם השחור)", time: "08:30–11:00", desc: "הקפה מלאה רק אם השביל יבש ונוח. לא כל המסלול מישורי, ובחלקים מסוימים עשויים להיות עלייה, בוץ או מעבר פחות נוח. בודקים בכניסה את מצב השבילים; אפשר להסתובב ולחזור באותה הדרך.", tags: ['mandatory'], q: 'Crno Jezero, Durmitor, Montenegro', distNext: "כ-15 דק' נהיגה" },
            { id: 'd2s2-f', name: "Restaurant Or'O", time: "11:15–12:30", desc: "ארוחת צהריים.", tags: ['mandatory'], q: "Restaurant Or'O, Žabljak, Montenegro", distNext: "כ-20 דק' נהיגה" },
            { id: 'd2s3-f', name: "Savin Kuk", time: "12:50–15:10", desc: "עולים רק אם הרכבל פועל ויש ראות.", tags: ['weather'], q: 'Savin Kuk, Montenegro', distNext: "כ-20 דק' נהיגה",
              alt: "רכבל לא פועל? מדלגים ישר לוורז'ה יזרו." },
            { id: 'd2s4-f', name: "Vražje Jezero", time: "15:30–16:10", desc: "אגם קטן עם נוף פתוח. עצירה קצרה ליד המים.", tags: ['optional'], q: 'Vražje Jezero, Montenegro', distNext: "כ-25 דק' נהיגה" },
            { id: 'd2s5-f', name: "Villa Tara", time: "16:35", desc: "חזרה ללינה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro' }
          ] },
        { id: 'easy', name: "המסלול הקל", recommended: false, difficulty: 1,
          title: "אגמי דורמיטור — המסלול הקל", badge: "יום קליל · חזרה כ-15:30",
          estimatedDriving: "כ-50 דק' (זמן משוער)", estimatedFinish: "כ-15:00", estimatedReturn: "כ-15:30",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Villa Tara, Žabljak, Montenegro',
          chooseWhen: "כשרוצים פחות הליכה, השביל רטוב או מזג האוויר לא יציב.",
          notIncluded: "בלי הקפת אגם ובלי Vražje Jezero.",
          changes: ["בלי הקפת האגם", "בלי Vražje Jezero", "פחות הליכה, סיום מוקדם"],
          photos: [
            { id: 'd2p1e', caption: "Crno Jezero – החוף הראשי", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Durmitor%20-%20Crno%20jezero.jpg', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Durmitor_-_Crno_jezero.jpg' }
          ],
          stops: [
            { id: 'd2s1-e', name: "Crno Jezero (האגם השחור)", time: "08:30–09:45", desc: "החוף הראשי והליכה קצרה, בלי הקפה מלאה.", tags: ['mandatory'], q: 'Crno Jezero, Durmitor, Montenegro', distNext: "כ-15 דק' נהיגה" },
            { id: 'd2s2-e', name: "Žabljak / קפה", time: "10:00–11:00", desc: "זמן חופשי בעיירה.", tags: ['optional'], navMode: 'none', q: 'Žabljak, Montenegro', distNext: "כ-15 דק' נהיגה" },
            { id: 'd2s3-e', name: "Restaurant Or'O", time: "11:30–12:45", desc: "ארוחת צהריים.", tags: ['mandatory'], q: "Restaurant Or'O, Žabljak, Montenegro", distNext: "כ-15 דק' נהיגה" },
            { id: 'd2s4-e', name: "Savin Kuk", time: "13:00–15:00", desc: "עולים רק אם הרכבל פועל ויש ראות.", tags: ['weather'], q: 'Savin Kuk, Montenegro', distNext: "כ-30 דק' נהיגה",
              alt: "רכבל לא פועל? ממשיכים ישר חזרה ל-Villa Tara." },
            { id: 'd2s5-e', name: "Villa Tara", time: "כ-15:30", desc: "חזרה מוקדמת ללינה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro' }
          ] }
      ] },

    // ---- 20.9 · רפטינג בדורמיטור (2 אפשרויות) ----
    { top: "20.9", sub: "ראשון", mapCenter: "Žabljak, Montenegro", icon: 'waves',
      plans: [
        { id: 'view', name: "רפטינג ותצפית", recommended: true, difficulty: 3,
          title: "רפטינג בדורמיטור + תצפית Ćurevac", badge: "רפטינג + תצפית · חזרה כ-18:00",
          estimatedDriving: "כ-55 דק' (זמן משוער)", estimatedFinish: "כ-17:30", estimatedReturn: "כ-18:00",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Villa Tara, Žabljak, Montenegro',
          summary: "ברפטינג עצמו משתתפים 4 מתוך 6; אימא ואחותי שבהריון לא נכנסות למים.",
          chooseWhen: "יבש, יש ראות, חוזרים בזמן והקבוצה לא עייפה.",
          avoidWhen: "רטוב, ערפל או עייפים — אז עדיף היום הרגוע.",
          changes: ["כולל תצפית Ćurevac", "סיום מאוחר יותר"],
          photos: [
            { id: 'd3p1v', caption: "גשר Đurđevića Tara מעל קניון טארה", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/%C4%90ur%C4%91evi%C4%87a%20Tara%20Bridge%20(by%20Pudelek).JPG', credit: 'Marcin Szala, Wikimedia Commons (CC BY-SA 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:%C4%90ur%C4%91evi%C4%87a_Tara_Bridge_(by_Pudelek).JPG' },
            { id: 'd3p2v', caption: "Ćurevac Viewpoint – מבט על קניון טארה", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tara%20River%20Canyon%20from%20%C4%86urevac.jpg', credit: 'Javier Sánchez Portero, Wikimedia Commons (CC BY-SA 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Tara_River_Canyon_from_%C4%86urevac.jpg' }
          ],
          stops: [
            { id: 'd3s1-v', name: "Durmitor Adventure", time: "08:30 או 09:00", desc: "לפי הפרסום: התייצבות ב-08:30 במשרד Durmitor Adventure בז'בליאק, או ב-09:00 ליד גשר טארה. שעת המפגש הסופית לפי ההזמנה.", tags: ['mandatory'], navMode: 'none', q: 'Durmitor Adventure, Žabljak, Montenegro' },
            { id: 'd3s2-v', name: "רפטינג בקניון טארה", time: "08:30–13:30/14:00", desc: "הרפטינג עצמו נמשך כ-4 שעות, כולל כשעתיים במים. עם התייצבות, ציוד והסעות כדאי להקצות עד 5–5.5 שעות.", tags: ['mandatory', 'hard'], q: 'Durmitor Adventure, Žabljak, Montenegro', distNext: "כ-15 דק' נהיגה" },
            { id: 'd3s3-v', name: "ארוחה בז'בליאק", time: "14:15–15:15", desc: "ארוחת צהריים בעיירה.", tags: ['mandatory'], navMode: 'none', q: 'Žabljak, Montenegro' },
            { id: 'd3s4-v', name: "Ćurevac Viewpoint", time: "15:45–17:30", desc: "מסלול הלוך־חזור עם עלייה וירידה; חלקים ממנו סמוכים לשפת המצוק. מבצעים רק כשהשביל יבש, יש ראות טובה והקבוצה אינה עייפה לאחר הרפטינג.", tags: ['weather', 'optional'], q: 'Ćurevac Viewpoint, Montenegro', distNext: "כ-30 דק' נהיגה",
              alt: "רטוב או עייפים? נוסעים ישר ל-Villa Tara." },
            { id: 'd3s5-v', name: "Villa Tara", time: "18:00", desc: "לינה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro' }
          ] },
        { id: 'calm', name: "רפטינג ויום רגוע", recommended: false, difficulty: 2,
          title: "רפטינג בדורמיטור + יום רגוע", badge: "רפטינג בלבד · חזרה כ-15:45",
          estimatedDriving: "כ-20 דק' (זמן משוער)", estimatedFinish: "כ-15:15", estimatedReturn: "כ-15:45",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Villa Tara, Žabljak, Montenegro',
          summary: "ברפטינג עצמו משתתפים 4 מתוך 6; אימא ואחותי שבהריון לא נכנסות למים.",
          chooseWhen: "חוזרים אחרי 14:30, רטוב, ערפל או עייפים.",
          notIncluded: "בלי תצפית Ćurevac.",
          changes: ["בלי Ćurevac", "מסיימים מוקדם"],
          photos: [
            { id: 'd3p1c', caption: "גשר Đurđevića Tara מעל קניון טארה", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/%C4%90ur%C4%91evi%C4%87a%20Tara%20Bridge%20(by%20Pudelek).JPG', credit: 'Marcin Szala, Wikimedia Commons (CC BY-SA 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:%C4%90ur%C4%91evi%C4%87a_Tara_Bridge_(by_Pudelek).JPG' }
          ],
          stops: [
            { id: 'd3s1-c', name: "Durmitor Adventure", time: "08:30 או 09:00", desc: "לפי הפרסום: התייצבות ב-08:30 במשרד Durmitor Adventure בז'בליאק, או ב-09:00 ליד גשר טארה. שעת המפגש הסופית לפי ההזמנה.", tags: ['mandatory'], navMode: 'none', q: 'Durmitor Adventure, Žabljak, Montenegro' },
            { id: 'd3s2-c', name: "רפטינג בקניון טארה", time: "08:30–13:30/14:00", desc: "הרפטינג עצמו נמשך כ-4 שעות, כולל כשעתיים במים. עם התייצבות, ציוד והסעות כדאי להקצות עד 5–5.5 שעות.", tags: ['mandatory', 'hard'], q: 'Durmitor Adventure, Žabljak, Montenegro', distNext: "כ-10 דק' נהיגה" },
            { id: 'd3s3-c', name: "ארוחה בז'בליאק", time: "14:15–15:15", desc: "ארוחת צהריים, בקצב רגוע.", tags: ['mandatory'], navMode: 'none', q: 'Žabljak, Montenegro' },
            { id: 'd3s4-c', name: "Villa Tara", time: "כ-15:45", desc: "חזרה מוקדמת, מנוחה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro' }
          ] }
      ] },

    // ---- 21.9 · לבודווה (2 אפשרויות) ----
    { top: "21.9", sub: "שני", mapCenter: "Budva, Montenegro", icon: 'car',
      plans: [
        { id: 'ostrog', name: "Ostrog + Sveti Stefan", recommended: true, difficulty: 3,
          title: "Ostrog Monastery + Sveti Stefan", badge: "נהיגה כ-5 שעות · יום של כ-11–12 שעות",
          estimatedDriving: "כ-5 שעות נהיגה עד בודווה (לא כולל Sveti Stefan) — לבדוק שוב סמוך לנסיעה", estimatedHotelArrival: "כ-14:30–15:30", estimatedTotalDay: "כ-11–12 שעות כולל ביקורים, אוכל ו-Sveti Stefan", estimatedReturn: "כ-19:00–19:30",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          summary: "יום תרבות במקום עוד יום טבע.",
          chooseWhen: "בא לכם משהו שונה מעוד אגם.",
          notIncluded: "בלי Biogradsko Jezero וקולאשין.",
          changes: ["Ostrog במקום Biogradsko וקולאשין", "כולל Sveti Stefan בערב"],
          photos: [
            { id: 'd4p1o', caption: "Ostrog Monastery – מנזר בתוך הצוק", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Montenegro%20-%20view%20down%20from%20Ostrog%20monastery.JPG', credit: 'Dickelbers, Wikimedia Commons (CC BY-SA 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Montenegro_-_view_down_from_Ostrog_monastery.JPG' },
            { id: 'd4p2o', caption: "Sveti Stefan מול חוף Miločer", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sveti%20Stefan%2C%20Montenegro.jpg', credit: 'Krzysztof Żwirski, Wikimedia Commons (CC BY 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Sveti_Stefan,_Montenegro.jpg' }
          ],
          stops: [
            { id: 'd4s1-o', name: "יציאה מ-Villa Tara", time: "07:15", desc: "יציאה מהווילה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro', distNext: "כ-2 שעות 15 דק' נהיגה (זמן משוער)" },
            { id: 'd4s2-o', name: "Ostrog Monastery", time: "09:30–11:30", desc: "מנזר בתוך הצוק. כביש הגישה צר ומפותל; לבדוק עד איזו חניה אפשר להגיע.", tags: ['mandatory', 'drivinghard'], q: 'Ostrog Monastery, Montenegro', distNext: "כ-3 שעות עד בודווה (זמן משוער)" },
            { id: 'd4s3-o', name: "עצירה לאוכל בדרך", time: "", desc: "עצירה לארוחה בדרך, בלי יעד קבוע.", tags: ['optional'], navMode: 'none', q: '' },
            { id: 'd4s4-o', name: "Hotel Pima, Budva", time: "14:30–15:30", desc: "צ'ק-אין במלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-90 דק' כולל מנוחה ונסיעה (זמן משוער)" },
            { id: 'd4s5-o', name: "Sveti Stefan + Miločer Park", time: "17:00–18:40", desc: "תצפית, חוף והליכה ב-Miločer. לא לבנות על כניסה לאי. האי פועל בעונת הקיץ כמלון פרטי. לא בונים את הביקור על כניסה ציבורית לאי. אפשר לשלב הליכה קצרה ומוצלת דרך פארק Miločer בין החופים. לא בונים על כניסה ציבורית לאי.", tags: ['optional'], q: 'Sveti Stefan, Montenegro', distNext: "כ-20 דק' חזרה ל-Hotel Pima (זמן משוער)" },
            { id: 'd4s6-o', name: "Hotel Pima", time: "כ-19:00–19:30", desc: "חזרה למלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] },
        { id: 'biogradsko', name: "Biogradsko Jezero + Sveti Stefan", recommended: false, difficulty: 2,
          title: "Biogradsko Jezero + Sveti Stefan", badge: "נהיגה כ-4:15–4:45 שעות · יום טבע",
          estimatedDriving: "כ-4:15–4:45 שעות, לפני הנסיעה המקומית ל-Sveti Stefan", estimatedHotelArrival: "כ-16:30", estimatedDayEnd: "כ-19:20–19:30 אם מבצעים את Sveti Stefan",
          routeStart: 'Villa Tara, Žabljak, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          summary: "טבע והליכה קלה, בלי נהיגת הרים.",
          chooseWhen: "מזג אוויר טוב ועדיפות לטבע והליכה קלה.",
          notIncluded: "בלי Ostrog.",
          changes: ["כולל אגם ויער", "Sveti Stefan רק אם מגיעים בזמן"],
          photos: [
            { id: 'd4p1b', caption: "Biogradsko Jezero – אגם ויער בפארק הלאומי", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Biogradsko%20jezero%20(1).JPG', credit: 'Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Biogradsko_jezero_(1).JPG' },
            { id: 'd4p2b', caption: "בודווה בערב", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Budva%20stari%20grad%20nocu%20-%20panoramio.jpg', credit: 'milos milosevic, Wikimedia Commons (CC BY 3.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Budva_stari_grad_nocu_-_panoramio.jpg' }
          ],
          stops: [
            { id: 'd4s1-b', name: "יציאה מ-Villa Tara", time: "07:15", desc: "יציאה מהווילה.", tags: ['mandatory'], q: 'Villa Tara, Žabljak, Montenegro', distNext: "כ-2 שעות 5 דק' נהיגה (זמן משוער)" },
            { id: 'd4s2-b', name: "Biogradsko Jezero", time: "09:20–11:00", desc: "הקפה קלה סביב האגם, כ-3.3–3.5 ק״מ. מקצים כ-1–1.5 שעות. חלק מהמסלול עובר על גשרוני עץ ועלול להיות רטוב או בוצי.", tags: ['mandatory'], q: 'Biogradsko Jezero, Montenegro', distNext: "כ-30 דק' נהיגה" },
            { id: 'd4s3-b', name: "Kolašin", time: "11:30–12:30", desc: "ארוחת צהריים בעיירה.", tags: ['mandatory'], navMode: 'none', q: 'Kolašin, Montenegro' },
            { id: 'd4s4-b', name: "עצירת דלק ושירותים", time: "", desc: "עצירה קצרה בכביש A1, בלי יעד קבוע.", tags: ['mandatory'], navMode: 'none', q: '' },
            { id: 'd4s5-b', name: "Hotel Pima, Budva", time: "כ-16:30", desc: "הגעה למלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-60 דק' כולל התארגנות ונסיעה (זמן משוער)" },
            { id: 'd4s6-b', name: "Sveti Stefan + Miločer Park", time: "17:30–19:00", desc: "תצפית, חוף והליכה ב-Miločer. לא לבנות על כניסה לאי. האי פועל בעונת הקיץ כמלון פרטי. לא בונים את הביקור על כניסה ציבורית לאי. רק אם מגיעים בזמן ולא עייפים. אם יוצאים מהמלון אחרי 17:30 — מוותרים. אפשר לשלב הליכה קצרה ומוצלת דרך פארק Miločer בין החופים. לא בונים על כניסה ציבורית לאי.", tags: ['optional', 'firstcancel'], q: 'Sveti Stefan, Montenegro', distNext: "כ-20 דק' חזרה ל-Hotel Pima (זמן משוער)",
              alt: "התחנה הראשונה לביטול היום." },
            { id: 'd4s7-b', name: "Hotel Pima", time: "כ-19:20–19:30", desc: "חזרה למלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] }
      ] },

    // ---- 22.9 · קוטור (4 אפשרויות) ----
    { top: "22.9", sub: "שלישי", mapCenter: "Kotor, Montenegro", icon: 'anchor',
      dayWarning: "שלוש אוניות צפויות בקוטור: Mein Schiff 4 ו-Norwegian Pearl בין 07:00–17:00, ו-Wind Surf בין 08:00–22:00. הלוח עשוי להשתנות; כדאי להגיע לעיר העתיקה עד 07:30.",
      plans: [
        { id: 'bluecave', name: "Blue Cave + רכבל", recommended: true, difficulty: 3,
          title: "קוטור + Blue Cave + רכבל", badge: "Blue Cave הוא עיקר היום · חזרה כ-17:45–18:30",
          estimatedDriving: "כ-2 שעות (זמן משוער)", estimatedFinish: "כ-16:30–17:00", estimatedReturn: "כ-17:45–18:30",
          routeStart: 'Hotel Pima, Budva, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          warning: "התוכנית עם הרכבל אפשרית רק אם נבחר סיור בוקר שחוזר לקוטור עד בערך 13:00. אם ההזמנה מאוחרת יותר, מוותרים על הרכבל ולא דוחסים את המשך היום.",
          chooseWhen: "ים רגוע, ראות טובה, בלי בעיה עם שיט מהיר.",
          notIncluded: "מחליף את הביקור העצמאי בפראסט.",
          avoidWhen: "לא מתאים למי שרגיש לים או לגב.",
          changes: ["Blue Cave הוא עיקר היום, תלוי מצב הים", "כולל Kotor Cable Car"],
          photos: [
            { id: 'd5p1bc', caption: "Kotor Old Town", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kotor%20Old%20Town.JPG', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Kotor_Old_Town.JPG' },
            { id: 'd5p2bc', caption: "Blue Cave (Plava špilja)", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Blue%20Cave%20(Plava%20%C5%A1pilja)%2C%20Bay%20of%20Kotor%2C%20Montenegro%2005.jpg', credit: 'Miomir Magdevski, Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Blue_Cave_(Plava_%C5%A1pilja),_Bay_of_Kotor,_Montenegro_05.jpg' }
          ],
          stops: [
            { id: 'd5s1-bc', name: "יציאה מ-Hotel Pima", time: "06:45", desc: "יציאה מוקדמת מהמלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-35–45 דק' נהיגה (זמן משוער)" },
            { id: 'd5s2-bc', name: "Parking Benovo (קוטור)", time: "07:20–07:30", desc: "Benovo הוא יעד החניה הראשי. אם מלא, בודקים את Kamelija או חניה בתשלום ליד IDEA. זמינות אינה מובטחת; לא מבזבזים זמן על חיפוש חניה ברחובות העיר העתיקה.", tags: ['mandatory'], q: 'Parking Benovo, Kotor, Montenegro', distNext: "כ-5 דק' הליכה" },
            { id: 'd5s3-bc', name: "Kotor Old Town", time: "07:30–09:15", desc: "העיר העתיקה לחוף המפרץ.", tags: ['mandatory'], navMode: 'walking', q: 'Kotor Old Town, Montenegro' },
            { id: 'd5s4-bc', name: "התייצבות לסיור Blue Cave", time: "התייצבות לפי אישור ההזמנה", desc: "התייצבות למפעיל בעיר העתיקה. מפעילים שונים מפרסמים שעות שונות — לעדכן כאן לאחר ביצוע ההזמנה. לפני ההזמנה מאשרים: נקודת יציאה וחזרה, משך הסיור, סוג הסירה, האם יש עצירה בפרסט או במנהרות הצוללות, ומה קורה במקרה של ים לא מתאים.", tags: ['mandatory'], navMode: 'none', q: 'Kotor Old Town, Montenegro' },
            { id: 'd5s5-bc', name: "סיור Blue Cave", time: "סיור של כשלוש שעות לפי ההזמנה", desc: "עיקר התוכנית. יוצאים רק אם מצב הים מתאים.", tags: ['mandatory', 'weather'], navMode: 'boat', q: 'Plava špilja, Bay of Kotor, Montenegro',
              alt: "ים גלי או שיט לא נוח — עוברים לתוכנית Lipa Cave." },
            { id: 'd5s6-bc', name: "אוכל קל והתארגנות", time: "אחרי החזרה מהשיט", desc: "ארוחה קלה לפני הרכבל.", tags: ['mandatory'], navMode: 'none', q: 'Kotor, Montenegro', distNext: "כ-50 דק' חזרה לרכב ונסיעה ל-DUB (זמן משוער)" },
            { id: 'd5s7-bc', name: "Kotor Cable Car – Lower Station DUB", time: "14:30–16:30 — רק אם סיור הבוקר מסתיים עד כ-13:00", desc: "מהתחנה התחתונה בלבד. אפשר להישאר למעלה עד 17:00 אם הראות טובה. ⛭ נבדק 30.7.2026: ביום שלישי פתיחה ב-10:30; כרטיס מבוגר הלוך-חזור €25; הנסיעה כ-11 דקות לכל כיוון. שעות רגילות עד 22:00, עלייה אחרונה 21:30 וירידה אחרונה 22:00. לבדוק שוב סמוך לטיול.", tags: ['mandatory'], q: 'Kotor Cable Car Lower Station DUB, Montenegro', distNext: "כ-45–90 דק' נהיגה, תלוי אם נשארים לתצפית נוספת (זמן משוער)",
              checked: { date: '30.7.2026', href: 'https://www.kotorcablecar.me/plan-your-visit/tickets' } },
            { id: 'd5s8-bc', name: "Hotel Pima", time: "כ-17:45–18:30", desc: "חזרה למלון, בודווה.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] },
        { id: 'classic', name: "המפרץ הקלאסי", recommended: false, difficulty: 2,
          title: "קוטור + פראסט + רכבל", badge: "יום רגוע יותר · חזרה כ-17:00–17:45",
          estimatedDriving: "כ-2 שעות (זמן משוער)", estimatedFinish: "כ-16:30–17:00", estimatedReturn: "כ-17:00–17:45",
          routeStart: 'Hotel Pima, Budva, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          chooseWhen: "יום רגוע יותר, פחות שיט מהיר, יותר הליכה עירונית.",
          notIncluded: "בלי Blue Cave.",
          changes: ["בלי Blue Cave, עם פראסט העצמאי", "קצב רגוע יותר"],
          photos: [
            { id: 'd5p1cl', caption: "Kotor Old Town", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kotor%20Old%20Town.JPG', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Kotor_Old_Town.JPG' },
            { id: 'd5p2cl', caption: "Our Lady of the Rocks מול פראסט", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Our%20Lady%20of%20the%20Rocks%20Montenegro.jpg', credit: 'Desemeus, Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Our_Lady_of_the_Rocks_Montenegro.jpg' }
          ],
          stops: [
            { id: 'd5s1-cl', name: "יציאה מ-Hotel Pima", time: "06:45", desc: "יציאה מוקדמת מהמלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-35–45 דק' נהיגה (זמן משוער)" },
            { id: 'd5s2-cl', name: "Parking Benovo (קוטור)", time: "07:20–07:30", desc: "Benovo הוא יעד החניה הראשי. אם מלא, בודקים את Kamelija או חניה בתשלום ליד IDEA. זמינות אינה מובטחת; לא מבזבזים זמן על חיפוש חניה ברחובות העיר העתיקה.", tags: ['mandatory'], q: 'Parking Benovo, Kotor, Montenegro', distNext: "כ-5 דק' הליכה" },
            { id: 'd5s3-cl', name: "Kotor Old Town", time: "07:30–09:45", desc: "העיר העתיקה לחוף המפרץ.", tags: ['mandatory'], navMode: 'walking', q: 'Kotor Old Town, Montenegro' },
            { id: 'd5s4a-cl', name: "חניית Perast", time: "10:20", desc: "חניה בכניסה לעיירה.", tags: ['mandatory'], q: 'Perast, Montenegro' },
            { id: 'd5s4b-cl', name: "Perast", time: "10:20–11:30", desc: "טיילת וכנסייה לאורך החוף.", tags: ['mandatory'], navMode: 'walking', q: 'Perast, Montenegro' },
            { id: 'd5s4c-cl', name: "Our Lady of the Rocks", time: "11:30–13:00", desc: "שיט קצר לאי, אם השיט פועל. מחיר ושעות — לבדוק מול המפעיל המקומי.", tags: ['optional', 'weather'], navMode: 'boat', q: 'Our Lady of the Rocks, Perast, Montenegro', distNext: "כ-90 דק' נהיגה, כולל ארוחה קלה בדרך",
              alt: "שיט לא פועל? מסתפקים בתצפית מהחוף." },
            { id: 'd5s5-cl', name: "Kotor Cable Car – Lower Station DUB", time: "14:30–16:30", desc: "מהתחנה התחתונה בלבד. אפשר להישאר למעלה עד 17:00 אם הראות טובה. ⛭ נבדק 30.7.2026: ביום שלישי פתיחה ב-10:30; כרטיס מבוגר הלוך-חזור €25; הנסיעה כ-11 דקות לכל כיוון. שעות רגילות עד 22:00, עלייה אחרונה 21:30 וירידה אחרונה 22:00. לבדוק שוב סמוך לטיול.", tags: ['mandatory'], q: 'Kotor Cable Car Lower Station DUB, Montenegro', distNext: "כ-30 דק' נהיגה",
              checked: { date: '30.7.2026', href: 'https://www.kotorcablecar.me/plan-your-visit/tickets' } },
            { id: 'd5s6-cl', name: "Hotel Pima", time: "כ-17:00–17:45", desc: "חזרה למלון, בודווה.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] },
        { id: 'lipacave', name: "Lipa Cave — תוכנית יבשתית", recommended: false, difficulty: 2,
          title: "קוטור + רכבל + Lipa Cave", badge: "קושי קל–בינוני · חזרה כ-16:45–17:30",
          estimatedDriving: "כ-2.5 שעות (זמן משוער)", estimatedFinish: "כ-15:30", estimatedReturn: "כ-16:45–17:30",
          routeStart: 'Hotel Pima, Budva, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          chooseWhen: "ים גלי, גשם קל, או שמעדיפים פעילות מקורה. הרכבל עדיין תלוי רוח וראות.",
          notIncluded: "בלי Blue Cave ובלי פראסט.",
          changes: ["פעילות מקורה במקום שיט", "קושי קל–בינוני, לא מאתגר"],
          photos: [
            { id: 'd5p1lc', caption: "Kotor Old Town", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kotor%20Old%20Town.JPG', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Kotor_Old_Town.JPG' },
            { id: 'd5p2lc', caption: "Lipa Cave – האולם הגדול", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lipa%20Cave%20Big%20Hall.jpg', credit: 'Mitia Morovov-Sheiner, Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Lipa_Cave_Big_Hall.jpg' }
          ],
          stops: [
            { id: 'd5s1-lc', name: "יציאה מ-Hotel Pima", time: "06:45", desc: "יציאה מוקדמת מהמלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-35–45 דק' נהיגה (זמן משוער)" },
            { id: 'd5s2-lc', name: "Parking Benovo (קוטור)", time: "07:20–07:30", desc: "Benovo הוא יעד החניה הראשי. אם מלא, בודקים את Kamelija או חניה בתשלום ליד IDEA. זמינות אינה מובטחת; לא מבזבזים זמן על חיפוש חניה ברחובות העיר העתיקה.", tags: ['mandatory'], q: 'Parking Benovo, Kotor, Montenegro', distNext: "כ-5 דק' הליכה" },
            { id: 'd5s3-lc', name: "Kotor Old Town", time: "07:30–09:30", desc: "העיר העתיקה לחוף המפרץ.", tags: ['mandatory'], navMode: 'walking', q: 'Kotor Old Town, Montenegro' },
            { id: 'd5s4-lc', name: "Kotor Cable Car – Lower Station DUB", time: "10:30–12:15", desc: "מהתחנה התחתונה בלבד. תלוי רוח וראות. ⛭ נבדק 30.7.2026: ביום שלישי פתיחה ב-10:30; כרטיס מבוגר הלוך-חזור €25; הנסיעה כ-11 דקות לכל כיוון. שעות רגילות עד 22:00, עלייה אחרונה 21:30 וירידה אחרונה 22:00. לבדוק שוב סמוך לטיול.", tags: ['mandatory', 'weather'], q: 'Kotor Cable Car Lower Station DUB, Montenegro', distNext: "כ-1 שעה 45 דק' כולל ארוחה ונסיעה לכיוון Cetinje (זמן משוער)",
              checked: { date: '30.7.2026', href: 'https://www.kotorcablecar.me/plan-your-visit/tickets' },
              alt: "רכבל מושבת ברוח? מדלגים וממשיכים: קוטור → ארוחה/Cetinje → Lipa Cave." },
            { id: 'd5s5-lc', name: "ארוחה ונסיעה לכיוון Cetinje", time: "", desc: "ארוחה בדרך לצטיניה.", tags: ['mandatory'], navMode: 'none', q: '' },
            { id: 'd5s6-lc', name: "Lipa Cave Parking", time: "14:00", desc: "מגיעים 30 דקות לפני מועד הסיור. מגיעים לפחות 30 דקות מראש. מהחניה ממשיכים למערה ברכבת התיירים של האתר.", tags: ['mandatory'], q: 'Lipa Cave Parking, Montenegro', distNext: "המתנה קצרה עד הסיור" },
            { id: 'd5s7-lc', name: "סיור Lipa Cave", time: "14:30–15:30", desc: "סיור של שעה. קריר בפנים; נעליים סגורות ושכבה קלה. לא נגיש לכיסא גלגלים. הטמפרטורה במערה כ-10–12 מעלות. מגיעים עם נעליים סגורות ושכבה חמה.", tags: ['mandatory'], navMode: 'none', q: 'Lipa Cave Parking, Montenegro',
              checked: { date: '30.7.2026', href: 'https://lipa-cave.me/tour-timetable/' } },
            { id: 'd5s8-lc', name: "Hotel Pima", time: "כ-16:45–17:30", desc: "חזרה למלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] },
        { id: 'lovcen', name: "Lovćen Mausoleum", recommended: false, difficulty: 3,
          title: "קוטור + רכבל + Lovćen Mausoleum", badge: "לא מומלץ כברירת מחדל · חזרה כ-19:00–19:30",
          estimatedDriving: "כ-3.5–4 שעות (זמן משוער)", estimatedFinish: "סיום הביקור עד כ-18:30", estimatedReturn: "כ-19:00–19:30",
          routeStart: 'Hotel Pima, Budva, Montenegro', routeEnd: 'Hotel Pima, Budva, Montenegro',
          chooseWhen: "מזג אוויר בהיר וכולם מוכנים ליום ארוך ול-461 מדרגות.",
          notIncluded: "מחליף את Blue Cave, פראסט ו-Lipa Cave.",
          changes: ["עלייה להר לובצ'ן אחרי הרכבל", "יום הכי ארוך מבין האפשרויות"],
          warning: "לא על הדרך. יורדים מהרכבל, חוזרים לרכב ונוסעים להר. במאוזוליאום יש 461 מדרגות. מומלץ לסיים את הביקור עד 18:30. החזרה לבודווה תהיה בשעת הדמדומים ועלולה להסתיים אחרי החשכה.",
          photos: [
            { id: 'd5p1lv', caption: "Kotor Old Town", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kotor%20Old%20Town.JPG', credit: 'Wikimedia Commons', creditHref: 'https://commons.wikimedia.org/wiki/File:Kotor_Old_Town.JPG' },
            { id: 'd5p2lv', caption: "Njegoš Mausoleum, הר לובצ'ן", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Petar%20II%20Petrovi%C4%87-Njego%C5%A1%20mausoleum%2025.jpg', credit: 'Milica Buha, Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Petar_II_Petrovi%C4%87-Njego%C5%A1_mausoleum_25.jpg' }
          ],
          stops: [
            { id: 'd5s1-lv', name: "יציאה מ-Hotel Pima", time: "06:45", desc: "יציאה מוקדמת מהמלון.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro', distNext: "כ-35–45 דק' נהיגה (זמן משוער)" },
            { id: 'd5s2-lv', name: "Parking Benovo (קוטור)", time: "07:20–07:30", desc: "Benovo הוא יעד החניה הראשי. אם מלא, בודקים את Kamelija או חניה בתשלום ליד IDEA. זמינות אינה מובטחת; לא מבזבזים זמן על חיפוש חניה ברחובות העיר העתיקה.", tags: ['mandatory'], q: 'Parking Benovo, Kotor, Montenegro', distNext: "כ-5 דק' הליכה" },
            { id: 'd5s3-lv', name: "Kotor Old Town", time: "07:30–09:30", desc: "העיר העתיקה לחוף המפרץ.", tags: ['mandatory'], navMode: 'walking', q: 'Kotor Old Town, Montenegro' },
            { id: 'd5s4-lv', name: "Kotor Cable Car – Lower Station DUB", time: "10:30–12:15", desc: "מהתחנה התחתונה בלבד. ⛭ נבדק 30.7.2026: ביום שלישי פתיחה ב-10:30; כרטיס מבוגר הלוך-חזור €25; הנסיעה כ-11 דקות לכל כיוון. שעות רגילות עד 22:00, עלייה אחרונה 21:30 וירידה אחרונה 22:00. לבדוק שוב סמוך לטיול.", tags: ['mandatory'], q: 'Kotor Cable Car Lower Station DUB, Montenegro', distNext: "ארוחה, ואז נסיעה נפרדת להר (זמן משוער)",
              checked: { date: '30.7.2026', href: 'https://www.kotorcablecar.me/plan-your-visit/tickets' } },
            { id: 'd5s5-lv', name: "ארוחה", time: "", desc: "ארוחת צהריים.", tags: ['mandatory'], navMode: 'none', q: '' },
            { id: 'd5s6-lv', name: "Njegoš Mausoleum, Lovćen", time: "סיום הביקור עד 18:30", desc: "461 מדרגות. מומלץ לסיים עד 18:30; החזרה לבודווה תהיה בדמדומים ועלולה להסתיים אחרי החשכה.", tags: ['mandatory', 'hard'], q: 'Njegoš Mausoleum, Lovćen National Park, Montenegro', distNext: "כ-19:00–19:30 חזרה לבודווה (זמן משוער)" },
            { id: 'd5s7-lv', name: "Hotel Pima, Budva", time: "כ-19:00–19:30", desc: "חזרה למלון בערב.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' }
          ] }
      ] },

    // ---- 23.9 · חזרה וטיסה (מסלול יחיד) ----
    { top: "23.9", sub: "רביעי", mapCenter: "Tivat, Montenegro", icon: 'plane',
      plans: [
        { id: 'default', name: "המסלול היחיד ליום זה", recommended: true, difficulty: 1,
          title: "חזרה וטיסה", badge: "עד הטיסה ב-15:00",
          routeStart: 'Hotel Pima, Budva, Montenegro', routeEnd: 'Tivat Airport, Montenegro',
          photos: [
            { id: 'd6p1', caption: "טיווט — תמונת אווירה בלבד. אין עצירה מתוכננת לפני הטיסה.", src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Porto%20Montenegro%2C%20summer%202019%2001.jpg', credit: 'Miomir Magdevski, Wikimedia Commons (CC BY-SA 4.0)', creditHref: 'https://commons.wikimedia.org/wiki/File:Porto_Montenegro,_summer_2019_01.jpg' }
          ],
          stops: [
            { id: 'd6s1', name: "Hotel Pima", time: "10:00", desc: "צ'ק-אאוט.", tags: ['mandatory'], q: 'Hotel Pima, Budva, Montenegro' },
            { id: 'd6s2', name: "תדלוק לפי הצורך", time: "10:15", desc: "עצירת תדלוק, אם צריך.", tags: ['optional'], activeByDefault: false, q: 'Budva, Montenegro' },
            { id: 'd6s3', name: "יציאה לכיוון שדה התעופה", time: "10:45", desc: "יוצאים לטיוואט.", tags: ['mandatory'], navMode: 'none', q: '' },
            { id: 'd6s4', name: "הגעה להחזרת הרכב", time: "11:30–11:45", desc: "החזרת הרכב, שדה התעופה טיבאט.", tags: ['mandatory'], q: 'Tivat Airport, Montenegro', distNext: "" },
            { id: 'd6s5', name: "כניסה לטרמינל", time: "עד 12:15", desc: "נכנסים לטרמינל.", tags: ['mandatory'], navMode: 'walking', q: 'Tivat Airport, Montenegro' },
            { id: 'd6s6', name: "בתוך הטרמינל", time: "13:00", desc: "בפנים, לפני הטיסה.", tags: ['mandatory'], navMode: 'none', q: '' },
            { id: 'd6s7', name: "טיסה", time: "15:00", desc: "טיסת החזרה.", tags: ['mandatory'], navMode: 'none', q: '' }
          ] }
      ] }
  ];

  function defaultPlanFor(day) {
    const plans = DAYS[day - 1].plans;
    const rec = plans.find(p => p.recommended);
    return rec ? rec.id : plans[0].id;
  }

  // ---- input sanitization (shared by localStorage load and file import) ----
  function isValidDay(day) { return Number.isInteger(day) && day >= 1 && day <= DAYS.length; }
  function isValidPlan(day, planId) { return DAYS[day - 1].plans.some(p => p.id === planId); }
  function allStopIdsForPlan(day, planId) {
    const plan = DAYS[day - 1].plans.find(p => p.id === planId);
    return plan ? plan.stops.map(s => s.id) : [];
  }

  // Migrates the pre-multi-plan overrides shape ({day: {dayNote,...}}) into the
  // current nested shape ({day: {planId: {dayNote,...}}}) on a raw (unsanitized)
  // object, before sanitizeOverrides validates it.
  function migrateOverrides(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(day => {
      const val = raw[day];
      const looksOld = val && typeof val === 'object' &&
        ('dayNote' in val || 'stopNotes' in val || 'stopEdits' in val || 'customStops' in val || 'order' in val);
      out[day] = looksOld ? { [defaultPlanFor(Number(day))]: val } : val;
    });
    return out;
  }

  function sanitizeSelectedPlans(raw) {
    const out = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(dayKey => {
        const day = Number(dayKey);
        if (isValidDay(day) && typeof raw[dayKey] === 'string' && isValidPlan(day, raw[dayKey])) {
          out[day] = raw[dayKey];
        }
      });
    }
    return out;
  }

  function sanitizeCustomStops(rawArr) {
    if (!Array.isArray(rawArr)) return [];
    const seen = new Set();
    const out = [];
    rawArr.forEach(s => {
      if (!s || typeof s !== 'object') return;
      const id = typeof s.id === 'string' ? s.id : '';
      const name = typeof s.name === 'string' ? s.name.trim() : '';
      const q = typeof s.q === 'string' ? s.q.trim() : '';
      if (!id || !name || !q || seen.has(id)) return;
      seen.add(id);
      const tags = Array.isArray(s.tags) ? s.tags.filter(t => TAG_META[t]) : [];
      const entry = { id, name, q, time: typeof s.time === 'string' ? s.time : '', desc: typeof s.desc === 'string' ? s.desc : '', tags };
      if (['driving', 'walking', 'boat', 'none'].includes(s.navMode)) entry.navMode = s.navMode;
      if (typeof s.distNext === 'string') entry.distNext = s.distNext;
      out.push(entry);
    });
    return out;
  }

  function sanitizeStopEdits(raw, validIds) {
    const out = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(id => {
        if (!validIds.has(id) || !raw[id] || typeof raw[id] !== 'object') return;
        const clean = {};
        ['name', 'time', 'desc', 'distNext'].forEach(k => { if (typeof raw[id][k] === 'string') clean[k] = raw[id][k]; });
        if (Object.keys(clean).length) out[id] = clean;
      });
    }
    return out;
  }

  function sanitizeStringMap(raw, validIds) {
    const out = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(id => {
        if (validIds && !validIds.has(id)) return;
        if (typeof raw[id] === 'string') out[id] = raw[id];
      });
    }
    return out;
  }

  function sanitizeBooleanMap(raw, validIds) {
    const out = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(id => {
        if (validIds && !validIds.has(id)) return;
        if (typeof raw[id] === 'boolean') out[id] = raw[id];
      });
    }
    return out;
  }

  function sanitizeOverrides(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(dayKey => {
      const day = Number(dayKey);
      if (!isValidDay(day) || !raw[dayKey] || typeof raw[dayKey] !== 'object') return;
      const planOut = {};
      Object.keys(raw[dayKey]).forEach(planId => {
        if (!isValidPlan(day, planId)) return;
        const ov = raw[dayKey][planId];
        if (!ov || typeof ov !== 'object') return;
        const plan = DAYS[day - 1].plans.find(p => p.id === planId);
        const customStops = sanitizeCustomStops(ov.customStops);
        const baseIds = new Set(allStopIdsForPlan(day, planId));
        const allIds = new Set([...baseIds, ...customStops.map(c => c.id)]);
        const stopEdits = sanitizeStopEdits(ov.stopEdits, baseIds);
        const order = Array.isArray(ov.order) ? [...new Set(ov.order.filter(id => typeof id === 'string' && allIds.has(id)))] : null;
        const stopNotes = sanitizeStringMap(ov.stopNotes, allIds);
        const dayNote = typeof ov.dayNote === 'string' ? ov.dayNote : '';
        const routeableIds = new Set(
          plan.stops.filter(stopRouteable).map(s => s.id).concat(customStops.filter(stopRouteable).map(c => c.id))
        );
        const routeToggles = sanitizeBooleanMap(ov.routeToggles, routeableIds);
        planOut[planId] = { dayNote, stopNotes, stopEdits, customStops, order, routeToggles };
      });
      if (Object.keys(planOut).length) out[day] = planOut;
    });
    return out;
  }

  function sanitizeCompleted(raw, overrides) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const validIds = new Set();
    DAYS.forEach(d => d.plans.forEach(p => p.stops.forEach(s => validIds.add(s.id))));
    Object.keys(overrides || {}).forEach(day => {
      Object.keys(overrides[day]).forEach(planId => {
        (overrides[day][planId].customStops || []).forEach(c => validIds.add(c.id));
      });
    });
    Object.keys(raw).forEach(id => {
      if (validIds.has(id) && typeof raw[id] === 'boolean') out[id] = raw[id];
    });
    return out;
  }

  function sanitizeFontSize(raw, fallback) {
    return (raw === 'large' || raw === 'normal') ? raw : fallback;
  }

  // ---- state ----
  const state = { activeDay: 0, completed: {}, altOpen: {}, overrides: {}, editMode: false, selectedPlans: {}, compareOpen: false, fontSize: 'normal', online: navigator.onLine };

  try {
    const raw = localStorage.getItem('mn2026-overrides');
    if (raw) {
      state.overrides = sanitizeOverrides(migrateOverrides(JSON.parse(raw)));
      saveOverrides();
    }
  } catch (e) {}

  try {
    const raw = localStorage.getItem('mn2026-selected-plans');
    if (raw) state.selectedPlans = sanitizeSelectedPlans(JSON.parse(raw));
  } catch (e) {}

  try {
    const raw = localStorage.getItem('mn2026-completed');
    if (raw) state.completed = sanitizeCompleted(JSON.parse(raw), state.overrides);
  } catch (e) {}

  try {
    state.fontSize = sanitizeFontSize(localStorage.getItem('mn2026-fontsize'), state.fontSize);
  } catch (e) {}

  function saveCompleted() {
    try { localStorage.setItem('mn2026-completed', JSON.stringify(state.completed)); } catch (e) {}
  }
  function saveOverrides() {
    try { localStorage.setItem('mn2026-overrides', JSON.stringify(state.overrides)); } catch (e) {}
  }
  function saveSelectedPlans() {
    try { localStorage.setItem('mn2026-selected-plans', JSON.stringify(state.selectedPlans)); } catch (e) {}
  }
  function saveFontSize() {
    try { localStorage.setItem('mn2026-fontsize', state.fontSize); } catch (e) {}
  }

  function getSelectedPlan(day) { return state.selectedPlans[day] || defaultPlanFor(day); }
  function getPlan(day) {
    const planId = getSelectedPlan(day);
    return DAYS[day - 1].plans.find(p => p.id === planId) || DAYS[day - 1].plans[0];
  }
  function selectPlan(day, planId) {
    state.selectedPlans[day] = planId;
    saveSelectedPlans();
    state.compareOpen = false;
    updateHash(day, planId);
    render();
  }

  function getDayOverride(day) {
    const planId = getSelectedPlan(day);
    const dayObj = state.overrides[day] || {};
    const existing = dayObj[planId];
    return {
      dayNote: (existing && existing.dayNote) || '',
      stopNotes: (existing && existing.stopNotes) || {},
      stopEdits: (existing && existing.stopEdits) || {},
      customStops: (existing && existing.customStops) || [],
      order: (existing && existing.order) || null,
      routeToggles: (existing && existing.routeToggles) || {}
    };
  }

  function updateDayOverride(day, mutator) {
    const planId = getSelectedPlan(day);
    const ov = getDayOverride(day);
    mutator(ov);
    if (!state.overrides[day]) state.overrides[day] = {};
    state.overrides[day][planId] = ov;
    saveOverrides();
  }

  function effectiveStops(day) {
    const plan = getPlan(day);
    const ov = getDayOverride(day);
    const base = plan.stops.map(s => ({ ...s, ...(ov.stopEdits[s.id] || {}) }));
    const custom = (ov.customStops || []).map(s => ({ ...s }));
    let all = base.concat(custom);
    if (ov.order && ov.order.length) {
      const pos = (id) => { const i = ov.order.indexOf(id); return i === -1 ? Infinity : i; };
      all = all.slice().sort((a, b) => pos(a.id) - pos(b.id));
    }
    return all;
  }

  function isStopRouteActive(day, s) {
    if (!stopRouteable(s)) return false;
    const ov = getDayOverride(day);
    if (Object.prototype.hasOwnProperty.call(ov.routeToggles, s.id)) return !!ov.routeToggles[s.id];
    return stopActiveDefault(s);
  }

  function toggleRouteStop(day, id) {
    const stops = effectiveStops(day);
    const s = stops.find(x => x.id === id);
    if (!s) return;
    const current = isStopRouteActive(day, s);
    updateDayOverride(day, ov => { ov.routeToggles[id] = !current; });
    render();
  }

  function routeStops(day) {
    return effectiveStops(day).filter(s => isStopRouteActive(day, s));
  }

  // Builds the day's ordered map query list anchored to the plan's fixed
  // routeStart/routeEnd, regardless of which optional stops are toggled.
  // A routed stop whose q already equals the start/end is not duplicated;
  // only genuinely consecutive duplicates collapse, and an explicit
  // start===end pair (e.g. a same-hotel loop) is always kept as two entries.
  function routeQueries(day) {
    const plan = getPlan(day);
    const mid = routeStops(day).map(s => s.q).filter(Boolean);
    const qs = mid.slice();
    if (plan.routeStart && qs[0] !== plan.routeStart) qs.unshift(plan.routeStart);
    if (plan.routeEnd && qs[qs.length - 1] !== plan.routeEnd) qs.push(plan.routeEnd);
    const out = [];
    qs.forEach((q, i) => {
      const isExplicitBoundaryPair = qs.length === 2 && i === 1 && plan.routeStart === plan.routeEnd;
      if (i > 0 && qs[i - 1] === q && !isExplicitBoundaryPair) return;
      out.push(q);
    });
    return out;
  }

  // Chunks an ordered list of map queries into Maps-link segments of at most
  // origin + 3 waypoints + destination (5 stops). Consecutive segments share
  // their boundary stop (previous destination = next origin) — no stop is ever
  // dropped or silently omitted from the itinerary.
  function buildRouteSegments(qs) {
    if (qs.length <= 5) return [qs];
    const segments = [];
    let start = 0;
    while (start < qs.length - 1) {
      const end = Math.min(start + 4, qs.length - 1);
      segments.push(qs.slice(start, end + 1));
      start = end;
    }
    return segments;
  }

  function commitField(day, field, id, value) {
    updateDayOverride(day, ov => {
      if (field === 'dayNote') { ov.dayNote = value; return; }
      if (field === 'stopNote') { ov.stopNotes[id] = value; return; }
      const key = { stopName: 'name', stopTime: 'time', stopDesc: 'desc', stopDistNext: 'distNext' }[field];
      if (!key) return;
      const custom = ov.customStops.find(c => c.id === id);
      if (custom) { custom[key] = value; return; }
      if (!ov.stopEdits[id]) ov.stopEdits[id] = {};
      ov.stopEdits[id][key] = value;
    });
  }

  // Commits whatever edit field currently has focus, without rendering. Must run
  // before any action that replaces DOM/order/day/plan, so a single click that both
  // blurs an input and triggers an action (move/delete/switch/etc.) saves the edit
  // and performs the action in one render instead of racing a mid-gesture re-render.
  function flushPendingEdit() {
    const el = document.activeElement;
    if (!el || typeof el.matches !== 'function' || !el.matches('[data-field]')) return;
    const field = el.getAttribute('data-field');
    const day = Number(el.getAttribute('data-day'));
    const id = el.getAttribute('data-id');
    commitField(day, field, id, el.value);
  }

  function moveStop(day, id, dir) {
    const ids = effectiveStops(day).map(s => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    updateDayOverride(day, ov => { ov.order = ids; });
    render();
  }

  function addStop(day, data) {
    const id = 'custom-' + day + '-' + Date.now();
    updateDayOverride(day, ov => {
      ov.customStops.push({ id, name: data.name, q: data.q, time: data.time || '', desc: data.desc || '', tags: [data.tag || 'optional'] });
    });
    render();
  }

  function deleteCustomStop(day, id) {
    updateDayOverride(day, ov => {
      ov.customStops = ov.customStops.filter(s => s.id !== id);
      if (ov.order) ov.order = ov.order.filter(x => x !== id);
      delete ov.stopNotes[id];
      delete ov.routeToggles[id];
    });
    delete state.completed[id];
    saveCompleted();
    delete state.altOpen[id];
    render();
  }

  function resetDayOverrides(day) {
    const planId = getSelectedPlan(day);
    if (state.overrides[day] && state.overrides[day][planId]) {
      const orphanIds = (state.overrides[day][planId].customStops || []).map(s => s.id);
      if (orphanIds.length) {
        orphanIds.forEach(id => { delete state.completed[id]; delete state.altOpen[id]; });
        saveCompleted();
      }
      delete state.overrides[day][planId];
    }
    saveOverrides();
    render();
  }

  // ---- hash deep-linking (#day=N&plan=ID, #info) ----
  function updateHash(day, planId) {
    let hash;
    if (day === 'info') hash = '#info';
    else if (day === 0) hash = '#day=0';
    else hash = '#day=' + day + (planId ? '&plan=' + planId : '');
    try { history.replaceState(null, '', hash); } catch (e) { location.hash = hash; }
  }

  function parseHash() {
    const h = location.hash.replace(/^#/, '');
    if (h === 'info') return { day: 'info' };
    const params = new URLSearchParams(h);
    const day = params.get('day');
    return { day: day != null ? Number(day) : null, plan: params.get('plan') };
  }

  function autoOpenTodayIfInRange() {
    const now = new Date();
    if (now.getFullYear() === 2026 && now.getMonth() === 8 && now.getDate() >= 18 && now.getDate() <= 23) {
      state.activeDay = now.getDate() - 17;
    }
  }

  function selectDay(i) { state.activeDay = i; state.compareOpen = false; updateHash(i, i >= 1 ? getSelectedPlan(i) : null); render(); window.scrollTo(0, 0); }
  function selectInfo() { state.activeDay = 'info'; state.compareOpen = false; updateHash('info'); render(); window.scrollTo(0, 0); }
  function goPrev() { if (typeof state.activeDay !== 'number') return; state.activeDay = Math.max(1, state.activeDay - 1); state.compareOpen = false; updateHash(state.activeDay, getSelectedPlan(state.activeDay)); render(); window.scrollTo(0, 0); }
  function goNext() { if (typeof state.activeDay !== 'number') return; state.activeDay = Math.min(DAYS.length, state.activeDay + 1); state.compareOpen = false; updateHash(state.activeDay, getSelectedPlan(state.activeDay)); render(); window.scrollTo(0, 0); }
  function toggleDone(id) { state.completed[id] = !state.completed[id]; saveCompleted(); render(); }
  function toggleAlt(id) { state.altOpen[id] = !state.altOpen[id]; render(); }

  function dayProgress(stops) {
    const total = stops.length;
    const done = stops.filter(s => state.completed[s.id]).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function diffDotsHtml(level) {
    return [1, 2, 3].map(i =>
      `<span class="diff-dot${i <= level ? ' filled' : ''}"></span>`
    ).join('');
  }

  function tagsHtml(tags) {
    return tags.map(k => {
      const meta = TAG_META[k];
      if (!meta) return '';
      return `<span class="tag ${meta.cls}">${meta.label}</span>`;
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function checkedBadgeHtml(checked) {
    if (!checked) return '';
    return ` <a class="checked-badge" href="${esc(checked.href)}" target="_blank" rel="noopener noreferrer">נבדק ב${esc(checked.date)}</a>`;
  }

  function photoHtml(ph, count) {
    const heightClass = count <= 1 ? '300px' : '210px';
    if (ph.src) {
      const credit = ph.credit ? esc(ph.credit) : '';
      const creditLink = ph.creditHref
        ? `<a href="${esc(ph.creditHref)}" target="_blank" rel="noopener noreferrer">${credit}</a>`
        : credit;
      return `
        <div class="photo-wrap">
          <div class="photo-frame" style="height:${heightClass}">
            <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" decoding="async" onerror="window.__photoError(this)">
            ${credit ? `<span class="photo-credit">${creditLink}</span>` : ''}
          </div>
          <span class="photo-caption">${esc(ph.caption)}</span>
        </div>`;
    }
    return `
      <div class="photo-wrap">
        <div class="photo-frame" style="height:${heightClass}">
          <div class="photo-placeholder">
            ${PHOTO_PLACEHOLDER_ICON}
            <span>אין תמונה עדיין</span>
          </div>
        </div>
        <span class="photo-caption">${esc(ph.caption)}</span>
      </div>`;
  }

  window.__photoError = function (img) {
    const frame = img.closest('.photo-frame');
    if (frame) frame.innerHTML = `<div class="photo-placeholder">${PHOTO_PLACEHOLDER_ICON}<span>אי אפשר לטעון תמונה בלי אינטרנט</span></div>`;
  };

  function renderHome() {
    const dayTabsHtml = tabsHtml();

    const routeHtml = DAYS.map((d, i) => {
      const num = i + 1;
      const hasNext = i < DAYS.length - 1;
      return `
        <div class="trip-route-item">
          <button class="trip-route-node" data-action="select" data-day="${num}">
            <div class="trip-route-dot${state.activeDay === num ? ' active' : ''}">${num}</div>
            <span class="trip-route-label">${esc(d.top)}</span>
          </button>
          ${hasNext ? '<div class="trip-route-divider"></div>' : ''}
        </div>`;
    }).join('');

    const legendHtml = ['mandatory', 'optional', 'weather', 'hard', 'firstcancel', 'drivinghard'].map(k => {
      const meta = TAG_META[k];
      return `<span class="tag ${meta.cls}">${meta.label}</span>`;
    }).join('');

    const cardsHtml = DAYS.map((d, i) => {
      const day = i + 1;
      const plan = getPlan(day);
      const { done, total, pct } = dayProgress(effectiveStops(day));
      const planNote = d.plans.length > 1 ? ` · ${esc(plan.name)}` : '';
      return `
        <button class="day-card" data-action="select" data-day="${day}">
          <div class="day-card-top">
            <div class="day-card-title-line">
              <span class="day-card-num">${String(day).padStart(2, '0')}</span>
              <span>${esc(d.top)} · ${esc(d.sub)}</span>
            </div>
            <span class="day-card-badge">${esc(plan.badge)}${planNote}</span>
          </div>
          <p class="day-card-body">${esc(plan.title)}</p>
          <div class="day-card-bottom">
            <div class="diff-dots">${diffDotsHtml(plan.difficulty)}</div>
            <span class="progress-label">${done}/${total}</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress-fill" style="width:${pct}%"></div></div>
        </button>`;
    }).join('');

    return `
      ${dayTabsHtml}
      <main>
        <section>
          <div class="hero">
            <h1>מונטנגרו 2026</h1>
            <p>18–23 בספטמבר · 6 מבוגרים · טיוואט → דורמיטור → קוטור ובודווה → טיוואט</p>
          </div>
          <div class="group-photo-wrap">
            <picture class="group-photo-picture">
              <source srcset="./assets/montenegro-group-photo.webp" type="image/webp">
              <img
                class="group-photo"
                src="./assets/montenegro-group-photo.jpg"
                alt=""
                width="2528"
                height="1684"
                decoding="async"
                fetchpriority="high"
              >
            </picture>
          </div>
          <div class="section-pad">
            <h4 style="margin-bottom:var(--space-3)">ציר הטיול</h4>
            <div class="scroll-hint"><div class="trip-route">${routeHtml}</div></div>

            <h4 style="margin:var(--space-4) 0 var(--space-3)">מקרא סימונים</h4>
            <div class="legend">${legendHtml}</div>

            <h4 style="margin-bottom:var(--space-3)">הימים</h4>
            <div class="day-grid">${cardsHtml}</div>
          </div>
        </section>
      </main>`;
  }

  function stopMapButtonsHtml(s) {
    const mode = stopNavMode(s);
    if (mode === 'none') return '';
    if (mode === 'boat') {
      return `<a class="btn btn-secondary" href="${mapsQ(s.q)}" target="_top">פתח במפה</a>`;
    }
    if (mode === 'walking') {
      return `
        <a class="btn btn-secondary" href="${mapsQ(s.q)}" target="_top">פתח במפה</a>
        <a class="btn btn-secondary" href="${mapsNav(s.q, 'walking')}" target="_top">מסלול הליכה</a>`;
    }
    return `
      <a class="btn btn-secondary" href="${mapsQ(s.q)}" target="_top">פתח במפה</a>
      <a class="btn btn-secondary" href="${mapsNav(s.q, 'driving')}" target="_top">נווט</a>`;
  }

  function stopRowHtml(s, idx, total, day, editing) {
    const isDone = !!state.completed[s.id];
    const isAltOpen = !!state.altOpen[s.id];
    const ov = getDayOverride(day);
    const note = ov.stopNotes[s.id] || '';
    const isCustom = s.id.indexOf('custom-') === 0;

    const timeHtml = editing
      ? `<input type="text" class="edit-input edit-input-time" data-field="stopTime" data-day="${day}" data-id="${esc(s.id)}" value="${esc(s.time || '')}" placeholder="שעה" aria-label="שעה עבור ${esc(s.name)}">`
      : (s.time ? `<div class="timeline-time">${esc(s.time)}</div>` : '');

    const nameHtml = editing
      ? `<input type="text" class="edit-input edit-input-name" data-field="stopName" data-day="${day}" data-id="${esc(s.id)}" value="${esc(s.name)}" aria-label="שם התחנה">`
      : `<h4>${esc(s.name)}</h4>`;

    const descHtml = editing
      ? `<textarea class="edit-input edit-textarea" data-field="stopDesc" data-day="${day}" data-id="${esc(s.id)}" placeholder="תיאור" aria-label="תיאור התחנה">${esc(s.desc || '')}</textarea>`
      : (s.desc ? `<p class="timeline-desc">${esc(s.desc)}${!editing && s.checked ? checkedBadgeHtml(s.checked) : ''}</p>` : (s.checked ? `<p class="timeline-desc">${checkedBadgeHtml(s.checked)}</p>` : ''));

    const noteHtml = editing
      ? `<textarea class="edit-input edit-textarea note-input" data-field="stopNote" data-day="${day}" data-id="${esc(s.id)}" placeholder="הערה אישית שלך (נשמרת רק אצלך)" aria-label="הערה אישית">${esc(note)}</textarea>`
      : (note ? `<p class="timeline-personal-note">📝 ${esc(note)}</p>` : '');

    const distHtml = editing
      ? `<input type="text" class="edit-input edit-input-dist" data-field="stopDistNext" data-day="${day}" data-id="${esc(s.id)}" value="${esc(s.distNext || '')}" placeholder="מרחק/זמן לתחנה הבאה" aria-label="מרחק לתחנה הבאה">`
      : (s.distNext ? `<div class="timeline-distnext">← ${esc(s.distNext)} לתחנה הבאה</div>` : '');

    const reorderHtml = editing ? `
      <div class="reorder-controls">
        <button class="btn-icon" data-action="move-up" data-day="${day}" data-id="${esc(s.id)}" ${idx === 0 ? 'disabled' : ''} aria-label="הזז את ${esc(s.name)} למעלה" title="הזז למעלה">↑</button>
        <button class="btn-icon" data-action="move-down" data-day="${day}" data-id="${esc(s.id)}" ${idx === total - 1 ? 'disabled' : ''} aria-label="הזז את ${esc(s.name)} למטה" title="הזז למטה">↓</button>
        ${isCustom ? `<button class="btn-icon btn-icon-danger" data-action="delete-stop" data-day="${day}" data-id="${esc(s.id)}" aria-label="מחק את ${esc(s.name)}" title="מחק תחנה">🗑 מחק</button>` : ''}
      </div>` : '';

    const routeToggleHtml = (stopRouteable(s) && stopIsSkippable(s)) ? `
      <label class="route-toggle">
        <input type="checkbox" data-action="toggle-route" data-day="${day}" data-id="${esc(s.id)}" ${isStopRouteActive(day, s) ? 'checked' : ''}>
        לכלול במסלול
      </label>` : '';

    return `
      <div class="timeline-row" style="animation-delay:${idx * 0.05}s">
        <div class="timeline-marker">
          <div class="timeline-dot${isDone ? ' done' : ''}"></div>
          ${timeHtml}
        </div>
        <div class="timeline-content${isDone && !editing ? ' done-dim' : ''}">
          <div class="timeline-title-row">
            ${nameHtml}
            ${!editing ? tagsHtml(s.tags || []) : ''}
          </div>
          ${descHtml}
          ${isAltOpen && s.alt ? `<p class="timeline-alt">${esc(s.alt)}</p>` : ''}
          ${noteHtml}
          <div class="timeline-actions">
            ${stopMapButtonsHtml(s)}
            <button class="btn ${isDone ? 'btn-secondary' : 'btn-primary'}" data-action="toggle-done" data-id="${esc(s.id)}" aria-pressed="${isDone}">${isDone ? '✓ הושלם' : 'סמן כהושלם'}</button>
            ${s.alt ? `<button class="btn btn-ghost" data-action="toggle-alt" data-id="${esc(s.id)}" aria-expanded="${isAltOpen}">${isAltOpen ? 'הסתר חלופה' : 'הצג חלופה'}</button>` : ''}
          </div>
          ${routeToggleHtml}
          ${distHtml}
          ${reorderHtml}
        </div>
      </div>`;
  }

  function addStopFormHtml(day) {
    return `
      <div class="add-stop-form">
        <h4 style="margin-bottom:8px">הוסף תחנה חדשה</h4>
        <div class="add-stop-grid">
          <input type="text" id="add-name-${day}" placeholder="שם המקום *" aria-label="שם המקום">
          <input type="text" id="add-q-${day}" placeholder="מיקום לחיפוש במפות, למשל: Perast, Montenegro *" aria-label="מיקום לחיפוש במפות">
          <input type="text" id="add-time-${day}" placeholder="שעה (לא חובה)" aria-label="שעה">
          <select id="add-tag-${day}" aria-label="סוג התחנה">
            <option value="optional">אופציונלי</option>
            <option value="mandatory">חובה</option>
          </select>
        </div>
        <textarea id="add-desc-${day}" placeholder="תיאור (לא חובה)" aria-label="תיאור"></textarea>
        <button class="btn btn-primary" data-action="add-stop" data-day="${day}">+ הוסף תחנה</button>
      </div>`;
  }

  function planTimeFields(p) {
    const fields = [];
    if (p.estimatedDriving) fields.push(['נהיגה', p.estimatedDriving]);
    if (p.estimatedHotelArrival) fields.push(['הגעה למלון', p.estimatedHotelArrival]);
    if (p.estimatedTotalDay) fields.push(['יום שלם', p.estimatedTotalDay]);
    if (p.estimatedDayEnd) fields.push(['סוף יום', p.estimatedDayEnd]);
    if (p.estimatedReturn) fields.push(['חזרה', p.estimatedReturn]);
    return fields;
  }

  function planMetaLineHtml(p) {
    return planTimeFields(p).map(([label, val]) => `${label}: ${esc(val)}`).join(' · ');
  }

  function planCardCompactHtml(p, day) {
    return `
      <button class="plan-card plan-card-compact" type="button" role="radio" aria-checked="false" data-action="select-plan" data-day="${day}" data-plan="${esc(p.id)}">
        <div class="plan-card-top">
          <h4>${esc(p.name)}</h4>
          ${p.recommended ? '<span class="tag plan-card-badge">מומלץ</span>' : ''}
        </div>
        <div class="plan-card-meta">${planMetaLineHtml(p)} · <span class="diff-dots">${diffDotsHtml(p.difficulty)}</span></div>
        ${p.chooseWhen ? `<p class="plan-card-oneline">לבחור כש${esc(p.chooseWhen)}</p>` : ''}
      </button>`;
  }

  function planCardExpandedHtml(p, day) {
    return `
      <button class="plan-card plan-card-selected" type="button" role="radio" aria-checked="true" data-action="select-plan" data-day="${day}" data-plan="${esc(p.id)}">
        <div class="plan-card-top">
          <h4>${esc(p.name)}</h4>
          ${p.recommended ? '<span class="tag plan-card-badge">מומלץ</span>' : ''}
        </div>
        <div class="plan-card-meta">${planMetaLineHtml(p)} · <span class="diff-dots">${diffDotsHtml(p.difficulty)}</span></div>
        ${p.summary ? `<p class="plan-card-oneline">${esc(p.summary)}</p>` : ''}
        ${p.chooseWhen ? `<p class="plan-card-choose">לבחור כש${esc(p.chooseWhen)}</p>` : ''}
        ${p.changes && p.changes.length ? `<ul class="plan-card-changes">${p.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${p.notIncluded ? `<p class="plan-card-avoid">לא כולל: ${esc(p.notIncluded)}</p>` : ''}
        ${p.avoidWhen ? `<p class="plan-card-avoid">פחות מתאים אם: ${esc(p.avoidWhen)}</p>` : ''}
      </button>`;
  }

  function planPickerHtml(d, day, plan) {
    if (d.plans.length <= 1) return '';
    const items = d.plans.map(p => p.id === plan.id ? planCardExpandedHtml(p, day) : planCardCompactHtml(p, day)).join('');
    return `
      <div class="plan-picker">
        <div class="plan-picker-head">
          <h4>בחרו את מסלול היום</h4>
          <span class="plan-picker-count">${d.plans.length} אפשרויות</span>
          <button class="btn btn-ghost" data-action="toggle-compare" aria-expanded="${state.compareOpen}">השוואה</button>
        </div>
        <div class="plan-cards" role="radiogroup" aria-label="בחרו את מסלול היום">${items}</div>
        ${state.compareOpen ? compareTableHtml(d) : ''}
      </div>`;
  }

  function compareTableHtml(d) {
    const rows = [
      ['נהיגה', p => p.estimatedDriving || '-'],
      ['הגעה למלון', p => p.estimatedHotelArrival || '-'],
      ['חזרה', p => p.estimatedDayEnd || p.estimatedReturn || '-'],
      ['מאמץ', p => '●'.repeat(p.difficulty) + '○'.repeat(3 - p.difficulty)],
      ['מתאים כש', p => p.chooseWhen || '-'],
      ['מוותרים על', p => p.notIncluded || '-']
    ];
    const head = d.plans.map(p => `<th scope="col">${esc(p.name)}</th>`).join('');
    const body = rows.map(([label, fn]) => `<tr><th scope="row">${esc(label)}</th>${d.plans.map(p => `<td>${esc(fn(p))}</td>`).join('')}</tr>`).join('');
    return `<div class="scroll-hint"><div class="compare-wrap"><table class="compare-table"><caption>השוואת מסלולי היום</caption><thead><tr><th scope="col"></th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  }

  function renderDay(activeDay) {
    const d = DAYS[activeDay - 1];
    const plan = getPlan(activeDay);
    const editing = state.editMode;
    const stops = effectiveStops(activeDay);
    const { done, total, pct } = dayProgress(stops);
    const ov = getDayOverride(activeDay);

    const photosHtml = (plan.photos || []).map(ph => photoHtml(ph, plan.photos.length)).join('');

    const stopsHtml = stops.map((s, idx) => stopRowHtml(s, idx, stops.length, activeDay, editing)).join('');

    const dayNoteHtml = editing
      ? `<textarea class="edit-input edit-textarea day-note-input" data-field="dayNote" data-day="${activeDay}" placeholder="הערה כללית ליום (נשמרת רק אצלך)" aria-label="הערה כללית ליום">${esc(ov.dayNote)}</textarea>`
      : (ov.dayNote ? `<div class="day-note-box">📝 ${esc(ov.dayNote)}</div>` : '');

    const isFirstDay = activeDay <= 1;
    const isLastDay = activeDay >= DAYS.length;

    const dayWarningHtml = d.dayWarning ? `<div class="day-warning-box">⚠ ${esc(d.dayWarning)}</div>` : '';
    const planWarningHtml = plan.warning ? `<div class="day-warning-box plan-warning-box">⚠ ${esc(plan.warning)}</div>` : '';

    const routeQs = routeQueries(activeDay);
    const routeSegments = routeQs.length >= 2 ? buildRouteSegments(routeQs) : [];
    const mapCtaHtml = routeSegments.map((seg, idx) => {
      const title = routeSegments.length > 1 ? `מסלול נהיגה — חלק ${idx + 1} מתוך ${routeSegments.length}` : 'תחנות הנהיגה שבחרתם';
      return `
      <a class="map-cta" href="${mapsDayRoute(seg)}" target="_top">
        <span class="map-cta-icon">${ROUTE_ICON}</span>
        <span class="map-cta-text">
          <span class="map-cta-title">${esc(title)}</span>
          <span class="map-cta-sub">${seg.length} תחנות, מוכן לניווט</span>
        </span>
      </a>`;
    }).join('');

    return `
      ${tabsHtml()}
      <main>
        <section>
          <div class="day-poster">
            <div class="day-poster-num">${String(activeDay).padStart(2, '0')}</div>
            <div class="day-poster-icon">${ICONS[d.icon] || ''}</div>
            <div class="day-poster-text">
              <h2>${esc(d.top)} · ${esc(d.sub)}</h2>
              <div class="day-poster-sub">${esc(plan.title)}</div>
              <span class="tag day-poster-badge">${esc(plan.badge)}</span>
            </div>
          </div>

          <div class="section-pad">
            <div class="difficulty-row">
              <div class="difficulty-row-left">
                <span class="difficulty-row-label">רמת קושי</span>
                <div class="diff-dots">${diffDotsHtml(plan.difficulty)}</div>
              </div>
              <div class="edit-controls">
                ${editing ? `<button class="btn btn-ghost" data-action="reset-day" data-day="${activeDay}">אפס עריכות ליום זה</button>` : ''}
                <button class="btn ${editing ? 'btn-primary' : 'btn-ghost'}" data-action="toggle-edit" aria-pressed="${editing}">${editing ? 'סיום עריכה' : '✎ עריכה'}</button>
              </div>
            </div>

            <div class="progress-row">
              <span>התקדמות היום</span><span>${done} מתוך ${total} הושלמו</span>
            </div>
            <div class="progress-track day-detail" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress-fill" style="width:${pct}%"></div></div>

            ${dayWarningHtml}
            ${planPickerHtml(d, activeDay, plan)}
            ${planWarningHtml}

            ${dayNoteHtml}

            <div class="photo-grid">${photosHtml}</div>

            ${mapCtaHtml}

            <div class="timeline">${stopsHtml}</div>

            ${editing ? addStopFormHtml(activeDay) : ''}

            <div class="day-footer-nav">
              <button class="btn btn-secondary" data-action="prev" ${isFirstDay ? 'disabled' : ''}>← יום קודם</button>
              <button class="btn btn-primary" data-action="next" ${isLastDay ? 'disabled' : ''}>יום הבא →</button>
            </div>
          </div>
        </section>
      </main>`;
  }

  function renderInfo() {
    const sourcesHtml = INFO_SOURCES.map(s => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('');
    const fieldNotesHtml = FIELD_NOTES.map(n => `<li>${esc(n)}</li>`).join('');
    const fieldSourcesHtml = FIELD_SOURCES.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a></li>`).join('');
    return `
      ${tabsHtml()}
      <main>
        <section>
          <div class="section-pad info-view">
            <h2>מידע וגיבוי</h2>
            <p class="offline-note">${esc(OFFLINE_NOTE)}</p>

            <h4>מקורות רשמיים</h4>
            <ul class="sources-list">${sourcesHtml}</ul>

            <h4>טיפים מהשטח</h4>
            <ul class="sources-list">${fieldNotesHtml}</ul>

            <h4>מקורות לחוויות שטח</h4>
            <p class="backup-disclaimer">המקורות האלה משמשים לטיפים מעשיים בלבד. שעות, מחירים ותנאי הפעלה נבדקים במקורות הרשמיים.</p>
            <ul class="sources-list">${fieldSourcesHtml}</ul>

            <h4>גיבוי ושיתוף</h4>
            <p class="backup-disclaimer">המידע נשמר במכשיר ובדפדפן הנוכחיים בלבד. השתמשו בגיבוי כדי להעביר אותו למכשיר אחר.</p>
            <div class="backup-actions">
              <button class="btn btn-primary" data-action="export-json">ייצוא לקובץ גיבוי</button>
              <label class="btn btn-secondary backup-import-label" for="import-file-input">ייבוא קובץ גיבוי
                <input type="file" id="import-file-input" accept="application/json" class="visually-hidden">
              </label>
              <button class="btn btn-secondary" data-action="copy-plans">העתקת הבחירות שלי</button>
              <button class="btn btn-ghost" data-action="reset-completed">איפוס סימוני השלמה</button>
              <button class="btn btn-ghost" data-action="reset-all-overrides">איפוס כל העריכות</button>
            </div>
            <div id="backup-status" class="backup-status" aria-live="polite"></div>
          </div>
        </section>
      </main>`;
  }

  function tabsHtml() {
    const tabs = [{ index: 0, top: 'בית', sub: '' }, ...DAYS.map((d, i) => ({ index: i + 1, top: d.top, sub: d.sub }))];
    const items = tabs.map(t => `
      <button class="${t.index === state.activeDay ? 'active' : ''}" data-action="select" data-day="${t.index}" ${t.index === state.activeDay ? 'aria-current="true"' : ''}>
        <span class="tab-top">${esc(t.top)}</span>
        <span class="tab-sub">${esc(t.sub)}</span>
      </button>`).join('');
    return `<div class="scroll-hint"><nav class="day-tabs">${items}</nav></div>`;
  }

  function exportJson() {
    const data = { schemaVersion: SCHEMA_VERSION, selectedPlans: state.selectedPlans, completed: state.completed, overrides: state.overrides, fontSize: state.fontSize };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'montenegro-2026-backup.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function hasExistingData() {
    return Object.keys(state.completed).length > 0 || Object.keys(state.overrides).length > 0 || Object.keys(state.selectedPlans).length > 0;
  }

  function importJsonData(data, skipConfirm) {
    if (!data || typeof data !== 'object' || !Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
      showBackupStatus('קובץ גיבוי לא תקין (חסרה גרסת נתונים).');
      return false;
    }
    if (data.schemaVersion > SCHEMA_VERSION) {
      showBackupStatus('הקובץ נוצר בגרסה חדשה יותר של האתר — לא ניתן לייבא.');
      return false;
    }
    if (!skipConfirm && hasExistingData() && !confirm('לדרוס את המידע השמור כרגע במכשיר הזה בנתונים מהקובץ?')) {
      return false;
    }
    // Fully sanitize before touching state, so a malformed file never causes a partial write.
    const overrides = sanitizeOverrides(migrateOverrides(data.overrides));
    const selectedPlans = sanitizeSelectedPlans(data.selectedPlans);
    const completed = sanitizeCompleted(data.completed, overrides);
    const fontSize = sanitizeFontSize(data.fontSize, state.fontSize);
    state.overrides = overrides;
    state.selectedPlans = selectedPlans;
    state.completed = completed;
    state.fontSize = fontSize;
    saveSelectedPlans(); saveCompleted(); saveOverrides(); saveFontSize();
    applyFontSize();
    render();
    return true;
  }

  function copyPlansToClipboard() {
    const lines = DAYS.map((d, i) => {
      const day = i + 1;
      const plan = getPlan(day);
      return `${d.top} (${d.sub}): ${plan.name}`;
    });
    const text = 'הבחירות שלי לטיול מונטנגרו 2026:\n' + lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showBackupStatus('הועתק ללוח.')).catch(() => showBackupStatus('ההעתקה נכשלה.'));
    } else {
      showBackupStatus('ההעתקה אינה נתמכת בדפדפן זה.');
    }
  }

  function showBackupStatus(msg) {
    const el = document.getElementById('backup-status');
    if (el) el.textContent = msg;
  }

  function applyFontSize() {
    document.documentElement.classList.toggle('fs-large', state.fontSize === 'large');
  }
  applyFontSize();

  function render() {
    const app = document.getElementById('app');
    const body = state.activeDay === 'info' ? renderInfo() : (state.activeDay === 0 ? renderHome() : renderDay(state.activeDay));
    app.innerHTML = `
      <header class="nav">
        <div class="nav-brand">מונטנגרו 2026</div>
        <div class="nav-actions">
          <span class="offline-indicator${state.online ? '' : ' is-offline'}">${state.online ? '● מחובר' : '● אופליין'}</span>
          <button class="btn btn-ghost btn-fontsize" data-action="toggle-fontsize" aria-label="שנה גודל טקסט">${state.fontSize === 'large' ? 'א-' : 'א+'}</button>
          <button class="btn btn-ghost" data-action="select-info" aria-label="מידע וגיבוי">מידע</button>
        </div>
      </header>
      ${body}
      <footer class="site-footer">מונטנגרו 2026 · מסלול נסיעה</footer>`;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    flushPendingEdit();
    const action = el.getAttribute('data-action');
    if (action === 'select') { selectDay(Number(el.getAttribute('data-day'))); return; }
    if (action === 'select-info') { selectInfo(); return; }
    if (action === 'prev') { goPrev(); return; }
    if (action === 'next') { goNext(); return; }
    if (action === 'toggle-done') { toggleDone(el.getAttribute('data-id')); return; }
    if (action === 'toggle-alt') { toggleAlt(el.getAttribute('data-id')); return; }
    if (action === 'toggle-edit') { state.editMode = !state.editMode; render(); return; }
    if (action === 'toggle-fontsize') { state.fontSize = state.fontSize === 'large' ? 'normal' : 'large'; saveFontSize(); applyFontSize(); render(); return; }
    if (action === 'select-plan') { selectPlan(Number(el.getAttribute('data-day')), el.getAttribute('data-plan')); return; }
    if (action === 'toggle-compare') { state.compareOpen = !state.compareOpen; render(); return; }
    if (action === 'move-up') { moveStop(Number(el.getAttribute('data-day')), el.getAttribute('data-id'), -1); return; }
    if (action === 'move-down') { moveStop(Number(el.getAttribute('data-day')), el.getAttribute('data-id'), 1); return; }
    if (action === 'delete-stop') {
      if (confirm('למחוק את התחנה הזו?')) deleteCustomStop(Number(el.getAttribute('data-day')), el.getAttribute('data-id'));
      return;
    }
    if (action === 'reset-day') {
      if (confirm('לאפס את כל העריכות, ההערות והתחנות שהוספת ליום זה (עבור המסלול הנבחר)?')) resetDayOverrides(Number(el.getAttribute('data-day')));
      return;
    }
    if (action === 'add-stop') {
      const day = Number(el.getAttribute('data-day'));
      const name = (document.getElementById(`add-name-${day}`) || {}).value || '';
      const q = (document.getElementById(`add-q-${day}`) || {}).value || '';
      const time = (document.getElementById(`add-time-${day}`) || {}).value || '';
      const desc = (document.getElementById(`add-desc-${day}`) || {}).value || '';
      const tag = (document.getElementById(`add-tag-${day}`) || {}).value || 'optional';
      if (!name.trim() || !q.trim()) { alert('צריך למלא שם מקום ומיקום לחיפוש במפות.'); return; }
      addStop(day, { name: name.trim(), q: q.trim(), time: time.trim(), desc: desc.trim(), tag });
      return;
    }
    if (action === 'export-json') { exportJson(); return; }
    if (action === 'copy-plans') { copyPlansToClipboard(); return; }
    if (action === 'reset-completed') {
      if (confirm('לאפס את כל סימוני ההשלמה בכל הימים?')) { state.completed = {}; saveCompleted(); render(); }
      return;
    }
    if (action === 'reset-all-overrides') {
      if (confirm('לאפס את כל העריכות, ההערות והתחנות שהוספת בכל הימים ובכל המסלולים?')) {
        const orphanIds = [];
        Object.keys(state.overrides).forEach(day => {
          Object.keys(state.overrides[day]).forEach(planId => {
            (state.overrides[day][planId].customStops || []).forEach(s => orphanIds.push(s.id));
          });
        });
        if (orphanIds.length) {
          orphanIds.forEach(id => { delete state.completed[id]; delete state.altOpen[id]; });
          saveCompleted();
        }
        state.overrides = {};
        saveOverrides();
        render();
      }
      return;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="toggle-route"]');
    if (el) { toggleRouteStop(Number(el.getAttribute('data-day')), el.getAttribute('data-id')); return; }
    if (e.target && e.target.id === 'import-file-input') {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch (err) { showBackupStatus('קובץ לא תקין.'); return; }
        if (importJsonData(data)) showBackupStatus('הייבוא הושלם בהצלחה.');
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  });

  document.addEventListener('focusout', (e) => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    const field = el.getAttribute('data-field');
    const day = Number(el.getAttribute('data-day'));
    const id = el.getAttribute('data-id');
    commitField(day, field, id, el.value);
  });

  window.addEventListener('online', () => { state.online = true; render(); });
  window.addEventListener('offline', () => { state.online = false; render(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // ---- initial route: deep link takes priority, else auto-open today if in trip range ----
  (function initRoute() {
    const parsed = parseHash();
    if (parsed.day === 'info') {
      state.activeDay = 'info';
    } else if (parsed.day != null && !isNaN(parsed.day) && parsed.day >= 0 && parsed.day <= DAYS.length) {
      state.activeDay = parsed.day;
      if (parsed.plan && parsed.day >= 1 && DAYS[parsed.day - 1].plans.some(p => p.id === parsed.plan)) {
        state.selectedPlans[parsed.day] = parsed.plan;
      }
    } else {
      autoOpenTodayIfInRange();
    }
  })();

  render();
})();
