// --- Configuration ---
const API_KEY = '5a6c802c8add70016329db08b4995810';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1YTZjODAyYzhhZGQ3MDAxNjMyOWRiMDhiNDk5NTgxMCIsIm5iZiI6MTczNjc5MDAxNS43MTcsInN1YiI6IjY3ODU0ZmZmYWJhYmJiYTA0MGJiN2NhNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.TFTBecMHsQp2VIcTG4efSQFNSztXpUN0kDlrKcgjfBo';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280'; // High res for hero
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // Lower res for watchlist

// Mood Mappings (Genre IDs)
const MOODS = {
    any: { 
        movie: { include: [], exclude: [] },
        tv: { include: [], exclude: [] },
        label: "You Might Also Like"
    },
    chill: { 
        movie: { 
            include: [35, 10751, 16], 
            exclude: [27, 53, 10752, 80, 18] 
        },
        tv: { 
            include: [35, 10751, 16, 10762, 10767], // Comedy, Family, Animation, Kids, Talk
            exclude: [80, 18, 10768, 9648, 10759, 10765] // No Crime, Drama, War, Mystery, Action, Sci-Fi
        },
        label: "Chill & Fun Recommendations"
    },
    adrenaline: { 
        movie: { 
            include: [28, 12, 53], 
            exclude: [99, 10749, 36, 10751, 16] 
        },
        tv: { 
            include: [10759, 10765, 80, 37], // Action & Adventure, Sci-Fi & Fantasy, Crime, Western
            exclude: [99, 10766, 10767, 10763, 10764, 10751, 10762, 16, 35] // No Docs, Soap, Talk, News, Reality, Family, Kids, Animation, Comedy
        },
        label: "Adrenaline Recommendations"
    },
    brainy: { 
        movie: { 
            include: [99, 36, 878], 
            exclude: [35, 10749, 10751, 27, 28, 53] 
        },
        tv: { 
            include: [99, 10763, 10768, 80, 9648], // Documentary, News, War & Politics, Crime, Mystery
            exclude: [10764, 10766, 10762, 35, 16, 10759] // No Reality, Soap, Kids, Comedy, Animation, Action
        },
        label: "Brainy Recommendations"
    },
    dark: { 
        movie: { 
            include: [27, 80, 9648], 
            exclude: [35, 10751, 10749, 16, 12] 
        },
        tv: { 
            include: [80, 9648, 10768, 10765], // Crime, Mystery, War & Politics, Sci-Fi & Fantasy
            exclude: [35, 10751, 10762, 16, 10764, 10766, 10767, 10763] // No Comedy, Family, Kids, Animation, Reality, Soap, Talk, News
        },
        label: "Dark & Intense Recommendations"
    },
    emotional: { 
        movie: { 
            include: [18, 10749], 
            exclude: [27, 28, 878, 53, 80] 
        },
        tv: { 
            include: [18, 10766, 10751], // Drama, Soap, Family
            exclude: [10759, 10765, 80, 9648, 35, 16] // No Action, Sci-Fi, Crime, Mystery, Comedy, Animation
        },
        label: "Emotional Recommendations"
    }
};

// --- State Management ---
const state = {
    currentView: 'discovery', // 'discovery' | 'watchlist'
    mediaType: 'movie', // 'movie' | 'tv'
    genres: {}, // id -> name mapping
    currentItem: null,
    currentMood: 'any',
    watchlist: JSON.parse(localStorage.getItem('flickfix_watchlist')) || [],
    seenHistory: new Set() // Track session history to avoid repeats
};

// --- DOM Elements ---
const dom = {
    views: {
        discovery: document.getElementById('discovery-view'),
        watchlist: document.getElementById('watchlist-view')
    },
    buttons: {
        movie: document.getElementById('btn-movie'),
        tv: document.getElementById('btn-tv'),
        skip: document.getElementById('btn-skip'),
        add: document.getElementById('btn-add'),
        trailer: document.getElementById('btn-trailer'),
        details: document.getElementById('btn-details'),
        watchlistNav: document.getElementById('watchlist-btn'),
        logo: document.getElementById('logo-btn'),
        backToDiscover: document.getElementById('btn-back-to-discover'),
        moodBtn: document.getElementById('mood-btn'),
        moodText: document.getElementById('current-mood-text')
    },
    hero: {
        card: document.getElementById('hero-card'),
        poster: document.getElementById('poster-img'),
        title: document.getElementById('media-title'),
        rating: document.getElementById('rating-score'),
        overview: document.getElementById('media-overview'),
        genres: document.getElementById('genre-tags'),
        typeBadge: document.getElementById('media-type-badge'),
        loading: document.getElementById('loading-indicator')
    },
    watchlist: {
        grid: document.getElementById('watchlist-grid'),
        count: document.getElementById('watchlist-count'),
        empty: document.getElementById('empty-watchlist')
    },
    modal: {
        container: document.getElementById('details-modal'),
        backdrop: document.getElementById('modal-backdrop'),
        close: document.getElementById('modal-close'),
        title: document.getElementById('modal-title'),
        tagline: document.getElementById('modal-tagline'),
        image: document.getElementById('modal-backdrop-img'),
        castGrid: document.getElementById('modal-cast-grid'),
        similarList: document.getElementById('modal-similar-list'),
        similarTitle: document.getElementById('modal-similar-title')
    }
};

const colorThief = new ColorThief();

// --- API Handling ---
const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
};

async function fetchGenres() {
    try {
        const [movieGenres, tvGenres] = await Promise.all([
            fetch(`${BASE_URL}/genre/movie/list?language=en-US`, { headers }).then(r => r.json()),
            fetch(`${BASE_URL}/genre/tv/list?language=en-US`, { headers }).then(r => r.json())
        ]);

        const genreMap = {};
        [...movieGenres.genres, ...tvGenres.genres].forEach(g => {
            genreMap[g.id] = g.name;
        });
        state.genres = genreMap;
    } catch (error) {
        console.error('Failed to fetch genres:', error);
    }
}

async function fetchRandomContent() {
    setLoading(true);
    
    // Randomize page to ensure variety
    // If mood is selected, results are fewer, so we reduce the max page
    const maxPage = state.currentMood === 'any' ? 50 : 5; 
    const randomPage = Math.floor(Math.random() * maxPage) + 1; 
    
    let url = `${BASE_URL}/discover/${state.mediaType}?include_adult=false&language=en-US&sort_by=popularity.desc&page=${randomPage}&vote_count.gte=100`;
    
    // Apply Mood Filters
    if (state.currentMood !== 'any') {
        const moodConfig = MOODS[state.currentMood][state.mediaType];
        const includeIds = moodConfig.include.join('|'); // OR logic for inclusion
        const excludeIds = moodConfig.exclude.join(','); // AND logic for exclusion (don't want any of these)
        
        if (includeIds) url += `&with_genres=${includeIds}`;
        if (excludeIds) url += `&without_genres=${excludeIds}`;
    }

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Filter out items seen in this session
            const unseenResults = data.results.filter(item => !state.seenHistory.has(item.id));
            
            if (unseenResults.length === 0) {
                // If all on this page are seen, try another page (recurse cautiously)
                // To prevent infinite loops, we'll just allow a seen one if we really have to, 
                // or simpler: just pick a random one from the raw list
                 const randomIndex = Math.floor(Math.random() * data.results.length);
                 const item = data.results[randomIndex];
                 processItem(item);
                 return;
            }

            // Pick a random item from unseen
            const randomIndex = Math.floor(Math.random() * unseenResults.length);
            const item = unseenResults[randomIndex];
            processItem(item);

        } else {
            console.warn('No results found, retrying...');
            // Fallback to any mood if specific mood yields nothing? Or just retry.
            fetchRandomContent();
        }
    } catch (error) {
        console.error('Error fetching content:', error);
        dom.hero.title.textContent = "Error loading content. Please try again.";
        setLoading(false);
    }
}

function processItem(item) {
    // Check if it has a backdrop or poster
    if (!item.poster_path && !item.backdrop_path) {
        fetchRandomContent();
        return;
    }

    state.currentItem = item;
    state.seenHistory.add(item.id); // Mark as seen
    renderHero(item);
}

async function fetchTrailer(id, type) {
    try {
        const response = await fetch(`${BASE_URL}/${type}/${id}/videos?language=en-US`, { headers });
        const data = await response.json();
        
        // Find a YouTube trailer
        const trailer = data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || 
                        data.results.find(v => v.site === 'YouTube');
        
        if (trailer) {
            window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
        } else {
            // Fallback to YouTube search
            const query = encodeURIComponent(`${state.currentItem.title || state.currentItem.name} ${type} trailer`);
            window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
        }
    } catch (error) {
        console.error('Error fetching trailer:', error);
        const query = encodeURIComponent(`${state.currentItem.title || state.currentItem.name} trailer`);
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
    }
}

// --- Details Modal Logic ---

async function openDetailsModal() {
    if (!state.currentItem) return;
    
    const item = state.currentItem;
    const type = state.mediaType;

    // Show Modal
    dom.modal.container.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Disable scroll

    // Set Basic Info
    dom.modal.title.textContent = item.title || item.name;
    dom.modal.image.src = item.backdrop_path 
        ? `${IMAGE_BASE_URL}${item.backdrop_path}` 
        : (item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : '');
    
    dom.modal.tagline.textContent = 'Loading details...';
    dom.modal.castGrid.innerHTML = '<p class="text-gray-500">Loading cast...</p>';
    dom.modal.similarList.innerHTML = '<p class="text-gray-500">Loading similar...</p>';

    // Update Similar Title based on Mood
    // The default is set in index.html, but we override it here dynamically
    if (MOODS[state.currentMood]) {
        // Use innerHTML to preserve the icon
        dom.modal.similarTitle.innerHTML = `<i class="fas fa-film"></i> ${MOODS[state.currentMood].label}`;
    }

    // Fetch Full Details (for tagline/runtime etc)
    fetch(`${BASE_URL}/${type}/${item.id}?language=en-US`, { headers })
        .then(r => r.json())
        .then(details => {
            dom.modal.tagline.textContent = details.tagline || '';
        });

    // Fetch Credits
    fetch(`${BASE_URL}/${type}/${item.id}/credits?language=en-US`, { headers })
        .then(r => r.json())
        .then(data => {
            dom.modal.castGrid.innerHTML = '';
            const cast = data.cast.slice(0, 8); // Top 8
            if (cast.length === 0) dom.modal.castGrid.innerHTML = '<p class="text-gray-500 col-span-4">No cast info available.</p>';
            
            cast.forEach(actor => {
                const img = actor.profile_path ? `${POSTER_BASE_URL}${actor.profile_path}` : 'https://via.placeholder.com/150x225?text=No+Img';
                const el = document.createElement('div');
                el.className = 'flex items-center gap-3 bg-gray-800 rounded-lg p-2';
                el.innerHTML = `
                    <img src="${img}" class="w-10 h-10 rounded-full object-cover">
                    <div>
                        <p class="text-xs font-bold text-gray-200 leading-tight">${actor.name}</p>
                        <p class="text-xs text-gray-400 leading-tight">${actor.character}</p>
                    </div>
                `;
                dom.modal.castGrid.appendChild(el);
            });
        });

    // Fetch Similar
    fetch(`${BASE_URL}/${type}/${item.id}/recommendations?language=en-US&page=1`, { headers })
        .then(r => r.json())
        .then(data => {
            dom.modal.similarList.innerHTML = '';
            
            let similar = data.results || [];

            // Filter recommendations based on active Mood
            if (state.currentMood !== 'any') {
                const moodConfig = MOODS[state.currentMood][type];
                similar = similar.filter(sim => {
                    // 1. Must NOT contain any excluded genres
                    const hasExcluded = sim.genre_ids.some(id => moodConfig.exclude.includes(id));
                    if (hasExcluded) return false;

                    // 2. Must contain AT LEAST ONE included genre (to ensure vibe consistency)
                    const hasIncluded = sim.genre_ids.some(id => moodConfig.include.includes(id));
                    return hasIncluded;
                });
            }

            // Take top 6 matching results
            similar = similar.slice(0, 6);

            if (similar.length === 0) {
                dom.modal.similarList.innerHTML = '<p class="text-gray-500 italic">No recommendations match your current mood.</p>';
                return;
            }
            
            similar.forEach(sim => {
                if (!sim.poster_path) return;
                const el = document.createElement('div');
                el.className = 'min-w-[120px] w-[120px] cursor-pointer hover:scale-105 transition-transform group';
                el.innerHTML = `
                    <div class="relative rounded-lg overflow-hidden shadow-md mb-2">
                        <img src="${POSTER_BASE_URL}${sim.poster_path}" class="w-full h-auto">
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i class="fas fa-play text-white text-2xl"></i>
                        </div>
                    </div>
                    <p class="text-xs text-center text-gray-300 truncate group-hover:text-white transition-colors">${sim.title || sim.name}</p>
                `;
                // Clicking a similar movie loads it into the main view and closes modal
                el.addEventListener('click', () => {
                    closeModal();
                    state.currentItem = sim;
                    state.mediaType = sim.media_type || type; // Recommendations usually match type but safety check
                    renderHero(sim);
                    window.scrollTo(0, 0);
                });
                dom.modal.similarList.appendChild(el);
            });
        });
}

function closeModal() {
    dom.modal.container.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- DOM Manipulation ---

function setLoading(isLoading) {
    if (isLoading) {
        dom.hero.card.classList.add('hidden');
        dom.hero.loading.classList.remove('hidden');
    } else {
        dom.hero.card.classList.remove('hidden');
        dom.hero.loading.classList.add('hidden');
        // Trigger reflow for animation
        dom.hero.card.classList.remove('slide-up');
        void dom.hero.card.offsetWidth;
        dom.hero.card.classList.add('slide-up');
    }
}

function renderHero(item) {
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date;
    const year = date ? date.split('-')[0] : 'N/A';
    
    // Reset background while loading new one
    document.body.style.background = 'linear-gradient(to bottom, #111827, #000000)';

    // Setup poster for Color Thief
    dom.hero.poster.crossOrigin = "anonymous";
    dom.hero.poster.src = item.poster_path 
        ? `${IMAGE_BASE_URL}${item.poster_path}` 
        : 'https://via.placeholder.com/500x750?text=No+Image';
    
    dom.hero.poster.onload = () => {
        try {
            const color = colorThief.getColor(dom.hero.poster);
            const [r, g, b] = color;
            // Apply gradient to body
            const bgStyle = `linear-gradient(to bottom, rgba(${r},${g},${b},0.8), #000000)`;
            document.body.style.background = bgStyle;
            state.currentBackgroundColor = bgStyle; // Save for view toggling
            
            // Optional: Add a subtle glow to the card
            dom.hero.card.style.boxShadow = `0 20px 50px rgba(${r},${g},${b},0.3)`;
        } catch (e) {
            console.warn('Could not extract color', e);
            document.body.style.background = 'linear-gradient(to bottom, #111827, #000000)';
            state.currentBackgroundColor = null;
        }
    };

    dom.hero.title.textContent = `${title} (${year})`;
    dom.hero.rating.textContent = item.vote_average.toFixed(1);
    dom.hero.overview.textContent = item.overview || "No overview available.";
    dom.hero.typeBadge.textContent = state.mediaType === 'movie' ? 'Movie' : 'TV Show';
    
    // Genres
    dom.hero.genres.innerHTML = '';
    if (item.genre_ids) {
        item.genre_ids.slice(0, 3).forEach(id => {
            if (state.genres[id]) {
                const span = document.createElement('span');
                span.className = 'text-xs border border-gray-600 px-2 py-1 rounded-full text-gray-400';
                span.textContent = state.genres[id];
                dom.hero.genres.appendChild(span);
            }
        });
    }

    // Check if already in watchlist to update button state
    const isInWatchlist = state.watchlist.some(i => i.id === item.id);
    updateAddButton(isInWatchlist);

    setLoading(false);
}

function updateAddButton(saved) {
    const btn = dom.buttons.add;
    if (saved) {
        btn.innerHTML = '<i class="fas fa-check"></i> Saved';
        btn.classList.remove('bg-green-600', 'hover:bg-green-500');
        btn.classList.add('bg-gray-600', 'cursor-default');
    } else {
        btn.innerHTML = '<i class="fas fa-plus"></i> Add to Watchlist';
        btn.classList.add('bg-green-600', 'hover:bg-green-500');
        btn.classList.remove('bg-gray-600', 'cursor-default');
    }
}

function renderWatchlist() {
    dom.watchlist.grid.innerHTML = '';
    dom.watchlist.count.textContent = state.watchlist.length;

    if (state.watchlist.length === 0) {
        dom.watchlist.empty.classList.remove('hidden');
        return;
    } else {
        dom.watchlist.empty.classList.add('hidden');
    }

    // Sort by most recently added (which is the end of the array usually, so reverse)
    const reversedList = [...state.watchlist].reverse();

    reversedList.forEach(item => {
        const title = item.title || item.name;
        const posterUrl = item.poster_path 
            ? `${POSTER_BASE_URL}${item.poster_path}` 
            : 'https://via.placeholder.com/500x750?text=No+Image';

        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg overflow-hidden shadow-lg group relative hover:scale-105 transition-transform duration-200';
        
        card.innerHTML = `
            <div class="relative aspect-[2/3]">
                <img src="${posterUrl}" alt="${title}" class="w-full h-full object-cover">
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button class="remove-btn absolute top-2 right-2 bg-red-600/90 text-white w-8 h-8 rounded-full hover:bg-red-700 flex items-center justify-center shadow-md transform hover:scale-110 transition-all z-10" data-id="${item.id}" title="Remove">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent pointer-events-none">
                    <div class="flex items-center text-yellow-400 text-xs font-bold">
                        <i class="fas fa-star mr-1"></i> ${item.vote_average.toFixed(1)}
                    </div>
                </div>
            </div>
            <div class="p-3">
                <h3 class="font-bold text-sm truncate text-gray-200">${title}</h3>
            </div>
        `;
        
        // Add delete functionality
        card.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromWatchlist(item.id);
        });

        // Add click functionality to open details
        card.addEventListener('click', () => {
            state.currentItem = item;
            state.mediaType = item.media_type || 'movie'; // Default to movie if type missing
            openDetailsModal();
        });

        dom.watchlist.grid.appendChild(card);
    });
}

function removeFromWatchlist(id) {
    state.watchlist = state.watchlist.filter(item => item.id !== id);
    saveWatchlist();
    renderWatchlist();
    // Update button if we are viewing that movie currently
    if (state.currentItem && state.currentItem.id === id) {
        updateAddButton(false);
    }
}

function saveWatchlist() {
    localStorage.setItem('flickfix_watchlist', JSON.stringify(state.watchlist));
    dom.watchlist.count.textContent = state.watchlist.length;
}

function toggleView(view) {
    state.currentView = view;
    if (view === 'discovery') {
        dom.views.discovery.classList.remove('hidden');
        dom.views.watchlist.classList.add('hidden');
        window.scrollTo(0, 0);
        
        // Restore background if we have a current item color
        if (state.currentBackgroundColor) {
            document.body.style.background = state.currentBackgroundColor;
        }
    } else {
        dom.views.discovery.classList.add('hidden');
        dom.views.watchlist.classList.remove('hidden');
        
        // Reset background for watchlist
        document.body.style.background = 'linear-gradient(to bottom, #111827, #000000)';
        
        renderWatchlist();
    }
}

// --- Event Listeners ---

dom.buttons.skip.addEventListener('click', () => {
    fetchRandomContent();
});

dom.buttons.add.addEventListener('click', () => {
    if (!state.currentItem) return;
    
    // Check duplicates
    if (!state.watchlist.some(i => i.id === state.currentItem.id)) {
        // Add media_type to item before saving, as fetch result might not have it explicitly in 'discover' sometimes
        const itemToSave = { ...state.currentItem, media_type: state.mediaType };
        state.watchlist.push(itemToSave);
        saveWatchlist();
        updateAddButton(true);
        
        // Visual feedback
        const icon = dom.buttons.add.querySelector('i');
        icon.classList.remove('fa-plus');
        icon.classList.add('fa-check');
    }
});

dom.buttons.trailer.addEventListener('click', () => {
    if (state.currentItem) {
        fetchTrailer(state.currentItem.id, state.mediaType);
    }
});

dom.buttons.movie.addEventListener('click', () => {
    if (state.mediaType !== 'movie') {
        state.mediaType = 'movie';
        dom.buttons.movie.classList.add('bg-red-600', 'text-white', 'shadow-md');
        dom.buttons.movie.classList.remove('text-gray-400');
        
        dom.buttons.tv.classList.remove('bg-red-600', 'text-white', 'shadow-md');
        dom.buttons.tv.classList.add('text-gray-400');
        
        fetchRandomContent();
    }
});

dom.buttons.tv.addEventListener('click', () => {
    if (state.mediaType !== 'tv') {
        state.mediaType = 'tv';
        dom.buttons.tv.classList.add('bg-red-600', 'text-white', 'shadow-md');
        dom.buttons.tv.classList.remove('text-gray-400');
        
        dom.buttons.movie.classList.remove('bg-red-600', 'text-white', 'shadow-md');
        dom.buttons.movie.classList.add('text-gray-400');
        
        fetchRandomContent();
    }
});

dom.buttons.watchlistNav.addEventListener('click', () => {
    toggleView('watchlist');
});

dom.buttons.logo.addEventListener('click', () => {
    toggleView('discovery');
});

dom.buttons.backToDiscover.addEventListener('click', () => {
    toggleView('discovery');
});

dom.buttons.details.addEventListener('click', openDetailsModal);
dom.modal.close.addEventListener('click', closeModal);
dom.modal.backdrop.addEventListener('click', closeModal);

// Mood Dropdown Logic
const moodOptions = document.querySelectorAll('.mood-option');
moodOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
        // Use currentTarget to ensure we get the button's data, not the child element's
        const mood = e.currentTarget.dataset.mood;
        
        // Get text from the span with class font-medium inside the button
        const textSpan = e.currentTarget.querySelector('.font-medium');
        const text = textSpan ? textSpan.innerText : 'Any Mood';
        
        state.currentMood = mood;
        dom.buttons.moodText.innerText = text;
        
        // Refresh content with new mood
        fetchRandomContent();
    });
});


// --- Initialization ---

async function init() {
    await fetchGenres();
    renderWatchlist(); // Init count
    fetchRandomContent();
}

// Start app
document.addEventListener('DOMContentLoaded', init);
