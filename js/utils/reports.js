import { formatCurrency, getDateRange, getSaleDate } from "./helpers.js";
import { showToast } from "../app/ui.js";

function getFilteredSalesData(AppState) {
  const searchTerm = document.getElementById("vendas-search")?.value.toLowerCase() || "";
  const vendedorFilter = document.getElementById("vendas-filter-vendedor")?.value || "";
  const pagamentoFilter = document.getElementById("vendas-filter-pagamento")?.value || "";

  return AppState.sales.filter(s =>
    (!vendedorFilter || s.vendedor === vendedorFilter) &&
    (!pagamentoFilter || (s.formasPagamento || [{ metodo: s.formaPagamento }]).some(p => p.metodo === pagamentoFilter)) &&
    (searchTerm === "" || (s.notaFiscal && s.notaFiscal.toLowerCase().includes(searchTerm)))
  );
}

function getReportDefinition(reportType, data) {
    let head = [];
    let body = [];
    let excelData = [];

    const formatPagamentos = (sale) => (sale.formasPagamento || [{ metodo: sale.formaPagamento, valor: sale.valor }])
        .map(p => p ? `${p.metodo}: ${formatCurrency(p.valor)}` : '')
        .join("; ");

    const formatProdutos = (sale, includePriceDetail = false) => {
        if (!Array.isArray(sale.produtos)) return sale.nomeProduto || "";
        return sale.produtos.map(p => {
            let detail = '';
            if (includePriceDetail) {
                const diff = p.precoVendido - p.precoOriginal;
                if (diff > 0) {
                    detail = ` (Vendido por ${formatCurrency(p.precoVendido)}, Base ${formatCurrency(p.precoOriginal)})`;
                }
            }
            return `${p.nomeCompleto} ${p.modeloNome || ''}`.trim() + detail;
        }).join("; ");
    };

    switch (reportType) {
        case 'gastos':
            head = [["Data", "Descrição", "Valor"]];
            body = data.map(g => [getSaleDate(g)?.toLocaleDateString("pt-BR"), g.descricao, formatCurrency(g.valor)]);
            excelData = data.map(g => ({ "Data": getSaleDate(g)?.toLocaleDateString("pt-BR"), "Descrição": g.descricao, "Valor": g.valor }));
            break;
        
        case 'lucro-extra':
            head = [["Data", "Vendedor", "Produto", "Valor Vendido", "Valor Base", "Lucro Extra"]];
            body = data.map(item => [
                getSaleDate(item.sale)?.toLocaleDateString("pt-BR"),
                item.sale.vendedor,
                item.produto.nomeCompleto,
                formatCurrency(item.produto.precoVendido),
                formatCurrency(item.produto.precoOriginal),
                formatCurrency(item.produto.precoVendido - item.produto.precoOriginal)
            ]);
            excelData = data.map(item => ({
                "Data": getSaleDate(item.sale)?.toLocaleDateString("pt-BR"),
                "Vendedor": item.sale.vendedor,
                "Produto": item.produto.nomeCompleto,
                "Valor Vendido": item.produto.precoVendido,
                "Valor Base": item.produto.precoOriginal,
                "Lucro Extra": item.produto.precoVendido - item.produto.precoOriginal,
                "Nota Fiscal": item.sale.notaFiscal || ""
            }));
            break;

        case 'vendas':
        case 'testes':
        case 'completo':
        default:
            head = [["Data", "Nota Fiscal", "Vendedor", "Produtos", "Valor", "Pagamentos"]];
            body = data.map(s => [
                getSaleDate(s)?.toLocaleDateString("pt-BR"), 
                s.notaFiscal || "", 
                s.vendedor, 
                formatProdutos(s, true),
                formatCurrency(s.valor), 
                formatPagamentos(s).replace(/; /g, '\n')
            ]);
            excelData = data.map(s => ({
                "Data": getSaleDate(s)?.toLocaleDateString("pt-BR"),
                "Nota Fiscal": s.notaFiscal || "",
                "Vendedor": s.vendedor,
                "Produtos": formatProdutos(s, true),
                "Valor Total Venda": s.valor,
                "Formas de Pagamento": formatPagamentos(s),
                "Observação": s.observacao
            }));
            break;
    }

    return { head, body, excelData };
}

export function exportData(format, reportType, AppState) {
  if (reportType === "diario-sumario") return generateDailySummaryReport(format, AppState);

  const data = getReportData(reportType, AppState);
  if (data.length === 0) {
      showToast("Nenhum dado para exportar.", "info");
      return;
  }

  const filename = `relatorio_${reportType}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  
  const { head, body, excelData } = getReportDefinition(reportType, data);

  if (format === "pdf") {
    const { jsPDF } = window.jspdf;
    if (!jsPDF || !jsPDF.autoTable) {
      console.error("Biblioteca jsPDF ou autoTable não carregada.");
      return alert("Biblioteca de PDF não carregada. Recarregue a página.");
    }
    const docPDF = new jsPDF();
    docPDF.text(`Relatório de ${reportType}`, 14, 15);
    docPDF.autoTable({ startY: 20, head, body });
    docPDF.save(`${filename}.pdf`);
  } else {
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

export function generateDailySummaryReport(format, AppState) {
  const todaySales = AppState.sales.filter(s => getSaleDate(s) >= getDateRange("today").start);
  if (todaySales.length === 0) {
    return showToast("Nenhuma venda hoje para gerar o relatório diário.", "info");
  }

  let totalDinheiro = 0, totalPix = 0, totalCartao = 0;
  todaySales.forEach(sale => {
      (sale.formasPagamento || [{ metodo: sale.formaPagamento, valor: sale.valor }]).forEach(p => {
          if (!p) return;
          const metodo = p.metodo.toLowerCase();
          if (metodo === 'dinheiro') totalDinheiro += p.valor;
          else if (metodo === 'pix') totalPix += p.valor;
          else if (['crédito', 'debito', 'débito'].includes(metodo)) totalCartao += p.valor;
      });
  });
  
  const totalVendas = todaySales.reduce((sum, s) => sum + s.valor, 0);

  const summary = {
    "Total Vendas (R$)": formatCurrency(totalVendas),
    "Vendas (un.)": todaySales.length,
    "Ticket Médio (R$)": formatCurrency(todaySales.length > 0 ? totalVendas / todaySales.length : 0),
    "Dinheiro (R$)": formatCurrency(totalDinheiro),
    "Pix (R$)": formatCurrency(totalPix),
    "Cartão (R$)": formatCurrency(totalCartao),
  };

  const filename = `relatorio_diario_${new Date().toISOString().slice(0, 10)}`;
  if (format === "pdf") {
    const { jsPDF } = window.jspdf;
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
    case "lucro-extra": {
        const items = [];
        getValidSales(s => s.produtos && s.produtos.some(p => p.precoVendido > p.precoOriginal))
            .forEach(sale => {
                sale.produtos.forEach(produto => {
                    if (produto.precoVendido > produto.precoOriginal) {
                        items.push({ sale, produto });
                    }
                });
            });
        return items;
    }
    case "vendas":
    default: return getFilteredSalesData(AppState);
  }
}