// Relatórios: PDF (jsPDF + autoTable), Excel (XLSX)
import { formatCurrency, getDateRange, getSaleDate } from "./helpers.js";

function getFilteredSalesData(AppState) {
  const searchTerm = document.getElementById("vendas-search")?.value.toLowerCase() || "";
  const vendedorFilter = document.getElementById("vendas-filter-vendedor")?.value || "";
  const pagamentoFilter = document.getElementById("vendas-filter-pagamento")?.value || "";

  return AppState.sales.filter(s =>
    (searchTerm === "" || Object.values(s).some(val => val != null && String(val).toLowerCase().includes(searchTerm))) &&
    (!vendedorFilter || s.vendedor === vendedorFilter) &&
    (!pagamentoFilter || s.formaPagamento === pagamentoFilter)
  );
}

export function exportData(format, reportType, AppState) {
  if (reportType === "diario-sumario") return generateDailySummaryReport(format, AppState);

  const data = getReportData(reportType, AppState);
  if (data.length === 0) return window?.toast?.("Nenhum dado para exportar.", "info");

  const filename = `relatorio_${reportType}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  const { jsPDF } = window.jspdf || {};

  if (format === "pdf") {
    if (!jsPDF || !window.jspdf?.jsPDF || !window.jspdf?.jsPDF) {
      alert("Biblioteca jsPDF não carregada.");
      return;
    }
    const docPDF = new jsPDF();
    docPDF.text(`Relatório de ${reportType}`, 14, 15);
    let head, body;

    if (reportType === "gastos") {
      head = [["Data", "Descrição", "Valor"]];
      body = data.map(g => [getSaleDate(g)?.toLocaleDateString("pt-BR"), g.descricao, formatCurrency(g.valor)]);
    } else {
      head = [["Data", "Nota Fiscal", "Vendedor", "Produtos", "Valor", "Pagamento"]];
      body = data.map(s => {
        const produtos = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto).join("; ") : s.nomeProduto;
        return [getSaleDate(s)?.toLocaleDateString("pt-BR"), s.notaFiscal || "", s.vendedor, produtos, formatCurrency(s.valor), s.formaPagamento];
      });
    }
    docPDF.autoTable({ startY: 20, head, body });
    docPDF.save(`${filename}.pdf`);
  } else {
    // Excel
    const wsData = reportType === "gastos"
      ? data.map(g => ({ "Data": getSaleDate(g)?.toLocaleDateString("pt-BR"), "Descrição": g.descricao, "Valor": g.valor }))
      : data.map(s => {
          const produtos = Array.isArray(s.produtos) ? s.produtos.map(p => p.nomeCompleto).join("; ") : s.nomeProduto;
          return {
            "Data": getSaleDate(s)?.toLocaleDateString("pt-BR"),
            "Nota Fiscal": s.notaFiscal || "",
            "Vendedor": s.vendedor,
            "Produtos": produtos,
            "Valor Total Venda": s.valor,
            "Forma Pagamento": s.formaPagamento,
            "Observação": s.observacao
          };
        });
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

export function generateDailySummaryReport(format, AppState) {
  const todaySales = AppState.sales.filter(s => getSaleDate(s) >= getDateRange("today").start);
  if (todaySales.length === 0) {
    alert("Nenhuma venda hoje para gerar.");
    return;
  }

  const summary = {
    "Total Vendas (R$)": formatCurrency(todaySales.reduce((sum, s) => sum + s.valor, 0)),
    "Vendas (un.)": todaySales.length,
    "Ticket Médio (R$)": formatCurrency(todaySales.reduce((sum, s) => sum + s.valor, 0) / todaySales.length),
    "Dinheiro (R$)": formatCurrency(todaySales.filter(s=>s.formaPagamento==='Dinheiro').reduce((s,t)=>s+t.valor,0)),
    "Pix (R$)": formatCurrency(todaySales.filter(s=>s.formaPagamento==='Pix').reduce((s,t)=>s+t.valor,0)),
    "Cartão (R$)": formatCurrency(todaySales.filter(s=>['Crédito','Débito'].includes(s.formaPagamento)).reduce((s,t)=>s+t.valor,0)),
  };

  const filename = `relatorio_diario_${new Date().toISOString().slice(0, 10)}`;
  if (format === "pdf") {
    const { jsPDF } = window.jspdf || {};
    const doc = new jsPDF();
    doc.text(`Relatório Diário - ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);
    doc.autoTable({ startY: 30, head: [["Métrica", "Valor"]], body: Object.entries(summary) });
    doc.save(`${filename}.pdf`);
  } else {
    const ws = XLSX.utils.json_to_sheet([summary]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumo");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

export function getReportData(reportType = "vendas", AppState) {
  const getValidSales = (filterFn) => AppState.sales.filter(s => getSaleDate(s) && filterFn(s));
  switch (reportType) {
    case "testes": return getValidSales(s => s.valor === 0);
    case "completo": return getValidSales(() => true);
    case "gastos": return AppState.expenses.filter(g => getSaleDate(g));
    case "vendas":
    default: return getFilteredSalesData(AppState);
  }
}