const roleSelect = document.getElementById("role");
const departmentBox = document.getElementById("department");

if (roleSelect && departmentBox) {
  roleSelect.addEventListener("change", function () {
    if (this.value === "admin") {
      departmentBox.classList.remove("hidden");
    } else {
      departmentBox.classList.add("hidden");
    }
  });
}
