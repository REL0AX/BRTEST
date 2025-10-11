import { AppState } from "../app/state.js";
import { showToast, openModal, closeModal } from "../app/ui.js";
import { formatCurrency, getSaleDate } from "../utils/helpers.js";
import { serverTimestamp, Timestamp } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let gastosSortState = { key: "data", order: "desc" };

export function bindGastosGlobal() {
  // A lógica de eventos de formulários, como o de 'gasto', precisa ser ligada uma vez
  const gastoForm = document.getElementById("gasto-form");
  if (gastoForm) {
      gastoForm.addEventListener("submit", handleSaveGasto);
  }
}

export function renderGastosSection(updateOnly = false) {
  const contentEl = document.getElementById("gastos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="d-flex justify-content-end mb-3"><button class="btn btn-primary" id="add-gasto-btn"><i class="bi bi-plus-circle-fill me-2"></i>Novo Gasto</button></div>
      <div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-hover">
        <thead><tr>
          <th style="cursor: pointer;" data-sort="data">Data <i class="bi bi-arrow-down-up small"></i></th>
          <th style="cursor: pointer;" data-sort="valor">Valor <i class="bi bi-arrow-down-up small"></i></th>
          <th style="cursor: pointer;" data-sort="descricao">Descrição <i class="bi bi-arrow-down-up small"></i></th>
          <th>Ações</th>
        </tr></thead>
        <tbody id="gastos-table-body"></tbody>
      </table></div></div></div>
    `;

    contentEl.querySelector("#add-gasto-btn").addEventListener("click", openGastoModal);
    
    contentEl.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      gastosSortState.key = header.dataset.sort;
      gastosSortState.order = gastosSortState.order === "asc" ? "desc" : "asc";
      updateGastosTable();
    });

    // Listener de delegação para ações na tabela
    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, collection, id } = btn.dataset;
      if (action === "edit" && collection === COLLECTIONS.GASTOS) editGasto(id);
      if (action === "delete" && collection === COLLECTIONS.GASTOS) confirmDelete(collection, id);
    });
  }

  updateGastosTable();
}

function updateGastosTable() {
  const tableBody = document.getElementById("gastos-table-body");
  if (!tableBody) return;

  const sortedData = [...AppState.expenses].sort((a, b) => {
    const { key, order } = gastosSortState;
    const valA = a[key] || '';
    const valB = b[key] || '';
    let comparison = 0;
    if (key === 'data') {
        const dateA = getSaleDate(a);
        const dateB = getSaleDate(b);
        comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
    } else {
        comparison = String(valA).localeCompare(String(valB));
    }
    return order === 'asc' ? comparison : -comparison;
  });

  tableBody.innerHTML = sortedData.map(gasto => {
    const saleDate = getSaleDate(gasto);
    return `
      <tr data-id="${gasto.id}">
        <td>${saleDate ? saleDate.toLocaleDateString("pt-BR") : "Data Inválida"}</td>
        <td>${formatCurrency(gasto.valor)}</td>
        <td>${gasto.descricao || ""}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-collection="${COLLECTIONS.GASTOS}" data-id="${gasto.id}"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.GASTOS}" data-id="${gasto.id}"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

function openGastoModal() {
  const form = document.getElementById("gasto-form");
  if (form) form.reset();
  
  const idInput = document.getElementById("gasto-id");
  if (idInput) idInput.value = "";

  const dateInput = document.getElementById("gasto-data");
  if (dateInput) dateInput.valueAsDate = new Date();
  
  const label = document.getElementById("gastoModalLabel");
  if (label) label.textContent = "Novo Gasto";
  
  openModal("gastoModal");
}

function editGasto(id) {
  const g = AppState.expenses.find(x => x.id === id);
  if (!g) return;
  
  openGastoModal(); // Reutiliza para limpar e abrir o modal

  const saleDate = getSaleDate(g);
  
  document.getElementById("gastoModalLabel").textContent = "Editar Gasto";
  document.getElementById("gasto-id").value = g.id;
  document.getElementById("gasto-data").value = saleDate ? saleDate.toISOString().split("T")[0] : '';
  document.getElementById("gasto-valor").value = g.valor;
  document.getElementById("gasto-descricao").value = g.descricao || "";
}

async function handleSaveGasto(e) {
  e.preventDefault();
  const valorGasto = parseFloat(document.getElementById("gasto-valor").value);
  const descricao = document.getElementById("gasto-descricao").value.trim();
  if (isNaN(valorGasto) || valorGasto <= 0) {
      showToast("O valor deve ser maior que zero.", "warning");
      return;
  }
  if (!descricao) {
      showToast("Preencha a descrição.", "warning");
      return;
  }

  const id = document.getElementById("gasto-id").value;
  const data = {
    data: Timestamp.fromDate(new Date(document.getElementById("gasto-data").value + "T12:00:00")),
    valor: valorGasto,
    descricao: descricao
  };

  try {
    const { saveDocument } = await import("../services/firebaseService.js");
    await saveDocument(COLLECTIONS.GASTOS, id || null, {
      ...data,
      ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
             : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast(`Gasto ${id ? "atualizado" : "salvo"} com sucesso!`, "success");
    closeModal("gastoModal");
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`, "danger");
  }
}

async function confirmDelete(collectionName, id) {
  const modal = new bootstrap.Modal(document.getElementById("confirmDeleteModal"));
  modal.show();
  document.getElementById("confirmDelete-btn").onclick = async () => {
    try {
      const { deleteDocument } = await import("../services/firebaseService.js");
      await deleteDocument(collectionName, id);
      showToast("Item excluído com sucesso!", "success");
    } catch (e) {
      showToast(`Erro ao excluir: ${e.message}`, "danger");
    } finally {
      modal.hide();
    }
  };
}