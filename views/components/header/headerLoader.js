// views/components/header/headerLoader.js
function loadHeader() {
  // Check if header is already loaded
  if (document.querySelector(".dashboard-header")) {
    return;
  }

  // Create a new XMLHttpRequest object
  const xhr = new XMLHttpRequest();

  // Configure it to GET the header.html file
  xhr.open("GET", "/components/header/header.html", true);

  // Set up the callback function when the request completes
  xhr.onload = function () {
    if (this.status >= 200 && this.status < 300) {
      // Insert the header HTML at the beginning of the body
      document.body.insertAdjacentHTML("afterbegin", this.response);
    } else {
      console.error("Failed to load header:", this.statusText);
    }
  };

  // Set up error handling
  xhr.onerror = function () {
    console.error("Error loading header");
  };

  // Send the request
  xhr.send();
}

// Load the header when the script is executed
loadHeader();
