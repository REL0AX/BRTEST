import { firebaseConfig } from "../firebase-config.js";
import {
  initializeFirebase,
  monitorAuthState,
  createFirestoreListener,
  createDocListener,
  getDocument,
  getDbInstance
} from "../services/firebaseService.js";
import { AppState, updateAppState } from "./state.js";
import { applyTheme } from "./ui.js";
import { attachAuthEventListeners } from "./auth.js";
import { attachNavigationEventListeners, handleNavigation } from "./navigation.js";
import { onAfterAuthDashboard } from "../views/dashboard.js";
import { bindVendasGlobal, openVendaModal } from "../views/vendas.js";
import { bindProdutosGlobal } from "../views/produtos.js";
import { bindDepositosGlobal } from "../views/depositos.js";
import { bindGastosGlobal } from "../views/gastos.js";
import { bindRelatoriosGlobal } from "../views/relatorios.js";
import { bindConfiguracoesGlobal } from "../views/configuracoes.js";
import { COLLECTIONS, DEFAULTS } from "../utils/constants.js";
import { orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function initTheme() {
  const saved = AppState.theme || "light";
  applyTheme(saved);
  const themeSwitch = document.getElementById("theme-switch");
  if (themeSwitch) {
    themeSwitch.checked = saved === "dark";
    themeSwitch.addEventListener("change", () => {
      const next = themeSwitch.checked ? "dark" : "light";
      applyTheme(next);
      updateAppState({ theme: next });
    });
  }
}

function attachDataListeners(userRole, user) {
  const sectionsToUpdateMap = {
    vendas: ["vendas", "dashboard", "relatorios", "caixa"],
    depositos: ["depositos", "dashboard", "caixa"],
    gastos: ["gastos", "dashboard", "caixa"],
    produtos: ["produtos", "vendas", "dashboard"],
    vendedores: ["configuracoes", "vendas", "dashboard"],
    formasPagamento: ["configuracoes", "vendas"],
    modelosCelular: ["configuracoes"],
    configuracoes: ["configuracoes", "dashboard"]
  };

  const createListener = (collectionName, stateKey, queryConstraints = []) => {
    return createFirestoreListener(collectionName, (data) => {
      updateAppState({ [stateKey]: data });
      const relevantSections = sectionsToUpdateMap[collectionName] || [];
      if (relevantSections.includes(AppState.activeSection)) {
        handleNavigation(AppState.activeSection, {});
      }
    }, queryConstraints);
  };
  
  const salesConstraints = [orderBy("data", "desc")];
  if (userRole === 'vendedor') {
      salesConstraints.push(where("vendedor", "==", user.email));
  }
  
  createListener(COLLECTIONS.VENDAS, "sales", [...salesConstraints, limit(DEFAULTS.paginationLimit)]);

  createListener(COLLECTIONS.DEPOSITOS, "deposits", [orderBy("data", "desc")]);
  createListener(COLLECTIONS.GASTOS, "expenses", [orderBy("data", "desc")]);
  createListener(COLLECTIONS.PRODUTOS, "products", [orderBy("nome")]);
  createListener(COLLECTIONS.VENDEDORES, "vendedores", [orderBy("nome")]);
  createListener(COLLECTIONS.FORMAS_PAGAMENTO, "formasPagamento", [orderBy("nome")]);
  createListener(COLLECTIONS.MODELOS_CELULAR, "modelosCelular", [orderBy("marca"), orderBy("modelo")]);

  createDocListener(COLLECTIONS.CONFIGURACOES, "geral", (cfg) => {
    const settings = cfg || { metaFaturamentoMensal: 50000 };
    updateAppState({ settings });
    const brandEl = document.getElementById("sidebar-brand");
    if (brandEl) {
      brandEl.innerHTML = settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="${settings.nomeEmpresa || "Logo"}" style="max-height: 40px;">`
        : `<h4>${settings.nomeEmpresa || "BRTEST"}</h4>`;
    }
    if (sectionsToUpdateMap.configuracoes.includes(AppState.activeSection)) {
      handleNavigation(AppState.activeSection);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const storedConfigStr = localStorage.getItem("firebaseConfig");
  const config = storedConfigStr ? JSON.parse(storedConfigStr) : firebaseConfig;
  
  if (!config || !config.apiKey) {
      document.body.innerHTML = `<div class="vh-100 d-flex justify-content-center align-items-center text-center"><div><h2>Configuração do Firebase não encontrada.</h2><p>Por favor, adicione a configuração no painel ou no arquivo <strong>js/firebase-config.js</strong> e recarregue a página.</p></div></div>`;
      return;
  }
  
  initializeFirebase(config);
  window.db = getDbInstance();

  initTheme();
  attachAuthEventListeners();
  attachNavigationEventListeners();

  bindVendasGlobal();
  bindProdutosGlobal();
  bindDepositosGlobal();
  bindGastosGlobal();
  bindRelatoriosGlobal();
  bindConfiguracoesGlobal();
  
  document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action="open-venda-modal"]');
      if (actionBtn) {
          openVendaModal();
      }
  });

  let listeners = [];
  const clearListeners = () => {
      listeners.forEach(unsubscribe => unsubscribe());
      listeners = [];
  };

  monitorAuthState(
    async (user) => {
      clearListeners();
      updateAppState({ currentUser: user });
      document.body.classList.remove("auth-page");
      document.getElementById("app-section")?.classList.remove("d-none");
      document.getElementById("auth-section")?.classList.add("d-none");
      document.getElementById("user-email-display").textContent = user?.email || "";

      let userRole = 'vendedor'; 
      try {
        const adminDoc = await getDocument(COLLECTIONS.ADMINS, user.uid);
        if (adminDoc) userRole = 'admin';
      } catch (e) {
        console.warn("Falha ao verificar a função do utilizador:", e);
      } finally {
        updateAppState({ currentUserRole: userRole });

        document.querySelectorAll('a[data-section="configuracoes"], a[data-section="caixa"]').forEach(link => {
            link.style.display = userRole === 'admin' ? 'flex' : 'none';
        });

        listeners = attachDataListeners(userRole, user);
        handleNavigation("dashboard");
        onAfterAuthDashboard();
      }
    },
    () => {
      clearListeners();
      updateAppState({ currentUser: null, currentUserRole: null });
      document.body.classList.add("auth-page");
      document.getElementById("app-section")?.classList.add("d-none");
      document.getElementById("auth-section")?.classList.remove("d-none");
      document.getElementById("login-section")?.classList.remove("d-none");
    }
  );
});