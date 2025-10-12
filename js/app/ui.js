export function showLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    el.classList.remove("d-none");
  }
}

export function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    setTimeout(() => el.classList.add("d-none"), 150);
  }
}

export function showToast(message, type = "info", duration = 4000) {
  const tc = document.querySelector(".toast-container");
  if (!tc) return;
  const iconMap = { success: "check-circle-fill", danger: "exclamation-triangle-fill", warning: "exclamation-triangle-fill", info: "info-circle-fill" };
  const t = document.createElement("div");
  t.className = `toast align-items-center text-white bg-${type} border-0`;
  t.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center"><i class="bi bi-${iconMap[type]} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>`;
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
  document.querySelectorAll("#main-nav .nav-link").forEach(l => l.classList.remove("active"));
  const targetLink = document.querySelector(`#main-nav .nav-link[data-section="${section}"]`);
  if (targetLink) {
    targetLink.classList.add("active");
    document.getElementById("page-title").textContent = targetLink.textContent.trim();
  }
  document.querySelectorAll(".page-content").forEach(c => c.classList.add("d-none"));
  document.getElementById(`${section}-content`)?.classList.remove("d-none");
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(el);
    modalInstance.show();
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    const modalInstance = bootstrap.Modal.getInstance(el);
    modalInstance?.hide();
  }
}

export function confirmAction({ title = 'Confirmar Ação', message, confirmText = 'Confirmar', btnClass = 'btn-primary', onConfirm }) {
    const modalEl = document.getElementById("confirmDeleteModal");
    if (!modalEl) return;

    modalEl.querySelector('.modal-title').textContent = title;
    modalEl.querySelector('.modal-body p').textContent = message;
    const confirmBtn = modalEl.querySelector('#confirmDelete-btn');
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${btnClass}`;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    let isActionRunning = false;

    const clickHandler = async () => {
        if (isActionRunning) return;
        isActionRunning = true;
        
        const originalText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> A processar...`;
        
        try {
            await onConfirm();
            showToast("Ação concluída com sucesso!", "success");
        } catch (e) {
            console.error("Erro na ação de confirmação:", e);
            showToast(`Erro ao executar a ação: ${e.message}`, "danger");
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
            modal.hide();
            isActionRunning = false;
        }
    };
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', clickHandler, { once: true });

    modal.show();
}