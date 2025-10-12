import { AppState } from "../app/state.js";
import { showToast, openModal, confirmAction } from "../app/ui.js";
import { COLLECTIONS } from "../utils/constants.js";
import { parseFirebaseConfig, createElement } from "../utils/helpers.js";

export function bindConfiguracoesGlobal() {
  document.getElementById("configItem-form")?.addEventListener("submit", handleSaveConfigItem);
}

export function renderConfiguracoesSection(updateOnly = false) {
  const contentEl = document.getElementById("configuracoes-content");
  if (!contentEl) return;

  if (AppState.currentUserRole !== 'admin') {
    contentEl.innerHTML = `<div class="alert alert-warning m-4">Acesso restrito a administradores.</div>`;
    return;
  }

  if (!updateOnly) {
    contentEl.innerHTML = '';

    const createTableCard = (title, icon, collection, tableId, headers) => {
        return createElement('div', { className: 'card h-100' }, [
            createElement('div', { className: 'card-body' }, [
                createElement('h5', { className: 'card-title' }, [
                    createElement('i', { className: `bi ${icon} me-2` }),
                    document.createTextNode(title)
                ]),
                createElement('button', { className: 'btn btn-sm btn-primary mb-3', dataset: { action: 'open-config-modal', collection } }, [document.createTextNode('Adicionar')]),
                createElement('div', { className: 'table-responsive' }, [
                    createElement('table', { className: 'table table-sm' }, [
                        createElement('thead', {}, [ createElement('tr', {}, headers.map(h => createElement('th', { textContent: h }))) ]),
                        createElement('tbody', { id: tableId })
                    ])
                ])
            ])
        ]);
    };
    
    const mainRow = createElement('div', { className: 'row' }, [
        createElement('div', { className: 'col-lg-8' }, [
            createElement('div', { className: 'row' }, [
                createElement('div', { className: 'col-lg-6 mb-4' }, [createTableCard('Vendedores', 'bi-people-fill text-primary', COLLECTIONS.VENDEDORES, 'vendedores-table-body', ['Nome', 'Ações'])]),
                createElement('div', { className: 'col-lg-6 mb-4' }, [createTableCard('Formas de Pagamento', 'bi-credit-card-2-front-fill text-success', COLLECTIONS.FORMAS_PAGAMENTO, 'pagamentos-table-body', ['Nome', 'Ações'])]),
                createElement('div', { className: 'col-12 mb-4' }, [createTableCard('Modelos de Celular', 'bi-phone-fill text-info', COLLECTIONS.MODELOS_CELULAR, 'modelos-table-body', ['Marca', 'Modelo', 'Ações'])])
            ])
        ]),
        createElement('div', { className: 'col-lg-4' }, [
             createElement('div', { className: 'card mb-4' }, [
                createElement('div', { className: 'card-body' }, [
                    createElement('h5', { className: 'card-title' }, [ createElement('i', { className: 'bi bi-building-fill text-secondary me-2' }), document.createTextNode('Informações da Empresa') ]),
                    createElement('form', { id: 'app-settings-form' }, [
                        createElement('div', { className: 'mb-3' }, [createElement('label', { htmlFor: 'settings-empresa-nome', className: 'form-label', textContent: 'Nome da Empresa' }), createElement('input', { type: 'text', id: 'settings-empresa-nome', className: 'form-control' })]),
                        createElement('div', { className: 'mb-3' }, [createElement('label', { htmlFor: 'settings-cnpj', className: 'form-label', textContent: 'CNPJ' }), createElement('input', { type: 'text', id: 'settings-cnpj', className: 'form-control' })]),
                        createElement('div', { className: 'mb-3' }, [createElement('label', { htmlFor: 'settings-meta', className: 'form-label', textContent: 'Meta de Faturamento Mensal (R$)' }), createElement('input', { type: 'number', step: '0.01', id: 'settings-meta', className: 'form-control' })]),
                        createElement('div', { className: 'mb-3' }, [createElement('label', { htmlFor: 'settings-logo-url', className: 'form-label', textContent: 'URL do Logotipo' }), createElement('input', { type: 'text', id: 'settings-logo-url', className: 'form-control', placeholder: 'https://exemplo.com/logo.png' })]),
                        createElement('button', { type: 'submit', className: 'btn btn-primary', textContent: 'Salvar' })
                    ])
                ])
             ]),
             createElement('div', { className: 'card mb-4' }, [
                createElement('div', { className: 'card-body' }, [
                    createElement('h5', { className: 'card-title' }, [ createElement('i', { className: 'bi bi-braces-asterisk text-warning me-2' }), document.createTextNode('Configuração do Firebase') ]),
                    createElement('form', { id: 'firebase-config-form' }, [
                        createElement('div', { className: 'mb-3' }, [
                            createElement('textarea', { id: 'firebase-config-input', className: 'form-control', rows: 6, placeholder: 'Cole o objeto de configuração do Firebase aqui...' })
                        ]),
                        createElement('button', { type: 'submit', className: 'btn btn-primary', textContent: 'Salvar e Recarregar' })
                    ])
                ])
             ])
        ])
    ]);
    
    contentEl.appendChild(mainRow);

    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, collection, id } = btn.dataset;
      if (action === "open-config-modal") {
          openConfigItemModal(collection, id);
      }
      else if (action === "delete") {
          const row = btn.closest('tr');
          handleDeleteConfigItem(collection, id, row);
      }
    });
    
    document.getElementById("app-settings-form")?.addEventListener("submit", handleSaveAppSettings);
    document.getElementById("firebase-config-form")?.addEventListener("submit", handleSaveFirebaseConfig);
  }

  updateConfiguracoesForm();
}

function generateSimpleRow(item, collectionName) {
    return createElement('tr', {}, [
        createElement('td', { textContent: item.nome }),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'open-config-modal', collection: collectionName, id: item.id } }, [createElement('i', { className: 'bi bi-pencil' })]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', collection: collectionName, id: item.id } }, [createElement('i', { className: 'bi bi-trash' })])
        ])
    ]);
}

function generateModeloRow(item) {
    return createElement('tr', {}, [
        createElement('td', { textContent: item.marca }),
        createElement('td', { textContent: item.modelo }),
        createElement('td', { className: 'actions-cell' }, [
            createElement('button', { className: 'btn btn-sm btn-outline-primary', dataset: { action: 'open-config-modal', collection: COLLECTIONS.MODELOS_CELULAR, id: item.id } }, [createElement('i', { className: 'bi bi-pencil' })]),
            createElement('button', { className: 'btn btn-sm btn-outline-danger ms-1', dataset: { action: 'delete', collection: COLLECTIONS.MODELOS_CELULAR, id: item.id } }, [createElement('i', { className: 'bi bi-trash' })])
        ])
    ]);
}

function updateConfiguracoesForm() {
    const vendedoresBody = document.getElementById("vendedores-table-body");
    vendedoresBody.replaceChildren(...AppState.vendedores.map(item => generateSimpleRow(item, COLLECTIONS.VENDEDORES)));

    const pagamentosBody = document.getElementById("pagamentos-table-body");
    pagamentosBody.replaceChildren(...AppState.formasPagamento.map(item => generateSimpleRow(item, COLLECTIONS.FORMAS_PAGAMENTO)));
    
    const modelosBody = document.getElementById("modelos-table-body");
    modelosBody.replaceChildren(...AppState.modelosCelular.map(generateModeloRow));

  const settings = AppState.settings || {};
  document.getElementById("settings-empresa-nome").value = settings.nomeEmpresa || "";
  document.getElementById("settings-cnpj").value = settings.cnpj || "";
  document.getElementById("settings-meta").value = settings.metaFaturamentoMensal || "";
  document.getElementById("settings-logo-url").value = settings.logoUrl || "";
  document.getElementById("firebase-config-input").value = localStorage.getItem("firebaseConfig") ? JSON.stringify(JSON.parse(localStorage.getItem("firebaseConfig")), null, 2) : "";
}

function openConfigItemModal(collectionName, id = "") {
  const form = document.getElementById("configItem-form");
  form.reset();
  document.getElementById("configItem-collection").value = collectionName;
  document.getElementById("configItem-id").value = id;

  const isModelo = collectionName === COLLECTIONS.MODELOS_CELULAR;
  const isVendedor = collectionName === COLLECTIONS.VENDEDORES;

  document.getElementById("configItem-marca-group").classList.toggle("d-none", !isModelo);
  document.getElementById("configItem-vendedor-extra-group").classList.toggle("d-none", !isVendedor);
  document.getElementById("configItem-nome").labels[0].textContent = isModelo ? "Modelo" : "Nome";
  const label = isModelo ? "Modelo de Celular" : isVendedor ? "Vendedor" : "Forma de Pagamento";
  document.getElementById("configItemModalLabel").textContent = `${id ? "Editar" : "Novo"} ${label}`;

  if (id) {
    const dataMap = {
      [COLLECTIONS.VENDEDORES]: AppState.vendedores,
      [COLLECTIONS.FORMAS_PAGAMENTO]: AppState.formasPagamento,
      [COLLECTIONS.MODELOS_CELULAR]: AppState.modelosCelular
    };
    const item = dataMap[collectionName]?.find(i => i.id === id);
    if (item) {
      if (isModelo) {
        document.getElementById("configItem-nome").value = item.modelo;
        document.getElementById("configItem-marca").value = item.marca;
      } else if (isVendedor) {
        document.getElementById("configItem-nome").value = item.nome;
        document.getElementById("configItem-emoji").value = item.emoji || "";
        document.getElementById("configItem-cor").value = item.cor || "#0891b2";
        document.getElementById("configItem-foto").value = item.fotoUrl || "";
      } else {
        document.getElementById("configItem-nome").value = item.nome;
      }
    }
  }
  openModal("configItemModal");
}

async function handleSaveConfigItem(e) {
  e.preventDefault();
  const id = document.getElementById("configItem-id").value;
  const collectionName = document.getElementById("configItem-collection").value;
  let data = {};

  if (collectionName === COLLECTIONS.MODELOS_CELULAR) {
    data = { marca: document.getElementById("configItem-marca").value, modelo: document.getElementById("configItem-nome").value };
  } else if (collectionName === COLLECTIONS.VENDEDORES) {
    data = { nome: document.getElementById("configItem-nome").value, emoji: document.getElementById("configItem-emoji").value, cor: document.getElementById("configItem-cor").value, fotoUrl: document.getElementById("configItem-foto").value };
  } else {
    data = { nome: document.getElementById("configItem-nome").value };
  }
  
  try {
    const { saveDocument, serverTimestamp } = await import("../services/firebaseService.js");
    await saveDocument(collectionName, id || null, {
        ...data,
        ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
               : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast("Item salvo com sucesso!", "success");
    closeModal("configItemModal");
  } catch (err) {
      console.error("Erro ao salvar item de configuração:", err);
      showToast(`Erro ao salvar: ${err.message}`, "danger");
  }
}

async function handleSaveAppSettings(e) {
  e.preventDefault();
  const data = {
    nomeEmpresa: document.getElementById("settings-empresa-nome").value,
    cnpj: document.getElementById("settings-cnpj").value,
    metaFaturamentoMensal: parseFloat(document.getElementById("settings-meta").value) || 0,
    logoUrl: document.getElementById("settings-logo-url").value,
  };

  try {
    const { saveDocument, serverTimestamp } = await import("../services/firebaseService.js");
    await saveDocument(COLLECTIONS.CONFIGURACOES, "geral", {
        ...data,
        modificadoPor: AppState.currentUser.uid,
        modificadoEm: serverTimestamp()
    }, true);
    showToast("Configurações salvas!", "success");
  } catch(err) {
      console.error("Erro ao salvar configurações:", err);
      showToast(`Erro ao salvar: ${err.message}`, "danger");
  }
}

function handleSaveFirebaseConfig(e) {
  e.preventDefault();
  const configStr = document.getElementById("firebase-config-input").value.trim();
  const config = parseFirebaseConfig(configStr);
  if (!config || !config.apiKey || !config.projectId) return showToast("Configuração inválida.", "danger");
  localStorage.setItem("firebaseConfig", JSON.stringify(config));
  showToast("Configuração salva. A recarregar...", "success");
  setTimeout(() => window.location.reload(), 1200);
}

function handleDeleteConfigItem(collectionName, id, rowElement) {
    const itemSource = {
        [COLLECTIONS.VENDEDORES]: AppState.vendedores,
        [COLLECTIONS.FORMAS_PAGAMENTO]: AppState.formasPagamento,
        [COLLECTIONS.MODELOS_CELULAR]: AppState.modelosCelular
    };
    const item = (itemSource[collectionName] || []).find(i => i.id === id);
    if (!item) {
        return showToast("Item não encontrado.", "danger");
    }

    confirmAction({
        title: `Excluir Item`,
        message: `Tem a certeza que deseja excluir "${item.nome || item.modelo}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        btnClass: 'btn-danger',
        onConfirm: async () => {
            if (rowElement) {
                rowElement.style.transition = 'opacity 0.5s ease';
                rowElement.style.opacity = '0';
                setTimeout(() => rowElement.remove(), 500);
            }
            
            const { deleteDocument } = await import("../services/firebaseService.js");
            await deleteDocument(collectionName, id);
        }
    });
}