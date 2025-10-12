import { AppState, updateAppState } from "./state.js";
import { setActiveSection, toggleSidebar, showToast } from "./ui.js";
import { renderDashboardSection } from "../views/dashboard.js";
import { renderVendasSection, setVendasFilters } from "../views/vendas.js";
import { renderProdutosSection } from "../views/produtos.js";
import { renderDepositosSection } from "../views/depositos.js";
import { renderGastosSection } from "../views/gastos.js";
import { renderRelatoriosSection } from "../views/relatorios.js";
import { renderConfiguracoesSection } from "../views/configuracoes.js";
import { renderCaixaSection } from "../views/caixa.js";

const routes = {
  dashboard: renderDashboardSection,
  vendas: renderVendasSection,
  produtos: renderProdutosSection,
  depositos: renderDepositosSection,
  gastos: renderGastosSection,
  relatorios: renderRelatoriosSection,
  configuracoes: renderConfiguracoesSection,
  caixa: renderCaixaSection
};

const sectionPermissions = {
    configuracoes: 'admin',
    caixa: 'admin',
};

function hasPermission(section) {
    const requiredRole = sectionPermissions[section];
    if (!requiredRole) {
        return true;
    }
    return AppState.currentUserRole === requiredRole;
}


export function handleNavigation(section, options = {}) {
  const target = section || AppState.activeSection || "dashboard";

  if (!hasPermission(target)) {
      showToast("Acesso negado. Não tem permissão para ver esta secção.", "warning");
      console.warn(`Acesso à secção "${target}" negado para a função "${AppState.currentUserRole}".`);
      return;
  }

  updateAppState({ activeSection: target });
  setActiveSection(target);
  
  routes[target]?.();

  if (target === 'vendas' && Object.keys(options).length > 0) {
      setTimeout(() => setVendasFilters(options), 50);
  }
}

export function attachNavigationEventListeners() {
  document.getElementById("main-nav")?.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (!link) return;
    e.preventDefault();
    const section = link.dataset.section;
    if (!section || section === AppState.activeSection) return;

    handleNavigation(section);
    
    if (window.innerWidth < 992 && document.querySelector(".sidebar.is-open")) {
      toggleSidebar();
    }
  });

  document.querySelectorAll(".sidebar-toggle, .sidebar-overlay").forEach(el =>
    el.addEventListener("click", () => toggleSidebar())
  );
}