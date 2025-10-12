import { AppState } from "../app/state.js";
import { formatCurrency, getDateRange, getPreviousDateRange, calculateTrend, getSaleDate, getWeekRange } from "../utils/helpers.js";
import { handleNavigation } from "../app/navigation.js";
import { openModal, showToast } from "../app/ui.js";

export function onAfterAuthDashboard() {
    const tourModalEl = document.getElementById("tour-modal");
    if (!tourModalEl) return;

    const startTourHandler = () => {
        const modalInstance = bootstrap.Modal.getInstance(tourModalEl);
        modalInstance?.hide();
        setTimeout(startTour, 300);
    };

    const dontStartTourHandler = () => {
        localStorage.setItem("brtest_tour_completed", "true");
    };

    tourModalEl.addEventListener('click', (e) => {
        if (e.target.id === 'tour-yes') startTourHandler();
        if (e.target.id === 'tour-no') dontStartTourHandler();
    });

    if (!localStorage.getItem("brtest_tour_completed")) {
        openModal("tour-modal");
    }
}


export function renderDashboardSection(updateOnly = false) {
  const contentEl = document.getElementById("dashboard-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <select id="dashboard-period-filter" class="form-select w-auto" aria-label="Filtrar período do dashboard"><option value="today">Hoje</option><option value="7days">Últimos 7 dias</option><option value="this_month" selected>Este Mês</option><option value="this_year">Este Ano</option><option value="all">Tudo</option><option value="custom">Período Personalizado</option></select>
          <div id="custom-date-range-filter" class="d-none gap-2 align-items-center"><input type="date" id="start-date-filter" class="form-control" aria-label="Data de início"><span>até</span><input type="date" id="end-date-filter" class="form-control" aria-label="Data de fim"><button id="apply-custom-date-filter" class="btn btn-secondary btn-sm">Aplicar</button></div>
          <select id="dashboard-seller-filter" class="form-select w-auto" aria-label="Filtrar por vendedor"></select>
          <button class="btn btn-outline-secondary" id="start-tour-btn" title="Iniciar Guia Rápido"><i class="bi bi-question-circle"></i></button>
        </div>
        <button class="btn btn-primary" data-action="open-venda-modal"><i class="bi bi-plus-circle-fill me-2"></i>Lançamento Rápido</button>
      </div>
      
      <div class="row">
        <div class="col-lg-9">
            <div class="kpi-grid mb-4" id="dashboard-metrics"></div>
            <div class="card mb-4"><div class="card-body" id="sales-race-card"></div></div>
            <div class="card mb-4"><div class="card-header"><h5><i class="bi bi-trophy-fill text-warning me-2"></i>Metas da Semana</h5></div><div class="card-body"><div id="sales-goals-section" class="row"></div></div></div>
        </div>
        <div class="col-lg-3">
            <div class="card card-sidebar mb-4"><div class="card-header" id="low-stock-header"></div><div class="card-body p-3" id="low-stock-card"></div></div>
            <div class="card card-sidebar mb-4"><div class="card-header" id="recent-activity-header"></div><div class="card-body p-3" id="recent-activity-card"></div></div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-7 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title"><i class="bi bi-bar-chart-line-fill text-primary me-2"></i>Faturamento por Período</h5><div class="chart-container"><canvas id="faturamentoChart"></canvas></div></div></div></div>
        <div class="col-lg-5 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title"><i class="bi bi-pie-chart-fill text-info me-2"></i>Vendas por Vendedor</h5><div class="chart-container"><canvas id="vendedorChart"></canvas></div></div></div></div>
      </div>
      <div class="row">
        <div class="col-lg-5 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title"><i class="bi bi-credit-card-fill text-success me-2"></i>Faturamento por Pagamento</h5><div class="chart-container"><canvas id="paymentMethodChart"></canvas></div></div></div></div>
        <div class="col-lg-7 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title"><i class="bi bi-box-seam-fill text-secondary me-2"></i>Top 5 Produtos (Quantidade)</h5><div class="chart-container" style="height: 350px;"><canvas id="topProdutosChart"></canvas></div></div></div></div>
      </div>
    `;

    contentEl.querySelector("#dashboard-period-filter").addEventListener("change", (e) => {
      document.getElementById("custom-date-range-filter").classList.toggle("d-flex", e.target.value === "custom");
      if (e.target.value !== "custom") updateDashboardData();
    });
    contentEl.querySelector("#apply-custom-date-filter").addEventListener("click", updateDashboardData);
    contentEl.querySelector("#dashboard-seller-filter").addEventListener("change", updateDashboardData);
    contentEl.querySelector("#start-tour-btn").addEventListener("click", startTour);
  }

  const sellerFilterEl = document.getElementById("dashboard-seller-filter");
  if (AppState.currentUserRole === 'admin') {
      sellerFilterEl.style.display = 'block';
      sellerFilterEl.innerHTML = '<option value="">Todos os Vendedores</option>';
      AppState.vendedores.forEach(v => sellerFilterEl.innerHTML += `<option value="${v.nome}">${v.nome}</option>`);
  } else {
      sellerFilterEl.style.display = 'none';
  }

  updateDashboardData();
}

let faturamentoChart, vendedorChart, topProdutosChart, paymentMethodChart;

function updateDashboardData() {
  const contentEl = document.getElementById("dashboard-content");
  if (!contentEl) return;

  const period = document.getElementById("dashboard-period-filter").value;
  const sellerFilter = document.getElementById("dashboard-seller-filter").value;

  let start, end;

  if (period === "custom") {
    const startDateValue = document.getElementById("start-date-filter").value;
    const endDateValue = document.getElementById("end-date-filter").value;
    if (!startDateValue || !endDateValue) return showToast("Por favor, selecione as datas de início e fim.", "warning");
    start = new Date(startDateValue + "T00:00:00");
    end = new Date(endDateValue + "T23:59:59");
  } else {
    ({ start, end } = getDateRange(period));
  }
  
  let filteredSales = AppState.sales.filter(s => { 
    const d = getSaleDate(s); 
    const sellerMatch = AppState.currentUserRole === 'admin' ? (!sellerFilter || s.vendedor === sellerFilter) : (s.vendedor === AppState.currentUser.email);
    return d && d >= start && d <= end && sellerMatch;
  });

  const { start: prevStart, end: prevEnd } = getPreviousDateRange(start, end);
  const prevFilteredSales = AppState.sales.filter(s => { 
      const d = getSaleDate(s); 
      const sellerMatch = AppState.currentUserRole === 'admin' ? (!sellerFilter || s.vendedor === sellerFilter) : (s.vendedor === AppState.currentUser.email);
      return d && d >= prevStart && d <= prevEnd && sellerMatch;
  });

  const faturamentoTotal = filteredSales.reduce((sum, s) => sum + s.valor, 0);
  const prevFaturamento = prevFilteredSales.reduce((sum, s) => sum + s.valor, 0);
  const faturamentoTrend = calculateTrend(faturamentoTotal, prevFaturamento);

  const meta = AppState.settings.metaFaturamentoMensal || 50000;
  
  const salesThisMonth = AppState.sales.filter(s => {
      const saleDate = getSaleDate(s);
      const sellerMatch = AppState.currentUserRole === 'admin' ? (!sellerFilter || s.vendedor === sellerFilter) : (s.vendedor === AppState.currentUser.email);
      return saleDate >= getDateRange("this_month").start && sellerMatch;
  });
  const faturamentoMesAtual = salesThisMonth.reduce((sum, s) => sum + s.valor, 0);
  const percentualMeta = meta > 0 ? (faturamentoMesAtual / meta) * 100 : 0;

  document.getElementById("dashboard-metrics").innerHTML = `
    <div class="stat-card">
        <div class="card-body">
            <h6 class="card-subtitle text-muted d-flex align-items-center"><i class="bi bi-cash-coin me-2"></i>Faturamento</h6>
            <h3 class="card-title fw-bold mt-2 mb-0">${formatCurrency(faturamentoTotal)}</h3>
            <small class="${faturamentoTrend.color} mt-1">${faturamentoTrend.text}</small>
        </div>
    </div>
    <div class="stat-card success">
        <div class="card-body">
            <h6 class="card-subtitle text-muted d-flex align-items-center"><i class="bi bi-receipt me-2"></i>Vendas</h6>
            <h3 class="card-title fw-bold mt-2 mb-0">${filteredSales.length}</h3>
        </div>
    </div>
    <div class="stat-card info">
        <div class="card-body">
            <h6 class="card-subtitle text-muted d-flex align-items-center"><i class="bi bi-graph-up-arrow me-2"></i>Ticket Médio</h6>
            <h3 class="card-title fw-bold mt-2 mb-0">${formatCurrency(filteredSales.length > 0 ? faturamentoTotal / filteredSales.length : 0)}</h3>
        </div>
    </div>
    <div class="stat-card warning">
        <div class="card-body">
            <h6 class="card-subtitle text-muted d-flex align-items-center"><i class="bi bi-trophy me-2"></i>Meta Mensal</h6>
            <p class="small mb-0 mt-2">${formatCurrency(faturamentoMesAtual)} / ${formatCurrency(meta)}</p>
            <div class="progress mt-1" style="height: 5px;"><div class="progress-bar bg-warning" style="width: ${percentualMeta}%;"></div></div>
        </div>
    </div>
  `;

  updateSalesRace(sellerFilter);
  updateWeeklyGoals(sellerFilter);
  updateLowStockAlert();
  updateRecentActivity();
  
  const chartClickHandler = (evt, elements, chart) => {
      if (elements.length === 0) return;
      const clickedIndex = elements[0].index;
      const clickedLabel = chart.data.labels[clickedIndex];
      
      switch (chart.canvas.id) {
          case 'vendedorChart':
              if (AppState.currentUserRole === 'admin') {
                  handleNavigation('vendas', { vendedor: clickedLabel });
              }
              break;
          case 'topProdutosChart':
              const baseProduct = clickedLabel.split(' - ')[0];
              handleNavigation('vendas', { search: baseProduct });
              break;
      }
  };

  faturamentoChart = updateChart("faturamentoChart", faturamentoChart, "bar", aggregateSalesByTime(filteredSales, period, start, end), { label: "Faturamento" }, { y: { beginAtZero: true } }, chartClickHandler);

  const salesByVendedor = filteredSales.reduce((acc, s) => { acc[s.vendedor] = (acc[s.vendedor] || 0) + s.valor; return acc; }, {});
  const vendedorLabels = Object.keys(salesByVendedor);
  const vendedorColors = vendedorLabels.map(label => AppState.vendedores.find(v => v.nome === label)?.cor || "#6c757d");
  vendedorChart = updateChart("vendedorChart", vendedorChart, "doughnut", { labels: vendedorLabels, values: Object.values(salesByVendedor) }, { backgroundColor: vendedorColors }, {}, chartClickHandler);

  const salesByPayment = filteredSales.reduce((acc, s) => {
    if (s.formasPagamento && Array.isArray(s.formasPagamento)) {
        s.formasPagamento.forEach(p => {
            acc[p.metodo] = (acc[p.metodo] || 0) + p.valor;
        });
    } 
    else if (s.formaPagamento) {
        acc[s.formaPagamento] = (acc[s.formaPagamento] || 0) + s.valor;
    }
    return acc;
  }, {});
  paymentMethodChart = updateChart("paymentMethodChart", paymentMethodChart, "pie", { labels: Object.keys(salesByPayment), values: Object.values(salesByPayment) }, {}, {}, chartClickHandler);

  const salesByProductQty = filteredSales.reduce((acc, s) => {
    const products = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto) : [s.nomeProduto || "N/A"];
    products.forEach(pName => { acc[pName] = (acc[pName] || 0) + 1; });
    return acc;
  }, {});
  const top5Qty = Object.entries(salesByProductQty).sort(([, a], [, b]) => b - a).slice(0, 5);
  topProdutosChart = updateChart("topProdutosChart", topProdutosChart, "bar", { labels: top5Qty.map(p => p[0]), values: top5Qty.map(p => p[1]) }, { label: "Quantidade Vendida" }, { indexAxis: "y" }, chartClickHandler);
}

function updateChart(canvasId, chartInstance, type, data, config = {}, extraOptions = {}, onClick) {
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
  const colors = config.backgroundColor || (type === "doughnut" || type === "pie" || type === "bar" ? data.labels.map((_, i) => defaultPalette[i % defaultPalette.length]) : undefined);
  const isDark = document.body.classList.contains("dark-mode");
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  const textColor = isDark ? "#f1f5f9" : "#4b5563";

  const tooltipCallbacks = {
      label: function(context) {
          const value = context.raw || 0;
          let label = `${context.dataset.label || ''}: ${formatCurrency(value)}`;
          if (context.chart.canvas.id === 'faturamentoChart' && context.dataset.saleCounts) {
              const count = context.dataset.saleCounts[context.dataIndex];
              return [`Faturamento: ${formatCurrency(value)}`, `${count} venda(s)`];
          }
          return label;
      }
  };

  const baseOptions = {
    responsive: true, maintainAspectRatio: false,
    onClick: onClick,
    plugins: { 
      legend: { labels: { color: textColor } },
      tooltip: { callbacks: tooltipCallbacks }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
      x: { grid: { color: gridColor }, ticks: { color: textColor } }
    }
  };

  const chartOptions = { ...baseOptions, ...extraOptions };
  if (extraOptions.indexAxis === "y") {
    chartOptions.scales.y.grid.display = false;
  }
  if (type === "doughnut" || type === "pie") {
    delete chartOptions.scales;
  }

  const datasets = [{ ...config, data: data.values, backgroundColor: colors, borderColor: colors, borderWidth: 1 }];
  if (canvasId === 'faturamentoChart' && data.counts) {
      datasets[0].saleCounts = data.counts;
  }

  return new Chart(chartEl.getContext("2d"), {
    type,
    data: { labels: data.labels, datasets: datasets },
    options: chartOptions
  });
}

function updateWeeklyGoals(sellerFilter) {
    const goalsContainer = document.getElementById("sales-goals-section");
    if (!goalsContainer) return;

    const productsWithGoal = AppState.products.filter(p => p.metaSemanal > 0);
    if (productsWithGoal.length === 0) {
        goalsContainer.innerHTML = `<p class="text-muted col-12">Nenhum produto com meta semanal definida.</p>`;
        return;
    }

    const { start, end } = getWeekRange();
    const salesThisWeek = AppState.sales.filter(s => { 
        const d = getSaleDate(s); 
        const sellerMatch = AppState.currentUserRole === 'admin' ? (!sellerFilter || s.vendedor === sellerFilter) : (s.vendedor === AppState.currentUser.email);
        return d && d >= start && d <= end && sellerMatch;
    });

    let sellersToDisplay;
    if (AppState.currentUserRole === 'admin') {
        sellersToDisplay = sellerFilter ? AppState.vendedores.filter(v => v.nome === sellerFilter) : AppState.vendedores;
    } else {
        sellersToDisplay = AppState.vendedores.filter(v => v.nome === AppState.currentUser.email);
    }

    const progressBySeller = sellersToDisplay.reduce((acc, vendedor) => {
        if (vendedor) {
            acc[vendedor.nome] = productsWithGoal.map(p => ({ nome: p.nome, meta: p.metaSemanal, count: 0 }));
        }
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

function updateSalesRace(sellerFilter) {
  const card = document.getElementById('sales-race-card');
  if (!card) return;

  const { start, end } = getDateRange('this_month');
  const salesThisMonth = AppState.sales.filter(s => {
    const d = getSaleDate(s);
    return d && d >= start && d <= end;
  });

  let sellersToDisplay;
  if (AppState.currentUserRole === 'admin') {
      sellersToDisplay = sellerFilter ? AppState.vendedores.filter(v => v.nome === sellerFilter) : AppState.vendedores;
  } else {
      sellersToDisplay = AppState.vendedores.filter(v => v.nome === AppState.currentUser.email);
  }

  const totalBySeller = sellersToDisplay.reduce((acc, vendedor) => {
    if (vendedor) {
      acc[vendedor.nome] = { valor: 0, vendedor };
    }
    return acc;
  }, {});

  salesThisMonth.forEach(s => {
    if (totalBySeller[s.vendedor]) {
      totalBySeller[s.vendedor].valor += s.valor;
    }
  });

  const entries = Object.values(totalBySeller).sort((a, b) => b.valor - a.valor);

  if (entries.length === 0 || entries.every(e => e.valor === 0)) {
    card.innerHTML = `<h5><i class="bi bi-flag-fill text-primary me-2"></i>Corrida de Vendas do Mês</h5>
        <div class="text-center p-4"><i class="bi bi-moon-stars fs-1 text-muted"></i><h6 class="mt-3">Ainda não há vendas registadas este mês.</h6></div>`;
    return;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const topSellerValue = entries.length > 0 ? entries[0].valor : 0;

  const projectionFactor = currentDay > 0 ? daysInMonth / currentDay : daysInMonth;
  const projectedMaxValue = topSellerValue * projectionFactor;
  const maxValue = Math.max(projectedMaxValue, topSellerValue, 1);

  card.innerHTML = `<h5><i class="bi bi-flag-fill text-primary me-2"></i>Corrida de Vendas do Mês</h5>` +
    entries.map(({ valor, vendedor }, index) => {
        const percentage = maxValue > 0 ? (valor / maxValue) * 100 : 0;
        let tooltipText = `Valor: ${formatCurrency(valor)}`;
        if (index > 0) {
            const diff = entries[index-1].valor - valor;
            tooltipText += ` | Faltam ${formatCurrency(diff)} para o próximo`;
        }
        const runnerStyle = `left: ${Math.min(100, percentage)}%;`;
        const runnerElement = vendedor.fotoUrl 
            ? `<img src="${vendedor.fotoUrl}" alt="${vendedor.nome}" class="runner runner-photo" style="${runnerStyle}" data-bs-toggle="tooltip" title="${tooltipText}">`
            : `<span class="runner" style="${runnerStyle}" data-bs-toggle="tooltip" title="${tooltipText}">${vendedor.emoji || '👤'}</span>`;

        return `
          <div class="sales-race-container mt-4">
            <div class="d-flex justify-content-between small fw-bold align-items-center">
                <span class="d-flex align-items-center"><i class="bi bi-person-circle me-2"></i>${vendedor.nome}</span>
                <span>${formatCurrency(valor)}</span>
            </div>
            <div class="race-track">
                <div class="race-progress" style="width: ${Math.min(100, percentage)}%; background-color:${vendedor.cor || '#0891b2'};"></div>
                ${runnerElement}
                <div class="finish-line"></div>
                <div class="finish-trophy"><i class="bi bi-trophy-fill text-warning"></i></div>
            </div>
          </div>`;
    }).join('');
    
  [...card.querySelectorAll('[data-bs-toggle="tooltip"]')].forEach(el => new bootstrap.Tooltip(el));
}

function updateLowStockAlert() {
    const cardBody = document.getElementById('low-stock-card');
    if (!cardBody) return;
    
    document.getElementById('low-stock-header').innerHTML = `<h5><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Alerta de Stock</h5>`;

    const LOW_STOCK_THRESHOLD = 5;
    const lowStockItems = [];
    AppState.products.forEach(product => {
        product.variacoes.forEach(variacao => {
            if(variacao.estoque > 0 && variacao.estoque <= LOW_STOCK_THRESHOLD) {
                lowStockItems.push({ name: `${product.nome} - ${variacao.nome}`, stock: variacao.estoque });
            }
        });
    });

    if(lowStockItems.length === 0) {
        cardBody.innerHTML = `<p class="text-muted small mt-2">Nenhum item com stock baixo.</p>`;
    } else {
        cardBody.innerHTML = `<ul class="list-group list-group-flush low-stock-list">` +
        lowStockItems.sort((a, b) => a.stock - b.stock).map(item => `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <span class="small text-truncate" style="max-width: 150px;" title="${item.name}">${item.name}</span>
                <span class="badge bg-danger rounded-pill">${item.stock}</span>
            </li>
        `).join('') + `</ul>`;
    }
}

function updateRecentActivity() {
    const cardBody = document.getElementById('recent-activity-card');
    if(!cardBody) return;
    
    document.getElementById('recent-activity-header').innerHTML = `<h5><i class="bi bi-lightning-fill text-info me-2"></i>Atividade Recente</h5>`;

    const recentSales = [...AppState.sales].sort((a,b) => getSaleDate(b) - getSaleDate(a)).slice(0, 10);

    if(recentSales.length === 0) {
        cardBody.innerHTML = `<p class="text-muted small mt-2">Nenhuma venda recente.</p>`;
    } else {
        cardBody.innerHTML = `<div class="activity-feed"><ul>` +
        recentSales.map(sale => {
            const productText = sale.produtos && sale.produtos.length > 0 ? sale.produtos[0].nomeCompleto : 'Produto';
            const seller = AppState.vendedores.find(v => v.nome === sale.vendedor);
            
            const iconContent = seller?.fotoUrl 
                ? `<img src="${seller.fotoUrl}" alt="${seller.nome}">` 
                : (seller?.emoji || '👤');
            
            const iconStyle = seller?.fotoUrl 
                ? '' 
                : `style="background-color: ${seller?.cor || '#6c757d'}30;"`;

            return `<li>
                <div class="activity-icon" ${iconStyle}>
                    ${iconContent}
                </div>
                <div>
                    <p class="mb-0 small"><strong>${sale.vendedor}</strong> vendeu ${productText}</p>
                    <small class="text-muted">${formatCurrency(sale.valor)} - ${getSaleDate(sale).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
            </li>`;
        }).join('') + `</ul></div>`;
    }
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
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const loopEndDate = end > today ? today : end;

  for (let d = new Date(start); d <= loopEndDate; d.setDate(d.getDate() + 1)) {
    result.set(getLabel(d), { total: 0, count: 0 });
  }

  sales.forEach(s => {
    const date = getSaleDate(s);
    if (!date) return;
    const label = getLabel(date);
    if (result.has(label)) {
      const current = result.get(label);
      current.total += s.valor;
      current.count += 1;
      result.set(label, current);
    }
  });

  return {
    labels: [...result.keys()],
    values: [...result.values()].map(v => v.total),
    counts: [...result.values()].map(v => v.count)
  };
}

function startTour() {
  localStorage.setItem("brtest_tour_completed", "true");
  const tourModalEl = document.getElementById("tour-modal");
  const tourModal = bootstrap.Modal.getOrCreateInstance(tourModalEl);
  const titleEl = document.getElementById("tour-modal-title");
  const contentEl = document.getElementById("tour-modal-content");
  const footerEl = document.getElementById("tour-modal-footer");

  let currentStep = 0;
  const steps = [
    { title: "Navegação Principal", content: "Use este menu à esquerda para navegar entre as seções principais do painel, como Dashboard, Lançamentos e Configurações." },
    { title: "Lançamento Rápido", content: "No Dashboard, pode usar o botão \"Lançamento Rápido\" para adicionar uma nova venda de forma ágil.", action: () => {} },
    { title: "Configurações", content: "É aqui que você gere os seus Vendedores, Produtos e Formas de Pagamento. Manter esses dados atualizados é essencial para o funcionamento do painel.", action: () => {} },
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
  tourModal.show();
}