import { AppState } from "../app/state.js";
import { showToast, openModal } from "../app/ui.js";
import { formatCurrency, getSaleDate } from "../utils/helpers.js";
import { serverTimestamp, Timestamp } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let depositosSortState = { key: "data", order: "desc" };

export function bindDepositosGlobal() {
  // handled inside section
}

export function renderDepositosSection(updateOnly = false) {
  const contentEl = document.getElementById("depositos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="d-flex justify-content-end mb-3"><button class="btn btn-primary" id="add-deposito-btn"><i class="bi bi-plus-circle-fill me-2"></i>Novo Depósito</button></div>
      <div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-hover">
        <thead><tr>
          <th style="cursor: pointer;" data-sort="data">Data <i class="bi bi-arrow-down-up small"></i></th>
          <th style="cursor: pointer;" data-sort="valor">Valor <i class="bi bi-arrow-down-up small"></i></th>
          <th style="cursor: pointer;" data-sort="observacao">Observação <i class="bi bi-arrow-down-up small"></i></th>
          <th>Ações</th>
        </tr></thead>
        <tbody id="depositos-table-body"></tbody>
      </table></div></div></div>
    `;

    contentEl.querySelector("#add-deposito-btn").addEventListener("click", openDepositoModal);
    contentEl.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      depositosSortState.key = header.dataset.sort;
      depositosSortState.order = depositosSortState.order === "asc" ? "desc" : "asc";
      updateDepositosTable();
    });

    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, collection, id } = btn.dataset;
      if (action === "edit" && collection === COLLECTIONS.DEPOSITOS) editDeposito(id);
      if (action === "delete" && collection === COLLECTIONS.DEPOSITOS) confirmDelete(collection, id);
    });

    document.getElementById("deposito-form")?.addEventListener("submit", handleSaveDeposito);
  }

  updateDepositosTable();
}

function updateDepositosTable() {
  const tableBody = document.getElementById("depositos-table-body");
  if (!tableBody) return;
  const sortedData = [...AppState.deposits].sort((a, b) => {
    const { key, order } = depositosSortState;
    const va = key === "data" ? (getSaleDate(a)?.getTime() || 0) : (a[key] ?? "");
    const vb = key === "data" ? (getSaleDate(b)?.getTime() || 0) : (b[key] ?? "");
    const cmp = (typeof va === "number" && typeof vb === "number") ? (va - vb) : String(va).localeCompare(String(vb));
    return order === "asc" ? cmp : -cmp;
  });

  tableBody.innerHTML = sortedData.map(dep => `
    <tr data-id="${dep.id}">
      <td>${getSaleDate(dep)?.toLocaleDateString("pt-BR") || "Data Inválida"}</td>
      <td>${formatCurrency(dep.valor)}</td>
      <td>${dep.observacao || ""}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline-primary" data-action="edit" data-collection="${COLLECTIONS.DEPOSITOS}" data-id="${dep.id}"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.DEPOSITOS}" data-id="${dep.id}"><i class="bi bi-trash-fill"></i></button>
      </td>
    </tr>
  `).join("");
}

export function openDepositoModal() {
  document.getElementById("deposito-form")?.reset();
  document.getElementById("deposito-id").value = "";
  document.getElementById("deposito-data").valueAsDate = new Date();
  document.getElementById("depositoModalLabel").textContent = "Novo Depósito";
  openModal("depositoModal");
}

export function editDeposito(id) {
  const d = AppState.deposits.find(x => x.id === id);
  if (!d) return;
  openDepositoModal();
  document.getElementById("depositoModalLabel").textContent = "Editar Depósito";
  document.getElementById("deposito-id").value = d.id;
  document.getElementById("deposito-data").value = getSaleDate(d)?.toISOString().split("T")[0];
  document.getElementById("deposito-valor").value = d.valor;
  document.getElementById("deposito-observacao").value = d.observacao || "";
}

async function handleSaveDeposito(e) {
  e.preventDefault();
  const id = document.getElementById("deposito-id").value;
  const data = {
    data: Timestamp.fromDate(new Date(document.getElementById("deposito-data").value + "T12:00:00")),
    valor: parseFloat(document.getElementById("deposito-valor").value),
    observacao: document.getElementById("deposito-observacao").value
  };

  try {
    const { saveDocument } = await import("../services/firebaseService.js");
    const refMod = bootstrap.Modal.getInstance(document.getElementById("depositoModal"));
    await saveDocument(COLLECTIONS.DEPOSITOS, id || null, {
      ...data,
      ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
             : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast(`Depósito ${id ? "atualizado" : "salvo"} com sucesso!`, "success");
    refMod?.hide();
  } catch (e) {
    showToast(`Erro ao salvar: ${e.message}`, "danger");
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