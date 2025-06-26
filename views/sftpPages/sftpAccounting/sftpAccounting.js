////views/sftpPages/sftpAccounting/sftpAccounting.js
// Global variables
let currentPath = "/accounting";
let selectedFiles = [];
let fileListData = [];

// DOM elements
const fileListElement = document.getElementById("file-list");
const breadcrumbElement = document.getElementById("breadcrumb");
const uploadModal = document.getElementById("upload-modal");
const folderModal = document.getElementById("folder-modal");
const renameModal = document.getElementById("rename-modal");
const contextMenu = document.getElementById("context-menu");
const loadingOverlay = document.getElementById("loading-overlay");
const notificationElement = document.getElementById("notification");
const connectionStatusElement = document.getElementById("connection-status");
const connectionTextElement = document.getElementById("connection-text");

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  // Load server status and initial file list
  checkConnectionStatus();
  loadFileList(currentPath);

  // Set up event listeners
  setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
  // Toolbar buttons
  document
    .getElementById("upload-btn")
    .addEventListener("click", showUploadModal);
  document
    .getElementById("new-folder-btn")
    .addEventListener("click", showFolderModal);
  document
    .getElementById("refresh-btn")
    .addEventListener("click", () => loadFileList(currentPath));
  document
    .getElementById("delete-btn")
    .addEventListener("click", deleteSelectedFiles);
  document
    .getElementById("rename-btn")
    .addEventListener("click", showRenameModal);
  document
    .getElementById("download-btn")
    .addEventListener("click", downloadSelectedFiles);
  document
    .getElementById("select-all")
    .addEventListener("change", toggleSelectAll);

  // Modal buttons
  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").style.display = "none";
    });
  });

  document.getElementById("cancel-upload").addEventListener("click", () => {
    uploadModal.style.display = "none";
  });

  document.getElementById("cancel-folder").addEventListener("click", () => {
    folderModal.style.display = "none";
  });

  document.getElementById("cancel-rename").addEventListener("click", () => {
    renameModal.style.display = "none";
  });

  // Forms
  document
    .getElementById("upload-form")
    .addEventListener("submit", handleUpload);
  document
    .getElementById("folder-form")
    .addEventListener("submit", createFolder);
  document.getElementById("rename-form").addEventListener("submit", renameFile);

  // Context menu
  document.getElementById("ctx-download").addEventListener("click", () => {
    downloadSelectedFiles();
    hideContextMenu();
  });

  document.getElementById("ctx-rename").addEventListener("click", () => {
    showRenameModal();
    hideContextMenu();
  });

  document.getElementById("ctx-delete").addEventListener("click", () => {
    deleteSelectedFiles();
    hideContextMenu();
  });

  // Close context menu when clicking elsewhere
  document.addEventListener("click", (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Right-click for context menu
  document.addEventListener("contextmenu", (e) => {
    if (
      e.target.closest("tr") &&
      e.target.closest("tr").dataset.type !== "parent"
    ) {
      e.preventDefault();
      showContextMenu(e, e.target.closest("tr"));
    }
  });
}

// Check connection status
async function checkConnectionStatus() {
  try {
    const response = await fetch("/sftpStatus");
    const data = await response.json();

    if (data.connected) {
      connectionStatusElement.className = "status-dot connected";
      connectionTextElement.textContent = "Connected";
      return true;
    } else {
      connectionStatusElement.className = "status-dot disconnected";
      connectionTextElement.textContent = "Disconnected";
      showNotification("Attempting to reconnect to SFTP server...", "warning");

      // Try to force a reconnect
      try {
        await fetch("/sftpConnect", { method: "POST" });
        return await checkConnectionStatus(); // Check again
      } catch (error) {
        console.error("Reconnect failed:", error);
        showNotification("Failed to reconnect to SFTP server", "error");
        return false;
      }
    }
  } catch (error) {
    console.error("Error checking connection status:", error);
    connectionStatusElement.className = "status-dot disconnected";
    connectionTextElement.textContent = "Connection Error";
    showNotification("Failed to check connection status", "error");
    return false;
  }
}

// Load file list for the given path
async function loadFileList(path) {
  // Ensure path starts with /sftp
  if (!path.startsWith("/accounting")) {
    path = "/accounting" + (path === "/" ? "" : path);
  }

  showLoading();
  try {
    const isConnected = await checkConnectionStatus();
    if (!isConnected) {
      throw new Error("Not connected to SFTP server");
    }

    const response = await fetch(`/sftpFiles?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }

    let files = await response.json();

    // Filter out parent directory if we're at /sftp
    if (path === "/accounting") {
      files = files.filter((file) => file.name !== ".." && file.name !== ".");
    }

    currentPath = path;
    fileListData = files;
    renderFileList(files);
    updateBreadcrumb(path);
    clearSelection();
  } catch (error) {
    console.error("Error loading file list:", error);
    showNotification(`Failed to load files: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Render the file list
function renderFileList(files) {
  fileListElement.innerHTML = "";

  // Add parent directory link if not in root
  if (currentPath !== "/") {
    const parentRow = document.createElement("tr");
    parentRow.dataset.type = "parent";
    parentRow.innerHTML = `
                    <td></td>
                    <td>
                        <span class="file-icon directory-icon">📁</span>
                        <a href="#" class="parent-dir">..</a>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                `;
    fileListElement.appendChild(parentRow);

    // In the renderFileList function, modify the parent directory link handler
    parentRow.querySelector(".parent-dir").addEventListener("click", (e) => {
      e.preventDefault();
      const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
      // Don't allow navigation above /sftp
      if (
        parentPath.startsWith("/accounting") ||
        parentPath === "/accounting"
      ) {
        loadFileList(parentPath);
      }
    });
  }

  // Add files and directories
  files.forEach((file) => {
    const row = document.createElement("tr");
    row.dataset.name = file.name;
    row.dataset.type = file.type;

    const size = file.type === "directory" ? "-" : formatFileSize(file.size);
    const modified = new Date(file.modifyTime).toLocaleString();

    row.innerHTML = `
                    <td><input type="checkbox" class="file-checkbox"></td>
                    <td>
                        <span class="file-icon ${
                          file.type === "directory" ? "directory-icon" : ""
                        }">
                            ${file.type === "directory" ? "📁" : "📄"}
                        </span>
                        ${
                          file.type === "directory"
                            ? `<a href="#" class="dir-link">${file.name}</a>`
                            : file.name
                        }
                    </td>
                    <td>${size}</td>
                    <td>${modified}</td>
                    <td class="file-actions">
                        ${
                          file.type === "file"
                            ? '<button class="btn btn-success btn-sm download-btn">Tải xuông</button>'
                            : ""
                        }
                        <button class="btn btn-sm rename-btn">Đổi tên</button>
                        <button class="btn btn-danger btn-sm delete-btn">Xóa</button>
                    </td>
                `;

    fileListElement.appendChild(row);

    // Add event listeners
    const checkbox = row.querySelector(".file-checkbox");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedFiles.push(file.name);
      } else {
        selectedFiles = selectedFiles.filter((name) => name !== file.name);
      }
      updateActionButtons();
    });

    if (file.type === "directory") {
      row.querySelector(".dir-link").addEventListener("click", (e) => {
        e.preventDefault();
        const newPath =
          currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        loadFileList(newPath);
      });
    } else {
      const downloadBtn = row.querySelector(".download-btn");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
          selectedFiles = [file.name];
          downloadSelectedFiles();
        });
      }
    }

    const renameBtn = row.querySelector(".rename-btn");
    renameBtn.addEventListener("click", () => {
      selectedFiles = [file.name];
      showRenameModal();
    });

    const deleteBtn = row.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => {
      selectedFiles = [file.name];
      deleteSelectedFiles();
    });

    // Double click to open directory
    if (file.type === "directory") {
      row.addEventListener("dblclick", () => {
        const newPath =
          currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        loadFileList(newPath);
      });
    }
  });
}

// Update breadcrumb navigation
function updateBreadcrumb(path) {
  breadcrumbElement.innerHTML = "";

  // Remove /sftp prefix for display purposes
  const displayPath = path.replace(/^\/accounting/, "") || "/";
  const parts = displayPath.split("/").filter((part) => part !== "");

  // Add SFTP root indicator (not clickable)
  const rootSpan = document.createElement("span");
  rootSpan.textContent = "Accounting";
  breadcrumbElement.appendChild(rootSpan);

  // Add path parts
  let currentPath = "/accounting";
  parts.forEach((part, index) => {
    currentPath += `/${part}`;

    const separator = document.createElement("span");
    separator.className = "breadcrumb-separator";
    separator.textContent = " / ";
    breadcrumbElement.appendChild(separator);

    const link = document.createElement("a");
    link.href = "#";
    link.textContent = part;
    link.dataset.path = currentPath;
    breadcrumbElement.appendChild(link);
  });

  // Add event listeners to breadcrumb links
  breadcrumbElement.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      loadFileList(link.dataset.path);
    });
  });
}

// Show upload modal
function showUploadModal() {
  document.getElementById("upload-files").value = "";
  uploadModal.style.display = "flex";
}

// Show folder creation modal
function showFolderModal() {
  document.getElementById("folder-name").value = "";
  folderModal.style.display = "flex";
}

// Show rename modal
function showRenameModal() {
  if (selectedFiles.length !== 1) return;

  document.getElementById("old-name").value = selectedFiles[0];
  document.getElementById("new-name").value = selectedFiles[0];
  renameModal.style.display = "flex";
}

// Handle file upload
async function handleUpload(e) {
  e.preventDefault();
  showLoading();

  const filesInput = document.getElementById("upload-files");
  if (filesInput.files.length === 0) {
    showNotification("Please select at least one file", "warning");
    hideLoading();
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < filesInput.files.length; i++) {
    formData.append("files", filesInput.files[i]);
  }
  formData.append("path", currentPath);

  try {
    const response = await fetch("/sftpUpload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    showNotification(`${result.uploaded} tệp tải lên thành công`, "success");
    loadFileList(currentPath);
    uploadModal.style.display = "none";
  } catch (error) {
    console.error("Error uploading files:", error);
    showNotification(`Failed to upload files: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Create new folder
async function createFolder(e) {
  e.preventDefault();
  showLoading();

  const folderName = document.getElementById("folder-name").value.trim();
  if (!folderName) {
    showNotification("Please enter a folder name", "warning");
    hideLoading();
    return;
  }

  try {
    const response = await fetch("/sftpMkdir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: currentPath,
        name: folderName,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    showNotification("Thư mục đã tạo thành công", "success");
    loadFileList(currentPath);
    folderModal.style.display = "none";
  } catch (error) {
    console.error("Error creating folder:", error);
    showNotification(`Failed to create folder: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Rename file or folder
async function renameFile(e) {
  e.preventDefault();
  showLoading();

  const newName = document.getElementById("new-name").value.trim();
  if (!newName) {
    showNotification("Please enter a new name", "warning");
    hideLoading();
    return;
  }

  try {
    const response = await fetch("/sftpRename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: currentPath,
        oldName: selectedFiles[0],
        newName: newName,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    showNotification("Đối tượng đổi tên thành công", "success");
    loadFileList(currentPath);
    renameModal.style.display = "none";
    clearSelection();
  } catch (error) {
    console.error("Error renaming item:", error);
    showNotification(`Failed to rename item: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Delete selected files/folders
async function deleteSelectedFiles() {
  if (selectedFiles.length === 0) return;

  if (
    !confirm(`Bạn có chắc muốn xóa ${selectedFiles.length} đối tượng đã chọn?`)
  ) {
    return;
  }

  showLoading();

  try {
    const response = await fetch("/sftpDelete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: currentPath,
        files: selectedFiles,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    showNotification(
      `${selectedFiles.length} đối tượng xóa thành công`,
      "success"
    );
    loadFileList(currentPath);
    clearSelection();
  } catch (error) {
    console.error("Error deleting items:", error);
    showNotification(`Failed to delete items: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Download selected files
async function downloadSelectedFiles() {
  if (selectedFiles.length === 0) return;

  showLoading();

  try {
    // For single file download
    if (selectedFiles.length === 1) {
      const file = fileListData.find((f) => f.name === selectedFiles[0]);
      if (file.type === "directory") {
        throw new Error("Cannot download directories directly");
      }

      const response = await fetch("/sftpDownload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: currentPath,
          filename: selectedFiles[0],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFiles[0];
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification("Bắt đầu tải xuống", "success");
    } else {
      // For multiple files, we would need a zip creation endpoint
      showNotification("Multiple file download not yet implemented", "warning");
    }
  } catch (error) {
    console.error("Error downloading file:", error);
    showNotification(`Failed to download file: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
}

// Toggle select all files
function toggleSelectAll(e) {
  const checkboxes = document.querySelectorAll(".file-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = e.target.checked;
  });

  if (e.target.checked) {
    selectedFiles = fileListData.map((file) => file.name);
  } else {
    selectedFiles = [];
  }

  updateActionButtons();
}

// Clear selection
function clearSelection() {
  selectedFiles = [];
  document.getElementById("select-all").checked = false;
  document.querySelectorAll(".file-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateActionButtons();
}

// Update action buttons based on selection
function updateActionButtons() {
  const deleteBtn = document.getElementById("delete-btn");
  const renameBtn = document.getElementById("rename-btn");
  const downloadBtn = document.getElementById("download-btn");

  if (selectedFiles.length === 0) {
    deleteBtn.disabled = true;
    renameBtn.disabled = true;
    downloadBtn.disabled = true;
  } else if (selectedFiles.length === 1) {
    deleteBtn.disabled = false;
    renameBtn.disabled = false;
    downloadBtn.disabled = false;
  } else {
    deleteBtn.disabled = false;
    renameBtn.disabled = true;
    downloadBtn.disabled = true; // Until we implement multi-file download
  }
}

// Show context menu
function showContextMenu(e, row) {
  // Select the clicked item
  const fileName = row.dataset.name;
  selectedFiles = [fileName];
  updateActionButtons();

  // Position the context menu
  contextMenu.style.display = "block";
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;

  // Disable download for directories
  const isDirectory = row.dataset.type === "directory";
  document.getElementById("ctx-download").style.display = isDirectory
    ? "none"
    : "block";
}

// Hide context menu
function hideContextMenu() {
  contextMenu.style.display = "none";
}

// Show loading overlay
function showLoading() {
  loadingOverlay.style.display = "flex";
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Show notification
function showNotification(message, type) {
  notificationElement.textContent = message;
  notificationElement.className = `notification ${type}`;
  notificationElement.style.display = "block";

  setTimeout(() => {
    notificationElement.style.display = "none";
  }, 5000);
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
