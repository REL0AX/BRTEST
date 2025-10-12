import { AppState } from "../app/state.js";
import { exportData } from "../utils/reports.js";

export function bindRelatoriosGlobal() {
  // Ações são tratadas dentro da secção
}

export function renderRelatoriosSection(updateOnly = false) {
  const contentEl = document.getElementById("relatorios-content");
  if (!contentEl) return;

  if (!updateOnly) {
    contentEl.innerHTML = `
      <div class="card"><div class="card-body">
        <h5 class="card-title">Gerar Relatório</h5>
        <table class="table mt-3"><tbody>
          <tr><td>Relatório de Vendas (com filtros da pág. Lançamentos)</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-vendas"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-vendas"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
          <tr><td>Relatório de Gastos</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-gastos"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-gastos"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
          <tr><td>Relatório de Vendas com Lucro Extra</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-lucro-extra"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-lucro-extra"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
          <tr><td>Relatório de Testes (Vendas com valor R$0)</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-testes"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-testes"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
          <tr><td>Relatório Diário Consolidado</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-diario-sumario"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-diario-sumario"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
          <tr><td>Relatório Completo (Todas as Vendas)</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" data-report="pdf-completo"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button> <button class="btn btn-outline-success btn-sm" data-report="excel-completo"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button></td></tr>
        </tbody></table>
      </div></div>
    `;

    contentEl.addEventListener("click", (e) => {
      const reportBtn = e.target.closest("[data-report]");
      if (reportBtn) {
        const type = reportBtn.dataset.report;
        const format = type.startsWith("pdf-") ? "pdf" : "excel";
        const report = type.replace(`${format}-`, "");
        exportData(format, report, AppState);
      }
    });
  }
}