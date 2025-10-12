export function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function formatCurrency(value, locale = "pt-BR", currency = "BRL") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value || 0));
  } catch {
    return `${value}`;
  }
}

export function getWeekRange() {
  const now = new Date();
  const firstDayOfWeek = now.getDate() - now.getDay();
  const start = new Date(now.setDate(firstDayOfWeek));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getDateRange(period) {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "7days":
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      start = new Date(0);
      end = new Date();
  }
  return { start, end };
}

export function getPreviousDateRange(start, end) {
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff - 1), end: new Date(start.getTime() - 1) };
}

export function calculateTrend(current, previous) {
  if (previous === 0) return current > 0 ? { text: "▲", color: "text-success" } : { text: "-", color: "" };
  const p = ((current - previous) / previous) * 100;
  return { text: `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1)}% vs período anterior`, color: p >= 0 ? "text-success" : "text-danger" };
}

export function getSaleDate(item) {
  if (item?.data?.toDate) return item.data.toDate();
  if (item?.data instanceof Date) return item.data;
  return null;
}

export function renderPagination(container, totalItems, currentPage, onChange, itemsPerPage = 20) {
  if (!container) return;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  container.innerHTML = totalPages <= 1 ? "" : Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(i => `<li class="page-item ${i === currentPage ? "active" : ""}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`)
    .join("");
  container.onclick = (e) => {
    e.preventDefault();
    const pageLink = e.target.closest("[data-page]");
    if (pageLink) onChange(parseInt(pageLink.dataset.page));
  };
}

export function findColumnValue(row, possibleNames) {
  const key = Object.keys(row).find(k => possibleNames.includes(k.toLowerCase().trim()));
  return key ? row[key] : undefined;
}

export function parseFirebaseConfig(configStr) {
  try {
    return JSON.parse(configStr);
  } catch {
    const match = configStr.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const objStr = match[0].replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/'/g, '"');
    try {
      return JSON.parse(objStr);
    } catch (err2) {
      return null;
    }
  }
}

export function createElement(tag, options = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(options).forEach(([key, value]) => {
        if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                el.dataset[dataKey] = dataValue;
            });
        } else {
            el[key] = value;
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });

    return el;
}