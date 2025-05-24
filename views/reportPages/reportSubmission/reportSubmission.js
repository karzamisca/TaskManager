////views/reportPages/reportSubmission/reportSubmission.js
const dailyTasks = [
  "Oring đầu đực, cái có bị đứt hoặc trật khỏi rãnh không?",
  "Có bị kẹt vòng bi lúc xoay không?",
  "Chỉ số đồng hồ trợ nạp và đồng hồ bơm có giống nhau không?",
  "Các chỉ số đồng hồ có vận tốc đo giống nhau không?",
  "Lúc vận hành áp suất cấp 1 và cấp 2 có giữ được ổn định không?",
  "Điện trở đốt có bật tắt theo yêu cầu không?",
  "Nhiệt độ nước có nằm trong khoảng 55-75 độ không?",
  "Nhiệt độ khí có nằm trong khoảng 10-40 độ không?",
];

const weeklyTasks = [
  "Toàn hệ thống có điểm nào bị xỉ không? (Thử xì)",
  "Xả dầu lọc thấp áp, cao áp theo đời dầu có cặn bẩn không?",
  "Van 1 chiều, van tay có bị lòn khí hay không?",
  "Đồng hồ trụ nạp còn dầu hay không, kim có gãy không?",
  "Các dây lấy tính hiệu nhiệt độ, áp suất, xung của ĐHLL có bị đứt gãy, chạm chập, vô nước mưa không?",
];

let currentReportType = "daily";

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  initializePage();
  setupEventListeners();
  updateProgress();
});

function initializePage() {
  // Set current date and time
  const now = new Date();
  const dateTimeString = `${now.getHours().toString().padStart(2, "0")}h${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}, ngày ${now.getDate()} tháng ${
    now.getMonth() + 1
  } năm ${now.getFullYear()}`;

  document.getElementById(
    "dailyDate"
  ).textContent = `Ngày, giờ hiện tại: ${dateTimeString}`;
  document.getElementById(
    "weeklyDate"
  ).textContent = `Ngày, giờ hiện tại: ${dateTimeString}`;

  // Set default inspection time to current time
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  document.getElementById("inspectionTime").value = currentTime;

  // Get inspector info and populate tasks
  populateTasks("dailyTasks", dailyTasks);
  populateTasks("weeklyTasks", weeklyTasks);
}

function setupEventListeners() {
  // Report type toggle
  document.querySelectorAll(".toggle-option").forEach((option) => {
    option.addEventListener("click", function () {
      const type = this.dataset.type;
      switchReportType(type);
    });
  });

  // Submit report
  document
    .getElementById("submitReport")
    .addEventListener("click", submitReport);

  // Progress tracking
  document.addEventListener("change", updateProgress);
}

function switchReportType(type) {
  currentReportType = type;
  document.getElementById("reportType").value = type;

  // Update toggle appearance
  document.querySelectorAll(".toggle-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.type === type);
  });

  // Show/hide report forms
  document
    .getElementById("dailyReport")
    .classList.toggle("active", type === "daily");
  document
    .getElementById("weeklyReport")
    .classList.toggle("active", type === "weekly");

  updateProgress();
}

function updateProgress() {
  const totalTasks =
    currentReportType === "daily" ? dailyTasks.length : weeklyTasks.length;
  const completedTasks = document.querySelectorAll(
    `#${currentReportType}Tasks input[type="radio"]:checked`
  ).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  document.getElementById("progressBar").style.width = `${progress}%`;
}

function populateTasks(elementId, tasks) {
  const tbody = document.getElementById(elementId);
  tbody.innerHTML = "";

  tasks.forEach((task, index) => {
    const row = document.createElement("tr");

    // Task cell
    const taskCell = document.createElement("td");
    taskCell.className = "task-cell";
    taskCell.textContent = `${index + 1}. ${task}`;
    row.appendChild(taskCell);

    // Yes radio cell
    const yesCell = document.createElement("td");
    yesCell.className = "radio-cell";
    const yesInput = document.createElement("input");
    yesInput.type = "radio";
    yesInput.className = "radio-input";
    yesInput.name = `task_${index}_${elementId}`;
    yesInput.value = "yes";
    yesCell.appendChild(yesInput);
    row.appendChild(yesCell);

    // Yes notes cell
    const yesNotesCell = document.createElement("td");
    yesNotesCell.className = "notes-cell";
    const yesNotesInput = document.createElement("input");
    yesNotesInput.type = "text";
    yesNotesInput.className = "notes-input";
    yesNotesInput.placeholder = "Ghi chú...";
    yesNotesInput.dataset.task = task;
    yesNotesInput.dataset.status = "yes";
    yesNotesCell.appendChild(yesNotesInput);
    row.appendChild(yesNotesCell);

    // No radio cell
    const noCell = document.createElement("td");
    noCell.className = "radio-cell";
    const noInput = document.createElement("input");
    noInput.type = "radio";
    noInput.className = "radio-input";
    noInput.name = `task_${index}_${elementId}`;
    noInput.value = "no";
    noCell.appendChild(noInput);
    row.appendChild(noCell);

    // No notes cell
    const noNotesCell = document.createElement("td");
    noNotesCell.className = "notes-cell";
    const noNotesInput = document.createElement("input");
    noNotesInput.type = "text";
    noNotesInput.className = "notes-input";
    noNotesInput.placeholder = "Ghi chú...";
    noNotesInput.dataset.task = task;
    noNotesInput.dataset.status = "no";
    noNotesCell.appendChild(noNotesInput);
    row.appendChild(noNotesCell);

    tbody.appendChild(row);
  });
}

function showAlert(message, type = "success") {
  const alertBox = document.getElementById("alertBox");
  alertBox.textContent = message;
  alertBox.className = `alert ${type} show`;

  setTimeout(() => {
    alertBox.classList.remove("show");
  }, 5000);
}

function setLoading(loading) {
  const button = document.getElementById("submitReport");
  const spinner = document.getElementById("loadingSpinner");
  const text = document.getElementById("submitText");

  if (loading) {
    button.disabled = true;
    spinner.style.display = "block";
    text.textContent = "Đang gửi...";
  } else {
    button.disabled = false;
    spinner.style.display = "none";
    text.textContent = "📤 Gửi báo cáo / Submit Report";
  }
}

async function submitReport() {
  const inspectionTime = document.getElementById("inspectionTime").value;

  if (!inspectionTime) {
    showAlert("Vui lòng nhập giờ kiểm tra", "error");
    return;
  }

  // Collect task data
  const items = [];
  const taskElements = document.querySelectorAll(
    `#${currentReportType}Tasks input[type="text"]`
  );

  taskElements.forEach((input) => {
    const task = input.dataset.task;
    const status = input.dataset.status;
    const radioName = input
      .closest("tr")
      .querySelector('input[type="radio"]').name;
    const radio = document.querySelector(
      `input[name="${radioName}"][value="${status}"]`
    );

    if (radio && radio.checked) {
      items.push({
        task,
        status: status === "yes",
        notes: input.value,
      });
    }
  });

  if (items.length === 0) {
    showAlert("Vui lòng chọn ít nhất một công việc", "error");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/reportSubmission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        reportType: currentReportType,
        inspectionTime,
        items,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showAlert("Báo cáo đã được gửi thành công!", "success");
      // Reset form
      document
        .querySelectorAll('input[type="radio"]')
        .forEach((radio) => (radio.checked = false));
      document
        .querySelectorAll('input[type="text"]')
        .forEach((input) => (input.value = ""));
      updateProgress();
    } else {
      throw new Error(data.error || "Lỗi khi gửi báo cáo");
    }
  } catch (error) {
    showAlert(error.message, "error");
    console.error("Error:", error);
  } finally {
    setLoading(false);
  }
}
