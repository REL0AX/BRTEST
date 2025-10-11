// UI genérica: loading/toast/tema/sidebar e helpers de layout

export function showLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    el.classList.remove("d-none");
  }
}

export function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    // manter mínimo de exibição
    setTimeout(() => el.classList.add("d-none"), 150);
  }
}

export function showToast(message, type = "info", duration = 4000) {
  const tc = document.querySelector(".toast-container");
  if (!tc) return;
  const iconMap = { success: "check-circle-fill", danger: "exclamation-triangle-fill", warning: "exclamation-triangle-fill", info: "info-circle-fill" };
  const t = document.createElement("div");
  t.className = `toast align-items-center text-white bg-${type} border-0`;
  t.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center"><i class="bi bi-${iconMap[type]} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  tc.appendChild(t);
  const toast = new bootstrap.Toast(t, { delay: duration });
  toast.show();
  t.addEventListener("hidden.bs.toast", () => t.remove());
}

export function applyTheme(nextTheme) {
  document.body.classList.toggle("dark-mode", nextTheme === "dark");
  const switchInput = document.getElementById("theme-switch");
  if (switchInput) switchInput.checked = (nextTheme === "dark");
  localStorage.setItem("brtest_theme", nextTheme);
}

export function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("is-open");
}

export function setActiveSection(section) {
  // Nav
  document.querySelectorAll("#main-nav .nav-link").forEach(l => l.classList.remove("active"));
  const targetLink = document.querySelector(`#main-nav .nav-link[data-section="${section}"]`);
  if (targetLink) {
    targetLink.classList.add("active");
    document.getElementById("page-title").textContent = targetLink.textContent.trim();
  }
  // Content panes
  document.querySelectorAll(".page-content").forEach(c => c.classList.add("d-none"));
  document.getElementById(`${section}-content`)?.classList.remove("d-none");
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) new bootstrap.Modal(el).show();
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const inst = bootstrap.Modal.getInstance(el);
  inst?.hide();
}