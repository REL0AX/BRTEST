import { AppState } from "../app/state.js";
import { showToast, openModal, confirmAction } from "../app/ui.js";
import { formatCurrency, getSaleDate, createElement } from "../utils/helpers.js";
import { serverTimestamp, Timestamp } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let depositosSortState = { key: "data", order: "desc" };

export function bindDepositosGlobal() {
  document.getElementById("deposito-form")?.addEventListener("submit", handleSaveDeposito);
}

export function renderDepositosSection(updateOnly = false) {
  const contentEl = document.getElementById("depositos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = '';

    const header = createElement('div', { className: 'd-flex justify-content-end mb-3' }, [
        createElement('button', { id: 'add-deposito-btn', className: 'btn btn-primary' }, [
            createElement('i', { className: 'bi bi-plus-circle-fill me-2' }),
            document.createTextNode('Novo Depósito')
        ])
    ]);

    const table = createElement('table', { className: 'table table-hover' }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', { textContent: 'Data ', dataset: { sort: 'data' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Valor ', dataset: { sort: 'valor' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Observação ', dataset: { sort: 'observacao' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Ações' })
            ])
        ]),
        createElement('tbody', { id: 'depositos-table-body' })
    ]);

    const card = createElement('div', { className: 'card' }, [
        createElement('div', { className: 'card-body' }, [
            createElement('div', { className: 'table-responsive' }, [table])
        ])
    ]);

    contentEl.append(header, card);

    contentEl.querySelector("#add-deposito-btn").addEventListener("click", openDepositoModal);
    
    table.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      depositosSortState.key = header.dataset.sort;
      depositosSortState.order = depositosSortState.order === "asc" ? "desc" : "asc";
      updateDepositosTable();
    });

    table.querySelector("tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === "edit") editDeposito(id);
      if (action === "delete") {
        const row = btn.closest('tr');
        handleDeleteDeposito(id, row);
      }
    });
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

  if (sortedData.length === 0) {
      tableBody.replaceChildren(
          createElement('tr', {}, [
              createElement('td', { colSpan: 4, className: 'text-center text-muted py-4', textContent: 'Nenhum depósito registado.' })
          ])
      );
      return;
  }
  
  const rows = sortedData.map(generateDepositoRowElement);
  tableBody.replaceChildren(...rows);
}

function generateDepositoRowElement(deposito) {
    return createElement('tr', { dataset: { id: deposito.id } }, [
        createElement('td', { textContent: getSaleDate(deposito)?.toLocaleDateString("pt-BR") || "Data Inválida" }),
        createElement('td', { textContent: formatCurrency(deposito.valor) }),
        createElement('td', { textContent: deposito.observacao || "" }),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'edit', id: deposito.id } }, [
                createElement('i', { className: 'bi bi-pencil-fill' })
            ]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', id: deposito.id } }, [
                createElement('i', { className: 'bi bi-trash-fill' })
            ])
        ])
    ]);
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
    await saveDocument(COLLECTIONS.DEPOSITOS, id || null, {
      ...data,
      ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
             : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast(`Depósito ${id ? "atualizado" : "salvo"} com sucesso!`, "success");
    closeModal("depositoModal");
  } catch (e) {
    console.error("Erro ao salvar depósito:", e);
    showToast(`Erro ao salvar: ${e.message}`, "danger");
  }
}

function handleDeleteDeposito(id, rowElement) {
    confirmAction({
        title: 'Excluir Depósito',
        message: 'Tem a certeza que deseja excluir este depósito? Esta ação não pode ser desfeita.',
        confirmText: 'Excluir',
        btnClass: 'btn-danger',
        onConfirm: async () => {
            if (rowElement) {
                rowElement.style.transition = 'opacity 0.5s ease';
                rowElement.style.opacity = '0';
                setTimeout(() => rowElement.remove(), 500);
            }
            
            const { deleteDocument } = await import("../services/firebaseService.js");
            await deleteDocument(COLLECTIONS.DEPOSITOS, id);
        }
    });
}