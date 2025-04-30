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

// Configuration
const CONFIG = {
    // Replace this URL with the actual location of your JSON file
    jsonUrl: '/flashcards.json',
    autoPlayInterval: 3000, // Time in ms for auto-play transitions
    cacheExpiry: 24 * 60 * 60 * 1000, // Cache expiry time (24 hours)
    localStorageKeys: {
        data: 'flashcardsData',
        timestamp: 'flashcardsTimestamp',
        viewed: 'flashcardsViewed'
    }
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
    
    // Add event listeners
    elements.flashcard.addEventListener('click', flipCard);
    elements.prevBtn.addEventListener('click', previousCard);
    elements.nextBtn.addEventListener('click', nextCard);
    elements.shuffleBtn.addEventListener('click', shuffleCards);
    elements.playBtn.addEventListener('click', toggleAutoPlay);
    elements.categoryFilter.addEventListener('change', filterCards);
    elements.searchInput.addEventListener('input', filterCards);
    
    // Load previously viewed cards from local storage
    loadViewedCards();
    
    // Load the flashcards data
    loadFlashcards();
});

/**
 * Load viewed cards from local storage
 */
function loadViewedCards() {
    const viewedCardsData = localStorage.getItem(CONFIG.localStorageKeys.viewed);
    if (viewedCardsData) {
        const viewedCardsArray = JSON.parse(viewedCardsData);
        viewedCards = new Set(viewedCardsArray);
    }
}

/**
 * Save viewed cards to local storage
 */
function saveViewedCards() {
    const viewedCardsArray = Array.from(viewedCards);
    localStorage.setItem(CONFIG.localStorageKeys.viewed, JSON.stringify(viewedCardsArray));
}

/**
 * Load flashcards from the remote JSON source
 * with caching for better performance
 */
async function loadFlashcards() {
    try {
        elements.loadingIndicator.textContent = 'Loading flashcards...';
        
        // Try to get from cache first
        const cachedData = localStorage.getItem(CONFIG.localStorageKeys.data);
        const cachedTimestamp = localStorage.getItem(CONFIG.localStorageKeys.timestamp);
        
        // Use cache if available and not expired
        if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < CONFIG.cacheExpiry)) {
            console.log('Using cached flashcards data');
            allCards = JSON.parse(cachedData);
        } else {
            // Fetch fresh data
            console.log('Fetching fresh flashcards data');
            allCards = await fetchFlashcardsData();
            
            // Cache the new data
            localStorage.setItem(CONFIG.localStorageKeys.data, JSON.stringify(allCards));
            localStorage.setItem(CONFIG.localStorageKeys.timestamp, Date.now().toString());
        }
        
        // Initialize filtered cards
        filteredCards = [...allCards];
        
        // Populate category filter
        populateCategoryFilter();
        
        // Update stats
        updateStats();
        
        // Display the first card
        if (filteredCards.length > 0) {
            displayCard();
            elements.loadingIndicator.style.display = 'none';
            elements.cardContainer.style.display = 'block';
        } else {
            elements.loadingIndicator.textContent = 'No flashcards found.';
        }
    } catch (error) {
        console.error('Error loading flashcards:', error);
        elements.loadingIndicator.textContent = 'Error loading flashcards. Please try again later.';
    }
}

/**
 * Fetch flashcards data from the remote URL
 * with error handling and retries
 */
async function fetchFlashcardsData(retries = 3) {
    try {
        const response = await fetch(CONFIG.jsonUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Fetch error: ${error.message}`);
        
        if (retries > 0) {
            console.log(`Retrying fetch... (${retries} attempts left)`);
            // Wait 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchFlashcardsData(retries - 1);
        }
        
        throw error;
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
        elements.loadingIndicator.textContent = 'No cards match your filters.';
        
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