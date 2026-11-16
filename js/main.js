/* Mayi Peto — navigation, langue, thème, contenus interactifs de sensibilisation */
(function () {
  'use strict';
  const root = document.documentElement;
  const listeners = [];

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }

  const MP = window.MP = {
    lang: () => root.getAttribute('data-lang') || 'fr',
    t: (fr, en) => (MP.lang() === 'fr' ? fr : en),
    onLang: (cb) => listeners.push(cb),
    onPage: [],
  };

  // ---------- Langue ----------
  document.getElementById('lang-btn').addEventListener('click', () => {
    const l = MP.lang() === 'fr' ? 'en' : 'fr';
    root.setAttribute('data-lang', l);
    root.lang = l;
    store('mp-lang', l);
    listeners.forEach((cb) => cb(l));
  });

  // ---------- Thème : fond noir ou blanc ----------
  function setThemeIcon() {
    const b = document.getElementById('theme-btn');
    if (!b) return;
    const dark = root.getAttribute('data-theme') !== 'light';
    b.innerHTML = dark ? '<span class="fr">☀ Blanc</span><span class="en">☀ Light</span>' : '<span class="fr">☾ Noir</span><span class="en">☾ Dark</span>';
    b.setAttribute('aria-label', dark ? MP.t('Passer en fond blanc', 'Switch to white background') : MP.t('Passer en fond noir', 'Switch to black background'));
  }
  document.getElementById('theme-btn').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    store('mp-theme', next);
    setThemeIcon();
  });
  setThemeIcon();
  MP.onLang(setThemeIcon);

  // ---------- Prix : euros + francs congolais ----------
  // Les estimations de base sont en dollars US (prix des marchés en RDC), converties ici.
  // Taux : BCC (Banque Centrale du Congo), cours moyen du 11/11/2026 ; USD→EUR mi-novembre 2026.
  const RATE = { usdEur: 0.89, eurCdf: 2547, date: '11/11/2026' };
  const loc = () => (MP.lang() === 'fr' ? 'fr-FR' : 'en-US');
  const roundFc = (x, big) => { const step = big ? 1000 : (x >= 1000 ? 100 : 10); return Math.round(x / step) * step; };
  function eur(usd, dec) {
    const v = usd * RATE.usdEur;
    const n = v.toLocaleString(loc(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return MP.lang() === 'fr' ? n + ' €' : '€' + n;
  }
  function fc(usd, big) {
    return roundFc(usd * RATE.usdEur * RATE.eurCdf, big).toLocaleString(loc()) + ' FC';
  }
  MP.RATE = RATE;
  // formats : full « 13,08 € · 33 300 FC » ; round « 13 € (≈ 33 000 FC) » ; eur ; eur2 ; fc ; cell (2 lignes) ; range
  MP.money = (usd, f, usd2) => {
    switch (f) {
      case 'round': return `${eur(usd, 0)} (≈ ${fc(usd, true)})`;
      case 'eur': return eur(usd, 0);
      case 'eur2': return eur(usd, 2);
      case 'fc': return fc(usd, true);
      case 'cell': return `${eur(usd, 2)}<br><small class="fc">${fc(usd)}</small>`;
      case 'range': return usd2 != null
        ? `${eur(usd, 0)}–${eur(usd2, 0)}<br><small class="fc">${fc(usd, true).replace(' FC', '')}–${fc(usd2, true)}</small>`
        : `${eur(usd, 0)}<br><small class="fc">≈ ${fc(usd, true)}</small>`;
      default: return `${eur(usd, 2)} · ${fc(usd)}`;
    }
  };
  function applyPrices() {
    document.querySelectorAll('.price').forEach((el) => {
      el.innerHTML = MP.money(parseFloat(el.dataset.usd), el.dataset.f, el.dataset.usd2 ? parseFloat(el.dataset.usd2) : null);
    });
    const note = MP.t(`Taux indicatifs : 1 € ≈ ${RATE.eurCdf.toLocaleString('fr-FR')} FC (Banque Centrale du Congo, ${RATE.date}).`,
                      `Indicative rates: €1 ≈ ${RATE.eurCdf.toLocaleString('en-US')} FC (Central Bank of Congo, ${RATE.date}).`);
    document.querySelectorAll('.rate-note').forEach((el) => { el.textContent = note; });
  }
  document.addEventListener('DOMContentLoaded', applyPrices);
  MP.onLang(applyPrices);

  // ---------- Navigation par onglets (hash) ----------
  // MP.transition(id, swap), défini dans motion.js, joue le rideau animé entre deux onglets.
  const pages = ['accueil', 'filtre', 'simulateur', 'sensibilisation', 'carte', 'projet'];
  let current = null;
  function route() {
    const h = (location.hash || '#accueil').slice(1).split('?')[0];
    const id = pages.includes(h) ? h : 'accueil';
    const swap = () => {
      document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === 'p-' + id));
      document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === id));
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = '';
      MP.onPage.forEach((cb) => cb(id));
    };
    if (current !== null && current !== id && MP.transition) MP.transition(id, swap);
    else swap();
    current = id;
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', route);

  // ---------- Idées reçues (cartes à retourner) ----------
  const MYTHS = [
    { m: ['Une eau claire est une eau potable.', 'Clear water is safe water.'],
      f: ['Faux. Les bactéries et les virus sont invisibles. Une eau limpide peut contenir des milliers d\'E. coli par 100 mL. Seule une analyse le dit.',
          'False. Bacteria and viruses are invisible. Crystal-clear water can hold thousands of E. coli per 100 mL. Only a test can tell.'] },
    { m: ['L\'eau de source est toujours pure.', 'Spring water is always pure.'],
      f: ['Pas toujours. Une source non protégée reçoit le ruissellement, les excréments d\'animaux et les latrines voisines. Il faut la capter, la clôturer et traiter l\'eau.',
          'Not always. An unprotected spring collects runoff, animal droppings and nearby latrines. It must be capped and fenced, and the water treated.'] },
    { m: ['Il faut faire bouillir l\'eau 20 minutes.', 'Water must be boiled for 20 minutes.'],
      f: ['Non. Selon l\'OMS, porter l\'eau à gros bouillons suffit à tuer les germes. On économise ainsi du bois et du charbon.',
          'No. According to WHO, bringing water to a rolling boil is enough to kill germs. That saves wood and charcoal.'] },
    { m: ['Le chlore est un poison.', 'Chlorine is a poison.'],
      f: ['Aux doses recommandées (comprimés, eau de Javel bien diluée), le chlore est sans danger. Il protège même l\'eau contre une recontamination dans le seau.',
          'At recommended doses (tablets, properly diluted bleach), chlorine is safe. It even protects the water from recontamination in the bucket.'] },
    { m: ['Un filtre, ça marche tout seul pour toujours.', 'A filter works on its own forever.'],
      f: ['Un filtre s\'entretient : il ne doit pas sécher, il faut nettoyer la surface quand le débit baisse et changer le charbon tous les 3 à 6 mois.',
          'A filter needs care: it must not dry out, the surface must be cleaned when the flow drops and the charcoal changed every 3–6 months.'] },
    { m: ['L\'eau de pluie est toujours propre.', 'Rainwater is always clean.'],
      f: ['Le toit, les gouttières et le récipient peuvent la salir (fientes d\'oiseaux, poussière). Il faut jeter les premières pluies et traiter l\'eau.',
          'The roof, gutters and container can contaminate it (bird droppings, dust). Discard the first rain and treat the water.'] },
  ];
  function renderMyths() {
    const el = document.getElementById('myths');
    if (!el) return;
    const i = MP.lang() === 'fr' ? 0 : 1;
    el.innerHTML = MYTHS.map((x) => `
      <div class="flip" tabindex="0" role="button" aria-pressed="false">
        <div class="flip-in">
          <div class="flip-f"><div class="k">${MP.t('Idée reçue', 'Myth')}</div><p>« ${x.m[i]} »</p><span class="hint">${MP.t('toucher pour retourner ↻', 'tap to flip ↻')}</span></div>
          <div class="flip-b"><div class="k">${MP.t('Réalité', 'Fact')}</div><p>${x.f[i]}</p></div>
        </div>
      </div>`).join('');
    el.querySelectorAll('.flip').forEach((c) => {
      const toggle = () => { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); };
      c.addEventListener('click', toggle);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

  // ---------- Quiz ----------
  const QUIZ = [
    { q: ['Une eau très claire sortie d\'un puits est-elle forcément bonne à boire ?', 'Is very clear water from a well always safe to drink?'],
      o: [['Oui, si elle est claire', 'Yes, if it is clear'], ['Non, il faut la traiter et la tester', 'No, it must be treated and tested'], ['Oui, si elle est froide', 'Yes, if it is cold']], a: 1,
      e: ['Les germes sont invisibles à l\'œil nu.', 'Germs are invisible to the naked eye.'] },
    { q: ['Pourquoi le tuyau de sortie du filtre Mayi Peto remonte-t-il au-dessus du sable ?', 'Why does the Mayi Peto outlet pipe rise above the sand?'],
      o: [['Pour faire joli', 'To look nice'], ['Pour que le sable reste toujours sous l\'eau et que le biofilm survive', 'So the sand always stays under water and the biofilm survives'], ['Pour filtrer plus vite', 'To filter faster']], a: 1,
      e: ['Le biofilm (schmutzdecke) meurt s\'il sèche. C\'est lui qui élimine une grande partie des germes.', 'The biofilm (schmutzdecke) dies if it dries out. It removes a large share of the germs.'] },
    { q: ['Combien de temps faut-il laisser les bouteilles SODIS au soleil par beau temps ?', 'How long should SODIS bottles stay in the sun on a sunny day?'],
      o: [['30 minutes', '30 minutes'], ['6 heures', '6 hours'], ['1 semaine', '1 week']], a: 1,
      e: ['6 h en plein soleil, et 2 jours consécutifs si le ciel est couvert.', '6 h in full sun, and 2 consecutive days if the sky is cloudy.'] },
    { q: ['À quoi servent les graines de moringa ?', 'What are moringa seeds used for?'],
      o: [['À tuer tous les virus', 'To kill all viruses'], ['À faire tomber la boue au fond (coagulant)', 'To make mud sink to the bottom (coagulant)'], ['À donner du goût', 'To add flavour']], a: 1,
      e: ['Le moringa clarifie l\'eau, mais il faut ensuite filtrer et désinfecter.', 'Moringa clarifies water, but it must still be filtered and disinfected.'] },
    { q: ['Comment se servir dans le seau de stockage ?', 'How should you take water from the storage bucket?'],
      o: [['En trempant un gobelet', 'By dipping a cup'], ['Par le robinet', 'Through the tap'], ['Avec la main', 'With your hand']], a: 1,
      e: ['Mains et gobelets recontaminent l\'eau traitée.', 'Hands and cups recontaminate treated water.'] },
    { q: ['Le filtre à sable seul suffit-il contre les virus ?', 'Is the sand filter alone enough against viruses?'],
      o: [['Oui, toujours', 'Yes, always'], ['Non, il faut ajouter une désinfection (chlore, soleil ou ébullition)', 'No, disinfection must be added (chlorine, sun or boiling)']], a: 1,
      e: ['D\'après l\'OMS, le biosable réduit les virus de seulement 0,5 à 2 log.', 'According to WHO, biosand only reduces viruses by 0.5–2 log.'] },
  ];
  const chosen = {}; // index de la question -> index de l'option choisie
  function renderQuiz() {
    const el = document.getElementById('quiz');
    if (!el) return;
    const i = MP.lang() === 'fr' ? 0 : 1;
    const keys = Object.keys(chosen);
    const score = keys.filter((qi) => chosen[qi] === QUIZ[qi].a).length;
    el.innerHTML = QUIZ.map((x, qi) => {
      const answered = qi in chosen;
      const ok = answered && chosen[qi] === x.a;
      return `<div class="card q"><b>${qi + 1}. ${x.q[i]}</b><div class="opts">${x.o.map((o, oi) => {
        let cls = '';
        if (answered && oi === x.a) cls = 'right';
        else if (answered && oi === chosen[qi]) cls = 'wrong';
        return `<button type="button" data-q="${qi}" data-o="${oi}" class="${cls}" ${answered ? 'disabled' : ''}>${o[i]}</button>`;
      }).join('')}</div>${answered ? `<div class="fb">${ok ? '✅ ' : '❌ '}${x.e[i]}</div>` : ''}</div>`;
    }).join('') + `<p class="score">${MP.t('Score', 'Score')} : ${score} / ${QUIZ.length}${keys.length === QUIZ.length ? (score === QUIZ.length ? MP.t(' 🎉 Parfait !', ' 🎉 Perfect!') : MP.t(' — relisez les idées reçues ci-dessus.', ' — re-read the myths above.')) : ''}</p>
      ${keys.length ? `<button type="button" class="btn small ghost" id="quiz-reset">${MP.t('Recommencer', 'Start again')}</button>` : ''}`;
    el.querySelectorAll('button[data-q]').forEach((b) => b.addEventListener('click', () => {
      chosen[+b.dataset.q] = +b.dataset.o;
      renderQuiz();
    }));
    const r = document.getElementById('quiz-reset');
    if (r) r.addEventListener('click', () => { Object.keys(chosen).forEach((k) => delete chosen[k]); renderQuiz(); });
  }

  document.addEventListener('DOMContentLoaded', () => { renderMyths(); renderQuiz(); });
  MP.onLang(() => { renderMyths(); renderQuiz(); });
})();
