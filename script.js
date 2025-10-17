document.addEventListener('DOMContentLoaded', init);

// --- Global State and Constants ---
// NOTE: Replace 'YOUR_API_KEY' with your actual TMDB API key if you plan to run this.
const API_KEY = '629b38bf2d91d04d4b03567bc1645c75';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
// Global configuration (placeholders - REPLACE YOUR_TMDB_API_KEY)
// Global configuration (placeholders - REPLACE YOUR_TMDB_API_KEY)

// --- State Variables ---
let currentPage = 1;
let lastAppliedSortBy = 'popularity.desc'; 
let lastAppliedGenres = [];
let lastAppliedUserScore = 0;
let lastAppliedUserScoreMax = 10; // Max score filter
let lastAppliedMinVotes = 0;  
let lastAppliedRuntime = 360;   // Max runtime filter
let lastAppliedKeywords = ''; 
let lastAppliedLanguage = ''; 

let lastScrollY = 0; 

// --- DOM Elements ---
const moviesGrid = document.getElementById('movies-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const sortOptions = document.getElementById('sort-options');
const searchButton = document.getElementById('search-button');
const stickySearchBtn = document.getElementById('sticky-search');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const genreCheckboxesContainer = document.getElementById('genre-checkboxes');
const filterPanel = document.getElementById('filter-panel'); 

// Filter specific elements
const languageSelect = document.getElementById('language-select');
const keywordsInput = document.getElementById('keywords-input');

// NEW Range Slider Elements
const userScoreContainer = document.getElementById('user-score-slider-container');
const userScoreHandleStart = userScoreContainer.querySelector('.k-draghandle-start');
const userScoreHandleEnd = userScoreContainer.querySelector('.k-draghandle-end');

const minVotesContainer = document.getElementById('min-votes-slider-container');
const minVotesHandleStart = minVotesContainer.querySelector('.k-draghandle-start');
const minVotesHandleEnd = minVotesContainer.querySelector('.k-draghandle-end');

const runtimeContainer = document.getElementById('runtime-slider-container');
const runtimeHandleStart = runtimeContainer.querySelector('.k-draghandle-start');
const runtimeHandleEnd = runtimeContainer.querySelector('.k-draghandle-end');


// --- Initial Setup and Event Listeners ---
function init() {
    // 1. Fetch initial data for filters (fetchGenres calls fetchMovies upon success)
    fetchGenres(); 
    fetchLanguages();

    // 2. Set up event listeners
    loadMoreBtn.addEventListener('click', handleLoadMore);
    
    // Listeners for filter changes (enables/disables Search button)
    sortOptions.addEventListener('change', handleControlChange);
    languageSelect.addEventListener('change', handleControlChange);

    // NEW: Setup the range sliders with their parameters and initial values
    setupRangeSlider(userScoreContainer, 0, 10, 0.1, lastAppliedUserScore, lastAppliedUserScoreMax, handleControlChange);
    setupRangeSlider(minVotesContainer, 0, 500, 1, lastAppliedMinVotes, 500, handleControlChange, true); 
    setupRangeSlider(runtimeContainer, 0, 360, 1, 0, lastAppliedRuntime, handleControlChange, false, true);

    keywordsInput.addEventListener('input', handleControlChange);

    searchButton.addEventListener('click', handleFilterSearch);
    stickySearchBtn.addEventListener('click', handleFilterSearch);

    // Header Scroll Hide/Show Logic
    window.addEventListener('scroll', handleHeaderScroll);
    
    // Sticky Search Button Scroll Logic
    window.addEventListener('scroll', handleScrollVisibility); 
    window.addEventListener('resize', handleScrollVisibility); 
    
    // Collapsible Panel Logic
    document.querySelectorAll('.panel h3').forEach(header => {
        header.addEventListener('click', togglePanel);
    });

    // Initial state check
    searchButton.disabled = true; 
    handleScrollVisibility();
}

// --- Header Scroll Function (Smart Hide/Show) ---
function handleHeaderScroll() {
    const currentScrollY = window.scrollY;
    const header = document.querySelector('header');
    
    if (currentScrollY > 64) { 
        if (currentScrollY < lastScrollY) {
            header.classList.remove('header-hidden');
        } else {
            header.classList.add('header-hidden');
        }
    } else {
        header.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;
}

// --- Collapsible Panel Function ---
function togglePanel(event) {
    const panel = event.currentTarget.closest('.panel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

// --- Range Slider Implementation ---

// Helper function to convert a pixel position (0 to track width) into a value
function positionToValue(position, min, max, step, trackWidth) {
    const percentage = position / trackWidth;
    const valueRange = max - min;
    let value = min + (percentage * valueRange);

    // Snap to the nearest step value
    value = Math.round(value / step) * step;

    // Clamp value within min/max bounds
    return Math.max(min, Math.min(max, value));
}

// Helper function to convert a value back to a percentage position
function valueToPercent(value, min, max) {
    return ((value - min) / (max - min)) * 100;
}

/**
 * Sets up the drag logic for a custom range slider.
 */
function setupRangeSlider(container, min, max, step, initialStart, initialEnd, onChange, startOnly = false, endOnly = false) {
    const trackWrap = container.querySelector('.k-slider-track-wrap');
    const track = container.querySelector('.k-slider-track');
    const selection = container.querySelector('.k-slider-selection');
    const handleStart = container.querySelector('.k-draghandle-start');
    const handleEnd = container.querySelector('.k-draghandle-end');

    let isDragging = false;
    let activeHandle = null;

    function getRangeInfo() {
        return {
            trackWidth: track.offsetWidth,
            trackLeft: track.getBoundingClientRect().left,
            min: min,
            max: max,
            step: step
        };
    }

    function updateHandles(startValue, endValue) {
        const info = getRangeInfo();

        const startPercent = valueToPercent(startValue, info.min, info.max);
        const endPercent = valueToPercent(endValue, info.min, info.max);
        
        // Update selection bar
        if (endOnly) {
            selection.style.left = '0%';
            selection.style.width = endPercent + '%';
        } else if (startOnly) {
            selection.style.left = startPercent + '%';
            selection.style.width = (100 - startPercent) + '%';
        } else {
            selection.style.left = startPercent + '%';
            selection.style.width = (endPercent - startPercent) + '%';
        }


        // Update handle positions and aria attributes
        if (!endOnly) {
            handleStart.style.left = startPercent + '%';
            handleStart.setAttribute('aria-valuenow', startValue.toFixed(step === 1 ? 0 : 1));
        } else {
            handleStart.style.left = '0%';
        }
        
        if (!startOnly) {
            handleEnd.style.left = endPercent + '%';
            handleEnd.setAttribute('aria-valuenow', endValue.toFixed(step === 1 ? 0 : 1));
        } else {
            handleEnd.style.left = '100%';
        }
    }
    
    // Initialize handles and selection bar
    updateHandles(initialStart, initialEnd);

    // Event handlers for dragging
    const onStartDrag = (e) => {
        if (e.target.classList.contains('k-draghandle')) {
            isDragging = true;
            activeHandle = e.target;
            activeHandle.focus();
            document.addEventListener('mousemove', onDragging);
            document.addEventListener('mouseup', onEndDrag);
        }
    };

    const onDragging = (e) => {
        if (!isDragging) return;
        
        const info = getRangeInfo();
        let clientX = e.clientX;
        
        let newPosition = clientX - info.trackLeft;
        newPosition = Math.max(0, Math.min(info.trackWidth, newPosition));

        let newValue = positionToValue(newPosition, info.min, info.max, info.step, info.trackWidth);

        let currentStart = parseFloat(handleStart.getAttribute('aria-valuenow'));
        let currentEnd = parseFloat(handleEnd.getAttribute('aria-valuenow'));

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
        document.removeEventListener('mousemove', onDragging);
        document.removeEventListener('mouseup', onEndDrag);
    };

    // Attach drag listeners to the track wrapper
    trackWrap.addEventListener('mousedown', onStartDrag); 
}

// --- Filter/Sort Logic ---

function getCurrentFilterState() {
    // Read values from the drag handles' aria-valuenow attribute
    const userScoreStart = parseFloat(userScoreHandleStart.getAttribute('aria-valuenow'));
    const userScoreEnd = parseFloat(userScoreHandleEnd.getAttribute('aria-valuenow'));
    const minVotesStart = parseInt(minVotesHandleStart.getAttribute('aria-valuenow'));
    const runtimeEnd = parseInt(runtimeHandleEnd.getAttribute('aria-valuenow'));
    
    return {
        sortBy: sortOptions.value,
        genres: Array.from(genreCheckboxesContainer.querySelectorAll('input:checked')).map(checkbox => checkbox.dataset.id).join(','),
        language: languageSelect.value,
        userScore: userScoreStart, 
        userScoreMax: userScoreEnd, 
        minVotes: minVotesStart,
        runtime: runtimeEnd,
        keywords: keywordsInput.value.trim(),
    };
}

function handleControlChange() {
    const currentState = getCurrentFilterState();
    
    const sortChanged = currentState.sortBy !== lastAppliedSortBy;
    const genresChanged = currentState.genres !== lastAppliedGenres.join(','); 
    const languageChanged = currentState.language !== lastAppliedLanguage;
    
    const userScoreChanged = parseFloat(currentState.userScore) !== lastAppliedUserScore || parseFloat(currentState.userScoreMax) !== lastAppliedUserScoreMax;
    const minVotesChanged = parseInt(currentState.minVotes) !== lastAppliedMinVotes;
    const runtimeChanged = parseInt(currentState.runtime) !== lastAppliedRuntime;
    
    const keywordsChanged = currentState.keywords !== lastAppliedKeywords;


    if (sortChanged || genresChanged || languageChanged || 
        userScoreChanged || minVotesChanged || runtimeChanged || keywordsChanged) {
        searchButton.disabled = false;
    } else {
        searchButton.disabled = true;
    }
    
    handleScrollVisibility(); 
}

function handleFilterSearch() {
    const filters = getCurrentFilterState();
    
    lastAppliedGenres = filters.genres.split(',').filter(id => id); 
    lastAppliedSortBy = filters.sortBy;
    lastAppliedLanguage = filters.language;
    lastAppliedUserScore = parseFloat(filters.userScore);
    lastAppliedUserScoreMax = parseFloat(filters.userScoreMax); 
    lastAppliedMinVotes = parseInt(filters.minVotes);
    lastAppliedRuntime = parseInt(filters.runtime);
    lastAppliedKeywords = filters.keywords;


    currentPage = 1;
    fetchMovies(true); 

    searchButton.disabled = true;
    stickySearchBtn.classList.remove('is-visible');
    stickySearchBtn.style.display = 'none'; 
}


// --- Sticky Search Button Visibility Logic ---
function handleScrollVisibility() {
    if (window.innerWidth < 577 || searchButton.disabled) {
        stickySearchBtn.classList.remove('is-visible');
        stickySearchBtn.style.display = 'none'; 
        return;
    }
    
    stickySearchBtn.style.display = 'block';

    const greenButtonRect = searchButton.getBoundingClientRect();
    const viewportBottom = window.innerHeight;

    if (greenButtonRect.top > viewportBottom) {
        stickySearchBtn.classList.add('is-visible');
    } else {
        stickySearchBtn.classList.remove('is-visible');
    }
}


// --- API Calls & Rendering ---

function handleLoadMore() {
    currentPage++;
    fetchMovies(false); 
}

async function fetchGenres() {
    const url = `${BASE_URL}/genre/movie/list?api_key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch genres');
        
        const data = await response.json();
        renderGenreFilters(data.genres);
        
        fetchMovies(true); 
        
    } catch (error) {
        console.error("Genre API Error:", error);
        showStatus('error', 'Failed to load filters. Check your network.');
    }
}

async function fetchLanguages() {
    const url = `${BASE_URL}/configuration/languages?api_key=${API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch languages');
        const data = await response.json();
        renderLanguageFilters(data);
    } catch (error) {
        console.error("Language API Error:", error);
    }
}

function renderLanguageFilters(languages) {
    languageSelect.innerHTML = '<option value="">None Selected</option>'; 
    
    languages.sort((a, b) => a.english_name.localeCompare(b.english_name));

    languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.iso_639_1;
        option.textContent = lang.english_name;
        languageSelect.appendChild(option);
    });
}


async function fetchMovies(isNewQuery) {
    loadingIndicator.style.display = 'block';
    errorMessage.style.display = 'none';
    loadMoreBtn.style.display = 'none';

    let params = new URLSearchParams({
        api_key: API_KEY,
        sort_by: lastAppliedSortBy, 
        page: currentPage,
        language: 'en-US' 
    });
    
    if (lastAppliedGenres.length > 0) {
        params.append('with_genres', lastAppliedGenres.join(','));
    }

    if (lastAppliedLanguage) {
        params.append('with_original_language', lastAppliedLanguage); 
    }

    if (lastAppliedUserScore > 0) {
        params.append('vote_average.gte', lastAppliedUserScore);
    }
    if (lastAppliedUserScoreMax < 10) { 
        params.append('vote_average.lte', lastAppliedUserScoreMax);
    }
    
    if (lastAppliedMinVotes > 0) {
        params.append('vote_count.gte', lastAppliedMinVotes);
    }
    
    if (lastAppliedRuntime < 360) { 
        params.append('with_runtime.lte', lastAppliedRuntime);
    }

    const url = `${BASE_URL}/discover/movie?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();
        
        renderMovies(data.results, isNewQuery);
        
        if (data.total_pages > currentPage) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }

    } catch (error) {
        console.error("Movie API Error:", error);
        showStatus('error', 'Failed to load movies. Please check your network connection.');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function renderGenreFilters(genres) {
    genreCheckboxesContainer.innerHTML = ''; 
    
    genres.forEach(genre => {
        const label = document.createElement('label');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'genre';
        checkbox.value = genre.name;
        checkbox.dataset.id = genre.id; 
        
        label.appendChild(checkbox);
        label.append(genre.name);
        
        genreCheckboxesContainer.appendChild(label);
    });
    
    // Attach event listener to the newly rendered checkboxes
    genreCheckboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleControlChange);
    });
}

// --- Canvas Drawing Function ---
function drawScoreCircle(canvas, percent, trackColor, barColor) {
    const ctx = canvas.getContext('2d');
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
        const endAngle = startAngle + (2 * Math.PI * percent / 100);
        ctx.beginPath();
        const adjustedEndAngle = percent === 100 ? startAngle + 2 * Math.PI - 0.001 : endAngle;
        
        ctx.arc(radius, radius, radius - lineWidth, startAngle, adjustedEndAngle);
        ctx.strokeStyle = barColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}


function renderMovies(movies, clearGrid) {
    if (clearGrid) {
        moviesGrid.innerHTML = '';
    }

    if (movies.length === 0 && clearGrid) {
        moviesGrid.innerHTML = '<p class="message-status">No movies found matching your criteria.</p>';
        return;
    }

    movies.forEach(movie => {
        const card = document.createElement('div');
        card.classList.add('movie-card');
        
        const posterPath = movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : 'media/placeholder.png';
        const userRating = (movie.vote_average * 10).toFixed(0);
        
        // Determine colors based on score
        let barColor = '#d2d531'; 
        let trackColor = '#423d0f'; 
        
        if (userRating >= 70) {
            barColor = '#1ed5a9'; 
            trackColor = '#204529'; 
        } else if (userRating < 40 && userRating > 0) {
            barColor = '#db2360'; 
            trackColor = '#571435'; 
        } else if (userRating === '0') {
            barColor = '#ccc'; 
            trackColor = '#666'; 
        }

        const ratingBlockHTML = `
            <div class="consensus tight">
                <div class="outer_ring">
                    <div class="user_score_chart" 
                         data-percent="${userRating}" 
                         data-track-color="${trackColor}" 
                         data-bar-color="${barColor}">
                        <div class="percent">
                            <span>${userRating === '0' ? 'NR' : userRating}<small>${userRating === '0' ? '' : '%'}</small></span>
                        </div>
                        <canvas height="34" width="34"></canvas>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = `
            <a href="#">
                <img src="${posterPath}" alt="${movie.title} Poster" class="poster">
            </a>
            ${ratingBlockHTML} 
            <div class="movie-info">
                <h3><a href="#">${movie.title}</a></h3>
                <p class="release-date">${movie.release_date || 'N/A'}</p>
            </div>
        `;
        
        moviesGrid.appendChild(card);

        // --- RENDER CANVAS ---
        const scoreChart = card.querySelector('.user_score_chart');
        const canvas = scoreChart.querySelector('canvas');
        
        drawScoreCircle(
            canvas, 
            parseInt(scoreChart.dataset.percent), 
            scoreChart.dataset.trackColor, 
            scoreChart.dataset.barColor
        );

    });
}

function showStatus(type, message) {
    if (type === 'error') {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
    }
}

// Start the application
init();