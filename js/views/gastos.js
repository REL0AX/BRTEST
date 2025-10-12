import { AppState } from "../app/state.js";
import { showToast, openModal, closeModal, confirmAction } from "../app/ui.js";
import { formatCurrency, getSaleDate, createElement } from "../utils/helpers.js";
import { serverTimestamp, Timestamp } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let gastosSortState = { key: "data", order: "desc" };

export function bindGastosGlobal() {
  const gastoForm = document.getElementById("gasto-form");
  if (gastoForm) {
      gastoForm.addEventListener("submit", handleSaveGasto);
  }
}

export function renderGastosSection(updateOnly = false) {
  const contentEl = document.getElementById("gastos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = ''; 

    const header = createElement('div', { className: 'd-flex justify-content-end mb-3' }, [
        createElement('button', { id: 'add-gasto-btn', className: 'btn btn-primary' }, [
            createElement('i', { className: 'bi bi-plus-circle-fill me-2' }),
            document.createTextNode('Novo Gasto')
        ])
    ]);

    const table = createElement('table', { className: 'table table-hover' }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', { textContent: 'Data ', dataset: { sort: 'data' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Valor ', dataset: { sort: 'valor' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Descrição ', dataset: { sort: 'descricao' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { textContent: 'Ações' })
            ])
        ]),
        createElement('tbody', { id: 'gastos-table-body' })
    ]);

    const card = createElement('div', { className: 'card' }, [
        createElement('div', { className: 'card-body' }, [
            createElement('div', { className: 'table-responsive' }, [table])
        ])
    ]);

    contentEl.append(header, card);

    contentEl.querySelector("#add-gasto-btn").addEventListener("click", openGastoModal);
    
    table.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      gastosSortState.key = header.dataset.sort;
      gastosSortState.order = gastosSortState.order === "asc" ? "desc" : "asc";
      updateGastosTable();
    });

    table.querySelector("tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === "edit") {
        editGasto(id);
      }
      if (action === "delete") {
        const row = btn.closest('tr');
        handleDeleteGasto(id, row);
      }
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

  if (sortedData.length === 0) {
      tableBody.replaceChildren(
          createElement('tr', {}, [
              createElement('td', { colSpan: 4, className: 'text-center text-muted py-4', textContent: 'Nenhum gasto registado.' })
          ])
      );
      return;
  }

  const rows = sortedData.map(generateGastoRowElement);
  tableBody.replaceChildren(...rows);
}

function generateGastoRowElement(gasto) {
    return createElement('tr', { dataset: { id: gasto.id } }, [
        createElement('td', { textContent: getSaleDate(gasto) ? getSaleDate(gasto).toLocaleDateString("pt-BR") : "Data Inválida" }),
        createElement('td', { textContent: formatCurrency(gasto.valor) }),
        createElement('td', { textContent: gasto.descricao || "" }),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'edit', id: gasto.id } }, [
                createElement('i', { className: 'bi bi-pencil-fill' })
            ]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', id: gasto.id } }, [
                createElement('i', { className: 'bi bi-trash-fill' })
            ])
        ])
    ]);
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
  
  openGastoModal();

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
    console.error("Erro ao salvar gasto:", err);
    showToast(`Erro ao salvar: ${err.message}`, "danger");
  }
}

function handleDeleteGasto(id, rowElement) {
    confirmAction({
        title: 'Excluir Gasto',
        message: 'Tem a certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.',
        confirmText: 'Excluir',
        btnClass: 'btn-danger',
        onConfirm: async () => {
            if (rowElement) {
                rowElement.style.transition = 'opacity 0.5s ease';
                rowElement.style.opacity = '0';
                setTimeout(() => rowElement.remove(), 500);
            }
            
            const { deleteDocument } = await import("../services/firebaseService.js");
            await deleteDocument(COLLECTIONS.GASTOS, id);
        }
    });
}