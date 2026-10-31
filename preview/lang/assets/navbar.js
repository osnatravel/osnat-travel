/* OSNAT TRAVEL – shared sticky navbar. Include: <link rel="stylesheet" href="/assets/navbar.css"><script src="/assets/navbar.js" defer></script>
   Optional: <body data-nav-overlay> (no top padding, e.g. full-screen hero). */
(function(){
 if(document.querySelector('.on-nav'))return;
 var p=location.pathname, B=document.body;
 var BASE='/preview/lang/';var L=(document.documentElement.lang||'he').slice(0,2);if(['he','en','ar'].indexOf(L)<0)L='he';
 var DIR=L==='en'?'ltr':'rtl';
 var T={he:{blog:'בלוג',pk:'חבילות',about:'אודות',home:'חזרה לדף הבית',menu:'תפריט',nav:'ניווט ראשי',lang:'שפה'},
        en:{blog:'Blog',pk:'Packages',about:'About',home:'Back to homepage',menu:'Menu',nav:'Main navigation',lang:'Language'},
        ar:{blog:'المدونة',pk:'الباقات',about:'من نحن',home:'العودة إلى الصفحة الرئيسية',menu:'القائمة',nav:'التنقل الرئيسي',lang:'اللغة'}}[L];
 var rest=p.indexOf(BASE)===0?p.slice(BASE.length):'';rest=rest.replace(/^(en|ar)\//,'');
 function url(l,r){return BASE+(l==='he'?'':l+'/')+r}
 var HOME=url(L,''),PK=url(L,'packages/');
 try{var S=localStorage.getItem('osnatLang');var ext=!document.referrer||document.referrer.indexOf(location.origin)!==0;if(L==='he'&&S&&S!=='he'&&ext&&['en','ar'].indexOf(S)>=0){location.replace(url(S,rest)+location.hash);return}localStorage.setItem('osnatLang',L)}catch(e){}
 function cur(h){return (p===h||p.indexOf(h)===0&&h!=='/')?' class="cur" aria-current="page"':''}
 var svg={
  fb:'<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>',
  ig:'<path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/>',
  wa:'<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.15 12C2.15 6.55 6.6 2.1 12.06 2.1c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 7c0 5.45-4.44 9.89-9.89 9.89zM20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.31-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.49-8.41z"/>',
  home:'<path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/>',
  menu:'<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>'};
 function s(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+svg[k]+'</svg>'}
 var n=document.createElement('nav');n.className='on-nav';n.setAttribute('dir',DIR);n.setAttribute('aria-label',T.nav);
 n.innerHTML='<a class="on-logo" href="'+HOME+'" aria-label="OSNAT TRAVEL"><img src="/assets/logo.png" alt="OSNAT TRAVEL"></a>'+
  '<button class="on-burger" type="button" aria-label="'+T.menu+'" aria-expanded="false">'+s('menu')+'</button>'+
  '<div class="on-links"><a href="/blog/">'+T.blog+'</a><a href="'+PK+'"'+(rest==='packages/'?' class="cur" aria-current="page"':'')+'>'+T.pk+'</a><a href="'+HOME+'#about">'+T.about+'</a></div>'+
  '<div class="on-brand" aria-hidden="true"><i></i><span>✦</span><b>OSNAT TRAVEL AGENCY</b><span>✦</span><i class="on-r"></i></div>'+
  '<div class="on-end"><div class="on-lang"><button type="button" class="on-lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="'+T.lang+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4z"/></svg><span>'+{he:'עב',en:'EN',ar:'ع'}[L]+'</span><svg class="on-car" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></button><ul class="on-lang-menu" role="menu" hidden>'+[['he','עברית'],['en','English'],['ar','العربية']].map(function(x){return '<li role="none"><a role="menuitem" href="'+url(x[0],rest)+'" hreflang="'+x[0]+'" lang="'+x[0]+'" dir="'+(x[0]==='en'?'ltr':'rtl')+'" data-l="'+x[0]+'"'+(x[0]===L?' class="cur" aria-current="true"':'')+'>'+x[1]+(x[0]===L?' <b aria-hidden="true">✓</b>':'')+'</a></li>'}).join('')+'</ul></div><a class="on-ic fb" href="https://www.facebook.com/OSNAT.Travel/" target="_blank" rel="noopener" aria-label="Facebook">'+s('fb')+'</a>'+
  '<a class="on-ic ig" href="https://www.instagram.com/osnat.travel.agency/" target="_blank" rel="noopener" aria-label="Instagram">'+s('ig')+'</a>'+
  '<a class="on-ic wa" href="https://wa.me/972506413749" target="_blank" rel="noopener" aria-label="WhatsApp">'+s('wa')+'</a>'+
  '<a class="on-ic on-home" href="'+HOME+'" aria-label="'+T.home+'" title="'+T.home+'">'+s('home')+'</a></div>';
 B.insertBefore(n,B.firstChild);B.classList.add('on-has-nav');if(B.hasAttribute('data-nav-overlay'))B.classList.add('on-overlay');
 var b=n.querySelector('.on-burger');b.onclick=function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)};
 var lb=n.querySelector('.on-lang-btn'),lm=n.querySelector('.on-lang-menu');
 function lset(o,f){lm.hidden=!o;lb.setAttribute('aria-expanded',o);if(o&&f)lm.querySelector('a').focus()}
 lb.addEventListener('click',function(e){e.stopPropagation();lset(lm.hidden,false)});
 lb.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();lset(true,true)}});
 lm.addEventListener('keydown',function(e){var a=[].slice.call(lm.querySelectorAll('a')),i=a.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();a[(i+1)%a.length].focus()}if(e.key==='ArrowUp'){e.preventDefault();a[(i+a.length-1)%a.length].focus()}});
 document.addEventListener('click',function(e){if(!n.querySelector('.on-lang').contains(e.target))lset(false)});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!lm.hidden){lset(false);lb.focus()}});
 n.querySelectorAll('.on-lang a').forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('osnatLang',a.dataset.l)}catch(e){}})});
 n.querySelectorAll('.on-links a').forEach(function(a){a.onclick=function(){n.classList.remove('open')}});

})();
