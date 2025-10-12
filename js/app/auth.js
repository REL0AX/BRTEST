import { signIn, signOutUser, registerUser } from "../services/firebaseService.js";
import { resetAppState } from "./state.js";
import { showLoading, hideLoading, showToast } from "./ui.js";

export function attachAuthEventListeners() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutBtn = document.getElementById("logout-button");
  const toggleRegisterLink = document.getElementById("toggle-register-link");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email")?.value;
      const password = document.getElementById("login-password")?.value;
      try {
        showLoading();
        await signIn(email, password);
        showToast("Sessão iniciada com sucesso.", "success");
      } catch (err) {
        console.error(err);
        showToast(`Erro no login: ${err.message}`, "danger");
      } finally {
        hideLoading();
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("register-email")?.value;
      const password = document.getElementById("register-password")?.value;
      try {
        showLoading();
        await registerUser(email, password);
        showToast("Utilizador registado!", "success");
        document.getElementById("login-form")?.classList.remove("d-none");
        document.getElementById("register-form")?.classList.add("d-none");
      } catch (err) {
        console.error(err);
        showToast(`Erro no registo: ${err.message}`, "danger");
      } finally {
        hideLoading();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        showLoading();
        await signOutUser();
        resetAppState();
        showToast("Sessão terminada.", "info");
      } catch (err) {
        console.error(err);
        showToast("Erro ao terminar sessão.", "danger");
      } finally {
        hideLoading();
      }
    });
  }

  if (toggleRegisterLink) {
    toggleRegisterLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("login-form")?.classList.toggle("d-none");
      document.getElementById("register-form")?.classList.toggle("d-none");
      toggleRegisterLink.textContent =
        document.getElementById("register-form")?.classList.contains("d-none")
          ? "Não tem uma conta? Registe-se"
          : "Já tem uma conta? Faça login";
    });
  }
}