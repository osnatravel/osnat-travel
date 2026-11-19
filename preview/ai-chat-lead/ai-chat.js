/* OSNAT TRAVEL – AI trip-planning chat widget (LEAD version: guided questions + summary card -> WhatsApp / email)
 * Embed:  <link rel="stylesheet" href=".../ai-chat.css"><script src=".../ai-chat.js" defer
 *           data-packages="/assets/vn/ai-packages.json" data-endpoint=""></script>
 * Or set window.OSNAT_AI_CHAT = {endpoint:'https://…workers.dev/chat', packagesUrl:'…'} before the script.
 *
 * Two engines:
 *   1) endpoint set  -> POST {messages:[{role,content}], state, page} -> {reply, suggestions?, packages?:[slug], handoff?}
 *      (see /workspace/site-redesign/ai-chat-worker). Package cards are ALWAYS rendered from packages.json,
 *      so prices shown come from the site, never from the model.
 *   2) no endpoint (demo mode) -> local scripted/keyword engine below (LocalEngine). Also used as fallback if the backend fails.
 * Prices: only from ai-packages.json (built from https://osnat-travel.com/packages/). Packages whose data-depart
 * is today or earlier (Asia/Jerusalem) are never suggested. ?asof=YYYY-MM-DD overrides "today" for testing.
 */
(function(){
'use strict';
var SCRIPT=document.currentScript||{getAttribute:function(){return null}};
var CFG=Object.assign({
  endpoint:SCRIPT.getAttribute('data-endpoint')||'',
  packagesUrl:SCRIPT.getAttribute('data-packages')||'/assets/vn/ai-packages.json',
  wa:'972506413749',
  email:'travel.osnat@gmail.com',
  autoOpen:SCRIPT.getAttribute('data-autoopen')==='1',
  storageKey:'osnat-ai-chat-lead-v1'
},window.OSNAT_AI_CHAT||{});

/* ---------- agency facts (fixed, the only FAQ source) ---------- */
var FACTS={
  payments:'אפשר לפרוס את התשלום: מלונות עד 9 תשלומים וטיסות עד 6 תשלומים, ללא ריבית.',
  fees:'אין אצלנו דמי תכנון. בונים איתכם את החופשה בלי תוספת על התכנון.',
  support:'במהלך הנסיעה אנחנו זמינים לכם בוואטסאפ 24/7.',
  cancel:'שינויים וביטולים הם לפי התנאים של כל ספק (חברת התעופה, המלון וכו׳).'
};

/* ---------- helpers ---------- */
function today(){var m=(location.search||'').match(/[?&]asof=(\d{4}-\d{2}-\d{2})/);if(m)return m[1];
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date(Date.now()+2*36e5).toISOString().slice(0,10)}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function norm(s){return String(s||'').replace(/[\u0591-\u05C7]/g,'').replace(/[״"]/g,'"').replace(/[׳']/g,"'").trim()}
var HEB='\u05D0-\u05EA';
function word(t,w){return new RegExp('(^|[^'+HEB+'])[ובלהמש]{0,2}('+w+')($|[^'+HEB+'])').test(t)}
function has(t,re){return re.test(t)}
function fmt(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',')+' ₪'}
var MONTHS={'ינואר':1,'פברואר':2,'מרץ':3,'מרס':3,'אפריל':4,'מאי':5,'יוני':6,'יולי':7,'אוגוסט':8,'ספטמבר':9,'אוקטובר':10,'נובמבר':11,'דצמבר':12};
var MONTH_NAME=['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
var NUMW={'אחד':1,'אחת':1,'שני':2,'שתי':2,'שניים':2,'שתיים':2,'שלוש':3,'שלושה':3,'ארבע':4,'ארבעה':4,'חמש':5,'חמישה':5};

/* ---------- packages ---------- */
var PK=[],PK_CHECKED='',pkReady=fetch(CFG.packagesUrl,{cache:'no-cache'}).then(function(r){return r.json()}).then(function(d){
  var t=today();PK_CHECKED=d.checked||'';PK=(d.packages||[]).filter(function(p){return p.depart&&p.depart>t&&p.price})}).catch(function(){PK=[]});
function pkBy(slug){for(var i=0;i<PK.length;i++)if(PK[i].slug===slug)return PK[i]}
function pkMonth(p){return +p.depart.slice(5,7)}

/* =====================================================================
   LocalEngine – scripted, keyword-based stand-in for the real AI.
   Slots: who, kids, when, vibe, budget, prefs. One question at a time;
   free text may fill several slots at once; FAQ can be asked at any point.
   ===================================================================== */
var STEPS=['dest','who','kids','when','vibe','budget','prefs','name','phone'];
var Q={
  dest:{q:'לאן תרצו לטוס? אפשר לכתוב יעד, או "עוד לא יודעים".',chips:['גאורגיה','בודפשט','אבו דאבי','באקו','עוד לא יודעים']},
  who:{q:'מי יוצא לחופשה?',chips:['זוג','משפחה עם ילדים','חברים','לבד','ירח דבש']},
  kids:{q:'כיף! כמה ילדים מצטרפים ובאילו גילאים? (למשל: 2 ילדים, בני 5 ו־9)',chips:['ילד אחד','2 ילדים','3 ילדים ומעלה','יש תינוק/ת']},
  when:{q:'מתי בא לכם לטוס?',chips:['דצמבר','חנוכה','ינואר','גמיש']},
  vibe:{q:'איזו חופשה אתם מדמיינים?',chips:['ים ושמש','עיר, אוכל ושופינג','טבע ונופים','תפתיעו אותי']},
  budget:{q:'מה התקציב בערך, לאדם?',chips:['עד 2,000 ₪','2,000–3,000 ₪','מעל 3,000 ₪','גמיש']},
  prefs:{q:'איזה סגנון ורמת מלון, ויש בקשות מיוחדות? (למשל טיסה ישירה מתל אביב, מזוודה, חדר משפחה)',chips:['מלון 5 כוכבים','מזוודה כלולה','טיסה ישירה','אין העדפה']},
  name:{q:'כמעט סיימנו. איך קוראים לך?',chips:[]},
  phone:{q:'ומה מספר הטלפון שלך, כדי שאסנת תוכל לחזור אליך?',chips:[]}
};
function newState(){return{step:'dest',dest:'',name:'',phone:'',who:'',honeymoon:false,adults:0,kids:null,kidAges:[],baby:false,month:0,holiday:'',flex:false,vibe:[],surprise:false,budgetMax:0,budgetMin:0,budgetFlex:false,budgetText:'',prefs:[],notes:[],done:false,asked:{}}}

function parseNum(t){ // first money-ish numbers
  var out=[];t.replace(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(אלף|k|K)?/g,function(m,n,k){var v=parseFloat(n.replace(/,/g,''));if(k)v*=1000;out.push(v)});return out}

function understand(S,raw){
  var t=norm(raw),got=[],faq=[];
  if(S.step==='name'&&!S.name){var nm=raw.replace(/^(קוראים לי|שמי|אני)\s*/,'').trim();if(/[א-תa-zA-Z]{2}/.test(nm)&&nm.length<40&&!/\d{5}/.test(nm)){S.name=nm;return{got:['name'],faq:[]}}}
  var ph=raw.replace(/[\s\-()]/g,'').match(/(\+?972|0)5\d{8}|(\+?972|0)[2-9]\d{7}/);
  if(ph&&(S.step==='phone'||S.step==='name'||S.done)){S.phone=ph[0];got.push('phone')}
  else if(S.step==='phone'&&/\d{6,}/.test(raw.replace(/\D/g,''))){S.phoneBad=true}
  var DEST=['גאורגיה','טביליסי','באטומי','בטומי','בודפשט','הונגריה','אבו דאבי','דובאי','באקו','אזרבייג׳ן','אזרבייג\'ן','קפריסין','לימסול','רומניה','בוקרשט','פראג','יוון','אתונה','תאילנד','איטליה','רומא','פריז','לונדון','ברצלונה','מלדיביים','סיישל','וייטנאם','יפן','ניו יורק'];
  for(var di=0;di<DEST.length;di++){if(t.indexOf(norm(DEST[di]))>-1){S.dest=DEST[di];got.push('dest');break}}

  // FAQ intents
  if(has(t,/תשלומ|ריבית|פריסה|קרדיט|לפרוס/))faq.push('payments');
  if(has(t,/דמי (טיפול|תכנון)|עמלה|עמלות|דמי שירות|כמה עולה התכנון|תכנון בתשלום/))faq.push('fees');
  if(has(t,/לבטל|ביטול|שינוי|לשנות|החזר/))faq.push('cancel');
  if(has(t,/תמיכה|זמינ|24\/7|באמצע הטיול|במהלך (הטיול|החופשה|הנסיעה)|אם יש בעיה/))faq.push('support');
  if(has(t,/ויזה|דרכון|ביטוח|כשר|נגיש|כלב|חיית/))faq.push('ask');
  if(has(t,/מחיר.*(ילד|משפח)|(ילד|ילדים).*(כמה עולה|מחיר)/))faq.push('kidsprice');
  if(has(t,/נציג|בן אדם|לדבר עם|אסנת|טלפון|ווטסאפ|וואטסאפ|whatsapp/i))faq.push('human');
  // who
  if(has(t,/ירח דבש|חתונה|מתחתנים|רומנטי/)){S.who=S.who||'couple';S.honeymoon=true;got.push('who')}
  if(has(t,/משפח|ילד|ילדה|ילדים|הילדים|תינוק|פעוט|נכד/)){S.who='family';got.push('who')}
  else if(has(t,/חברים|חברות|חבר'ה|קבוצה|הבנות|החבר/)){S.who='friends';got.push('who')}
  else if(has(t,/לבד|סולו|רק אני|יחיד/)){S.who='solo';got.push('who')}
  else if(has(t,/זוג|אשתי|בעלי|בת הזוג|בן הזוג|חברה שלי|החבר שלי|שנינו|אני ו/)){S.who=S.who==='family'?'family':'couple';got.push('who')}
  // kids
  if(S.who==='family'){
    var cm=t.match(/(\d+|[א-ת]+)\s*(ילדים|ילד|ילדות|ילדה)/);
    if(cm){var c=/\d/.test(cm[1])?+cm[1]:(NUMW[cm[1]]||null);if(c){S.kids=c;got.push('kids')}}
    if(has(t,/ילד אחד|ילדה אחת/)){S.kids=1;got.push('kids')}
    if(has(t,/ומעלה/)&&S.kids)S.kids=S.kids+'+';
    if(has(t,/תינוק|תינוקת|פעוט/)){S.baby=true;got.push('kids')}
    var am=t.match(/(?:בני|בנות|בגיל|בגילאי|גילאי|גילאים|גיל)\s*([\d\s,ו\-–]+)/);
    var ages=am?(am[1].match(/\d+/g)||[]):(S.step==='kids'&&!cm?(t.match(/\d+/g)||[]):[]);
    ages=ages.map(Number).filter(function(a){return a<18});
    if(ages.length){S.kidAges=ages;if(!S.kids)S.kids=ages.length;got.push('kids')}
  }
  var ad=t.match(/(\d+)\s*מבוגרים/);if(ad)S.adults=+ad[1];
  // when
  for(var m in MONTHS){if(word(t,m)){S.month=MONTHS[m];S.holiday='';S.flex=false;got.push('when');break}}
  if(has(t,/חנוכה/)){S.holiday='hanukkah';S.month=S.month||12;got.push('when')}
  if(has(t,/גמיש|לא משנה מתי|מתי ש|כל תאריך|אין תאריך|לא יודע מתי/)&&(S.step==='when'||!S.month)){S.flex=true;got.push('when')}
  if(has(t,/בחודש הבא/)){var n=+today().slice(5,7)%12+1;S.month=n;got.push('when')}
  // vibe
  var v=[];
  if(word(t,'ים|חם|חמים')||has(t,/חוף|בטן גב|שמש|בריכה|שיזוף/))v.push('sea');
  if(word(t,'עיר|עירוני|עירונית')||has(t,/שופינג|קניות|מסעד|אוכל|חיי לילה|מוזיאו|תרבות|סיטי/))v.push('city');
  if(has(t,/טבע|הרים|הר |נוף|נופים|טיולים|ירוק|שלג|מפלים/))v.push('nature');
  if(v.length){S.vibe=Array.from(new Set(S.vibe.concat(v)));got.push('vibe')}
  if(has(t,/תפתיע|הפתיע|לא בטוח|לא יודע|לא יודעת|השראה|כל דבר|מה שיש/)&&S.step==='vibe'){S.surprise=true;got.push('vibe')}
  // budget
  var nums=parseNum(t).filter(function(x){return x>=300});
  if(nums.length&&(S.step==='budget'||has(t,/₪|שקל|ש"ח|תקציב|עד |אלף/))){
    var pair=has(t,/לזוג|לשנינו/),fam=has(t,/למשפחה|לכולם|סה"כ|סך הכל/);
    var mx=Math.max.apply(null,nums),mn=nums.length>1?Math.min.apply(null,nums):0;
    if(has(t,/מעל|יותר מ|לפחות/)){S.budgetMin=mx;S.budgetMax=0}else{S.budgetMax=mx;S.budgetMin=mn}
    if(pair){S.budgetMax=S.budgetMax/2;S.budgetMin=S.budgetMin/2}
    S.budgetText=raw.trim();S.budgetFam=fam;got.push('budget')}
  else if(S.step==='budget'&&has(t,/גמיש|לא משנה|פינוק|לא מוגבל|אין/)){S.budgetFlex=true;S.budgetText='גמיש';got.push('budget')}
  else if(has(t,/זול|חסכונ|לא יקר|בתקציב נמוך/)){S.budgetMax=2000;S.budgetText='חסכוני';got.push('budget')}
  // prefs
  var p=[];
  if(has(t,/5 כוכבים|חמישה כוכבים|יוקר|פינוק|ספא|לוקסוס/))p.push('lux5');
  if(has(t,/מזוודה|כבודה|טרולי/))p.push('luggage');
  if(has(t,/קצר|סופ"ש|סופש|סוף שבוע|3 לילות|כמה ימים/))p.push('short');
  if(has(t,/שבוע|ארוך|7 לילות/))p.push('long');
  if(has(t,/ארוחת בוקר/))p.push('breakfast');
  if(has(t,/ישיר/))p.push('direct');
  if(p.length){S.prefs=Array.from(new Set(S.prefs.concat(p)));got.push('prefs')}
  if(S.step==='prefs'&&has(t,/אין|לא משנה|זהו|זה הכל|בלי|סבבה/)){S.prefsNone=true;got.push('prefs')}
  // keep free-text notes for the WhatsApp summary
  if(S.step==='dest'&&!S.dest){if(has(t,/לא יודע|לא יודעים|לא בטוח|פתוחים|תפתיע|כל מקום/)){S.dest='פתוחים להצעות';got.push('dest')}else if(!got.length&&!faq.length&&raw.trim().length>1&&raw.trim().length<40&&!has(t,/\d/)){S.dest=raw.trim();got.push('dest')}}
  if(raw.trim().length>14&&!got.length&&!faq.length)S.notes.push(raw.trim());
  return{got:got,faq:faq}
}
function filled(S,k){switch(k){
  case'dest':return!!S.dest;case'name':return!!S.name;case'phone':return!!S.phone;case'who':return!!S.who;case'kids':return S.who!=='family'||S.kids!=null||S.kidAges.length>0||S.baby||!!S.asked.kidsSkip;
  case'when':return!!S.month||S.flex;case'vibe':return S.vibe.length>0||S.surprise||(!!S.dest&&S.dest!=='פתוחים להצעות');
  case'budget':return!!(S.budgetMax||S.budgetMin||S.budgetFlex);case'prefs':return S.prefs.length>0||!!S.prefsNone}}
function nextStep(S){for(var i=0;i<STEPS.length;i++)if(!filled(S,STEPS[i]))return STEPS[i];return null}

function score(S,p){var s=0,why=[],b=p.bullets.join(' ');
  if(S.dest&&S.dest!=='פתוחים להצעות'&&S.dest!=='-'){var dn=norm(S.dest),pt=norm(p.title+' '+p.country);s+=(pt.indexOf(dn)>-1||dn.indexOf(norm(p.country))>-1)?8:-5}
  if(S.holiday&&p.holiday===S.holiday){s+=4;why.push('בחופשת חנוכה')}
  if(S.month){if(pkMonth(p)===S.month)s+=4;else s-=3}
  S.vibe.forEach(function(v){if(p.vibe.indexOf(v)>-1){s+=3}});
  if(S.budgetMax){if(p.pp<=S.budgetMax){s+=2}else s-=3}
  if(S.budgetMin&&p.pp>=S.budgetMin)s+=1;
  if(S.prefs.indexOf('lux5')>-1&&/⭐5/.test(b))s+=2;
  if(S.prefs.indexOf('luggage')>-1&&/מזוודה|טרולי/.test(b))s+=2;
  if(S.prefs.indexOf('short')>-1&&p.nights&&p.nights<=4)s+=1;
  if(S.prefs.indexOf('long')>-1&&p.nights&&p.nights>=6)s+=3;
  if(S.honeymoon&&/⭐5/.test(b))s+=1;
  return s}
function recommend(S){
  var list=PK.map(function(p){return{p:p,s:score(S,p)}}).sort(function(a,b){return b.s-a.s||(a.p.depart<b.p.depart?-1:1)});
  return list.slice(0,3).filter(function(x,i){return i<2||x.s>=list[0].s-3}).map(function(x){return x.p.slug})}

function summaryLines(S){var L=[];
  var who={couple:'זוג',family:'משפחה',friends:'חברים',solo:'לבד'}[S.who];
  if(who){var w=who+(S.honeymoon?' (ירח דבש)':'');
    if(S.who==='family'){var k=[];if(S.adults)k.push(S.adults+' מבוגרים');if(S.kids)k.push(S.kids+' ילדים');if(S.kidAges.length)k.push('גילאים: '+S.kidAges.join(', '));if(S.baby)k.push('כולל תינוק/ת');if(k.length)w+=' – '+k.join(', ')}
    L.push('מי נוסע: '+w)}
  if(S.month||S.flex)L.push('מתי: '+(S.holiday==='hanukkah'?'חנוכה':(S.month?MONTH_NAME[S.month]:''))+(S.flex&&!S.month?'גמיש':''));
  if(S.vibe.length||S.surprise)L.push('אופי החופשה: '+(S.vibe.map(function(v){return{sea:'ים ושמש',city:'עיר',nature:'טבע'}[v]}).join(', ')||'פתוחים להצעות'));
  if(S.budgetText||S.budgetMax||S.budgetMin)L.push('תקציב: '+(S.budgetText||(S.budgetMax?'עד '+fmt(S.budgetMax)+' לאדם':'מעל '+fmt(S.budgetMin)+' לאדם')));
  var pr=S.prefs.map(function(x){return{lux5:'מלון 5 כוכבים',luggage:'מזוודה כלולה',short:'חופשה קצרה',long:'שבוע שלם',breakfast:'ארוחת בוקר',direct:'טיסה ישירה'}[x]});
  if(pr.length)L.push('העדפות: '+pr.join(', '));
  if(S.notes.length)L.push('הערות: '+S.notes.slice(-3).join(' | '));
  return L}

var LEAD_FIELDS=[['destination','יעד'],['dates','תאריכים'],['travellers','מי נוסע'],['budget','תקציב'],['style','סגנון ורמת מלון'],['flights','טיסות'],['requests','בקשות מיוחדות'],['name','שם'],['phone','טלפון']];
function leadFromState(S){var L={},sl=summaryLines(S),get=function(p){for(var i=0;i<sl.length;i++)if(sl[i].indexOf(p)===0)return sl[i].slice(p.length).trim();return''};
  L.destination=S.dest&&S.dest!=='-'?S.dest:'';L.dates=get('מתי:');L.travellers=get('מי נוסע:');L.budget=get('תקציב:');
  L.style=[get('אופי החופשה:'),get('העדפות:')].filter(Boolean).join(' · ');L.flights=S.prefs.indexOf('direct')>-1?'טיסה ישירה מתל אביב':'';
  L.requests=S.notes.slice(-3).join(' | ');L.name=S.name&&S.name!=='-'?S.name:'';L.phone=S.phone&&S.phone!=='-'?S.phone:'';return L}
function leadText(L,picks){var out=['היי אסנת, הגעתי מהעוזר החכם באתר. זה סיכום החופשה שאני מחפש/ת:'];
  LEAD_FIELDS.forEach(function(f){var v=(L&&L[f[0]]||'').trim();if(v)out.push(f[1]+': '+v)});
  if(picks&&picks.length)out.push('חבילות מהאתר שהוצגו לי בצ׳אט: '+picks.join('; '));
  return out.join('\n')}
var LocalEngine={
  start:function(S){return{reply:'היי! אני העוזר החכם של OSNAT TRAVEL. ספרו לי איזו חופשה אתם רוצים, ואשאל כמה שאלות קצרות, אחת בכל פעם. בסוף תקבלו סיכום שאפשר לשלוח לאסנת בוואטסאפ או במייל.\n\n'+Q.dest.q,suggestions:Q.dest.chips}},
  reply:function(S,text){
    var r=understand(S,text),out=[],cards=null,handoff=false;
    r.faq.forEach(function(f){
      if(FACTS[f])out.push(FACTS[f]);
      else if(f==='kidsprice')out.push('המחירים באתר הם לאדם בהרכב זוגי. מחיר למשפחה עם ילדים מחושב אישית לפי הגילאים, ואסנת תשלח לכם אותו בוואטסאפ.');
      else if(f==='ask')out.push('על זה עדיף שאסנת תענה לכם אישית, כדי שהתשובה תהיה מדויקת לחבילה שלכם. אפשר לשאול אותה בוואטסאפ בכפתור למטה.');
      else if(f==='human'){out.push('בשמחה! הכפתור למטה פותח וואטסאפ עם אסנת, עם סיכום של מה שסיפרתם עד עכשיו.');handoff=true}
    });
    if(S.who==='family'&&r.got.indexOf('who')>-1&&!S.kids&&!S.kidAges.length)S.step='kids';
    var nx=nextStep(S);
    if(!r.got.length&&!r.faq.length){
      if(S.done){out.push('אפשר לשנות כל פרט (למשל "דווקא ינואר" או "תקציב עד 2,500") ואעדכן את ההמלצות, או להמשיך עם אסנת בוואטסאפ.');return{reply:out.join('\n\n'),suggestions:['להתחיל מחדש','לדבר עם אסנת'],handoff:true}}
      S.asked[S.step]=(S.asked[S.step]||0)+1;
      if(S.asked[S.step]>=2){ // don't loop: skip the slot
        if(S.step==='phone'&&S.phoneBad){S.phoneBad=false;out.push('המספר לא נראה לי תקין. אפשר לכתוב אותו שוב, למשל 050-1234567?');return{reply:out.join('\n\n'),suggestions:[]}}
        if(S.step==='dest')S.dest='פתוחים להצעות';else if(S.step==='name')S.name='-';else if(S.step==='phone')S.phone='-';else if(S.step==='who')S.who='any';else if(S.step==='kids')S.asked.kidsSkip=1;else if(S.step==='when')S.flex=true;else if(S.step==='vibe')S.surprise=true;else if(S.step==='budget')S.budgetFlex=true;else if(S.step==='prefs')S.prefsNone=true;
        nx=nextStep(S);out.push('רשמתי, נמשיך הלאה.')}
      else{out.push('לא בטוח שהבנתי. '+Q[S.step].q);return{reply:out.join('\n\n'),suggestions:Q[S.step].chips}}
    }
    if(r.got.indexOf('who')>-1&&S.honeymoon)out.push('מזל טוב! נחפש משהו מפנק.');
    if(S.month&&r.got.indexOf('when')>-1&&PK.length&&!PK.some(function(p){return pkMonth(p)===S.month}))
      out.push('ל'+MONTH_NAME[S.month]+' אין כרגע חבילה מוכנה באתר, אבל אסנת יכולה לבנות לכם הצעה אישית. בינתיים אראה את הכי קרובות.');
    if(nx){S.step=nx;if(r.got.length&&!r.faq.length&&out.length===0&&ack(nx))out.push(ack(nx));out.push(Q[nx].q);return{reply:out.join('\n\n'),suggestions:Q[nx].chips,handoff:handoff}}
    // all slots filled -> recommend
    S.step='done';var first=!S.done;S.done=true;
    if(!r.got.length&&r.faq.length)return{reply:out.join('\n\n'),suggestions:['לדבר עם אסנת','להתחיל מחדש'],handoff:true};
    cards=recommend(S);
    out.push(first?'מעולה, יש לי תמונה. אלה החבילות מהאתר שהכי מתאימות למה שסיפרתם:':'עדכנתי. אלה ההתאמות עכשיו:');
    var tail=[];
    if(S.who==='family')tail.push('המחירים בכרטיסים הם לאדם בהרכב זוגי. מחיר למשפחה'+(S.kidAges.length?' עם ילדים בגילאי '+S.kidAges.join(', '):'')+' אסנת תחשב אישית.');
    if(S.budgetMax&&cards.every(function(s){var p=pkBy(s);return p&&p.pp>S.budgetMax}))tail.push('שימו לב: אין כרגע חבילה באתר בתקציב הזה. אסנת יכולה לבנות משהו מותאם.');
    tail.push('וזה הסיכום של מה שסיפרתם. אפשר לשלוח אותו לאסנת בוואטסאפ או במייל:');
    return{reply:out.join('\n\n'),packages:cards,after:tail.join('\n\n'),suggestions:['כמה תשלומים אפשר?','להתחיל מחדש'],lead:leadFromState(S),ready:true}
  }
};
function ack(nx){return{kids:'',when:'מעולה.',vibe:'רשמתי.',budget:'יופי.',prefs:'רשמתי.'}[nx]}

/* =====================================================================
   RemoteEngine – real AI backend (Cloudflare Worker -> OpenAI gpt-4o-mini).
   ===================================================================== */
function remoteReply(history,S){
  return fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:history,page:location.pathname,summary:summaryLines(S),lead:D.lead||null})})
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(function(d){return{reply:String(d.reply||''),suggestions:(d.suggestions||[]).slice(0,5),
    packages:(d.packages||[]).filter(function(s){return!!pkBy(s)}).slice(0,3),handoff:!!d.handoff||(d.packages||[]).length>0,
    summary:Array.isArray(d.summary)?d.summary:null,lead:(d.lead&&typeof d.lead==='object')?d.lead:null,ready:!!d.ready}})
}

/* ---------- UI ---------- */
var store={load:function(){try{return JSON.parse(sessionStorage.getItem(CFG.storageKey)||'null')}catch(e){return null}},
  save:function(d){try{sessionStorage.setItem(CFG.storageKey,JSON.stringify(d))}catch(e){}}};
var D=store.load()||{S:newState(),log:[],history:[],aiSummary:null};
var root,panel,body,input,chipsEl,waBtn,open=false,busy=false;

function curLead(){var a=leadFromState(D.S),b=D.lead||{},o={};LEAD_FIELDS.forEach(function(f){var v=String(b[f[0]]||'').trim();o[f[0]]=v||a[f[0]]||''});return o}
function picks(){var p=[];D.log.forEach(function(m){(m.packages||[]).forEach(function(s){var k=pkBy(s);if(k&&p.indexOf(k.title+' ('+k.dates+')')<0)p.push(k.title+' ('+k.dates+')')})});return p.slice(-3)}
function msgText(){return leadText(curLead(),picks())}
function waLink(){return'https://wa.me/'+CFG.wa+'?text='+encodeURIComponent(msgText())}
function mailLink(){var L=curLead();return'mailto:'+CFG.email+'?subject='+encodeURIComponent('פנייה מהעוזר החכם באתר'+(L.name?' – '+L.name:'')+(L.destination?' – '+L.destination:''))+'&body='+encodeURIComponent(msgText())}
function summaryCard(){var L=curLead();
  return'<div class="oac-sum"><span class="oac-eyebrow">TRIP SUMMARY</span><b class="oac-sum-t">סיכום <span class="grad">החופשה</span></b><dl>'+
   LEAD_FIELDS.map(function(f){var v=L[f[0]];return v?'<div><dt>'+esc(f[1])+'</dt><dd>'+esc(v)+'</dd></div>':''}).join('')+'</dl>'+
   (picks().length?'<p class="oac-sum-pk">חבילות מהאתר שהוצגו בצ׳אט: '+esc(picks().join('; '))+'</p>':'')+
   '<div class="oac-sum-act"><a class="oac-sum-wa" href="'+esc(waLink())+'" target="_blank" rel="noopener">שליחה לאסנת בוואטסאפ</a>'+
   '<a class="oac-sum-mail" href="'+esc(mailLink())+'">שליחה במייל</a>'+
   '<button type="button" class="oac-sum-copy">העתקת הסיכום</button></div>'+
   '<p class="oac-sum-note">הסיכום נשלח מהוואטסאפ או מהמייל שלכם. רוצים לתקן משהו? כתבו לי כאן ואעדכן את הסיכום.</p></div>'}

function card(p){return'<a class="oac-card" href="'+esc(p.url)+'" target="_top">'+
  '<span class="oac-card-img"><img src="'+esc(p.img)+'" alt="'+esc(p.title)+'" loading="lazy"><span class="oac-card-date"><bdi>'+esc(p.dates)+'</bdi>'+(p.nights?' · '+p.nights+' לילות':'')+'</span></span>'+
  '<span class="oac-card-b"><b class="oac-card-t">'+esc(p.title)+'</b>'+
  '<span class="oac-card-p"><b>'+esc(p.price)+'</b> '+esc(p.priceNote)+(p.pricePair?' <small>'+esc(p.pricePair)+'</small>':'')+'</span>'+
  '<span class="oac-card-cta">לפרטי החבילה</span></span></a>'}
function dateHe(iso){return iso?(+iso.slice(8,10))+'.'+(+iso.slice(5,7))+'.'+iso.slice(0,4):''}
function render(){
  body.innerHTML=D.log.map(function(m){
    var h='<div class="oac-msg oac-'+m.who+'"><div class="oac-bub">'+esc(m.text).replace(/\n\n/g,'<span class="oac-sp"></span>').replace(/\n/g,'<br>')+'</div></div>';
    if(m.packages&&m.packages.length){var cs=m.packages.map(pkBy).filter(Boolean);
      h+='<div class="oac-cards">'+cs.map(card).join('')+'</div><p class="oac-note">המחירים כפי שמופיעים באתר, נכון ל-'+dateHe(PK_CHECKED)+', בכפוף לזמינות וט.ל.ח</p>'}
    if(m.after)h+='<div class="oac-msg oac-bot"><div class="oac-bub">'+esc(m.after).replace(/\n\n/g,'<span class="oac-sp"></span>').replace(/\n/g,'<br>')+'</div></div>';
    if(m.ready)h+=summaryCard();
    else if(m.handoff)h+='<a class="oac-wa-inline" href="'+esc(waLink())+'" target="_blank" rel="noopener">שליחת הסיכום לאסנת בוואטסאפ</a>';
    return h}).join('')+(busy?'<div class="oac-msg oac-bot"><div class="oac-bub oac-typing"><i></i><i></i><i></i></div></div>':'');
  var last=D.log[D.log.length-1];
  chipsEl.innerHTML=(last&&last.who==='bot'&&!busy?(last.suggestions||[]):[]).map(function(c){return'<button type="button" class="oac-chip">'+esc(c)+'</button>'}).join('');
  waBtn.href=waLink();
  body.scrollTop=body.scrollHeight;
  store.save(D)}
function botSay(r){if(r.lead){D.lead=D.lead||{};for(var k in r.lead){var v=String(r.lead[k]||'').trim();if(v)D.lead[k]=v}}
  if(r.ready)D.log.forEach(function(m){m.ready=false});
  D.log.push({who:'bot',text:r.reply,suggestions:r.suggestions||[],packages:r.packages||null,after:r.after||'',handoff:!!r.handoff,ready:!!r.ready});
  D.history.push({role:'assistant',content:r.reply+(r.packages&&r.packages.length?'\n[packages: '+r.packages.join(', ')+']':'')});
  if(r.summary)D.aiSummary=r.summary}
function send(text){text=String(text||'').trim();if(!text||busy)return;
  if(/^להתחיל מחדש$/.test(text)){D={S:newState(),log:[],history:[],aiSummary:null,lead:null};botSay(LocalEngine.start(D.S));render();return}
  if(/^לדבר עם אסנת$/.test(text)){window.open(waLink(),'_blank','noopener');}
  D.log.push({who:'me',text:text});D.history.push({role:'user',content:text});busy=true;render();
  pkReady.then(function(){
    var local=function(){return LocalEngine.reply(D.S,text)};
    var p=CFG.endpoint?remoteReply(D.history,D.S).then(function(r){understand(D.S,text);return r},function(){return local()}):new Promise(function(res){setTimeout(function(){res(local())},450)});
    return p}).then(function(r){busy=false;botSay(r);render()})}

function build(){
  root=document.createElement('div');root.className='oac';root.setAttribute('dir','rtl');root.setAttribute('lang','he');
  root.innerHTML='<button type="button" class="oac-fab" aria-label="פתיחת העוזר החכם של OSNAT TRAVEL" aria-expanded="false"><span class="oac-fab-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z"/></svg></span><span class="oac-fab-t"><span class="oac-fab-long">העוזר החכם של <b>OSNAT TRAVEL</b></span><span class="oac-fab-short">העוזר החכם</span></span></button>'+
  '<div class="oac-panel" role="dialog" aria-label="צ׳אט תכנון חופשה" hidden>'+
   '<div class="oac-head"><img src="/assets/logo.png" alt="OSNAT TRAVEL AGENCY" class="oac-logo"><div class="oac-head-t"><span class="oac-eyebrow">TRIP PLANNER</span><b>מתכננים <span class="grad">חופשה</span></b>'+
   '<small>'+(CFG.endpoint?'העוזר החכם של OSNAT TRAVEL · מבוסס AI':'העוזר החכם של OSNAT TRAVEL')+'</small></div>'+
   '<button type="button" class="oac-x" aria-label="סגירה">×</button></div>'+
   '<div class="oac-body" aria-live="polite"></div><div class="oac-chips"></div>'+
   '<form class="oac-form"><input type="text" class="oac-in" placeholder="כתבו כאן חופשי…" aria-label="הודעה" autocomplete="off" maxlength="400"><button type="submit" class="oac-send" aria-label="שליחה"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21 3 3 10.5l6.5 2.5L12 20z"/></svg></button></form>'+
   '<a class="oac-wa" target="_blank" rel="noopener" href="#">💬 להמשיך עם אסנת בוואטסאפ</a></div>';
  document.body.appendChild(root);
  panel=root.querySelector('.oac-panel');body=root.querySelector('.oac-body');input=root.querySelector('.oac-in');chipsEl=root.querySelector('.oac-chips');waBtn=root.querySelector('.oac-wa');
  root.querySelector('.oac-fab').onclick=function(){toggle()};root.querySelector('.oac-x').onclick=function(){toggle(false)};
  root.querySelector('.oac-form').onsubmit=function(e){e.preventDefault();var v=input.value;input.value='';send(v)};
  body.addEventListener('click',function(e){var b=e.target.closest('.oac-sum-copy');if(!b)return;var t=msgText();
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent='הועתק ✓'},function(){window.prompt('העתיקו את הסיכום:',t)})});
  chipsEl.onclick=function(e){var b=e.target.closest('.oac-chip');if(b)send(b.textContent)};
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&open)toggle(false)});
  if(!D.log.length)botSay(LocalEngine.start(D.S));
  pkReady.then(render);render();dodge();setTimeout(dodge,800);window.addEventListener('resize',dodge);
  if(CFG.autoOpen||D.open)toggle(true)}
function dodge(){ // lift the bubble above any other fixed element sitting in the bottom-left corner
  var fab=root.querySelector('.oac-fab'),lift=0,H=window.innerHeight;
  [].forEach.call(document.querySelectorAll('body *'),function(e){if(root.contains(e))return;
    var cs=getComputedStyle(e);if(cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden'||!e.offsetWidth)return;
    var r=e.getBoundingClientRect();if(r.width>=window.innerWidth*0.6||r.height>=H*0.5)return; // skip nav bars / overlays
    if(r.left<180&&r.bottom>H-140)lift=Math.max(lift,H-r.top)});
  root.style.bottom=lift?(lift+12)+'px':''}
function toggle(v){open=v==null?!open:!!v;panel.hidden=!open;root.classList.toggle('oac-open',open);
  root.querySelector('.oac-fab').setAttribute('aria-expanded',open);D.open=open;store.save(D);
  if(open){body.scrollTop=body.scrollHeight;if(window.matchMedia('(min-width:700px)').matches)input.focus()}}

window.OsnatChat={open:function(){toggle(true)},close:function(){toggle(false)},send:function(t){toggle(true);send(t)},
  reset:function(){D={S:newState(),log:[],history:[],aiSummary:null,lead:null};botSay(LocalEngine.start(D.S));render()},config:CFG,_state:function(){return D}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
