import { AppState, updateAppState } from "../app/state.js";
import { showToast, openModal, closeModal, confirmAction } from "../app/ui.js";
import { debounce, formatCurrency, getSaleDate, createElement } from "../utils/helpers.js";
import { exportData } from "../utils/reports.js";
import {
  serverTimestamp,
  Timestamp,
  runTransaction,
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where
} from "../services/firebaseService.js";
import { COLLECTIONS, DEFAULTS } from "../utils/constants.js";

let vendasSortState = { key: "data", order: "desc" };
let lastVisibleDoc = null;
let isLoadingMore = false;
let allSalesLoaded = false;
let currentSalesQuery = null;

export function bindVendasGlobal() {
    const vendaModalEl = document.getElementById("vendaModal");
    if(!vendaModalEl) return;

    vendaModalEl.addEventListener("click", (e) => {
      if (e.target.id === "add-produto-venda-btn") addProductSaleRow();
      if (e.target.id === "add-pagamento-venda-btn") addPaymentRow();

      if (e.target.closest(".remove-produto-venda-btn")) {
        e.target.closest(".produto-venda-item").remove();
        updateVendaTotals();
      }
      if (e.target.closest(".remove-pagamento-venda-btn")) {
        e.target.closest(".pagamento-venda-item").remove();
        updateVendaTotals();
      }
    });

    vendaModalEl.addEventListener("change", (e) => {
      const target = e.target;
      if (target.name === "venda-produto-base") {
        const row = target.closest('.produto-venda-item');
        const variacaoSelect = row.querySelector('select[name="venda-produto-variacao"]');
        populateVariationsDropdown(target.value, variacaoSelect, row);
      }
      if (target.name === "venda-produto-variacao") {
        const row = target.closest('.produto-venda-item');
        const priceInput = row.querySelector('input[name="venda-produto-preco"]');
        const selectedOption = target.options[target.selectedIndex];
        if (priceInput && selectedOption) {
            priceInput.value = selectedOption.dataset.preco || 0;
            updateVendaTotals();
        }
      }
      if (target.id === "venda-is-test") {
        updateVendaTotals();
      }
    });

     vendaModalEl.addEventListener("input", (e) => {
      const target = e.target;
      if (target.classList.contains('pagamento-valor') || target.classList.contains('venda-produto-preco')) {
        updateVendaTotals();
      }
    });
    
    document.getElementById("venda-form")?.addEventListener("submit", handleSaveVenda);
}

export function renderVendasSection(updateOnly = false) {
  const contentEl = document.getElementById("vendas-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="card"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="d-flex gap-2 flex-wrap">
            <input type="text" id="vendas-search" class="form-control" placeholder="Pesquisar por Nota Fiscal..." style="max-width: 250px;">
            <select id="vendas-filter-vendedor" class="form-select" aria-label="Filtrar por Vendedor" style="max-width: 200px;"></select>
            <select id="vendas-filter-pagamento" class="form-select" aria-label="Filtrar por Forma de Pagamento" style="max-width: 200px;"></select>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-danger" id="export-pdf-btn" title="Exportar para PDF"><i class="bi bi-file-earmark-pdf-fill"></i></button>
            <button class="btn btn-outline-success" id="export-excel-btn" title="Exportar para Excel"><i class="bi bi-file-earmark-excel-fill"></i></button>
            <button class="btn btn-primary" data-action="open-venda-modal"><i class="bi bi-plus-circle-fill me-2"></i>Nova Venda</button>
          </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th style="cursor: pointer;" data-sort="data">Data <i class="bi bi-arrow-down-up small"></i></th>
                        <th style="cursor: pointer;" data-sort="vendedor">Vendedor / Nota <i class="bi bi-arrow-down-up small"></i></th>
                        <th>Produto(s)</th>
                        <th style="cursor: pointer;" data-sort="valor">Valor <i class="bi bi-arrow-down-up small"></i></th>
                        <th>Pagamento(s)</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="vendas-table-body"></tbody>
            </table>
        </div>
        <div id="vendas-pagination-container" class="text-center mt-3"></div>
      </div></div>
    `;

    const resetAndLoad = () => {
        lastVisibleDoc = null;
        allSalesLoaded = false;
        const tableBody = document.getElementById('vendas-table-body');
        const paginationContainer = document.getElementById('vendas-pagination-container');
        if (tableBody) tableBody.replaceChildren(...generateSkeletonRows(DEFAULTS.itemsPerPage));
        if (paginationContainer) paginationContainer.innerHTML = '';
        loadSales(true);
    };

    contentEl.querySelector("#export-pdf-btn").addEventListener("click", () => exportData("pdf", "vendas", AppState));
    contentEl.querySelector("#export-excel-btn").addEventListener("click", () => exportData("excel", "vendas", AppState));
    contentEl.querySelector("#vendas-search").addEventListener("input", debounce(resetAndLoad, 500));
    ["#vendas-filter-vendedor", "#vendas-filter-pagamento"].forEach(sel =>
      contentEl.querySelector(sel).addEventListener("change", resetAndLoad)
    );

    contentEl.addEventListener("click", (e) => {
        const header = e.target.closest("th[data-sort]");
        if (header) {
            const sortKey = header.dataset.sort;
            if (vendasSortState.key === sortKey) {
                vendasSortState.order = vendasSortState.order === 'asc' ? 'desc' : 'asc';
            } else {
                vendasSortState.key = sortKey;
                vendasSortState.order = 'desc';
            }
            resetAndLoad();
            return;
        }

        const actionBtn = e.target.closest("button[data-action]");
        if (!actionBtn) return;
        const { action, id } = actionBtn.dataset;
        
        if (action === "open-venda-modal") openVendaModal();
        else if (action === "edit") editVenda(id);
        else if (action === "delete") {
            const row = actionBtn.closest('tr');
            handleDeleteVenda(id, row);
        }
    });
  }

  const vendedorFilterEl = document.getElementById("vendas-filter-vendedor");
  if (vendedorFilterEl) {
      if (AppState.currentUserRole === 'admin') {
          vendedorFilterEl.style.display = 'block';
          updateDropdowns("vendas-filter-vendedor", AppState.vendedores, "Todos os Vendedores");
      } else {
          vendedorFilterEl.style.display = 'none';
      }
  }

  updateDropdowns("vendas-filter-pagamento", AppState.formasPagamento, "Todas as Formas");
  
  const resetAndLoad = () => {
    lastVisibleDoc = null;
    allSalesLoaded = false;
    const tableBody = document.getElementById('vendas-table-body');
    const paginationContainer = document.getElementById('vendas-pagination-container');
    if (tableBody) tableBody.replaceChildren(...generateSkeletonRows(DEFAULTS.itemsPerPage));
    if (paginationContainer) paginationContainer.innerHTML = '';
    loadSales(true);
  };
  resetAndLoad();
}

export function setVendasFilters(filters) {
    if(filters.vendedor && AppState.currentUserRole === 'admin') {
      document.getElementById("vendas-filter-vendedor").value = filters.vendedor;
    }
    if(filters.search) document.getElementById("vendas-search").value = filters.search;
    
    const resetAndLoad = () => {
        lastVisibleDoc = null;
        allSalesLoaded = false;
        document.getElementById('vendas-table-body').innerHTML = generateSkeletonRows(DEFAULTS.itemsPerPage);
        document.getElementById('vendas-pagination-container').innerHTML = '';
        loadSales(true);
    };
    resetAndLoad();
}

async function loadSales(isInitialLoad = false) {
    if (isLoadingMore || (allSalesLoaded && !isInitialLoad)) return;
    isLoadingMore = true;

    const paginationContainer = document.getElementById('vendas-pagination-container');
    const tableBody = document.getElementById('vendas-table-body');
    const loadMoreBtn = document.getElementById('load-more-vendas');

    if (loadMoreBtn) loadMoreBtn.disabled = true;
    if (!isInitialLoad) {
        paginationContainer.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">A carregar...</span></div>`;
    }

    try {
        const { getDbInstance } = await import("../services/firebaseService.js");
        const db = getDbInstance();
        
        const vendedorFilterDropdown = document.getElementById("vendas-filter-vendedor")?.value || "";
        const pagamentoFilter = document.getElementById("vendas-filter-pagamento")?.value || "";
        const searchTerm = document.getElementById("vendas-search")?.value.trim() || "";

        let constraints = [orderBy(vendasSortState.key, vendasSortState.order)];
        
        if (AppState.currentUserRole === 'admin') {
            if (vendedorFilterDropdown) constraints.push(where("vendedor", "==", vendedorFilterDropdown));
        } else {
            constraints.push(where("vendedor", "==", AppState.currentUser.email));
        }
        
        if (searchTerm) {
            constraints.push(where("notaFiscal", ">=", searchTerm));
            constraints.push(where("notaFiscal", "<=", searchTerm + '\uf8ff'));
        }

        if (lastVisibleDoc && !isInitialLoad) {
            constraints.push(startAfter(lastVisibleDoc));
        }
        constraints.push(limit(DEFAULTS.paginationLimit));
        
        currentSalesQuery = query(collection(db, COLLECTIONS.VENDAS), ...constraints);
        
        const documentSnapshots = await getDocs(currentSalesQuery);
        let newSales = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (pagamentoFilter) {
            newSales = newSales.filter(sale => 
                (sale.formasPagamento || []).some(p => p.metodo === pagamentoFilter) || sale.formaPagamento === pagamentoFilter
            );
        }

        const newSaleElements = newSales.map(generateSaleRowElement);

        if (isInitialLoad) {
            updateAppState({ sales: newSales });
            if (newSales.length > 0) {
                tableBody.replaceChildren(...newSaleElements);
            } else {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5">Nenhum lançamento encontrado.</td></tr>`;
            }
        } else {
            updateAppState({ sales: [...AppState.sales, ...newSales] });
            tableBody.append(...newSaleElements);
        }

        lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];

        if (documentSnapshots.docs.length < DEFAULTS.paginationLimit) {
            allSalesLoaded = true;
            paginationContainer.innerHTML = '<p class="text-muted small mt-3">Todos os lançamentos foram carregados.</p>';
        } else {
            renderLoadMoreButton(paginationContainer);
        }

    } catch (error) {
        console.error("Erro ao carregar vendas:", error);
        showToast("Não foi possível carregar os lançamentos. Verifique os filtros e a consola.", "danger");
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-5">Ocorreu um erro ao carregar os dados. Verifique se os índices do Firestore foram criados.</td></tr>`;
    } finally {
        isLoadingMore = false;
    }
}

function renderLoadMoreButton(container) {
    if (!container) return;
    const button = createElement('button', {
        id: 'load-more-vendas',
        className: 'btn btn-outline-primary',
        textContent: 'Carregar Mais'
    });
    button.onclick = () => loadSales(false);
    container.replaceChildren(button);
}

function generateSaleRowElement(sale) {
    const { valor, id, vendedor, notaFiscal } = sale;
    let rowClass = "";
    if (typeof valor === "number") {
        if (valor === 0) rowClass = "table-row-warning";
        else if (valor > 0 && valor <= 70) rowClass = "table-row-danger";
        else if (valor >= 200 && valor <= 600) rowClass = "table-row-success";
        else if (valor > 600) rowClass = "table-row-info";
    }

    const pagamentos = (sale.formasPagamento || [{ metodo: sale.formaPagamento, valor: sale.valor }])
        .map(p => p ? `${p.metodo} (${formatCurrency(p.valor)})` : '');

    const produtos = Array.isArray(sale.produtos) 
        ? sale.produtos.map(p => {
            const priceDiff = p.precoVendido - p.precoOriginal;
            const extraProfitIcon = priceDiff > 0 ? `<i class="bi bi-arrow-up-circle-fill text-success ms-1" title="Vendido com lucro extra de ${formatCurrency(priceDiff)}"></i>` : '';
            const title = `${p.nomeCompleto} ${p.modeloNome || ''} | Vendido por: ${formatCurrency(p.precoVendido)} (Base: ${formatCurrency(p.precoOriginal)})`;
            
            return createElement('div', { 
                className: 'text-truncate d-flex align-items-center', 
                style: 'max-width: 250px;', 
                title: title,
                innerHTML: `<span>${p.nomeCompleto} ${p.modeloNome || ''}</span>${extraProfitIcon}`
            });
        })
        : [document.createTextNode("N/A")];
    
    return createElement('tr', { className: rowClass, dataset: { id } }, [
        createElement('td', { textContent: getSaleDate(sale)?.toLocaleDateString("pt-BR") || "Data Inválida" }),
        createElement('td', { innerHTML: `${vendedor || ""} <br> <small class="text-muted">${notaFiscal || ""}</small>` }),
        createElement('td', {}, produtos),
        createElement('td', { textContent: formatCurrency(valor) }),
        createElement('td', { innerHTML: pagamentos.join('<br>') }),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'edit', id }, ariaLabel: 'Editar Venda' }, [createElement('i', { className: 'bi bi-pencil-fill' })]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', id }, ariaLabel: 'Excluir Venda' }, [createElement('i', { className: 'bi bi-trash-fill' })])
        ])
    ]);
}

function generateSkeletonRows(count) {
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push(createElement('tr', {}, [
            createElement('td', {}, [createElement('span', { className: 'placeholder col-8' })]),
            createElement('td', {}, [createElement('span', { className: 'placeholder col-10' })]),
            createElement('td', {}, [createElement('span', { className: 'placeholder col-12' })]),
            createElement('td', {}, [createElement('span', { className: 'placeholder col-6' })]),
            createElement('td', {}, [createElement('span', { className: 'placeholder col-7' })]),
            createElement('td', { className: 'actions-cell' }, [createElement('span', { className: 'placeholder col-12' })]),
        ]));
    }
    return rows;
}

function updateDropdowns(elementId, items, defaultOptionText = "") {
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;
    const options = items.map(item => createElement('option', { value: item.nome, textContent: item.nome }));
    dropdown.replaceChildren(
        createElement('option', { value: '', textContent: defaultOptionText }),
        ...options
    );
}

export function openVendaModal(saleId = null, saleData = null) {
  if (AppState.products.length === 0) return showToast("A carregar produtos. Tente novamente.", "info");

  const form = document.getElementById("venda-form");
  form?.reset();
  document.getElementById("venda-id").value = saleId || "";
  document.getElementById("vendaModalLabel").textContent = saleId ? "Editar Venda" : "Nova Venda";
  document.getElementById("produtos-venda-container").innerHTML = "";
  document.getElementById("pagamentos-venda-container").innerHTML = "";
  
  const vendedorSelect = document.getElementById("venda-vendedor");
  updateDropdowns("venda-vendedor", AppState.vendedores, "Selecione...");

  if (AppState.currentUserRole === 'vendedor') {
      vendedorSelect.value = AppState.currentUser.email;
      vendedorSelect.disabled = true;
  } else {
      vendedorSelect.disabled = false;
  }

  if (saleId && saleData) {
    const saleDate = getSaleDate(saleData);
    if (saleDate) document.getElementById("venda-data").value = saleDate.toISOString().split("T")[0];
    document.getElementById("venda-vendedor").value = saleData.vendedor;
    document.getElementById("venda-observacao").value = saleData.observacao || "";
    document.getElementById("venda-nota-fiscal").value = saleData.notaFiscal || "";
    document.getElementById("venda-is-test").checked = saleData.valor === 0;

    saleData.produtos?.forEach(p => addProductSaleRow(p));
    (saleData.formasPagamento || []).forEach(p => addPaymentRow(p));
  } else {
    document.getElementById("venda-data").valueAsDate = new Date();
    addProductSaleRow();
    addPaymentRow();
  }
  updateVendaTotals();
  openModal("vendaModal");
}

function addProductSaleRow(produtoInfo = null) {
    const container = document.getElementById("produtos-venda-container");
    const newRow = document.createElement("div");
    newRow.className = "row align-items-center mb-2 produto-venda-item";
    const productOptions = AppState.products.map(p => createElement('option', { value: p.id, textContent: p.nome }));
    const modelOptions = AppState.modelosCelular.map(m => createElement('option', { value: m.id, textContent: `${m.marca} - ${m.modelo}` }));

    const selectProduct = createElement('select', { className: 'form-select', name: 'venda-produto-base', required: true }, [createElement('option', { value: '', textContent: 'Selecione...' }), ...productOptions]);
    const selectVariation = createElement('select', { className: 'form-select', name: 'venda-produto-variacao', required: true }, [createElement('option', { value: '', textContent: 'Selecione...' })]);
    const inputPrice = createElement('input', {type: 'number', step: '0.01', name: 'venda-produto-preco', className: 'form-control venda-produto-preco', placeholder: 'Preço Unit.', required: true});
    const selectModel = createElement('select', { className: 'form-select', name: 'venda-produto-modelo' }, [createElement('option', { value: '', textContent: 'Nenhum modelo...' }), ...modelOptions]);
    
    newRow.append(
        createElement('div', { className: 'col-md-3' }, [selectProduct]),
        createElement('div', { className: 'col-md-3' }, [selectVariation]),
        createElement('div', { className: 'col-md-2' }, [inputPrice]),
        createElement('div', { className: 'col-md-3' }, [selectModel]),
        createElement('div', { className: 'col-md-1 text-end' }, [
            createElement('button', { type: 'button', className: 'btn btn-sm btn-outline-danger remove-produto-venda-btn', ariaLabel: 'Remover' }, [
                createElement('i', { className: 'bi bi-trash' })
            ])
        ])
    );
    container.appendChild(newRow);

    if (produtoInfo) {
        selectProduct.value = produtoInfo.produtoId;
        populateVariationsDropdown(produtoInfo.produtoId, selectVariation, newRow);
        selectVariation.value = produtoInfo.variacaoIdx;
        inputPrice.value = produtoInfo.precoVendido !== undefined ? produtoInfo.precoVendido : produtoInfo.precoOriginal;
        if (produtoInfo.modeloId) selectModel.value = produtoInfo.modeloId;
    }
}

function addPaymentRow(pagamentoInfo = null) {
    const container = document.getElementById("pagamentos-venda-container");
    const newRow = document.createElement("div");
    newRow.className = "row align-items-center mb-2 pagamento-venda-item";
    const paymentOptions = AppState.formasPagamento.map(p => createElement('option', { value: p.nome, textContent: p.nome }));

    const selectMethod = createElement('select', { className: 'form-select pagamento-metodo', required: true }, [createElement('option', { value: '', textContent: 'Selecione o método...' }), ...paymentOptions]);
    const inputValue = createElement('input', { type: 'number', step: '0.01', className: 'form-control pagamento-valor', placeholder: 'Valor', required: true });

    newRow.append(
        createElement('div', { className: 'col-md-6' }, [selectMethod]),
        createElement('div', { className: 'col-md-5' }, [inputValue]),
        createElement('div', { className: 'col-md-1 text-end' }, [
            createElement('button', { type: 'button', className: 'btn btn-sm btn-outline-danger remove-pagamento-venda-btn', ariaLabel: 'Remover' }, [
                createElement('i', { className: 'bi bi-trash' })
            ])
        ])
    );
    container.appendChild(newRow);

    if (pagamentoInfo) {
        selectMethod.value = pagamentoInfo.metodo;
        inputValue.value = pagamentoInfo.valor;
    }
}

function populateVariationsDropdown(baseProductId, variacaoSelect, row) {
  const produto = AppState.products.find(p => p.id === baseProductId);
  const options = produto?.variacoes?.map((v, i) => 
    createElement('option', { value: i, textContent: `${v.nome} (Est: ${v.estoque})`, dataset: { preco: v.preco || 0 } })
  ) || [];
  
  variacaoSelect.replaceChildren(
      createElement('option', { value: '', textContent: 'Selecione...' }),
      ...options
  );
  variacaoSelect.disabled = !produto;

  const priceInput = row.querySelector('input[name="venda-produto-preco"]');
  priceInput.value = '';
}

function updateVendaTotals() {
    let totalProdutos = 0;
    document.querySelectorAll(".produto-venda-item").forEach(row => {
        const price = parseFloat(row.querySelector('input[name="venda-produto-preco"]').value) || 0;
        totalProdutos += price;
    });

    const isTest = document.getElementById("venda-is-test").checked;
    const valorFinalVenda = isTest ? 0 : totalProdutos;

    let totalPago = 0;
    document.querySelectorAll(".pagamento-venda-item").forEach(row => {
        const valor = parseFloat(row.querySelector('.pagamento-valor').value) || 0;
        totalPago += valor;
    });

    document.getElementById('venda-valor-total').value = formatCurrency(valorFinalVenda);
    const restante = valorFinalVenda - totalPago;
    document.getElementById('venda-valor-restante').value = formatCurrency(restante);
}

export function editVenda(id) {
  const sale = AppState.sales.find(s => s.id === id);
  if (!sale) return showToast("Venda não encontrada.", "danger");

  if (AppState.currentUserRole === 'vendedor' && sale.vendedor !== AppState.currentUser.email) {
      return showToast("Não tem permissão para editar esta venda.", "danger");
  }

  openVendaModal(id, sale);
}

function createStockHistoryEntry(transaction, db, productId, variacaoIdx, variacaoNome, oldStock, newStock, reason, saleId = null) {
    const historyRef = doc(collection(db, COLLECTIONS.HISTORICO_ESTOQUE));
    transaction.set(historyRef, {
        productId: productId,
        variacaoIdx: variacaoIdx,
        variacaoNome: variacaoNome,
        quantidadeAnterior: oldStock,
        quantidadeNova: newStock,
        alteracao: newStock - oldStock,
        motivo: reason,
        vendaId: saleId,
        usuarioId: AppState.currentUser.uid,
        data: serverTimestamp()
    });
}

async function handleSaveVenda(e) {
  e.preventDefault();
  
  const id = document.getElementById("venda-id").value;
  const isUpdate = !!id;

  const vendedor = document.getElementById("venda-vendedor").value;
  if (!vendedor) return showToast("Selecione um vendedor.", "warning");
  
  const valorRestanteStr = document.getElementById('venda-valor-restante').value;
  const valorRestante = parseFloat(valorRestanteStr.replace(/[^0-9,-]+/g, "").replace(",", "."));
  if (Math.abs(valorRestante) > 0.01) return showToast("O valor pago deve ser igual ao valor total da venda.", "warning");

  const produtosDaVenda = Array.from(document.querySelectorAll(".produto-venda-item")).map(row => {
    const baseProductId = row.querySelector('select[name="venda-produto-base"]').value;
    const variacaoIndexStr = row.querySelector('select[name="venda-produto-variacao"]').value;
    if (!baseProductId || variacaoIndexStr === "") return null;

    const produtoBase = AppState.products.find(p => p.id === baseProductId);
    const variacaoIndex = parseInt(variacaoIndexStr);
    const variacao = produtoBase.variacoes[variacaoIndex];
    
    const modeloSelect = row.querySelector('select[name="venda-produto-modelo"]');
    const precoVendido = parseFloat(row.querySelector('input[name="venda-produto-preco"]').value);
    
    return {
      produtoId: baseProductId,
      variacaoIdx: variacaoIndex,
      nomeCompleto: `${produtoBase.nome} - ${variacao.nome}`,
      modeloId: modeloSelect.value || null,
      modeloNome: modeloSelect.value ? modeloSelect.options[modeloSelect.selectedIndex].text : null,
      precoOriginal: variacao.preco || 0,
      precoVendido: precoVendido
    };
  }).filter(Boolean);

  const pagamentosDaVenda = Array.from(document.querySelectorAll(".pagamento-venda-item")).map(row => {
    const metodo = row.querySelector('.pagamento-metodo').value;
    const valor = parseFloat(row.querySelector('.pagamento-valor').value);
    if (!metodo || isNaN(valor) || valor <= 0) return null;
    return { metodo, valor };
  }).filter(Boolean);

  if(produtosDaVenda.length === 0) return showToast("Adicione pelo menos um produto à venda.", "warning");
  if(pagamentosDaVenda.length === 0 && !document.getElementById("venda-is-test").checked) return showToast("Adicione pelo menos uma forma de pagamento com valor maior que zero.", "warning");

  const valorTotal = produtosDaVenda.reduce((sum, p) => sum + p.precoVendido, 0);
  const metodosDePagamento = [...new Set(pagamentosDaVenda.map(p => p.metodo))];

  const saleData = {
    data: Timestamp.fromDate(new Date(document.getElementById("venda-data").value + "T12:00:00")),
    vendedor,
    valor: document.getElementById("venda-is-test").checked ? 0 : valorTotal,
    notaFiscal: document.getElementById("venda-nota-fiscal").value.trim(),
    produtos: produtosDaVenda,
    formasPagamento: pagamentosDaVenda,
    metodosDePagamento,
    observacao: document.getElementById("venda-observacao").value
  };
  
  const submitButton = document.querySelector('#vendaModal button[form="venda-form"]');
  const originalButtonText = submitButton.innerHTML;
  if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> A salvar...`;
  }

  try {
    const { getDbInstance } = await import("../services/firebaseService.js");
    const db = getDbInstance();
    const saleRef = isUpdate ? doc(db, COLLECTIONS.VENDAS, id) : doc(collection(db, COLLECTIONS.VENDAS));

    await runTransaction(db, async (transaction) => {
        let oldSaleData = null;
        if (isUpdate) {
            const oldSaleDoc = await transaction.get(saleRef);
            if (!oldSaleDoc.exists()) throw new Error("Venda não encontrada para atualização.");
            oldSaleData = oldSaleDoc.data();
        }

        if (oldSaleData && oldSaleData.produtos) {
            for (const p of oldSaleData.produtos) {
                const productRef = doc(db, COLLECTIONS.PRODUTOS, p.produtoId);
                const productDoc = await transaction.get(productRef);
                if (productDoc.exists()) {
                    const productData = productDoc.data();
                    const newVariations = [...productData.variacoes];
                    const variacao = newVariations[p.variacaoIdx];
                    if (variacao) {
                        const oldStock = variacao.estoque;
                        variacao.estoque += 1;
                        createStockHistoryEntry(transaction, db, p.produtoId, p.variacaoIdx, variacao.nome, oldStock, variacao.estoque, 'Edição de Venda (Reversão)', id);
                        transaction.update(productRef, { variacoes: newVariations });
                    }
                }
            }
        }

        for (const p of saleData.produtos) {
            const productRef = doc(db, COLLECTIONS.PRODUTOS, p.produtoId);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) throw new Error(`Produto ${p.nomeCompleto} não encontrado.`);
            
            const productData = productDoc.data();
            const newVariations = [...productData.variacoes];
            const variacao = newVariations[p.variacaoIdx];
            if (!variacao) throw new Error(`Variação para ${p.nomeCompleto} não encontrada.`);
            if (variacao.estoque < 1) throw new Error(`Stock esgotado para ${p.nomeCompleto}.`);
            
            const oldStock = variacao.estoque;
            variacao.estoque -= 1;
            const reason = isUpdate ? 'Edição de Venda (Aplicação)' : 'Nova Venda';
            createStockHistoryEntry(transaction, db, p.produtoId, p.variacaoIdx, variacao.nome, oldStock, variacao.estoque, reason, saleRef.id);
            transaction.update(productRef, { variacoes: newVariations });
        }
        
        const dataToSave = {
            ...saleData,
            ...(isUpdate 
                ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
                : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() }
            )
        };
        transaction.set(saleRef, dataToSave, { merge: true });
    });

    showToast(`Venda ${id ? "atualizada" : "salva"} com sucesso!`, "success");
    closeModal('vendaModal');
  } catch (error) {
    console.error("Erro ao salvar venda:", error);
    showToast(`Erro ao salvar: ${error.message}`, "danger");
  } finally {
      if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonText;
      }
  }
}

function handleDeleteVenda(id, rowElement) {
    const saleToDelete = AppState.sales.find(s => s.id === id);
    if (!saleToDelete) {
        return showToast("Venda não encontrada.", "danger");
    }

    if (AppState.currentUserRole === 'vendedor' && saleToDelete.vendedor !== AppState.currentUser.email) {
        return showToast("Não tem permissão para excluir esta venda.", "danger");
    }

    confirmAction({
        title: 'Excluir Venda',
        message: 'Tem a certeza que deseja excluir esta venda? O estoque dos produtos será devolvido. Esta ação não pode ser desfeita.',
        confirmText: 'Excluir',
        btnClass: 'btn-danger',
        onConfirm: async () => {
            if (rowElement) {
                rowElement.style.transition = 'opacity 0.5s ease';
                rowElement.style.opacity = '0';
                setTimeout(() => rowElement.remove(), 500);
            }

            const { getDbInstance } = await import("../services/firebaseService.js");
            const db = getDbInstance();
            
            await runTransaction(db, async (transaction) => {
                if (saleToDelete.produtos && saleToDelete.produtos.length > 0) {
                    for (const p of saleToDelete.produtos) {
                        const productRef = doc(db, COLLECTIONS.PRODUTOS, p.produtoId);
                        const productDoc = await transaction.get(productRef);
                        if (productDoc.exists()) {
                            const productData = productDoc.data();
                            const newVariations = [...productData.variacoes];
                            const variacao = newVariations[p.variacaoIdx];
                            if (variacao) {
                                const oldStock = variacao.estoque;
                                variacao.estoque += 1;
                                createStockHistoryEntry(transaction, db, p.produtoId, p.variacaoIdx, variacao.nome, oldStock, variacao.estoque, 'Exclusão de Venda', id);
                                transaction.update(productRef, { variacoes: newVariations });
                            }
                        }
                    }
                }
                transaction.delete(doc(db, COLLECTIONS.VENDAS, id));
            });
        }
    });
}