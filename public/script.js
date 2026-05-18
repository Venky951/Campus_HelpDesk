const roleSelect = document.getElementById("role");
const departmentBox = document.getElementById("department");

roleSelect.addEventListener("change", function () {
  if (this.value === "admin") {
    departmentBox.classList.remove("hidden");
  } else {
    departmentBox.classList.add("hidden");
  }
});
