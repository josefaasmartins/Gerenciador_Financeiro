
let state = {
  categorias: [],
  cartoes: [],
  contas: [],
  lancamentos: [],
  fixas: [],
  faturas: [],
  dashboard: {},
};

let chartCategorias;
const $ = (sel) => document.querySelector(sel);

const el = {
  filterMonth: $('#filtroMes'),
  filterYear: $('#filtroAno'),
  filterCategory: $('#filtroCategoria'),
  filterStatus: $('#filtroStatus'),
  filterForma: $('#filtroForma'),
  filterConta: $('#filtroConta'),
  toggleFiltros: $('#toggleFiltros'),
  toggleFiltrosTexto: $('#toggleFiltrosTexto'),
  filtersCard: $('#filtersCard'),

  saldoReal: $('#saldoReal'),
  saldoProjetado: $('#saldoProjetado'),
  receitasRecebidas: $('#receitasRecebidas'),
  despesasPrevistas: $('#despesasPrevistas'),

  proximaFatura: $('#proximaFatura'),
  listaLancamentos: $('#listaLancamentos'),
  listaFixas: $('#listaFixas'),
  listaCartoes: $('#listaCartoes'),

  modalLancamento: $('#modalLancamento'),
  modalFixa: $('#modalFixa'),
  modalCartao: $('#modalCartao'),

  formLancamento: $('#formLancamento'),
  formFixa: $('#formFixa'),
  formCartao: $('#formCartao'),

  tituloModalLancamento: $('#tituloModalLancamento'),
  lancId: $('#lancId'),
  lancData: $('#lancData'),
  lancTipo: $('#lancTipo'),
  lancCategoria: $('#lancCategoria'),
  lancDescricao: $('#lancDescricao'),
  lancValor: $('#lancValor'),
  lancStatus: $('#lancStatus'),
  lancForma: $('#lancForma'),
  lancConta: $('#lancConta'),
  lancCartao: $('#lancCartao'),
  lancParcelado: $('#lancParcelado'),
  lancTotalParcelas: $('#lancTotalParcelas'),

  fieldConta: $('#fieldConta'),
  fieldCartao: $('#fieldCartao'),
  fieldParcelado: $('#fieldParcelado'),
  fieldTotalParcelas: $('#fieldTotalParcelas'),

  fixaCategoria: $('#fixaCategoria'),
  navItems: document.querySelectorAll('.nav-item'),
};

const ITEMS_VISIVEIS = { lancamentos: 5, fixas: 5, cartoes: 5 };
const expanded = { lancamentos: false, fixas: false, cartoes: false };

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  bindEvents();
  await loadDashboard();
  setupBottomNav();
  registerServiceWorker();
});

function initFilters() {
  const now = new Date();

  if (el.filterMonth && !el.filterMonth.options.length) {
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = String(m).padStart(2, '0');
      opt.textContent = String(m).padStart(2, '0');
      if (m === now.getMonth() + 1) opt.selected = true;
      el.filterMonth.appendChild(opt);
    }
  }

  if (el.filterYear && !el.filterYear.options.length) {
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === now.getFullYear()) opt.selected = true;
      el.filterYear.appendChild(opt);
    }
  }
}

function bindEvents() {
  [el.filterMonth, el.filterYear].forEach(item => item?.addEventListener('change', loadDashboard));
  [el.filterCategory, el.filterStatus, el.filterConta].forEach(item => item?.addEventListener('change', renderAll));

  el.filterForma?.addEventListener('change', () => {
    updateFiltroContaOptions();
    renderAll();
  });

  el.toggleFiltros?.addEventListener('click', toggleFiltros);

  el.formLancamento?.addEventListener('submit', onSaveLancamento);
  el.formFixa?.addEventListener('submit', onSaveFixa);
  el.formCartao?.addEventListener('submit', onSaveCartao);

  el.lancForma?.addEventListener('change', updatePagamentoFields);
  el.lancParcelado?.addEventListener('change', updatePagamentoFields);
}

function setupBottomNav() {
  el.navItems?.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveNav(btn.dataset.target);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.id) setActiveNav(visible.target.id);
  }, { rootMargin: '-20% 0px -45% 0px', threshold: [0.2, 0.45, 0.7] });

  ['secaoDashboard', 'secaoLancamentos', 'secaoFixas', 'secaoFaturas'].forEach(id => {
    const node = document.getElementById(id);
    if (node) observer.observe(node);
  });
}

function setActiveNav(targetId) {
  el.navItems?.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
}

function toggleFiltros(forceExpand) {
  if (!el.filtersCard) return;
  const willExpand = typeof forceExpand === 'boolean'
    ? forceExpand
    : el.filtersCard.classList.contains('collapsed');

  el.filtersCard.classList.toggle('collapsed', !willExpand);
  if (el.toggleFiltros) el.toggleFiltros.setAttribute('aria-expanded', String(willExpand));
  if (el.toggleFiltrosTexto) el.toggleFiltrosTexto.textContent = willExpand ? 'Ocultar' : 'Mostrar';
}

async function loadDashboard() {
  try {
    const params = new URLSearchParams({
      action: 'bootstrap',
      month: el.filterMonth?.value || String(new Date().getMonth() + 1).padStart(2, '0'),
      year: el.filterYear?.value || String(new Date().getFullYear()),
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Falha ao carregar');

    state = {
      categorias: json.categorias || [],
      cartoes: json.cartoes || [],
      contas: json.contas || [],
      lancamentos: json.lancamentos || [],
      fixas: json.fixas || [],
      faturas: json.faturas || [],
      dashboard: json.dashboard || {},
    };

    expanded.lancamentos = false;
    expanded.fixas = false;
    expanded.cartoes = false;

    populateFilters();
    populateModals();
    renderAll();
  } catch (err) {
    alert('Erro ao carregar dados: ' + err.message);
  }
}

function populateFilters() {
  fillSelect(el.filterCategory, state.categorias || [], 'Todas');
  const formas = unique((state.lancamentos || []).map(l => l.forma_pagamento).filter(Boolean).concat(['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Transferência']));
  fillSelect(el.filterForma, formas, 'Todas');
  updateFiltroContaOptions();
}

function updateFiltroContaOptions() {
  const forma = el.filterForma?.value || '';
  let options = [];

  if (forma === 'Crédito') {
    options = (state.cartoes || []).filter(c => String(c.ativo || '').toLowerCase() === 'sim').map(c => c.nome_cartao).filter(Boolean);
  } else if (['Pix', 'Débito', 'Transferência', 'Dinheiro'].includes(forma)) {
    options = (state.contas || []).filter(c => String(c.ativo || '').toLowerCase() === 'sim').map(c => c.nome).filter(Boolean);
  } else {
    options = unique([
      ...(state.contas || []).map(c => c.nome).filter(Boolean),
      ...(state.cartoes || []).map(c => c.nome_cartao).filter(Boolean),
    ]);
  }

  fillSelect(el.filterConta, options, 'Todos');
}

function populateModals() {
  fillSelect(el.lancCategoria, state.categorias || [], 'Selecione');
  fillSelect(el.fixaCategoria, state.categorias || [], 'Selecione');
  fillSelect(el.lancConta, (state.contas || []).filter(c => String(c.ativo || '').toLowerCase() === 'sim').map(c => c.nome), 'Selecione');
  fillSelect(el.lancCartao, (state.cartoes || []).filter(c => String(c.ativo || '').toLowerCase() === 'sim').map(c => `${c.id_cartao}||${c.nome_cartao}`), 'Selecione', true);
  if (el.lancData && !el.lancData.value) el.lancData.value = new Date().toISOString().slice(0, 10);
  updatePagamentoFields();
}

function updatePagamentoFields() {
  const forma = el.lancForma?.value || '';
  const parcelado = el.lancParcelado?.value || 'nao';
  const isCredito = forma === 'Crédito';
  const editing = Boolean(el.lancId?.value);

  el.fieldConta?.classList.toggle('hidden', isCredito);
  el.fieldCartao?.classList.toggle('hidden', !isCredito);
  el.fieldParcelado?.classList.toggle('hidden', !isCredito || editing);
  el.fieldTotalParcelas?.classList.toggle('hidden', !isCredito || parcelado !== 'sim' || editing);

  if (!isCredito) {
    if (el.lancCartao) el.lancCartao.value = '';
    if (el.lancParcelado && !editing) el.lancParcelado.value = 'nao';
    if (el.lancTotalParcelas && !editing) el.lancTotalParcelas.value = 1;
  }

  if (isCredito && parcelado !== 'sim' && el.lancTotalParcelas && !editing) {
    el.lancTotalParcelas.value = 1;
  }
}

function renderAll() {
  renderCards();
  renderChart();
  renderProximaFatura();
  renderLancamentos();
  renderFixas();
  renderCartoes();
}

function renderCards() {
  const cards = state.dashboard?.cards || {};
  if (el.saldoReal) el.saldoReal.textContent = money(cards.saldo_real || 0);
  if (el.saldoProjetado) el.saldoProjetado.textContent = money(cards.saldo_projetado || 0);
  if (el.receitasRecebidas) el.receitasRecebidas.textContent = money(cards.receitas_recebidas || 0);
  if (el.despesasPrevistas) el.despesasPrevistas.textContent = money(cards.despesas_previstas || 0);
}

function renderChart() {
  const data = state.dashboard?.grafico_categorias || [];
  const ctx = document.getElementById('graficoCategorias');
  if (!ctx) return;
  if (chartCategorias) chartCategorias.destroy();

  const maior = [...data].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))[0];

  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(i => i.categoria),
      datasets: [{ data: data.map(i => Number(i.valor || 0)) }]
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#dbe7ff' } },
        tooltip: { callbacks: { label(context) { return `${context.label}: ${money(context.raw)}`; } } }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const total = data.reduce((s, i) => s + Number(i.valor || 0), 0);
        const { ctx } = chart;
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#eef4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(money(total), chart.width / 2, chart.height / 2);
        ctx.restore();
      }
    }]
  });

  const subtitle = document.querySelector('.panel-hero-chart .panel-subtitle');
  if (subtitle) {
    subtitle.textContent = maior ? `Maior gasto do mês: ${maior.categoria} (${money(maior.valor)})` : 'Visão rápida do peso de cada categoria';
  }
}

function renderProximaFatura() {
  const f = state.dashboard?.proxima_fatura;
  if (!el.proximaFatura) return;
  if (!f) {
    el.proximaFatura.innerHTML = '<div class="empty-state">Nenhuma fatura disponível.</div>';
    return;
  }
  el.proximaFatura.innerHTML = `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(f.nome_cartao)}</div>
      <div class="list-item-meta">Competência ${escapeHtml(cleanCompetencia(f.competencia))} • vence em ${formatDateBR(f.data_vencimento)}</div>
      <div class="list-item-title" style="margin-top:8px;">${money(f.valor_total)}</div>
    </div>`;
}

function renderLancamentos() {
  const todos = filteredLancamentos();
  if (!el.listaLancamentos) return;
  if (!todos.length) {
    el.listaLancamentos.innerHTML = '<div class="empty-state">Nenhum lançamento encontrado.</div>';
    atualizarBotaoVerMais('btnVerMaisLancamentos', 0, 0, 'lancamentos');
    return;
  }
  const limite = expanded.lancamentos ? todos.length : ITEMS_VISIVEIS.lancamentos;
  const items = todos.slice(0, limite);
  el.listaLancamentos.innerHTML = items.map(item => {
    const sinal = item.tipo === 'receita' ? '+' : '-';
    const origem = item.forma_pagamento === 'Crédito' ? (item.nome_cartao || item.conta_pagamento || '') : (item.conta_pagamento || '');
    const parcelaInfo = String(item.total_parcelas || '1') !== '1' ? `${item.parcela_atual || 1}/${item.total_parcelas}` : '';
    const editBtn = item.id_lancamento ? `<button class="btn btn-ghost" type="button" style="height:36px;padding:0 12px;font-size:0.85rem;" onclick="editLancamento('${escapeJs(item.id_lancamento)}')">Editar</button>` : '';
    const deleteBtn = item.id_lancamento ? `<button class="btn btn-danger" type="button" style="height:36px;padding:0 12px;font-size:0.85rem;" onclick="deleteLancamento('${escapeJs(item.id_lancamento)}')">Excluir</button>` : '';
    return `
      <div class="list-item">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div style="flex:1; min-width:0;">
            <div class="list-item-title">${escapeHtml(item.descricao)}</div>
            <div class="list-item-meta">${formatDateBR(item.data)} • ${escapeHtml(item.categoria)} • ${escapeHtml(item.status || '')}</div>
            <div class="list-item-meta">Forma: ${escapeHtml(item.forma_pagamento || '-')}${origem ? ` • Origem: ${escapeHtml(origem)}` : ''}${parcelaInfo ? ` • Parcela: ${escapeHtml(parcelaInfo)}` : ''}</div>
            <div class="list-item-title" style="margin-top:8px;">${sinal} ${money(item.valor)}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">${editBtn}${deleteBtn}</div>
        </div>
      </div>`;
  }).join('');
  atualizarBotaoVerMais('btnVerMaisLancamentos', todos.length, limite, 'lancamentos');
}

function renderFixas() {
  const todos = (state.fixas || []).filter(f => String(f.ativo || '').toLowerCase() === 'sim');
  if (!el.listaFixas) return;
  if (!todos.length) {
    el.listaFixas.innerHTML = '<div class="empty-state">Nenhuma fixa cadastrada.</div>';
    atualizarBotaoVerMais('btnVerMaisFixas', 0, 0, 'fixas');
    return;
  }
  const limite = expanded.fixas ? todos.length : ITEMS_VISIVEIS.fixas;
  const items = todos.slice(0, limite);
  el.listaFixas.innerHTML = items.map(item => `
    <div class="list-item">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div style="flex:1; min-width:0;">
          <div class="list-item-title">${escapeHtml(item.descricao)}</div>
          <div class="list-item-meta">${escapeHtml(item.categoria)} • vence dia ${escapeHtml(String(item.dia_vencimento))}</div>
          <div class="list-item-title" style="margin-top:8px;">${money(item.valor_padrao)}</div>
        </div>
        <div><button class="btn btn-danger" type="button" style="height:36px;padding:0 12px;font-size:0.85rem;" onclick="deleteFixa('${escapeJs(String(item.id_fixa))}')">Excluir</button></div>
      </div>
    </div>`).join('');
  atualizarBotaoVerMais('btnVerMaisFixas', todos.length, limite, 'fixas');
}

function renderCartoes() {
  if (!el.listaCartoes) return;
  const todosCartoes = state.cartoes || [];
  const todasFaturas = state.faturas || [];
  const totalItens = todosCartoes.length + todasFaturas.length;
  if (!totalItens) {
    el.listaCartoes.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado.</div>';
    atualizarBotaoVerMais('btnVerMaisCartoes', 0, 0, 'cartoes');
    return;
  }
  const limite = expanded.cartoes ? totalItens : ITEMS_VISIVEIS.cartoes;
  const cards = [];

  for (const c of todosCartoes) {
    if (cards.length >= limite) break;
    cards.push(`
      <div class="list-item">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="flex:1; min-width:0;">
            <div class="list-item-title">${escapeHtml(c.nome_cartao)}</div>
            <div class="list-item-meta">Fecha dia ${escapeHtml(String(c.dia_fechamento))} • vence dia ${escapeHtml(String(c.dia_vencimento))}</div>
            <div class="list-item-meta">Limite ${money(c.limite || 0)}</div>
          </div>
          <div><button class="btn btn-danger" type="button" style="height:36px;padding:0 12px;font-size:0.85rem;" onclick="deleteCartao('${escapeJs(String(c.id_cartao))}')">Excluir</button></div>
        </div>
      </div>`);
  }

  for (const f of todasFaturas) {
    if (cards.length >= limite) break;
    cards.push(`
      <div class="list-item">
        <div class="list-item-title">Fatura ${escapeHtml(f.nome_cartao)}</div>
        <div class="list-item-meta">${escapeHtml(cleanCompetencia(f.competencia))} • vencimento ${formatDateBR(f.data_vencimento)}</div>
        <div class="list-item-title" style="margin-top:8px;">${money(f.valor_total)}</div>
      </div>`);
  }

  el.listaCartoes.innerHTML = cards.join('');
  atualizarBotaoVerMais('btnVerMaisCartoes', totalItens, cards.length, 'cartoes');
}

function atualizarBotaoVerMais(btnId, total, exibindo, secao) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (total <= ITEMS_VISIVEIS[secao]) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  const restante = total - exibindo;
  btn.textContent = expanded[secao] ? 'Ver menos' : `Ver mais (${restante} oculto${restante !== 1 ? 's' : ''})`;
}

function toggleVerMais(secao) {
  expanded[secao] = !expanded[secao];
  if (secao === 'lancamentos') renderLancamentos();
  if (secao === 'fixas') renderFixas();
  if (secao === 'cartoes') renderCartoes();
}

function filteredLancamentos() {
  return (state.lancamentos || []).filter(item => {
    if (el.filterCategory?.value && item.categoria !== el.filterCategory.value) return false;
    if (el.filterStatus?.value && item.status !== el.filterStatus.value) return false;
    if (el.filterForma?.value && item.forma_pagamento !== el.filterForma.value) return false;
    if (el.filterConta?.value) {
      const alvo = item.forma_pagamento === 'Crédito' ? (item.nome_cartao || item.conta_pagamento || '') : (item.conta_pagamento || '');
      if (alvo !== el.filterConta.value) return false;
    }
    return true;
  });
}

async function onSaveLancamento(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.formLancamento).entries());
  const editing = Boolean(data.id_lancamento);

  if (data.forma_pagamento === 'Crédito') {
    if (!data.id_cartao) {
      alert('Selecione um cartão.');
      return;
    }
    const [idCartao, nomeCartao] = String(data.id_cartao).split('||');
    data.id_cartao = idCartao || '';
    data.conta_pagamento = nomeCartao || '';
  } else {
    data.id_cartao = '';
    data.parcelado = 'nao';
    data.total_parcelas = 1;
  }

  if (data.parcelado !== 'sim') data.total_parcelas = 1;
  const action = editing ? 'updateLancamento' : 'saveLancamento';
  await postAction(action, data);
  resetLancamentoForm();
  closeModal('modalLancamento');
  await loadDashboard();
}

async function onSaveFixa(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.formFixa).entries());
  await postAction('saveFixa', data);
  el.formFixa.reset();
  closeModal('modalFixa');
  await loadDashboard();
}

async function onSaveCartao(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.formCartao).entries());
  await postAction('saveCartao', data);
  el.formCartao.reset();
  closeModal('modalCartao');
  await loadDashboard();
}

function editLancamento(id) {
  const item = (state.lancamentos || []).find(l => String(l.id_lancamento) === String(id));
  if (!item) {
    alert('Lançamento não encontrado.');
    return;
  }

  resetLancamentoForm();
  if (el.tituloModalLancamento) el.tituloModalLancamento.textContent = 'Editar lançamento';
  if (el.lancId) el.lancId.value = item.id_lancamento || '';
  if (el.lancData) el.lancData.value = normalizeDateForInput(item.data);
  if (el.lancTipo) el.lancTipo.value = item.tipo || 'despesa';
  if (el.lancCategoria) el.lancCategoria.value = item.categoria || '';
  if (el.lancDescricao) el.lancDescricao.value = item.descricao || '';
  if (el.lancValor) el.lancValor.value = normalizeNumberForInput(item.valor);
  if (el.lancStatus) el.lancStatus.value = item.status || 'pendente';
  if (el.lancForma) el.lancForma.value = item.forma_pagamento || '';

  if (item.forma_pagamento === 'Crédito') {
    const option = [...(el.lancCartao?.options || [])].find(o => {
      const [idCartao, nome] = String(o.value).split('||');
      return idCartao === String(item.id_cartao || '') || nome === String(item.conta_pagamento || '');
    });
    if (option && el.lancCartao) el.lancCartao.value = option.value;
    if (el.lancParcelado) el.lancParcelado.value = String(item.total_parcelas || '1') !== '1' ? 'sim' : 'nao';
    if (el.lancTotalParcelas) el.lancTotalParcelas.value = item.total_parcelas || 1;
  } else {
    if (el.lancConta) el.lancConta.value = item.conta_pagamento || '';
  }

  updatePagamentoFields();
  openModal('modalLancamento');
}

function resetLancamentoForm() {
  el.formLancamento?.reset();
  if (el.tituloModalLancamento) el.tituloModalLancamento.textContent = 'Novo lançamento';
  if (el.lancId) el.lancId.value = '';
  if (el.lancData) el.lancData.value = new Date().toISOString().slice(0, 10);
  if (el.lancParcelado) el.lancParcelado.value = 'nao';
  if (el.lancTotalParcelas) el.lancTotalParcelas.value = 1;
  updatePagamentoFields();
}

async function postAction(action, data) {
  const payload = { action, data };
  const body = new URLSearchParams();
  body.append('payload', JSON.stringify(payload));
  const res = await fetch(API_URL, { method: 'POST', body });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Falha ao salvar');
  return json;
}

async function deleteLancamento(id) {
  if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
  try {
    await postAction('deleteLancamento', { id_lancamento: id });
    await loadDashboard();
  } catch (err) {
    alert('Erro ao excluir lançamento: ' + err.message);
  }
}

async function deleteFixa(id) {
  if (!confirm('Excluir esta despesa fixa? Esta ação não pode ser desfeita.')) return;
  try {
    await postAction('deleteFixa', { id_fixa: id });
    await loadDashboard();
  } catch (err) {
    alert('Erro ao excluir despesa fixa: ' + err.message);
  }
}

async function deleteCartao(id) {
  if (!confirm('Excluir este cartão? Faturas vinculadas podem ser afetadas.')) return;
  try {
    await postAction('deleteCartao', { id_cartao: id });
    await loadDashboard();
  } catch (err) {
    alert('Erro ao excluir cartão: ' + err.message);
  }
}

function fillSelect(select, values, placeholder, cartaoComTexto = false) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '';
  if (placeholder !== undefined) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  values.forEach(value => {
    if (!value) return;
    const opt = document.createElement('option');
    if (cartaoComTexto) {
      const [id, nome] = String(value).split('||');
      opt.value = value;
      opt.textContent = nome || id || value;
    } else {
      opt.value = value;
      opt.textContent = value;
    }
    select.appendChild(opt);
  });
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function openLancamentoModal() { resetLancamentoForm(); openModal('modalLancamento'); }
function openFixaModal() { openModal('modalFixa'); }
function openCartaoModal() { openModal('modalCartao'); }
function openModal(id) { const modal = document.getElementById(id); if (modal) modal.style.display = 'flex'; }
function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.style.display = 'none'; }

window.openLancamentoModal = openLancamentoModal;
window.openFixaModal = openFixaModal;
window.openCartaoModal = openCartaoModal;
window.closeModal = closeModal;
window.loadDashboard = loadDashboard;
window.editLancamento = editLancamento;
window.deleteLancamento = deleteLancamento;
window.deleteFixa = deleteFixa;
window.deleteCartao = deleteCartao;
window.toggleVerMais = toggleVerMais;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '-';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-');
    return `${m}/${y}`;
  }
  const date = new Date(raw);
  if (!isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
  }
  return raw;
}

function cleanCompetencia(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[2]}/${match[1]}`;
  return raw;
}

function normalizeDateForInput(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (!isNaN(date.getTime())) return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return '';
}

function normalizeNumberForInput(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(n) : '';
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\'");
}
