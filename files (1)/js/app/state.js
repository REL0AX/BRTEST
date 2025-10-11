// Estado global centralizado + pub/sub
export const AppState = {
  currentUser: null,
  isCurrentUserAdmin: false,

  // Dados
  sales: [],
  products: [],
  deposits: [],
  expenses: [],
  vendedores: [],
  formasPagamento: [],
  modelosCelular: [],
  settings: {},

  // UI
  activeSection: "dashboard",
  theme: localStorage.getItem("brtest_theme") || "light"
};

const listeners = new Map(); // event -> Set<fn>

export function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  listeners.get(eventName)?.delete(handler);
}

export function emit(eventName, payload) {
  listeners.get(eventName)?.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error(e); }
  });
}

export function updateAppState(partial, eventName = "state:changed") {
  Object.assign(AppState, partial);
  emit(eventName, AppState);
}

export function resetAppState() {
  updateAppState({
    currentUser: null,
    isCurrentUserAdmin: false,
    sales: [],
    products: [],
    deposits: [],
    expenses: [],
    vendedores: [],
    formasPagamento: [],
    modelosCelular: [],
    settings: {},
    activeSection: "dashboard"
  });
}