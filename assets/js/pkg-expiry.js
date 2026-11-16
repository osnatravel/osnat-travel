/* Hides stale package dates and prices from the departure day (Asia/Jerusalem). */
(function () {
  var HIDE = '[data-exp="date"],[data-exp="price"]';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function jerusalemToday() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      var y, m, d;
      parts.forEach(function (p) {
        if (p.type === 'year') y = p.value;
        if (p.type === 'month') m = p.value;
        if (p.type === 'day') d = p.value;
      });
      if (y && m && d) return y + '-' + m + '-' + d;
    } catch (e) {}
    var now = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return now.getUTCFullYear() + '-' + pad(now.getUTCMonth() + 1) + '-' + pad(now.getUTCDate());
  }

  function todayIso() {
    var path = location.pathname || '';
    if (path.indexOf('/preview/') === 0) {
      var match = (location.search || '').match(/[?&]asof=(\d{4}-\d{2}-\d{2})(?:&|$)/);
      if (match) return match[1];
    }
    return jerusalemToday();
  }

  function pageTitle() {
    return (document.title || 'החבילה').replace(/\s+/g, ' ').trim();
  }

  function waHref() {
    var text = 'היי, אשמח לתאריכים ומחיר עדכני לחבילה: ' + pageTitle();
    return 'https://wa.me/972506413749?text=' + encodeURIComponent(text);
  }

  function ensureCss() {
    if (document.getElementById('pkg-exp-css')) return;
    var style = document.createElement('style');
    style.id = 'pkg-exp-css';
    style.textContent = [
      '.pkg-exp-hide{display:none !important}',
      '.pkg-exp-note{position:relative;z-index:2;margin:14px 0;background:#fff;color:#102A43;border:1.5px solid #C8A96B;border-radius:18px;padding:16px 18px;text-align:center;box-shadow:0 8px 24px rgba(16,42,67,.08);font-family:Heebo,Arial,sans-serif}',
      '.pkg-exp-note p{margin:0 0 12px;font-size:18px;font-weight:800;line-height:1.45}',
      '.pkg-exp-wa{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;background:#C8A96B;color:#102A43;font-weight:800;text-decoration:none;font-size:17px}',
      '.pkg-exp-wa:hover{background:#F7F4ED}',
      '.pkg-exp-note-card{margin:10px 0 0;padding:12px;border-radius:14px}',
      '.pkg-exp-note-card p{font-size:15px}',
      '.pkg-exp-note-card .pkg-exp-wa{min-height:42px;font-size:15px}',
      '.pkg-exp-passed{margin:8px 12px 0;color:#102A43;font-weight:800;font-size:15px}'
    ].join('');
    document.head.appendChild(style);
  }

  function hide(el) {
    el.classList.add('pkg-exp-hide');
    el.setAttribute('hidden', '');
  }

  function buildNote(compact) {
    var box = document.createElement('aside');
    box.className = 'pkg-exp-note' + (compact ? ' pkg-exp-note-card' : '');
    var p = document.createElement('p');
    p.textContent = 'התאריכים בחבילה זו עברו. לתאריכים ומחיר עדכני דברו איתנו';
    var link = document.createElement('a');
    link.className = 'pkg-exp-wa';
    link.href = waHref();
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'דברו איתנו בוואטסאפ';
    box.appendChild(p);
    box.appendChild(link);
    return box;
  }

  function expirePage() {
    document.querySelectorAll(HIDE).forEach(hide);
    if (document.querySelector('body > .pkg-exp-note, main .pkg-exp-note, .hero .pkg-exp-note')) return;
    var note = buildNote(false);
    var price = document.querySelector('[data-exp="price"]');
    if (price && price.parentNode) price.parentNode.insertBefore(note, price.nextSibling);
    else {
      var host = document.querySelector('main') || document.body;
      host.insertBefore(note, host.firstChild);
    }
  }

  function expireCard(card) {
    card.querySelectorAll(HIDE).forEach(hide);
    card.setAttribute('data-past', '1');
    if (card.classList.contains('deal')) {
      if (card.querySelector('.pkg-exp-passed')) return;
      var line = document.createElement('p');
      line.className = 'pkg-exp-passed';
      line.textContent = 'התאריך עבר – לבירור';
      var foot = card.querySelector('.foot') || card.querySelector('.card') || card;
      foot.appendChild(line);
      return;
    }
    if (card.querySelector('.pkg-exp-note')) return;
    var note = buildNote(true);
    if (card.tagName === 'A') {
      card.parentNode.insertBefore(note, card.nextSibling);
    } else {
      card.appendChild(note);
    }
  }

  function run() {
    var today = todayIso();
    var bodyDepart = document.body.getAttribute('data-depart');
    var pageExpired = bodyDepart && today >= bodyDepart;
    var cards = [].slice.call(document.querySelectorAll('[data-depart]')).filter(function (el) {
      return el !== document.body && today >= el.getAttribute('data-depart');
    });
    if (!pageExpired && !cards.length) return;
    ensureCss();
    if (pageExpired) expirePage();
    cards.forEach(expireCard);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
