const CONFIG = {
    csvUrl: 'dados.csv',
    refreshSeconds: 300
};

let rawData = [];
let timerInterval;

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/** Remove valores vazios, "nan" e espaços extras */
function limpar(valor) {
    if (!valor) return '';
    const v = valor.trim();
    if (v.toLowerCase() === 'nan') return '';
    return v;
}

// ─── FETCH E PARSE ────────────────────────────────────────────────────────────

async function fetchData() {
    try {
        const response = await fetch(CONFIG.csvUrl + '?t=' + Date.now());
        const text = await response.text();
        parseCSV(text);
        renderLayout();
    } catch (error) {
        console.error('Erro ao buscar CSV:', error);
        document.getElementById('painelContainer').innerHTML =
            '<p style="padding:20px;color:red;">Erro ao carregar dados.csv</p>';
    }
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return;

    // Auto-detecta separador ; ou ,
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toUpperCase());

    rawData = lines.slice(1).map(line => {
        const values = line.split(sep).map(v => v.trim());
        const entry = {};
        headers.forEach((header, i) => {
            entry[header] = values[i] || '';
        });
        return entry;
    });
}

// ─── DIAS A EXIBIR ────────────────────────────────────────────────────────────

function getDisplayDays() {
    const hoje = new Date();
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    const diaAtualIdx = hoje.getDay();

    // Sexta: Sexta + Sáb/Dom + Segunda
    if (diaAtualIdx === 5) {
        return [
            { label: 'SEXTA',          date: hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) },
            { label: 'SÁBADO+DOMINGO', date: 'Fim de Semana' },
            { label: 'SEGUNDA',        date: 'Próxima' }
        ];
    }

    // Padrão: Hoje + 2 próximos
    return Array.from({ length: 3 }, (_, i) => {
        const d = new Date();
        d.setDate(hoje.getDate() + i);
        return {
            label: diasSemana[d.getDay()],
            date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        };
    });
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────

function renderLayout() {
    const container = document.getElementById('painelContainer');
    container.innerHTML = '';

    const displayDays = getDisplayDays();
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    displayDays.forEach(dayInfo => {
        const row = document.createElement('div');
        row.className = 'dia-row';

        // Label do dia
        const labelDiv = document.createElement('div');
        labelDiv.className = 'dia-label';
        labelDiv.innerHTML = `
            <span class="dia-nome">${dayInfo.label}</span>
            <span class="dia-data">${dayInfo.date}</span>
        `;

        // Container dos cards
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'cards-container';

        // Filtra dados para o dia
        let dayData = rawData.filter(item => {
            const itemDia = limpar(item.DIA).toUpperCase();
            if (dayInfo.label === 'SÁBADO+DOMINGO') {
                return itemDia === 'SÁBADO' || itemDia === 'SABADO' || itemDia === 'DOMINGO';
            }
            return itemDia === dayInfo.label;
        });

        // Aplica busca
        if (searchTerm) {
            dayData = dayData.filter(item =>
                Object.values(item).some(val =>
                    limpar(val).toLowerCase().includes(searchTerm)
                )
            );
        }

        // Ordena por hora
        dayData.sort((a, b) =>
            (limpar(a.HORA) || '23:59').localeCompare(limpar(b.HORA) || '23:59')
        );

        if (dayData.length === 0) {
            cardsDiv.innerHTML = '<div style="display:flex;align-items:center;padding:0 20px;color:#adb5bd;font-size:0.9rem;">Nenhum registro para este dia.</div>';
        } else {
            dayData.forEach(item => cardsDiv.appendChild(createCard(item)));
        }

        row.appendChild(labelDiv);
        row.appendChild(cardsDiv);
        container.appendChild(row);
    });
}

// ─── CRIAÇÃO DO CARD ──────────────────────────────────────────────────────────

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';

    // Tipo → badges + classe de cor da borda
    const tipos = limpar(item.TIPO) ? item.TIPO.split('+') : [];
    const badges = tipos.map(t => {
        const tl = t.trim().toLowerCase();
        const cls = tl.includes('entrega')   ? 'badge-entrega'    :
                    tl.includes('retirada')  ? 'badge-retirada'   :
                    tl.includes('insta')     ? 'badge-instalacao' :
                    tl.includes('ac')        ? 'badge-ac'         :
                    tl.includes('evento')    ? 'badge-evento'     : 'badge-default';
        return `<span class="badge ${cls}">${t.trim()}</span>`;
    }).join('');

    // Cor da borda superior baseada no primeiro tipo
    if (tipos.length > 0) {
        const tl = tipos[0].trim().toLowerCase();
        const borderClass = tl.includes('entrega')   ? 'tipo-entrega'    :
                            tl.includes('retirada')  ? 'tipo-retirada'   :
                            tl.includes('insta')     ? 'tipo-instalacao' :
                            tl.includes('ac')        ? 'tipo-ac'         :
                            tl.includes('evento')    ? 'tipo-evento'     : '';
        if (borderClass) card.classList.add(borderClass);
    }

    // Hora
    const hora = limpar(item.HORA) || '--:--';

    // Cliente
    const cliente = limpar(item.CLIENTE) || '---';

    // Cidade
    const cidade = limpar(item.CIDADE);

    // Equipamentos
    const equipamentos = limpar(item.EQUIPAMENTOS);

    // Observação
    const obs = limpar(item.OBSERVACAO);

    card.innerHTML = `
        <div class="card-top">
            <div class="card-hora-box">
                <span class="card-hora">${hora}</span>
            </div>
            <div class="card-types">${badges}</div>
        </div>

        <div class="card-divider"></div>

        <div class="card-client">${cliente}</div>

        ${cidade ? `
        <div class="card-cidade">
            <span>📍</span>
            <span>${cidade}</span>
        </div>` : ''}

        ${equipamentos ? `
        <div class="card-equipments">
            <span class="equip-label">⚙️ Equipamentos</span>
            <div class="equip-list">${equipamentos}</div>
        </div>` : ''}

        ${obs ? `
        <div class="card-obs">💬 ${obs}</div>` : ''}
    `;

    return card;
}

// ─── TIMER ────────────────────────────────────────────────────────────────────

function startTimer() {
    let timeLeft = CONFIG.refreshSeconds;
    timerInterval = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        document.getElementById('timer').textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (timeLeft <= 0) {
            timeLeft = CONFIG.refreshSeconds;
            fetchData();
        }
    }, 1000);
}

// ─── BUSCA ────────────────────────────────────────────────────────────────────

document.getElementById('searchInput').addEventListener('input', renderLayout);

// ─── INÍCIO ───────────────────────────────────────────────────────────────────

fetchData();
startTimer();