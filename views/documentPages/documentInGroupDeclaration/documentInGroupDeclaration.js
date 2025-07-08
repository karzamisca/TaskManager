// views\documentPages\documentInGroupDeclaration\documentInGroupDeclaration.js
let allGroups = [];
let allDocuments = [];
let unassignedDocuments = [];
let scrollPosition = 0;

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEventListeners();
});

function sanitizeForSelector(str) {
  return str.replace(/[^a-z0-9]/g, function (s) {
    return "_" + s.charCodeAt(0).toString(16) + "_";
  });
}

// Load all necessary data
async function loadData() {
  try {
    // Save current scroll position
    scrollPosition = window.scrollY || document.documentElement.scrollTop;

    const [groupsRes, unassignedRes] = await Promise.all([
      fetch("/getGroupDeclaration"),
      fetch("/getUnassignedDocumentsForGroupDeclaration"),
    ]);

    allGroups = await groupsRes.json();
    unassignedDocuments = await unassignedRes.json();

    const groupDeclarationedRes = await fetch(
      "/getGroupDeclarationedDocuments"
    );
    const groupDeclarationedData = await groupDeclarationedRes.json();

    allDocuments = [];
    for (const [groupName, docs] of Object.entries(groupDeclarationedData)) {
      allDocuments.push(...docs);
    }

    // Now that we have all data, render the groups
    renderGroups();

    // Restore scroll position after rendering
    window.scrollTo(0, scrollPosition);
  } catch (error) {
    console.error("Error loading data:", error);
    showNotification("Lỗi khi tải dữ liệu", "error");
  }
}

// Render all groups with their documents
function renderGroups() {
  const container = document.getElementById("groups-container");

  // Create a document fragment to build our updates off-DOM
  const fragment = document.createDocumentFragment();

  if (allGroups.length === 0) {
    container.innerHTML = "<p>Không có nhóm nào</p>";
    return;
  }

  // Sort groups by name (assuming PTT[DDMMYYYY] format)
  const sortedGroups = [...allGroups].sort((a, b) => {
    const dateA = a.name.replace("PTT", "");
    const dateB = b.name.replace("PTT", "");
    const formattedDateA =
      dateA.substring(4) + dateA.substring(2, 4) + dateA.substring(0, 2);
    const formattedDateB =
      dateB.substring(4) + dateB.substring(2, 4) + dateB.substring(0, 2);
    return formattedDateB.localeCompare(formattedDateA);
  });

  // Get existing group elements
  const existingGroups = Array.from(container.querySelectorAll(".group-card"));
  const existingGroupNames = existingGroups.map(
    (el) => el.querySelector(".group-title").textContent.split(" - ")[0]
  );

  sortedGroups.forEach((group) => {
    const groupDocs = allDocuments.filter(
      (doc) => doc.groupDeclarationName === group.name
    );

    // Check if this group already exists in the DOM
    const existingIndex = existingGroupNames.indexOf(group.name);

    if (existingIndex >= 0) {
      // Update existing group element
      const existingGroup = existingGroups[existingIndex];
      const newGroupElement = createGroupElement(group, groupDocs);

      // Preserve expanded/collapsed state
      const wasExpanded = existingGroup
        .querySelector(".group-content")
        .classList.contains("show");
      if (wasExpanded) {
        newGroupElement.querySelector(".group-content").classList.add("show");
      }

      // Replace the existing group with the updated one
      container.replaceChild(newGroupElement, existingGroup);
    } else {
      // Add new group
      const groupElement = createGroupElement(group, groupDocs);
      fragment.appendChild(groupElement);
    }
  });

  // Append any new groups
  container.appendChild(fragment);

  // Remove any groups that no longer exist
  existingGroups.forEach((groupEl, index) => {
    if (!sortedGroups.some((g) => g.name === existingGroupNames[index])) {
      container.removeChild(groupEl);
    }
  });
}

// Create a group card element
function createGroupElement(group, documents) {
  const groupElement = document.createElement("div");
  groupElement.className = "group-card";

  const header = document.createElement("div");
  header.className = "group-header";
  header.innerHTML = `
        <div class="group-title">${group.name} - ${group.description}</div>
        <div class="group-status ${group.locked ? "locked" : "unlocked"}">
            ${group.locked ? "Đã khóa" : "Đang mở"}
        </div>
    `;

  const content = document.createElement("div");
  content.className = "group-content";

  // Calculate totals
  const paymentSum = documents
    .filter((doc) => doc.type === "Thanh toán/Payment")
    .reduce((sum, doc) => sum + (doc.totalPayment || 0), 0);

  const advanceSum = documents
    .filter((doc) => doc.type === "Tạm ứng/Advance Payment")
    .reduce((sum, doc) => sum + (doc.advancePayment || 0), 0);

  const summary = document.createElement("div");
  summary.className = "group-summary";
  summary.innerHTML = `
        <p><strong>Tổng thanh toán:</strong> ${paymentSum.toLocaleString()}</p>
        <p><strong>Tổng tạm ứng:</strong> ${advanceSum.toLocaleString()}</p>
    `;
  content.appendChild(summary);

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "group-actions";

  const lockBtn = document.createElement("button");
  lockBtn.className = `action-button ${group.locked ? "warning" : "danger"}`;
  lockBtn.textContent = group.locked ? "Mở khóa" : "Khóa nhóm";
  lockBtn.onclick = () =>
    group.locked ? unlockGroup(group.name) : lockGroup(group.name);

  const massUpdateBtn = document.createElement("button");
  massUpdateBtn.className = "action-button primary";
  massUpdateBtn.textContent = "Cập nhật kê khai";
  massUpdateBtn.onclick = () => showMassUpdateForm(group.name);

  actions.appendChild(lockBtn);
  actions.appendChild(massUpdateBtn);
  content.appendChild(actions);

  // Add document form for this group
  const addDocForm = document.createElement("div");
  addDocForm.className = "group-add-document-form";
  addDocForm.innerHTML = `
    <h4>Thêm phiếu vào nhóm</h4>
    <select id="document-select-${sanitizeForSelector(
      group.name
    )}" class="form-control">
      <option value="">-- Chọn tài liệu --</option>
    </select>
    <button id="add-to-group-btn-${sanitizeForSelector(
      group.name
    )}" class="action-button primary">
      Thêm vào nhóm
    </button>
  `;

  // Get the select element and populate it
  const docSelect = addDocForm.querySelector(
    `#document-select-${sanitizeForSelector(group.name)}`
  );
  populateDocumentDropdown(docSelect, group.name);

  // Set up event listener for the add button
  const addBtn = addDocForm.querySelector(
    `#add-to-group-btn-${sanitizeForSelector(group.name)}`
  );
  addBtn.addEventListener("click", async () => {
    const docData = docSelect.value;

    if (!docData) {
      showNotification("Vui lòng chọn tài liệu", "error");
      return;
    }

    try {
      const { id, type } = JSON.parse(docData);

      const response = await fetch("/addDocumentToGroupDeclaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: id,
          documentType: type,
          groupDeclarationName: group.name,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showNotification(result.message, "success");
        await loadData();
      } else {
        showNotification(result.message || "Lỗi khi thêm tài liệu", "error");
      }
    } catch (error) {
      console.error("Error adding document:", error);
      showNotification("Lỗi máy chủ", "error");
    }
  });

  content.appendChild(addDocForm);

  // Documents list
  if (documents.length > 0) {
    const docsList = document.createElement("div");
    docsList.className = "document-list";

    documents.forEach((doc) => {
      const docItem = createDocumentItem(doc, group.name);
      docsList.appendChild(docItem);
    });

    content.appendChild(docsList);
  } else {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "Không có tài liệu trong nhóm này";
    content.appendChild(emptyMsg);
  }

  // Toggle content visibility on header click
  header.addEventListener("click", () => {
    content.classList.toggle("show");
  });

  groupElement.appendChild(header);
  groupElement.appendChild(content);

  return groupElement;
}

// Helper function to populate document dropdown
function populateDocumentDropdown(selectElement, groupName) {
  // Clear existing options except the first one
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }

  // Filter out documents that are already in this group
  const availableDocuments = unassignedDocuments.filter((doc) => {
    const docInGroup = allDocuments.find(
      (d) => d._id === doc._id && d.groupDeclarationName === groupName
    );
    return !docInGroup;
  });

  availableDocuments.forEach((doc) => {
    const option = document.createElement("option");
    option.value = JSON.stringify({
      id: doc._id,
      type: doc.documentType,
    });

    let displayText = `${doc.displayType}: `;
    if (doc.documentType === "generic") {
      displayText += doc.title || "Untitled";
    } else if (doc.documentType === "proposal") {
      displayText += doc.task || "Untitled";
    } else if (doc.documentType === "purchasing") {
      displayText += `${doc.title} (Tên: ${doc.name || ""}) (Tổng chi phí: ${
        doc.grandTotalCost
      })`;
    } else if (doc.documentType === "delivery") {
      displayText += `${doc.title} (Tên: ${doc.name}) (Tổng chi phí: ${doc.grandTotalCost})`;
    } else if (doc.documentType === "advancePayment") {
      displayText += `(Mã/Tag: ${doc.tag}) (Kê khai: ${
        doc.declaration || "Không có"
      }) (Tạm ứng: ${doc.advancePayment?.toLocaleString() || 0})`;
    } else if (doc.documentType === "payment") {
      displayText += `(Mã/Tag: ${doc.tag}) (Kê khai: ${
        doc.declaration || "Không có"
      }) (Tổng thanh toán: ${doc.totalPayment?.toLocaleString() || 0})`;
    }

    option.textContent = displayText;
    selectElement.appendChild(option);
  });
}

// Create a document item element
function createDocumentItem(doc, groupName) {
  const docItem = document.createElement("div");
  docItem.className = "document-item";

  let docTitle = "";
  let appendedInfo = "";

  if (doc.type === "Chung/Generic") {
    docTitle = doc.title || "Untitled";
  } else if (doc.type === "Đề xuất/Proposal") {
    docTitle = doc.task || "Untitled";
  } else if (doc.type === "Mua hàng/Purchasing") {
    docTitle = `${doc.title} (Tên: ${doc.name || ""}) (Tổng chi phí: ${
      doc.grandTotalCost
    })`;
  } else if (doc.type === "Xuất kho/Delivery") {
    docTitle = `${doc.title} (Tên: ${doc.name}) (Tổng chi phí: ${doc.grandTotalCost})`;
  } else if (doc.type === "Tạm ứng/Advance Payment") {
    docTitle = `(Mã: ${doc.tag}) (Kê khai: ${
      doc.declaration || "Không có"
    }) (Tạm ứng: ${doc.advancePayment?.toLocaleString() || 0})`;
  } else if (doc.type === "Thanh toán/Payment") {
    docTitle = `(Mã: ${doc.tag}) (Kê khai: ${
      doc.declaration || "Không có"
    }) (Tổng thanh toán: ${doc.totalPayment?.toLocaleString() || 0})`;
  }

  // Show appended documents count if available
  if (doc.appendedProposals?.length > 0) {
    appendedInfo += `<span class="appended-count">Đề xuất: ${doc.appendedProposals.length}</span>`;
  }
  if (doc.appendedPurchasingDocuments?.length > 0) {
    appendedInfo += `<span class="appended-count">Mua hàng: ${doc.appendedPurchasingDocuments.length}</span>`;
  }

  docItem.innerHTML = `
        <div class="document-info">
            <strong>${doc.type}:</strong> ${docTitle}
            ${
              appendedInfo
                ? `<div class="appended-docs">${appendedInfo}</div>`
                : ""
            }
        </div>
        <div class="document-actions">
            <button class="action-button primary" onclick="showDocumentDetails('${
              doc._id
            }', '${groupName}')">
                Chi tiết
            </button>
            <button class="action-button danger" data-id="${
              doc._id
            }" data-type="${getDocumentType(doc.type)}">
                Xóa
            </button>
        </div>
    `;

  return docItem;
}

// Render unassigned documents dropdown
function renderUnassignedDocuments() {
  const select = document.getElementById("document-select");

  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1);
  }

  unassignedDocuments.forEach((doc) => {
    const option = document.createElement("option");
    option.value = JSON.stringify({
      id: doc._id,
      type: doc.documentType,
    });

    let displayText = `${doc.displayType}: `;
    if (doc.documentType === "generic") {
      displayText += doc.title || "Untitled";
    } else if (doc.documentType === "proposal") {
      displayText += doc.task || "Untitled";
    } else if (doc.documentType === "purchasing") {
      displayText += `${doc.title} (Tên: ${doc.name || ""}) (Tổng chi phí: ${
        doc.grandTotalCost
      })`;
    } else if (doc.documentType === "delivery") {
      displayText += `${doc.title} (Tên: ${doc.name}) (Tổng chi phí: ${doc.grandTotalCost})`;
    } else if (doc.documentType === "advancePayment") {
      displayText += `(Mã/Tag: ${doc.tag}) (Kê khai: ${
        doc.declaration || "Không có"
      }) (Tạm ứng: ${doc.advancePayment?.toLocaleString() || 0})`;
    } else if (doc.documentType === "payment") {
      displayText += `(Mã/Tag: ${doc.tag}) (Kê khai: ${
        doc.declaration || "Không có"
      }) (Tổng thanh toán: ${doc.totalPayment?.toLocaleString() || 0})`;
    }

    option.textContent = displayText;
    select.appendChild(option);
  });

  // Render group dropdown
  const groupSelect = document.getElementById("group-select");
  groupSelect.innerHTML = '<option value="">-- Chọn nhóm --</option>';

  allGroups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = `${group.name} - ${group.description}`;
    groupSelect.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Create new group form
  document
    .getElementById("create-group-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const description = document.getElementById("description").value.trim();

      if (!name || !description) {
        showNotification("Vui lòng điền đầy đủ thông tin", "error");
        return;
      }

      try {
        const response = await fetch("/createGroupDeclaration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });

        if (response.ok) {
          showNotification("Tạo nhóm thành công", "success");
          e.target.reset();
          await loadData();
        } else {
          const result = await response.json();
          showNotification(result.message || "Lỗi khi tạo nhóm", "error");
        }
      } catch (error) {
        console.error("Error creating group:", error);
        showNotification("Lỗi máy chủ", "error");
      }
    });

  // Delete document from group (using event delegation)
  document.addEventListener("click", async (event) => {
    if (
      event.target.classList.contains("action-button") &&
      event.target.classList.contains("danger") &&
      event.target.hasAttribute("data-id")
    ) {
      const docId = event.target.getAttribute("data-id");
      const docType = event.target.getAttribute("data-type");

      try {
        const response = await fetch("/removeDocumentFromGroupDeclaration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: docId, documentType: docType }),
        });

        const result = await response.json();

        if (response.ok) {
          showNotification(result.message, "success");
          await loadData();
        } else {
          showNotification(result.message || "Lỗi khi xóa tài liệu", "error");
        }
      } catch (error) {
        console.error("Error removing document:", error);
        showNotification("Lỗi máy chủ", "error");
      }
    }
  });

  // Handle edit declaration clicks (using event delegation)
  document.addEventListener("click", function (event) {
    if (event.target.classList.contains("edit-declaration-btn")) {
      handleEditDeclarationClick(event);
    }
  });
}

// Lock a group
async function lockGroup(groupName) {
  try {
    const response = await fetch("/lockGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName }),
    });

    const result = await response.json();

    if (response.ok) {
      showNotification(result.message, "success");
      await loadData();
    } else {
      showNotification(result.message || "Lỗi khi khóa nhóm", "error");
    }
  } catch (error) {
    console.error("Error locking group:", error);
    showNotification("Lỗi máy chủ", "error");
  }
}

// Unlock a group
async function unlockGroup(groupName) {
  try {
    const response = await fetch("/unlockGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName }),
    });

    const result = await response.json();

    if (response.ok) {
      showNotification(result.message, "success");
      await loadData();
    } else {
      showNotification(result.message || "Lỗi khi mở khóa nhóm", "error");
    }
  } catch (error) {
    console.error("Error unlocking group:", error);
    showNotification("Lỗi máy chủ", "error");
  }
}

// Show mass update form
function showMassUpdateForm(groupName) {
  const modal = document.getElementById("documentModal");
  const modalContent = document.getElementById("modalContent");

  modalContent.innerHTML = `
        <h2>Cập nhật kê khai hàng loạt</h2>
        <p>Nhóm: ${groupName}</p>
        <div class="form-group">
            <label for="mass-declaration">Nội dung kê khai:</label>
            <textarea id="mass-declaration" class="form-control" rows="5"></textarea>
        </div>
        <div class="form-actions">
            <button class="action-button primary" onclick="submitMassUpdate('${groupName}')">Cập nhật</button>
            <button class="action-button" onclick="closeModal()">Hủy</button>
        </div>
    `;

  modal.style.display = "block";
}

// Submit mass update
async function submitMassUpdate(groupName) {
  const declaration = document.getElementById("mass-declaration").value.trim();

  if (!declaration) {
    showNotification("Vui lòng nhập nội dung kê khai", "error");
    return;
  }

  try {
    // Get all payment document IDs in the group
    const paymentDocs = allDocuments.filter(
      (doc) =>
        doc.groupDeclarationName === groupName &&
        doc.type === "Thanh toán/Payment"
    );

    if (paymentDocs.length === 0) {
      showNotification("Không có phiếu thanh toán trong nhóm này", "warning");
      return;
    }

    const documentIds = paymentDocs.map((doc) => doc._id);

    const response = await fetch("/massUpdatePaymentDocumentDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds, declaration }),
    });

    if (response.ok) {
      const result = await response.text();
      showNotification(result, "success");
      closeModal();
      await loadData();
    } else {
      showNotification("Lỗi khi cập nhật kê khai", "error");
    }
  } catch (error) {
    console.error("Error in mass update:", error);
    showNotification("Lỗi máy chủ", "error");
  }
}

// Show document details
function showDocumentDetails(docId, groupName) {
  const doc = allDocuments.find(
    (d) => d._id === docId && d.groupDeclarationName === groupName
  );
  if (!doc) return;

  const modal = document.getElementById("documentModal");
  const modalContent = document.getElementById("modalContent");

  modalContent.innerHTML = `
        <h2>${doc.type}</h2>
        <div>
            <strong>Document ID:</strong> ${doc._id}<br>
            ${generateDocumentContent(doc)}
        </div>
    `;

  modal.style.display = "block";
}

// Close modal
function closeModal() {
  document.getElementById("documentModal").style.display = "none";
}

// Show notification
function showNotification(message, type) {
  const container = document.getElementById("notification-container");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Helper function to get document type
function getDocumentType(displayType) {
  const typeMap = {
    "Chung/Generic": "generic",
    "Đề xuất/Proposal": "proposal",
    "Mua hàng/Purchasing": "purchasing",
    "Xuất kho/Delivery": "delivery",
    "Tạm ứng/Advance Payment": "advancePayment",
    "Thanh toán/Payment": "payment",
  };
  return typeMap[displayType] || "generic";
}

// Generate document content for modal view
function generateDocumentContent(doc) {
  switch (doc.type) {
    case "Chung/Generic":
      return generateGenericDocumentContent(doc);
    case "Thanh toán/Payment":
      return generatePaymentDocumentContent(doc);
    case "Tạm ứng/Advance Payment":
      return generateAdvancePaymentDocumentContent(doc);
    case "Mua hàng/Purchasing":
      return generatePurchasingDocumentContent(doc);
    case "Xuất kho/Delivery":
      return generateDeliveryDocumentContent(doc);
    case "Đề xuất/Proposal":
      return generateProposalDocumentContent(doc);
    default:
      return "Unsupported document type";
  }
}

function generateGenericDocumentContent(doc) {
  return doc.content
    ? doc.content
        .map(
          (section) => `
            <div class="full-view-section">
                <h3>${section.name}</h3>
                <p>${section.text}</p>
            </div>
        `
        )
        .join("")
    : "<p>Không có nội dung</p>";
}

function renderProposals(proposals) {
  if (!proposals || proposals.length === 0) {
    return "<p>Không có phiếu đề xuất</p>";
  }

  return `
        <div class="proposals-container">
            ${proposals
              .map(
                (proposal) => `
                <div class="proposal-card">
                    <p><strong>Công việc/Task:</strong> ${
                      proposal.task || "Không có"
                    }</p>
                    <p><strong>Trạm/Center:</strong> ${
                      proposal.costCenter || "Không có"
                    }</p>
                    <p><strong>Mô tả chi tiết:</strong> ${
                      proposal.detailsDescription || "Không có"
                    }</p>
                    ${
                      proposal.fileMetadata
                        ? `
                        <p><strong>Tệp đính kèm:</strong> 
                            <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a>
                        </p>
                    `
                        : ""
                    }
                </div>
            `
              )
              .join("")}
        </div>
    `;
}

function renderPurchasingDocuments(purchDocs) {
  if (!purchDocs || purchDocs.length === 0) {
    return "<p>Không có phiếu mua hàng</p>";
  }

  return `
        <div class="purchasing-documents-container">
            ${purchDocs
              .map(
                (purchDoc) => `
                <div class="purchasing-card">
                    <p><strong>Tiêu đề:</strong> ${
                      purchDoc.title || "Không có"
                    }</p>
                    <p><strong>Tên:</strong> ${purchDoc.name || "Không có"}</p>
                    <p><strong>Trạm:</strong> ${
                      purchDoc.costCenter || "Không có"
                    }</p>
                    <p><strong>Tổng chi phí:</strong> ${
                      purchDoc.grandTotalCost?.toLocaleString() || "Không có"
                    }</p>
                    
                    <h4>Sản phẩm:</h4>
                    ${renderProducts(purchDoc.products || [])}
                    
                    ${
                      purchDoc.fileMetadata
                        ? `
                        <p><strong>Tệp đính kèm:</strong> 
                            <a href="${purchDoc.fileMetadata.link}" target="_blank">${purchDoc.fileMetadata.name}</a>
                        </p>
                    `
                        : ""
                    }
                </div>
            `
              )
              .join("")}
        </div>
    `;
}

function renderStatus(status) {
  switch (status) {
    case "Approved":
      return `<span class="status-approved">Đã thanh toán</span>`;
    case "Suspended":
      return `<span class="status-suspended">Từ chối/span>`;
    default:
      return `<span class="status-pending">Chưa phê duyệt</span>`;
  }
}

function generatePaymentDocumentContent(doc) {
  const submissionDate = doc.submissionDate || "Không có";
  const paymentDeadline = doc.paymentDeadline || "Không có";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Mã:</span>
          <span class="detail-value">${doc.tag || "Không có"}</span>
          <span class="detail-label">Tên:</span>
          <span class="detail-value">${doc.name || "Không có"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tên nhóm:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Không có"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Hạn trả:</span>
          <span class="detail-value">${paymentDeadline}</span>
        </div>
        <div class="detail-item declaration-container" data-document-id="${
          doc._id
        }">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value declaration-value">${
              doc.declaration || "Không có"
            }</span>
            <button class="edit-declaration-btn action-button primary">Chỉnh sửa</button>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="full-view-section">
      <h3>Nội dung/Content</h3>
      <p style="white-space: pre-wrap;">${doc.content || "Không có"}</p>
    </div>

    <div class="full-view-section">
      <h3>Trạm/Center</h3>
      <p style="white-space: pre-wrap;">${doc.costCenter || "Không có"}</p>
    </div>

    <!-- Payment Information Section -->
    <div class="full-view-section">
      <h3>Thông tin thanh toán</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Phương thức:</span>
          <span class="detail-value">${doc.paymentMethod || "Không có"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tổng thanh toán:</span>
          <span class="detail-value">${
            doc.totalPayment?.toLocaleString() || "Không có"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tạm ứng:</span>
          <span class="detail-value">${
            doc.advancePayment?.toLocaleString() || "Không có"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Bù trừ:</span>
          <span class="detail-value">${
            doc.totalPayment && doc.advancePayment
              ? (doc.totalPayment - doc.advancePayment).toLocaleString()
              : "Not calculated"
          }</span>
        </div>
      </div>
    </div>

    <!-- File Attachment Section -->
    <div class="full-view-section">
      <h3>Tệp tin kèm theo</h3>
      ${
        doc.fileMetadata
          ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
          : "Không có"
      }
    </div>

    <!-- Purchasing Documents Section -->
    <div class="full-view-section">
      <h3>Phiếu mua hàng kèm theo</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
          : "Không có"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderProposals(doc.appendedPurchasingDocuments)
          : "Không có"
      }
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt:</h4>
        <div class="approval-status">
          ${doc.approvers
            .map((approver) => {
              const hasApproved = doc.approvedBy.find(
                (a) => a.username === approver.username
              );
              return `
              <div class="approver-item">
                <span class="status-icon ${
                  hasApproved ? "status-approved" : "status-pending"
                }"></span>
                <div>
                  <div>${approver.username} (${approver.subRole})</div>
                  ${
                    hasApproved
                      ? `<div class="approval-date">Đã phê duyệt vào: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Chưa phê duyệt</div>'
                  }
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function generateAdvancePaymentDocumentContent(doc) {
  const submissionDate = doc.submissionDate || "Không có";
  const paymentDeadline = doc.paymentDeadline || "Không có";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Mã:</span>
          <span class="detail-value">${doc.tag || "Không có"}</span>
          <span class="detail-label">Tên:</span>
          <span class="detail-value">${doc.name || "Không có"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tên nhóm:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Không có"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Hạn trả:</span>
          <span class="detail-value">${paymentDeadline}</span>
        </div>
        <div class="detail-item declaration-container" data-document-id="${
          doc._id
        }">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value declaration-value">${
              doc.declaration || "Không có"
            }</span>
            <button class="edit-declaration-btn action-button primary">Chỉnh sửa</button>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="full-view-section">
      <h3>Nội dung</h3>
      <p style="white-space: pre-wrap;">${doc.content || "Không có"}</p>
    </div>

    <div class="full-view-section">
      <h3>Trạm</h3>
      <p style="white-space: pre-wrap;">${doc.costCenter || "Không có"}</p>
    </div>

    <!-- Payment Information Section -->
    <div class="full-view-section">
      <h3>Thông tin thanh toán</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Phương thức:</span>
          <span class="detail-value">${doc.paymentMethod || "Không có"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tạm ứng:</span>
          <span class="detail-value">${
            doc.advancePayment?.toLocaleString() || "Không có"
          }</span>
        </div>
      </div>
    </div>

    <!-- File Attachment Section -->
    <div class="full-view-section">
      <h3>Tệp tin kèm theo/Attached File</h3>
      ${
        doc.fileMetadata
          ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
          : "Không có"
      }
    </div>

    <!-- Purchasing Documents Section -->
    <div class="full-view-section">
      <h3>Phiếu mua hàng kèm theo</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
          : "Không có"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderProposals(doc.appendedPurchasingDocuments)
          : "Không có"
      }
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt:</h4>
        <div class="approval-status">
          ${doc.approvers
            .map((approver) => {
              const hasApproved = doc.approvedBy.find(
                (a) => a.username === approver.username
              );
              return `
              <div class="approver-item">
                <span class="status-icon ${
                  hasApproved ? "status-approved" : "status-pending"
                }"></span>
                <div>
                  <div>${approver.username} (${approver.subRole})</div>
                  ${
                    hasApproved
                      ? `<div class="approval-date">Đã phê duyệt vào: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Chưa phê duyệt</div>'
                  }
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function generatePurchasingDocumentContent(doc) {
  return `
        <div class="full-view-section">
            <h3>Thông tin cơ bản</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Tên:</span>
                    <span class="detail-value">${doc.name || "Không có"}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Trạm:</span>
                    <span class="detail-value">${
                      doc.costCenter || "Không có"
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ngày nộp:</span>
                    <span class="detail-value">${
                      doc.submissionDate || "Không có"
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kê khai:</span>
                    <span class="detail-value">${
                      doc.declaration || "Không có"
                    }</span>
                </div>
            </div>
        </div>
        
        <div class="full-view-section">
            <h3>Thông tin sản phẩm</h3>
            ${renderProducts(doc.products || [])}
        </div>
        
        <div class="full-view-section">
            <h3>Tổng chi phí</h3>
            <p>${doc.grandTotalCost?.toLocaleString() || "Không có"}</p>
        </div>
    `;
}

function generateDeliveryDocumentContent(doc) {
  return `
        <div class="full-view-section">
            <h3>Thông tin cơ bản</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Tên:</span>
                    <span class="detail-value">${doc.name || "Không có"}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Trạm:</span>
                    <span class="detail-value">${
                      doc.costCenter || "Không có"
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ngày nộp:</span>
                    <span class="detail-value">${
                      doc.submissionDate || "Không có"
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kê khai:</span>
                    <span class="detail-value">${
                      doc.declaration || "Không có"
                    }</span>
                </div>
            </div>
        </div>
        
        <div class="full-view-section">
            <h3>Thông tin sản phẩm</h3>
            ${renderProducts(doc.products || [])}
        </div>
        
        <div class="full-view-section">
            <h3>Tổng chi phí</h3>
            <p>${doc.grandTotalCost?.toLocaleString() || "Không có"}</p>
        </div>
    `;
}

function generateProposalDocumentContent(doc) {
  return `
        <div class="full-view-section">
            <h3>Thông tin cơ bản</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Công việc:</span>
                    <span class="detail-value">${doc.task || "Không có"}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Trạm:</span>
                    <span class="detail-value">${
                      doc.costCenter || "Không có"
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ngày xảy ra lỗi:</span>
                    <span class="detail-value">${
                      doc.dateOfError || "Không có"
                    }</span>
                </div>
            </div>
        </div>
        
        <div class="full-view-section">
            <h3>Mô tả chi tiết</h3>
            <p>${doc.detailsDescription || "Không có"}</p>
        </div>
        
        <div class="full-view-section">
            <h3>Hướng xử lý</h3>
            <p>${doc.direction || "Không có"}</p>
        </div>
    `;
}

function renderProducts(products) {
  if (!products || products.length === 0) {
    return "<p>Không có sản phẩm</p>";
  }

  return `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color);">Tên sản phẩm</th>
                    <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">Đơn giá</th>
                    <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">Số lượng</th>
                    <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                ${products
                  .map(
                    (product) => `
                    <tr>
                        <td style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color);">
                            ${product.productName || "Không có"}
                        </td>
                        <td style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">
                            ${
                              product.costPerUnit?.toLocaleString() ||
                              "Không có"
                            }
                        </td>
                        <td style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">
                            ${product.amount?.toLocaleString() || "Không có"}
                        </td>
                        <td style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">
                            ${product.totalCost?.toLocaleString() || "Không có"}
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
    `;
}

function handleEditDeclarationClick(event) {
  // Get container and relevant elements
  const container = event.target.closest(".declaration-container");
  const documentId = container.dataset.documentId;
  const valueElement = container.querySelector(".declaration-value");
  const currentValue = valueElement.textContent.trim();

  // Create edit form
  const editForm = document.createElement("div");
  editForm.className = "declaration-edit-form";
  editForm.innerHTML = `
        <textarea class="form-control">${
          currentValue === "Không có" ? "" : currentValue
        }</textarea>
        <div class="form-actions">
            <button class="action-button primary save-declaration-btn">Lưu</button>
            <button class="action-button cancel-declaration-btn">Hủy</button>
        </div>
    `;

  // Hide value element and button
  valueElement.style.display = "none";
  event.target.style.display = "none";

  // Add form to container
  container.appendChild(editForm);

  // Focus the textarea
  const textarea = editForm.querySelector("textarea");
  textarea.focus();

  // Add event listeners for save and cancel
  editForm
    .querySelector(".save-declaration-btn")
    .addEventListener("click", function () {
      saveDeclaration(
        documentId,
        textarea.value.trim(),
        valueElement,
        editForm,
        container,
        event.target // edit button
      );
    });

  editForm
    .querySelector(".cancel-declaration-btn")
    .addEventListener("click", function () {
      cancelEdit(valueElement, editForm, container, event.target);
    });
}

async function saveDeclaration(
  documentId,
  declaration,
  valueElement,
  editForm,
  container,
  editButton
) {
  try {
    const response = await fetch(
      `/updatePaymentDocumentDeclaration/${documentId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ declaration }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update declaration");
    }

    // Update display value
    valueElement.textContent = declaration || "Không có";

    // Restore original view
    restoreOriginalView(valueElement, editForm, container, editButton);

    // Show success notification
    showNotification("Kê khai cập nhật thành công", "success");

    // Refresh data to ensure consistency
    await loadData();
  } catch (error) {
    console.error("Error updating declaration:", error);
    showNotification("Lỗi khi cập nhật kê khai", "error");
    restoreOriginalView(valueElement, editForm, container, editButton);
  }
}

function cancelEdit(valueElement, editForm, container, editButton) {
  restoreOriginalView(valueElement, editForm, container, editButton);
}

function restoreOriginalView(valueElement, editForm, container, editButton) {
  // Remove edit form
  if (editForm && editForm.parentNode) {
    editForm.parentNode.removeChild(editForm);
  }

  // Show original elements
  valueElement.style.display = "";
  if (editButton) {
    editButton.style.display = "";
  }
}
