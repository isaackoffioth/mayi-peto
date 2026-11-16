/* Mayi Peto — motion design
 * Apparitions au défilement, titres masqués, texte qui s'allume, compteurs,
 * parallaxe, barre de progression, curseur, rideau entre les onglets.
 * Tout est désactivé si l'utilisateur préfère réduire les animations.
 */
(function () {
  'use strict';
  const MP = window.MP;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------- Apparitions ----------
  // Éléments animés automatiquement en plus de ceux marqués .reveal dans le HTML
  const AUTO = [
    '.page-head .eyebrow', '.page-head h2', '.page-head .lead',
    'section.block > .wrap > h2', '.legend-list li', '.stage-cards .card', '.steps li',
    '.table-wrap', '.gestes .card', '.grid > .card', '.pestle .p', '.callout', '.sim', '.map-layout', '.sources',
  ];
  function tagAuto() {
    AUTO.forEach((sel) => $$(sel).forEach((el) => {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      // décalage en cascade entre éléments frères
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
      const i = sibs.indexOf(el);
      if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', Math.min(i, 6) * 0.08 + 's');
    }));
  }

  let io = null;
  function observe() {
    if (reduce || !('IntersectionObserver' in window)) {
      $$('.reveal, .lm, .stage, .steps li, .stat').forEach((el) => el.classList.add('in'));
      $$('.stat').forEach(countUp);
      return;
    }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (e.target.classList.contains('stat')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal:not(.in), .stage:not(.in), .steps li:not(.in)').forEach((el) => io.observe(el));
  }

  // ---------- Titre du héros (lignes masquées) ----------
  function heroIn() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.classList.remove('in');
    void hero.offsetWidth;            // relance la transition
    requestAnimationFrame(() => hero.classList.add('in'));
  }

  // ---------- Compteurs ----------
  function fmt(v, dec) {
    return v.toLocaleString(MP.lang() === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function countUp(stat) {
    $$('.count', stat).forEach((c) => {
      const to = parseFloat(c.dataset.to), dec = +(c.dataset.dec || 0);
      if (reduce) { c.textContent = fmt(to, dec); return; }
      const t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 4);
        c.textContent = fmt(to * e, dec);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  function refreshCounts() {
    $$('.stat.in .count').forEach((c) => { c.textContent = fmt(parseFloat(c.dataset.to), +(c.dataset.dec || 0)); });
  }

  // ---------- Texte qui s'allume au défilement ----------
  function splitScrub() {
    $$('.scrub').forEach((p) => {
      if (p.dataset.split) return;
      p.dataset.split = '1';
      const out = [];
      p.childNodes.forEach((n) => {
        const acc = n.nodeType === 1;     // les <em> sont mis en couleur d'accent
        const words = n.textContent.split(/(\s+)/);
        words.forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) out.push(w);
          else out.push(`<span class="w${acc ? ' acc' : ''}">${w}</span>`);
        });
      });
      p.innerHTML = out.join('');
    });
  }
  function scrubUpdate() {
    const vh = innerHeight;
    $$('.scrub').forEach((p) => {
      if (!p.offsetParent) return;
      const r = p.getBoundingClientRect();
      // 0 quand le haut du bloc atteint 85 % de l'écran, 1 quand le bas atteint 45 %
      const prog = (vh * 0.85 - r.top) / (r.height + vh * 0.4);
      const words = p.querySelectorAll('.w');
      const n = Math.round(Math.max(0, Math.min(1, prog)) * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', reduce || i < n));
    });
  }

  // ---------- Parallaxe + barre de progression ----------
  const bar = document.getElementById('progress');
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    if (!reduce) {
      $$('[data-parallax]').forEach((el) => {
        if (!el.offsetParent) return;
        el.style.transform = `translate3d(0, ${scrollY * parseFloat(el.dataset.parallax)}px, 0)`;
      });
    }
    scrubUpdate();
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  addEventListener('resize', onScroll);

  // ---------- Bandeaux défilants (contenu doublé pour une boucle continue) ----------
  function initMarquees() {
    $$('.marquee .track').forEach((tr) => {
      if (tr.dataset.dup) return;
      tr.dataset.dup = '1';
      const item = tr.querySelector('.item');
      // assez de copies pour couvrir les grands écrans
      for (let i = 0; i < 3; i++) tr.appendChild(item.cloneNode(true));
    });
  }

  // ---------- Curseur ----------
  function initCursor() {
    if (reduce || !matchMedia('(pointer: fine)').matches) return;
    const ring = document.createElement('div'); ring.className = 'cursor';
    const dot = document.createElement('div'); dot.className = 'cursor-dot';
    document.body.append(ring, dot);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    });
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('mouseover', (e) => {
      ring.classList.toggle('big', !!e.target.closest('a, button, .flip, input[type=checkbox], select, label'));
    });
    document.addEventListener('mouseleave', () => { ring.style.opacity = 0; dot.style.opacity = 0; });
    document.addEventListener('mouseenter', () => { ring.style.opacity = 1; dot.style.opacity = 1; });
  }

  // ---------- Boutons « magnétiques » ----------
  function initMagnetic() {
    if (reduce || !matchMedia('(pointer: fine)').matches) return;
    document.addEventListener('mousemove', (e) => {
      const b = e.target.closest('.btn');
      $$('.btn.mag').forEach((x) => { if (x !== b) { x.style.transform = ''; x.classList.remove('mag'); } });
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.18, dy = (e.clientY - r.top - r.height / 2) * 0.3;
      b.classList.add('mag');
      b.style.transform = `translate(${dx}px, ${dy}px)`;
    });
  }

  // ---------- Rideau entre les onglets ----------
  const NAMES = {
    accueil: ['Accueil', 'Home'], filtre: ['Le filtre', 'The filter'], simulateur: ['Simulateur', 'Simulator'],
    sensibilisation: ['Sensibilisation', 'Awareness'], carte: ['La carte', 'The map'], projet: ['Le projet', 'The project'],
  };
  const curtain = document.getElementById('curtain');
  let busy = false;
  MP.transition = (id, swap) => {
    if (reduce || !curtain || busy) { swap(); afterSwap(); return; }
    busy = true;
    document.getElementById('curtain-txt').textContent = NAMES[id][MP.lang() === 'fr' ? 0 : 1];
    curtain.classList.remove('go'); void curtain.offsetWidth; curtain.classList.add('go');
    setTimeout(() => { swap(); afterSwap(); }, 450);
    setTimeout(() => { curtain.classList.remove('go'); busy = false; }, 1050);
  };
  function afterSwap() { observe(); heroIn(); onScroll(); }

  // ---------- Démarrage ----------
  document.addEventListener('DOMContentLoaded', () => {
    tagAuto();
    splitScrub();
    initMarquees();
    observe();
    heroIn();
    onScroll();
    initCursor();
    initMagnetic();
    MP.onPage.push(() => { requestAnimationFrame(() => { observe(); onScroll(); }); });
  });
  MP.onLang(() => { requestAnimationFrame(() => { observe(); scrubUpdate(); refreshCounts(); }); });
})();
