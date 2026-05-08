function limpar(v) {
    if (!v) return '';
    return v.toString().trim().replace(/^nan$/i, '');
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';

    // Montagem da Equipe
    const equipe = [item.MOTORISTA, item.AJUDANTE, item.TECNICOS].filter(x => limpar(x)).join(' + ') || '-';

    card.innerHTML = `
        <div class="card-header">
            <div class="hora-box">${limpar(item.HORA) || 'CONFIRMAR'}</div>
            <div class="tipo-badge">${limpar(item.TIPO) || 'SERVIÇO'}</div>
        </div>

        <div class="cliente-nome">${limpar(item.CLIENTE) || 'NÃO INFORMADO'}</div>
        
        <div class="cidade-veiculo">
            <span>📍 ${limpar(item.CIDADE) || '---'}</span>
            ${limpar(item.VEICULO) ? `<span>🚚 ${item.VEICULO}</span>` : ''}
        </div>

        <div class="equipamentos-box">
            <span class="equip-label">Equipamentos / Acessórios</span>
            <div class="equip-lista">${limpar(item.EQUIPAMENTOS) || 'Consultar logística'}</div>
        </div>

        <div class="grid-infos">
            ${renderGridItem('⚡', 'Tensão', item.TENSAO, 'g-tensao')}
            ${renderGridItem('👥', 'Equipe', equipe, 'g-equipe')}
            ${renderGridItem('⏱️', 'Franquia', item.FRANQUIA, 'g-franquia')}
            ${renderGridItem('📅', 'Período', item.PERIODO, 'g-periodo')}
            ${renderGridItem('⛽', 'Diesel', item.COMBUSTIVEL, 'g-diesel')}
            ${renderGridItem('📦', 'Instalação', item.INSTALACAO, 'g-instalacao')}
        </div>

        ${limpar(item.OBSERVACAO) ? `<div class="obs-footer">💬 ${item.OBSERVACAO}</div>` : ''}
    `;
    return card;
}

function renderGridItem(icon, label, value, cls) {
    const val = limpar(value);
    if (!val || val === '-') return `<div class="info-item" style="opacity:0.2"><div class="info-text"><span class="info-label">${label}</span><span class="info-value">-</span></div></div>`;
    return `
        <div class="info-item ${cls}">
            <span class="info-icon">${icon}</span>
            <div class="info-text">
                <span class="info-label">${label}</span>
                <span class="info-value">${val}</span>
            </div>
        </div>
    `;
}