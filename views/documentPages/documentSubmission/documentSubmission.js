// views\documentPages\documentSubmission\documentSubmission.js
flatpickr("#dateOfError", {
  dateFormat: "d-m-Y",
  defaultDate: "today",
});

////DOCUMENT SELECT HANDLERS
// Function to handle Proposal Document selection
function handleProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");

  contentFields.innerHTML = `
      <label for="task">Công việc/Task</label>
      <input type="text" name="task" required />
      <label for="costCenter">Trạm/Center</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm/Select a center</option>
      </select>
      <label for="dateOfError">Ngày xảy ra lỗi/Date of Error</label>
      <input type="text" name="dateOfError" id="dateOfError" required />
      <label for="detailsDescription">Mô tả chi tiết/Details Description</label>
      <textarea name="detailsDescription" rows="3" required></textarea>
      <label for="direction">Hướng xử lý/Direction</label>
      <input type="text" name="direction" required />
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>          
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  // Fetch current user and populate cost centers
  fetchCostCenters();

  flatpickr("#dateOfError", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  addContentButton.style.display = "none";
}

// Function to handle Purchasing Document selection
function handlePurchasingDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên/Name</label>
      <input type="text" name="name" required />
      <label for="costCenter">Trạm/Center</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm/Select a center</option>
      </select>
      <div id="product-entries">
        <label>Tên sản phẩm/Product Name</label><input type="text" name="products[0][productName]" required />
        <label>Đơn giá/Cost per Unit</label><input type="number" step="0.01" name="products[0][costPerUnit]" required />
        <label>Số lượng/Amount</label><input type="number" name="products[0][amount]" required />
        <label>Thuế/Vat (%)</label><input type="number" name="products[0][vat]" required />
        <label>Ghi chú/Note</label><input type="text" name="products[0][note]" />
      </div>
      <button type="button" onclick="addProductEntry()">Thêm sản phẩm/Add More Products</button>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>     
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Payment Document selection
function handlePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section"
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocuments();

  contentFields.innerHTML = `
      <label for="name">Tên/Name</label>
      <input type="text" name="name" required />
      <label for="content">Nội dung/Content</label>
      <input type="text" name="content" required />
      <label for="costCenter">Trạm/Center</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm/Select a center</option>
      </select>
      <label for="paymentMethod">Hình thức thanh toán/Payment Method</label>
      <input type="text" name="paymentMethod" required />
      <label for="totalPayment">Tổng thanh toán/Total Payment:</label>
      <input type="number" step="0.01" name="totalPayment" required />
      <label for="paymentDeadline">Thời hạn trả/Payment Deadline</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Advance Payment Document selection
function handleAdvancePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section"
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocuments();

  contentFields.innerHTML = `
      <label for="name">Tên/Name</label>
      <input type="text" name="name" required />
      <label for="content">Nội dung/Content</label>
      <input type="text" name="content" required />
      <label for="costCenter">Trạm/Center</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm/Select a center</option>
      </select>
      <label for="paymentMethod">Hình thức thanh toán/Payment Method</label>
      <input type="text" name="paymentMethod" required />
      <label for="advancePayment">Thanh toán trước/Advance Payment:</label>
      <input type="number" step="0.01" name="advancePayment"/>
      <label for="paymentDeadline">Thời hạn trả/Payment Deadline</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Delivery Document selection
function handleDeliveryDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên/Name</label>
      <input type="text" name="name" required />
      <label for="costCenter">Trạm/Center</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm/Select a center</option>
      </select>
      <div id="product-entries">
        <label>Tên sản phẩm/Product Name</label><input type="text" name="products[0][productName]" required />
        <label>Đơn giá/Cost per Unit</label><input type="number" step="0.01" name="products[0][costPerUnit]" required />
        <label>Số lượng/Amount</label><input type="number" name="products[0][amount]" required />
        <label>Thuế/Vat (%)</label><input type="number" name="products[0][vat]" required />
        <label>Ghi chú/Note</label><input type="text" name="products[0][note]" />
      </div>
      <button type="button" onclick="addProductEntry()">Thêm sản phẩm/Add More Products</button>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>             
    `;

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Generic Document selection
function handleProjectProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên/Name</label>
      <input type="text" name="name" required />
      <label for="contentName">Tên nội dung/Content Name</label>
      <input type="text" name="contentName" required />
      <label for="contentText">Nội dung/Content Text</label>
      <textarea name="contentText" rows="5" required></textarea>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  addContentButton.style.display = "inline-block";
  appendApprovedDocumentsSection.style.display = "none";
}

// Function to handle Generic Document selection
function handleGenericDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section"
  );

  contentFields.innerHTML = `
      <label for="contentName">Tên nội dung/Content Name</label>
      <input type="text" name="contentName" required />
      <label for="contentText">Nội dung/Content Text</label>
      <textarea name="contentText" rows="5" required></textarea>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm/Select a group</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án/Select a project</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  addContentButton.style.display = "inline-block";
  appendApprovedDocumentsSection.style.display = "none";
}

// Utility function to fetch and populate cost centers
function fetchCostCenters() {
  fetch("/getCurrentUser")
    .then((response) => response.json())
    .then((userData) => {
      const currentUser = userData.username;

      fetch("/costCenters")
        .then((response) => response.json())
        .then((costCenters) => {
          const costCenterSelect = document.getElementById("costCenter");
          costCenterSelect.innerHTML =
            '<option value="">Chọn một trạm/Select a center</option>';

          costCenters.forEach((center) => {
            if (
              center.allowedUsers.length === 0 ||
              center.allowedUsers.includes(currentUser)
            ) {
              const option = document.createElement("option");
              option.value = center.name;
              option.textContent = center.name;
              costCenterSelect.appendChild(option);
            }
          });
        })
        .catch((error) => {
          console.error("Error fetching cost centers:", error);
        });
    })
    .catch((error) => {
      console.error("Error fetching current user:", error);
    });
}

// Main event listener for document type dropdown
document
  .getElementById("title-dropdown")
  .addEventListener("change", function () {
    const selectedTitle = this.value;
    const contentFields = document.getElementById("content-fields");
    const addContentButton = document.getElementById("add-content-btn");
    const approvedProposalSection = document.getElementById(
      "approved-proposal-section"
    );
    const appendApprovedDocumentsSection = document.getElementById(
      "append-approved-documents-section"
    );
    const appendPurchasingSection = document.getElementById(
      "append-purchasing-documents-section"
    );
    const purchasingDocumentPreview = document.getElementById(
      "purchasingDocumentPreview"
    );

    // Reset all sections and content fields
    contentFields.innerHTML = "";
    addContentButton.style.display = "none";
    approvedProposalSection.style.display = "none";
    appendApprovedDocumentsSection.style.display = "none";
    appendPurchasingSection.style.display = "none";
    purchasingDocumentPreview.style.display = "none";

    // Call respective handler based on selected document type
    switch (selectedTitle) {
      case "Proposal Document":
        handleProposalDocument();
        break;
      case "Purchasing Document":
        handlePurchasingDocument();
        break;
      case "Payment Document":
        handlePaymentDocument();
        break;
      case "Advance Payment Document":
        handleAdvancePaymentDocument();
        break;
      case "Delivery Document":
        handleDeliveryDocument();
        break;
      case "Project Proposal Document":
        handleProjectProposalDocument();
        break;
      case "Generic Document":
        handleGenericDocument();
        break;
    }
  });
////END OF DOCUMENT SELECT HANDLERS

function addProductEntry() {
  const productEntries = document.getElementById("product-entries");
  const productCount = productEntries.children.length / 5;

  const newEntry = `
      <label>Tên sản phẩm/Product Name</label><input type="text" name="products[${productCount}][productName]" required />
      <label>Đơn giá/Cost per Unit</label><input type="number" name="products[${productCount}][costPerUnit]" required />
      <label>Số lượng/Amount</label><input type="number" name="products[${productCount}][amount]" required />
      <label>Thuế/Vat</label><input type="number" name="products[${productCount}][vat]" required />
      <label>Ghi chú/Note</label><input type="text" name="products[${productCount}][note]" />
    `;
  productEntries.insertAdjacentHTML("beforeend", newEntry);
}

async function fetchApprovers() {
  const response = await fetch("/approvers");
  const approvers = await response.json();
  const approverSelect = document.getElementById("approver-selection");

  approvers.forEach((approver) => {
    const approverDiv = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = approver.username;
    approverDiv.appendChild(label);

    const approverInput = document.createElement("input");
    approverInput.type = "checkbox";
    approverInput.name = "approvers";
    approverInput.value = approver._id;
    approverDiv.appendChild(approverInput);

    const subRoleInput = document.createElement("input");
    subRoleInput.type = "text";
    subRoleInput.name = `subRole_${approver._id}`;
    subRoleInput.placeholder = "Nhập vai trò/Enter Sub-Role";
    subRoleInput.disabled = true;
    approverDiv.appendChild(subRoleInput);

    approverInput.addEventListener("change", function () {
      subRoleInput.disabled = !approverInput.checked;
      subRoleInput.required = approverInput.checked;
    });

    approverSelect.appendChild(approverDiv);
  });
}

async function fetchApprovedDocuments() {
  const response = await fetch("/approvedDocument");
  const approvedDocs = await response.json();
  const approvedDocsDropdown = document.getElementById(
    "approvedDocumentsDropdown"
  );

  approvedDocs.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = doc._id;
    approvedDocsDropdown.appendChild(option);
  });
}

function addProposalEntry() {
  const container = document.getElementById("proposal-selections");
  const newEntry = document.createElement("div");
  newEntry.className = "proposal-entry";
  newEntry.innerHTML = `
      <select class="approved-proposal-dropdown" name="approvedProposals[]" onchange="previewProposalContent(this)">
        <option value="">Chọn phiếu đề xuất/Select a proposal</option>
      </select>
      <button type="button" class="remove-proposal" onclick="removeProposalEntry(this)">Xóa/Remove</button>
    `;
  container.appendChild(newEntry);
  // Populate the new dropdown
  fetchApprovedProposals(newEntry.querySelector("select"));
}

function removeProposalEntry(button) {
  const entry = button.parentElement;
  const previewId = entry.querySelector("select").value;
  if (previewId) {
    const previewElement = document.getElementById(`preview-${previewId}`);
    if (previewElement) previewElement.remove();
  }
  entry.remove();
}

async function fetchApprovedProposals(dropdown = null) {
  const response = await fetch("/approvedProposalDocuments");
  const approvedProposals = await response.json();

  if (!dropdown) {
    // If no specific dropdown provided, populate all dropdowns
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

function populateDropdown(select, proposals) {
  select.innerHTML =
    '<option value="">Chọn phiếu đề xuất/Select a proposal</option>';
  proposals.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = doc.task;
    select.appendChild(option);
  });
}

async function previewProposalContent(selectElement) {
  const documentId = selectElement.value;
  const previewsContainer = document.getElementById("proposalPreviews");

  // Find the specific preview container for this select element
  const selectContainer = selectElement.closest(".proposal-entry");
  const existingPreview = selectContainer.querySelector(".proposal-preview");
  if (existingPreview) {
    existingPreview.remove();
  }

  if (!documentId) return;

  const response = await fetch(`/proposalDocument/${documentId}`);
  const proposal = await response.json();

  const previewDiv = document.createElement("div");
  previewDiv.className = "proposal-preview";
  previewDiv.innerHTML = `
      <h3>Xem trước phiếu đề xuất/Preview of Proposal ${documentId}</h3>
      <p><strong>Tình trạng phê duyệt/Approval Status:</strong> ${
        proposal.status
      }<br></p>
      <p><strong>Công việc/Task:</strong> ${proposal.task}</p>
      <p><strong>Trạm/Center:</strong> ${proposal.costCenter}</p>
      <p><strong>Ngày xảy ra lỗi/Date of Error:</strong> ${
        proposal.dateOfError
      }</p>
      <p><strong>Mô tả chi tiết/Details Description:</strong> ${
        proposal.detailsDescription
      }</p>
      <p><strong>Hướng xử lý/Direction:</strong> ${proposal.direction}</p>
      ${
        proposal.fileMetadata
          ? `<p><strong>Tệp đính kèm/Attached File:</strong>
        <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></p>`
          : ""
      }
    `;
  // Insert the preview right after the select container
  selectContainer.appendChild(previewDiv);
}

async function fetchPurchasingDocuments() {
  const response = await fetch("/approvedPurchasingDocuments");
  const purchasingDocs = await response.json();
  const dropdown = document.getElementById("purchasingDocumentsDropdown");

  // Populate dropdown options
  dropdown.innerHTML =
    '<option value="">Hãy chọn một phiếu mua hàng/Select a purchasing document</option>';
  purchasingDocs.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = `${doc.name ? doc.name + " - " : ""}${
      doc.submissionDate
    }`;
    dropdown.appendChild(option);
  });
}

// Add selected purchasing document to the list
document
  .getElementById("add-purchasing-document-btn")
  .addEventListener("click", async () => {
    const dropdown = document.getElementById("purchasingDocumentsDropdown");
    const selectedDocId = dropdown.value;
    const purchasingDocumentsList = document.getElementById(
      "purchasingDocumentsList"
    );

    if (!selectedDocId) {
      alert("Xin hãy chọn phiếu mua hàng/Please select a purchasing document.");
      return;
    }

    // Check if the document is already added
    if (document.querySelector(`#doc-${selectedDocId}`)) {
      alert("Bạn đã thêm phiếu này rồi/This document has already been added.");
      return;
    }

    // Fetch and display the purchasing document details
    try {
      const response = await fetch(`/purchasingDocument/${selectedDocId}`);
      if (!response.ok) throw new Error("Failed to fetch document details.");
      const doc = await response.json();

      const listItem = document.createElement("li");
      listItem.id = `doc-${selectedDocId}`;
      listItem.innerHTML = `
          <strong>Mã/ID:</strong> ${doc._id}<br>
          <strong>Tình trạng phê duyệt/Approval Status:</strong> ${
            doc.status
          }<br>
          <strong>Trạm/Center:</strong> ${
            doc.costCenter ? doc.costCenter : ""
          }<br>
          <strong>Chi phí/Grand Total Cost:</strong> ${doc.grandTotalCost.toLocaleString()}<br>
          <h3>Sản phẩm/Products:</h3>
          <ul>
              ${doc.products
                .map(
                  (product) => `
                    <li>
                        <strong>${product.productName}</strong><br>
                        Đơn giá/Cost Per Unit: ${product.costPerUnit.toLocaleString()}<br>
                        Số lượng/Amount: ${product.amount.toLocaleString()}<br>
                        Thuế/Vat (%): ${product.vat.toLocaleString()}<br>
                        Thành tiền/Total Cost: ${product.totalCost.toLocaleString()}<br>
                        Thành tiền sau thuế/Total Cost After Vat: ${product.totalCostAfterVat.toLocaleString()}<br>
                        Ghi chú/Notes: ${product.note || "None"}
                    </li>
                `
                )
                .join("")}
          </ul>
          <h2>Các phiếu đề xuất đính kèm/Appended Proposals:</h2>
          ${
            doc.appendedProposals.length > 0
              ? doc.appendedProposals
                  .map(
                    (proposal) => `
                      <li>
                        <strong>${proposal.task}</strong><br>
                        Trạm/Center: ${proposal.costCenter}<br>
                        Ngày xảy ra lỗi/Date of Error: ${
                          proposal.dateOfError
                        }<br>
                        Mô tả chi tiết/Details Description: ${
                          proposal.detailsDescription
                        } <br>
                        Hướng xử lý/Direction: ${proposal.direction}<br>
                        ${
                          proposal.fileMetadata
                            ? `Tệp đính kèm phiếu đề xuất/Attached File to Proposal Document:
                                <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a>`
                            : ""
                        }<br>
                      </li>
                  `
                  )
                  .join("")
              : "<p>Không có phiếu đề xuất đính kèm/No appended proposals.</p>"
          }
          ${
            doc.fileMetadata
              ? `<p><strong>Tệp đính kèm phiếu thanh toán/File attaches to payment document:</strong>
                    <a href="${doc.fileMetadata.link}" target="_blank">${doc.fileMetadata.name}</a></p>`
              : "<p>Không có tệp đính kèm/No file attached.</p>"
          }
          <button type="button" onclick="removePurchasingDocument('${selectedDocId}')">Xóa/Remove</button>
      `;

      purchasingDocumentsList.appendChild(listItem);

      // Add hidden input for form submission
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "approvedPurchasingDocuments[]";
      hiddenInput.value = selectedDocId;
      hiddenInput.id = `input-${selectedDocId}`;
      document.getElementById("submit-form").appendChild(hiddenInput);
    } catch (error) {
      console.error("Error fetching document details:", error);
      alert("Failed to add the purchasing document. Please try again.");
    }
  });

// Remove a purchasing document
function removePurchasingDocument(docId) {
  document.getElementById(`doc-${docId}`).remove();
  document.getElementById(`input-${docId}`).remove();
}

async function fetchGroups() {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    return groups;
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

async function populateGroupDropdown() {
  const groups = await fetchGroups();
  const groupSelect = document.getElementById("groupName");

  // Clear existing options except the first one
  groupSelect.innerHTML = '<option value="">Chọn nhóm/Select a group</option>';

  // Add new options
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
}

async function fetchProjects() {
  try {
    const response = await fetch("/getProjectDocument");
    const groups = await response.json();
    return groups;
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

async function populateProjectDropdown() {
  const projects = await fetchProjects();
  const projectSelect = document.getElementById("projectName");

  // Clear existing options except the first one
  projectSelect.innerHTML =
    '<option value="">Chọn dự án/Select a project</option>';

  // Add new options
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.name;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });
}

fetchApprovedDocuments();
fetchApprovers();
fetchApprovedProposals();
fetchPurchasingDocuments();

document
  .getElementById("submit-form")
  .addEventListener("submit", function (event) {
    const approvers = document.querySelectorAll(
      'input[name="approvers"]:checked'
    );
    if (approvers.length === 0) {
      event.preventDefault();
      alert(
        "Xin hãy chọn ít nhất một người phê duyệt/Please select at least one approver."
      );
    }
  });

document
  .getElementById("add-content-btn")
  .addEventListener("click", function () {
    const contentFields = document.getElementById("content-fields");
    const nameLabel = document.createElement("label");
    nameLabel.innerText = "Tên nội dung/Content Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "contentName";

    const textLabel = document.createElement("label");
    textLabel.innerText = "Nội dung/Content Text";
    const textArea = document.createElement("textarea");
    textArea.name = "contentText";
    textArea.rows = 5;

    contentFields.appendChild(nameLabel);
    contentFields.appendChild(nameInput);
    contentFields.appendChild(textLabel);
    contentFields.appendChild(textArea);
  });
