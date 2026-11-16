/* Mayi Peto — simulateur de filtre (modèle pédagogique simplifié)
 *
 * Hypothèses principales (voir aussi la note sous le simulateur) :
 *  - Réductions microbiennes calibrées sur l'OMS (GDWQ 2022, tableau 7.8) :
 *    biosable domestique 1–3 log bactéries, 0,5–2 log virus, 2–4 log protozoaires.
 *  - Débit : loi de Darcy, Q = A · Δh / Σ(h_i / K_i).
 *  - Verdict : cibles du programme OMS d'évaluation du traitement de l'eau à domicile
 *    (★ : 2/3/2 log ; ★★ : 4/5/4 log pour bactéries/virus/protozoaires).
 *  Ce n'est PAS un modèle validé en laboratoire.
 */
(function () {
  'use strict';
  const MP = window.MP;
  const t = (fr, en) => MP.t(fr, en);

  // ---------- Matériaux ----------
  // K : perméabilité relative (cm/min), costL : $ par litre de matériau, turb : coefficient de clarification par cm
  const MAT = {
    gravel:   { fr: 'Gravier (6–12 mm)', en: 'Gravel (6–12 mm)', s: ['Gravier', 'Gravel'], K: 300, costL: 0.012, turb: 0.005, pat: 'p-gravel', sw: '#9aa0a8', min: 1, max: 15, def: 5 },
    coarse:   { fr: 'Sable grossier (1–3 mm)', en: 'Coarse sand (1–3 mm)', s: ['Sable gros', 'Coarse sand'], K: 20, costL: 0.012, turb: 0.03, pat: 'p-coarse', sw: '#d6b37a', min: 1, max: 15, def: 4 },
    fine:     { fr: 'Sable fin (0,15–0,35 mm)', en: 'Fine sand (0.15–0.35 mm)', s: ['Sable fin', 'Fine sand'], K: 1.2, costL: 0.012, turb: 0.12, pat: 'p-fine', sw: '#ecd6a6', min: 2, max: 60, def: 20 },
    charcoal: { fr: 'Charbon de bois (makala)', en: 'Charcoal (makala)', s: ['Charbon', 'Charcoal'], K: 15, costL: 0.09, turb: 0.03, pat: 'p-charcoal', sw: '#2b2b2b', min: 1, max: 15, def: 5 },
    cloth:    { fr: 'Coton / tissu', en: 'Cotton / cloth', s: ['Coton', 'Cotton'], K: 3, costL: 0, fixed: 0.5, turb: 0.25, pat: 'p-cloth', sw: '#f3efe4', min: 1, max: 3, def: 1 },
    iron:     { fr: 'Clous de fer (arsenic)', en: 'Iron nails (arsenic)', s: ['Clous fer', 'Iron nails'], K: 100, costL: 0.6, turb: 0.01, pat: 'p-iron', sw: '#6b4431', min: 1, max: 10, def: 5 },
  };
  const ORDER = ['gravel', 'coarse', 'fine', 'charcoal', 'cloth', 'iron'];

  // ---------- Contenants ----------
  // A : section (cm²), H : hauteur utile (cm), head : charge d'eau au-dessus du lit (cm), w : largeur dessinée (px)
  const CONT = {
    bottle:  { fr: 'Bouteille PET 1,5 L (démo)', en: '1.5 L PET bottle (demo)', A: 60, H: 26, head: 5, cost: 0, extra: 0, w: 92 },
    bucket:  { fr: 'Seau 20 L', en: '20 L bucket', A: 600, H: 34, head: 8, cost: 2, extra: 5.5, w: 180 },
    drum60:  { fr: 'Fût alimentaire 60 L', en: '60 L food-grade drum', A: 1100, H: 62, head: 12, cost: 5, extra: 5.5, w: 196 },
    drum200: { fr: 'Fût 200 L (école, centre de santé)', en: '200 L drum (school, health centre)', A: 2500, H: 88, head: 15, cost: 15, extra: 7, w: 236 },
  };

  // ---------- Eaux de départ ----------
  // ntu : turbidité ; ec : log10 E. coli / 100 mL ; as : arsenic µg/L
  const SRC = {
    river:   { fr: 'Rivière / ruisseau (très trouble)', en: 'River / stream (very turbid)', ntu: 120, ec: 4, as: 0 },
    openwell:{ fr: 'Puits ouvert', en: 'Open well', ntu: 25, ec: 3, as: 0 },
    spring:  { fr: 'Source aménagée', en: 'Protected spring', ntu: 4, ec: 1.5, as: 0 },
    rain:    { fr: 'Eau de pluie (toit)', en: 'Rainwater (roof)', ntu: 3, ec: 1.5, as: 0 },
    arsenic: { fr: 'Puits tubé à arsenic (Asie du Sud)', en: 'Arsenic tube well (South Asia)', ntu: 5, ec: 1, as: 100 },
  };

  const DIS = {
    none:     { fr: 'Aucune', en: 'None' },
    sodis:    { fr: 'SODIS (soleil)', en: 'SODIS (sun)' },
    chlorine: { fr: 'Chlore', en: 'Chlorine' },
    boil:     { fr: 'Ébullition', en: 'Boiling' },
  };

  const L = (m, h) => ({ m, h });
  const PRESETS = {
    mayipeto: { fr: 'Mayi Peto (notre design)', en: 'Mayi Peto (our design)',
      s: { source: 'river', container: 'drum60', persons: 5, settle: true, moringa: true, clothPre: true, raised: true, mature: true, dis: 'chlorine',
           layers: [L('fine', 30), L('cloth', 1), L('charcoal', 5), L('coarse', 4), L('gravel', 5)] } },
    bottle: { fr: 'Filtre bouteille classique', en: 'Classic bottle filter',
      s: { source: 'river', container: 'bottle', persons: 5, settle: false, moringa: false, clothPre: false, raised: false, mature: false, dis: 'none',
           layers: [L('gravel', 3), L('coarse', 4), L('fine', 5), L('charcoal', 3), L('cloth', 2)] } },
    biosand: { fr: 'Biosable standard (CAWST)', en: 'Standard biosand (CAWST)',
      s: { source: 'openwell', container: 'drum60', persons: 5, settle: true, moringa: false, clothPre: false, raised: true, mature: true, dis: 'chlorine',
           layers: [L('fine', 35), L('coarse', 5), L('gravel', 5)] } },
    kanchan: { fr: 'Version Asie du Sud (arsenic)', en: 'South Asia version (arsenic)',
      s: { source: 'arsenic', container: 'drum60', persons: 5, settle: false, moringa: false, clothPre: true, raised: true, mature: true, dis: 'chlorine',
           layers: [L('iron', 5), L('fine', 30), L('coarse', 5), L('gravel', 5)] } },
    chlorineOnly: { fr: 'Chlore seul sur eau trouble', en: 'Chlorine only on muddy water',
      s: { source: 'river', container: 'bucket', persons: 5, settle: false, moringa: false, clothPre: false, raised: false, mature: false, dis: 'chlorine',
           layers: [] } },
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let S = clone(PRESETS.mayipeto.s);
  let activePreset = 'mayipeto';

  // Lecture d'une configuration partagée dans l'URL (#simulateur?c=...)
  try {
    const m = location.hash.match(/[?&]c=([^&]+)/);
    if (m) {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if (parsed && Array.isArray(parsed.layers) && CONT[parsed.container] && SRC[parsed.source]) {
        parsed.layers = parsed.layers.filter((l) => MAT[l.m]).slice(0, 8);
        S = Object.assign(clone(PRESETS.mayipeto.s), parsed);
        activePreset = null;
      }
    }
  } catch (e) { /* lien invalide : on garde le préréglage */ }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sat = (h, k) => 1 - Math.exp(-h / k);

  // =====================================================================
  // MODÈLE
  // =====================================================================
  function compute(s) {
    const c = CONT[s.container], src = SRC[s.source];
    const lay = s.layers;
    const msgs = [];
    const E = (fr, en) => msgs.push({ k: 'e', txt: t(fr, en) });
    const W = (fr, en) => msgs.push({ k: 'w', txt: t(fr, en) });
    const G = (fr, en) => msgs.push({ k: 'g', txt: t(fr, en) });

    const bed = lay.reduce((a, l) => a + l.h, 0);
    const usable = c.H - c.head - (s.raised ? 5 : 0);
    const tot = {}; ORDER.forEach((m) => (tot[m] = 0));
    lay.forEach((l) => (tot[l.m] += l.h));

    // ----- Débit (Darcy) -----
    let q = null, v = null, cf = 1;
    if (lay.length) {
      const R = lay.reduce((a, l) => a + l.h / MAT[l.m].K, 0);
      const dh = c.head + (s.raised ? 0 : bed);
      q = c.A * dh / Math.max(R, 0.05); // cm³/min
      if (s.mature) q *= 0.8;           // le biofilm freine un peu
      v = q / c.A;                       // vitesse de filtration (cm/min)
      cf = clamp(0.9 / v, 0.35, 1);      // facteur de temps de contact
    }

    // ----- Biofilm (schmutzdecke) -----
    // se forme sur la première couche de sable fin, si le filtre est mûr ET le sable reste immergé
    let bioIdx = -1;
    for (let i = 0; i < lay.length; i++) {
      if (lay[i].m === 'fine') { bioIdx = i; break; }
      if (!['gravel', 'cloth', 'iron'].includes(lay[i].m)) break;
    }
    const bio = s.mature && s.raised && bioIdx >= 0;

    // ----- Contributions par matériau puis réparties par couche -----
    const fd = tot.fine, cd = tot.coarse, ch = tot.charcoal, ir = tot.iron;
    const nCloth = lay.filter((l) => l.m === 'cloth').length;
    const matLog = {
      fine:     { b: 2.0 * sat(fd, 15) * cf, v: 0.5 * sat(fd, 15) * cf, p: 2.5 * sat(fd, 12) * Math.min(1, cf * 1.3) },
      coarse:   { b: 0.25 * sat(cd, 8) * cf, v: 0.05 * sat(cd, 8), p: 0.5 * sat(cd, 8) },
      charcoal: { b: 0.15 * sat(ch, 5), v: 0.1 * sat(ch, 5), p: 0.1 * sat(ch, 5) },
      cloth:    { b: 0.05 * Math.min(nCloth, 2), v: 0, p: 0.3 * Math.min(nCloth, 2) },
      gravel:   { b: 0.02 * sat(tot.gravel, 5), v: 0, p: 0.05 * sat(tot.gravel, 5) },
      iron:     { b: 0.1 * sat(ir, 3), v: 0.1 * sat(ir, 3), p: 0 },
    };
    const perLayer = lay.map((l) => {
      const share = tot[l.m] ? l.h / tot[l.m] : 0;
      const ml = matLog[l.m];
      const o = { b: ml.b * share, v: ml.v * share, p: ml.p * share, tx: MAT[l.m].turb * l.h * Math.sqrt(cf) };
      return o;
    });
    if (bio) {
      const pl = perLayer[bioIdx];
      pl.b = pl.b * 1.45; pl.v = pl.v * 2.2; pl.p += 0.7; pl.tx += 0.8;
    }
    const filt = perLayer.reduce((a, x) => ({ b: a.b + x.b, v: a.v + x.v, p: a.p + x.p, tx: a.tx + x.tx }), { b: 0, v: 0, p: 0, tx: 0 });

    // ----- Pré-traitement -----
    let ntu = src.ntu, pre = { b: 0, v: 0, p: 0 };
    if (s.settle) { ntu *= 0.5; pre.b += 0.3; pre.v += 0.1; pre.p += 0.3; }
    if (s.moringa) {
      if (s.settle) { ntu *= 0.12; pre.b += 0.8; pre.v += 0.3; pre.p += 0.5; }
      else { ntu *= 0.4; pre.b += 0.3; pre.v += 0.1; pre.p += 0.2; }
    }
    if (s.clothPre) { ntu *= 0.75; pre.b += 0.3; pre.v += 0.1; pre.p += 0.5; }
    const ntuPre = ntu;
    let ntuOut = ntuPre * Math.exp(-filt.tx);
    // pas de support en bas : du sable part avec l'eau
    const bottom = lay.length ? lay[lay.length - 1].m : null;
    const noSupport = lay.length && !['gravel', 'cloth'].includes(bottom);
    if (noSupport) ntuOut += 5;

    // ----- Désinfection -----
    let dis = { b: 0, v: 0, p: 0 }, eff = 1;
    if (s.dis === 'sodis') { eff = ntuOut <= 30 ? 1 : 0.4; dis = { b: 3 * eff, v: 2.5 * eff, p: 1.5 * eff }; }
    if (s.dis === 'chlorine') { eff = ntuOut <= 5 ? 1 : (ntuOut <= 20 ? 0.6 : 0.3); dis = { b: 3.5 * eff, v: 3 * eff, p: 0.3 }; }
    if (s.dis === 'boil') { dis = { b: 6, v: 6, p: 6 }; }

    const logs = {
      b: pre.b + filt.b + dis.b,
      v: pre.v + filt.v + dis.v,
      p: pre.p + filt.p + dis.p,
    };
    const stars = (logs.b >= 4 && logs.v >= 5 && logs.p >= 4) ? 2 : (logs.b >= 2 && logs.v >= 3 && logs.p >= 2) ? 1 : 0;
    const ecoli = Math.pow(10, src.ec - logs.b);

    // ----- Goût / arsenic -----
    const taste = sat(ch, 4);
    const asRem = 0.95 * sat(ir, 1.5);
    const asOut = src.as * (1 - asRem);

    // ----- Coûts -----
    let cost = c.cost + c.extra;
    lay.forEach((l) => { cost += (c.A * l.h / 1000) * MAT[l.m].costL + (MAT[l.m].fixed || 0); });
    if (s.settle) cost += 2;
    if (s.moringa) cost += 0.2;
    if (s.clothPre) cost += 0.5;
    let monthly = 0;
    if (s.dis === 'chlorine') { cost += 0.5; monthly += 0.5; }
    if (s.dis === 'boil') monthly += 8;
    if (ch) monthly += ((c.A * ch / 1000) * MAT.charcoal.costL) / 4;

    // ----- Volume -----
    const lph = q != null ? q * 60 / 1000 : null;
    const need = (s.persons || 1) * 7.5;

    // ----- Messages de conception -----
    if (!lay.length) E('Aucune couche filtrante : l\'eau n\'est pas filtrée.', 'No filter layers: the water is not filtered.');
    if (bed > usable) E(`Les couches (${bed} cm) dépassent la hauteur disponible (${usable} cm) : réduisez-les ou prenez un plus grand contenant.`,
                         `Layers (${bed} cm) exceed the available height (${usable} cm): reduce them or use a bigger container.`);
    if (noSupport) W('Pas de couche de support en bas (gravier ou tissu) : le sable risque de partir par la sortie.',
                     'No support layer at the bottom (gravel or cloth): sand may wash out through the outlet.');
    for (let i = 0; i < lay.length - 1; i++) {
      if (lay[i].m === 'fine' && lay[i + 1].m === 'gravel') {
        W('Sable fin posé directement sur le gravier : les grains migrent. Ajoutez du sable grossier ou un tissu entre les deux.',
          'Fine sand directly on gravel: the grains migrate. Add coarse sand or cloth in between.');
        break;
      }
    }
    if (lay.length && lay[0].m === 'charcoal') W('Charbon tout en haut : il flotte et se colmate. Placez-le sous le sable fin.',
                                                 'Charcoal on top floats and clogs. Put it under the fine sand.');
    if (lay.length && fd < 15) W('Couche de sable fin trop mince (moins de 15 cm) : faible élimination des germes.',
                                 'Fine sand layer too thin (under 15 cm): weak germ removal.');
    if (v != null && v > 1.2) W(`Filtration trop rapide (${v.toFixed(1)} cm/min) : le temps de contact est insuffisant. Visez moins de 1 cm/min.`,
                                `Filtration too fast (${v.toFixed(1)} cm/min): not enough contact time. Aim for under 1 cm/min.`);
    if (s.mature && !s.raised && lay.length) W('Sans sortie surélevée, le sable sèche entre deux usages et le biofilm meurt.',
                                              'Without a raised outlet, the sand dries between uses and the biofilm dies.');
    if (s.moringa && !s.settle) W('Moringa sans décantation : les flocs n\'ont pas le temps de tomber. Laissez reposer 1–2 h.',
                                  'Moringa without settling: the flocs have no time to sink. Let it rest 1–2 h.');
    if (s.dis === 'none') E('Pas de désinfection : selon l\'OMS, une eau filtrée n\'est pas garantie potable (virus en particulier).',
                            'No disinfection: according to WHO, filtered water is not guaranteed safe (viruses in particular).');
    if (s.dis === 'sodis' && ntuOut > 30) W('Eau trop trouble pour le SODIS (plus de 30 NTU) : les UV pénètrent mal.',
                                            'Water too turbid for SODIS (over 30 NTU): UV light barely gets through.');
    if (s.dis === 'chlorine' && ntuOut > 5) W('Eau trouble : le chlore est en partie consommé par les particules. Il faut filtrer d\'abord.',
                                              'Turbid water: particles use up part of the chlorine. Filter first.');
    if (s.dis === 'boil') W('Ébullition efficace, mais elle coûte du combustible (bois, makala) et contribue à la déforestation.',
                            'Boiling works, but it costs fuel (wood, makala) and adds to deforestation.');
    if (src.as && asOut > 10) E(`Arsenic ≈ ${asOut.toFixed(0)} µg/L, au-dessus de la valeur guide OMS (10 µg/L). Le sable et le charbon ne l'éliminent pas : ajoutez des clous de fer et faites tester.`,
                                `Arsenic ≈ ${asOut.toFixed(0)} µg/L, above the WHO guideline (10 µg/L). Sand and charcoal do not remove it: add iron nails and get it tested.`);
    if (lph != null && lph * 6 < need) W(`Débit faible pour ${s.persons} personnes : plus de 6 h de filtration par jour seraient nécessaires.`,
                                         `Low flow for ${s.persons} people: more than 6 h of filtering per day would be needed.`);
    if (bio) G('Biofilm actif : sable immergé et filtre mûr.', 'Active biofilm: submerged sand and mature filter.');
    if (s.raised && lay.length) G('Sortie surélevée : le sable ne sèche jamais.', 'Raised outlet: the sand never dries out.');
    if (s.settle && s.moringa) G('Décantation au moringa : forte baisse de la turbidité.', 'Moringa settling: strong drop in turbidity.');
    if (ch) G('Charbon : meilleur goût et moins d\'odeur.', 'Charcoal: better taste and less smell.');
    if (src.as && ir && asOut <= 10) G('Clous de fer : arsenic sous la valeur guide OMS (à confirmer par analyse).', 'Iron nails: arsenic below the WHO guideline (to be confirmed by testing).');

    return { c, src, bed, usable, q, v, cf, lph, need, bio, bioIdx, perLayer, filt, pre, dis, logs, stars, ecoli, ntuPre, ntuOut,
             taste, asOut, cost, monthly, msgs };
  }

  // =====================================================================
  // INTERFACE : panneau de contrôle
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  function opt(obj, sel) {
    return Object.keys(obj).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t(obj[k].fr, obj[k].en)}</option>`).join('');
  }

  function renderPresets() {
    const el = $('sim-presets');
    el.innerHTML = `<span class="small muted" style="align-self:center;margin-right:4px">${t('Préréglages :', 'Presets:')}</span>` +
      Object.keys(PRESETS).map((k) => `<button type="button" class="btn small ${k === activePreset ? '' : 'ghost'}" data-p="${k}">${t(PRESETS[k].fr, PRESETS[k].en)}</button>`).join('');
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      S = clone(PRESETS[b.dataset.p].s); activePreset = b.dataset.p; renderAll();
    }));
  }

  function renderControls() {
    const el = $('sim-controls');
    const c = CONT[S.container];
    const usable = c.H - c.head - (S.raised ? 5 : 0);
    el.innerHTML = `
      <div class="sec">
        <h3>${t('1. Eau de départ', '1. Raw water')}</h3>
        <label class="fld" for="s-src">${t('Source', 'Source')}</label>
        <select id="s-src">${opt(SRC, S.source)}</select>
        <label class="fld" for="s-cont" style="margin-top:8px">${t('Contenant du filtre', 'Filter container')}</label>
        <select id="s-cont">${opt(CONT, S.container)}</select>
        <label class="fld" for="s-pers" style="margin-top:8px">${t('Personnes dans le foyer', 'People in the household')}</label>
        <input type="number" id="s-pers" min="1" max="200" value="${S.persons}">
      </div>
      <div class="sec">
        <h3>${t('2. Pré-traitement', '2. Pre-treatment')}</h3>
        <div class="checks">
          <label><input type="checkbox" id="s-settle" ${S.settle ? 'checked' : ''}> ${t('Décantation 1–2 h (seau)', 'Settling 1–2 h (bucket)')}</label>
          <label><input type="checkbox" id="s-mor" ${S.moringa ? 'checked' : ''}> ${t('Graines de moringa (coagulant)', 'Moringa seeds (coagulant)')}</label>
          <label><input type="checkbox" id="s-cpre" ${S.clothPre ? 'checked' : ''}> ${t('Pagne plié en 4 (pré-filtre)', 'Cloth folded ×4 (pre-filter)')}</label>
        </div>
      </div>
      <div class="sec">
        <h3>${t('3. Couches (de haut en bas)', '3. Layers (top to bottom)')}</h3>
        <div class="palette">${ORDER.map((m) => `<button type="button" data-add="${m}"><span class="swatch" style="background:${MAT[m].sw}"></span>+ ${t(MAT[m].s[0], MAT[m].s[1])}</button>`).join('')}</div>
        <ul class="layers" id="s-layers">${S.layers.map((l, i) => {
          const M = MAT[l.m];
          const mx = Math.max(M.min, Math.min(M.max, l.m === 'fine' ? Math.max(usable, 10) : M.max));
          return `<li draggable="true" data-i="${i}">
            <span class="swatch" style="background:${M.sw}"></span>
            <div><div class="nm">${t(M.fr, M.en)} <span class="h" id="h-${i}">${l.h} cm</span></div>
            <input type="range" min="${M.min}" max="${mx}" value="${Math.min(l.h, mx)}" data-r="${i}" aria-label="${t('Épaisseur', 'Thickness')} ${t(M.fr, M.en)}"></div>
            <div class="ctrl"><button type="button" data-up="${i}" title="${t('Monter', 'Move up')}" aria-label="${t('Monter', 'Move up')}">↑</button><button type="button" data-dn="${i}" title="${t('Descendre', 'Move down')}" aria-label="${t('Descendre', 'Move down')}">↓</button><button type="button" data-rm="${i}" title="${t('Retirer', 'Remove')}" aria-label="${t('Retirer', 'Remove')}">✕</button></div>
          </li>`; }).join('')}</ul>
        ${S.layers.length ? '' : `<p class="small muted" style="margin:8px 0 0">${t('Ajoutez des couches avec les boutons ci-dessus.', 'Add layers with the buttons above.')}</p>`}
        <p class="small muted" style="margin:8px 0 0">${t('Hauteur disponible', 'Available height')} : <b>${usable} cm</b></p>
      </div>
      <div class="sec">
        <h3>${t('4. Options', '4. Options')}</h3>
        <div class="checks">
          <label><input type="checkbox" id="s-raised" ${S.raised ? 'checked' : ''}> ${t('Sortie surélevée (sable toujours immergé)', 'Raised outlet (sand always submerged)')}</label>
          <label><input type="checkbox" id="s-mature" ${S.mature ? 'checked' : ''}> ${t('Filtre mûr (plus de 3 semaines d\'usage)', 'Mature filter (over 3 weeks of use)')}</label>
        </div>
      </div>
      <div class="sec">
        <h3>${t('5. Désinfection finale', '5. Final disinfection')}</h3>
        <div class="seg" id="s-dis">${Object.keys(DIS).map((k) => `<button type="button" data-d="${k}" class="${S.dis === k ? 'on' : ''}">${t(DIS[k].fr, DIS[k].en)}</button>`).join('')}</div>
      </div>
      <div class="sec no-print">
        <button type="button" class="btn small ghost" id="s-share">🔗 ${t('Copier le lien de cette configuration', 'Copy a link to this setup')}</button>
        <span class="small muted" id="s-share-msg" style="margin-left:6px"></span>
      </div>`;

    const changed = (structural) => { activePreset = null; if (structural) renderAll(); else { renderPresets(); update(); } };
    $('s-src').addEventListener('change', (e) => { S.source = e.target.value; changed(false); });
    $('s-cont').addEventListener('change', (e) => { S.container = e.target.value; changed(true); });
    $('s-pers').addEventListener('input', (e) => { S.persons = clamp(parseInt(e.target.value, 10) || 1, 1, 200); changed(false); });
    $('s-settle').addEventListener('change', (e) => { S.settle = e.target.checked; changed(false); });
    $('s-mor').addEventListener('change', (e) => { S.moringa = e.target.checked; changed(false); });
    $('s-cpre').addEventListener('change', (e) => { S.clothPre = e.target.checked; changed(false); });
    $('s-raised').addEventListener('change', (e) => { S.raised = e.target.checked; changed(true); });
    $('s-mature').addEventListener('change', (e) => { S.mature = e.target.checked; changed(false); });
    el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { S.dis = b.dataset.d; changed(true); }));
    el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      if (S.layers.length >= 8) return;
      const m = b.dataset.add;
      S.layers.unshift({ m, h: MAT[m].def });
      changed(true);
    }));
    el.querySelectorAll('[data-r]').forEach((r) => r.addEventListener('input', () => {
      const i = +r.dataset.r; S.layers[i].h = +r.value;
      $('h-' + i).textContent = r.value + ' cm';
      changed(false);
    }));
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= S.layers.length) return; [S.layers[i], S.layers[j]] = [S.layers[j], S.layers[i]]; changed(true); };
    el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(+b.dataset.up, -1)));
    el.querySelectorAll('[data-dn]').forEach((b) => b.addEventListener('click', () => move(+b.dataset.dn, 1)));
    el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { S.layers.splice(+b.dataset.rm, 1); changed(true); }));

    // glisser-déposer pour réordonner (ordinateur)
    let dragI = null;
    el.querySelectorAll('#s-layers li').forEach((li) => {
      li.addEventListener('dragstart', (e) => { if (e.target.tagName === 'INPUT') { e.preventDefault(); return; } dragI = +li.dataset.i; e.dataTransfer.effectAllowed = 'move'; });
      li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault(); li.classList.remove('drag-over');
        const to = +li.dataset.i;
        if (dragI == null || dragI === to) return;
        const [it] = S.layers.splice(dragI, 1); S.layers.splice(to, 0, it); dragI = null; changed(true);
      });
    });
    // les curseurs ne doivent pas déclencher le glisser
    el.querySelectorAll('#s-layers input[type=range]').forEach((r) => { r.addEventListener('mousedown', (e) => e.stopPropagation()); r.setAttribute('draggable', 'false'); });

    $('s-share').addEventListener('click', () => {
      const code = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(S)))));
      const url = location.origin + location.pathname + '#simulateur?c=' + code;
      const msg = $('s-share-msg');
      const done = () => { msg.textContent = t('Lien copié ✓', 'Link copied ✓'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { prompt('URL', url); });
      else prompt('URL', url);
    });
  }

  // =====================================================================
  // INTERFACE : résultats
  // =====================================================================
  function meter(label, val, max, mk1, mk2, color) {
    const pct = clamp(val / max * 100, 0, 100);
    return `<div class="meter"><div class="top"><span>${label}</span><span>${val.toFixed(1)} log <span class="muted small">(${t('÷', '÷')}${fmtFactor(val)})</span></span></div>
      <div class="bar"><div class="fill" style="width:${pct}%;background:${color}"></div>
      <span class="mk" style="left:${mk1 / max * 100}%" title="★"></span><span class="mk mk2" style="left:${mk2 / max * 100}%" title="★★"></span></div></div>`;
  }
  function fmtFactor(lg) {
    if (lg < 0.05) return '1';
    const f = Math.pow(10, Math.min(lg, 7));
    if (f >= 1e6) return t('1 million+', '1 million+');
    if (f >= 1000) return Math.round(f).toLocaleString(MP.lang());
    return f < 10 ? f.toFixed(1) : Math.round(f).toString();
  }
  function riskClass(ec) {
    if (ec < 1) return ['ok', t('Conforme (< 1 / 100 mL)', 'Compliant (< 1 / 100 mL)')];
    if (ec < 10) return ['warn', t('Risque faible', 'Low risk')];
    if (ec < 100) return ['warn', t('Risque intermédiaire', 'Intermediate risk')];
    if (ec < 1000) return ['bad', t('Risque élevé', 'High risk')];
    return ['bad', t('Risque très élevé', 'Very high risk')];
  }
  const fmtN = (x) => (x >= 100 ? Math.round(x).toLocaleString(MP.lang()) : x >= 10 ? x.toFixed(0) : x.toFixed(1));

  function renderResults(r) {
    const el = $('sim-results');
    const v = r.stars === 2 ? ['v2', t('★★ Très protecteur', '★★ Highly protective'), t('Atteint les cibles « très protectrices » de l\'OMS (modèle).', 'Meets WHO “highly protective” targets (model).')]
      : r.stars === 1 ? ['v1', t('★ Protecteur', '★ Protective'), t('Atteint les cibles « protectrices » de l\'OMS (modèle). À confirmer par analyse.', 'Meets WHO “protective” targets (model). To be confirmed by testing.')]
      : ['v0', t('Non protecteur', 'Not protective'), t('N\'atteint pas les cibles minimales de l\'OMS : l\'eau reste à risque.', 'Does not meet minimum WHO targets: the water is still risky.')];
    const rc = riskClass(r.ecoli);
    const ntuTag = r.ntuOut < 1 ? 'ok' : r.ntuOut < 5 ? 'warn' : 'bad';
    const fill = (lg, need) => (lg >= need ? 'var(--ok)' : lg >= need * 0.6 ? 'var(--warn)' : 'var(--bad)');
    const timeFor20 = r.lph ? 20 / r.lph : null;
    const hoursNeed = r.lph ? r.need / r.lph : null;
    const fmtT = (h) => (h < 1 ? Math.round(h * 60) + ' min' : h.toFixed(1).replace('.', MP.lang() === 'fr' ? ',' : '.') + ' h');

    el.innerHTML = `
      <div class="verdict ${v[0]}"><div class="t">${v[1]}</div><div class="small">${v[2]}</div></div>
      <h3>${t('Germes', 'Germs')}</h3>
      <div class="kv"><span>${t('E. coli estimé à la sortie', 'Estimated E. coli at outlet')}</span><b>${r.ecoli < 1 ? '< 1' : fmtN(r.ecoli)} /100 mL</b></div>
      <div style="margin-bottom:6px"><span class="tag ${rc[0]}">${rc[1]}</span> <span class="small muted">${t('entrée', 'input')} ≈ ${fmtN(Math.pow(10, r.src.ec))}</span></div>
      ${meter(t('Bactéries', 'Bacteria'), r.logs.b, 7, 2, 4, fill(r.logs.b, 2))}
      ${meter(t('Virus', 'Viruses'), r.logs.v, 7, 3, 5, fill(r.logs.v, 3))}
      ${meter(t('Protozoaires', 'Protozoa'), r.logs.p, 7, 2, 4, fill(r.logs.p, 2))}
      <p class="small muted" style="margin:0">${t('Repères : trait gris = ★, trait vert = ★★ (OMS).', 'Markers: grey line = ★, green line = ★★ (WHO).')}</p>
      <div class="sec" style="margin-top:10px">
        <h3>${t('Turbidité', 'Turbidity')}</h3>
        <div class="kv"><span>${t('Source → après pré-traitement', 'Source → after pre-treatment')}</span><b>${fmtN(r.src.ntu)} → ${fmtN(r.ntuPre)} NTU</b></div>
        <div class="kv"><span>${t('Sortie du filtre', 'Filter outlet')}</span><b><span class="tag ${ntuTag}">${r.ntuOut < 0.1 ? '< 0.1' : fmtN(r.ntuOut)} NTU</span></b></div>
        <p class="small muted" style="margin:0">${t('Idéal OMS < 1 NTU ; < 5 NTU pour l\'acceptabilité.', 'WHO ideal < 1 NTU; < 5 NTU for acceptability.')}</p>
        ${r.taste > 0.05 ? `<div class="kv"><span>${t('Goût / odeur', 'Taste / smell')}</span><b>${r.taste > 0.6 ? t('nettement amélioré', 'clearly improved') : t('un peu amélioré', 'slightly improved')}</b></div>` : ''}
        ${r.src.as ? `<div class="kv"><span>${t('Arsenic sortie', 'Arsenic outlet')}</span><b><span class="tag ${r.asOut <= 10 ? 'ok' : 'bad'}">${r.asOut.toFixed(0)} µg/L</span></b></div>` : ''}
      </div>
      <div class="sec">
        <h3>${t('Débit et volume', 'Flow and volume')}</h3>
        ${r.lph != null ? `
        <div class="kv"><span>${t('Débit', 'Flow')}</span><b>${r.lph.toFixed(1)} L/h (${(r.q / 1000).toFixed(2)} L/min)</b></div>
        <div class="kv"><span>${t('Temps pour 20 L', 'Time for 20 L')}</span><b>${fmtT(timeFor20)}</b></div>
        <div class="kv"><span>${t('Besoin du foyer', 'Household need')} (${S.persons} × 7,5 L)</span><b>${r.need.toFixed(0)} L/${t('jour', 'day')}</b></div>
        <div class="kv"><span>${t('Filtration nécessaire', 'Filtering needed')}</span><b>${fmtT(hoursNeed)}/${t('jour', 'day')}</b></div>` : `<p class="small muted">${t('Pas de filtre : pas de débit à calculer.', 'No filter: no flow to compute.')}</p>`}
      </div>
      <div class="sec">
        <h3>${t('Coût indicatif', 'Indicative cost')}</h3>
        <div class="kv"><span>${t('Investissement', 'Upfront')}</span><b>≈ ${r.cost.toFixed(2)} $</b></div>
        <div class="kv"><span>${t('Fonctionnement', 'Running')}</span><b>≈ ${r.monthly.toFixed(2)} $/${t('mois', 'month')}</b></div>
      </div>
      <div class="sec">
        <h3>${t('Analyse de la conception', 'Design check')}</h3>
        <ul class="msgs">${r.msgs.map((m) => `<li class="${m.k}">${m.txt}</li>`).join('') || `<li class="g">${t('Rien à signaler.', 'Nothing to report.')}</li>`}</ul>
      </div>`;
  }

  // =====================================================================
  // VISUALISATION SVG + particules
  // =====================================================================
  const NS = 'http://www.w3.org/2000/svg';
  let geo = null;          // géométrie courante
  let parts = [];          // particules actives
  let lastR = null;

  function mix(a, b, k) {
    const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16)), pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
    return '#' + pa.map((x, i) => Math.round(x + (pb[i] - x) * k).toString(16).padStart(2, '0')).join('');
  }
  const waterColor = (ntu) => mix('8fd3ef', '8a6239', clamp(Math.log10(ntu + 1) / 2.3, 0, 1));

  function renderViz(r) {
    const svg = $('sim-svg');
    const c = r.c;
    const H = 400, top = 40, cx = 150, w = c.w;
    const sc = H / c.H;                        // px par cm
    const x0 = cx - w / 2, x1 = cx + w / 2, bottomY = top + H;
    const lay = S.layers;
    // positions des couches (du bas vers le haut)
    let y = bottomY; const ys = [];
    for (let i = lay.length - 1; i >= 0; i--) { const hpx = lay[i].h * sc; ys[i] = { y0: y - hpx, y1: y }; y -= hpx; }
    const bedTop = y;
    const outletY = S.raised ? bedTop - 5 * sc : bottomY;
    const maxFillY = top + (c.head + (S.raised ? 5 : 0)) * sc; // niveau max du lit
    const glassX = S.raised ? 300 : cx, glassY = 478;
    const preColor = waterColor(r.ntuPre);
    const outColor = waterColor(r.ntuOut);
    let s = '';
    // règle graduée
    const rx = x0 - 26;
    s += `<line x1="${rx}" y1="${top}" x2="${rx}" y2="${bottomY}" stroke="var(--muted)" stroke-width="1"/>`;
    const step = c.H > 40 ? 10 : 5;
    for (let cm = 0; cm <= c.H; cm += step) {
      const yy = bottomY - cm * sc;
      s += `<line x1="${rx - 4}" y1="${yy}" x2="${rx}" y2="${yy}" stroke="var(--muted)"/><text x="${rx - 6}" y="${yy + 3}" font-size="9" text-anchor="end" fill="var(--muted)">${cm}</text>`;
    }
    s += `<text x="${rx}" y="${top - 10}" font-size="9" text-anchor="middle" fill="var(--muted)">cm</text>`;
    // contenant
    const isBottle = S.container === 'bottle';
    s += `<rect x="${x0 - 6}" y="${top - 6}" width="${w + 12}" height="${H + 12}" rx="${isBottle ? 18 : 8}" fill="${isBottle ? '#cfeaf5' : 'url(#g-drum)'}" opacity="${isBottle ? .55 : 1}"/>`;
    s += `<rect x="${x0}" y="${top}" width="${w}" height="${H}" fill="var(--surface)"/>`;
    // eau brute au-dessus du lit
    const waterTop = top + 4;
    if (bedTop > waterTop) s += `<rect x="${x0}" y="${waterTop}" width="${w}" height="${bedTop - waterTop}" fill="${preColor}" opacity=".75"/>`;
    // eau stagnante (sortie surélevée) en plus clair
    if (S.raised && lay.length) s += `<rect x="${x0}" y="${outletY}" width="${w}" height="${bedTop - outletY}" fill="url(#g-water)" opacity=".6"/>`;
    // couches
    lay.forEach((l, i) => {
      const g = ys[i]; const hpx = g.y1 - g.y0;
      s += `<rect x="${x0}" y="${g.y0}" width="${w}" height="${hpx}" fill="url(#${MAT[l.m].pat})"/>`;
      if (hpx >= 13) {
        const dark = ['charcoal', 'iron', 'gravel'].includes(l.m);
        s += `<text x="${cx}" y="${g.y0 + hpx / 2 + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${dark ? '#fff' : '#3a2a12'}" style="paint-order:stroke" stroke="${dark ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.6)'}" stroke-width="3">${t(MAT[l.m].s[0], MAT[l.m].s[1])} · ${l.h} cm</text>`;
      }
    });
    if (r.bio && r.bioIdx >= 0) s += `<rect x="${x0}" y="${ys[r.bioIdx].y0}" width="${w}" height="4" fill="url(#p-bio)"/>`;
    // dépassement
    if (lay.length && bedTop < maxFillY) {
      s += `<line x1="${x0 - 8}" y1="${maxFillY}" x2="${x1 + 8}" y2="${maxFillY}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="5 4"/>`;
      s += `<text x="${x1 + 10}" y="${maxFillY - 4}" font-size="10" fill="var(--bad)" font-weight="700">${t('max', 'max')}</text>`;
    }
    // sortie
    if (S.raised) {
      const py = bottomY - 6;
      s += `<path d="M${x1} ${py} H${x1 + 22} V${outletY} H${glassX} V${glassY - 16}" fill="none" stroke="#e6e1d3" stroke-width="7" stroke-linejoin="round"/>`;
      s += `<path d="M${x1} ${py} H${x1 + 22} V${outletY} H${glassX} V${glassY - 16}" fill="none" stroke="#7d7d7d" stroke-width="1" stroke-linejoin="round" opacity=".6"/>`;
      s += `<text x="${x1 + 26}" y="${outletY - 6}" font-size="10" fill="var(--muted)">${t('sortie surélevée', 'raised outlet')}</text>`;
    } else {
      s += `<rect x="${cx - 8}" y="${bottomY + 6}" width="16" height="${isBottle ? 18 : 12}" rx="3" fill="${isBottle ? '#2e86b5' : '#7d7d7d'}"/>`;
    }
    // couvercle
    if (!isBottle) s += `<rect x="${x0 - 10}" y="${top - 14}" width="${w + 20}" height="10" rx="4" fill="#155a79"/>`;
    // verre
    s += `<path d="M${glassX - 22} ${glassY} L${glassX + 22} ${glassY} L${glassX + 17} ${glassY + 58} L${glassX - 17} ${glassY + 58} Z" fill="var(--surface-2)" stroke="var(--muted)" stroke-width="1.5"/>`;
    s += `<path d="M${glassX - 19.5} ${glassY + 16} L${glassX + 19.5} ${glassY + 16} L${glassX + 17} ${glassY + 58} L${glassX - 17} ${glassY + 58} Z" fill="${outColor}" opacity=".9"/>`;
    // germes restants dans le verre (indicatif)
    const nGerm = r.ecoli >= 1000 ? 6 : r.ecoli >= 100 ? 4 : r.ecoli >= 10 ? 2 : r.ecoli >= 1 ? 1 : 0;
    for (let k = 0; k < nGerm; k++) s += `<circle cx="${glassX - 12 + (k * 37 % 24)}" cy="${glassY + 26 + (k * 13 % 26)}" r="2.6" fill="#e0457b"/>`;
    // désinfection
    if (S.dis === 'sodis') s += `<g transform="translate(${glassX + 34} ${glassY + 4})"><circle r="9" fill="#f2b83a"/><g stroke="#f2a33a" stroke-width="2"><line x1="0" y1="-15" x2="0" y2="-11"/><line x1="15" y1="0" x2="11" y2="0"/><line x1="-15" y1="0" x2="-11" y2="0"/><line x1="0" y1="15" x2="0" y2="11"/></g></g>`;
    if (S.dis === 'chlorine') s += `<g transform="translate(${glassX + 34} ${glassY + 6})"><rect x="-9" y="-9" width="18" height="18" rx="9" fill="#e8f6fb" stroke="#2e86b5"/><text y="4" font-size="10" text-anchor="middle" font-weight="800" fill="#2e86b5">Cl</text></g>`;
    if (S.dis === 'boil') s += `<g transform="translate(${glassX + 34} ${glassY + 6})"><path d="M0 -12 C 8 -4, 6 6, 0 10 C -6 6, -8 -4, 0 -12z" fill="#e8742a"/></g>`;
    s += `<text x="${glassX}" y="${glassY + 74}" font-size="10" text-anchor="middle" fill="var(--muted)">${t('eau traitée', 'treated water')}</text>`;
    s += `<g id="sim-parts"></g>`;
    svg.innerHTML = s;

    geo = { x0, x1, cx, top, bottomY, bedTop, ys, waterTop, outletY, glassX, glassY, raised: S.raised };
    parts = [];
    lastR = r;
  }

  // Probabilités de capture par couche
  function captureProb(r, i, kind) {
    const pl = r.perLayer[i];
    if (kind === 'mud') return 1 - Math.exp(-pl.tx);
    return 1 - Math.pow(10, -pl.b);
  }

  let rafId = null, lastT = 0, spawnAcc = 0;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function spawn() {
    const g = geo, r = lastR;
    if (!g || !r) return;
    const roll = Math.random();
    // la part de boue dépend de la turbidité après pré-traitement
    const mudShare = clamp(0.15 + 0.35 * Math.log10(r.ntuPre + 1) / 2.1, 0.15, 0.5);
    const kind = roll < mudShare ? 'mud' : roll < mudShare + 0.3 ? 'germ' : 'water';
    // destin de la particule
    let stopY = null;
    if (kind !== 'water') {
      for (let i = 0; i < S.layers.length; i++) {
        if (Math.random() < captureProb(r, i, kind)) {
          const ly = g.ys[i];
          stopY = ly.y0 + Math.random() * Math.min(ly.y1 - ly.y0, i === r.bioIdx && kind === 'germ' ? 6 : 1e3);
          break;
        }
      }
    }
    const el = document.createElementNS(NS, 'circle');
    el.setAttribute('r', kind === 'water' ? 2.2 : 2.6);
    el.setAttribute('fill', kind === 'mud' ? '#8a5a2b' : kind === 'germ' ? '#e0457b' : '#2f87b3');
    const layer = document.getElementById('sim-parts');
    if (!layer) return;
    layer.appendChild(el);
    parts.push({ el, kind, x: g.x0 + 6 + Math.random() * (g.x1 - g.x0 - 12), y: g.waterTop + 4 + Math.random() * 10, stopY, stage: 'bed', life: 0 });
  }

  function step(ts) {
    rafId = requestAnimationFrame(step);
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
    const g = geo, r = lastR;
    if (!g || !r) return;
    const speed = r.v == null ? 160 : 28 + 22 * Math.sqrt(clamp(r.v, 0.2, 6));
    spawnAcc += dt * (r.v == null ? 10 : 6 + 2 * Math.sqrt(clamp(r.v, 0.2, 6)));
    while (spawnAcc > 1 && parts.length < 80) { spawn(); spawnAcc -= 1; }
    if (spawnAcc > 1) spawnAcc = 0;
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      if (p.stage === 'bed') {
        const inBed = p.y > g.bedTop;
        p.y += speed * dt * (inBed ? 0.55 : 1);
        p.x += (Math.random() - 0.5) * (inBed ? 1.2 : 0.4);
        if (p.stopY != null && p.y >= p.stopY) { p.stage = 'caught'; p.y = p.stopY; }
        else if (p.y >= g.bottomY - 2) {
          p.stage = 'out';
          if (g.raised) { p.x = g.glassX; p.y = g.glassY - 16; } else { p.x = g.cx; p.y = g.bottomY + 14; }
        }
      } else if (p.stage === 'caught') {
        p.life += dt;
        p.el.setAttribute('opacity', Math.max(0, 1 - p.life / 2.5));
        if (p.life > 2.5) { p.el.remove(); parts.splice(k, 1); continue; }
      } else if (p.stage === 'out') {
        p.y += 120 * dt;
        if (p.kind === 'germ' && S.dis !== 'none' && p.y > g.glassY + 10) p.el.setAttribute('fill', '#9aa4ab');
        if (p.y > g.glassY + 44) { p.el.remove(); parts.splice(k, 1); continue; }
      }
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
    }
  }
  function startAnim() { if (rafId == null && !reduceMotion) { lastT = performance.now(); rafId = requestAnimationFrame(step); } }
  function stopAnim() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

  // =====================================================================
  function update() {
    const r = compute(S);
    renderResults(r);
    renderViz(r);
  }
  function renderAll() { renderPresets(); renderControls(); update(); }

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    MP.onLang(renderAll);
    MP.onPage.push((id) => { if (id === 'simulateur') startAnim(); else stopAnim(); });
    if (/^#simulateur/.test(location.hash)) startAnim();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAnim();
      else if (document.getElementById('p-simulateur').classList.contains('active')) startAnim();
    });
  });

  // exposé pour les tests / la console
  window.MayiPetoModel = { compute, PRESETS, MAT, CONT, SRC };
})();
