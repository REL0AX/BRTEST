import { AppState } from "../app/state.js";
import { showToast, openModal, confirmAction, closeModal } from "../app/ui.js";
import { createElement, findColumnValue } from "../utils/helpers.js";
import { serverTimestamp, writeBatch } from "../services/firebaseService.js";
import { COLLECTIONS } from "../utils/constants.js";

let productSortState = { key: "nome", order: "asc" };
let importedData = [];

export function bindProdutosGlobal() {
  document.getElementById("produto-form")?.addEventListener("submit", handleSaveProduto);
  
  const produtoModal = document.getElementById("produtoModal");
  if (produtoModal) {
      produtoModal.addEventListener("click", (e) => {
          if (e.target.id === "add-variacao-btn") {
              addVariacaoField();
          }
          const removeBtn = e.target.closest(".remove-variacao-btn");
          if (removeBtn) {
              removeBtn.closest(".variacao-item").remove();
          }
      });
  }

  const importFileInput = document.getElementById("import-file-input");
  const importConfirmBtn = document.getElementById("import-confirm-btn");
  if (importFileInput) {
      importFileInput.addEventListener('change', handleFileSelect);
  }
  if (importConfirmBtn) {
      importConfirmBtn.addEventListener('click', handleConfirmImport);
  }
}

export function renderProdutosSection(updateOnly = false) {
  const contentEl = document.getElementById("produtos-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = ''; 

    const header = createElement('div', { className: 'd-flex justify-content-end mb-3 gap-2' }, [
        createElement('button', { className: 'btn btn-outline-secondary', dataset: { action: 'open-import' } }, [
            createElement('i', { className: 'bi bi-upload me-2' }),
            document.createTextNode('Importar Produtos')
        ]),
        createElement('button', { id: 'add-produto-btn', className: 'btn btn-primary' }, [
            createElement('i', { className: 'bi bi-plus-circle-fill me-2' }),
            document.createTextNode('Novo Produto')
        ])
    ]);

    const table = createElement('table', { className: 'table table-hover' }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', { scope: 'col', textContent: 'Produto Base ', dataset: { sort: 'nome' }, style: 'cursor: pointer;' }, [createElement('i', { className: 'bi bi-arrow-down-up small' })]),
                createElement('th', { scope: 'col', textContent: 'Variações (Estoque)' }),
                createElement('th', { scope: 'col', textContent: 'Ações' })
            ])
        ]),
        createElement('tbody', { id: 'produtos-table-body' })
    ]);

    const card = createElement('div', { className: 'card' }, [
        createElement('div', { className: 'card-body' }, [
            createElement('div', { className: 'table-responsive' }, [table])
        ])
    ]);

    contentEl.append(header, card);

    contentEl.querySelector("#add-produto-btn").addEventListener("click", openProdutoModal);
    
    table.querySelector("thead").addEventListener("click", (e) => {
      const header = e.target.closest("[data-sort]");
      if (!header) return;
      productSortState.key = header.dataset.sort;
      productSortState.order = productSortState.order === "asc" ? "desc" : "asc";
      updateProdutosTable();
    });

    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === "edit") {
          editProduto(id);
      }
      if (action === "delete") {
          const row = btn.closest('tr');
          handleDeleteProduto(id, row);
      }
      if (action === "open-import") {
          openImportModal('produtos');
      }
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

  if (sorted.length === 0) {
      tableBody.replaceChildren(
          createElement('tr', {}, [
              createElement('td', { colSpan: 3, className: 'text-center text-muted py-4', textContent: 'Nenhum produto registado.' })
          ])
      );
      return;
  }

  const rows = sorted.map(generateProdutoRowElement);
  tableBody.replaceChildren(...rows);
}

function generateProdutoRowElement(prod) {
    const variacoesBadges = prod.variacoes?.map(v => {
        let badgeClass = 'bg-secondary';
        if (v.estoque <= 5) badgeClass = 'bg-danger';
        else if (v.estoque <= 10) badgeClass = 'bg-warning text-dark';
        return createElement('span', { className: `badge ${badgeClass} me-1`, textContent: `${v.nome}: ${v.estoque}` });
    }) || [createElement('span', { className: 'text-muted small', textContent: 'Nenhuma' })];

    return createElement('tr', { dataset: { id: prod.id } }, [
        createElement('td', {}, [createElement('strong', { textContent: prod.nome })]),
        createElement('td', {}, variacoesBadges),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'edit', id: prod.id } }, [
                createElement('i', { className: 'bi bi-pencil-fill' })
            ]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', id: prod.id } }, [
                createElement('i', { className: 'bi bi-trash-fill' })
            ])
        ])
    ]);
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

function addVariacaoField(variacao = { nome: "", estoque: 0, preco: 0 }) {
  const container = document.getElementById("variacoes-container");
  const uniqueId = `variacao-${Date.now()}-${Math.random()}`;
  
  const newField = createElement('div', { className: 'row align-items-center mb-2 variacao-item' }, [
      createElement('div', { className: 'col-5' }, [
          createElement('input', { type: 'text', id: `${uniqueId}-nome`, className: 'form-control form-control-sm variacao-nome', placeholder: 'Nome da Variação', value: variacao.nome, required: true })
      ]),
      createElement('div', { className: 'col-3' }, [
          createElement('input', { type: 'number', id: `${uniqueId}-estoque`, className: 'form-control form-control-sm variacao-estoque', placeholder: 'Estoque', value: variacao.estoque, required: true })
      ]),
      createElement('div', { className: 'col-3' }, [
          createElement('input', { type: 'number', step: '0.01', id: `${uniqueId}-preco`, className: 'form-control form-control-sm variacao-preco', placeholder: 'Preço (R$)', value: variacao.preco || 0, required: true })
      ]),
      createElement('div', { className: 'col-1' }, [
          createElement('button', { type: 'button', className: 'btn btn-sm btn-outline-danger remove-variacao-btn', ariaLabel: 'Remover Variação' }, [
              createElement('i', { className: 'bi bi-trash' })
          ])
      ])
  ]);
  container.appendChild(newField);
}

async function handleSaveProduto(e) {
  e.preventDefault();
  const id = document.getElementById("produto-id").value;
  const variacoes = Array.from(document.querySelectorAll(".variacao-item")).map(item => {
    const nome = item.querySelector(".variacao-nome").value.trim();
    const estoque = parseInt(item.querySelector(".variacao-estoque").value) || 0;
    const preco = parseFloat(item.querySelector(".variacao-preco").value) || 0;
    return nome ? { nome, estoque, preco } : null;
  }).filter(Boolean);

  if (variacoes.length === 0) return showToast("Adicione pelo menos uma variação.", "warning");
  const data = {
    nome: document.getElementById("produto-nome").value,
    metaSemanal: parseInt(document.getElementById("produto-meta").value) || 0,
    variacoes,
    ativo: true
  };

  try {
    const { saveDocument } = await import("../services/firebaseService.js");
    await saveDocument(COLLECTIONS.PRODUTOS, id || null, {
      ...data,
      ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
             : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast(`Produto ${id ? "atualizado" : "salvo"} com sucesso!`, "success");
    closeModal("produtoModal");
  } catch (e) {
    console.error("Erro ao salvar produto:", e);
    showToast(`Erro ao salvar: ${e.message}`, "danger");
  }
}

function handleDeleteProduto(id, rowElement) {
    confirmAction({
        title: 'Excluir Produto',
        message: 'Tem a certeza que deseja excluir este produto? A exclusão não será possível se ele estiver associado a vendas existentes.',
        confirmText: 'Excluir',
        btnClass: 'btn-danger',
        onConfirm: async () => {
            // NOTE: A lógica do Firebase (regras de segurança) deve impedir a exclusão se houver vendas vinculadas.
            if (rowElement) {
                rowElement.style.transition = 'opacity 0.5s ease';
                rowElement.style.opacity = '0';
                setTimeout(() => rowElement.remove(), 500);
            }
            
            const { deleteDocument } = await import("../services/firebaseService.js");
            await deleteDocument(COLLECTIONS.PRODUTOS, id);
        }
    });
}

function openImportModal(type) {
    importedData = [];
    const modalLabel = document.getElementById('importModalLabel');
    const instructions = document.getElementById('import-instructions');
    const fileInput = document.getElementById('import-file-input');
    const previewContainer = document.getElementById('import-preview-container');
    const confirmBtn = document.getElementById('import-confirm-btn');

    modalLabel.textContent = `Importar ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    instructions.textContent = `Selecione um ficheiro (.xlsx, .csv). A primeira linha deve conter os cabeçalhos das colunas (ex: produto, variacao, estoque, preco).`;
    fileInput.value = '';
    previewContainer.innerHTML = '<p class="text-muted small">Nenhum ficheiro selecionado.</p>';
    confirmBtn.disabled = true;

    openModal('importModal');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        importedData = json;
        renderImportPreview(json);
    };
    reader.readAsArrayBuffer(file);
}

function renderImportPreview(data) {
    const previewContainer = document.getElementById('import-preview-container');
    const confirmBtn = document.getElementById('import-confirm-btn');

    if (!data || data.length === 0) {
        previewContainer.innerHTML = '<p class="text-danger small">Nenhum dado encontrado na folha de cálculo ou o formato é inválido.</p>';
        confirmBtn.disabled = true;
        return;
    }

    const headers = Object.keys(data[0]);
    const table = createElement('table', { className: 'table table-sm table-bordered' }, [
        createElement('thead', { className: 'table-light' }, [
            createElement('tr', {}, headers.map(h => createElement('th', { scope: 'col', textContent: h })))
        ]),
        createElement('tbody', {}, data.slice(0, 10).map(row =>
            createElement('tr', {}, headers.map(h => createElement('td', { textContent: row[h] })))
        ))
    ]);
    
    previewContainer.replaceChildren(table);
    if (data.length > 10) {
        previewContainer.appendChild(createElement('p', { className: 'text-muted small mt-2', textContent: `... e mais ${data.length - 10} linha(s).` }));
    }
    confirmBtn.disabled = false;
}

async function handleConfirmImport() {
    if (importedData.length === 0) {
        return showToast("Não há dados para importar.", "warning");
    }

    const confirmBtn = document.getElementById('import-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> A importar...`;

    try {
        const { getDbInstance, doc, collection } = await import("../services/firebaseService.js");
        const db = getDbInstance();
        const batch = writeBatch(db);

        const produtosAgrupados = importedData.reduce((acc, row) => {
            const nomeProduto = findColumnValue(row, ['produto', 'produto base', 'nome do produto'])?.trim();
            if (!nomeProduto) return acc;

            const nomeVariacao = findColumnValue(row, ['variacao', 'variação', 'nome'])?.trim() || 'Padrão';
            const estoque = parseInt(findColumnValue(row, ['estoque', 'stock', 'quantidade']) || 0);
            const preco = parseFloat(findColumnValue(row, ['preco', 'preço', 'valor']) || 0);

            if (!acc[nomeProduto]) {
                acc[nomeProduto] = {
                    nome: nomeProduto,
                    metaSemanal: 0,
                    ativo: true,
                    criadoEm: serverTimestamp(),
                    criadoPor: AppState.currentUser.uid,
                    variacoes: []
                };
            }
            acc[nomeProduto].variacoes.push({ nome: nomeVariacao, estoque, preco });
            return acc;
        }, {});

        Object.values(produtosAgrupados).forEach(produtoData => {
            const newProdRef = doc(collection(db, COLLECTIONS.PRODUTOS));
            batch.set(newProdRef, produtoData);
        });

        await batch.commit();

        showToast(`${Object.keys(produtosAgrupados).length} produtos importados com sucesso!`, "success");
        closeModal('importModal');

    } catch (err) {
        console.error("Erro ao importar dados:", err);
        showToast(`Ocorreu um erro: ${err.message}`, "danger");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Importação';
    }
}