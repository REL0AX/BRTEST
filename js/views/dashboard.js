import { AppState } from "../app/state.js";
import { formatCurrency, getDateRange, getPreviousDateRange, calculateTrend, getSaleDate } from "../utils/helpers.js";

// Regista handlers específicos pós-auth (ex.: tour)
export function onAfterAuthDashboard() {
  // Tour
  document.getElementById("tour-yes")?.addEventListener("click", () => {
    bootstrap.Modal.getInstance(document.getElementById("tour-modal"))?.hide();
    setTimeout(startTour, 300);
  });
  document.getElementById("tour-no")?.addEventListener("click", () => {
    localStorage.setItem("brtest_tour_completed", "true");
  });

  if (!localStorage.getItem("brtest_tour_completed")) {
    new bootstrap.Modal(document.getElementById("tour-modal")).show();
  }
}

export function renderDashboardSection(updateOnly = false) {
  const contentEl = document.getElementById("dashboard-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <select id="dashboard-period-filter" class="form-select w-auto">
            <option value="today">Hoje</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="this_month" selected>Este Mês</option>
            <option value="this_year">Este Ano</option>
            <option value="all">Tudo</option>
            <option value="custom">Período Personalizado</option>
          </select>
          <div id="custom-date-range-filter" class="d-none gap-2 align-items-center">
            <input type="date" id="start-date-filter" class="form-control">
            <span>até</span>
            <input type="date" id="end-date-filter" class="form-control">
            <button id="apply-custom-date-filter" class="btn btn-secondary btn-sm">Aplicar</button>
          </div>
          <button class="btn btn-outline-secondary" id="start-tour-btn" title="Iniciar Guia Rápido"><i class="bi bi-question-circle"></i></button>
        </div>
        <button class="btn btn-primary" data-action="open-venda-modal"><i class="bi bi-plus-circle-fill me-2"></i>Lançamento Rápido</button>
      </div>
      <div class="card mb-4"><div class="card-header"><h5>🏆 Metas da Semana</h5></div><div class="card-body"><div id="sales-goals-section" class="row"></div></div></div>
      <div class="row" id="dashboard-metrics"></div>
      <div class="row mb-4">
        <div class="col-lg-3 col-md-6 mb-4"><div class="card h-100"><div class="card-body" id="dashboard-goal"></div></div></div>
        <div class="col-lg-3 col-md-6 mb-4"><div class="card h-100"><div class="card-body" id="dashboard-daily-goal"></div></div></div>
        <div class="col-lg-3 col-md-6 mb-4"><div class="card h-100"><div class="card-body" id="dashboard-cash-today"></div></div></div>
        <div class="col-lg-3 col-md-6 mb-4"><div class="card h-100"><div class="card-body" id="dashboard-cash-summary"></div></div></div>
      </div>
      <div class="row mb-4"><div class="col-12"><div class="card"><div class="card-body" id="sales-race-card"></div></div></div></div>
      <div class="row">
        <div class="col-lg-7 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Faturamento por Período</h5><div class="chart-container"><canvas id="faturamentoChart"></canvas></div></div></div></div>
        <div class="col-lg-5 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Vendas por Vendedor</h5><div class="chart-container"><canvas id="vendedorChart"></canvas></div></div></div></div>
      </div>
      <div class="row">
        <div class="col-lg-6 mb-4"><div class="card"><div class="card-body"><h5 class="card-title">Top 5 Produtos (Quantidade)</h5><div class="chart-container" style="height: 350px;"><canvas id="topProdutosChart"></canvas></div></div></div></div>
        <div class="col-lg-6 mb-4"><div class="card"><div class="card-body"><h5 class="card-title">Top 5 Produtos (Faturamento)</h5><div class="chart-container" style="height: 350px;"><canvas id="topProdutosFaturamentoChart"></canvas></div></div></div></div>
      </div>
    `;

    contentEl.querySelector("#dashboard-period-filter").addEventListener("change", (e) => {
      document.getElementById("custom-date-range-filter").classList.toggle("d-flex", e.target.value === "custom");
      document.getElementById("custom-date-range-filter").classList.toggle("d-none", e.target.value !== "custom");
      if (e.target.value !== "custom") updateDashboardData();
    });
    contentEl.querySelector("#apply-custom-date-filter").addEventListener("click", updateDashboardData);
    contentEl.querySelector("#start-tour-btn").addEventListener("click", startTour);
  }

  updateDashboardData();
}

let faturamentoChart, vendedorChart, topProdutosChart, topProdutosFaturamentoChart;

function updateDashboardData() {
  const contentEl = document.getElementById("dashboard-content");
  if (!contentEl) return;

  const period = document.getElementById("dashboard-period-filter").value;
  let start, end;

  if (period === "custom") {
    const startDateValue = document.getElementById("start-date-filter").value;
    const endDateValue = document.getElementById("end-date-filter").value;
    if (!startDateValue || !endDateValue) return alert("Por favor, selecione as datas de início e fim.");
    start = new Date(startDateValue + "T00:00:00");
    end = new Date(endDateValue + "T23:59:59");
  } else if (period === "all") {
    start = new Date(0);
    end = new Date();
  } else {
    ({ start, end } = getDateRange(period));
  }

  const filteredSales = AppState.sales.filter(s => { const d = getSaleDate(s); return d && d >= start && d <= end; });
  const { start: prevStart, end: prevEnd } = getPreviousDateRange(start, end);
  const prevFilteredSales = AppState.sales.filter(s => { const d = getSaleDate(s); return d && d >= prevStart && d <= prevEnd; });

  const faturamentoTotal = filteredSales.reduce((sum, s) => sum + s.valor, 0);
  const prevFaturamento = prevFilteredSales.reduce((sum, s) => sum + s.valor, 0);
  const faturamentoTrend = calculateTrend(faturamentoTotal, prevFaturamento);

  document.getElementById("dashboard-metrics").innerHTML = `
    <div class="col-xl-3 col-md-6 mb-4"><div class="card stat-card h-100"><div class="card-body d-flex align-items-center"><i class="bi bi-cash-coin fs-2 text-primary opacity-75 me-3"></i><div><h6 class="card-subtitle text-muted">Faturamento</h6><h3 class="card-title fw-bold mb-0">${formatCurrency(faturamentoTotal)}</h3><small class="${faturamentoTrend.color}">${faturamentoTrend.text}</small></div></div></div></div>
    <div class="col-xl-3 col-md-6 mb-4"><div class="card stat-card h-100"><div class="card-body d-flex align-items-center"><i class="bi bi-receipt fs-2 text-success opacity-75 me-3"></i><div><h6 class="card-subtitle text-muted">Vendas</h6><h3 class="card-title fw-bold mb-0">${filteredSales.length}</h3></div></div></div></div>
    <div class="col-xl-3 col-md-6 mb-4"><div class="card stat-card h-100"><div class="card-body d-flex align-items-center"><i class="bi bi-graph-up-arrow fs-2 text-info opacity-75 me-3"></i><div><h6 class="card-subtitle text-muted">Ticket Médio</h6><h3 class="card-title fw-bold mb-0">${formatCurrency(filteredSales.length > 0 ? faturamentoTotal / filteredSales.length : 0)}</h3></div></div></div></div>
    <div class="col-xl-3 col-md-6 mb-4"><div class="card stat-card h-100"><div class="card-body d-flex align-items-center"><i class="bi bi-people-fill fs-2 text-warning opacity-75 me-3"></i><div><h6 class="card-subtitle text-muted">Vendas/Vendedor</h6><h3 class="card-title fw-bold mb-0">${(filteredSales.length / (new Set(filteredSales.map(s => s.vendedor)).size || 1)).toFixed(1)}</h3></div></div></div></div>
  `;

  const meta = AppState.settings.metaFaturamentoMensal || 50000;
  const faturamentoMesAtual = AppState.sales
    .filter(s => { const d = getSaleDate(s); return d && d >= getDateRange("this_month").start; })
    .reduce((sum, s) => sum + s.valor, 0);
  const percentualMeta = meta > 0 ? (faturamentoMesAtual / meta) * 100 : 0;
  document.getElementById("dashboard-goal").innerHTML =
    `<h5 class="card-title">Meta Mensal</h5><p class="text-muted small">${formatCurrency(faturamentoMesAtual)} / ${formatCurrency(meta)}</p><div class="progress" style="height: 10px;"><div class="progress-bar" style="width: ${percentualMeta}%;"></div></div>`;

  updateDailyGoalCard();
  updateCashSummary();
  updateSalesRace();

  faturamentoChart = updateChart("faturamentoChart", faturamentoChart, "bar", aggregateSalesByTime(filteredSales, period, start, end), { label: "Faturamento" }, { y: { beginAtZero: true } });

  const salesByVendedor = filteredSales.reduce((acc, s) => { acc[s.vendedor] = (acc[s.vendedor] || 0) + s.valor; return acc; }, {});
  const vendedorLabels = Object.keys(salesByVendedor);
  const vendedorColors = vendedorLabels.map(label => AppState.vendedores.find(v => v.nome === label)?.cor || "#6c757d");
  vendedorChart = updateChart("vendedorChart", vendedorChart, "doughnut", { labels: vendedorLabels, values: Object.values(salesByVendedor) }, { backgroundColor: vendedorColors });

  const salesByProductQty = filteredSales.reduce((acc, s) => {
    const products = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto) : [s.nomeProduto || "N/A"];
    products.forEach(pName => { acc[pName] = (acc[pName] || 0) + 1; });
    return acc;
  }, {});
  const top5Qty = Object.entries(salesByProductQty).sort(([, a], [, b]) => b - a).slice(0, 5);
  topProdutosChart = updateChart("topProdutosChart", topProdutosChart, "bar", { labels: top5Qty.map(p => p[0]), values: top5Qty.map(p => p[1]) }, { label: "Quantidade Vendida" }, { indexAxis: "y" });

  const salesByProductValue = filteredSales.reduce((acc, s) => {
    const products = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto) : [s.nomeProduto || "N/A"];
    products.forEach(pName => { acc[pName] = (acc[pName] || 0) + (s.valor / products.length); });
    return acc;
  }, {});
  const top5Value = Object.entries(salesByProductValue).sort(([, a], [, b]) => b - a).slice(0, 5);
  topProdutosFaturamentoChart = updateChart("topProdutosFaturamentoChart", topProdutosFaturamentoChart, "bar", { labels: top5Value.map(p => p[0]), values: top5Value.map(p => p[1]) }, { label: "Faturamento (R$)" }, { indexAxis: "y" });

  updateWeeklyGoals();
}

function updateDailyGoalCard() {
  const dailyGoalEl = document.getElementById("dashboard-daily-goal");
  if (!dailyGoalEl) return;
  const { goal, soldToday, progress } = calculateDailyGoal();
  dailyGoalEl.innerHTML =
    `<h5 class="card-title">Meta Diária</h5><p class="text-muted small">${formatCurrency(soldToday)} / ${formatCurrency(goal)}</p><div class="progress" style="height: 10px;"><div class="progress-bar bg-success" style="width: ${progress}%;"></div></div>`;
}

function calculateDailyGoal() {
  const monthlyGoal = AppState.settings.metaFaturamentoMensal || 0;
  if (monthlyGoal <= 0) return { goal: 0, soldToday: 0, progress: 0 };

  const monthRange = getDateRange("this_month");
  const salesThisMonth = AppState.sales.filter(s => getSaleDate(s) >= monthRange.start).reduce((sum, s) => sum + s.valor, 0);
  const remainingGoal = Math.max(0, monthlyGoal - salesThisMonth);
  const remainingWorkingDays = countRemainingWorkingDays();
  const dailyGoal = remainingWorkingDays > 0 ? remainingGoal / remainingWorkingDays : remainingGoal;
  const soldToday = AppState.sales.filter(s => getSaleDate(s) >= getDateRange("today").start).reduce((sum, s) => sum + s.valor, 0);
  const dailyProgress = dailyGoal > 0 ? (soldToday / dailyGoal) * 100 : (soldToday > 0 ? 100 : 0);
  return { goal: dailyGoal, soldToday, progress: Math.min(100, dailyProgress) };
}

function countRemainingWorkingDays() {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const feriados = (AppState.settings.feriados || []).map(f => new Date(f + "T12:00:00").toDateString());
  let workingDays = 0;
  let loopDay = new Date(today);
  while (loopDay <= endOfMonth) {
    if (loopDay.getDay() !== 0 && !feriados.includes(loopDay.toDateString())) {
      workingDays++;
    }
    loopDay.setDate(loopDay.getDate() + 1);
  }
  return workingDays > 0 ? workingDays : 1;
}

function updateCashSummary() {
  const cashTodayEl = document.getElementById("dashboard-cash-today");
  const cashSummaryEl = document.getElementById("dashboard-cash-summary");
  if (!cashSummaryEl || !cashTodayEl) return;

  const vendasDinheiroHoje = AppState.sales.filter(s => getSaleDate(s) >= getDateRange("today").start && s.formaPagamento === "Dinheiro").reduce((sum, s) => sum + s.valor, 0);
  cashTodayEl.innerHTML =
    `<h5 class="card-title">Vendas do Dia (Dinheiro)</h5><h3 class="fw-bold text-success">${formatCurrency(vendasDinheiroHoje)}</h3><p class="text-muted mb-0 small">Total recebido em dinheiro hoje.</p>`;

  const totalDinheiroHistorico = AppState.sales.filter(s => s.formaPagamento === "Dinheiro").reduce((sum, s) => sum + s.valor, 0);
  const totalDepositosHistorico = AppState.deposits.reduce((sum, d) => sum + d.valor, 0);
  const totalGastosHistorico = AppState.expenses.reduce((sum, g) => sum + g.valor, 0);
  const saldoCaixaAtual = totalDinheiroHistorico - totalDepositosHistorico - totalGastosHistorico;
  cashSummaryEl.innerHTML = `
    <h5 class="card-title">Saldo de Caixa Atual</h5>
    <h3 class="fw-bold ${saldoCaixaAtual >= 0 ? "text-primary" : "text-danger"}">${formatCurrency(saldoCaixaAtual)}</h3>
    <ul class="list-group list-group-flush small mt-2">
      <li class="list-group-item d-flex justify-content-between px-0"><span><i class="bi bi-box-arrow-in-up text-success"></i> Entradas (Dinheiro):</span> <span>${formatCurrency(totalDinheiroHistorico)}</span></li>
      <li class="list-group-item d-flex justify-content-between px-0"><span><i class="bi bi-box-arrow-down text-info"></i> Saídas (depósitos):</span> <span>-${formatCurrency(totalDepositosHistorico)}</span></li>
      <li class="list-group-item d-flex justify-content-between px-0"><span><i class="bi bi-box-arrow-up text-danger"></i> Saídas (Gastos):</span> <span>-${formatCurrency(totalGastosHistorico)}</span></li>
    </ul>`;
}

function updateChart(canvasId, chartInstance, type, data, config = {}, extraOptions = {}) {
  const chartEl = document.getElementById(canvasId);
  if (!chartEl) return null;
  if (chartInstance) chartInstance.destroy();

  const chartWrapper = chartEl.parentElement;
  const noDataEl = chartWrapper.querySelector(".no-data-message");

  if (!data || !data.labels?.length || data.values.every(v => v === 0)) {
    if (!noDataEl) {
      chartEl.style.display = "none";
      const messageDiv = document.createElement("div");
      messageDiv.className = "no-data-message text-center text-muted position-absolute top-50 start-50 translate-middle";
      messageDiv.textContent = "Sem dados para exibir.";
      chartWrapper.appendChild(messageDiv);
    }
    return null;
  }

  if (noDataEl) {
    noDataEl.remove();
    chartEl.style.display = "block";
  }

  const defaultPalette = ["#0891b2","#16a34a","#0ea5e9","#f59e0b","#ef4444","#6366f1","#6b7280"];
  const colors = config.backgroundColor || (type === "doughnut" || type === "bar" ? data.labels.map((_, i) => defaultPalette[i % defaultPalette.length]) : undefined);
  const isDark = document.body.classList.contains("dark-mode");
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  const textColor = isDark ? "#f1f5f9" : "#4b5563";

  const baseOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
      x: { grid: { color: gridColor }, ticks: { color: textColor } }
    }
  };
  const chartOptions = { ...baseOptions, ...extraOptions };
  if (extraOptions.indexAxis === "y") {
    chartOptions.scales.y.grid.display = false;
  }
  if (type === "doughnut") {
    delete chartOptions.scales;
  }

  return new Chart(chartEl.getContext("2d"), {
    type,
    data: { labels: data.labels, datasets: [{ ...config, data: data.values, backgroundColor: colors, borderColor: colors, borderWidth: 1 }] },
    options: chartOptions
  });
}

function getWeekRange() {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { start: startOfWeek, end: endOfWeek };
}

function updateWeeklyGoals() {
  const goalsContainer = document.getElementById("sales-goals-section");
  if (!goalsContainer) return;

  const productsWithGoal = AppState.products.filter(p => p.metaSemanal > 0);
  if (productsWithGoal.length === 0) {
    goalsContainer.innerHTML = `<p class="text-muted col-12">Nenhum produto com meta semanal definida.</p>`;
    return;
  }

  const { start, end } = getWeekRange();
  const salesThisWeek = AppState.sales.filter(s => { const d = getSaleDate(s); return d && d >= start && d <= end; });

  const progressBySeller = AppState.vendedores.reduce((acc, vendedor) => {
    acc[vendedor.nome] = productsWithGoal.map(p => ({ nome: p.nome, meta: p.metaSemanal, count: 0 }));
    return acc;
  }, {});

  salesThisWeek.forEach(sale => {
    if (progressBySeller[sale.vendedor] && sale.produtos) {
      sale.produtos.forEach(saleProd => {
        const productInfo = AppState.products.find(p => p.id === saleProd.produtoId);
        if (productInfo) {
          const goalProduct = progressBySeller[sale.vendedor].find(p => p.nome === productInfo.nome);
          if (goalProduct) goalProduct.count++;
        }
      });
    }
  });

  goalsContainer.innerHTML = Object.entries(progressBySeller).map(([vendedor, products]) => `
    <div class="col-lg-4 col-md-6 mb-3">
      <div class="card h-100"><div class="card-body">
        <h6 class="card-title">${vendedor}</h6>
        ${products.map(({ nome, count, meta }) => {
          const percentage = meta > 0 ? Math.min(100, (count / meta) * 100) : 0;
          return `<div class="mb-2">
            <div class="d-flex justify-content-between small"><span>${nome}</span><strong>${count} / ${meta}</strong></div>
            <div class="progress" style="height: 10px;"><div class="progress-bar ${percentage >= 100 ? "bg-success" : ""}" style="width: ${percentage}%;"></div></div>
          </div>`;
        }).join("")}
      </div></div>
    </div>`).join("");
}

function aggregateSalesByTime(sales, period, customStart, customEnd) {
  const result = new Map();
  const diffDays = (customEnd - customStart) / 86400000;

  const getLabel = d => {
    if (period === "custom" && diffDays > 31) return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    if (period === "this_year") return d.toLocaleDateString("pt-BR", { month: "short" });
    if (period === "this_month" || (period === "custom" && diffDays <= 31)) return d.getDate().toString();
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  const { start, end } = period === "custom" ? { start: customStart, end: customEnd } : getDateRange(period);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    result.set(getLabel(d), 0);
  }

  sales.forEach(s => {
    const date = getSaleDate(s);
    if (!date) return;
    const label = getLabel(date);
    if (result.has(label)) {
      result.set(label, result.get(label) + s.valor);
    }
  });

  return { labels: [...result.keys()], values: [...result.values()] };
}

function startTour() {
  localStorage.setItem("brtest_tour_completed", "true");
  const tourModalEl = document.getElementById("tour-modal");
  const tourModal = bootstrap.Modal.getInstance(tourModalEl) || new bootstrap.Modal(tourModalEl);
  const titleEl = document.getElementById("tour-modal-title");
  const contentEl = document.getElementById("tour-modal-content");
  const footerEl = document.getElementById("tour-modal-footer");

  let currentStep = 0;
  const steps = [
    { title: "Navegação Principal", content: "Use este menu à esquerda para navegar entre as seções principais do painel, como Dashboard, Lançamentos e Configurações." },
    { title: "Lançamento Rápido", content: "No Dashboard, você pode usar o botão \"Lançamento Rápido\" para adicionar uma nova venda de forma ágil.", action: () => {} },
    { title: "Configurações", content: "É aqui que você gerencia seus Vendedores, Produtos e Formas de Pagamento. Manter esses dados atualizados é essencial para o funcionamento do painel.", action: () => {} },
    { title: "Fim do Guia!", content: "Você aprendeu o básico! Explore as seções para descobrir mais funcionalidades. Bom trabalho!" }
  ];

  function showStep(stepIndex) {
    const step = steps[stepIndex];
    if (!step) { tourModal.hide(); return; }

    step.action?.();

    titleEl.textContent = `Guia Rápido (${stepIndex + 1}/${steps.length})`;
    contentEl.innerHTML = `<p class="fs-5">${step.content}</p>`;
    footerEl.innerHTML = `
      ${stepIndex > 0 ? '<button id="tour-prev" class="btn btn-secondary me-auto">Anterior</button>' : ''}
      <button id="tour-next" class="btn btn-primary">${stepIndex === steps.length - 1 ? "Finalizar" : "Próximo"}</button>
    `;

    document.getElementById("tour-next").onclick = () => showStep(stepIndex + 1);
    if (stepIndex > 0) document.getElementById("tour-prev").onclick = () => showStep(stepIndex - 1);
  }

  showStep(0);
  if (!tourModalEl.classList.contains("show")) tourModal.show();
}

function updateSalesRace() {
  const card = document.getElementById('sales-race-card');
  if (!card) return;

  const { start, end } = getDateRange('this_month');
  const sales = AppState.sales.filter(s => {
    const d = getSaleDate(s);
    return d && d >= start && d <= end;
  });

  const totalBySeller = sales.reduce((acc, s) => {
    acc[s.vendedor] = (acc[s.vendedor] || 0) + s.valor;
    return acc;
  }, {});

  const entries = Object.entries(totalBySeller).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    card.innerHTML = '<p class="text-muted mb-0">Sem dados para exibir.</p>';
    return;
  }

  const max = entries[0][1] || 1;

  card.innerHTML = entries.map(([name, value]) => {
    const pct = Math.round((value / max) * 100);
    const color = AppState.vendedores.find(v => v.nome === name)?.cor || '#0d6efd';
    return `
      <div class="mb-2">
        <div class="d-flex justify-content-between small">
          <span>${name}</span><strong>${formatCurrency(value)}</strong>
        </div>
        <div class="progress" style="height:10px;">
          <div class="progress-bar" style="width:${pct}%;background-color:${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}
