import { AppState } from "../app/state.js";
import { showToast, openModal } from "../app/ui.js";
import { formatCurrency } from "../utils/helpers.js";
import { serverTimestamp, Timestamp, writeBatch, doc, collection } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let productSortState = { key: "nome", order: "asc" };

export function bindProdutosGlobal() {
  // Delegado na própria secção
}

export function renderProdutosSection(updateOnly = false) {
  const contentEl = document.getElementById("produtos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="d-flex justify-content-end mb-3 gap-2">
        <button class="btn btn-outline-secondary" data-action="open-import" data-type="produtos"><i class="bi bi-upload me-2"></i>Importar</button>
        <button class="btn btn-primary" id="add-produto-btn"><i class="bi bi-plus-circle-fill me-2"></i>Novo Produto</button>
      </div>
      <div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-hover">
        <thead><tr>
          <th scope="col" data-sort="nome" style="cursor: pointer;">Produto Base <i class="bi bi-arrow-down-up small"></i></th>
          <th scope="col">Variações (Estoque)</th>
          <th scope="col">Ações</th>
        </tr></thead>
        <tbody id="produtos-table-body"></tbody>
      </table></div></div></div>
    `;

    contentEl.querySelector("#add-produto-btn").addEventListener("click", openProdutoModal);
    contentEl.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      productSortState.key = header.dataset.sort;
      productSortState.order = productSortState.order === "asc" ? "desc" : "asc";
      updateProdutosTable();
    });

    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, collection, id } = btn.dataset;
      if (action === "edit" && collection === COLLECTIONS.PRODUTOS) editProduto(id);
      if (action === "delete" && collection === COLLECTIONS.PRODUTOS) confirmDelete(COLLECTIONS.PRODUTOS, id);
    });

    document.getElementById("produto-form")?.addEventListener("submit", handleSaveProduto);
    document.getElementById("produtoModal")?.addEventListener("click", (e) => {
      if (e.target.id === "add-variacao-btn") addVariacaoField();
      if (e.target.closest(".remove-variacao-btn")) e.target.closest(".variacao-item").remove();
    });
  }

  updateProdutosTable();
}

function updateProdutosTable() {
  const tableBody = document.getElementById("produtos-table-body");
  if (!tableBody) return;

  const sorted = [...AppState.products].sort((a, b) => {
    const { key, order } = productSortState;
    const va = a[key] ?? "";
    const vb = b[key] ?? "";
    const cmp = String(va).localeCompare(String(vb));
    return order === "asc" ? cmp : -cmp;
  });

  tableBody.innerHTML = sorted.map(prod => {
    const variacoesHtml = prod.variacoes?.map(v => `<span class="badge bg-secondary me-1">${v.nome}: ${v.estoque}</span>`).join("") || '<span class="text-muted small">Nenhuma</span>';
    return `
      <tr data-id="${prod.id}">
        <td><strong>${prod.nome}</strong></td>
        <td>${variacoesHtml}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-collection="${COLLECTIONS.PRODUTOS}" data-id="${prod.id}"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.PRODUTOS}" data-id="${prod.id}"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

export function openProdutoModal() {
  document.getElementById("produto-form")?.reset();
  document.getElementById("produto-id").value = "";
  document.getElementById("variacoes-container").innerHTML = "";
  addVariacaoField();
  document.getElementById("produtoModalLabel").textContent = "Novo Produto";
  openModal("produtoModal");
}

export function editProduto(id) {
  const p = AppState.products.find(p => p.id === id);
  if (!p) return;
  openProdutoModal();
  document.getElementById("produtoModalLabel").textContent = "Editar Produto";
  document.getElementById("produto-id").value = p.id;
  document.getElementById("produto-nome").value = p.nome;
  document.getElementById("produto-meta").value = p.metaSemanal || 0;
  document.getElementById("variacoes-container").innerHTML = "";
  p.variacoes?.forEach(v => addVariacaoField(v));
}

function addVariacaoField(variacao = { nome: "", estoque: 0 }) {
  const container = document.getElementById("variacoes-container");
  const newField = document.createElement("div");
  newField.className = "row align-items-center mb-2 variacao-item";
  newField.innerHTML = `
    <div class="col-7"><input type="text" class="form-control form-control-sm variacao-nome" placeholder="Nome da Variação" value="${variacao.nome}" required></div>
    <div class="col-4"><div class="input-group input-group-sm"><span class="input-group-text">Qtd:</span><input type="number" class="form-control form-control-sm variacao-estoque" value="${variacao.estoque}" required></div></div>
    <div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger remove-variacao-btn"><i class="bi bi-trash"></i></button></div>
  `;
  container.appendChild(newField);
}

async function handleSaveProduto(e) {
  e.preventDefault();
  const id = document.getElementById("produto-id").value;
  const variacoes = Array.from(document.querySelectorAll(".variacao-item")).map(item => {
    const nome = item.querySelector(".variacao-nome").value.trim();
    const estoque = parseInt(item.querySelector(".variacao-estoque").value) || 0;
    return nome ? { nome, estoque } : null;
  }).filter(Boolean);

  if (variacoes.length === 0) return showToast("Adicione pelo menos uma variação.", "warning");
  const data = {
    nome: document.getElementById("produto-nome").value,
    metaSemanal: parseInt(document.getElementById("produto-meta").value) || 0,
    variacoes,
    ativo: true
  };

  try {
    const refMod = bootstrap.Modal.getInstance(document.getElementById("produtoModal"));
    const { saveDocument } = await import("../services/firebaseService.js");
    await saveDocument(COLLECTIONS.PRODUTOS, id || null, {
      ...data,
      ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
             : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast(`Produto ${id ? "atualizado" : "salvo"} com sucesso!`, "success");
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