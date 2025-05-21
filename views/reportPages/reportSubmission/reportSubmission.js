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

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  // Set current date and inspector name
  const now = new Date();
  document.getElementById(
    "dailyDate"
  ).textContent = `Ngày, giờ hiện tại: ${now.getHours()}h${now.getMinutes()}, ngày ${now.getDate()} tháng ${
    now.getMonth() + 1
  } năm ${now.getFullYear()}`;
  document.getElementById(
    "weeklyDate"
  ).textContent = `Ngày, giờ hiện tại: ${now.getHours()}h${now.getMinutes()}, ngày ${now.getDate()} tháng ${
    now.getMonth() + 1
  } năm ${now.getFullYear()}`;

  // Get inspector name from cookies
  getInspectorInfo();

  // Populate tasks
  populateTasks("dailyTasks", dailyTasks);
  populateTasks("weeklyTasks", weeklyTasks);

  // Set up report type toggle
  document.getElementById("reportType").addEventListener("change", function () {
    const type = this.value;
    document.getElementById("dailyReport").style.display =
      type === "daily" ? "block" : "none";
    document.getElementById("weeklyReport").style.display =
      type === "weekly" ? "block" : "none";
  });

  // Submit report
  document
    .getElementById("submitReport")
    .addEventListener("click", submitReport);
});

async function getInspectorInfo() {
  try {
    const response = await fetch("/api/users/me", {
      credentials: "include", // Include cookies
    });

    if (response.ok) {
      const user = await response.json();
      document.getElementById("inspectorName").textContent = user.username;
    } else {
      console.error("Failed to fetch user info");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

function populateTasks(elementId, tasks) {
  const tbody = document.getElementById(elementId);
  tbody.innerHTML = "";

  tasks.forEach((task) => {
    const row = document.createElement("tr");

    const taskCell = document.createElement("td");
    taskCell.textContent = task;
    row.appendChild(taskCell);

    // Yes column
    const yesCell = document.createElement("td");
    const yesInput = document.createElement("input");
    yesInput.type = "radio";
    yesInput.name = `task_${task}`;
    yesInput.value = "yes";
    yesCell.appendChild(yesInput);
    row.appendChild(yesCell);

    const yesNotesCell = document.createElement("td");
    const yesNotesInput = document.createElement("input");
    yesNotesInput.type = "text";
    yesNotesInput.dataset.task = task;
    yesNotesInput.dataset.status = "yes";
    yesNotesCell.appendChild(yesNotesInput);
    row.appendChild(yesNotesCell);

    // No column
    const noCell = document.createElement("td");
    const noInput = document.createElement("input");
    noInput.type = "radio";
    noInput.name = `task_${task}`;
    noInput.value = "no";
    noCell.appendChild(noInput);
    row.appendChild(noCell);

    const noNotesCell = document.createElement("td");
    const noNotesInput = document.createElement("input");
    noNotesInput.type = "text";
    noNotesInput.dataset.task = task;
    noNotesInput.dataset.status = "no";
    noNotesCell.appendChild(noNotesInput);
    row.appendChild(noNotesCell);

    tbody.appendChild(row);
  });
}

async function submitReport() {
  const reportType = document.getElementById("reportType").value;
  const inspectionTime = document.getElementById("inspectionTime").value;

  if (!inspectionTime) {
    alert("Vui lòng nhập giờ kiểm tra");
    return;
  }

  // Collect task data
  const items = [];
  const taskElements = document.querySelectorAll(
    `#${reportType}Tasks input[type="text"]`
  );

  taskElements.forEach((input) => {
    const task = input.dataset.task;
    const status = input.dataset.status;
    const radio = document.querySelector(
      `input[name="task_${task}"][value="${status}"]`
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
    alert("Vui lòng chọn ít nhất một công việc");
    return;
  }

  try {
    const response = await fetch("/reportSubmission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
      body: JSON.stringify({
        reportType,
        inspectionTime,
        items,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Báo cáo đã được gửi thành công!");
      // Reset form
      document
        .querySelectorAll('input[type="radio"]')
        .forEach((radio) => (radio.checked = false));
      document
        .querySelectorAll('input[type="text"]')
        .forEach((input) => (input.value = ""));
    } else {
      throw new Error(data.error || "Lỗi khi gửi báo cáo");
    }
  } catch (error) {
    alert(error.message);
    console.error("Error:", error);
  }
}
