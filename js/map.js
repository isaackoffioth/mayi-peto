/* Mayi Peto — carte des points d'eau de la RDC (données OpenStreetMap) */
(function () {
  'use strict';
  const MP = window.MP;
  const t = (fr, en) => MP.t(fr, en);

  const TYPES = {
    tap:    { fr: 'Robinet / borne-fontaine', en: 'Tap / standpipe', color: '#1f77b4' },
    point:  { fr: 'Point d\'eau', en: 'Water point', color: '#12897c' },
    well:   { fr: 'Puits', en: 'Well', color: '#c2502f' },
    pump:   { fr: 'Puits avec pompe', en: 'Well with pump', color: '#8e44ad' },
    spring: { fr: 'Source', en: 'Spring', color: '#2ca02c' },
    infra:  { fr: 'Château d\'eau / station', en: 'Water tower / works', color: '#555f66' },
  };
  const ADVICE = {
    tap: ['Réseau : souvent traité, mais risque de recontamination pendant le transport et le stockage.', 'Piped: often treated, but may be recontaminated during transport and storage.'],
    point: ['Point de collecte : qualité inconnue. Traiter avant de boire.', 'Collection point: unknown quality. Treat before drinking.'],
    well: ['Puits : risque élevé s\'il est ouvert. Mayi Peto est recommandé.', 'Well: high risk if open. Mayi Peto recommended.'],
    pump: ['Pompe manuelle : souvent meilleure qualité. Vérifier les pannes et l\'arsenic ou le fer.', 'Hand pump: often better quality. Check for breakdowns and arsenic/iron.'],
    spring: ['Source : à protéger (captage, clôture). Traiter l\'eau.', 'Spring: should be protected (capping, fencing). Treat the water.'],
    infra: ['Infrastructure du réseau d\'eau.', 'Water network infrastructure.'],
  };

  let map = null, cluster = null, data = null, markers = [];
  const active = new Set(Object.keys(TYPES));
  let seasonalOnly = false;

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function popup(p) {
    const [lat, lon, k, info, id] = p;
    const T = TYPES[k];
    const i = MP.lang() === 'fr' ? 0 : 1;
    const rows = [];
    if (info.village) rows.push([t('Village', 'Village'), info.village]);
    if (info.operator) rows.push([t('Opérateur', 'Operator'), info.operator]);
    if (info.pump) rows.push([t('Pompe', 'Pump'), info.pump]);
    if (info.fee) rows.push([t('Payant', 'Fee'), info.fee]);
    if (info.potable) rows.push([t('Eau potable (déclaré)', 'Drinking water (reported)'), info.potable]);
    if (info.seasonal) rows.push([t('Saisonnier', 'Seasonal'), info.seasonal]);
    if (info.status) rows.push([t('État', 'Status'), info.status]);
    const osmType = { n: 'node', w: 'way', r: 'relation' }[id[0]];
    return `<b>${esc(info.name || t(T.fr, T.en))}</b><br><span style="color:${T.color};font-weight:700">● ${t(T.fr, T.en)}</span>
      ${rows.map((r) => `<br>${r[0]} : <b>${esc(r[1])}</b>`).join('')}
      <br><i>${ADVICE[k][i]}</i>
      <br><span style="font-size:.78em;color:#6a7f8b">${lat.toFixed(4)}, ${lon.toFixed(4)} · <a href="https://www.openstreetmap.org/${osmType}/${id.slice(1)}" target="_blank" rel="noopener">OSM</a></span>`;
  }

  function renderFilters() {
    const el = document.getElementById('map-filters');
    if (!el || !data) return;
    const counts = {};
    data.points.forEach((p) => { counts[p[2]] = (counts[p[2]] || 0) + 1; });
    el.innerHTML = Object.keys(TYPES).map((k) => `
      <label class="filter-row"><input type="checkbox" data-k="${k}" ${active.has(k) ? 'checked' : ''}>
      <span class="legend-dot" style="background:${TYPES[k].color}"></span>${t(TYPES[k].fr, TYPES[k].en)}<span class="cnt">${(counts[k] || 0).toLocaleString(MP.lang())}</span></label>`).join('');
    el.querySelectorAll('input').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) active.add(cb.dataset.k); else active.delete(cb.dataset.k);
      refresh();
    }));
    const meta = document.getElementById('map-meta');
    if (meta) meta.innerHTML = t(`Source : contributeurs OpenStreetMap (ODbL), extraction du ${data.meta.date}, ${data.meta.count.toLocaleString('fr')} points.`,
                                   `Source: OpenStreetMap contributors (ODbL), extracted ${data.meta.date}, ${data.meta.count.toLocaleString('en')} points.`);
  }

  function refresh() {
    if (!cluster) return;
    cluster.clearLayers();
    const shown = markers.filter((m) => active.has(m.p[2]) && (!seasonalOnly || m.p[3].seasonal === 'yes'));
    cluster.addLayers(shown.map((m) => m.mk));
    document.getElementById('map-count').textContent = shown.length.toLocaleString(MP.lang());
  }

  function init() {
    if (map || typeof L === 'undefined') return;
    map = L.map('map', { preferCanvas: true, worldCopyJump: false }).setView([-3.2, 23.6], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50, showCoverageOnHover: false });
    map.addLayer(cluster);

    fetch('data/waterpoints.json').then((r) => r.json()).then((d) => {
      data = d;
      markers = d.points.map((p) => {
        const T = TYPES[p[2]];
        const mk = L.circleMarker([p[0], p[1]], { radius: 6, color: '#fff', weight: 1.5, fillColor: T.color, fillOpacity: 0.95 });
        mk.bindPopup(() => popup(p));
        return { p, mk };
      });
      renderFilters();
      refresh();
    }).catch(() => {
      document.getElementById('map-count').textContent = t('erreur de chargement', 'loading error');
    });

    document.getElementById('f-seasonal').addEventListener('change', (e) => { seasonalOnly = e.target.checked; refresh(); });
    document.getElementById('locate-btn').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        map.setView(ll, 11);
        L.circleMarker(ll, { radius: 8, color: '#0b4f6c', weight: 3, fillColor: '#7cc6e3', fillOpacity: 1 }).addTo(map).bindPopup(t('Vous êtes ici', 'You are here')).openPopup();
      }, () => alert(t('Position indisponible.', 'Location unavailable.')));
    });
  }

  MP.onPage.push((id) => {
    if (id !== 'carte') return;
    init();
    setTimeout(() => map && map.invalidateSize(), 60);
  });
  document.addEventListener('DOMContentLoaded', () => { if (/^#carte/.test(location.hash)) { init(); setTimeout(() => map && map.invalidateSize(), 60); } });
  MP.onLang(() => { renderFilters(); if (map) map.closePopup(); });
})();
