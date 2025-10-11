import { AppState } from "../app/state.js";
import { showToast, openModal } from "../app/ui.js";
import { debounce, formatCurrency, renderPagination, getSaleDate } from "../utils/helpers.js";
import { exportData } from "../utils/reports.js";
import {
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
  doc,
  collection
} from "../services/firebaseService.js";
import { COLLECTIONS, DEFAULTS } from "../utils/constants.js";

let vendasSortState = { key: "data", order: "desc" };
let currentPage = 1;

export function bindVendasGlobal() {
  // Botões globais (modais e importação) são tratados dentro da própria secção via delegação
}

export function renderVendasSection(updateOnly = false) {
  const contentEl = document.getElementById("vendas-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="card"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="d-flex gap-2 flex-wrap">
            <input type="text" id="vendas-search" class="form-control" placeholder="Pesquisar..." style="max-width: 250px;">
            <select id="vendas-filter-vendedor" class="form-select" style="max-width: 200px;"></select>
            <select id="vendas-filter-pagamento" class="form-select" style="max-width: 200px;"></select>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-danger" id="export-pdf-btn" title="Exportar para PDF"><i class="bi bi-file-earmark-pdf-fill"></i></button>
            <button class="btn btn-outline-success" id="export-excel-btn" title="Exportar para Excel"><i class="bi bi-file-earmark-excel-fill"></i></button>
            <button class="btn btn-outline-secondary" data-action="open-import" data-type="vendas" title="Importar Vendas"><i class="bi bi-upload"></i></button>
            <button class="btn btn-primary" data-action="open-venda-modal"><i class="bi bi-plus-circle-fill me-2"></i>Nova Venda</button>
          </div>
        </div>
        <div id="vendas-table-container"></div>
      </div></div>
    `;

    // Listeners
    contentEl.querySelector("#export-pdf-btn").addEventListener("click", () => exportData("pdf", "vendas", AppState));
    contentEl.querySelector("#export-excel-btn").addEventListener("click", () => exportData("excel", "vendas", AppState));
    contentEl.querySelector("#vendas-search").addEventListener("input", debounce(() => updateVendasTable(1), 400));
    ["#vendas-filter-vendedor", "#vendas-filter-pagamento"].forEach(sel =>
      contentEl.querySelector(sel).addEventListener("change", () => updateVendasTable(1))
    );

    contentEl.addEventListener("click", (e) => {
      // Ordenação
      const header = e.target.closest("[data-sort]");
      if (header) {
        const sortKey = header.dataset.sort;
        if (vendasSortState.key === sortKey) {
          vendasSortState.order = vendasSortState.order === "asc" ? "desc" : "asc";
        } else {
          vendasSortState.key = sortKey;
          vendasSortState.order = "desc";
        }
        updateVendasTable();
        return;
      }

      const actionBtn = e.target.closest("button[data-action]");
      if (!actionBtn) return;

      const { action, collection, id, type } = actionBtn.dataset;

      if (action === "open-venda-modal") {
        openVendaModal();
        return;
      }

      if (action === "edit") {
        if (collection === COLLECTIONS.VENDAS) editVenda(id);
      } else if (action === "delete") {
        confirmDelete(collection, id);
      } else if (action === "open-import") {
        openImportModal(type);
      }
    });

    // Modal eventos internos (adicionar/remover produto e populações de variações)
    document.getElementById("vendaModal")?.addEventListener("click", (e) => {
      if (e.target.id === "add-produto-venda-btn") addProductSaleRow();
      if (e.target.closest(".remove-produto-venda-btn")) e.target.closest(".produto-venda-item").remove();
    });

    document.getElementById("vendaModal")?.addEventListener("change", (e) => {
      if (e.target.name === "venda-produto-base") {
        const variacaoSelect = e.target.closest(".produto-venda-item").querySelector('select[name="venda-produto-variacao"]');
        populateVariationsDropdown(e.target.value, variacaoSelect);
      }
    });

    document.getElementById("venda-is-test")?.addEventListener("change", (e) => {
      const valorInput = document.getElementById("venda-valor");
      valorInput.value = e.target.checked ? 0 : "";
      valorInput.readOnly = e.target.checked;
    });

    document.getElementById("venda-form")?.addEventListener("submit", handleSaveVenda);
  }

  updateDropdowns("vendas-filter-vendedor", AppState.vendedores, "Todos os Vendedores");
  updateDropdowns("vendas-filter-pagamento", AppState.formasPagamento, "Todos os Pagamentos");
  updateVendasTable();
}

function sortData(data, state) {
  return [...data].sort((a, b) => {
    const { key, order } = state;
    const valA = a[key] ?? "";
    const valB = b[key] ?? "";
    let comparison = 0;
    if (key === "data") {
      comparison = (getSaleDate(a)?.getTime() || 0) - (getSaleDate(b)?.getTime() || 0);
    } else if (typeof valA === "number" && typeof valB === "number") {
      comparison = valA - valB;
    } else {
      comparison = String(valA).localeCompare(String(valB));
    }
    return order === "asc" ? comparison : -comparison;
  });
}

function updateVendasTable(page = 1) {
  currentPage = page;
  const container = document.getElementById("vendas-table-container");
  if (!container) return;

  const sortedSales = sortData(AppState.sales, vendasSortState);
  const searchTerm = document.getElementById("vendas-search")?.value.toLowerCase() || "";
  const vendedorFilter = document.getElementById("vendas-filter-vendedor")?.value || "";
  const pagamentoFilter = document.getElementById("vendas-filter-pagamento")?.value || "";

  const filteredSales = sortedSales.filter(s => {
    if ((vendedorFilter && s.vendedor !== vendedorFilter) || (pagamentoFilter && s.formaPagamento !== pagamentoFilter)) return false;
    if (!searchTerm) return true;
    const nomeProduto = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto).join(", ") : s.nomeProduto;
    return [getSaleDate(s)?.toLocaleDateString("pt-BR"), s.vendedor, nomeProduto, s.valor, s.formaPagamento, s.observacao, s.notaFiscal]
      .some(val => val != null && String(val).toLowerCase().includes(searchTerm));
  });

  if (filteredSales.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <i class="bi bi-search-heart fs-1 text-muted"></i>
      <h5 class="mt-3">Nenhuma venda encontrada</h5>
      <p class="text-muted">Tente ajustar os seus filtros de pesquisa.</p>
    </div>`;
    return;
  }

  const paginatedItems = filteredSales.slice((page - 1) * DEFAULTS.itemsPerPage, page * DEFAULTS.itemsPerPage);

  const getSortClass = (key) => {
    if (vendasSortState.key !== key) return "";
    return vendasSortState.order === "asc" ? "sort-asc" : "sort-desc";
  };

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead><tr>
          <th style="cursor: pointer;" data-sort="data" class="${getSortClass("data")}">Data</th>
          <th style="cursor: pointer;" data-sort="vendedor" class="${getSortClass("vendedor")}">Vendedor / Nota</th>
          <th style="cursor: pointer;" data-sort="nomeProduto" class="${getSortClass("nomeProduto")}">Produto(s)</th>
          <th style="cursor: pointer;" data-sort="valor" class="${getSortClass("valor")}">Valor</th>
          <th style="cursor: pointer;" data-sort="formaPagamento" class="${getSortClass("formaPagamento")}">Pagamento</th>
          <th>Ações</th>
        </tr></thead>
        <tbody>
          ${paginatedItems.map(sale => {
            const { valor, id, vendedor, formaPagamento, notaFiscal } = sale;
            let rowClass = "";
            if (typeof valor === "number") {
              if (valor === 0) rowClass = "table-row-warning";
              else if (valor >= 1 && valor <= 70) rowClass = "table-row-danger";
              else if (valor >= 200 && valor <= 600) rowClass = "table-row-success";
              else if (valor > 600) rowClass = "table-row-info";
            }
            const saleDate = getSaleDate(sale);
            const nomeProduto = Array.isArray(sale.produtos) ? sale.produtos.map(p => p.nomeCompleto).join(", ") : (sale.nomeProduto || "N/A");
            return `<tr class="${rowClass}" data-id="${id}">
              <td>${saleDate ? saleDate.toLocaleDateString("pt-BR") : "Data Inválida"}</td>
              <td>${vendedor || ""} <br> <small class="text-muted">${notaFiscal || ""}</small></td>
              <td>${nomeProduto}</td>
              <td>${formatCurrency(valor)}</td>
              <td>${formaPagamento || ""}</td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-collection="${COLLECTIONS.VENDAS}" data-id="${id}" aria-label="Editar Venda"><i class="bi bi-pencil-fill"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.VENDAS}" data-id="${id}" aria-label="Excluir Venda"><i class="bi bi-trash-fill"></i></button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <nav><ul class="pagination justify-content-end" id="vendas-pagination"></ul></nav>
  `;

  renderPagination(document.getElementById("vendas-pagination"), filteredSales.length, page, updateVendasTable, DEFAULTS.itemsPerPage);
}

function updateDropdowns(elementId, items, defaultOptionText = "") {
  const dropdown = document.getElementById(elementId);
  if (!dropdown) return;
  const currentVal = dropdown.value;
  dropdown.innerHTML = defaultOptionText ? `<option value="">${defaultOptionText}</option>` : "";
  items.forEach(item => {
    dropdown.innerHTML += `<option value="${item.nome}">${item.nome}</option>`;
  });
  dropdown.value = currentVal;
}

export function openVendaModal(saleId = null, saleData = null) {
  const form = document.getElementById("venda-form");
  form?.reset();
  document.getElementById("venda-id").value = saleId || "";
  const isUpdate = !!saleId;
  document.getElementById("vendaModalLabel").textContent = isUpdate ? "Editar Venda" : "Nova Venda";
  document.getElementById("produtos-venda-container").innerHTML = "";

  updateDropdowns("venda-vendedor", AppState.vendedores, "Selecione...");
  updateDropdowns("venda-pagamento", AppState.formasPagamento, "Selecione...");

  if (isUpdate && saleData) {
    const saleDate = getSaleDate(saleData);
    if (saleDate) document.getElementById("venda-data").value = saleDate.toISOString().split("T")[0];
    document.getElementById("venda-valor").value = saleData.valor;
    document.getElementById("venda-vendedor").value = saleData.vendedor;
    document.getElementById("venda-pagamento").value = saleData.formaPagamento;
    document.getElementById("venda-observacao").value = saleData.observacao || "";
    document.getElementById("venda-nota-fiscal").value = saleData.notaFiscal || "";
    document.getElementById("venda-is-test").checked = saleData.valor === 0;
    document.getElementById("venda-valor").readOnly = saleData.valor === 0;

    if (saleData.produtos?.length) {
      saleData.produtos.forEach(p => addProductSaleRow(p));
    } else {
      addProductSaleRow();
    }
  } else {
    document.getElementById("venda-data").valueAsDate = new Date();
    document.getElementById("venda-valor").readOnly = false;
    addProductSaleRow();
  }

  openModal("vendaModal");
}

function addProductSaleRow(produtoInfo = null) {
  const container = document.getElementById("produtos-venda-container");
  const newRow = document.createElement("div");
  newRow.className = "row align-items-center mb-2 produto-venda-item";
  newRow.innerHTML = `
    <div class="col-md-5">
      <select class="form-select" name="venda-produto-base" required>
        <option value="">Selecione o produto...</option>
        ${AppState.products.map(p => `<option value="${p.id}">${p.nome}</option>`).join("")}
      </select>
    </div>
    <div class="col-md-5">
      <select class="form-select" name="venda-produto-variacao" required>
        <option value="">Selecione a variação...</option>
      </select>
    </div>
    <div class="col-md-2 text-end">
      <button type="button" class="btn btn-sm btn-outline-danger remove-produto-venda-btn"><i class="bi bi-trash"></i></button>
    </div>
  `;
  container.appendChild(newRow);

  if (produtoInfo) {
    const baseSelect = newRow.querySelector('select[name="venda-produto-base"]');
    baseSelect.value = produtoInfo.produtoId;
    const variacaoSelect = newRow.querySelector('select[name="venda-produto-variacao"]');
    populateVariationsDropdown(produtoInfo.produtoId, variacaoSelect);
    setTimeout(() => { variacaoSelect.value = produtoInfo.variacaoIdx; }, 50);
  }
}

function populateVariationsDropdown(baseProductId, variacaoSelect) {
  const produto = AppState.products.find(p => p.id === baseProductId);
  variacaoSelect.innerHTML = '<option value="">Selecione a variação...</option>';
  if (produto?.variacoes) {
    variacaoSelect.innerHTML += produto.variacoes.map((v, i) => `<option value="${i}">${v.nome} (Estoque: ${v.estoque})</option>`).join("");
  }
  variacaoSelect.disabled = !produto;
}

export function editVenda(id) {
  if (typeof id !== "string" || id.length < 5) {
    console.error("ID inválido:", id);
    showToast("Erro: ID da venda é inválido.", "danger");
    return;
    }
  const sale = AppState.sales.find(s => s.id === id);
  if (!sale) return showToast("Venda não encontrada.", "danger");
  openVendaModal(id, sale);
}

async function handleSaveVenda(e) {
  e.preventDefault();
  const id = document.getElementById("venda-id").value;
  const isUpdate = !!id;

  const vendedor = document.getElementById("venda-vendedor").value;
  if (!vendedor) return showToast("Selecione um vendedor.", "warning");

  const productRows = document.querySelectorAll(".produto-venda-item");
  if (productRows.length === 0) return showToast("Adicione pelo menos um produto à venda.", "warning");

  const produtosDaVenda = [];
  for (const row of productRows) {
    const baseProductId = row.querySelector('select[name="venda-produto-base"]').value;
    const variacaoIndexStr = row.querySelector('select[name="venda-produto-variacao"]').value;
    if (!baseProductId || variacaoIndexStr === "") {
      return showToast("Todos os produtos devem ter uma variação selecionada.", "warning");
    }
    const produtoBase = AppState.products.find(p => p.id === baseProductId);
    const variacaoIndex = parseInt(variacaoIndexStr);
    if (!produtoBase || !produtoBase.variacoes?.[variacaoIndex]) {
      return showToast("Produto ou variação inválida encontrada.", "danger");
    }
    produtosDaVenda.push({
      produtoId: baseProductId,
      variacaoIdx: variacaoIndex,
      nomeCompleto: `${produtoBase.nome} - ${produtoBase.variacoes[variacaoIndex].nome}`
    });
  }

  const saleData = {
    data: Timestamp.fromDate(new Date(document.getElementById("venda-data").value + "T12:00:00")),
    vendedor,
    valor: parseFloat(document.getElementById("venda-valor").value),
    notaFiscal: document.getElementById("venda-nota-fiscal").value.trim(),
    produtos: produtosDaVenda,
    formaPagamento: document.getElementById("venda-pagamento").value,
    observacao: document.getElementById("venda-observacao").value
  };

  // Transação de estoque + venda
  try {
    await runTransaction(window.firebaseDb || null, async (transaction) => {
      // No wrapper do serviço usamos runTransaction(db,...), mas aqui aproveitamos a mesma assinatura:
      // Para manter compatibilidade, obtemos a instância via doc/collection; o primeiro arg ignorado em CDN.
      const originalSale = isUpdate ? AppState.sales.find(s => s.id === id) : null;
      const stockUpdates = new Map();

      if (originalSale?.produtos) {
        for (const p of originalSale.produtos) {
          const key = `${p.produtoId}-${p.variacaoIdx}`;
          stockUpdates.set(key, (stockUpdates.get(key) || 0) + 1);
        }
      }
      for (const p of produtosDaVenda) {
        const key = `${p.produtoId}-${p.variacaoIdx}`;
        stockUpdates.set(key, (stockUpdates.get(key) || 0) - 1);
      }

      // Ler documentos necessários
      const productRefsToRead = new Map();
      for (const key of stockUpdates.keys()) {
        const [productId] = key.split("-");
        if (!productRefsToRead.has(productId)) {
          productRefsToRead.set(productId, doc(collection(window.firebaseDb || {}, COLLECTIONS.PRODUTOS), productId));
        }
      }

      const productDocs = new Map();
      const productSnapshots = [];
      for (const ref of productRefsToRead.values()) {
        productSnapshots.push(await transaction.get(ref));
      }
      productSnapshots.forEach(docSnap => {
        if (docSnap.exists()) productDocs.set(docSnap.id, docSnap.data());
        else throw new Error(`Produto não encontrado: ${docSnap.id}`);
      });

      // Calcular alterações
      for (const [key, change] of stockUpdates.entries()) {
        if (change === 0) continue;
        const [productId, varIdxStr] = key.split("-");
        const varIdx = parseInt(varIdxStr);
        const productData = productDocs.get(productId);
        const newVariations = [...productData.variacoes];
        if (newVariations[varIdx].estoque + change < 0) {
          throw new Error(`Estoque insuficiente para ${productData.nome} - ${newVariations[varIdx].nome}.`);
        }
        newVariations[varIdx].estoque += change;
        transaction.update(productRefsToRead.get(productId), { variacoes: newVariations });
      }

      // Gravar venda
      const saleRef = isUpdate
        ? doc(collection(window.firebaseDb || {}, COLLECTIONS.VENDAS), id)
        : doc(collection(window.firebaseDb || {}, COLLECTIONS.VENDAS));
      const ts = serverTimestamp();
      const finalData = {
        ...saleData,
        ...(isUpdate ? { modificadoPor: AppState.currentUser.uid, modificadoEm: ts } : { criadoPor: AppState.currentUser.uid, criadoEm: ts })
      };
      transaction.set(saleRef, finalData, { merge: isUpdate });
    });

    showToast(`Venda ${isUpdate ? "atualizada" : "salva"} com sucesso!`, "success");
    bootstrap.Modal.getInstance(document.getElementById("vendaModal"))?.hide();
  } catch (error) {
    console.error("Erro na transação da Venda:", error);
    showToast(`Erro ao salvar: ${error.message}`, "danger");
  }
}

function openImportModal(type) {
  const modalEl = document.getElementById("importModal");
  const instructions = {
    vendas: 'Selecione um ficheiro .xlsx ou .csv com as colunas: <strong>Data, Valor Total Venda, Forma Pagamento, Vendedor, Produto, produto 1, produto 2, produto 3, produto 4, Observação da Venda</strong>.',
    produtos: 'Selecione um ficheiro .xlsx ou .csv com a coluna: <strong>Nome do Produto</strong>.',
    modelos: 'Selecione um ficheiro .xlsx ou .csv com as colunas: <strong>Marca, Modelo</strong>.'
  };
  document.getElementById("importModalLabel").textContent = `Importar ${type === "modelos" ? "Modelos de Celular" : type}`;
  document.getElementById("import-instructions").innerHTML = instructions[type];
  modalEl.dataset.importType = type;
  document.getElementById("import-file-input").value = "";
  document.getElementById("import-summary").classList.add("d-none");
  new bootstrap.Modal(modalEl).show();

  document.getElementById("process-import-btn").onclick = handleImportFile;
}

async function handleImportFile() {
  const file = document.getElementById("import-file-input").files[0];
  const importType = document.getElementById("importModal").dataset.importType;
  if (!file) return showToast("Selecione um ficheiro.", "warning");
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const processors = {
      vendas: processImportedVendasData,
      produtos: processImportedProdutosData,
      modelos: processImportedModelosData
    };
    await processors[importType](jsonData);
  } catch (err) {
    console.error("Import Error:", err);
    showToast(`Erro ao processar: ${err.message}`, "danger");
  }
}

async function processImportedData(rows, rowProcessor, collectionName) {
  const resultsEl = document.getElementById("import-results");
  document.getElementById("import-summary").classList.remove("d-none");
  let savedCount = 0;
  const errors = [];
  const batch = writeBatch(window.firebaseDb || {});

  rows.forEach((row, index) => {
    const data = rowProcessor(row, index + 2, errors);
    if (data) {
      batch.set(doc(collection(window.firebaseDb || {}, collectionName)), data);
      savedCount++;
    }
  });

  try {
    if (savedCount > 0) await batch.commit();
    let resultHTML = `<p><strong>Importação concluída!</strong> ${savedCount} de ${rows.length} itens processados.</p>`;
    if (errors.length > 0) {
      resultHTML += `<p>${errors.length} erros:</p><ul>${errors.slice(0, 5).map(e => `<li>${e}</li>`).join("")}</ul>`;
      resultsEl.className = "alert alert-warning";
    } else {
      resultsEl.className = "alert alert-success";
    }
    resultsEl.innerHTML = resultHTML;
  } catch (e) {
    resultsEl.className = "alert alert-danger";
    resultsEl.innerHTML = `<strong>Erro Crítico ao Salvar:</strong> ${e.message}`;
  }
}

async function processImportedVendasData(rows) {
  const productsMap = new Map(AppState.products.map(p => [p.nome.toLowerCase(), p]));
  await processImportedData(rows, (row, line, errors) => {
    const dateValue = findColumnValue(row, ["data"]);
    const valor = findColumnValue(row, ["valor total venda", "valor"]);
    const mainProductName = findColumnValue(row, ["produto"])?.toString().trim();

    if (!dateValue || !valor || !mainProductName) {
      errors.push(`Linha ${line}: Faltam dados essenciais (Data, Valor, Produto).`);
      return null;
    }
    const produto = productsMap.get(mainProductName.toLowerCase());
    if (!produto) {
      errors.push(`Linha ${line}: Produto "${mainProductName}" não encontrado.`);
      return null;
    }

    return {
      data: Timestamp.fromDate(new Date(dateValue.toISOString().split("T")[0] + "T12:00:00")),
      valor: parseFloat(valor),
      nomeProduto: [mainProductName, ...[1, 2, 3, 4].map(i => findColumnValue(row, [`produto ${i}`])).filter(Boolean)].join(", "),
      vendedor: findColumnValue(row, ["vendedor"]) || "N/A",
      formaPagamento: findColumnValue(row, ["forma pagamento"]) || "N/A",
      observacao: findColumnValue(row, ["observação da venda", "observacao"]) || "",
      criadoPor: AppState.currentUser.uid,
      criadoEm: serverTimestamp()
    };
  }, COLLECTIONS.VENDAS);
}

async function processImportedModelosData(rows) {
  await processImportedData(rows, (row, line, errors) => {
    const marca = findColumnValue(row, ["marca"])?.toString().trim();
    const modelo = findColumnValue(row, ["modelo"])?.toString().trim();
    if (!marca || !modelo) {
      errors.push(`Linha ${line}: Marca ou Modelo em falta.`);
      return null;
    }
    return { marca, modelo };
  }, COLLECTIONS.MODELOS_CELULAR);
}

async function processImportedProdutosData(rows) {
  await processImportedData(rows, (row, line, errors) => {
    const nome = findColumnValue(row, ["nome do produto", "produto"])?.toString().trim();
    if (!nome) {
      errors.push(`Linha ${line}: Nome do Produto em falta.`);
      return null;
    }
    return { nome, variacoes: [{ nome: "Padrão", estoque: 0 }], ativo: true };
  }, COLLECTIONS.PRODUTOS);
}

function findColumnValue(row, names) {
  const key = Object.keys(row).find(k => names.includes(k.toLowerCase().trim()));
  return key ? row[key] : undefined;
}

async function confirmDelete(collectionName, id) {
  const modal = new bootstrap.Modal(document.getElementById("confirmDeleteModal"));
  modal.show();
  document.getElementById("confirmDelete-btn").onclick = async () => {
    try {
      if (collectionName === COLLECTIONS.VENDAS) {
        const saleToDelete = AppState.sales.find(s => s.id === id);
        if (saleToDelete?.produtos) {
          const batch = writeBatch(window.firebaseDb || {});
          for (const p of saleToDelete.produtos) {
            const productDoc = AppState.products.find(prod => prod.id === p.produtoId);
            if (productDoc) {
              const newVariations = [...productDoc.variacoes];
              newVariations[p.variacaoIdx].estoque++;
              batch.update(doc(collection(window.firebaseDb || {}, COLLECTIONS.PRODUTOS), p.produtoId), { variacoes: newVariations });
            }
          }
          await batch.commit();
        }
      }
      // apagar documento
      const ref = doc(collection(window.firebaseDb || {}, collectionName), id);
      await (await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")).deleteDoc(ref);
      showToast("Item excluído com sucesso!", "success");
    } catch (e) {
      showToast(`Erro ao excluir: ${e.message}`, "danger");
    } finally {
      modal.hide();
    }
  };
}