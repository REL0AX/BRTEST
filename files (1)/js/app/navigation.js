import { AppState, updateAppState } from "./state.js";
import { setActiveSection, toggleSidebar } from "./ui.js";
import { renderDashboardSection } from "../views/dashboard.js";
import { renderVendasSection } from "../views/vendas.js";
import { renderProdutosSection } from "../views/produtos.js";
import { renderDepositosSection } from "../views/depositos.js";
import { renderGastosSection } from "../views/gastos.js";
import { renderRelatoriosSection } from "../views/relatorios.js";
import { renderConfiguracoesSection } from "../views/configuracoes.js";

const routes = {
  dashboard: renderDashboardSection,
  vendas: renderVendasSection,
  produtos: renderProdutosSection,
  depositos: renderDepositosSection,
  gastos: renderGastosSection,
  relatorios: renderRelatoriosSection,
  configuracoes: renderConfiguracoesSection
};

export function handleNavigation(section) {
  const target = section || AppState.activeSection || "dashboard";
  updateAppState({ activeSection: target });
  setActiveSection(target);
  routes[target]?.();
}

export function attachNavigationEventListeners() {
  // Click nos links
  document.getElementById("main-nav")?.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (!link) return;
    e.preventDefault();
    const section = link.dataset.section;
    if (!section) return;
    if (section === "configuracoes" && !AppState.isCurrentUserAdmin) return;
    handleNavigation(section);
    if (window.innerWidth < 992 && document.querySelector(".sidebar.is-open")) {
      toggleSidebar();
    }
  });

  // Toggle sidebar (mobile)
  document.querySelectorAll(".sidebar-toggle, .sidebar-overlay").forEach(el =>
    el.addEventListener("click", () => toggleSidebar())
  );
}