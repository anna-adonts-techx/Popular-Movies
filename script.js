document.addEventListener("DOMContentLoaded", init);

// --- Global State and Constants ---
const API_KEY = "629b38bf2d91d04d4b03567bc1645c75";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// --- State Variables ---
let currentPage = 1;
let lastAppliedSortBy = "popularity.desc"; // Default sort
let lastAppliedGenres = [];
let lastAppliedUserScore = 0;
let lastAppliedUserScoreMax = 10;
let lastAppliedMinVotes = 0;
let lastAppliedRuntime = 360;
let lastAppliedKeywords = ""; // Stores the applied keyword IDs string
let lastAppliedLanguage = "";
let lastScrollY = 0;

// NEW: Keyword State
let selectedKeywords = []; // Array to hold { id, name } objects for selected keywords
let currentKeywordTimeout = null; // For debounce

// --- DOM Elements ---
const moviesGrid = document.getElementById("movies-grid");
const loadMoreBtn = document.getElementById("load-more-btn");
const sortOptions = document.getElementById("sort-options");
const searchButton = document.getElementById("search-button");
const stickySearchBtn = document.getElementById("sticky-search");
const loadingIndicator = document.getElementById("loading-indicator");
const errorMessage = document.getElementById("error-message");
const genreCheckboxesContainer = document.getElementById("genre-checkboxes");
const filterPanel = document.getElementById("filter-panel");
// Template for movie cards
const movieCardTemplate = document.getElementById("movie-card-template");

// Filter specific elements
const languageSelect = document.getElementById("language-select");
const keywordsInput = document.getElementById("keywords-input");

// NEW Keyword DOM Elements
const keywordsContainer = document.getElementById("keywords-container");
const keywordsAutocompleteList = document.getElementById(
  "keywords-autocomplete-list"
);

// Release Dates elements
const searchAllReleasesCheckbox = document.getElementById(
  "search-all-releases"
);
const searchAllCountriesCheckbox = document.getElementById(
  "search-all-countries"
);
const countriesToggleContainer = document.getElementById(
  "countries-toggle-container"
);
const countrySelectContainer = document.getElementById(
  "country-select-container"
);
const countrySelect = document.getElementById("country-select");
const releaseTypeFilters = document.getElementById("release-type-filters");
const releaseFromInput = document.getElementById("release-from");
const releaseToInput = document.getElementById("release-to");

// Range Slider Elements
const userScoreContainer = document.getElementById(
  "user-score-slider-container"
);
const userScoreHandleStart = userScoreContainer.querySelector(
  ".k-draghandle-start"
);
const userScoreHandleEnd =
  userScoreContainer.querySelector(".k-draghandle-end");

const minVotesContainer = document.getElementById("min-votes-slider-container");
const minVotesHandleStart = minVotesContainer.querySelector(
  ".k-draghandle-start"
);
const minVotesHandleEnd = minVotesContainer.querySelector(".k-draghandle-end");

const runtimeContainer = document.getElementById("runtime-slider-container");
const runtimeHandleStart = runtimeContainer.querySelector(
  ".k-draghandle-start"
);
const runtimeHandleEnd = runtimeContainer.querySelector(".k-draghandle-end");

// --- MOBILE MENU ELEMENTS ---
const menuToggle = document.querySelector(".menu-toggle");
const mobileSidebar = document.getElementById("mobile-sidebar-menu");

// --- Unicode Flag Utility ---

/**
 * Converts a 2-letter ISO 3166-1 alpha-2 country code to a Unicode flag emoji.
 * @param {string} code
 * @returns {string} The flag emoji string.
 */
function countryCodeToEmoji(code) {
  if (!code) return "";
  const OFFSET = 127397;
  const chars = Array.from(code.toUpperCase()).map((char) =>
    String.fromCodePoint(char.codePointAt(0) + OFFSET)
  );
  return chars.join("");
}

// --- Date Format Utility ---

/**
 * Converts a YYYY-MM-DD string to M/D/YYYY display format.
 * @param {string} dateString - Date in 'YYYY-MM-DD' format.
 * @returns {string} Date in 'M/D/YYYY' format.
 */
function formatDisplayDate(dateString) {
  if (!dateString || !dateString.includes("-")) return dateString;
  const parts = dateString.split("-");
  if (parts.length === 3) {
    // Use parseInt to remove leading zeros for M/D/YYYY format
    return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
  }
  return dateString;
}

// --- Initial Setup and Event Listeners ---
function init() {
  // 1. Fetch initial data for filters
  fetchGenres();
  fetchLanguages();
  fetchCountriesAndRenderSelect();

  // 2. Setup date inputs for custom display format
  setupCustomDateInput(releaseToInput);
  setupCustomDateInput(releaseFromInput);

  // 3. Set up remaining event listeners
  loadMoreBtn.addEventListener("click", handleLoadMore);

  // Listeners for filter changes (enables/disables Search button)
  sortOptions.addEventListener("change", handleControlChange);
  languageSelect.addEventListener("change", handleControlChange);

  // Release Dates Listeners
  searchAllReleasesCheckbox.addEventListener(
    "change",
    handleReleaseToggleChange
  );
  searchAllCountriesCheckbox.addEventListener(
    "change",
    handleCountryToggleChange
  );

  // Add listeners to enable search button on filter change
  releaseTypeFilters
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", handleControlChange);
    });
  countrySelect.addEventListener("change", handleControlChange);

  // Range sliders
  setupRangeSlider(
    userScoreContainer,
    0,
    10,
    0.1,
    lastAppliedUserScore,
    lastAppliedUserScoreMax,
    handleControlChange
  );
  setupRangeSlider(
    minVotesContainer,
    0,
    500,
    1,
    lastAppliedMinVotes,
    500,
    handleControlChange,
    true
  );
  setupRangeSlider(
    runtimeContainer,
    0,
    360,
    1,
    0,
    lastAppliedRuntime,
    handleControlChange,
    false,
    true
  );

  // NEW: Keyword Search with Debounce
  keywordsInput.addEventListener("input", debounceKeywordsSearch);
  // NEW: Listen for clicks on the autocomplete list
  keywordsAutocompleteList.addEventListener("click", handleKeywordSelect);
  // NEW: Handle clearing the list and search on blur
  keywordsInput.addEventListener("blur", () => {
    // Wait a little before closing to allow time for a click on the list
    setTimeout(() => keywordsAutocompleteList.classList.remove("show"), 200);
  });

  searchButton.addEventListener("click", handleFilterSearch);
  stickySearchBtn.addEventListener("click", handleFilterSearch);

  // UI/Visibility
  window.addEventListener("scroll", handleHeaderScroll);
  window.addEventListener("scroll", handleScrollVisibility);
  window.addEventListener("resize", handleScrollVisibility);

  document.querySelectorAll(".panel h3").forEach((header) => {
    header.addEventListener("click", togglePanel);
  });

  // --- MOBILE MENU EVENT ---
  menuToggle.addEventListener("click", toggleMobileMenu);

  searchButton.disabled = true;
  handleScrollVisibility();
  handleReleaseToggleChange();
}

/**
 * Toggles the visibility of the mobile sidebar menu.
 */
function toggleMobileMenu() {
  mobileSidebar.classList.toggle("open");
  document.body.classList.toggle("menu-open");
}

/**
 * Handles the logic for custom date input formatting and picker functionality.
 * @param {HTMLInputElement} inputElement
 */
function setupCustomDateInput(inputElement) {
  // 1. Set initial value to display format
  const initialInternalValue = inputElement.value;
  inputElement.setAttribute("data-internal-value", initialInternalValue);
  inputElement.value = formatDisplayDate(initialInternalValue);
  inputElement.type = "text";

  // 2. On Focus/Click: switch to 'date' type and internal format for picker to work
  inputElement.addEventListener("focus", function () {
    this.type = "date";
    this.value = this.getAttribute("data-internal-value");
  });

  // 3. On Change (User picked a date): format for display and store internal value
  inputElement.addEventListener("change", function () {
    if (this.value) {
      this.setAttribute("data-internal-value", this.value);
      this.value = formatDisplayDate(this.value);
      this.type = "text";
    }
    handleControlChange();
  });

  // 4. On Blur: switch to 'text' type to maintain custom format display
  inputElement.addEventListener("blur", function () {
    // When blurring, ensure value is in YYYY-MM-DD format before setting the attribute
    if (this.type === "date" && this.value) {
      this.setAttribute("data-internal-value", this.value);
    }

    // Revert display to custom format (M/D/YYYY) using the internal value
    if (this.getAttribute("data-internal-value")) {
      this.value = formatDisplayDate(this.getAttribute("data-internal-value"));
    }
    this.type = "text";
    handleControlChange();
  });
}

// --- API Calls & Rendering ---

async function fetchCountriesAndRenderSelect() {
  const url = `${BASE_URL}/configuration/countries?api_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch countries");

    const countries = await response.json();
    renderCountryFilters(countries);
  } catch (error) {
    console.error("Country API Error:", error);
  }
}

/**
 * Renders country options to the country select dropdown.
 * Uses document.createElement and appendChild to avoid innerHTML.
 * @param {Array<Object>} countries
 */
function renderCountryFilters(countries) {
  // Clear the existing options without using innerHTML
  while (countrySelect.firstChild) {
    countrySelect.removeChild(countrySelect.firstChild);
  }

  countries.sort((a, b) => a.english_name.localeCompare(b.english_name));

  // Add a placeholder option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select a country";
  countrySelect.appendChild(defaultOption);

  countries.forEach((country) => {
    const option = document.createElement("option");
    const emoji = countryCodeToEmoji(country.iso_3166_1);

    option.value = country.iso_3166_1;
    option.textContent = `${emoji} ${country.english_name}`;

    if (country.iso_3166_1 === "AM") {
      option.selected = true;
    }

    countrySelect.appendChild(option);
  });
}

async function fetchGenres() {
  const url = `${BASE_URL}/genre/movie/list?api_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch genres");

    const data = await response.json();
    renderGenreFilters(data.genres);

    fetchMovies(true);
  } catch (error) {
    console.error("Genre API Error:", error);
    showStatus("error", "Failed to load filters. Check your network.");
  }
}

async function fetchLanguages() {
  const url = `${BASE_URL}/configuration/languages?api_key=${API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch languages");
    const data = await response.json();
    renderLanguageFilters(data);
  } catch (error) {
    console.error("Language API Error:", error);
  }
}

/**
 * Renders language options to the language select dropdown.
 * Uses document.createElement and appendChild to avoid innerHTML.
 * @param {Array<Object>} languages
 */
function renderLanguageFilters(languages) {
  // Clear the existing options without using innerHTML
  while (languageSelect.firstChild) {
    languageSelect.removeChild(languageSelect.firstChild);
  }

  // Add default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "None Selected";
  languageSelect.appendChild(defaultOption);

  languages.sort((a, b) => a.english_name.localeCompare(b.english_name));

  languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.iso_639_1;
    option.textContent = lang.english_name;
    languageSelect.appendChild(option);
  });
}

async function fetchMovies(isNewQuery) {
  loadingIndicator.style.display = "block";
  errorMessage.style.display = "none";
  loadMoreBtn.style.display = "none";

  const filters = getCurrentFilterState();

  let params = new URLSearchParams({
    api_key: API_KEY,
    sort_by: filters.sortBy,
    page: currentPage,
    language: "en-US",
  });

  if (lastAppliedGenres.length > 0) {
    params.append("with_genres", lastAppliedGenres.join(","));
  }

  if (lastAppliedLanguage) {
    params.append("with_original_language", lastAppliedLanguage);
  }

  if (lastAppliedUserScore > 0) {
    params.append("vote_average.gte", lastAppliedUserScore);
  }
  if (lastAppliedUserScoreMax < 10) {
    params.append("vote_average.lte", lastAppliedUserScoreMax);
  }

  if (lastAppliedMinVotes > 0) {
    params.append("vote_count.gte", lastAppliedMinVotes);
  }

  if (lastAppliedRuntime < 360) {
    params.append("with_runtime.lte", lastAppliedRuntime);
  }

  // NEW: Apply selected keywords
  if (lastAppliedKeywords) {
    params.append("with_keywords", lastAppliedKeywords);
  }

  if (!filters.searchAllReleases) {
    if (filters.selectedCountry) {
      params.append("region", filters.selectedCountry);
    }
    if (filters.selectedReleaseTypes) {
      params.append("with_release_type", filters.selectedReleaseTypes);
    }
  }

  if (filters.releaseFrom) {
    params.append("primary_release_date.gte", filters.releaseFrom);
  }
  if (filters.releaseTo) {
    params.append("primary_release_date.lte", filters.releaseTo);
  }

  const url = `${BASE_URL}/discover/movie?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();

    renderMovies(data.results, isNewQuery);

    if (data.total_pages > currentPage) {
      loadMoreBtn.style.display = "block";
    } else {
      loadMoreBtn.style.display = "none";
    }
  } catch (error) {
    console.error("Movie API Error:", error);
    showStatus(
      "error",
      "Failed to load movies. Please check your network connection."
    );
  } finally {
    loadingIndicator.style.display = "none";
  }
}

/**
 * Renders genre filters using document.createElement and appendChild.
 * @param {Array<Object>} genres
 */
function renderGenreFilters(genres) {
  // Clear the existing content without using innerHTML
  while (genreCheckboxesContainer.firstChild) {
    genreCheckboxesContainer.removeChild(genreCheckboxesContainer.firstChild);
  }

  genres.forEach((genre) => {
    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "genre";
    checkbox.value = genre.name;
    checkbox.dataset.id = genre.id;

    label.appendChild(checkbox);
    label.append(genre.name); // Use append for text nodes

    genreCheckboxesContainer.appendChild(label);
  });

  // Attach event listener to the newly rendered checkboxes
  genreCheckboxesContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", handleControlChange);
    });
}

/**
 * Draws the progress circle for the user score on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} percent
 * @param {string} trackColor
 * @param {string} barColor
 */
function drawScoreCircle(canvas, percent, trackColor, barColor) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const radius = size / 2;
  const lineWidth = 3;
  const startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, size, size);

  // 1. Draw the track (unfilled part)
  ctx.beginPath();
  ctx.arc(radius, radius, radius - lineWidth, 0, 2 * Math.PI);
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // 2. Draw the progress bar (filled part)
  if (percent > 0) {
    const endAngle = startAngle + (2 * Math.PI * percent) / 100;
    ctx.beginPath();
    // A small adjustment for 100% to ensure the circle doesn't disappear in some browsers due to start/end being the same
    const adjustedEndAngle =
      percent === 100 ? startAngle + 2 * Math.PI - 0.001 : endAngle;

    ctx.arc(radius, radius, radius - lineWidth, startAngle, adjustedEndAngle);
    ctx.strokeStyle = barColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Renders movie cards using the <template> element.
 * @param {Array<Object>} movies
 * @param {boolean} clearGrid
 */
function renderMovies(movies, clearGrid) {
  if (clearGrid) {
    // Clear the existing content without using innerHTML
    while (moviesGrid.firstChild) {
      moviesGrid.removeChild(moviesGrid.firstChild);
    }
  }

  if (movies.length === 0 && clearGrid) {
    const noMoviesMessage = document.createElement("p");
    noMoviesMessage.classList.add("message-status");
    noMoviesMessage.textContent = "No movies found matching your criteria.";
    moviesGrid.appendChild(noMoviesMessage);
    return;
  }

  movies.forEach((movie) => {
    // Use the content of the template
    const cardClone = movieCardTemplate.content.cloneNode(true);
    const card = cardClone.querySelector(".movie-card");

    const posterPath = movie.poster_path
      ? `${IMAGE_BASE_URL}${movie.poster_path}`
      : "media/placeholder.png";
    const userRating = (movie.vote_average * 10).toFixed(0);

    let barColor = "#d2d531";
    let trackColor = "#423d0f";

    if (userRating >= 70) {
      barColor = "#1ed5a9";
      trackColor = "#204529";
    } else if (userRating < 40 && userRating > 0) {
      barColor = "#db2360";
      trackColor = "#571435";
    } else if (userRating === "0") {
      barColor = "#ccc";
      trackColor = "#666";
    }

    // --- Update elements in the cloned card ---

    const posterImg = card.querySelector("[data-poster]");
    if (posterImg) {
      posterImg.src = posterPath;
      posterImg.alt = `${movie.title} Poster`;
    }

    const titleLink = card.querySelector("[data-title]");
    if (titleLink) {
      titleLink.textContent = movie.title;
    }

    const releaseDateP = card.querySelector("[data-release-date]");
    if (releaseDateP) {
      releaseDateP.textContent = movie.release_date || "N/A";
    }

    const overviewP = card.querySelector("[data-overview]");
    if (overviewP) {
      overviewP.textContent = movie.overview || "";
    }

    const scoreChart = card.querySelector("[data-score-chart]");
    const scoreValueSpan = card.querySelector("[data-score-value]");

    if (scoreChart && scoreValueSpan) {
      scoreChart.dataset.percent = userRating;
      scoreChart.dataset.trackColor = trackColor;
      scoreChart.dataset.barColor = barColor;
      // Use textContent for the number part and createElement for the small tag
      scoreValueSpan.textContent = userRating === "0" ? "NR" : userRating;

      if (userRating !== "0") {
        const smallPercent = document.createElement("small");
        smallPercent.textContent = "%";
        scoreValueSpan.appendChild(smallPercent);
      }
    }

    // Append the whole document fragment (cardClone) to the grid
    moviesGrid.appendChild(cardClone);

    // Find the elements in the now-attached card (the last child of moviesGrid)
    const attachedCard = moviesGrid.lastElementChild;
    const attachedScoreChart = attachedCard.querySelector("[data-score-chart]");

    // Only draw the circle if the element exists (it's hidden in the mobile list view by CSS)
    if (attachedScoreChart) {
      const canvas = attachedScoreChart.querySelector("canvas");
      drawScoreCircle(
        canvas,
        parseInt(attachedScoreChart.dataset.percent),
        attachedScoreChart.dataset.trackColor,
        attachedScoreChart.dataset.barColor
      );
    }
  });
}

function showStatus(type, message) {
  if (type === "error") {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  } else {
    errorMessage.style.display = "none";
  }
}

// --- Keyword Search & Tag Functions ---

/**
 * Debounces the keyword search API call.
 */
function debounceKeywordsSearch() {
  const query = keywordsInput.value.trim();

  // Check if the input is empty, hide the dropdown, and check control change
  if (query.length === 0) {
    keywordsAutocompleteList.classList.remove("show");
    handleControlChange();
    return;
  }

  if (currentKeywordTimeout) {
    clearTimeout(currentKeywordTimeout);
  }

  currentKeywordTimeout = setTimeout(() => {
    fetchKeywords(query);
  }, 300); // 300ms debounce

  handleControlChange(); // Check if typing enables search
}

/**
 * Fetches keyword suggestions from TMDB API.
 * @param {string} query
 */
async function fetchKeywords(query) {
  if (query.length < 2) {
    keywordsAutocompleteList.classList.remove("show");
    return;
  }

  const url = `${BASE_URL}/search/keyword?query=${encodeURIComponent(
    query
  )}&api_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch keywords");
    const data = await response.json();
    renderKeywordAutocomplete(data.results, query);
  } catch (error) {
    console.error("Keyword API Error:", error);
  }
}

/**
 * Renders the keyword suggestions in the autocomplete dropdown.
 * @param {Array<Object>} keywords
 * @param {string} currentQuery
 */
function renderKeywordAutocomplete(keywords, currentQuery) {
  // Clear the existing content
  while (keywordsAutocompleteList.firstChild) {
    keywordsAutocompleteList.removeChild(keywordsAutocompleteList.firstChild);
  }

  // Filter out keywords that are already selected
  const unselectedKeywords = keywords.filter(
    (keyword) =>
      !selectedKeywords.some((selected) => selected.id === keyword.id)
  );

  if (unselectedKeywords.length === 0) {
    keywordsAutocompleteList.classList.remove("show");
    return;
  }

  unselectedKeywords.forEach((keyword) => {
    const li = document.createElement("li");
    li.textContent = keyword.name;
    li.dataset.id = keyword.id;
    li.dataset.name = keyword.name;

    keywordsAutocompleteList.appendChild(li);
  });

  keywordsAutocompleteList.classList.add("show");
}

/**
 * Handles the click event on an autocomplete item to select a keyword.
 * @param {Event} event
 */
function handleKeywordSelect(event) {
  const listItem = event.target.closest("li");
  if (!listItem || listItem.classList.contains("selected-keyword")) return;

  const id = parseInt(listItem.dataset.id);
  const name = listItem.dataset.name;

  if (id && name) {
    selectedKeywords.push({ id, name });
    renderSelectedKeywords();
    keywordsInput.value = ""; // Clear the input after selection
    keywordsAutocompleteList.classList.remove("show"); // Hide the dropdown
    handleControlChange(); // Trigger check to enable search button
    // Re-focus the input after selection to allow continuous typing
    keywordsInput.focus();
  }
}

/**
 * Renders the selected keywords as tags/chips in the input container.
 */
function renderSelectedKeywords() {
  // 1. Remove all existing tags from the container
  const existingTags = keywordsContainer.querySelectorAll(".keyword-tag");
  existingTags.forEach((tag) => tag.remove());

  const inputElement = keywordsInput;

  // 2. Render and insert new tags before the input element
  selectedKeywords.forEach((keyword) => {
    const tag = document.createElement("span");
    tag.classList.add("keyword-tag");
    tag.dataset.id = keyword.id;
    tag.textContent = keyword.name;

    const removeButton = document.createElement("button");
    removeButton.classList.add("remove-tag");
    removeButton.innerHTML = "&times;"; // 'x' symbol
    removeButton.type = "button"; // Prevent form submission
    removeButton.title = `Remove ${keyword.name}`;

    removeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      handleKeywordRemove(keyword.id);
    });

    tag.appendChild(removeButton);

    // Insert the tag before the input element
    keywordsContainer.insertBefore(tag, inputElement);
  });
}

/**
 * Removes a keyword from the selected list and re-renders the tags.
 * @param {number} id - The ID of the keyword to remove.
 */
function handleKeywordRemove(id) {
  selectedKeywords = selectedKeywords.filter((keyword) => keyword.id !== id);
  renderSelectedKeywords();
  handleControlChange(); // Trigger check to enable search button
}

// --- Dynamic UI/Slider Functions ---

function handleReleaseToggleChange() {
  const isChecked = searchAllReleasesCheckbox.checked;

  countriesToggleContainer.style.display = isChecked ? "none" : "block";
  releaseTypeFilters.style.display = isChecked ? "none" : "block";

  if (isChecked) {
    searchAllCountriesCheckbox.checked = true;
    countrySelectContainer.style.display = "none";
  } else {
    handleCountryToggleChange();
  }

  handleControlChange();
}

function handleCountryToggleChange() {
  const isChecked = searchAllCountriesCheckbox.checked;

  countrySelectContainer.style.display = isChecked ? "none" : "block";

  handleControlChange();
}

function getCurrentFilterState() {
  const userScoreStart = parseFloat(
    userScoreHandleStart.getAttribute("aria-valuenow")
  );
  const userScoreEnd = parseFloat(
    userScoreHandleEnd.getAttribute("aria-valuenow")
  );
  const minVotesStart = parseInt(
    minVotesHandleStart.getAttribute("aria-valuenow")
  );
  const runtimeEnd = parseInt(runtimeHandleEnd.getAttribute("aria-valuenow"));

  const searchAllReleases = searchAllReleasesCheckbox.checked;
  const searchAllCountries = searchAllCountriesCheckbox.checked;
  const selectedCountry = searchAllCountries ? "" : countrySelect.value;

  const selectedReleaseTypes = Array.from(
    releaseTypeFilters.querySelectorAll("input:checked")
  )
    .map((checkbox) => checkbox.value)
    .join("|");

  return {
    sortBy: sortOptions.value,
    genres: Array.from(
      genreCheckboxesContainer.querySelectorAll("input:checked")
    )
      .map((checkbox) => checkbox.dataset.id)
      .join(","),
    language: languageSelect.value,
    userScore: userScoreStart,
    userScoreMax: userScoreEnd,
    minVotes: minVotesStart,
    runtime: runtimeEnd,
    // UPDATED: Keywords (typed text for comparison, selected IDs for API)
    keywords: keywordsInput.value.trim(),
    selectedKeywordIds: selectedKeywords.map((k) => k.id).join(","),

    searchAllReleases: searchAllReleases,
    selectedCountry: selectedCountry,
    selectedReleaseTypes: selectedReleaseTypes,
    // Use the YYYY-MM-DD value stored in the data attribute for API calls
    releaseFrom: releaseFromInput.getAttribute("data-internal-value"),
    releaseTo: releaseToInput.getAttribute("data-internal-value"),
  };
}

function handleControlChange() {
  const currentState = getCurrentFilterState();

  const sortChanged = currentState.sortBy !== lastAppliedSortBy;
  const genresChanged = currentState.genres !== lastAppliedGenres.join(",");
  const languageChanged = currentState.language !== lastAppliedLanguage;
  const userScoreChanged =
    parseFloat(currentState.userScore) !== lastAppliedUserScore ||
    parseFloat(currentState.userScoreMax) !== lastAppliedUserScoreMax;
  const minVotesChanged =
    parseInt(currentState.minVotes) !== lastAppliedMinVotes;
  const runtimeChanged = parseInt(currentState.runtime) !== lastAppliedRuntime;

  // UPDATED: Check for changes in selected keyword IDs
  const keywordsChanged =
    currentState.selectedKeywordIds !== lastAppliedKeywords;

  const releaseToggleChanged =
    currentState.searchAllReleases !== searchAllReleasesCheckbox.checked;
  const countryToggleChanged =
    currentState.selectedCountry !==
    (searchAllCountriesCheckbox.checked ? "" : countrySelect.value); // Compare against current DOM state, not lastApplied value for country
  const releaseTypesChanged =
    currentState.selectedReleaseTypes !==
    Array.from(releaseTypeFilters.querySelectorAll("input:checked"))
      .map((c) => c.value)
      .join("|");

  const dateFromChanged =
    currentState.releaseFrom !==
    releaseFromInput.getAttribute("data-internal-value");
  const dateToChanged =
    currentState.releaseTo !==
    releaseToInput.getAttribute("data-internal-value");

  if (
    sortChanged ||
    genresChanged ||
    languageChanged ||
    userScoreChanged ||
    minVotesChanged ||
    runtimeChanged ||
    keywordsChanged ||
    releaseToggleChanged ||
    countryToggleChanged ||
    releaseTypesChanged ||
    dateFromChanged ||
    dateToChanged
  ) {
    searchButton.disabled = false;
  } else {
    searchButton.disabled = true;
  }

  handleScrollVisibility();
}

function handleFilterSearch() {
  const filters = getCurrentFilterState();

  lastAppliedGenres = filters.genres.split(",").filter((id) => id);
  lastAppliedSortBy = filters.sortBy;
  lastAppliedLanguage = filters.language;
  lastAppliedUserScore = parseFloat(filters.userScore);
  lastAppliedUserScoreMax = parseFloat(filters.userScoreMax);
  lastAppliedMinVotes = parseInt(filters.minVotes);
  lastAppliedRuntime = parseInt(filters.runtime);

  // UPDATED: Save the list of selected keyword IDs
  lastAppliedKeywords = filters.selectedKeywordIds;
  keywordsInput.value = ""; // Clear the input field text after search

  currentPage = 1;
  fetchMovies(true);

  searchButton.disabled = true;
  stickySearchBtn.classList.remove("is-visible");
  stickySearchBtn.style.display = "none";
}

function handleScrollVisibility() {
  if (window.innerWidth < 577 || searchButton.disabled) {
    stickySearchBtn.classList.remove("is-visible");
    stickySearchBtn.style.display = "none";
    return;
  }

  stickySearchBtn.style.display = "block";

  const greenButtonRect = searchButton.getBoundingClientRect();
  const viewportBottom = window.innerHeight;

  if (greenButtonRect.top > viewportBottom) {
    stickySearchBtn.classList.add("is-visible");
  } else {
    stickySearchBtn.classList.remove("is-visible");
  }
}

function handleLoadMore() {
  currentPage++;
  fetchMovies(false);
}

function handleHeaderScroll() {
  const currentScrollY = window.scrollY;
  const header = document.querySelector("header");

  if (currentScrollY > 64) {
    if (currentScrollY < lastScrollY) {
      header.classList.remove("header-hidden");
    } else {
      header.classList.add("header-hidden");
    }
  } else {
    header.classList.remove("header-hidden");
  }
  lastScrollY = currentScrollY;
}

function togglePanel(event) {
  const panel = event.currentTarget.closest(".panel");
  if (panel) {
    panel.classList.toggle("open");
  }
}

function setupRangeSlider(
  container,
  min,
  max,
  step,
  initialStart,
  initialEnd,
  onChange,
  startOnly = false,
  endOnly = false
) {
  const trackWrap = container.querySelector(".k-slider-track-wrap");
  const track = container.querySelector(".k-slider-track");
  const selection = container.querySelector(".k-slider-selection");
  const handleStart = container.querySelector(".k-draghandle-start");
  const handleEnd = container.querySelector(".k-draghandle-end");

  let isDragging = false;
  let activeHandle = null;

  function getRangeInfo() {
    return {
      trackWidth: track.offsetWidth,
      trackLeft: track.getBoundingClientRect().left,
      min: min,
      max: max,
      step: step,
    };
  }

  function updateHandles(startValue, endValue) {
    const info = getRangeInfo();

    const startPercent = valueToPercent(startValue, info.min, info.max);
    const endPercent = valueToPercent(endValue, info.min, info.max);

    if (endOnly) {
      selection.style.left = "0%";
      selection.style.width = endPercent + "%";
    } else if (startOnly) {
      selection.style.left = startPercent + "%";
      selection.style.width = 100 - startPercent + "%";
    } else {
      selection.style.left = startPercent + "%";
      selection.style.width = endPercent - startPercent + "%";
    }

    if (!endOnly) {
      handleStart.style.left = startPercent + "%";
      handleStart.setAttribute(
        "aria-valuenow",
        startValue.toFixed(step === 1 ? 0 : 1)
      );
    } else {
      handleStart.style.left = "0%";
    }

    if (!startOnly) {
      handleEnd.style.left = endPercent + "%";
      handleEnd.setAttribute(
        "aria-valuenow",
        endValue.toFixed(step === 1 ? 0 : 1)
      );
    } else {
      handleEnd.style.left = "100%";
    }
  }

  updateHandles(initialStart, initialEnd);

  const onStartDrag = (e) => {
    if (e.target.classList.contains("k-draghandle")) {
      isDragging = true;
      activeHandle = e.target;
      activeHandle.focus();
      document.addEventListener("mousemove", onDragging);
      document.addEventListener("mouseup", onEndDrag);
    }
  };

  const onDragging = (e) => {
    if (!isDragging) return;

    const info = getRangeInfo();
    let clientX = e.clientX;

    let newPosition = clientX - info.trackLeft;
    newPosition = Math.max(0, Math.min(info.trackWidth, newPosition));

    let newValue = positionToValue(
      newPosition,
      info.min,
      info.max,
      info.step,
      info.trackWidth
    );

    let currentStart = parseFloat(handleStart.getAttribute("aria-valuenow"));
    let currentEnd = parseFloat(handleEnd.getAttribute("aria-valuenow"));

    if (activeHandle === handleStart && !endOnly) {
      newValue = Math.min(newValue, currentEnd);
      currentStart = newValue;
    } else if (activeHandle === handleEnd && !startOnly) {
      newValue = Math.max(newValue, currentStart);
      currentEnd = newValue;
    }

    updateHandles(currentStart, currentEnd);
    onChange();
  };

  const onEndDrag = () => {
    isDragging = false;
    activeHandle = null;
    document.removeEventListener("mousemove", onDragging);
    document.removeEventListener("mouseup", onEndDrag);
  };

  trackWrap.addEventListener("mousedown", onStartDrag);
}

function positionToValue(position, min, max, step, trackWidth) {
  const percentage = position / trackWidth;
  const valueRange = max - min;
  let value = min + percentage * valueRange;
  value = Math.round(value / step) * step;
  return Math.max(min, Math.min(max, value));
}

function valueToPercent(value, min, max) {
  return ((value - min) / (max - min)) * 100;
}
