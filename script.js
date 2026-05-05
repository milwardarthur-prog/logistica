// script.js

const CSV_FILE = 'dados.csv';
const REFRESH_INTERVAL = 5 * 60; // segundos

let allData = [];
let searchTerm = '';
let countdownValue = REFRESH_INTERVAL;
let countdownTimer = null;

// ─── UTILITÁRIOS ────────────────────────────────────────────────

function normalizeStr(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function cleanVal(v) {
  if (!v) return '';
  const s = v.trim();
  if (s.toLowerCase() === 'nan' || s === '') return '';
  return s;
}

function parseTime(hora) {
  if (!hora) return null;
  const m = hora.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function formatTime(hora) {
  if (!hora) return '--:--';
  const m = hora.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '--:--';
  return m[1].padStart(2,'0') + ':' + m[2];
}

// ─── DIAS DA SEMANA ──────────────────────────────────────────────

const DIAS_NOMES = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
const DIAS_ABREV = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

function getDayKey(date) {
  // Retorna string YYYY-MM-DD
  return date.toISOString().split('T')[0];
}

function getWindowDays() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const dow = today.getDay(); // 0=dom, 5=sex, 6=sab

  const days = [];

  if (dow === 5) {
    // Sexta: SEX, SÁB/DOM, SEG
    const sex  = new Date(today);
    const sab  = new Date(today); sab.setDate(today.getDate() + 1);
    const dom  = new Date(today); dom.setDate(today.getDate() + 2);
    const seg  = new Date(today); seg.setDate(today.getDate() + 3);
    days.push({ label: 'SEXTA',   date: sex,  isToday: true,  keys: [getDayKey(sex)] });
    days.push({ label: 'SÁB/DOM', date: sab,  isToday: false, keys: [getDayKey(sab), getDayKey(dom)] });
    days.push({ label: 'SEGUNDA', date: seg,  isToday: false, keys: [getDayKey(seg)] });
  } else if (dow === 6) {
    // Sábado: SÁB/DOM, SEG, TER
    const sab  = new Date(today);
    const dom  = new Date(today); dom.setDate(today.getDate() + 1);
    const seg  = new Date(today); seg.setDate(today.getDate() + 2);
    const ter  = new Date(today); ter.setDate(today.getDate() + 3);
    days.push({ label: 'SÁB/DOM', date: sab,  isToday: true,  keys: [getDayKey(sab), getDayKey(dom)] });
    days.push({ label: 'SEGUNDA', date: seg,  isToday: false, keys: [getDayKey(seg)] });
    days.push({ label: 'TERÇA',   date: ter,  isToday: false, keys: [getDayKey(ter)] });
  } else if (dow === 0) {
    // Domingo: SÁB/DOM (ontem+hoje), SEG, TER
    const sab  = new Date(today); sab.setDate(today.getDate() - 1);
    const dom  = new Date(today);
    const seg  = new Date(today); seg.setDate(today.getDate() + 1);
    const ter  = new Date(today); ter.setDate(today.getDate() + 2);
    days.push({ label: 'SÁB/DOM', date: dom,  isToday: true,  keys: [getDayKey(sab), getDayKey(dom)] });
    days.push({ label: 'SEGUNDA', date: seg,  isToday: false, keys: [getDayKey(seg)] });
    days.push({ label: 'TERÇA',   date: ter,  isToday: false, keys: [getDayKey(ter)] });
  } else {
    // Dias normais: hoje + 2 próximos
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dw = d.getDay();
      days.push({
        label: DIAS_NOMES[dw],
        date: d,
        isToday: i === 0,
        keys: [getDayKey(d)]
      });
    }
  }

  return days;
}

function getDateLabel(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── CSV PARSER ──────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detectar separador
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => normalizeStr(h));

  const idx = (name) => headers.indexOf(normalizeStr(name));
  const iDia  = idx('dia');
  const iHora = idx('hora');
  const iTipo = idx('tipo');
  const iObs  = idx('observacao');
  const iCli  = idx('cliente');
  const iCid  = idx('cidade');
  const iEqp  = idx('equipamentos');
  const iTec  = idx('tecnicos');
  const iSta  = idx('status');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const get = (idx) => idx >= 0 ? cleanVal(cols[idx]) : '';

    const dia = get(iDia);
    if (!dia) continue;

    rows.push({
      dia:          dia,
      hora:         get(iHora),
      tipo:         get(iTipo),
      observacao:   get(iObs),
      cliente:      get(iCli),
      cidade:       get(iCid),
      equipamentos: get(iEqp),
      tecnicos:     get(iTec),
      status:       get(iSta),
    });
  }
  return rows;
}

// ─── MAPEAMENTO DIA → DATA ────────────────────────────────────────

function mapDiaToDate(diaStr) {
  // Tenta interpretar o campo DIA como data (DD/MM, DD/MM/YYYY) ou nome do dia
  const s = diaStr.trim();

  // Formato DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
    return getDayKey(d);
  }
  // Formato DD/MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const now = new Date();
    const d = new Date(now.getFullYear(), parseInt(m[2])-1, parseInt(m[1]));
    return getDayKey(d);
  }
  // Nome do dia (segunda, terça, etc.)
  const norm = normalizeStr(s);
  const nomes = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const idx = nomes.findIndex(n => norm.includes(n));
  if (idx >= 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayDow = today.getDay();
    let diff = idx - todayDow;
    if (diff < 0) diff += 7;
    const d = new Date(today); d.setDate(today.getDate() + diff);
    return getDayKey(d);
  }
  return null;
}

// ─── TAGS DE TIPO ─────────────────────────────────────────────────

const TAG_MAP = {
  'entrega':    'tag-entrega',
  'retirada':   'tag-retirada',
  'instalacao': 'tag-instalacao',
  'instalação': 'tag-instalacao',
  'ac':         'tag-ac',
  'evento':     'tag-evento',
  'manutencao': 'tag-manutencao',
  'manutenção': 'tag-manutencao',
  'visita':     'tag-visita',
};

function getTagClass(tipo) {
  const n = normalizeStr(tipo);
  for (const [key, cls] of Object.entries(TAG_MAP)) {
    if (n.includes(normalizeStr(key))) return cls;
  }
  return 'tag-default';
}

function renderTags(tipoStr) {
  if (!tipoStr) return '';
  const partes = tipoStr.split(/[+,\/]/);
  return partes.map(p => {
    const t = p.trim();
    if (!t) return '';
    return `<span class="tag ${getTagClass(t)}">${t.toUpperCase()}</span>`;
  }).join('');
}

function getStatusClass(status) {
  const n = normalizeStr(status);
  if (n.includes('conclu')) return 'status-concluido';
  if (n.includes('cancel')) return 'status-cancelado';
  if (n.includes('andamento') || n.includes('progress')) return 'status-andamento';
  return 'status-pendente';
}

// ─── RENDER CARD ─────────────────────────────────────────────────

function renderCard(item) {
  const statusHtml = item.status
    ? `<span class="status-badge ${getStatusClass(item.status)}">${item.status}</span>`
    : '';

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-time">${formatTime(item.hora)}</span>
        <div class="card-tags">${renderTags(item.tipo)} ${statusHtml}</div>
      </div>
      <div class="card-client">${item.cliente || '—'}</div>
      <div class="card-meta">
        ${item.cidade        ? `<span>📍 ${item.cidade}</span>` : ''}
        ${item.equipamentos  ? `<span>⚙️ ${item.equipamentos}</span>` : ''}
        ${item.tecnicos      ? `<span>👤 ${item.tecnicos}</span>` : ''}
      </div>
      ${item.observacao ? `<div class="card-obs">${item.observacao}</div>` : ''}
    </div>
  `;
}

// ─── RENDER PAINEL ────────────────────────────────────────────────

function renderPainel(data) {
  const container = document.getElementById('painelContainer');
  const windowDays = getWindowDays();

  // Mapear dados por chave de data
  const byDate = {};
  data.forEach(item => {
    const key = mapDiaToDate(item.dia);
    if (!key) return;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(item);
  });

  // Ordenar cada dia por hora
  Object.values(byDate).forEach(arr => {
    arr.sort((a, b) => {
      const ta = parseTime(a.hora);
      const tb = parseTime(b.hora);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta - tb;
    });
  });

  // Filtro de busca
  const term = normalizeStr(searchTerm);

  container.innerHTML = '';

  windowDays.forEach(dayInfo => {
    // Coletar itens de todas as keys do dia
    let items = [];
    dayInfo.keys.forEach(k => {
      if (byDate[k]) items = items.concat(byDate[k]);
    });

    // Aplicar filtro
    if (term) {
      items = items.filter(item =>
        normalizeStr(item.cliente).includes(term) ||
        normalizeStr(item.cidade).includes(term) ||
        normalizeStr(item.equipamentos).includes(term) ||
        normalizeStr(item.tipo).includes(term)
      );
    }

    const row = document.createElement('div');
    row.className = 'day-row';

    // Label do dia
    const label = document.createElement('div');
    label.className = 'day-label' + (dayInfo.isToday ? ' today' : '');
    label.innerHTML = `
      <span class="day-name">${dayInfo.label}</span>
      <span class="day-date">${getDateLabel(dayInfo.date)}</span>
    `;
    row.appendChild(label);

    // Ticker
    const wrapper = document.createElement('div');
    wrapper.className = 'ticker-wrapper';

    const track = document.createElement('div');
    track.className = 'ticker-track';

    if (items.length === 0) {
      wrapper.innerHTML = '<span class="no-events">Nenhum evento</span>';
    } else {
      const cardsHtml = items.map(renderCard).join('');

      if (items.length <= 3) {
        track.classList.add('static');
        track.innerHTML = cardsHtml;
      } else {
        // Duplicar para loop contínuo
        track.classList.add('scrolling');
        track.innerHTML = cardsHtml + cardsHtml;

        // Velocidade: ~60px/s base, mais cards = mais rápido
        const cardWidth = 270; // px estimado por card + gap
        const totalWidth = items.length * cardWidth;
        const speed = Math.max(20, Math.min(60, 30 + items.length * 2));
        const duration = totalWidth / speed;
        track.style.animationDuration = duration + 's';
      }

      wrapper.appendChild(track);
    }

    row.appendChild(wrapper);
    container.appendChild(row);
  });
}

// ─── CARREGAR CSV ─────────────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch(CSV_FILE + '?t=' + Date.now());
    if (!res.ok) throw new Error('Erro ao carregar CSV');
    const text = await res.text();
    allData = parseCSV(text);
    renderPainel(allData);
    updateLastUpdate();
  } catch (e) {
    document.getElementById('painelContainer').innerHTML =
      `<div class="loading" style="color:#f87171">Erro ao carregar dados.csv<br><small>${e.message}</small></div>`;
  }
}

function updateLastUpdate() {
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    'Atualizado: ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── COUNTDOWN ───────────────────────────────────────────────────

function startCountdown() {
  countdownValue = REFRESH_INTERVAL;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdownValue--;
    const m = Math.floor(countdownValue / 60);
    const s = countdownValue % 60;
    document.getElementById('countdown').textContent =
      m + ':' + String(s).padStart(2, '0');
    if (countdownValue <= 0) {
      loadData();
      countdownValue = REFRESH_INTERVAL;
    }
  }, 1000);
}

// ─── BUSCA ────────────────────────────────────────────────────────

document.getElementById('searchInput').addEventListener('input', function() {
  searchTerm = this.value;
  renderPainel(allData);
});

// ─── INIT ─────────────────────────────────────────────────────────

loadData();
startCountdown();