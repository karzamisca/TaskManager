// views\messagePages\messageMain.js
let currentRoomId = null;
let rooms = [];
let users = {
  create: {
    available: [],
    selected: [],
  },
  add: {
    available: [],
    selected: [],
  },
};
let selectedFiles = [];

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  fetchRooms();
  setupMessageForm();
});

// Add file upload handling
document.getElementById("file-upload").addEventListener("change", function (e) {
  const files = Array.from(e.target.files);
  selectedFiles = [...selectedFiles, ...files];
  displaySelectedFiles();
});

function displaySelectedFiles() {
  const fileList = document.getElementById("file-list");
  fileList.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
    <span>${file.name}</span>
    <span class="remove-file" onclick="removeFile(${index})">×</span>
  `;
    fileList.appendChild(fileItem);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  displaySelectedFiles();
}

// Fetch and display rooms
function fetchRooms() {
  return fetch("/rooms")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      rooms = data;
      displayRooms();
      return data; // Return the data for promise chaining
    })
    .catch((err) => {
      console.error("Error fetching rooms:", err);
      showError("Error fetching rooms. Please try again.");
      throw err; // Re-throw to handle in the calling function
    });
}
function displayRooms() {
  const roomList = document.getElementById("room-list");
  roomList.innerHTML = "";

  rooms.forEach((room) => {
    const roomCard = document.createElement("div");
    roomCard.className = "room-card";

    roomCard.innerHTML = `
    <div class="room-header">
      <strong>${room.name}</strong>
      <div>
        <span>${room.members.length} members</span>
        <button class="btn btn-secondary" 
                onclick="event.stopPropagation(); showAddMembersModal('${room._id}')">
          Quản lý/Manage
        </button>
      </div>
    </div>
    <small>Created by: ${room.creator.username}</small>
  `;

    roomCard.addEventListener("click", () => openRoom(room._id, room.name));
    roomList.appendChild(roomCard);
  });
}

// Room management
function openRoom(roomId, roomName) {
  currentRoomId = roomId;
  document.getElementById("rooms-view").style.display = "none";
  document.getElementById("room-messages-view").style.display = "block";
  document.getElementById("current-room-name").textContent = roomName;
  fetchMessages(roomId);
}

function showRoomList() {
  currentRoomId = null;
  document.getElementById("rooms-view").style.display = "block";
  document.getElementById("room-messages-view").style.display = "none";
}

// Messages
function fetchMessages(roomId) {
  fetch(`/room/${roomId}/messages`)
    .then((response) => response.json())
    .then((messages) => displayMessages(messages))
    .catch((err) => console.error("Error fetching messages:", err));
}

function displayMessages(messages) {
  const messageList = document.getElementById("room-messages");
  messageList.innerHTML = "";

  messages.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";

    let attachmentsHTML = "";
    if (message.attachments && message.attachments.length > 0) {
      attachmentsHTML = `
  <div class="attachments">
    ${message.attachments
      .map(
        (attachment) => `
      <a href="${attachment.webViewLink}" target="_blank" class="attachment-link">
        📎 ${attachment.fileName}
      </a>
    `
      )
      .join("")}
  </div>
`;
    }

    messageDiv.innerHTML = `
<strong>${message.user.username}</strong>
<small>${new Date(message.createdAt).toLocaleString()}</small>
<p>${message.content}</p>
${attachmentsHTML}
`;

    messageList.appendChild(messageDiv);
  });

  // Scroll to bottom of messages
  messageList.scrollTop = messageList.scrollHeight;
}

function setupMessageForm() {
  document.getElementById("message-form").onsubmit = function (e) {
    e.preventDefault();
    const content = this.querySelector("textarea").value;

    if (content.trim() && currentRoomId) {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("roomId", currentRoomId);

      // Append files if any
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      fetch("/room/message", {
        method: "POST",
        body: formData, // Don't set Content-Type header, let browser handle it
      })
        .then((response) => response.json())
        .then(() => {
          this.querySelector("textarea").value = "";
          selectedFiles = [];
          displaySelectedFiles();
          fetchMessages(currentRoomId);
        })
        .catch((err) => console.error("Error sending message:", err));
    }
  };
}

// Modal Management
function showCreateRoomModal() {
  document.getElementById("create-room-modal").style.display = "block";
  fetchUsersForModal("create");
}

function hideCreateRoomModal() {
  document.getElementById("create-room-modal").style.display = "none";
  resetModalState("create");
}

function showAddMembersModal(roomId) {
  currentRoomId = roomId;
  document.getElementById("add-members-modal").style.display = "block";
  fetchUsersForModal("add");
}

function hideAddMembersModal() {
  document.getElementById("add-members-modal").style.display = "none";
  resetModalState("add");
}

function resetModalState(modalType) {
  users[modalType] = {
    available: [],
    selected: [],
  };
  updateMemberLists(modalType);
  updateMemberCounts(modalType);
}

// User Management
function fetchUsersForModal(modalType) {
  fetch("/users")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then((allUsers) => {
      if (modalType === "add") {
        // Find the current room from our rooms array
        const currentRoom = rooms.find((room) => room._id === currentRoomId);
        if (!currentRoom) {
          throw new Error("Room not found");
        }

        // Get the IDs of current room members
        const memberIds = new Set(currentRoom.members.map((m) => m._id));

        // Filter available users to exclude current members
        users[modalType].available = allUsers.filter(
          (u) => !memberIds.has(u._id)
        );
        users[modalType].selected = [];

        // Display current members list
        displayCurrentMembers(currentRoom);
      } else {
        // For create modal, all users are available
        users[modalType].available = allUsers;
        users[modalType].selected = [];
      }

      updateMemberLists(modalType);
      updateMemberCounts(modalType);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      alert("Error loading users. Please try again.");
    });
}

function displayCurrentMembers(room) {
  const currentMembersDiv = document.getElementById("current-members-list");
  if (!currentMembersDiv) {
    // Create the current members section if it doesn't exist
    const modalContent = document.querySelector(
      "#add-members-modal .modal-content"
    );
    const actionsDiv = modalContent.querySelector(".modal-actions");

    const currentMembersSection = document.createElement("div");
    currentMembersSection.className = "current-members-section";
    currentMembersSection.innerHTML = `
      <h3 style="margin: 20px 0 10px;">Current Members</h3>
      <div id="current-members-list" class="members-list"></div>
    `;

    modalContent.insertBefore(currentMembersSection, actionsDiv);
  }

  const membersList = document.getElementById("current-members-list");
  membersList.innerHTML = "";

  room.members.forEach((member) => {
    const memberDiv = document.createElement("div");
    memberDiv.className = "member-item";

    // Don't show remove button for room creator
    const isCreator = member._id === room.creator._id;

    memberDiv.innerHTML = `
      <span>${member.username}
  ${isCreator ? '<span class="creator-badge">Người tạo phòng</span>' : ""}
    </span>
    ${
      !isCreator
        ? `
      <button class="btn btn-secondary" onclick="removeMember('${member._id}')">
        Remove
      </button>
    `
        : ""
    }
  `;

    membersList.appendChild(memberDiv);
  });
}

function removeMember(memberId) {
  if (!confirm("Are you sure you want to remove this member from the room?")) {
    return;
  }

  fetch("/room/members/remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomId: currentRoomId,
      memberId: memberId,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(() => {
      return fetchRooms();
    })
    .then(() => {
      const currentRoom = rooms.find((room) => room._id === currentRoomId);
      if (currentRoom) {
        displayCurrentMembers(currentRoom);
        // Refresh the available users list
        return fetch("/users");
      }
    })
    .then((response) => {
      if (response && response.ok) {
        return response.json();
      }
    })
    .then((allUsers) => {
      if (allUsers) {
        const currentRoom = rooms.find((room) => room._id === currentRoomId);
        if (currentRoom) {
          // Update the available users list excluding current members
          const memberIds = new Set(currentRoom.members.map((m) => m._id));
          users.add.available = allUsers.filter((u) => !memberIds.has(u._id));
          // Refresh the display
          updateMemberLists("add");
          updateMemberCounts("add");
        }
      }
    })
    .catch((err) => {
      console.error("Error removing member:", err);
      alert("Error removing member from room. Please try again.");
    });
}

function filterAvailableUsers(query, modalType) {
  const filteredUsers = users[modalType].available.filter((user) =>
    user.username.toLowerCase().includes(query.toLowerCase())
  );
  displayUserList(
    `${modalType}-available-users`,
    filteredUsers,
    modalType,
    "available"
  );
}

function filterSelectedUsers(query, modalType) {
  const filteredUsers = users[modalType].selected.filter((user) =>
    user.username.toLowerCase().includes(query.toLowerCase())
  );
  displayUserList(
    `${modalType}-selected-users`,
    filteredUsers,
    modalType,
    "selected"
  );
}

function displayUserList(containerId, userList, modalType, listType) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  userList.forEach((user) => {
    const div = document.createElement("div");
    div.textContent = `${user.username}`;
    div.onclick = () => toggleUserSelection(div, user, modalType, listType);
    container.appendChild(div);
  });
}

function toggleUserSelection(element, user, modalType, listType) {
  element.classList.toggle("selected");
}

function transferMembers(modalType, direction) {
  const sourceList = direction === "right" ? "available" : "selected";
  const targetList = direction === "right" ? "selected" : "available";
  const sourceContainer = document.getElementById(
    `${modalType}-${sourceList}-users`
  );
  const selectedElements = sourceContainer.querySelectorAll(".selected");

  selectedElements.forEach((element) => {
    const user = users[modalType][sourceList].find(
      (u) => element.textContent === `${u.username}`
    );

    if (user) {
      users[modalType][sourceList] = users[modalType][sourceList].filter(
        (u) => u._id !== user._id
      );
      users[modalType][targetList].push(user);
    }
  });

  updateMemberLists(modalType);
  updateMemberCounts(modalType);
}

function updateMemberLists(modalType) {
  displayUserList(
    `${modalType}-available-users`,
    users[modalType].available,
    modalType,
    "available"
  );
  displayUserList(
    `${modalType}-selected-users`,
    users[modalType].selected,
    modalType,
    "selected"
  );
}

function updateMemberCounts(modalType) {
  document.getElementById(`${modalType}-available-count`).textContent =
    users[modalType].available.length;
  document.getElementById(`${modalType}-selected-count`).textContent =
    users[modalType].selected.length;
}

// Form Submissions
document.getElementById("create-room-form").onsubmit = function (e) {
  e.preventDefault();
  const name = this.querySelector('input[type="text"]').value;
  const memberIds = users.create.selected.map((user) => user._id);

  fetch("/room/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name,
      memberIds: memberIds,
    }),
  })
    .then((response) => response.json())
    .then(() => {
      hideCreateRoomModal();
      fetchRooms();
      this.reset();
    })
    .catch((err) => console.error("Error creating room:", err));
};

function saveNewMembers() {
  if (!currentRoomId || !users.add.selected.length) {
    alert("Please select members to add to the room");
    return;
  }

  const memberIds = users.add.selected.map((user) => user._id);

  fetch("/room/members/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomId: currentRoomId,
      memberIds: memberIds,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(() => {
      // Refresh the rooms data and update all displays
      fetchRooms().then(() => {
        const currentRoom = rooms.find((room) => room._id === currentRoomId);
        if (currentRoom) {
          displayCurrentMembers(currentRoom);
        }
      });
      users.add.selected = [];
      updateMemberLists("add");
      updateMemberCounts("add");
    })
    .catch((err) => {
      console.error("Error adding members:", err);
      alert("Error adding members to room. Please try again.");
    });
}

function deleteRoom() {
  if (!currentRoomId) return;

  if (
    confirm(
      "Are you sure you want to delete this room? This action cannot be undone."
    )
  ) {
    fetch(`/room/${currentRoomId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(() => {
        hideAddMembersModal();
        showRoomList();
        fetchRooms();
      })
      .catch((err) => {
        console.error("Error deleting room:", err);
        alert("Error deleting room. Please try again.");
      });
  }
}

function showError(message) {
  alert(message);
}

// Handle modal backdrop clicks
window.onclick = function (event) {
  if (event.target.className === "modal") {
    if (event.target.id === "create-room-modal") {
      hideCreateRoomModal();
    } else if (event.target.id === "add-members-modal") {
      hideAddMembersModal();
    }
  }
};
