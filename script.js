const CONFIG = {
    csvUrl: 'dados.csv',
    refreshSeconds: 300
};

let rawData = [];

/* LIMPA DADOS */
function limpar(v) {
    if (!v) return '';
    if (v.toLowerCase() === 'nan') return '';
    return v.trim();
}

/* FETCH */
async function fetchData() {
    const res = await fetch(CONFIG.csvUrl + '?t=' + Date.now());
    const text = await res.text();
    parseCSV(text);
    render();
}

/* PARSE CSV (FORÇADO ;) */
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(';');

    rawData = lines.slice(1).map(line => {
        const values = line.split(';');
        let obj = {};
        headers.forEach((h, i) => {
            obj[h.trim().toUpperCase()] = limpar(values[i] || '');
        });
        return obj;
    });
}

/* DIAS */
function getDays() {
    const hoje = new Date();
    const dias = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];

    if (hoje.getDay() === 5) {
        return ['SEXTA','SÁBADO+DOMINGO','SEGUNDA'];
    }

    return [
        dias[hoje.getDay()],
        dias[(hoje.getDay()+1)%7],
        dias[(hoje.getDay()+2)%7]
    ];
}

/* RENDER */
function render() {
    const container = document.getElementById('painelContainer');
    container.innerHTML = '';

    const days = getDays();

    days.forEach(day => {
        const row = document.createElement('div');
        row.className = 'dia-row';

        const label = document.createElement('div');
        label.className = 'dia-label';
        label.innerText = day;

        const cards = document.createElement('div');
        cards.className = 'cards-container';

        let data = rawData.filter(item => {
            const d = item.DIA.toUpperCase();

            if (day === 'SÁBADO+DOMINGO') {
                return d.includes('SÁBADO') || d.includes('DOMINGO');
            }

            return d.includes(day);
        });

        data.forEach(item => cards.appendChild(createCard(item)));

        row.appendChild(label);
        row.appendChild(cards);
        container.appendChild(row);
    });
}

/* CARD */
function createCard(i) {
    const equipe = [i.MOTORISTA, i.AJUDANTE, i.TECNICOS].filter(x => x).join(' + ') || '-';

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
        <div class="card-header">
            <div class="hora">${i.HORA || 'CONFIRMAR'}</div>
            <div class="tipo">${i.TIPO || '-'}</div>
        </div>

        <div class="cliente">${i.CLIENTE}</div>

        <div class="meta">📍 ${i.CIDADE} ${i.VEICULO ? '🚚 '+i.VEICULO : ''}</div>

        <div class="equip">${i.EQUIPAMENTOS || '-'}</div>

        <div class="grid">
            <div class="box tensao">⚡ ${i.TENSAO || '-'}</div>
            <div class="box equipe">👥 ${equipe}</div>
            <div class="box franquia">⏱️ ${i.FRANQUIA || '-'}</div>
            <div class="box periodo">📅 ${i.PERIODO || '-'}</div>
            <div class="box diesel">⛽ ${i.COMBUSTIVEL || '-'}</div>
            <div class="box instalacao">📦 ${i.INSTALACAO || '-'}</div>
        </div>

        ${i.OBSERVACAO ? `<div class="obs">${i.OBSERVACAO}</div>` : ''}
    `;

    return card;
}

/* TIMER */
function startTimer() {
    let t = CONFIG.refreshSeconds;

    setInterval(() => {
        t--;
        const m = String(Math.floor(t/60)).padStart(2,'0');
        const s = String(t%60).padStart(2,'0');
        document.getElementById('timer').innerText = `${m}:${s}`;

        if (t <= 0) {
            t = CONFIG.refreshSeconds;
            fetchData();
        }
    }, 1000);
}

/* START */
fetchData();
startTimer();