import { AppState } from "../app/state.js";
import { showToast, openModal } from "../app/ui.js";
import { COLLECTIONS } from "../utils/constants.js";
import { parseFirebaseConfig } from "../utils/helpers.js";

export function bindConfiguracoesGlobal() {
  // Eventos de formulários de modais
  document.getElementById("configItem-form")?.addEventListener("submit", handleSaveConfigItem);
  document.getElementById("app-settings-form")?.addEventListener("submit", handleSaveAppSettings);
  document.getElementById("firebase-config-form")?.addEventListener("submit", handleSaveFirebaseConfig);
}

export function renderConfiguracoesSection(updateOnly = false) {
  const contentEl = document.getElementById("configuracoes-content");
  if (!contentEl) return;

  if (!AppState.isCurrentUserAdmin) {
    contentEl.innerHTML = `<div class="alert alert-warning">Acesso restrito a administradores.</div>`;
    return;
  }

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="row">
        <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Vendedores</h5><button class="btn btn-sm btn-primary mb-3" data-action="open-config-modal" data-collection="${COLLECTIONS.VENDEDORES}">Adicionar</button><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Nome</th><th>Ações</th></tr></thead><tbody id="vendedores-table-body"></tbody></table></div></div></div></div>
        <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Formas de Pagamento</h5><button class="btn btn-sm btn-primary mb-3" data-action="open-config-modal" data-collection="${COLLECTIONS.FORMAS_PAGAMENTO}">Adicionar</button><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Nome</th><th>Ações</th></tr></thead><tbody id="pagamentos-table-body"></tbody></table></div></div></div></div>
        <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Modelos de Celular</h5><button class="btn btn-sm btn-primary mb-3" data-action="open-config-modal" data-collection="${COLLECTIONS.MODELOS_CELULAR}">Adicionar</button> <button class="btn btn-sm btn-outline-secondary mb-3" data-action="open-import" data-type="modelos">Importar</button><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Marca</th><th>Modelo</th><th>Ações</th></tr></thead><tbody id="modelos-table-body"></tbody></table></div></div></div></div>
        <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Informações da Empresa</h5>
          <form id="app-settings-form">
            <div class="mb-3"><label for="settings-empresa-nome" class="form-label">Nome da Empresa</label><input type="text" id="settings-empresa-nome" class="form-control"></div>
            <div class="mb-3"><label for="settings-cnpj" class="form-label">CNPJ</label><input type="text" id="settings-cnpj" class="form-control"></div>
            <div class="mb-3"><label for="settings-meta" class="form-label">Meta de Faturamento Mensal (R$)</label><input type="number" step="0.01" id="settings-meta" class="form-control"></div>
            <div class="mb-3"><label for="settings-logo-url" class="form-label">URL do Logotipo</label><input type="text" id="settings-logo-url" class="form-control" placeholder="https://exemplo.com/logo.png"></div>
            <div class="mb-3"><label for="settings-feriados" class="form-label">Feriados (DD/MM/AAAA, separados por vírgula)</label><textarea id="settings-feriados" class="form-control" rows="2"></textarea></div>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </form>
        </div></div></div>
        <div class="col-12"><div class="card"><div class="card-body"><h5 class="card-title">Configuração do Firebase</h5><p class="text-muted small">Cole aqui o objeto de Configuração do seu projeto Firebase.</p><form id="firebase-config-form"><div class="mb-3"><textarea id="firebase-config-input" class="form-control" rows="10"></textarea></div><button type="submit" class="btn btn-primary">Salvar e Recarregar</button></form></div></div></div>
      </div>
    `;

    // Listener de delegação para ações
    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, collection, id, type } = btn.dataset;
      if (action === "open-config-modal") openConfigItemModal(collection, id);
      if (action === "delete") confirmDelete(collection, id);
      if (action === "open-import") openImportModal(type);
    });
  }

  updateConfiguracoesForm();
}

function updateConfiguracoesForm() {
  // Preencher tabelas
  document.getElementById("vendedores-table-body").innerHTML = AppState.vendedores.map(v => `<tr><td>${v.nome}</td><td class="actions-cell"><button class="btn btn-sm btn-outline-primary" data-action="open-config-modal" data-collection="${COLLECTIONS.VENDEDORES}" data-id="${v.id}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.VENDEDORES}" data-id="${v.id}"><i class="bi bi-trash"></i></button></td></tr>`).join("");
  document.getElementById("pagamentos-table-body").innerHTML = AppState.formasPagamento.map(p => `<tr><td>${p.nome}</td><td class="actions-cell"><button class="btn btn-sm btn-outline-primary" data-action="open-config-modal" data-collection="${COLLECTIONS.FORMAS_PAGAMENTO}" data-id="${p.id}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.FORMAS_PAGAMENTO}" data-id="${p.id}"><i class="bi bi-trash"></i></button></td></tr>`).join("");
  document.getElementById("modelos-table-body").innerHTML = AppState.modelosCelular.map(m => `<tr><td>${m.marca}</td><td>${m.modelo}</td><td class="actions-cell"><button class="btn btn-sm btn-outline-primary" data-action="open-config-modal" data-collection="${COLLECTIONS.MODELOS_CELULAR}" data-id="${m.id}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-collection="${COLLECTIONS.MODELOS_CELULAR}" data-id="${m.id}"><i class="bi bi-trash"></i></button></td></tr>`).join("");

  // Preencher formulários
  const settings = AppState.settings || {};
  document.getElementById("settings-empresa-nome").value = settings.nomeEmpresa || "";
  document.getElementById("settings-cnpj").value = settings.cnpj || "";
  document.getElementById("settings-meta").value = settings.metaFaturamentoMensal || "";
  document.getElementById("settings-logo-url").value = settings.logoUrl || "";
  document.getElementById("settings-feriados").value = (settings.feriados || []).map(d => d.split("-").reverse().join("/")).join(", ");
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
    const refMod = bootstrap.Modal.getInstance(document.getElementById("configItemModal"));
    await saveDocument(collectionName, id || null, {
        ...data,
        ...(id ? { modificadoPor: AppState.currentUser.uid, modificadoEm: serverTimestamp() }
               : { criadoPor: AppState.currentUser.uid, criadoEm: serverTimestamp() })
    }, true);
    showToast("Item salvo com sucesso!", "success");
    refMod?.hide();
  } catch (err) {
      showToast(`Erro ao salvar: ${err.message}`, "danger");
  }
}

async function handleSaveAppSettings(e) {
  e.preventDefault();
  const feriadosArray = document.getElementById("settings-feriados").value.split(",").map(d => {
    const parts = d.trim().split("/");
    return parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : null;
  }).filter(Boolean);

  const data = {
    nomeEmpresa: document.getElementById("settings-empresa-nome").value,
    cnpj: document.getElementById("settings-cnpj").value,
    metaFaturamentoMensal: parseFloat(document.getElementById("settings-meta").value) || 0,
    logoUrl: document.getElementById("settings-logo-url").value,
    feriados: feriadosArray,
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