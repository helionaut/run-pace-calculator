const buildStamp = document.querySelector("[data-build-stamp]");
const statusBanner = document.querySelector("[data-status-banner]");

if (statusBanner) {
  statusBanner.dataset.ready = "true";
}

if (buildStamp) {
  buildStamp.textContent = "awaiting calculator UI";
}
