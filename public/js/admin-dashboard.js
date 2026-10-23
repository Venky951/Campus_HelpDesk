document.querySelectorAll("[data-submit-form-on-change]").forEach((select) => {
  select.dataset.previousValue = select.value;
  select.addEventListener("change", () => {
    const form = select.form;
    if (!form) return;

    if (
      select.matches("[data-ticket-status-select]") &&
      select.value === "Resolved" &&
      select.dataset.previousValue !== "Resolved"
    ) {
      const previousValue = select.dataset.previousValue;
      select.value = previousValue;
      const dialog = document.getElementById("resolution-dialog");
      const details = document.getElementById("resolution-details");
      const title = document.getElementById("resolution-ticket-title");
      if (!dialog || !details || !title) return;

      dialog._resolutionForm = form;
      dialog._resolutionSelect = select;
      title.textContent = select.dataset.ticketTitle || "Ticket";
      details.value = "";
      dialog.showModal();
      return;
    }

    form.requestSubmit();
    select.dataset.previousValue = select.value;
  });
});

document.querySelectorAll("[data-update-form]").forEach((form) => {
  form.addEventListener("submit", () => {
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");
    const control = form.querySelector("select");
    if (control) {
      control.disabled = true;
      control.classList.add("opacity-60");
    }
  });
});

const resolutionDialog = document.getElementById("resolution-dialog");
const resolutionDetails = document.getElementById("resolution-details");
const resolutionError = document.getElementById("resolution-error");
const cancelResolution = document.querySelector("[data-resolution-cancel]");
const confirmResolution = document.querySelector("[data-resolution-confirm]");

const showResolutionError = (message) => {
  if (!resolutionError) return;
  resolutionError.textContent = message;
  resolutionError.hidden = false;
};

const clearResolutionError = () => {
  if (!resolutionError) return;
  resolutionError.textContent = "";
  resolutionError.hidden = true;
};

cancelResolution?.addEventListener("click", () => {
  if (resolutionDialog?._resolutionSelect) {
    resolutionDialog._resolutionSelect.value =
      resolutionDialog._resolutionSelect.dataset.previousValue;
  }
  clearResolutionError();
  resolutionDialog?.close();
});

confirmResolution?.addEventListener("click", () => {
  if (!resolutionDialog || !resolutionDetails) return;

  const form = resolutionDialog._resolutionForm;
  const select = resolutionDialog._resolutionSelect;
  const explanation = resolutionDetails.value.trim();
  if (!form || !select || !explanation) {
    showResolutionError("Resolution Details are required.");
    resolutionDetails.focus();
    return;
  }
  if (explanation.length > 2000) {
    showResolutionError("Resolution Details must be 2000 characters or fewer.");
    resolutionDetails.focus();
    return;
  }

  const hiddenDetails = form.elements.namedItem("resolutionDetails");
  if (hiddenDetails) hiddenDetails.value = explanation;
  select.value = "Resolved";
  select.dataset.previousValue = "Resolved";
  clearResolutionError();
  resolutionDialog.close();
  form.requestSubmit();
});
