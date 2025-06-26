// views\documentPages\documentInGroupDeclaration\documentInGroupDeclaration.js
let currentUser = null;
let groupDeclarationedDocuments = null;
let allGroupDeclarations = [];
let unassignedDocuments = [];

async function initializeDocumentManagement() {
  try {
    await refreshGroupData();
    populateGroupDeclarationSelect();

    const response = await fetch("/getUnassignedDocumentsForGroupDeclaration");
    unassignedDocuments = await response.json();
    populateDocumentSelect();
  } catch (error) {
    console.error("Error initializing:", error);
  }

  document
    .getElementById("groupDeclaration-select")
    .addEventListener("change", handleGroupDeclarationChange);
  document
    .getElementById("add-to-groupDeclaration-btn")
    .addEventListener("click", addDocumentToGroupDeclaration);

  document
    .getElementById("lock-group-btn")
    .addEventListener("click", lockGroupDeclaration);
  document
    .getElementById("unlock-group-btn")
    .addEventListener("click", unlockGroupDeclaration);
}

function populateGroupDeclarationSelect() {
  const groupDeclarationSelect = document.getElementById(
    "groupDeclaration-select"
  );

  // Clear existing options except the first one (if any)
  while (groupDeclarationSelect.options.length > 1) {
    groupDeclarationSelect.remove(1);
  }

  // Populate the dropdown with groupDeclaration names and descriptions
  allGroupDeclarations.forEach((groupDeclaration) => {
    const option = document.createElement("option");
    option.value = groupDeclaration.name;

    // Combine groupDeclaration name and description for display
    option.textContent = `${groupDeclaration.name} - ${groupDeclaration.description}`;

    groupDeclarationSelect.appendChild(option);
  });
}

function populateDocumentSelect() {
  const documentSelect = document.getElementById("document-select");
  while (documentSelect.options.length > 1) {
    documentSelect.remove(1);
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
        doc.declaration
      }) (Tạm ứng: ${doc.advancePayment.toLocaleString()})`;
    } else if (doc.documentType === "payment") {
      displayText += `(Mã/Tag: ${doc.tag}) (Kê khai: ${
        doc.declaration
      }) (Tổng thanh toán: ${doc.totalPayment.toLocaleString()})`;
    }
    option.textContent = displayText;
    documentSelect.appendChild(option);
  });
}

function showModal(docContent) {
  document.getElementById("modalContent").innerHTML = docContent;
  document.getElementById("documentModal").style.display = "block";
}

function closeModal() {
  document.getElementById("documentModal").style.display = "none";
}

function displayGroupDeclarationDocumentsForRemoval(
  groupDeclarationName,
  documents
) {
  const container = document.getElementById("remove-document-container");
  container.innerHTML = "";

  if (!documents || documents.length === 0) {
    container.innerHTML = "<p>Không có tài liệu trong nhóm này</p>";
    return;
  }

  // Compute the total payment sum for payment documents in this groupDeclaration
  const totalPaymentSum = documents
    .filter((doc) => doc.type === "Thanh toán/Payment")
    .reduce((sum, doc) => {
      if (doc.advancePayment === 0) {
        sum += doc.totalPayment;
      } else if (doc.totalPayment === 0) {
        sum += doc.advancePayment;
      } else {
        sum += doc.totalPayment - doc.advancePayment;
      }
      return sum;
    }, 0);

  // Compute the total advance payment sum for advance payment documents in this groupDeclaration
  const totalAdvancePaymentSum = documents
    .filter((doc) => doc.type === "Tạm ứng/Advance Payment")
    .reduce((sum, doc) => {
      sum += doc.advancePayment || 0;
      return sum;
    }, 0);

  // Create and insert a header showing the groupDeclaration name and computed total payment sum
  const header = document.createElement("h3");
  header.textContent = `Nhóm: ${groupDeclarationName} - Số tiền thanh toán: ${totalPaymentSum.toLocaleString()} - Số tiền tạm ứng: ${totalAdvancePaymentSum.toLocaleString()}`;
  container.appendChild(header);

  // Iterate over each document and display its details
  documents.forEach((doc) => {
    const documentItem = document.createElement("div");
    let documentTitle = "";
    if (doc.type === "Chung/Generic") {
      documentTitle = doc.title || "Untitled";
    } else if (doc.type === "Đề xuất/Proposal") {
      documentTitle = doc.task || "Untitled";
    } else if (doc.type === "Mua hàng/Purchasing") {
      documentTitle = `${doc.title} (Tên: ${doc.name || ""}) (Tổng chi phí: ${
        doc.grandTotalCost
      })`;
    } else if (doc.type === "Xuất kho/Delivery") {
      documentTitle = `${doc.title} (Tên: ${doc.name}) (Tổng chi phí: ${doc.grandTotalCost})`;
    } else if (doc.type === "Tạm ứng/Advance Payment") {
      documentTitle = `(Mã: ${doc.tag}) (Kê khai: ${
        doc.declaration
      }) (Tạm ứng: ${doc.advancePayment.toLocaleString()})`;
    } else if (doc.type === "Thanh toán/Payment") {
      documentTitle = `(Mã: ${doc.tag}) (Kê khai: ${
        doc.declaration
      }) (Tổng thanh toán: ${doc.totalPayment.toLocaleString()})`;
    }

    documentItem.innerHTML = `
      <div>
        <strong>${doc.type}:</strong> ${documentTitle}
        <button onclick="showDocumentDetails('${
          doc._id
        }', '${groupDeclarationName}')">Chi tiết đầy đủ</button>
        <button class="remove-btn" data-id="${
          doc._id
        }" data-type="${getDocumentType(doc.type)}">
          Xóa khỏi nhóm
        </button>
      </div>
    `;

    container.appendChild(documentItem);
  });

  // Attach event listeners to the remove buttons
  document.querySelectorAll(".remove-btn").forEach((button) => {
    button.addEventListener("click", removeDocumentFromGroupDeclaration);
  });
}

function renderPurchasingDocuments(purchDocs) {
  if (!purchDocs || purchDocs.length === 0) return "";

  return `
    <div class="documents-container">
      ${purchDocs
        .map((purchDoc) => {
          const products = purchDoc.products
            .map(
              (product) => `
          <li>
            <strong>${product.productName}</strong><br>
            Đơn giá/Cost Per Unit: ${product.costPerUnit.toLocaleString()}<br>
            Số lượng/Amount: ${product.amount.toLocaleString()}<br>
            Thuế/Vat (%): ${(product.vat ?? 0).toLocaleString()}<br>
            Thành tiền/Total Cost: ${product.totalCost.toLocaleString()}<br>
            Thành tiền sau thuế/Total Cost After Vat: ${(
              product.totalCostAfterVat ?? product.totalCost
            ).toLocaleString()}<br>
            Ghi chú/Notes: ${product.note || "None"}
          </li>
        `
            )
            .join("");

          const fileMetadata = purchDoc.fileMetadata
            ? `<p><strong>Tệp đính kèm phiếu mua hàng/File attaches to purchasing document:</strong> 
              <a href="${purchDoc.fileMetadata.link}" target="_blank">${purchDoc.fileMetadata.name}</a></p>`
            : "";

          return `
          <div class="purchasing-doc">
            <p><strong>Trạm/Center:</strong> ${
              purchDoc.costCenter ? purchDoc.costCenter : ""
            }</p>
            <p><strong>Tổng chi phí/Total Cost:</strong> ${purchDoc.grandTotalCost.toLocaleString()}</p>
            <p><strong>Sản phẩm/Products:</strong></p>
            <ul>${products}</ul>
            ${fileMetadata}
          </div>`;
        })
        .join("")}
    </div>`;
}

function renderProducts(products) {
  if (!products || products.length === 0) return "-";

  return `
    <table class="products-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Sản phẩm/Product</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Đơn giá/Cost Per Unit</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Số lượng/Amount</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thuế/Vat (%)</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền/Total Cost</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền sau thuế/Total Cost After Vat</th>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Ghi chú/Notes</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (product) => `
          <tr>
            <td style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;"><strong>${
              product.productName
            }</strong></td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.costPerUnit.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.amount.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${
              product.vat.toLocaleString() || ""
            }</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.totalCost.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${
              product.totalCostAfterVat.toLocaleString() || ""
            }</td>
            <td style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">${
              product.note || ""
            }</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderProposals(purchDocs) {
  const allProposals = purchDocs
    .flatMap((purchDoc) => purchDoc.appendedProposals)
    .filter((proposal) => proposal);

  if (allProposals.length === 0) return "";

  return `
    <div class="proposals-container">
      ${allProposals
        .map(
          (proposal) => `
        <div class="proposal-card">
          <p><strong>Công việc/Task:</strong> ${proposal.task}</p>
          <p><strong>Trạm/Center:</strong> ${proposal.costCenter}</p>
          <p><strong>Mô tả/Description:</strong> ${
            proposal.detailsDescription
          }</p>
          ${
            proposal.fileMetadata
              ? `<p><strong>Tệp đính kèm/File:</strong> 
                <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></p>`
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>`;
}

function renderStatus(status) {
  switch (status) {
    case "Approved":
      return `<span class="status approved">Approved</span>`;
    case "Suspended":
      return `<span class="status suspended">Suspended</span>`;
    default:
      return `<span class="status pending">Pending</span>`;
  }
}

function showDocumentDetails(docId, groupDeclarationName) {
  const doc = groupDeclarationedDocuments[groupDeclarationName].find(
    (d) => d._id === docId
  );
  if (!doc) return;

  let modalContent = `
          <h2>${doc.type}</h2>
          <div>
              <strong>Document ID:</strong> ${doc._id}<br>
              ${generateDocumentContent(doc)}
          </div>
      `;

  showModal(modalContent);
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
    <textarea class="form-control mb-2">${
      currentValue === "Not specified" ? "" : currentValue
    }</textarea>
    <div class="btn-groupDeclaration">
      <button type="button" class="btn btn-sm btn-primary save-declaration-btn">Lưu/Save</button>
      <button type="button" class="btn btn-sm btn-secondary cancel-declaration-btn">Hủy/Cancel</button>
    </div>
  `;

  // Hide value element and button
  valueElement.style.display = "none";
  event.target.closest(".edit-declaration-btn").style.display = "none";

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
        container
      );
    });

  editForm
    .querySelector(".cancel-declaration-btn")
    .addEventListener("click", function () {
      cancelEdit(valueElement, editForm, container);
    });
}

async function saveDeclaration(
  documentId,
  declaration,
  valueElement,
  editForm,
  container
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
    valueElement.textContent = declaration || "Not specified";

    // Restore original elements
    restoreOriginalView(valueElement, editForm, container);

    await refreshDocumentData();

    // Show success notification
    showNotification(
      "Kê khai cập nhật thành công/Declaration updated successfully",
      "success"
    );
  } catch (error) {
    console.error("Error updating declaration:", error);
    showNotification(
      "Lỗi khi cập nhật kê khai/Error updating declaration",
      "error"
    );

    // Restore original view even on error
    restoreOriginalView(valueElement, editForm, container);
  }
}

function cancelEdit(valueElement, editForm, container) {
  restoreOriginalView(valueElement, editForm, container);
}

// Function to handle mass declaration update
async function handleMassUpdateDeclaration() {
  const groupDeclarationSelect = document.getElementById(
    "groupDeclaration-select"
  );
  const declarationInput = document.getElementById("mass-declaration-input");
  const statusMessage = document.getElementById("mass-update-status-message");

  const groupDeclarationName = groupDeclarationSelect.value;
  const declaration = declarationInput.value.trim();

  if (!groupDeclarationName) {
    statusMessage.textContent =
      "Vui lòng chọn một nhóm/Please select a groupDeclaration.";
    return;
  }

  if (!declaration) {
    statusMessage.textContent =
      "Vui lòng nhập kê khai/Please enter a declaration.";
    return;
  }

  try {
    // Get all document IDs in the selected groupDeclaration
    const groupDeclarationDocuments =
      groupDeclarationedDocuments[groupDeclarationName];
    if (!groupDeclarationDocuments || groupDeclarationDocuments.length === 0) {
      statusMessage.textContent =
        "Không có tài liệu trong nhóm này/No documents in this groupDeclaration.";
      return;
    }

    const documentIds = groupDeclarationDocuments
      .filter((doc) => doc.type === "Thanh toán/Payment") // Only update payment documents
      .map((doc) => doc._id);

    if (documentIds.length === 0) {
      statusMessage.textContent =
        "Không có tài liệu thanh toán trong nhóm này/No payment documents in this groupDeclaration.";
      return;
    }

    // Send mass update request
    const response = await fetch("/massUpdatePaymentDocumentDeclaration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentIds,
        declaration,
      }),
    });

    if (response.ok) {
      const result = await response.text();
      statusMessage.textContent = result;
      await refreshDocumentData(); // Refresh the document list
    } else {
      statusMessage.textContent =
        "Lỗi khi cập nhật kê khai/Error updating declaration.";
    }
  } catch (error) {
    console.error("Error:", error);
    statusMessage.textContent =
      "Lỗi máy chủ/Server error. Vui lòng thử lại/Please try again.";
  }
}

function restoreOriginalView(valueElement, editForm, container) {
  // Remove edit form
  editForm.remove();

  // Show value element and edit button
  valueElement.style.display = "";
  container.querySelector(".edit-declaration-btn").style.display = "";
}

function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `alert alert-${
    type === "success" ? "success" : "danger"
  } notification`;
  notification.textContent = message;

  // Add to document
  document.body.appendChild(notification);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function generateGenericDocumentContent(doc) {
  return doc.content
    .map(
      (section) => `
        <div>
            <strong>${section.name}:</strong><br>
            <p>${section.text}</p>
        </div>
    `
    )
    .join("");
}

function generatePaymentDocumentContent(doc) {
  const submissionDate = doc.submissionDate || "Not specified";
  const paymentDeadline = doc.paymentDeadline || "Not specified";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản/Basic Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Mã/Tag:</span>
          <span class="detail-value">${doc.tag || "Not specified"}</span>
          <span class="detail-label">Tên/Name:</span>
          <span class="detail-value">${doc.name || "Not specified"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tên nhóm/GroupDeclaration Name:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp/Submission Date:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Hạn trả/Payment Deadline:</span>
          <span class="detail-value">${paymentDeadline}</span>
        </div>
        <div class="detail-item declaration-container" data-document-id="${
          doc._id
        }">
          <span class="detail-label">Kê khai/Declaration:</span>
          <span class="detail-value declaration-value">${
            doc.declaration || "Not specified"
          }</span>
          <button class="edit-declaration-btn">Chỉnh sửa</button>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="full-view-section">
      <h3>Nội dung/Content</h3>
      <p style="white-space: pre-wrap;">${
        doc.content || "No content provided"
      }</p>
    </div>

    <div class="full-view-section">
      <h3>Trạm/Center</h3>
      <p style="white-space: pre-wrap;">${
        doc.costCenter || "No content provided"
      }</p>
    </div>

    <!-- Payment Information Section -->
    <div class="full-view-section">
      <h3>Thông tin thanh toán/Payment Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Phương thức/Payment Method:</span>
          <span class="detail-value">${
            doc.paymentMethod || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tổng thanh toán/Total Payment:</span>
          <span class="detail-value">${
            doc.totalPayment?.toLocaleString() || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tạm ứng/Advance Payment:</span>
          <span class="detail-value">${
            doc.advancePayment?.toLocaleString() || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Bù trừ/Offset:</span>
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
      <h3>Tệp tin kèm theo/Attached File</h3>
      ${
        doc.fileMetadata
          ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
          : "No file attached"
      }
    </div>

    <!-- Purchasing Documents Section -->
    <div class="full-view-section">
      <h3>Phiếu mua hàng kèm theo/Appended Purchasing Documents</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
          : "No purchasing documents attached"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo/Appended Proposal Documents</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderProposals(doc.appendedPurchasingDocuments)
          : "No proposal documents attached"
      }
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái/Status Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng/Status:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt/Approval Status:</h4>
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
                      ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Pending</div>'
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
  const submissionDate = doc.submissionDate || "Not specified";
  const paymentDeadline = doc.paymentDeadline || "Not specified";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản/Basic Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Mã/Tag:</span>
          <span class="detail-value">${doc.tag || "Not specified"}</span>
          <span class="detail-label">Tên/Name:</span>
          <span class="detail-value">${doc.name || "Not specified"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tên nhóm/GroupDeclaration Name:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp/Submission Date:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Hạn trả/Payment Deadline:</span>
          <span class="detail-value">${paymentDeadline}</span>
        </div>
        <div class="detail-item declaration-container" data-document-id="${
          doc._id
        }">
          <span class="detail-label">Kê khai/Declaration:</span>
          <span class="detail-value declaration-value">${
            doc.declaration || "Not specified"
          }</span>
          <button class="edit-declaration-btn">Chỉnh sửa</button>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="full-view-section">
      <h3>Nội dung/Content</h3>
      <p style="white-space: pre-wrap;">${
        doc.content || "No content provided"
      }</p>
    </div>

    <div class="full-view-section">
      <h3>Trạm/Center</h3>
      <p style="white-space: pre-wrap;">${
        doc.costCenter || "No content provided"
      }</p>
    </div>

    <!-- Payment Information Section -->
    <div class="full-view-section">
      <h3>Thông tin thanh toán/Payment Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Phương thức/Payment Method:</span>
          <span class="detail-value">${
            doc.paymentMethod || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tạm ứng/Advance Payment:</span>
          <span class="detail-value">${
            doc.advancePayment?.toLocaleString() || "Not specified"
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
          : "No file attached"
      }
    </div>

    <!-- Purchasing Documents Section -->
    <div class="full-view-section">
      <h3>Phiếu mua hàng kèm theo/Appended Purchasing Documents</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
          : "No purchasing documents attached"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo/Appended Proposal Documents</h3>
      ${
        doc.appendedPurchasingDocuments?.length
          ? renderProposals(doc.appendedPurchasingDocuments)
          : "No proposal documents attached"
      }
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái/Status Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng/Status:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt/Approval Status:</h4>
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
                      ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Pending</div>'
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
  const submissionDate = doc.submissionDate || "Not specified";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản/Basic Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tên:</span>
          <span class="detail-value">${doc.name}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Trạm:</span>
          <span class="detail-value">${doc.costCenter}</span>
        </div>                
        <div class="detail-item">
          <span class="detail-label">Tên nhóm/GroupDeclaration Name:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp/Submission Date:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Kê khai/Declaration:</span>
          <span class="detail-value">${
            doc.declaration || "Not specified"
          }</span>
        </div>
      </div>
    </div>

    <!-- Products Section -->
    <div class="full-view-section">
      <h3>Sản phẩm/Products</h3>
      ${renderProducts(doc.products)}
    </div>

    <!-- File Attachment Section -->
    <div class="full-view-section">
      <h3>Tệp tin kèm theo/Attached File</h3>
      ${
        doc.fileMetadata
          ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
          : "No file attached"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo/Appended Proposals</h3>
      ${renderProposals(doc.appendedProposals)}
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái/Status Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng/Status:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt/Approval Status:</h4>
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
                      ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Pending</div>'
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

function generateDeliveryDocumentContent(doc) {
  const submissionDate = doc.submissionDate || "Not specified";

  return `
    <!-- Basic Information Section -->
    <div class="full-view-section">
      <h3>Thông tin cơ bản/Basic Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tên:</span>
          <span class="detail-value">${doc.name}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Trạm:</span>
          <span class="detail-value">${doc.costCenter}</span>
        </div>                
        <div class="detail-item">
          <span class="detail-label">Tên nhóm/GroupDeclaration Name:</span>
          <span class="detail-value">${
            doc.groupDeclarationName || "Not specified"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Ngày nộp/Submission Date:</span>
          <span class="detail-value">${submissionDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Kê khai/Declaration:</span>
          <span class="detail-value">${
            doc.declaration || "Not specified"
          }</span>
        </div>
      </div>
    </div>

    <!-- Products Section -->
    <div class="full-view-section">
      <h3>Sản phẩm/Products</h3>
      ${renderProducts(doc.products)}
    </div>

    <!-- File Attachment Section -->
    <div class="full-view-section">
      <h3>Tệp tin kèm theo/Attached File</h3>
      ${
        doc.fileMetadata
          ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
          : "No file attached"
      }
    </div>

    <!-- Proposals Section -->
    <div class="full-view-section">
      <h3>Phiếu đề xuất kèm theo/Appended Proposals</h3>
      ${renderProposals(doc.appendedProposals)}
    </div>

    <!-- Status Section -->
    <div class="full-view-section">
      <h3>Trạng thái/Status Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tình trạng/Status:</span>
          <span class="detail-value ${renderStatus(doc.status)}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <h4>Trạng thái phê duyệt/Approval Status:</h4>
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
                      ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                      : '<div class="approval-date">Pending</div>'
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

function generateProposalDocumentContent(doc) {
  return `
    <h2>Phiếu đề xuất/Proposal Document</h2>
    <div>
      <strong>Mã/Document ID:</strong> ${doc._id}<br>
      <strong>Tiêu đề/Title:</strong> ${doc.title}<br>
      <strong>Công việc/Task:</strong> ${doc.task}<br>
      <strong>Trạm/Center:</strong> ${doc.costCenter}<br>
      <strong>Ngày xảy ra lỗi/Date of Error:</strong> ${doc.dateOfError}<br>
      <strong>Mô tả chi tiết/Details Description:</strong> ${
        doc.detailsDescription
      }<br>
      <strong>Hướng xử lý/Direction:</strong> ${doc.direction}<br>
      <strong>Người xử lý/Submission Date:</strong> ${doc.submissionDate}<br>
      <strong>Tình trạng/Status:</strong> ${doc.status}<br>
      ${
        doc.suspendReason
          ? `<strong>Lý do từ chối/Suspend Reason:</strong> ${doc.suspendReason}<br>`
          : ""
      }
    </div>
  `;
}

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

async function addDocumentToGroupDeclaration() {
  const groupDeclarationSelect = document.getElementById(
    "groupDeclaration-select"
  );
  const documentSelect = document.getElementById("document-select");
  const statusMessage = document.getElementById("add-status-message");

  statusMessage.textContent = "";

  const groupDeclarationName = groupDeclarationSelect.value;
  const documentData = documentSelect.value;

  if (!groupDeclarationName || !documentData) {
    statusMessage.textContent = "Vui lòng chọn cả nhóm và tài liệu";
    return;
  }

  const { id, type } = JSON.parse(documentData);

  try {
    const response = await fetch("/addDocumentToGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: id,
        documentType: type,
        groupDeclarationName: groupDeclarationName,
      }),
    });

    const result = await response.json();
    statusMessage.textContent = result.message;

    if (response.ok) {
      await refreshDocumentData();
    }
  } catch (error) {
    console.error("Error:", error);
    statusMessage.textContent = "Lỗi máy chủ";
  }
}

async function removeDocumentFromGroupDeclaration(event) {
  const button = event.target;
  const documentId = button.getAttribute("data-id");
  const documentType = button.getAttribute("data-type");
  const statusMessage = document.getElementById("remove-status-message");

  try {
    const response = await fetch("/removeDocumentFromGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, documentType }),
    });

    const result = await response.json();
    statusMessage.textContent = result.message;

    if (response.ok) {
      await refreshDocumentData();
    }
  } catch (error) {
    console.error("Error:", error);
    statusMessage.textContent = "Lỗi máy chủ";
  }
}

async function refreshDocumentData() {
  try {
    const [unassignedResponse, groupDeclarationedResponse] = await Promise.all([
      fetch("/getUnassignedDocumentsForGroupDeclaration"),
      fetch("/getGroupDeclarationedDocuments"),
    ]);

    unassignedDocuments = await unassignedResponse.json();
    groupDeclarationedDocuments = await groupDeclarationedResponse.json();

    populateDocumentSelect();
    const selectedGroupDeclaration = document.getElementById(
      "groupDeclaration-select"
    ).value;

    // Check if selectedGroupDeclaration exists and has documents
    if (selectedGroupDeclaration) {
      // Handle case when groupDeclaration exists but has no documents (empty array)
      if (
        groupDeclarationedDocuments[selectedGroupDeclaration] &&
        groupDeclarationedDocuments[selectedGroupDeclaration].length > 0
      ) {
        displayGroupDeclarationDocumentsForRemoval(
          selectedGroupDeclaration,
          groupDeclarationedDocuments[selectedGroupDeclaration]
        );
      } else {
        // Handle the case where the groupDeclaration is empty (no documents)
        document.getElementById("remove-document-container").innerHTML =
          "<p>Không có tài liệu trong nhóm này/No documents in this groupDeclaration</p>";
      }
    }
  } catch (error) {
    console.error("Error refreshing data:", error);
  }
}

function handleGroupDeclarationChange() {
  const selectedGroupDeclaration = document.getElementById(
    "groupDeclaration-select"
  ).value;
  if (!selectedGroupDeclaration) {
    document.getElementById("remove-document-container").innerHTML =
      "<p>Chọn một nhóm trước/Select a groupDeclaration first</p>";
    return;
  }

  // Check if groupDeclarationedDocuments exists, the selected groupDeclaration exists, and it has documents
  if (
    groupDeclarationedDocuments &&
    groupDeclarationedDocuments[selectedGroupDeclaration] &&
    groupDeclarationedDocuments[selectedGroupDeclaration].length > 0
  ) {
    displayGroupDeclarationDocumentsForRemoval(
      selectedGroupDeclaration,
      groupDeclarationedDocuments[selectedGroupDeclaration]
    );
  } else {
    document.getElementById("remove-document-container").innerHTML =
      "<p>Không có tài liệu trong nhóm này/No documents in this groupDeclaration</p>";
  }
}

async function lockGroupDeclaration() {
  const groupName = document.getElementById("lock-group-select").value;
  const statusMessage = document.getElementById("lock-status-message");

  if (!groupName) {
    statusMessage.textContent = "Vui lòng chọn một nhóm";
    return;
  }

  try {
    const response = await fetch("/lockGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName }),
    });

    const result = await response.json();
    statusMessage.textContent = result.message;
    await refreshGroupData();
  } catch (error) {
    console.error("Error locking group:", error);
    statusMessage.textContent = "Lỗi khi khóa nhóm";
  }
}

async function unlockGroupDeclaration() {
  const groupName = document.getElementById("lock-group-select").value;
  const statusMessage = document.getElementById("lock-status-message");

  if (!groupName) {
    statusMessage.textContent = "Vui lòng chọn một nhóm";
    return;
  }

  try {
    const response = await fetch("/unlockGroupDeclaration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName }),
    });

    const result = await response.json();
    statusMessage.textContent = result.message;
    await refreshGroupData();
  } catch (error) {
    console.error("Error unlocking group:", error);
    statusMessage.textContent = "Lỗi khi mở khóa nhóm";
  }
}

async function refreshGroupData() {
  try {
    const response = await fetch("/getGroupDeclaration");
    allGroupDeclarations = await response.json();
    populateGroupDeclarationSelect();
    populateLockGroupSelect();
  } catch (error) {
    console.error("Error refreshing group data:", error);
  }
}

function populateLockGroupSelect() {
  const select = document.getElementById("lock-group-select");
  while (select.options.length > 1) {
    select.remove(1);
  }

  allGroupDeclarations.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = `${group.name} - ${group.description} ${
      group.locked ? "(Đã khóa)" : ""
    }`;
    select.appendChild(option);
  });
}

// Declaration Editor Functions
function initDeclarationEditor() {
  // Add event delegation for edit declaration buttons
  document.addEventListener("click", function (event) {
    // Check if the clicked element or its parent is an edit button
    const editButton = event.target.closest(".edit-declaration-btn");
    if (editButton) {
      handleEditDeclarationClick(event);
    }
  });
}

// Add event listener for the mass update button
document
  .getElementById("mass-update-declaration-btn")
  .addEventListener("click", handleMassUpdateDeclaration);

document.addEventListener("DOMContentLoaded", () => {
  initializeDocumentManagement();
  refreshDocumentData();
  initDeclarationEditor();
});

// Close modal when clicking outside
document
  .getElementById("documentModal")
  .addEventListener("click", function (event) {
    if (event.target === this) {
      closeModal();
    }
  });
