/* OSNAT preview: hide package dates/prices from the departure day (Asia/Jerusalem).
   Markup: <body data-depart="YYYY-MM-DD"> or a card with data-depart; hide [data-exp], show [data-exp-note].
   Already-expired packages are also stripped statically at build time. Preview: ?asof=YYYY-MM-DD */
(function(){
 function today(){var m=(location.search||'').match(/[?&]asof=(\d{4}-\d{2}-\d{2})/);if(m)return m[1];
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){var d=new Date(Date.now()+2*36e5);return d.toISOString().slice(0,10)}}
 function off(root){[].forEach.call(root.querySelectorAll('[data-exp]'),function(e){e.hidden=true;e.style.display='none'});[].forEach.call(root.querySelectorAll('[data-exp-note]'),function(e){e.hidden=false;e.removeAttribute('hidden')});root.setAttribute('data-past','1')}
 function run(){var t=today(),B=document.body,bd=B.getAttribute('data-depart');
  if(bd&&t>=bd){off(B);var wa=document.querySelector('.vn-exp-wa');if(wa)[].forEach.call(document.querySelectorAll('a[href^="https://wa.me/972506413749"]'),function(a){a.href=wa.href});
   document.title=document.title.replace(/\d{1,2}(?:[–-]\d{1,2}(?:\.\d{1,2})?)?\.\d{1,2}\.\d{4}/g,'').replace(/\s{2,}/g,' ')}
  [].forEach.call(document.querySelectorAll('[data-depart]'),function(c){if(c!==B&&t>=c.getAttribute('data-depart'))off(c)})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
