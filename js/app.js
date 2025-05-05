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
            file: 'az-900.json'
        },
        { 
            id: 'aws-cloud', 
            name: 'AWS Cloud Concepts', 
            file: 'aws-flashcards.json'
        },
        { 
            id: 'security-plus', 
            name: 'Security+ Certification', 
            file: 'security-flashcards.json'
        }
    ],
    defaultDeck: 'azure-az900',
    currentDeckId: 'azure-az900', // Will be updated when user selects a deck
    autoPlayInterval: 3000, // Time in ms for auto-play transitions
    cacheExpiry: 24 * 60 * 60 * 1000, // Cache expiry time (24 hours)
    localStorageKeys: {
        data: 'flashcardsData_', // Will append deck ID
        timestamp: 'flashcardsTimestamp_', // Will append deck ID
        viewed: 'flashcardsViewed_', // Will append deck ID
        lastSelectedDeck: 'lastSelectedDeck'
    },
    swipeThreshold: 50 // Minimum distance required for a swipe to be registered
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
    return selectedDeck ? selectedDeck.file : CONFIG.decks[0].file;
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
 * Load flashcards from the remote JSON source
 * with caching for better performance
 */
async function loadFlashcards() {
    try {
        // Get the current deck name for display
        const selectedDeck = CONFIG.decks.find(deck => deck.id === CONFIG.currentDeckId);
        const deckName = selectedDeck ? selectedDeck.name : 'Flashcards';
        
        showLoading(`Loading ${deckName}...`, 'Checking cache');
        
        // Get local storage keys for the current deck
        const dataKey = CONFIG.localStorageKeys.data + CONFIG.currentDeckId;
        const timestampKey = CONFIG.localStorageKeys.timestamp + CONFIG.currentDeckId;
        
        // Try to get from cache first
        const cachedData = localStorage.getItem(dataKey);
        const cachedTimestamp = localStorage.getItem(timestampKey);
        
        // Use cache if available and not expired
        if (cachedData && cachedTimestamp && (Date.now() - Number(cachedTimestamp) < CONFIG.cacheExpiry)) {
            updateLoadingStatus(`Loading ${deckName}...`, 'Using cached data');
            console.log('Using cached flashcards data for deck:', CONFIG.currentDeckId);
            
            try {
                updateLoadingStatus(`Loading ${deckName}...`, 'Parsing cached data');
                allCards = JSON.parse(cachedData);
                updateLoadingStatus(`Loading ${deckName}...`, 'Cache loaded successfully');
            } catch (error) {
                console.error('Error parsing cached data:', error);
                updateLoadingStatus(`Loading ${deckName}...`, 'Cache error, fetching fresh data');
                // If cache is corrupted, fetch fresh data
                allCards = await fetchFlashcardsData();
            }
        } else {
            // Fetch fresh data
            updateLoadingStatus(`Loading ${deckName}...`, 'Fetching data from server');
            console.log('Fetching fresh flashcards data for deck:', CONFIG.currentDeckId);
            allCards = await fetchFlashcardsData();
            
            updateLoadingStatus(`Loading ${deckName}...`, 'Saving data to cache');
            // Cache the new data
            localStorage.setItem(dataKey, JSON.stringify(allCards));
            localStorage.setItem(timestampKey, Date.now().toString());
        }
        
        // Initialize filtered cards
        updateLoadingStatus(`Loading ${deckName}...`, 'Processing cards');
        filteredCards = [...allCards];
        
        // Populate category filter
        updateLoadingStatus(`Loading ${deckName}...`, 'Building category filters');
        populateCategoryFilter();
        
        // Update stats
        updateLoadingStatus(`Loading ${deckName}...`, 'Updating statistics');
        updateStats();
        
        // Display the first card
        if (filteredCards.length > 0) {
            updateLoadingStatus(`Loading ${deckName}...`, 'Preparing to display cards');
            displayCard();
            hideLoading();
            elements.cardContainer.style.display = 'block';
            // Show swipe tooltip on mobile
            showSwipeTooltip();
        } else {
            updateLoadingStatus('No flashcards found', 'Please try another deck');
        }
    } catch (error) {
        console.error('Error loading flashcards:', error);
        updateLoadingStatus('Error loading flashcards', error.message);
    }
}

/**
 * Fetch flashcards data from the remote URL
 * with error handling and retries
 */
async function fetchFlashcardsData(retries = 3) {
    try {
        const jsonUrl = getJsonUrl();
        console.log('Fetching data from:', jsonUrl);
        updateLoadingStatus('Fetching data...', `From ${jsonUrl}`);
        
        const response = await fetch(jsonUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        updateLoadingStatus('Fetching data...', 'Parsing JSON response');
        const data = await response.json();
        updateLoadingStatus('Fetching data...', `Loaded ${data.length} cards successfully`);
        console.log('Data fetched successfully:', data.length, 'cards');
        return data;
    } catch (error) {
        console.error(`Fetch error: ${error.message}`);
        updateLoadingStatus('Fetch error', `${error.message}`);
        
        if (retries > 0) {
            updateLoadingStatus('Fetch error', `Retrying... (${retries} attempts left)`);
            console.log(`Retrying fetch... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchFlashcardsData(retries - 1);
        }
        
        // If all retries fail, return empty array
        updateLoadingStatus('Fetch failed', 'Could not load flashcards');
        console.log('All fetch attempts failed. No flashcards loaded.');
        return [];
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