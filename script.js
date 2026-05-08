const CONFIG = {
    csvUrl: 'dados.csv',
    refreshSeconds: 300,
    scrollSpeed: 40 // pixels por segundo
};

let rawData = [];
let timerInterval;

async function fetchData() {
    try {
        const response = await fetch(CONFIG.csvUrl + '?t=' + Date.now());
        const text = await response.text();
        parseCSV(text);
        renderLayout();
    } catch (error) {
        console.error('Erro ao buscar CSV:', error);
    }
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return;

    const headers = lines[0].split(';').map(h => h.trim().toUpperCase());
    
    rawData = lines.slice(1).map(line => {
        const values = line.split(';').map(v => v.trim());
        const entry = {};
        headers.forEach((header, i) => {
            entry[header] = values[i] || "";
        });
        return entry;
    });
}

function getDisplayDays() {
    const hoje = new Date();
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    const diaAtualIdx = hoje.getDay();

    // Regra da Sexta: Sexta, Sábado/Domingo, Segunda
    if (diaAtualIdx === 5) {
        return [
            { label: 'SEXTA', data: 'Hoje' },
            { label: 'SÁBADO+DOMINGO', data: 'Fim de Semana' },
            { label: 'SEGUNDA', data: 'Próxima' }
        ];
    }

    // Regra Padrão: Hoje + 2 próximos
    let days = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(hoje.getDate() + i);
        let label = diasSemana[d.getDay()];
        
        // Se cair num Sábado ou Domingo e não for o primeiro dia da lista, agrupa se houver lógica
        // Mas para simplicidade visual na TV, vamos manter o agrupamento manual se necessário.
        days.push({ 
            label: label, 
            date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) 
        });
    }
    return days;
}

function renderLayout() {
    const container = document.getElementById('painelContainer');
    container.innerHTML = '';
    
    const displayDays = getDisplayDays();
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    displayDays.forEach(dayInfo => {
        const row = document.createElement('div');
        row.className = 'dia-row';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'dia-label';
        labelDiv.innerHTML = `<span class="dia-nome">${dayInfo.label}</span><span class="dia-data">${dayInfo.date}</span>`;
        
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'cards-container';

        // Filtra dados para o dia
        let dayData = rawData.filter(item => {
            const itemDia = item.DIA ? item.DIA.toUpperCase() : "";
            if (dayInfo.label === 'SÁBADO+DOMINGO') {
                return itemDia === 'SÁBADO' || itemDia === 'DOMINGO' || itemDia === 'SABADO';
            }
            return itemDia === dayInfo.label;
        });

        // Aplica busca
        if (searchTerm) {
            dayData = dayData.filter(item => 
                Object.values(item).some(val => val.toLowerCase().includes(searchTerm))
            );
        }

        // Ordena por hora
        dayData.sort((a, b) => (a.HORA || '23:59').localeCompare(b.HORA || '23:59'));

        dayData.forEach(item => {
            cardsDiv.appendChild(createCard(item));
        });

        row.appendChild(labelDiv);
        row.appendChild(cardsDiv);
        container.appendChild(row);

        // Inicia ticker se necessário
        setupTicker(cardsDiv);
    });
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';

    const badges = item.TIPO ? item.TIPO.split('+').map(t => {
        const typeCls = t.toLowerCase().includes('entrega') ? 'badge-entrega' :
                        t.toLowerCase().includes('retirada') ? 'badge-retirada' :
                        t.toLowerCase().includes('insta') ? 'badge-instalacao' :
                        t.toLowerCase().includes('ac') ? 'badge-ac' :
                        t.toLowerCase().includes('evento') ? 'badge-evento' : 'badge-default';
        return `<span class="badge ${typeCls}">${t.trim()}</span>`;
    }).join('') : '';

    // Lógica para Hora (Texto ou Numérico)
    const horaExibida = item.HORA || "CONFIRMAR";
    const fontSizeHora = horaExibida.length > 5 ? '0.9rem' : '1.1rem';

    // Montagem Equipe
    const equipe = [item.MOTORISTA, item.AJUDANTE, item.TECNICOS].filter(x => x && x !== "").join(' + ') || '-';

    card.innerHTML = `
        <div class="card-top">
            <div class="card-hora-box">
                <span class="card-hora" style="font-size: ${fontSizeHora}">${horaExibida}</span>
            </div>
            <div class="card-types">${badges}</div>
        </div>
        <div class="card-content">
            <h2 class="card-client">${item.CLIENTE || '---'}</h2>
            <div class="card-meta">
                📍 ${item.CIDADE || '---'} &nbsp;&nbsp; 🚚 ${item.VEICULO || '---'}
            </div>
            <div class="card-equipments">
                <span class="equip-label">Equipamentos / Acessórios</span>
                <div class="equip-list">${item.EQUIPAMENTOS || 'Consulte a logística'}</div>
            </div>
            
            <div class="card-tech-grid">
                ${createTechItem('⚡', 'TENSÃO', item.TENSAO, 't-tensao')}
                ${createTechItem('👥', 'EQUIPE', equipe, 't-equipe')}
                ${createTechItem('⏱️', 'FRANQUIA', item.FRANQUIA, 't-franquia')}
                ${createTechItem('📅', 'PERÍODO', item.PERIODO, 't-periodo')}
                ${createTechItem('⛽', 'DIESEL', item.COMBUSTIVEL, 't-combustivel')}
                ${createTechItem('📦', 'INSTAL.', item.INSTALACAO, 't-instalacao')}
            </div>

            ${item.OBSERVACAO ? `<div class="card-obs">${item.OBSERVACAO}</div>` : ''}
        </div>
    `;
    return card;
}

function createTechItem(icon, label, value, className) {
    if (!value || value === "" || value === "-") return '';
    return `
        <div class="tech-item ${className}">
            <span class="tech-icon">${icon}</span>
            <div>
                <span class="tech-label">${label}</span>
                <span class="tech-value">${value}</span>
            </div>
        </div>
    `;
}

function setupTicker(container) {
    const totalWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    if (totalWidth > clientWidth) {
        let pos = 0;
        function step() {
            pos += 0.5; // Velocidade lenta para TV
            if (pos > totalWidth - clientWidth + 50) pos = -50;
            container.scrollLeft = pos;
            requestAnimationFrame(step);
        }
        // Desativamos o ticker se o usuário estiver usando a busca para não atrapalhar
        if (!document.getElementById('searchInput').value) {
            // requestAnimationFrame(step); // Ative se quiser o auto-scroll
        }
    }
}

// TIMER E BUSCA
function startTimer() {
    let timeLeft = CONFIG.refreshSeconds;
    timerInterval = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        document.getElementById('timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (timeLeft <= 0) {
            timeLeft = CONFIG.refreshSeconds;
            fetchData();
        }
    }, 1000);
}

document.getElementById('searchInput').addEventListener('input', renderLayout);

// INÍCIO
fetchData();
startTimer();