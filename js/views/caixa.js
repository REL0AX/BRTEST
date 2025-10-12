import { AppState } from "../app/state.js";
import { formatCurrency, getDateRange, getSaleDate, createElement } from "../utils/helpers.js";
import { openModal, closeModal, showToast } from "../app/ui.js";
import { COLLECTIONS } from "../utils/constants.js";
import { serverTimestamp } from "../services/firebaseService.js";

let fechamentoDiarioData = {};

export function renderCaixaSection(updateOnly = false) {
    const contentEl = document.getElementById("caixa-content");
    if (!contentEl) return;

    if (AppState.currentUserRole !== 'admin') {
        contentEl.innerHTML = `<div class="alert alert-warning m-4">Acesso restrito a administradores.</div>`;
        return;
    }

    if (!updateOnly) {
        contentEl.innerHTML = ''; 

        const filterGroup = createElement('div', { className: 'd-flex justify-content-between align-items-center mb-4 gap-2 flex-wrap' }, [
            createElement('select', { id: 'caixa-period-filter', className: 'form-select w-auto', ariaLabel: 'Filtrar período do caixa' }, [
                createElement('option', { value: 'today', textContent: 'Hoje', selected: true }),
                createElement('option', { value: '7days', textContent: 'Últimos 7 dias' }),
                createElement('option', { value: 'this_month', textContent: 'Este Mês' }),
                createElement('option', { value: 'all', textContent: 'Tudo' })
            ]),
            createElement('button', { id: 'open-fechamento-caixa-btn', className: 'btn btn-primary' }, [
                createElement('i', { className: 'bi bi-calendar-check-fill me-2' }),
                document.createTextNode('Fechar Caixa do Dia')
            ])
        ]);

        const summaryRow = createElement('div', { className: 'row' }, [
            createElement('div', { className: 'col-lg-4 mb-4' }, [
                createElement('div', { className: 'card h-100' }, [
                    createElement('div', { className: 'card-body text-center' }, [
                        createElement('h6', { className: 'card-subtitle text-muted mb-2', textContent: 'SALDO ATUAL EM CAIXA' }),
                        createElement('h2', { id: 'caixa-saldo-total', className: 'card-title display-5 fw-bold', textContent: 'R$ 0,00' }),
                        createElement('p', { className: 'text-muted small', textContent: 'Calculado para o período selecionado' })
                    ])
                ])
            ]),
            createElement('div', { className: 'col-lg-8 mb-4' }, [
                createElement('div', { className: 'row' }, [
                    createStatCard('success', 'arrow-down-circle-fill', 'Entradas (Dinheiro)', 'caixa-total-entradas'),
                    createStatCard('danger', 'arrow-up-circle-fill', 'Gastos', 'caixa-total-gastos'),
                    createStatCard('warning', 'box-arrow-up-right', 'Depósitos (Sangria)', 'caixa-total-depositos')
                ])
            ])
        ]);

        const historyCard = createElement('div', { className: 'card' }, [
            createElement('div', { className: 'card-header' }, [
                createElement('h5', { textContent: 'Histórico de Transações em Caixa' })
            ]),
            createElement('div', { className: 'card-body' }, [
                createElement('div', { className: 'table-responsive' }, [
                    createElement('table', { className: 'table' }, [
                        createElement('thead', {}, [
                            createElement('tr', {}, [
                                createElement('th', { textContent: 'Data' }),
                                createElement('th', { textContent: 'Tipo' }),
                                createElement('th', { textContent: 'Descrição' }),
                                createElement('th', { className: 'text-end', textContent: 'Valor' })
                            ])
                        ]),
                        createElement('tbody', { id: 'caixa-transactions-table-body' })
                    ])
                ])
            ])
        ]);

        contentEl.append(filterGroup, summaryRow, historyCard);

        contentEl.querySelector("#caixa-period-filter").addEventListener("change", updateCaixaView);
        contentEl.querySelector("#open-fechamento-caixa-btn").addEventListener("click", openFechamentoModal);
        document.getElementById("fechamento-caixa-form")?.addEventListener("submit", handleSaveFechamento);
        document.getElementById("fechamento-contado")?.addEventListener("input", calcularDiferencaCaixa);
    }

    updateCaixaView();
}

function createStatCard(color, icon, title, elementId) {
    return createElement('div', { className: 'col-md-4 mb-4 mb-md-0' }, [
        createElement('div', { className: `stat-card ${color} h-100` }, [
            createElement('div', { className: 'card-body' }, [
                createElement('h6', { className: 'card-subtitle text-muted' }, [
                    createElement('i', { className: `bi bi-${icon} me-2` }),
                    document.createTextNode(title)
                ]),
                createElement('h4', { id: elementId, className: 'fw-bold mt-2', textContent: 'R$ 0,00' })
            ])
        ])
    ]);
}


function updateCaixaView() {
    const period = document.getElementById("caixa-period-filter").value;
    const { start, end } = getDateRange(period);

    let allTransactions = [];
    let totalEntradasDinheiro = 0, totalGastos = 0, totalDepositos = 0;

    AppState.sales.filter(s => { const d = getSaleDate(s); return d && d >= start && d <= end; })
    .forEach(sale => {
        const saleDate = getSaleDate(sale);
        if (sale.formasPagamento?.length) {
            sale.formasPagamento.forEach(p => {
                if (p.metodo?.toLowerCase() === 'dinheiro') {
                    totalEntradasDinheiro += p.valor;
                    allTransactions.push({ date: saleDate, type: 'Venda (Dinheiro)', description: `Venda para ${sale.vendedor}`, value: p.valor });
                }
            });
        } else if (sale.formaPagamento?.toLowerCase() === 'dinheiro') {
            totalEntradasDinheiro += sale.valor;
            allTransactions.push({ date: saleDate, type: 'Venda (Dinheiro)', description: `Venda para ${sale.vendedor}`, value: sale.valor });
        }
    });

    AppState.expenses.filter(e => { const d = getSaleDate(e); return d && d >= start && d <= end; })
    .forEach(gasto => {
        totalGastos += gasto.valor;
        allTransactions.push({ date: getSaleDate(gasto), type: 'Gasto', description: gasto.descricao, value: -gasto.valor });
    });

    AppState.deposits.filter(d => { const date = getSaleDate(d); return date && date >= start && date <= end; })
    .forEach(deposito => {
        totalDepositos += deposito.valor;
        allTransactions.push({ date: getSaleDate(deposito), type: 'Depósito', description: deposito.observacao || 'Sangria', value: -deposito.valor });
    });

    const saldoFinal = totalEntradasDinheiro - totalGastos - totalDepositos;
    document.getElementById('caixa-saldo-total').textContent = formatCurrency(saldoFinal);
    document.getElementById('caixa-total-entradas').textContent = formatCurrency(totalEntradasDinheiro);
    document.getElementById('caixa-total-gastos').textContent = formatCurrency(totalGastos);
    document.getElementById('caixa-total-depositos').textContent = formatCurrency(totalDepositos);

    allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    const tableBody = document.getElementById('caixa-transactions-table-body');
    
    if (allTransactions.length === 0) {
        tableBody.replaceChildren(
            createElement('tr', {}, [
                createElement('td', { colSpan: 4, className: 'text-center text-muted py-4', textContent: 'Nenhuma transação em caixa para o período.' })
            ])
        );
    } else {
        const rows = allTransactions.map(t => {
            const isEntrada = t.value > 0;
            return createElement('tr', {}, [
                createElement('td', { textContent: t.date.toLocaleString('pt-BR') }),
                createElement('td', { textContent: t.type }),
                createElement('td', { textContent: t.description }),
                createElement('td', { className: `text-end fw-bold ${isEntrada ? 'text-success' : 'text-danger'}` }, [
                    createElement('i', { className: `bi ${isEntrada ? 'bi-plus-circle-fill' : 'bi-dash-circle-fill'} me-1` }),
                    document.createTextNode(`${formatCurrency(Math.abs(t.value))}`)
                ])
            ]);
        });
        tableBody.replaceChildren(...rows);
    }
}

function openFechamentoModal() {
    const { start } = getDateRange('today');
    let entradas = 0, gastos = 0, depositos = 0;

    AppState.sales.filter(s => getSaleDate(s) >= start).forEach(sale => {
        (sale.formasPagamento || []).forEach(p => {
            if (p.metodo?.toLowerCase() === 'dinheiro') entradas += p.valor;
        });
    });
    AppState.expenses.filter(e => getSaleDate(e) >= start).forEach(g => gastos += g.valor);
    AppState.deposits.filter(d => getSaleDate(d) >= start).forEach(dep => depositos += dep.valor);

    const esperado = entradas - gastos - depositos;
    fechamentoDiarioData = { entradas, gastos, depositos, esperado };

    document.getElementById('fechamento-data').textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById('fechamento-entradas').textContent = formatCurrency(entradas);
    document.getElementById('fechamento-gastos').textContent = formatCurrency(gastos);
    document.getElementById('fechamento-depositos').textContent = formatCurrency(depositos);
    document.getElementById('fechamento-esperado').textContent = formatCurrency(esperado);
    document.getElementById('fechamento-contado').value = '';
    document.getElementById('fechamento-resultado').classList.add('d-none');

    openModal('fechamentoCaixaModal');
}

function calcularDiferencaCaixa() {
    const contado = parseFloat(document.getElementById('fechamento-contado').value) || 0;
    const { esperado } = fechamentoDiarioData;
    const diferenca = contado - esperado;

    const resultadoEl = document.getElementById('fechamento-resultado');
    resultadoEl.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-warning');

    if (Math.abs(diferenca) < 0.01) {
        resultadoEl.classList.add('alert-success');
        resultadoEl.textContent = 'Caixa correto!';
    } else if (diferenca > 0) {
        resultadoEl.classList.add('alert-warning');
        resultadoEl.textContent = `Sobra de ${formatCurrency(diferenca)}`;
    } else {
        resultadoEl.classList.add('alert-danger');
        resultadoEl.textContent = `Falta de ${formatCurrency(Math.abs(diferenca))}`;
    }
}

async function handleSaveFechamento(e) {
    e.preventDefault();
    const contado = parseFloat(document.getElementById('fechamento-contado').value);
    if (isNaN(contado)) {
        return showToast("Por favor, insira o valor contado no caixa.", "warning");
    }

    const { saveDocument } = await import("../services/firebaseService.js");
    const { currentUser } = AppState;

    const fechamentoData = {
        ...fechamentoDiarioData,
        contado,
        diferenca: contado - fechamentoDiarioData.esperado,
        dataFechamento: serverTimestamp(),
        usuarioId: currentUser.uid,
        usuarioEmail: currentUser.email
    };

    const confirmBtn = document.getElementById('fechamento-confirmar-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> A guardar...`;

    try {
        await saveDocument(COLLECTIONS.CAIXA_FECHAMENTOS, null, fechamentoData);
        showToast("Fechamento de caixa guardado com sucesso!", "success");
        closeModal('fechamentoCaixaModal');
    } catch (err) {
        console.error("Erro ao salvar fechamento de caixa:", err);
        showToast(`Erro ao guardar: ${err.message}`, "danger");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirmar Fechamento';
    }
}