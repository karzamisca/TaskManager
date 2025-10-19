// views/userPages/userPermission/userPermission.js
// Configuration
const API_BASE_URL = "/userPermissionControl";
let currentUser = null;
let allUsers = [];

// Common system permissions
const commonPermissions = [
  "Nhập liệu tài chính mua bán khí",
  "Xem bảng tài chính tổng hợp",
  "Nhập liệu tài chính ngân hàng",
  "Nhập liệu tài chính mua sắm và xây dựng",
];

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  loadAllUsers();
  initializeCommonPermissions();
});

// Load all users for search functionality
async function loadAllUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}`);
    const data = await response.json();

    if (response.ok) {
      allUsers = data.users;
    } else {
      console.error("Không thể tải danh sách người dùng:", data.error);
    }
  } catch (error) {
    console.error("Lỗi khi tải người dùng:", error);
  }
}

// Initialize common permissions checkboxes
function initializeCommonPermissions() {
  const container = document.getElementById("commonPermissions");

  commonPermissions.forEach((permission) => {
    const card = document.createElement("div");
    card.className = "permission-card";
    card.innerHTML = `
            <label>
                <input type="checkbox" value="${permission}" onchange="togglePermission('${permission}')">
                ${permission}
            </label>
        `;
    container.appendChild(card);
  });
}

// Search users functionality
function searchUsers() {
  const searchTerm = document.getElementById("userSearch").value.toLowerCase();
  const resultsContainer = document.getElementById("userSearchResults");

  if (searchTerm.length < 2) {
    resultsContainer.classList.add("hidden");
    return;
  }

  const filteredUsers = allUsers.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm) ||
      user.realName.toLowerCase().includes(searchTerm)
  );

  if (filteredUsers.length > 0) {
    resultsContainer.innerHTML = filteredUsers
      .map(
        (user) => `
                <div class="permission-card" onclick="selectUserFromSearch('${user.id}')" style="cursor: pointer; margin: 5px 0;">
                    <strong>${user.username}</strong> - ${user.realName}
                    <br><small>ID: ${user.id}</small>
                </div>
            `
      )
      .join("");
    resultsContainer.classList.remove("hidden");
  } else {
    resultsContainer.innerHTML =
      '<div class="message">Không tìm thấy người dùng</div>';
    resultsContainer.classList.remove("hidden");
  }
}

// Select user from search results
function selectUserFromSearch(userId) {
  document.getElementById("userId").value = userId;
  document.getElementById("userSearchResults").classList.add("hidden");
  document.getElementById("userSearch").value = "";
  loadUser();
}

// Load user data
async function loadUser() {
  const userId = document.getElementById("userId").value.trim();

  if (!userId) {
    showMessage("Vui lòng nhập ID người dùng", "error");
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/${userId}`);
    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      displayUserInfo();
      updateSelectedPermissionsDisplay();
      document.getElementById("userInfo").classList.remove("hidden");
      showMessage("Đã tải thông tin người dùng thành công", "success");
    } else {
      showMessage(data.error || "Không thể tải thông tin người dùng", "error");
    }
  } catch (error) {
    showMessage("Lỗi khi tải người dùng: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Display user information
function displayUserInfo() {
  document.getElementById("infoUsername").textContent = currentUser.username;
  document.getElementById("infoRealName").textContent = currentUser.realName;
  document.getElementById("infoUserId").textContent = currentUser.id;
  document.getElementById("infoPermissionCount").textContent =
    currentUser.permissions.length;

  // Update checkboxes based on current permissions
  updatePermissionCheckboxes();
}

// Update permission checkboxes based on current user permissions
function updatePermissionCheckboxes() {
  const checkboxes = document.querySelectorAll(
    '#commonPermissions input[type="checkbox"]'
  );

  checkboxes.forEach((checkbox) => {
    const permission = checkbox.value;
    const card = checkbox.closest(".permission-card");

    if (currentUser.permissions.includes(permission)) {
      checkbox.checked = true;
      card.classList.add("selected");
    } else {
      checkbox.checked = false;
      card.classList.remove("selected");
    }
  });
}

// Toggle permission selection
function togglePermission(permission) {
  const checkbox = document.querySelector(`input[value="${permission}"]`);
  const card = checkbox.closest(".permission-card");

  if (checkbox.checked) {
    if (!currentUser.permissions.includes(permission)) {
      currentUser.permissions.push(permission);
      card.classList.add("selected");
    }
  } else {
    currentUser.permissions = currentUser.permissions.filter(
      (p) => p !== permission
    );
    card.classList.remove("selected");
  }

  updateSelectedPermissionsDisplay();
}

// Remove permission
function removePermission(permission) {
  currentUser.permissions = currentUser.permissions.filter(
    (p) => p !== permission
  );

  // Uncheck corresponding checkbox if it exists
  const checkbox = document.querySelector(`input[value="${permission}"]`);
  if (checkbox) {
    checkbox.checked = false;
    checkbox.closest(".permission-card").classList.remove("selected");
  }

  updateSelectedPermissionsDisplay();
}

// Update selected permissions display
function updateSelectedPermissionsDisplay() {
  const container = document.getElementById("selectedPermissions");

  if (currentUser.permissions.length === 0) {
    container.innerHTML = "<p>Chưa có quyền nào được chọn</p>";
  } else {
    container.innerHTML = currentUser.permissions
      .map(
        (permission) => `
                <span class="permission-tag">
                    ${permission}
                    <span class="remove" onclick="removePermission('${permission}')">×</span>
                </span>
            `
      )
      .join("");
  }

  document.getElementById("infoPermissionCount").textContent =
    currentUser.permissions.length;
}

// Update permissions on server
async function updatePermissions() {
  if (!currentUser) {
    showMessage("Vui lòng tải thông tin người dùng trước", "error");
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(
      `${API_BASE_URL}/${currentUser.id}/permissions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissions: currentUser.permissions,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      showMessage("Đã cập nhật quyền thành công!", "success");
    } else {
      showMessage(data.error || "Không thể cập nhật quyền", "error");
    }
  } catch (error) {
    showMessage("Lỗi khi cập nhật quyền: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Reset form
function resetForm() {
  if (confirm("Bạn có chắc chắn muốn đặt lại tất cả thay đổi?")) {
    if (currentUser) {
      loadUser(); // Reload original data
    } else {
      document.getElementById("userId").value = "";
      document.getElementById("userInfo").classList.add("hidden");
    }
  }
}

// Utility functions
function showMessage(message, type) {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = message;
  messageDiv.className = `message ${type}`;
  messageDiv.classList.remove("hidden");

  setTimeout(() => {
    messageDiv.classList.add("hidden");
  }, 5000);
}

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}
