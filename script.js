
"use strict";

/* =========================================
   RIDO TAXI - TAXI BOOKING MANAGEMENT SYSTEM
   ========================================= */

/* ---------- STORAGE ---------- */

const STORAGE_KEYS = {
  drivers: "rido_taxi_drivers",
  vehicles: "rido_taxi_vehicles",
  bookings: "rido_taxi_bookings"
};

function loadData(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Storage read error:", error);
    return [];
  }
}

let drivers = loadData(STORAGE_KEYS.drivers);
let vehicles = loadData(STORAGE_KEYS.vehicles);
let bookings = loadData(STORAGE_KEYS.bookings);

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEYS.drivers, JSON.stringify(drivers));
    localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(vehicles));
    localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(bookings));
  } catch (error) {
    showToast("Unable to save data in this browser.");
    console.error("Storage save error:", error);
  }
}

/* ---------- COMMON HELPERS ---------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function money(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(date) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function nextID(prefix, list) {
  const highest = list.reduce((max, item) => {
    const number = Number(String(item.id || "").replace(prefix, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return prefix + String(highest + 1).padStart(4, "0");
}

function getDriver(driverID) {
  return drivers.find(driver => driver.id === driverID);
}

function getVehicle(vehicleID) {
  return vehicles.find(vehicle => vehicle.id === vehicleID);
}

function isDriverBusy(driverID) {
  return bookings.some(booking =>
    booking.driverID === driverID && booking.status === "Booked"
  );
}

function isVehicleBusy(vehicleID) {
  return bookings.some(booking =>
    booking.vehicleID === vehicleID && booking.status === "Booked"
  );
}

function getAvailableDrivers() {
  return drivers.filter(driver => !isDriverBusy(driver.id));
}

function getAvailableVehicles() {
  return vehicles.filter(vehicle => !isVehicleBusy(vehicle.id));
}

/* ---------- PAGE NAVIGATION ---------- */

const navLinks = document.querySelectorAll("[data-section]");
const pageSections = document.querySelectorAll(".page-section");
const sidebar = document.getElementById("sidebar");

function openSection(sectionID) {
  const target = document.getElementById(sectionID);
  if (!target || !target.classList.contains("page-section")) return;

  pageSections.forEach(section => {
    section.classList.toggle("active", section.id === sectionID);
  });

  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.section === sectionID);
  });

  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (sectionID === "booking") {
    renderVehicleOptions();
    updateFare();
    updateAllocationNotice();
  }
}

navLinks.forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    openSection(link.dataset.section);
    history.replaceState(null, "", "#" + link.dataset.section);
  });
});

document.getElementById("menuToggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

const initialSection = window.location.hash.replace("#", "");
if (initialSection && document.getElementById(initialSection)?.classList.contains("page-section")) {
  openSection(initialSection);
}

/* ---------- DRIVER REGISTRATION ---------- */

const driverForm = document.getElementById("driverForm");

driverForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("driverName").value.trim();
  const phone = document.getElementById("driverPhone").value.trim();
  const license = document.getElementById("driverLicense").value.trim().toUpperCase();

  if (!name || !phone || !license) {
    showToast("Please fill in all driver details.");
    return;
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    showToast("Enter a valid 10-digit mobile number.");
    return;
  }

  const duplicateLicense = drivers.some(driver =>
    driver.license.toUpperCase() === license
  );

  if (duplicateLicense) {
    showToast("This driving licence is already registered.");
    return;
  }

  const duplicatePhone = drivers.some(driver => driver.phone === phone);

  if (duplicatePhone) {
    showToast("This phone number is already registered.");
    return;
  }

  const driver = {
    id: nextID("D", drivers),
    name,
    phone,
    license,
    createdAt: new Date().toISOString()
  };

  drivers.push(driver);
  saveData();
  driverForm.reset();

  renderAll();
  showToast("Driver registered successfully. ID: " + driver.id);
});

function renderDrivers() {
  const table = document.getElementById("driverTable");

  document.getElementById("driverCount").textContent =
    drivers.length + (drivers.length === 1 ? " Driver" : " Drivers");

  if (drivers.length === 0) {
    table.innerHTML = `<tr><td colspan="6" class="empty-cell">No drivers registered.</td></tr>`;
    return;
  }

  table.innerHTML = drivers.map(driver => {
    const available = !isDriverBusy(driver.id);

    return `
      <tr>
        <td class="id-text">${escapeHTML(driver.id)}</td>
        <td>${escapeHTML(driver.name)}</td>
        <td>${escapeHTML(driver.phone)}</td>
        <td>${escapeHTML(driver.license)}</td>
        <td>
          <span class="status ${available ? "status-available" : "status-booked"}">
            ${available ? "Available" : "On Trip"}
          </span>
        </td>
        <td>
          <button class="action-btn delete-btn"
            data-action="delete-driver"
            data-id="${escapeHTML(driver.id)}"
            ${available ? "" : "disabled"}>
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/* ---------- VEHICLE MANAGEMENT ---------- */

const vehicleForm = document.getElementById("vehicleForm");

vehicleForm.addEventListener("submit", event => {
  event.preventDefault();

  const model = document.getElementById("vehicleModel").value.trim();
  const number = document.getElementById("vehicleNumber").value.trim().toUpperCase();
  const category = document.getElementById("vehicleCategory").value;
  const rate = Number(document.getElementById("vehicleRate").value);

  if (!model || !number || !category || !Number.isFinite(rate) || rate <= 0) {
    showToast("Please enter valid vehicle details.");
    return;
  }

  const duplicateNumber = vehicles.some(vehicle =>
    vehicle.number.toUpperCase() === number
  );

  if (duplicateNumber) {
    showToast("This vehicle number is already registered.");
    return;
  }

  const vehicle = {
    id: nextID("V", vehicles),
    model,
    number,
    category,
    rate,
    createdAt: new Date().toISOString()
  };

  vehicles.push(vehicle);
  saveData();
  vehicleForm.reset();

  renderAll();
  showToast("Vehicle added successfully. ID: " + vehicle.id);
});

function renderVehicles() {
  const table = document.getElementById("vehicleTable");

  document.getElementById("vehicleCount").textContent =
    vehicles.length + (vehicles.length === 1 ? " Vehicle" : " Vehicles");

  if (vehicles.length === 0) {
    table.innerHTML = `<tr><td colspan="7" class="empty-cell">No vehicles registered.</td></tr>`;
    return;
  }

  table.innerHTML = vehicles.map(vehicle => {
    const available = !isVehicleBusy(vehicle.id);

    return `
      <tr>
        <td class="id-text">${escapeHTML(vehicle.id)}</td>
        <td>${escapeHTML(vehicle.model)}</td>
        <td>${escapeHTML(vehicle.number)}</td>
        <td>${escapeHTML(vehicle.category)}</td>
        <td>${money(vehicle.rate)}</td>
        <td>
          <span class="status ${available ? "status-available" : "status-booked"}">
            ${available ? "Available" : "On Trip"}
          </span>
        </td>
        <td>
          <button class="action-btn delete-btn"
            data-action="delete-vehicle"
            data-id="${escapeHTML(vehicle.id)}"
            ${available ? "" : "disabled"}>
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/* ---------- DELETE DRIVER / VEHICLE ---------- */

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "delete-driver") {
    if (isDriverBusy(id)) {
      showToast("This driver is currently on a trip.");
      return;
    }

    if (!confirm("Are you sure you want to delete this driver?")) return;

    drivers = drivers.filter(driver => driver.id !== id);
    saveData();
    renderAll();
    showToast("Driver deleted successfully.");
  }

  if (action === "delete-vehicle") {
    if (isVehicleBusy(id)) {
      showToast("This vehicle is currently on a trip.");
      return;
    }

    if (!confirm("Are you sure you want to delete this vehicle?")) return;

    vehicles = vehicles.filter(vehicle => vehicle.id !== id);
    saveData();
    renderAll();
    showToast("Vehicle deleted successfully.");
  }

  if (action === "complete-booking") {
    updateBookingStatus(id, "Completed");
  }

  if (action === "cancel-booking") {
    updateBookingStatus(id, "Cancelled");
  }
});

/* ---------- VEHICLE OPTIONS IN BOOKING ---------- */

function renderVehicleOptions() {
  const select = document.getElementById("bookingVehicle");
  const previousValue = select.value;
  const availableVehicles = getAvailableVehicles();

  if (availableVehicles.length === 0) {
    select.innerHTML = `<option value="">No available vehicles</option>`;
    updateFare();
    return;
  }

  select.innerHTML = `
    <option value="">Select an available vehicle</option>
    ${availableVehicles.map(vehicle => `
      <option value="${escapeHTML(vehicle.id)}">
        ${escapeHTML(vehicle.model)} - ${escapeHTML(vehicle.category)}
        (${escapeHTML(vehicle.number)}) - ${money(vehicle.rate)}/KM
      </option>
    `).join("")}
  `;

  if (availableVehicles.some(vehicle => vehicle.id === previousValue)) {
    select.value = previousValue;
  }

  updateFare();
}

function updateAllocationNotice() {
  const notice = document.getElementById("allocationNotice");
  const availableDrivers = getAvailableDrivers().length;
  const availableVehicles = getAvailableVehicles().length;

  if (drivers.length === 0 || vehicles.length === 0) {
    notice.textContent = "Register at least one driver and one vehicle before booking.";
  } else if (availableDrivers === 0 || availableVehicles === 0) {
    notice.textContent = "No available driver or vehicle. Complete or cancel an active trip first.";
  } else {
    notice.textContent = availableDrivers + " driver(s) and " +
      availableVehicles + " vehicle(s) currently available.";
  }
}

/* =========================================
   TAMIL NADU ROAD DISTANCE CALCULATION
   Uses Nominatim + OSRM public services
   ========================================= */

let currentDistance = null;
let currentFromLocation = "";
let currentToLocation = "";
let routeReady = false;
let routeRequestRunning = false;

const fromInput = document.getElementById("fromLocation");
const toInput = document.getElementById("toLocation");
const distanceButton = document.getElementById("calculateDistanceBtn");
const distanceDisplay = document.getElementById("distanceDisplay");
const routeMessage = document.getElementById("routeMessage");
const distanceLoading = document.getElementById("distanceLoading");

const geocodeCache = new Map();

function normalizeLocation(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function invalidateRoute() {
  routeReady = false;
  currentDistance = null;
  currentFromLocation = "";
  currentToLocation = "";

  distanceDisplay.textContent = "Not calculated";
  routeMessage.textContent = "Location changed. Calculate the road distance again.";

  updateFare();
}

fromInput.addEventListener("input", invalidateRoute);
toInput.addEventListener("input", invalidateRoute);

/* Wait before making the next geocoding request. */
function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/* Find the coordinates of a place in Tamil Nadu. */
async function geocodeTamilNadu(place) {
  const cleanPlace = place.trim();
  const cacheKey = normalizeLocation(cleanPlace);

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const searchText = cleanPlace + ", Tamil Nadu, India";

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", searchText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Location search service is unavailable. Please try again later.");
  }

  const results = await response.json();

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Location not found: "' + cleanPlace + '". Try a nearby town, area or landmark.');
  }

  const result = results[0];
  const address = result.address || {};
  const stateName = String(address.state || address.state_district || "").toLowerCase();

  if (!stateName.includes("tamil nadu")) {
    throw new Error('"' + cleanPlace + '" could not be confirmed as a Tamil Nadu location. Please enter a more specific place.');
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("The location coordinates could not be found.");
  }

  const locationData = {
    latitude,
    longitude,
    displayName: result.display_name || cleanPlace
  };

  geocodeCache.set(cacheKey, locationData);
  return locationData;
}

/* Find driving distance between two coordinates. */
async function getDrivingDistance(start, end) {
  const coordinates =
    `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?overview=false&alternatives=false&steps=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("The road routing service is unavailable. Please try again.");
  }

  const data = await response.json();

  if (
    data.code !== "Ok" ||
    !Array.isArray(data.routes) ||
    data.routes.length === 0
  ) {
    throw new Error("No driving route was found between these locations.");
  }

  const distanceInMeters = Number(data.routes[0].distance);

  if (!Number.isFinite(distanceInMeters) || distanceInMeters <= 0) {
    throw new Error("Unable to calculate a valid road distance.");
  }

  return distanceInMeters / 1000;
}

/* Main distance calculation button. */
distanceButton.addEventListener("click", calculateDistance);

async function calculateDistance() {
  if (routeRequestRunning) return;

  const from = fromInput.value.trim();
  const to = toInput.value.trim();

  if (!from || !to) {
    showToast("Enter both pickup and destination locations.");
    return;
  }

  if (normalizeLocation(from) === normalizeLocation(to)) {
    showToast("Pickup and destination must be different.");
    return;
  }

  routeRequestRunning = true;
  routeReady = false;
  currentDistance = null;

  distanceButton.disabled = true;
  distanceLoading.hidden = false;
  distanceDisplay.textContent = "Calculating...";
  routeMessage.textContent = "Searching for Tamil Nadu locations...";
  updateFare();

  try {
    const start = await geocodeTamilNadu(from);

    /* Public Nominatim service requires a delay between requests. */
    await wait(1100);

    const end = await geocodeTamilNadu(to);

    routeMessage.textContent = "Finding the driving route...";

    const distance = await getDrivingDistance(start, end);

    currentDistance = Number(distance.toFixed(2));
    currentFromLocation = from;
    currentToLocation = to;
    routeReady = true;

    distanceDisplay.textContent = currentDistance.toFixed(2) + " KM";
    routeMessage.textContent = "Road distance calculated successfully.";

    updateFare();
    showToast("Road distance calculated successfully.");
  } catch (error) {
    console.error("Distance calculation error:", error);

    currentDistance = null;
    routeReady = false;
    currentFromLocation = "";
    currentToLocation = "";

    distanceDisplay.textContent = "Not available";
    routeMessage.textContent = error.message || "Unable to calculate distance.";

    updateFare();
    showToast(error.message || "Distance calculation failed.");
  } finally {
    routeRequestRunning = false;
    distanceButton.disabled = false;
    distanceLoading.hidden = true;
  }
}

function validateTaxiRoute() {
  if (!routeReady || currentDistance === null) {
    showToast("Please calculate the road distance before booking.");
    return false;
  }

  if (
    normalizeLocation(fromInput.value) !== normalizeLocation(currentFromLocation) ||
    normalizeLocation(toInput.value) !== normalizeLocation(currentToLocation)
  ) {
    invalidateRoute();
    showToast("Locations have changed. Calculate the distance again.");
    return false;
  }

  return true;
}

/* ---------- FARE CALCULATION ---------- */

const vehicleSelect = document.getElementById("bookingVehicle");
const extraChargeInput = document.getElementById("extraCharge");

vehicleSelect.addEventListener("change", updateFare);
extraChargeInput.addEventListener("input", updateFare);

function updateFare() {
  const vehicle = getVehicle(vehicleSelect.value);
  const extraCharge = Math.max(0, Number(extraChargeInput.value) || 0);

  const fareDisplay = document.getElementById("fareDisplay");
  const fareBreakdown = document.getElementById("fareBreakdown");

  if (!routeReady || currentDistance === null) {
    fareDisplay.textContent = money(0);
    fareBreakdown.textContent = "Calculate the distance and select a vehicle.";
    return;
  }

  if (!vehicle) {
    fareDisplay.textContent = money(0);
    fareBreakdown.textContent = "Select an available vehicle.";
    return;
  }

  const distanceFare = currentDistance * Number(vehicle.rate);
  const totalFare = distanceFare + extraCharge;

  fareDisplay.textContent = money(totalFare);

  fareBreakdown.textContent =
    currentDistance.toFixed(2) + " KM × " +
    money(vehicle.rate) + " + " +
    money(extraCharge) + " additional charges";
}

/* ---------- CUSTOMER BOOKING ---------- */

const bookingForm = document.getElementById("bookingForm");

bookingForm.addEventListener("submit", event => {
  event.preventDefault();

  const customerName = document.getElementById("customerName").value.trim();
  const customerPhone = document.getElementById("customerPhone").value.trim();
  const vehicleID = vehicleSelect.value;
  const extraCharge = Number(extraChargeInput.value);

  if (!customerName || !customerPhone) {
    showToast("Enter customer details.");
    return;
  }

  if (!/^[6-9]\d{9}$/.test(customerPhone)) {
