import { firebaseConfig } from "../firebase-config.js";
import {
  initializeFirebase,
  monitorAuthState,
  createFirestoreListener,
  createDocListener,
  getDocument,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
  doc,
  collection,
  orderBy,
  limit
} from "../services/firebaseService.js";
import { AppState, updateAppState } from "./state.js";
import { applyTheme, showToast } from "./ui.js";
import { attachAuthEventListeners } from "./auth.js";
import { attachNavigationEventListeners, handleNavigation } from "./navigation.js";

// Views (algumas funções utilitárias exportadas serão usadas aqui)
import { onAfterAuthDashboard } from "../views/dashboard.js";
import { bindVendasGlobal } from "../views/vendas.js";
import { bindProdutosGlobal } from "../views/produtos.js";
import { bindDepositosGlobal } from "../views/depositos.js";
import { bindGastosGlobal } from "../views/gastos.js";
import { bindRelatoriosGlobal } from "../views/relatorios.js";
import { bindConfiguracoesGlobal } from "../views/configuracoes.js";

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

function attachDataListeners() {
  // vendas (data), limit 500 como no original
  createFirestoreListener("vendas", (data) => {
    updateAppState({ sales: data });
    // Atualizações em seções dependentes
    if (AppState.activeSection === "vendas" || AppState.activeSection === "dashboard" || AppState.activeSection === "relatorios") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("data"), limit(500)]);

  // depósitos
  createFirestoreListener("depositos", (data) => {
    updateAppState({ deposits: data });
    if (AppState.activeSection === "depositos" || AppState.activeSection === "dashboard") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("data"), limit(500)]);

  // gastos
  createFirestoreListener("gastos", (data) => {
    updateAppState({ expenses: data });
    if (AppState.activeSection === "gastos" || AppState.activeSection === "dashboard") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("data"), limit(500)]);

  // produtos
  createFirestoreListener("produtos", (data) => {
    updateAppState({ products: data });
    if (AppState.activeSection === "produtos" || AppState.activeSection === "vendas") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("nome"), limit(500)]);

  // vendedores
  createFirestoreListener("vendedores", (data) => {
    updateAppState({ vendedores: data });
    if (AppState.activeSection === "configuracoes" || AppState.activeSection === "vendas") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("nome"), limit(500)]);

  // formasPagamento
  createFirestoreListener("formasPagamento", (data) => {
    updateAppState({ formasPagamento: data });
    if (AppState.activeSection === "configuracoes" || AppState.activeSection === "vendas") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("nome"), limit(500)]);

  // modelosCelular (order by marca, modelo)
  createFirestoreListener("modelosCelular", (data) => {
    updateAppState({ modelosCelular: data });
    if (AppState.activeSection === "configuracoes") {
      handleNavigation(AppState.activeSection);
    }
  }, [orderBy("marca"), orderBy("modelo"), limit(500)]);

  // Configurações/geral (documento)
  createDocListener("configuracoes", "geral", (cfg) => {
    const settings = cfg || { metaFaturamentoMensal: 50000 };
    updateAppState({ settings });
    // Atualiza a marca no sidebar
    const brandEl = document.getElementById("sidebar-brand");
    if (brandEl) {
      brandEl.innerHTML = settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="${settings.nomeEmpresa || "Logo"}" style="max-height: 40px;">`
        : `<h4>${settings.nomeEmpresa || "BRTEST"}</h4>`;
    }
    if (AppState.activeSection === "configuracoes" || AppState.activeSection === "dashboard") {
      handleNavigation(AppState.activeSection);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializa Firebase
  initializeFirebase(firebaseConfig);

  // UI básicos
  initTheme();
  attachAuthEventListeners();
  attachNavigationEventListeners();

  // Bind handlers globais específicos por view (modais/ações de página, import/export)
  bindVendasGlobal();
  bindProdutosGlobal();
  bindDepositosGlobal();
  bindGastosGlobal();
  bindRelatoriosGlobal();
  bindConfiguracoesGlobal();

  // Fluxo de auth
  monitorAuthState(
    async (user) => {
      updateAppState({ currentUser: user });
      document.body.classList.remove("auth-page");
      document.getElementById("app-section")?.classList.remove("d-none");
      document.getElementById("auth-section")?.classList.add("d-none");
      document.getElementById("user-email-display").textContent = user?.email || "";

      // Admin check
      try {
        const admin = await getDocument("admins", user.uid);
        updateAppState({ isCurrentUserAdmin: !!admin });
        // Esconde/mostra link de Configurações
        const configLink = document.querySelector('a[data-section="configuracoes"]');
        if (configLink) configLink.style.display = AppState.isCurrentUserAdmin ? "flex" : "none";
      } catch (e) {
        console.warn("Falha ao verificar admin:", e);
      }

      // Liga listeners de dados
      attachDataListeners();

      // Ações pós-auth de views (ex.: tour)
      onAfterAuthDashboard();

      // Navega para dashboard
      handleNavigation("dashboard");
    },
    () => {
      updateAppState({ currentUser: null, isCurrentUserAdmin: false });
      document.body.classList.add("auth-page");
      document.getElementById("app-section")?.classList.add("d-none");
      document.getElementById("auth-section")?.classList.remove("d-none");
      showToast("Sessão não autenticada.", "info");
    }
  );

  // Primeira navegação (fallback)
  handleNavigation("dashboard");
});