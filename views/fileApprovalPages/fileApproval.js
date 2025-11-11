// views/fileApprovalPages/fileApproval.js
// Global variables
let selectedFileId = null;
let selectedUsers = new Set();
let allUsers = [];

// Month names in Vietnamese
const monthNames = {
  1: "Tháng 1",
  2: "Tháng 2",
  3: "Tháng 3",
  4: "Tháng 4",
  5: "Tháng 5",
  6: "Tháng 6",
  7: "Tháng 7",
  8: "Tháng 8",
  9: "Tháng 9",
  10: "Tháng 10",
  11: "Tháng 11",
  12: "Tháng 12",
};

// Category folder names mapping
const categoryFolders = {
  "Công ty": "Company",
  "Đối tác": "Partner",
  "Ngân hàng": "Bank",
  "Pháp lý": "Legal",
};

// Subcategory folder names mapping
const subcategoryFolders = {
  // Company
  "Quản lý chung": "General_Management",
  "Giấy đăng ký kinh doanh": "Business_Registration",
  "Sơ đồ tổ chức": "Organization_Chart",
  "Brochure / Hồ sơ năng lực": "Brochure_Capability",
  "Quy trình & Quy định": "Processes_Regulations",
  "Điều lệ công ty": "Company_Charter",
  "Quy chế tài chính": "Financial_Regulations",
  "Quyết định công ty": "Company_Decisions",
  "Phòng ban": "Departments",
  "Quyết định cấp phòng": "Department_Decisions",
  "Quy trình riêng": "Specific_Procedures",
  "Nhân sự": "Human_Resources",
  "Hợp đồng lao động": "Labor_Contracts",
  "Quyết định nhân sự": "HR_Decisions",
  "Chứng chỉ / Bằng cấp": "Certificates_Degrees",
  "Hồ sơ cá nhân": "Personal_Records",
  "Phiếu lương": "Payroll_Sheets",
  "Tài sản & Thiết bị": "Assets_Equipment",
  Trạm: "Stations",
  "Bồn chứa": "Storage_Tanks",
  "Thiết bị khác": "Other_Equipment",
  "Hồ sơ pháp lý": "Legal_Records",
  "Hồ sơ vận hành": "Operation_Records",
  "CO, CQ & Manual": "CO_CQ_Manual",
  "CO (Chứng nhận xuất xứ)": "CO",
  "CQ (Chứng nhận chất lượng)": "CQ",
  Manual: "Manual",
  "Báo cáo tài chính": "Financial_Reports",
  "Báo cáo tài chính năm": "Annual_Financial_Reports",
  "Thuyết minh BCTC": "Financial_Statement_Notes",
  "Báo cáo kiểm toán": "Audit_Reports",

  // Partner
  "Hợp đồng mua": "Purchase_Contract",
  "Hợp đồng bán": "Sales_Contract",
  "Bảo hành & Khiếu nại": "Warranty_Claims",
  "Phụ lục hợp đồng": "Contract_Appendix",
  "Hóa đơn mua": "Purchase_Invoice",
  "Hóa đơn bán": "Sales_Invoice",
  "Chứng từ thanh toán": "Payment_Documents",
  "Chứng từ vận chuyển": "Shipping_Documents",
  "Bảng nhiệt trị": "Calorific_Statement",

  // Bank
  "Hồ sơ mở & quản lý tài khoản": "Account_Opening_Management",
  "Sao kê & giao dịch thường kỳ": "Statements_Regular_Transactions",
  "Ủy nhiệm chi & chứng từ thanh toán": "Payment_Orders_Documents",
  "Đối soát & xác nhận số dư": "Reconciliation_Balance_Confirmation",
  "Hạn mức tín dụng & vay vốn": "Credit_Limit_Loan",
  "Bảo lãnh & LC": "Guarantee_LC",
  "Biểu phí & thông báo": "Fee_Schedule_Notifications",
  "Tuân thủ & KYC": "Compliance_KYC",

  // Legal
  Thuế: "Tax",
  "Bảo hiểm xã hội": "Social_Insurance",
  "Hải quan": "Customs",
  "Thanh tra / Kiểm tra": "Inspection_Audit",
  "Tranh chấp pháp lý": "Legal_Disputes",
};

// Document options for each category
const documentOptions = {
  "Công ty": {
    "Quản lý chung": [
      "Giấy đăng ký kinh doanh",
      "Sơ đồ tổ chức",
      "Brochure / Hồ sơ năng lực",
    ],
    "Quy trình & Quy định": [
      "Điều lệ công ty",
      "Quy chế tài chính",
      "Quyết định công ty",
      "Phòng ban",
      "Quyết định cấp phòng",
      "Quy trình riêng",
    ],
    "Nhân sự": [
      "Hợp đồng lao động",
      "Quyết định nhân sự",
      "Chứng chỉ / Bằng cấp",
      "Hồ sơ cá nhân",
      "Phiếu lương",
    ],
    "Tài sản & Thiết bị": ["Hồ sơ pháp lý", "Hồ sơ vận hành"],
    "CO, CQ & Manual": [
      "CO (Chứng nhận xuất xứ)",
      "CQ (Chứng nhận chất lượng)",
      "Manual",
    ],
    "Báo cáo tài chính": [
      "Báo cáo tài chính năm",
      "Thuyết minh BCTC",
      "Báo cáo kiểm toán",
    ],
  },
  "Đối tác": {
    "Hợp đồng mua": [
      "Phụ lục hợp đồng",
      "Hóa đơn mua",
      "Chứng từ thanh toán",
      "Chứng từ vận chuyển",
      "CO",
      "CQ",
      "BL",
      "PL",
      "Invoice",
    ],
    "Hợp đồng bán": [
      "Phụ lục hợp đồng",
      "Hóa đơn bán",
      "Chứng từ thanh toán",
      "Bảng nhiệt trị",
      "Chứng từ vận chuyển",
      "CO",
      "CQ",
      "BL",
      "PL",
      "Invoice",
    ],
    "Bảo hành & Khiếu nại": ["Hồ sơ bảo hành", "Khiếu nại / Xử lý sự cố"],
  },
  "Ngân hàng": [
    "Hồ sơ mở & quản lý tài khoản",
    "Sao kê & giao dịch thường kỳ",
    "Ủy nhiệm chi & chứng từ thanh toán",
    "Đối soát & xác nhận số dư",
    "Hạn mức tín dụng & vay vốn",
    "Bảo lãnh & LC",
    "Biểu phí & thông báo",
    "Tuân thủ & KYC",
  ],
  "Pháp lý": [
    "Thuế",
    "Bảo hiểm xã hội",
    "Hải quan",
    "Thanh tra / Kiểm tra",
    "Tranh chấp pháp lý",
  ],
};

// Drag and drop functionality
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    handleFileUpload();
  }
});

fileInput.addEventListener("change", handleFileUpload);

// Set current year as default in upload form
function setCurrentYear() {
  const currentYear = new Date().getFullYear();
  document.getElementById("yearInput").value = currentYear;
  updateFolderStructure();
}

// Update form fields based on category selection
function updateFormFields() {
  const category = document.getElementById("categorySelect").value;

  // Hide all dynamic form groups first
  document.querySelectorAll(".dynamic-form-group").forEach((group) => {
    group.style.display = "none";
  });

  // Reset all dynamic fields
  document.getElementById("companySubcategorySelect").value = "";
  document.getElementById("documentSubtypeSelect").innerHTML =
    '<option value="">-- Chọn chi tiết --</option>';
  document.getElementById("departmentInput").value = "";
  document.getElementById("employeeNameInput").value = "";
  document.getElementById("assetTypeSelect").value = "";
  document.getElementById("assetNameInput").value = "";
  document.getElementById("partnerNameInput").value = "";
  document.getElementById("contractTypeSelect").value = "";
  document.getElementById("contractNumberInput").value = "";
  document.getElementById("documentTypeSelect").innerHTML =
    '<option value="">-- Chọn loại tài liệu --</option>';
  document.getElementById("bankNameInput").value = "";
  document.getElementById("bankDocumentTypeSelect").innerHTML =
    '<option value="">-- Chọn loại tài liệu --</option>';
  document.getElementById("legalDocumentTypeSelect").innerHTML =
    '<option value="">-- Chọn loại tài liệu --</option>';

  // Show month field by default
  document.getElementById("monthGroup").style.display = "block";

  if (category === "Công ty") {
    document.getElementById("companySubcategoryGroup").style.display = "block";
  } else if (category === "Đối tác") {
    document.getElementById("partnerNameGroup").style.display = "block";
    document.getElementById("contractTypeGroup").style.display = "block";
  } else if (category === "Ngân hàng") {
    document.getElementById("bankNameGroup").style.display = "block";
    document.getElementById("bankDocumentTypeGroup").style.display = "block";
    updateDocumentTypes("Ngân hàng", "bankDocumentTypeSelect");
  } else if (category === "Pháp lý") {
    document.getElementById("legalDocumentTypeGroup").style.display = "block";
    updateDocumentTypes("Pháp lý", "legalDocumentTypeSelect");
    // Hide month for legal as it's optional
    document.getElementById("monthGroup").style.display = "none";
  }

  updateFolderStructure();
}

// Update company-specific fields
function updateCompanyFields() {
  const subcategory = document.getElementById("companySubcategorySelect").value;

  // Hide all company-specific groups
  document.getElementById("documentSubtypeGroup").style.display = "none";
  document.getElementById("departmentGroup").style.display = "none";
  document.getElementById("employeeNameGroup").style.display = "none";
  document.getElementById("assetTypeGroup").style.display = "none";
  document.getElementById("assetNameGroup").style.display = "none";

  // Reset fields
  document.getElementById("documentSubtypeSelect").innerHTML =
    '<option value="">-- Chọn chi tiết --</option>';
  document.getElementById("departmentInput").value = "";
  document.getElementById("employeeNameInput").value = "";
  document.getElementById("assetTypeSelect").value = "";
  document.getElementById("assetNameInput").value = "";

  if (subcategory) {
    document.getElementById("documentSubtypeGroup").style.display = "block";

    // Populate document subtypes
    const options = documentOptions["Công ty"][subcategory] || [];
    const select = document.getElementById("documentSubtypeSelect");
    select.innerHTML = '<option value="">-- Chọn chi tiết --</option>';
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });

    // Show additional fields based on subcategory
    if (subcategory === "Quy trình & Quy định") {
      document.getElementById("departmentGroup").style.display = "block";
    } else if (subcategory === "Nhân sự") {
      document.getElementById("departmentGroup").style.display = "block";
      document.getElementById("employeeNameGroup").style.display = "block";
    } else if (subcategory === "Tài sản & Thiết bị") {
      document.getElementById("assetTypeGroup").style.display = "block";
    }
  }

  updateFolderStructure();
}

// Update asset-specific fields
function updateAssetFields() {
  const assetType = document.getElementById("assetTypeSelect").value;
  document.getElementById("assetNameGroup").style.display = assetType
    ? "block"
    : "none";
  updateFolderStructure();
}

// Update partner-specific fields
function updatePartnerFields() {
  const contractType = document.getElementById("contractTypeSelect").value;
  document.getElementById("contractNumberGroup").style.display = contractType
    ? "block"
    : "none";
  document.getElementById("documentTypeGroup").style.display = contractType
    ? "block"
    : "none";

  if (contractType) {
    updateDocumentTypes("Đối tác", "documentTypeSelect", contractType);
  }

  updateFolderStructure();
}

// Update document types dropdown
function updateDocumentTypes(category, selectId, subcategory = null) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">-- Chọn loại tài liệu --</option>';

  let options = [];
  if (category === "Đối tác" && subcategory) {
    options = documentOptions[category][subcategory] || [];
  } else {
    options = documentOptions[category] || [];
  }

  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

// Convert text to ASCII folder name
function convertToAsciiFolderName(text) {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

// Update folder structure display
function updateFolderStructure() {
  const category = document.getElementById("categorySelect").value;
  const year = document.getElementById("yearInput").value;
  const month = document.getElementById("monthSelect").value;
  const folderStructure = document.getElementById("folderStructure");
  const folderPath = document.getElementById("folderPath");

  if (!category || !year) {
    folderStructure.style.display = "none";
    return;
  }

  const categoryFolder = categoryFolders[category];
  let path = `Approved/${categoryFolder}`;

  if (category === "Công ty") {
    const subcategory = document.getElementById(
      "companySubcategorySelect"
    ).value;
    if (subcategory) {
      const asciiSubcategory =
        subcategoryFolders[subcategory] ||
        convertToAsciiFolderName(subcategory);
      path += `/${asciiSubcategory}`;

      const documentSubtype = document.getElementById(
        "documentSubtypeSelect"
      ).value;
      if (documentSubtype) {
        const asciiDocType =
          subcategoryFolders[documentSubtype] ||
          convertToAsciiFolderName(documentSubtype);
        path += `/${asciiDocType}`;

        if (subcategory === "Quy trình & Quy định") {
          const department = document.getElementById("departmentInput").value;
          if (department) {
            path += `/${convertToAsciiFolderName(department)}`;
          }
        } else if (subcategory === "Nhân sự") {
          const department = document.getElementById("departmentInput").value;
          const employeeName =
            document.getElementById("employeeNameInput").value;
          if (department && employeeName) {
            path += `/${convertToAsciiFolderName(
              department
            )}/${convertToAsciiFolderName(employeeName)}`;

            if (documentSubtype === "Phiếu lương" && month) {
              path += `/${asciiDocType}/${year}/${monthNames[month]}`;
            }
          }
        } else if (subcategory === "Tài sản & Thiết bị") {
          const assetType = document.getElementById("assetTypeSelect").value;
          const assetName = document.getElementById("assetNameInput").value;
          if (assetType && assetName) {
            const asciiAssetType =
              subcategoryFolders[assetType] ||
              convertToAsciiFolderName(assetType);
            path += `/${asciiAssetType}/${convertToAsciiFolderName(assetName)}`;
          }
        } else if (subcategory === "Báo cáo tài chính") {
          path += `/${year}`;
        }
      }
    }
  } else if (category === "Đối tác") {
    const partnerName = document.getElementById("partnerNameInput").value;
    if (partnerName) {
      path += `/${convertToAsciiFolderName(partnerName)}`;

      const contractType = document.getElementById("contractTypeSelect").value;
      if (contractType) {
        const asciiContractType =
          subcategoryFolders[contractType] ||
          convertToAsciiFolderName(contractType);
        path += `/${asciiContractType}`;

        const contractNumber = document.getElementById(
          "contractNumberInput"
        ).value;
        if (contractNumber) {
          path += `/${convertToAsciiFolderName(contractNumber)}`;

          const documentType =
            document.getElementById("documentTypeSelect").value;
          if (documentType) {
            const asciiDocType =
              subcategoryFolders[documentType] ||
              convertToAsciiFolderName(documentType);
            path += `/${asciiDocType}`;

            // Add year/month for monthly documents
            const monthlyDocs = [
              "Hóa đơn mua",
              "Chứng từ thanh toán",
              "Hóa đơn bán",
            ];
            if (monthlyDocs.includes(documentType) && month) {
              path += `/${year}/${monthNames[month]}`;
            }
          }
        }
      }
    }
  } else if (category === "Ngân hàng") {
    const bankName = document.getElementById("bankNameInput").value;
    if (bankName) {
      path += `/${convertToAsciiFolderName(bankName)}`;

      const documentType = document.getElementById(
        "bankDocumentTypeSelect"
      ).value;
      if (documentType) {
        const asciiDocType =
          subcategoryFolders[documentType] ||
          convertToAsciiFolderName(documentType);
        path += `/${asciiDocType}`;

        // Add year/month for monthly documents
        const monthlyDocs = [
          "Sao kê & giao dịch thường kỳ",
          "Ủy nhiệm chi & chứng từ thanh toán",
        ];
        if (monthlyDocs.includes(documentType) && month) {
          path += `/${year}/${monthNames[month]}`;
        }
      }
    }
  } else if (category === "Pháp lý") {
    const documentType = document.getElementById(
      "legalDocumentTypeSelect"
    ).value;
    if (documentType) {
      const asciiDocType =
        subcategoryFolders[documentType] ||
        convertToAsciiFolderName(documentType);
      path += `/${asciiDocType}`;

      // Add year/month for monthly documents
      const monthlyDocs = ["Thuế", "Bảo hiểm xã hội"];
      if (monthlyDocs.includes(documentType) && month) {
        path += `/${year}/${monthNames[month]}`;
      }
    }
  }

  folderPath.textContent = path;
  folderStructure.style.display = "block";
}

// Load approved files with permission filtering
async function loadApprovedFiles() {
  try {
    const category = document.getElementById("approvedCategoryFilter").value;
    const year = document.getElementById("approvedYearFilter").value;
    const month = document.getElementById("approvedMonthFilter").value;

    let url = "/fileApprovalControl/approved";
    const params = new URLSearchParams();

    if (category !== "all") params.append("category", category);
    if (year) params.append("year", year);
    if (month) params.append("month", month);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    const response = await fetch(url);
    const files = await response.json();

    displayApprovedFiles(files);
  } catch (error) {
    console.error("Lỗi khi tải file đã phê duyệt:", error);
    showMessage("Lỗi khi tải file đã phê duyệt: " + error.message, "error");
  }
}

// Display approved files
function displayApprovedFiles(files) {
  const approvedList = document.getElementById("approvedFilesList");
  approvedList.innerHTML = "";

  if (files.length === 0) {
    approvedList.innerHTML =
      '<p style="text-align: center; color: #666;">Không có tệp tin nào được phê duyệt</p>';
    return;
  }

  files.forEach((file) => {
    const categoryClass = getCategoryClass(file.category);
    const fileElement = document.createElement("div");
    fileElement.className = "file-item";

    let permissionInfo = "";
    if (file.viewableBy && file.viewableBy.length > 0) {
      permissionInfo = `<br><small style="color: #666;">📋 Chỉ hiển thị cho ${file.viewableBy.length} người dùng được chọn</small>`;
    } else {
      permissionInfo = `<br><small style="color: #666;">🌐 Hiển thị cho tất cả người dùng</small>`;
    }

    let details = `
                    <span class="category-badge ${categoryClass}">${
      file.category
    }</span> 
                    <span class="time-badge">${file.year}${
      file.month ? "/" + monthNames[file.month] : ""
    }</span>
                    Trạng thái: <span class="status-approved">ĐÃ PHÊ DUYỆT</span> | 
                    Kích thước: ${formatFileSize(file.fileSize)} | 
                    Phê duyệt bởi: ${file.actionTakenBy} lúc ${new Date(
      file.actionTakenAt
    ).toLocaleString()}
                    ${permissionInfo}
                `;

    // Add subcategory details
    if (file.companySubcategory) {
      details += `<br>Loại: ${file.companySubcategory}`;
      if (file.documentSubtype) details += ` → ${file.documentSubtype}`;
      if (file.department) details += ` → ${file.department}`;
      if (file.employeeName) details += ` → ${file.employeeName}`;
    } else if (file.partnerName) {
      details += `<br>Đối tác: ${file.partnerName}`;
      if (file.contractType) details += ` → ${file.contractType}`;
      if (file.contractNumber) details += ` → ${file.contractNumber}`;
    } else if (file.bankName) {
      details += `<br>Ngân hàng: ${file.bankName}`;
    } else if (file.legalDocumentType) {
      details += `<br>Loại tài liệu: ${file.legalDocumentType}`;
    }

    const permissionButton = `<button class="fa-btn fa-btn-secondary" onclick="openPermissionModal('${file._id}')" style="margin-left: 10px;">🛡️ Quản lý quyền</button>`;

    fileElement.innerHTML = `
                    <div class="file-info">
                        <div class="file-name">${file.originalName}</div>
                        <div class="file-details">
                            ${details}
                            ${
                              file.shareUrl
                                ? `<br><a href="${file.shareUrl}" target="_blank" class="fa-btn fa-btn-view" style="margin-top: 5px;">Xem tệp tin</a>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="file-actions">
                        ${permissionButton}
                    </div>
                `;
    approvedList.appendChild(fileElement);
  });
}

// Open permission management modal
async function openPermissionModal(fileId) {
  selectedFileId = fileId;
  selectedUsers.clear();

  // Load eligible users
  try {
    const response = await fetch("/fileApprovalControl/eligible-users");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allUsers = await response.json();
    displayUserList(allUsers);

    // Load current permissions for this file
    const fileResponse = await fetch(`/fileApprovalControl/${fileId}`);
    if (!fileResponse.ok) {
      throw new Error(`HTTP error! status: ${fileResponse.status}`);
    }
    const file = await fileResponse.json();

    console.log("Current file permissions:", file);

    if (file.viewableBy && Array.isArray(file.viewableBy)) {
      file.viewableBy.forEach((user) => {
        // Make sure we're storing the user ID as string
        if (user && user._id) {
          selectedUsers.add(user._id.toString());
        }
      });
      updateUserListSelection();
    }

    // Show permission management section
    document.getElementById("permissionManagement").style.display = "block";
    document
      .getElementById("permissionManagement")
      .scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Error loading permission data:", error);
    showMessage(
      "Lỗi khi tải dữ liệu quyền truy cập: " + error.message,
      "error"
    );
  }
}

// Display user list for permission assignment
function displayUserList(users) {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  users.forEach((user) => {
    const userElement = document.createElement("div");
    userElement.className = "user-item";
    userElement.setAttribute("data-user-id", user._id);
    userElement.innerHTML = `
                    <input type="checkbox" id="user-${user._id}" value="${user._id}" 
                           onchange="toggleUserSelection('${user._id}')">
                    <label for="user-${user._id}" style="margin-left: 8px; cursor: pointer;">
                        ${user.realName} (${user.username})
                    </label>
                `;
    userList.appendChild(userElement);
  });
}

// Search users
function searchUsers() {
  const searchTerm = document.getElementById("userSearch").value.toLowerCase();
  const filteredUsers = allUsers.filter(
    (user) =>
      (user.realName && user.realName.toLowerCase().includes(searchTerm)) ||
      (user.username && user.username.toLowerCase().includes(searchTerm)) ||
      (user.department && user.department.toLowerCase().includes(searchTerm))
  );
  displayUserList(filteredUsers);
  updateUserListSelection();
}

// Toggle user selection
function toggleUserSelection(userId) {
  if (selectedUsers.has(userId)) {
    selectedUsers.delete(userId);
  } else {
    selectedUsers.add(userId);
  }
  updateUserListSelection();
}

// Update user list selection display
function updateUserListSelection() {
  document.querySelectorAll(".user-item").forEach((item) => {
    const userId = item.getAttribute("data-user-id");
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = selectedUsers.has(userId);
      if (selectedUsers.has(userId)) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    }
  });
}

// Save file permissions
async function saveFilePermissions() {
  if (!selectedFileId) {
    showMessage("Vui lòng chọn tệp tin trước", "error");
    return;
  }

  try {
    const response = await fetch(
      `/fileApprovalControl/${selectedFileId}/permissions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          viewableBy: Array.from(selectedUsers),
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      showMessage("Đã cập nhật quyền truy cập thành công", "success");
      loadApprovedFiles(); // Refresh the list
    } else {
      showMessage("Lỗi khi cập nhật quyền truy cập: " + result.error, "error");
    }
  } catch (error) {
    console.error("Error saving permissions:", error);
    showMessage("Lỗi khi lưu quyền truy cập", "error");
  }
}

// Clear all permissions for current file
async function clearFilePermissions() {
  if (!selectedFileId) {
    showMessage("Vui lòng chọn tệp tin trước", "error");
    return;
  }

  try {
    const response = await fetch(
      `/fileApprovalControl/${selectedFileId}/permissions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          viewableBy: [],
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      showMessage("Đã xóa tất cả quyền truy cập", "success");
      selectedUsers.clear();
      updateUserListSelection();
      loadApprovedFiles(); // Refresh the list
    } else {
      showMessage("Lỗi khi xóa quyền truy cập: " + result.error, "error");
    }
  } catch (error) {
    console.error("Error clearing permissions:", error);
    showMessage("Lỗi khi xóa quyền truy cập", "error");
  }
}

// Close permission management
function closePermissionManagement() {
  document.getElementById("permissionManagement").style.display = "none";
  selectedFileId = null;
  selectedUsers.clear();
}

// Clear approved files filters
function clearApprovedFilters() {
  document.getElementById("approvedCategoryFilter").value = "all";
  document.getElementById("approvedYearFilter").value = "";
  document.getElementById("approvedMonthFilter").value = "";
  loadApprovedFiles();
}

// Handle year change in approved files filter
function onApprovedYearChange(year) {
  console.log("Year changed to:", year);
}

// Load statistics
async function loadStatistics() {
  try {
    const response = await fetch("/fileApprovalControl/categories/stats");
    const categories = await response.json();

    const statsSection = document.getElementById("statsSection");
    statsSection.innerHTML = "";

    categories.forEach((cat) => {
      const statCard = document.createElement("div");
      statCard.className = "stat-card";
      statCard.innerHTML = `
                                <h3>${cat._id}</h3>
                                <div class="count">${cat.total}</div>
                                <div class="sub-counts">
                                    Đang chờ: ${cat.pending} | Đã duyệt: ${cat.approved} | Từ chối: ${cat.rejected}
                                </div>
                            `;
      statsSection.appendChild(statCard);
    });
  } catch (error) {
    console.error("Error loading statistics:", error);
  }
}

// Upload form handler
async function handleFileUpload() {
  if (fileInput.files.length === 0) {
    return;
  }

  const category = document.getElementById("categorySelect").value;
  const year = document.getElementById("yearInput").value;

  if (!category) {
    showMessage("Vui lòng chọn danh mục cho file.", "error");
    return;
  }

  if (!year) {
    showMessage("Vui lòng nhập năm cho file.", "error");
    return;
  }

  if (year < 0) {
    showMessage("Năm phải là số dương.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("category", category);
  formData.append("year", year);

  // Add month if provided
  const month = document.getElementById("monthSelect").value;
  if (month) {
    formData.append("month", month);
  }

  // Add category-specific data
  if (category === "Công ty") {
    formData.append(
      "companySubcategory",
      document.getElementById("companySubcategorySelect").value
    );
    formData.append(
      "documentSubtype",
      document.getElementById("documentSubtypeSelect").value
    );
    formData.append(
      "department",
      document.getElementById("departmentInput").value
    );
    formData.append(
      "employeeName",
      document.getElementById("employeeNameInput").value
    );
    formData.append(
      "assetType",
      document.getElementById("assetTypeSelect").value
    );
    formData.append(
      "assetName",
      document.getElementById("assetNameInput").value
    );
  } else if (category === "Đối tác") {
    formData.append(
      "partnerName",
      document.getElementById("partnerNameInput").value
    );
    formData.append(
      "contractType",
      document.getElementById("contractTypeSelect").value
    );
    formData.append(
      "contractNumber",
      document.getElementById("contractNumberInput").value
    );
    formData.append(
      "documentType",
      document.getElementById("documentTypeSelect").value
    );
  } else if (category === "Ngân hàng") {
    formData.append("bankName", document.getElementById("bankNameInput").value);
    formData.append(
      "documentType",
      document.getElementById("bankDocumentTypeSelect").value
    );
  } else if (category === "Pháp lý") {
    formData.append(
      "legalDocumentType",
      document.getElementById("legalDocumentTypeSelect").value
    );
  }

  showMessage("Đang tải lên tệp tin...", "info");

  try {
    const response = await fetch("/fileApprovalControl/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showMessage(
        `Tệp tin đã được tải lên thành công vào danh mục ${category}!`,
        "success"
      );
      if (result.shareUrl) {
        showMessage(
          `<a href="${result.shareUrl}" target="_blank" class="fa-btn fa-btn-view">Xem Tệp Tin Đã Tải Lên</a>`,
          "success"
        );
      }
      // Reset form
      fileInput.value = "";
      document.getElementById("categorySelect").value = "";
      document.getElementById("yearInput").value = "";
      document.getElementById("monthSelect").value = "";
      setCurrentYear();
      updateFormFields();

      loadPendingFiles();
      loadApprovedFiles();
      loadStatistics();
    } else {
      showMessage("Tải lên thất bại: " + result.error, "error");
    }
  } catch (error) {
    showMessage("Tải lên thất bại: " + error.message, "error");
  }
}

// Load pending files
async function loadPendingFiles() {
  try {
    const categoryFilter = document.getElementById(
      "pendingCategoryFilter"
    ).value;
    let url = "/fileApprovalControl/pending";

    if (categoryFilter !== "all") {
      url = `/fileApprovalControl/pending?category=${categoryFilter}`;
    }

    const response = await fetch(url);
    const files = await response.json();

    const filesList = document.getElementById("pendingFilesList");
    filesList.innerHTML = "";

    if (files.length === 0) {
      filesList.innerHTML =
        '<p style="text-align: center; color: #666;">Không có tệp tin nào đang chờ duyệt</p>';
      return;
    }

    files.forEach((file) => {
      const fileElement = document.createElement("div");
      fileElement.className = "file-item";
      const categoryClass = getCategoryClass(file.category);

      let details = `
                                <span class="category-badge ${categoryClass}">${
        file.category
      }</span>
                                <span class="time-badge">${file.year}${
        file.month ? "/" + monthNames[file.month] : ""
      }</span>
                                Kích thước: ${formatFileSize(file.fileSize)} | 
                                Thời gian tải lên: ${new Date(
                                  file.uploadedAt
                                ).toLocaleString()} |
                                Người tải lên: ${file.uploadedBy || "Ẩn danh"}
                            `;

      // Add subcategory details
      if (file.companySubcategory) {
        details += `<br>Loại: ${file.companySubcategory}`;
        if (file.documentSubtype) details += ` → ${file.documentSubtype}`;
        if (file.department) details += ` → ${file.department}`;
        if (file.employeeName) details += ` → ${file.employeeName}`;
      } else if (file.partnerName) {
        details += `<br>Đối tác: ${file.partnerName}`;
        if (file.contractType) details += ` → ${file.contractType}`;
        if (file.contractNumber) details += ` → ${file.contractNumber}`;
      } else if (file.bankName) {
        details += `<br>Ngân hàng: ${file.bankName}`;
      } else if (file.legalDocumentType) {
        details += `<br>Loại tài liệu: ${file.legalDocumentType}`;
      }

      fileElement.innerHTML = `
                                <div class="file-info">
                                    <div class="file-name">${
                                      file.originalName
                                    }</div>
                                    <div class="file-details">
                                        ${details}
                                        ${
                                          file.shareUrl
                                            ? `<a href="${file.shareUrl}" target="_blank" class="fa-btn fa-btn-view" style="margin-top: 5px;">Xem tệp tin</a>`
                                            : ""
                                        }
                                    </div>
                                </div>
                                <div class="file-actions">
                                    <button class="fa-btn fa-btn-approve" onclick="approveFile('${
                                      file._id
                                    }')">Phê Duyệt</button>
                                    <button class="fa-btn fa-btn-reject" onclick="rejectFile('${
                                      file._id
                                    }')">Từ Chối</button>
                                </div>
                            `;
      filesList.appendChild(fileElement);
    });
  } catch (error) {
    console.error("Lỗi khi tải file chờ duyệt:", error);
    showMessage("Lỗi khi tải file chờ duyệt: " + error.message, "error");
  }
}

// Approve file
async function approveFile(fileId) {
  if (
    !confirm(
      "Bạn có chắc chắn muốn phê duyệt tệp tin này? Tệp tin sẽ được chuyển đến thư mục Đã phê duyệt."
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/fileApprovalControl/${fileId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      showMessage(
        `Tệp tin đã được phê duyệt và chuyển đến thư mục ${result.file.category}!`,
        "success"
      );
      loadPendingFiles();
      loadApprovedFiles();
      loadStatistics();
    } else {
      showMessage("Phê duyệt thất bại: " + result.error, "error");
    }
  } catch (error) {
    showMessage("Phê duyệt thất bại: " + error.message, "error");
  }
}

// Reject file
async function rejectFile(fileId) {
  if (
    !confirm(
      "Bạn có chắc chắn muốn từ chối tệp tin này? Tệp tin sẽ bị xóa vĩnh viễn."
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/fileApprovalControl/${fileId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      showMessage("Tệp tin đã bị từ chối và xóa.", "success");
      loadPendingFiles();
      loadStatistics();
    } else {
      showMessage("Từ chối thất bại: " + result.error, "error");
    }
  } catch (error) {
    showMessage("Từ chối thất bại: " + error.message, "error");
  }
}

// Utility functions
function showMessage(message, type) {
  const messageDiv = document.getElementById("uploadMessage");
  messageDiv.innerHTML = message;
  messageDiv.className = type;
  setTimeout(() => {
    messageDiv.innerHTML = "";
    messageDiv.className = "";
  }, 10000);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getCategoryClass(category) {
  const classMap = {
    "Công ty": "category-congty",
    "Đối tác": "category-doitac",
    "Ngân hàng": "category-nganhang",
    "Pháp lý": "category-phaply",
  };
  return classMap[category] || "";
}

// Load all data on page load
document.addEventListener("DOMContentLoaded", function () {
  // Set current year as default
  setCurrentYear();

  loadStatistics();
  loadPendingFiles();
  loadApprovedFiles();
});
