/**
 * Bit, Nibble and Byte Flashcards App
 * A web application for displaying and interacting with flashcards
 * loaded from a remote JSON source.
 */

// Application state variables
let currentCardIndex = 0;
let allCards = [];
let filteredCards = [];
let isPlaying = false;
let playInterval;
let viewedCards = new Set();

// Add touch gesture support
let touchStartX = 0;
let touchEndX = 0;

// Configuration
const CONFIG = {
    // Available decks (add more as needed)
    decks: [
        { 
            id: 'azure-az900', 
            name: 'Azure AZ-900 Fundamentals', 
            // Use absolute path for GitHub Pages
            file: 'az-900.json'
        }
    ],
    defaultDeck: 'azure-az900',
    currentDeckId: 'azure-az900',
    autoPlayInterval: 3000,
    cacheExpiry: 24 * 60 * 60 * 1000,
    localStorageKeys: {
        data: 'flashcardsData_',
        timestamp: 'flashcardsTimestamp_',
        viewed: 'flashcardsViewed_',
        lastSelectedDeck: 'lastSelectedDeck'
    },
    swipeThreshold: 50
};

// DOM Elements
const elements = {};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    elements.flashcard = document.getElementById('flashcard');
    elements.questionElement = document.getElementById('question');
    elements.answerElement = document.getElementById('answer');
    elements.categoryElement = document.getElementById('category');
    elements.cardCountElement = document.getElementById('card-count');
    elements.prevBtn = document.getElementById('prev-btn');
    elements.nextBtn = document.getElementById('next-btn');
    elements.shuffleBtn = document.getElementById('shuffle-btn');
    elements.playBtn = document.getElementById('play-btn');
    elements.categoryFilter = document.getElementById('category-filter');
    elements.searchInput = document.getElementById('search-input');
    elements.loadingIndicator = document.getElementById('loading-indicator');
    elements.cardContainer = document.querySelector('.card-container');
    elements.totalCardsElement = document.getElementById('total-cards');
    elements.categoryCountElement = document.getElementById('category-count');
    elements.viewedCountElement = document.getElementById('viewed-count');
    elements.menuToggle = document.getElementById('menu-toggle');
    elements.filtersContainer = document.getElementById('filters-container');
    elements.swipeTooltip = document.getElementById('swipe-tooltip');
    elements.deckSelector = document.getElementById('deck-selector');
    elements.loadingStatus = document.getElementById('loading-status');
    elements.loadingProgress = document.getElementById('loading-progress');
    
    // Load the last selected deck from localStorage if available
    const lastSelectedDeck = localStorage.getItem(CONFIG.localStorageKeys.lastSelectedDeck);
    if (lastSelectedDeck && CONFIG.decks.some(deck => deck.id === lastSelectedDeck)) {
        CONFIG.currentDeckId = lastSelectedDeck;
    }
    
    // Populate deck selector
    populateDeckSelector();
    
    // Add event listeners
    elements.flashcard.addEventListener('click', flipCard);
    elements.prevBtn.addEventListener('click', previousCard);
    elements.nextBtn.addEventListener('click', nextCard);
    elements.shuffleBtn.addEventListener('click', shuffleCards);
    elements.playBtn.addEventListener('click', toggleAutoPlay);
    elements.categoryFilter.addEventListener('change', filterCards);
    elements.searchInput.addEventListener('input', filterCards);

    // Add touch event listeners for swipe functionality
    elements.flashcard.addEventListener('touchstart', handleTouchStart, false);
    elements.flashcard.addEventListener('touchend', handleTouchEnd, false);
    
    // Add menu toggle event listener
    elements.menuToggle.addEventListener('click', toggleFilters);
    
    // Add event listener for swipe tooltip button
    if (elements.swipeTooltip) {
        const gotItBtn = document.getElementById('got-it-btn');
        if (gotItBtn) {
            gotItBtn.addEventListener('click', () => {
                elements.swipeTooltip.style.display = 'none';
                localStorage.setItem('swipeTooltipSeen', 'true');
            });
        }
    }

    // Load previously viewed cards from local storage
    loadViewedCards();
    
    // Load the flashcards data
    loadFlashcards();

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!elements.filtersContainer.contains(event.target) && 
            !elements.menuToggle.contains(event.target) &&
            elements.filtersContainer.classList.contains('active')) {
            elements.filtersContainer.classList.remove('active');
        }
    });
});

/**
 * Update the loading status text
 * @param {string} status - The main status message
 * @param {string} [progress] - Optional progress details
 */
function updateLoadingStatus(status, progress = '') {
    if (elements.loadingStatus) {
        elements.loadingStatus.textContent = status;
    }
    
    if (elements.loadingProgress) {
        elements.loadingProgress.textContent = progress;
    }
}

/**
 * Show the loading indicator with a status message
 * @param {string} status - The status message to display
 * @param {string} [progress] - Optional progress details
 */
function showLoading(status, progress = '') {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'flex';
        updateLoadingStatus(status, progress);
    }
}

/**
 * Hide the loading indicator
 */
function hideLoading() {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'none';
    }
}

/**
 * Populate the deck selector dropdown
 */
function populateDeckSelector() {
    // Clear existing options
    elements.deckSelector.innerHTML = '';
    
    // Add options based on available decks
    CONFIG.decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        elements.deckSelector.appendChild(option);
    });
    
    // Set the current deck
    elements.deckSelector.value = CONFIG.currentDeckId;
    
    // Add event listener for deck changes
    elements.deckSelector.addEventListener('change', function() {
        changeDeck(this.value);
    });
}

/**
 * Change the current deck
 * @param {string} deckId - ID of the deck to change to
 */
function changeDeck(deckId) {
    // Find the selected deck
    const selectedDeck = CONFIG.decks.find(deck => deck.id === deckId);
    
    if (!selectedDeck) {
        console.error('Deck not found:', deckId);
        return;
    }
    
    // Update the current deck
    CONFIG.currentDeckId = deckId;
    
    // Save the selection to localStorage
    localStorage.setItem(CONFIG.localStorageKeys.lastSelectedDeck, deckId);
    
    // Reset the app state
    currentCardIndex = 0;
    allCards = [];
    filteredCards = [];
    
    // Stop auto-play if it's running
    if (isPlaying) {
        toggleAutoPlay();
    }
    
    // Show loading indicator and hide card
    elements.cardContainer.style.display = 'none';
    showLoading(`Loading ${selectedDeck.name}...`, 'Initializing');
    
    // Reload flashcards with new deck
    loadFlashcards();
}

/**
 * Get the URL for the current deck's JSON file
 * @returns {string} The URL to fetch the flashcards from
 */
function getJsonUrl() {
    const selectedDeck = CONFIG.decks.find(deck => deck.id === CONFIG.currentDeckId);
    let filePath = selectedDeck ? selectedDeck.file : CONFIG.decks[0].file;
    
    // Check if we're running on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    if (isGitHubPages) {
        // Get the repository name from the pathname
        const pathParts = window.location.pathname.split('/');
        const repoName = pathParts[1]; // This would be 'webapp_Flashcards' in your case
        
        // If we're at the root of the repo already, don't add the repo name
        if (pathParts.length <= 2 || pathParts[2] === '') {
            // We're at the root of the repo - just use the filename
            return filePath;
        } else {
            // We're in a subdirectory - adjust path accordingly
            // Count how many directories deep we are and add ../ for each
            const dirCount = pathParts.filter(part => part && part !== repoName).length;
            const relativePath = '../'.repeat(dirCount);
            return relativePath + filePath;
        }
    }
    
    // For local development or other hosting
    return filePath;
}

/**
 * Handle touch start event
 * @param {TouchEvent} event - The touch event
 */
function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

/**
 * Handle touch end event
 * @param {TouchEvent} event - The touch event
 */
function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
}

/**
 * Process the swipe gesture
 */
function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const swipeThreshold = CONFIG.swipeThreshold;
    
    if (swipeDistance < -swipeThreshold) {
        // Swiped left - go to next card
        nextCard();
    } else if (swipeDistance > swipeThreshold) {
        // Swiped right - go to previous card
        previousCard();
    }
}

/**
 * Toggle the filters menu visibility
 */
function toggleFilters() {
    elements.filtersContainer.classList.toggle('active');
}

/**
 * Show the swipe tooltip on mobile devices if not seen before
 */
function showSwipeTooltip() {
    // Check if user has seen the tooltip before
    if (window.innerWidth <= 600 && !localStorage.getItem('swipeTooltipSeen') && elements.swipeTooltip) {
        elements.swipeTooltip.style.display = 'block';
    }
}

/**
 * Load viewed cards from local storage
 */
function loadViewedCards() {
    const viewedCardsKey = CONFIG.localStorageKeys.viewed + CONFIG.currentDeckId;
    const viewedCardsData = localStorage.getItem(viewedCardsKey);
    
    if (viewedCardsData) {
        try {
            const viewedCardsArray = JSON.parse(viewedCardsData);
            viewedCards = new Set(viewedCardsArray);
        } catch (error) {
            console.error('Error loading viewed cards:', error);
            viewedCards = new Set();
        }
    } else {
        viewedCards = new Set();
    }
}

/**
 * Save viewed cards to local storage
 */
function saveViewedCards() {
    const viewedCardsKey = CONFIG.localStorageKeys.viewed + CONFIG.currentDeckId;
    const viewedCardsArray = Array.from(viewedCards);
    localStorage.setItem(viewedCardsKey, JSON.stringify(viewedCardsArray));
}


/**
 * Fetch flashcards data from the JSON file
 * @param {number} retries - Number of retry attempts if all paths fail
 * @returns {Array} Array of flashcard objects
 */
async function fetchFlashcardsData(retries = 3) {
    // Define all possible paths to try in order
    const pathsToTry = [];
    
    // Check if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    if (isGitHubPages) {
        // Add all possible GitHub Pages paths to try - these are complete absolute paths
        pathsToTry.push(
            '/webapp_Flashcards/az-900.json',                   // Direct path to file
            'https://philwilky.github.io/webapp_Flashcards/az-900.json', // Full URL
            'https://raw.githubusercontent.com/PhilWilky/webapp_Flashcards/main/az-900.json' // Raw GitHub content
        );
    } else {
        // Local development paths to try
        pathsToTry.push(
            'az-900.json',       // Same directory
            '../az-900.json'     // Parent directory
        );
    }
    
    console.log('Environment:', window.location.hostname);
    console.log('Full URL:', window.location.href);
    console.log('Paths to try:', pathsToTry);
    
    // Try each path in sequence
    for (let i = 0; i < pathsToTry.length; i++) {
        const path = pathsToTry[i];
        console.log(`Trying path ${i+1}/${pathsToTry.length}: ${path}`);
        updateLoadingStatus('Fetching data...', `Try ${i+1}: ${path}`);
        
        try {
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(path, { 
                signal: controller.signal,
                cache: 'no-store' // Prevent caching issues
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.log(`Path ${path} failed with status: ${response.status}`);
                continue; // Try next path
            }
            
            const text = await response.text();
            console.log(`Path ${path} succeeded! Response length: ${text.length}`);
            
            try {
                const data = JSON.parse(text);
                console.log('JSON parsed successfully, items:', data.length);
                return data;
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                continue; // Try next path
            }
        } catch (fetchError) {
            console.log(`Fetch error for path ${path}:`, fetchError.message);
            continue; // Try next path
        }
    }
    
    // If we got here, all paths failed
    console.error('All paths failed to fetch JSON data');
    
    if (retries > 0) {
        console.log(`Retrying entire process... (${retries} attempts left)`);
        updateLoadingStatus('All paths failed', `Retrying (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchFlashcardsData(retries - 1);
    }
    
    updateLoadingStatus('Fetch failed', 'All paths failed to access flashcards data');
    return [];
}

/**
 * Load flashcards function with better error handling
 */
async function loadFlashcards() {
    try {
        // Get the current deck name for display
        const selectedDeck = CONFIG.decks.find(deck => deck.id === CONFIG.currentDeckId);
        const deckName = selectedDeck ? selectedDeck.name : 'Flashcards';
        
        showLoading(`Loading ${deckName}...`, 'Initializing');
        
        // Check if we have a previously successful path stored
        let usedCache = false;
        if (window.localStorage) {
            const cachedDataKey = CONFIG.localStorageKeys.data + CONFIG.currentDeckId;
            const cachedTimestampKey = CONFIG.localStorageKeys.timestamp + CONFIG.currentDeckId;
            const cachedData = localStorage.getItem(cachedDataKey);
            const cachedTimestamp = localStorage.getItem(cachedTimestampKey);
            
            if (cachedData && cachedTimestamp && (Date.now() - Number(cachedTimestamp) < CONFIG.cacheExpiry)) {
                try {
                    updateLoadingStatus(`Loading ${deckName}...`, 'Using cached data');
                    console.log('Using cached flashcards data');
                    
                    allCards = JSON.parse(cachedData);
                    usedCache = true;
                    console.log('Cache loaded successfully, cards:', allCards.length);
                } catch (error) {
                    console.error('Error parsing cached data:', error);
                    usedCache = false;
                }
            }
        }
        
        // If not using cache, fetch fresh data
        if (!usedCache) {
            updateLoadingStatus(`Loading ${deckName}...`, 'Fetching fresh data');
            console.log('Fetching fresh flashcards data');
            allCards = await fetchFlashcardsData();
            
            // Only cache if we got data
            if (allCards && allCards.length > 0) {
                updateLoadingStatus(`Loading ${deckName}...`, 'Saving to cache');
                localStorage.setItem(CONFIG.localStorageKeys.data + CONFIG.currentDeckId, JSON.stringify(allCards));
                localStorage.setItem(CONFIG.localStorageKeys.timestamp + CONFIG.currentDeckId, Date.now().toString());
            }
        }
        
        // Initialize filtered cards
        updateLoadingStatus(`Loading ${deckName}...`, 'Processing cards');
        filteredCards = [...allCards];
        
        // Populate category filter
        if (allCards.length > 0) {
            updateLoadingStatus(`Loading ${deckName}...`, 'Building category filters');
            populateCategoryFilter();
            
            // Update stats
            updateLoadingStatus(`Loading ${deckName}...`, 'Updating statistics');
            updateStats();
            
            // Display the first card
            updateLoadingStatus(`Loading ${deckName}...`, 'Preparing to display cards');
            displayCard();
            hideLoading();
            elements.cardContainer.style.display = 'block';
            
            // Show swipe tooltip on mobile
            showSwipeTooltip();
        } else {
            updateLoadingStatus('No flashcards found', 'Please check console for errors');
            elements.cardContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading flashcards:', error);
        updateLoadingStatus('Error loading flashcards', error.message);
    }
}

/**
 * Populate category dropdown with unique categories
 */
function populateCategoryFilter() {
    // Clear existing options except "All Categories"
    while (elements.categoryFilter.options.length > 1) {
        elements.categoryFilter.remove(1);
    }
    
    // Get unique categories
    const categories = [...new Set(allCards.map(card => card.category))];
    
    // Sort categories alphabetically
    categories.sort();
    
    // Add options to dropdown
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

/**
 * Filter cards by category and search term
 */
function filterCards() {
    const selectedCategory = elements.categoryFilter.value;
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    
    filteredCards = allCards.filter(card => {
        // Filter by category
        const categoryMatch = selectedCategory === 'all' || card.category === selectedCategory;
        
        // Filter by search term
        const searchMatch = searchTerm === '' || 
            card.question.toLowerCase().includes(searchTerm) || 
            card.answer.toLowerCase().includes(searchTerm);
        
        return categoryMatch && searchMatch;
    });
    
    // Reset to first card in filtered set
    currentCardIndex = 0;
    
    // Stop auto-play if it's running
    if (isPlaying) {
        toggleAutoPlay();
    }
    
    // Update display
    if (filteredCards.length > 0) {
        displayCard();
        elements.cardContainer.style.display = 'block';
        elements.loadingIndicator.style.display = 'none';
    } else {
        elements.cardContainer.style.display = 'none';
        elements.loadingIndicator.style.display = 'block';
        updateLoadingStatus('No cards match your filters', 'Try different filter criteria');
        
        // Update counter and category display
        elements.cardCountElement.textContent = 'Card 0 of 0';
        elements.categoryElement.textContent = 'No matches';
    }
}

/**
 * Display the current card
 */
function displayCard() {
    if (filteredCards.length === 0) {
        return;
    }
    
    const card = filteredCards[currentCardIndex];
    
    // Update card content
    elements.questionElement.textContent = card.question;
    elements.answerElement.textContent = card.answer;
    elements.categoryElement.textContent = card.category;
    elements.cardCountElement.textContent = `Card ${currentCardIndex + 1} of ${filteredCards.length}`;
    
    // Ensure card is showing the question side
    elements.flashcard.classList.remove('flipped');
    
    // Mark card as viewed
    if (card.id) {
        viewedCards.add(card.id);
        saveViewedCards();
        updateStats();
    }
}

/**
 * Update statistics display
 */
function updateStats() {
    elements.totalCardsElement.textContent = allCards.length;
    elements.categoryCountElement.textContent = new Set(allCards.map(card => card.category)).size;
    elements.viewedCountElement.textContent = viewedCards.size;
}

/**
 * Flip the card to show question/answer
 */
function flipCard() {
    elements.flashcard.classList.toggle('flipped');
}

/**
 * Navigate to the previous card
 */
function previousCard() {
    if (filteredCards.length === 0) return;
    
    currentCardIndex = (currentCardIndex - 1 + filteredCards.length) % filteredCards.length;
    displayCard();
}

/**
 * Navigate to the next card
 */
function nextCard() {
    if (filteredCards.length === 0) return;
    
    currentCardIndex = (currentCardIndex + 1) % filteredCards.length;
    displayCard();
}

/**
 * Shuffle the cards
 */
function shuffleCards() {
    if (filteredCards.length <= 1) return;
    
    // Fisher-Yates shuffle algorithm
    for (let i = filteredCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredCards[i], filteredCards[j]] = [filteredCards[j], filteredCards[i]];
    }
    
    currentCardIndex = 0;
    displayCard();
}

/**
 * Toggle auto-play mode
 */
function toggleAutoPlay() {
    if (filteredCards.length === 0) return;
    
    isPlaying = !isPlaying;
    
    if (isPlaying) {
        elements.playBtn.textContent = 'Pause';
        elements.playBtn.classList.add('paused');
        
        // Start auto-play
        playInterval = setInterval(() => {
            if (elements.flashcard.classList.contains('flipped')) {
                // If showing answer, flip back and move to next card
                elements.flashcard.classList.remove('flipped');
                setTimeout(nextCard, 400);
            } else {
                // If showing question, flip to answer
                elements.flashcard.classList.add('flipped');
            }
        }, CONFIG.autoPlayInterval);
    } else {
        elements.playBtn.textContent = 'Auto Play';
        elements.playBtn.classList.remove('paused');
        clearInterval(playInterval);
    }
}

/**
 * Handle offline functionality
 */
window.addEventListener('online', () => {
    console.log('Application is online. Refreshing data...');
    loadFlashcards();
});

window.addEventListener('offline', () => {
    console.log('Application is offline. Using cached data if available.');
    // Show a notification to the user
    if (!document.getElementById('offline-notice')) {
        const offlineNotice = document.createElement('div');
        offlineNotice.id = 'offline-notice';
        offlineNotice.style.cssText = 'background-color: #f39c12; color: white; text-align: center; padding: 10px; position: fixed; top: 0; left: 0; right: 0; z-index: 1000;';
        offlineNotice.textContent = 'You are offline. Using cached flashcards.';
        document.body.prepend(offlineNotice);
    }
});