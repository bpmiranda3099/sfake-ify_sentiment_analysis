async function fetchYouTubeVideo(title) {
    try {
        // Use the backend's music search endpoint to find the most relevant songs
        const searchResponse = await fetch(`/music-search?query=${encodeURIComponent(title)}&searchEngine=gaama`);
        if (!searchResponse.ok) {
            console.error("Error searching for music.");
            return null;
        }

        const data = await searchResponse.json();
        return data.response; // Return the response array from the music API
    } catch (error) {
        console.error("An error occurred while searching for music:", error);
        return null;
    }
}

// Show a centered loading spinner while waiting for results
function showLoadingSpinner() {
    resultsContainer.innerHTML = '<div class="spinner-container"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
}

// Get reference to results container element
const resultsContainer = document.getElementById("resultsContainer");

async function searchAndDisplayResults() {
    const searchBar = document.getElementById("searchBar");
    const title = searchBar.value;
    if (!title) {
        alert("Please enter a music title to search.");
        return;
    }

    showSearchView();
    showLoadingSpinner();

    const response = await fetch(`/music-search?query=${encodeURIComponent(title)}&searchEngine=gaama`);
    const data = await response.json();

    if (data.response && data.response.length > 0) {
        resultsContainer.innerHTML = ""; // Clear previous results

        data.response.forEach((result) => {
            // Create spotify-styled card
            const card = document.createElement("div");
            card.className = "result-card";
            
            // For music API we don't have view count or duration, so adapt the card
            card.innerHTML = `
                <img src="${result.img}" alt="${result.title}" class="thumbnail" />
                <h3 title="${result.title}">${result.title}</h3>
                <p>${result.id.substring(0, 8)}...</p>
                <button onclick="selectVideo('${result.id}', '${result.title.replace(/'/g, "\\'")}', '${result.img.replace(/'/g, "\\'")}', 'Artist')">
                    <i class="fas fa-play"></i>
                </button>
            `;
            resultsContainer.appendChild(card);
        });
    } else {
        resultsContainer.innerHTML = '<div class="text-center text-secondary mt-5"><i class="fas fa-search mb-3" style="font-size: 48px;"></i><p>No results found. Try different keywords.</p></div>';
    }
}

// Integrate audio functionality into the Spotify-themed player
const audioPlayer = new Audio();
const playPauseButton = document.querySelector('.play-pause');
const progressBar = document.querySelector('.progress');
const progressContainer = document.querySelector('.progress-bar');
const nowPlaying = document.querySelector('.song-description .title');

// Time display elements
const currentTimeEl = document.querySelector('.progress-container span:first-child');
const totalTimeEl = document.querySelector('.progress-container span:last-child');

// Control buttons
const shuffleButton = document.querySelector('.fa-random');
const previousButton = document.querySelector('.fa-step-backward');
const nextButton = document.querySelector('.fa-step-forward');
const repeatButton = document.querySelector('.fa-undo-alt');

// Player state variables
let isShuffleEnabled = false;
let isRepeatEnabled = false;
let playHistory = []; // To keep track of played songs for going backward

// Volume control elements
const volumeBar = document.querySelector('.volume-bar .progress-bar');
const volumeProgress = document.querySelector('.volume-bar .progress');
const volumeIcon = document.querySelector('.volume-bar i');

// Initialize volume (get from localStorage or set default)
let currentVolume = localStorage.getItem('musicPlayerVolume') ? 
    parseFloat(localStorage.getItem('musicPlayerVolume')) : 0.7;
audioPlayer.volume = currentVolume;
updateVolumeUI();

// Shuffle button functionality
shuffleButton.addEventListener('click', () => {
    isShuffleEnabled = !isShuffleEnabled;
    
    if (isShuffleEnabled) {
        shuffleButton.style.color = '#1DB954'; // Spotify green when active
        // Shuffle the queue if there are songs
        if (queue.length > 1) {
            queue = shuffleArray([...queue]);
            saveQueue();
            updateQueueDisplay();
        }
    } else {
        shuffleButton.style.color = ''; // Reset to default color
    }
});

// Previous button functionality
previousButton.addEventListener('click', () => {
    // If current time is more than 3 seconds, restart the song
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    
    // If there's a previous song in history, play it
    if (playHistory.length > 0) {
        const previousSong = playHistory.pop();
        selectVideo(previousSong.videoId, previousSong.title, previousSong.thumbnail, previousSong.channel);
    } else if (recentlyPlayed.length > 1) {
        // If no history but there are recently played songs, play the second one (since first is current)
        const previousSong = recentlyPlayed[1];
        selectVideo(previousSong.videoId, previousSong.title, previousSong.thumbnail, previousSong.channel);
    }
});

// Next button functionality
nextButton.addEventListener('click', () => {
    // Add current song to history before moving to next
    if (currentVideoId) {
        const currentSongTitle = document.querySelector('.song-description .title').textContent;
        const currentSongArtist = document.querySelector('.song-description .artist').textContent;
        const currentSongThumbnail = document.querySelector('.image-container img').src;
        
        playHistory.push({
            videoId: currentVideoId,
            title: currentSongTitle,
            channel: currentSongArtist,
            thumbnail: currentSongThumbnail
        });
    }
    
    // If there are songs in queue, play the next one
    if (queue.length > 0) {
        const nextSong = queue[0];
        removeFromQueue(0);
        selectVideo(nextSong.videoId, nextSong.title, nextSong.thumbnail, nextSong.channel);
    } else if (isShuffleEnabled && recentlyPlayed.length > 0) {
        // If shuffle is enabled, play a random song from recently played
        const randomIndex = Math.floor(Math.random() * recentlyPlayed.length);
        const randomSong = recentlyPlayed[randomIndex];
        selectVideo(randomSong.videoId, randomSong.title, randomSong.thumbnail, randomSong.channel);
    }
});

// Repeat button functionality
repeatButton.addEventListener('click', () => {
    isRepeatEnabled = !isRepeatEnabled;
    
    if (isRepeatEnabled) {
        repeatButton.style.color = '#1DB954'; // Spotify green when active
        audioPlayer.loop = true;
    } else {
        repeatButton.style.color = ''; // Reset to default color
        audioPlayer.loop = false;
    }
});

// When a new song is selected, preserve the repeat status
function updateRepeatStatus() {
    if (isRepeatEnabled) {
        audioPlayer.loop = true;
        repeatButton.style.color = '#1DB954'; // Spotify green when active
    } else {
        audioPlayer.loop = false;
        repeatButton.style.color = ''; // Reset to default color
    }
}

// Add event listener for when audio ends
audioPlayer.addEventListener('ended', () => {
    if (isRepeatEnabled) {
        // Will automatically replay due to loop=true
        return;
    }
    
    // Add current song to history before moving to next
    if (currentVideoId) {
        const currentSongTitle = document.querySelector('.song-description .title').textContent;
        const currentSongArtist = document.querySelector('.song-description .artist').textContent;
        const currentSongThumbnail = document.querySelector('.image-container img').src;
        
        playHistory.push({
            videoId: currentVideoId,
            title: currentSongTitle,
            channel: currentSongArtist,
            thumbnail: currentSongThumbnail
        });
    }
    
    // If there's songs in the queue, play the next one
    if (queue.length > 0) {
        const nextSong = queue[0];
        removeFromQueue(0);
        selectVideo(nextSong.videoId, nextSong.title, nextSong.thumbnail, nextSong.channel);
    } else if (isShuffleEnabled && recentlyPlayed.length > 0) {
        // If shuffle is enabled, play a random song from recently played
        const randomIndex = Math.floor(Math.random() * recentlyPlayed.length);
        const randomSong = recentlyPlayed[randomIndex];
        selectVideo(randomSong.videoId, randomSong.title, randomSong.thumbnail, randomSong.channel);
    } else {
        // Reset the player if no songs in queue and no shuffle
        playPauseButton.classList.remove('fa-pause');
        playPauseButton.classList.add('fa-play');
    }
});

// Play or pause the audio when the play/pause button is clicked
playPauseButton.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseButton.classList.remove('fa-play');
        playPauseButton.classList.add('fa-pause');
    } else {
        audioPlayer.pause();
        playPauseButton.classList.remove('fa-pause');
        playPauseButton.classList.add('fa-play');
    }
});

// Update the progress bar as the audio plays
audioPlayer.addEventListener('timeupdate', () => {
    const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progressPercent}%`;

    // Update time display
    const currentMinutes = Math.floor(audioPlayer.currentTime / 60);
    const currentSeconds = Math.floor(audioPlayer.currentTime % 60);
    const totalMinutes = Math.floor(audioPlayer.duration / 60) || 0;
    const totalSeconds = Math.floor(audioPlayer.duration % 60) || 0;
    
    // Format time display with leading zeros for seconds
    currentTimeEl.textContent = `${currentMinutes}:${currentSeconds < 10 ? '0' + currentSeconds : currentSeconds}`;
    
    // Only update total time if duration is available and valid
    if (!isNaN(audioPlayer.duration)) {
        totalTimeEl.textContent = `${totalMinutes}:${totalSeconds < 10 ? '0' + totalSeconds : totalSeconds}`;
    } else {
        totalTimeEl.textContent = '0:00';
    }
});

// Seek to a specific time in the audio when the progress bar is clicked
progressContainer.addEventListener('click', (e) => {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    audioPlayer.currentTime = (clickX / width) * duration;
});

// Volume control functionality
volumeBar.addEventListener('click', (e) => {
    const width = volumeBar.clientWidth;
    const clickX = e.offsetX;
    const volume = clickX / width;
    
    // Set volume between 0 and 1
    setVolume(volume);
});

// Set volume and update UI
function setVolume(volume) {
    // Clamp volume between 0 and 1
    volume = Math.max(0, Math.min(1, volume));
    
    // Update audio player volume
    audioPlayer.volume = volume;
    
    // Save to localStorage
    localStorage.setItem('musicPlayerVolume', volume);
    currentVolume = volume;
    
    // Update UI
    updateVolumeUI();
    
    // Update volume icon based on volume level
    updateVolumeIcon();
}

// Update volume UI
function updateVolumeUI() {
    volumeProgress.style.width = `${currentVolume * 100}%`;
}

// Update volume icon based on volume level
function updateVolumeIcon() {
    volumeIcon.className = '';  // Clear existing classes
    
    if (audioPlayer.muted || currentVolume === 0) {
        volumeIcon.classList.add('fas', 'fa-volume-mute');
    } else if (currentVolume < 0.3) {
        volumeIcon.classList.add('fas', 'fa-volume-off');
    } else if (currentVolume < 0.7) {
        volumeIcon.classList.add('fas', 'fa-volume-down');
    } else {
        volumeIcon.classList.add('fas', 'fa-volume-up');
    }
}

// Toggle mute when clicking on the volume icon
volumeIcon.addEventListener('click', () => {
    if (audioPlayer.muted) {
        audioPlayer.muted = false;
        setVolume(currentVolume || 0.7); // Restore previous volume or default
    } else {
        audioPlayer.muted = true;
        volumeProgress.style.width = '0%';
        updateVolumeIcon();
    }
});

// Favorites functionality
let favorites = [];
let currentVideoId = null;
const heartIcon = document.querySelector('.song-bar .icons .fa-heart');
const favoritesContainer = document.getElementById('favorites-container');
const emptyFavorites = document.getElementById('empty-favorites');
const filterPills = document.querySelectorAll('.filter-pill');
let currentFilter = 'all';

// Load favorites from localStorage on page load
function loadFavorites() {
    const storedFavorites = localStorage.getItem('musicPlayerFavorites');
    if (storedFavorites) {
        favorites = JSON.parse(storedFavorites);
        updateFavoritesDisplay();
    }
}

// Save favorites to localStorage
function saveFavorites() {
    localStorage.setItem('musicPlayerFavorites', JSON.stringify(favorites));
}

// Toggle favorite status
function toggleFavorite() {
    if (!currentVideoId) return;
    
    const currentSongIndex = favorites.findIndex(item => item.videoId === currentVideoId);
    
    if (currentSongIndex !== -1) {
        // Remove from favorites
        favorites.splice(currentSongIndex, 1);
        heartIcon.classList.remove('fas', 'favorited');
        heartIcon.classList.add('far');
    } else {
        // Add to favorites
        const songTitle = document.querySelector('.song-description .title').textContent;
        const songArtist = document.querySelector('.song-description .artist').textContent;
        const songThumbnail = document.querySelector('.image-container img').src;
        
        favorites.push({
            videoId: currentVideoId,
            title: songTitle,
            channel: songArtist,
            thumbnail: songThumbnail,
            timestamp: Date.now()
        });
        
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas', 'favorited');
    }
    
    saveFavorites();
    updateFavoritesDisplay();
}

// Update favorites display based on the current filter
function updateFavoritesDisplay() {
    if (favorites.length === 0) {
        favoritesContainer.style.display = 'none';
        emptyFavorites.style.display = 'block';
        return;
    }
    
    favoritesContainer.style.display = 'flex';
    emptyFavorites.style.display = 'none';
    
    // Clear the favorites container
    favoritesContainer.innerHTML = '';
    
    if (currentFilter === 'all') {
        // Display all favorites
        favorites.forEach(song => {
            addFavoriteItemToDOM(song);
        });
    } 
    else if (currentFilter === 'artists') {
        // Group by artists/channels
        const channels = {};
        favorites.forEach(song => {
            if (!channels[song.channel]) {
                channels[song.channel] = [];
            }
            channels[song.channel].push(song);
        });
        
        // Display channels
        Object.keys(channels).forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.className = 'channel-item';
            channelItem.innerHTML = `
                <p class="channel-name">${channel}</p>
                <span class="song-count">${channels[channel].length} songs</span>
            `;
            channelItem.addEventListener('click', () => {
                showChannelSongs(channel);
            });
            favoritesContainer.appendChild(channelItem);
        });
    }
    else if (currentFilter === 'channels') {
        // Show all songs from the currently selected channel
        if (window.selectedChannel) {
            const channelSongs = favorites.filter(song => song.channel === window.selectedChannel);
            
            // Add a back button
            const backButton = document.createElement('div');
            backButton.className = 'channel-item';
            backButton.innerHTML = `
                <p class="channel-name"><i class="fas fa-arrow-left mr-2"></i> Back to Artists</p>
            `;
            backButton.addEventListener('click', () => {
                window.selectedChannel = null;
                setActiveFilter('artists');
            });
            favoritesContainer.appendChild(backButton);
            
            // Add channel name
            const channelTitle = document.createElement('h3');
            channelTitle.className = 'mt-3 mb-3';
            channelTitle.textContent = window.selectedChannel;
            favoritesContainer.appendChild(channelTitle);
            
            // Add songs
            channelSongs.forEach(song => {
                addFavoriteItemToDOM(song);
            });
        }
    }
}

// Helper function to add a favorite item to the DOM
function addFavoriteItemToDOM(song) {
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'favorite-item';
    favoriteItem.dataset.videoId = song.videoId;
    favoriteItem.innerHTML = `
        <img src="${song.thumbnail}" alt="${song.title}" class="item-img">
        <div class="item-info">
            <p class="item-title">${song.title}</p>
            <p class="item-artist">${song.channel}</p>
        </div>
        <div class="menu-dots">
            <i class="fas fa-ellipsis-v"></i>
            <div class="dropdown-menu">
                <div class="menu-option add-to-queue">
                    <i class="fas fa-list"></i>
                </div>
                <div class="menu-option remove-favorite">
                    <i class="fas fa-trash-alt"></i>
                </div>
            </div>
        </div>
    `;
    
    // Add click event to play the song when clicking on the item
    favoriteItem.addEventListener('click', (e) => {
        // Ignore if the click is on the menu or its children
        if (e.target.closest('.menu-dots')) {
            return;
        }
        selectVideo(song.videoId, song.title, song.thumbnail, song.channel);
    });
    
    // Menu dots click handler
    const menuDots = favoriteItem.querySelector('.menu-dots');
    menuDots.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdownMenu(menuDots);
    });
    
    // Add to queue option handler
    const addToQueueOption = favoriteItem.querySelector('.add-to-queue');
    addToQueueOption.addEventListener('click', (e) => {
        e.stopPropagation();
        addToQueue(song);
        // Hide the dropdown menu after selection
        menuDots.querySelector('.dropdown-menu').classList.remove('show');
    });
    
    // Remove from favorites option handler
    const removeFavoriteOption = favoriteItem.querySelector('.remove-favorite');
    removeFavoriteOption.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromFavorites(song.videoId);
        // Hide the dropdown menu after selection
        menuDots.querySelector('.dropdown-menu').classList.remove('show');
    });
    
    favoritesContainer.appendChild(favoriteItem);
}

// Function to toggle dropdown menu visibility
function toggleDropdownMenu(menuElement) {
    // Close any open dropdown menus first
    const openMenus = document.querySelectorAll('.dropdown-menu.show');
    openMenus.forEach(menu => {
        if (menu !== menuElement.querySelector('.dropdown-menu')) {
            menu.classList.remove('show');
        }
    });
    
    // Toggle the clicked menu
    const dropdownMenu = menuElement.querySelector('.dropdown-menu');
    dropdownMenu.classList.toggle('show');
    
    // Add click outside listener to close the menu
    setTimeout(() => {
        document.addEventListener('click', closeDropdownMenus);
    }, 0);
}

// Function to close all dropdown menus
function closeDropdownMenus(e) {
    if (!e.target.closest('.menu-dots')) {
        const openMenus = document.querySelectorAll('.dropdown-menu.show');
        openMenus.forEach(menu => menu.classList.remove('show'));
        document.removeEventListener('click', closeDropdownMenus);
    }
}

// Function to remove a song from favorites
function removeFromFavorites(videoId) {
    // Find the index of the song in the favorites array
    const songIndex = favorites.findIndex(song => song.videoId === videoId);
    
    if (songIndex !== -1) {
        // Remove from favorites
        favorites.splice(songIndex, 1);
        
        // Save updated favorites to localStorage
        saveFavorites();
        
        // Update favorites display
        updateFavoritesDisplay();
        
        // If this is the currently playing song, update the heart icon
        if (currentVideoId === videoId) {
            heartIcon.classList.remove('fas', 'favorited');
            heartIcon.classList.add('far');
        }
    }
}

// Function to show all songs from a specific channel
function showChannelSongs(channel) {
    window.selectedChannel = channel;
    setActiveFilter('channels');
}

// Set active filter
function setActiveFilter(filter) {
    currentFilter = filter;
    
    // Update active class on filter pills
    filterPills.forEach(pill => {
        if (pill.dataset.filter === filter) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    updateFavoritesDisplay();
}

// Add event listeners for filter pills
filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
        if (pill.dataset.filter !== 'channels' || window.selectedChannel) {
            setActiveFilter(pill.dataset.filter);
        }
    });
});

// Add event listener to heart icon
heartIcon.addEventListener('click', toggleFavorite);

// Modified selectVideo function to update heart icon
function selectVideo(songId, title, thumbnail, channelName) {
    const songBar = document.querySelector('.song-bar');
    const songThumbnail = document.querySelector('.image-container img');
    const artistElement = document.querySelector('.song-description .artist');
    
    // Set current video ID
    currentVideoId = songId;

    // Show loading state
    playPauseButton.classList.remove('fa-play', 'fa-pause');
    playPauseButton.classList.add('fa-spinner', 'fa-spin');

    // Update the thumbnail and artist name immediately
    songThumbnail.src = thumbnail;
    artistElement.textContent = channelName;

    // Update heart icon based on favorite status
    const isFavorite = favorites.some(item => item.videoId === songId);
    if (isFavorite) {
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas', 'favorited');
    } else {
        heartIcon.classList.remove('fas', 'favorited');
        heartIcon.classList.add('far');
    }

    // Fetch the streaming URL from the Music API
    fetch(`/music-fetch?id=${encodeURIComponent(songId)}`)
        .then((response) => response.json())
        .then((data) => {
            if (data.response) {
                audioPlayer.src = data.response;
                audioPlayer.play();

                // Update the "Now Playing" text
                nowPlaying.textContent = title;
                
                // Show the song bar if it's hidden
                songBar.classList.remove('hidden');

                // Update the play/pause button to show the pause icon
                playPauseButton.classList.remove('fa-spinner', 'fa-spin');
                playPauseButton.classList.add('fa-pause');
                
                // Update repeat status
                updateRepeatStatus();
                
                // Add to recently played
                addToRecentlyPlayed({
                    videoId: songId,
                    title,
                    thumbnail,
                    channel: channelName,
                    timestamp: Date.now()
                });
            } else {
                console.error('Failed to fetch the music streaming URL.');
                playPauseButton.classList.remove('fa-spinner', 'fa-spin');
                playPauseButton.classList.add('fa-play');
            }
        })        .catch((error) => {
            console.error('An error occurred while fetching the music URL:', error);
            playPauseButton.classList.remove('fa-spinner', 'fa-spin');
            playPauseButton.classList.add('fa-play');
        });
}

// Queue functionality
let queue = [];
const queueContainer = document.getElementById('queueContainer');
const queueList = document.getElementById('queue-list');
const emptyQueue = document.getElementById('empty-queue');
const mainWrapper = document.querySelector('.main-wrapper');
let draggedItem = null;

// Initialize queue from localStorage on page load
function loadQueue() {
    const storedQueue = localStorage.getItem('musicPlayerQueue');
    if (storedQueue) {
        queue = JSON.parse(storedQueue);
        updateQueueDisplay();
    }
}

// Save queue to localStorage
function saveQueue() {
    localStorage.setItem('musicPlayerQueue', JSON.stringify(queue));
}

// Update the Queue Display
function updateQueueDisplay() {
    if (queue.length === 0) {
        queueList.style.display = 'none';
        emptyQueue.style.display = 'block';
        return;
    }
    
    queueList.style.display = 'flex';
    emptyQueue.style.display = 'none';
    
    // Clear the queue list
    queueList.innerHTML = '';
    
    // Add each queue item
    queue.forEach((song, index) => {
        const queueItem = document.createElement('div');
        queueItem.className = 'queue-item';
        queueItem.setAttribute('data-position', index);
        queueItem.setAttribute('draggable', 'true');
        
        queueItem.innerHTML = `
            <img src="${song.thumbnail}" alt="${song.title}" class="item-img">
            <div class="item-info">
                <p class="item-title">${song.title}</p>
                <p class="item-artist">${song.channel}</p>
            </div>
            <i class="fas fa-times remove-queue" data-index="${index}"></i>
        `;
        
        // Add event listeners for drag functionality
        queueItem.addEventListener('dragstart', handleDragStart);
        queueItem.addEventListener('dragend', handleDragEnd);
        queueItem.addEventListener('dragover', handleDragOver);
        queueItem.addEventListener('dragleave', handleDragLeave);
        queueItem.addEventListener('drop', handleDrop);
        
        // Add click event listener to play the song
        queueItem.addEventListener('click', (e) => {
            // Ignore if the click is on the remove button
            if (e.target.classList.contains('remove-queue') || 
                e.target.closest('.remove-queue')) {
                return;
            }
            selectVideo(song.videoId, song.title, song.thumbnail, song.channel);
        });
        
        queueList.appendChild(queueItem);
    });
    
    // Add event listeners for remove buttons
    const removeButtons = queueList.querySelectorAll('.remove-queue');
    removeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(button.getAttribute('data-index'));
            removeFromQueue(index);
        });
    });
}

// Add a song to the queue
function addToQueue(song) {
    // Check if the song is already in the queue
    const existingIndex = queue.findIndex(item => item.videoId === song.videoId);
    if (existingIndex !== -1) {
        // Song is already in queue, show notification or highlight it
        return;
    }
    
    queue.push(song);
    saveQueue();
    updateQueueDisplay();
}

// Remove a song from the queue
function removeFromQueue(index) {
    queue.splice(index, 1);
    saveQueue();
    updateQueueDisplay();
}

// Toggle the queue panel visibility
function toggleQueuePanel() {
    queueContainer.classList.toggle('hidden');
    
    // Adjust main content width if queue is visible
    if (!queueContainer.classList.contains('hidden')) {
        mainWrapper.classList.add('with-queue');
    } else {
        mainWrapper.classList.remove('with-queue');
    }
}

// Drag and Drop functionality for queue reordering
function handleDragStart(e) {
    this.classList.add('dragging');
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd() {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem !== this) {
        // Get positions
        const fromPosition = parseInt(draggedItem.getAttribute('data-position'));
        const toPosition = parseInt(this.getAttribute('data-position'));
        
        // Reorder the queue array
        const [movedItem] = queue.splice(fromPosition, 1);
        queue.splice(toPosition, 0, movedItem);
        
        saveQueue();
        updateQueueDisplay();
    }
    
    this.classList.remove('drag-over');
    return false;
}

// Helper function to add a queue-add-icon to favorite items
function updateFavoriteItemWithQueueIcon(favoriteItem, song) {
    const itemInfo = favoriteItem.querySelector('.item-info');
    
    // Only add the icon if it doesn't exist already
    if (!favoriteItem.querySelector('.queue-add-icon')) {
        const queueIcon = document.createElement('i');
        queueIcon.className = 'fas fa-plus-circle queue-add-icon';
        queueIcon.title = 'Add to Queue';
        queueIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            addToQueue(song);
            queueIcon.className = 'fas fa-check-circle queue-add-icon';
            queueIcon.style.color = '#1DB954';
            
            // Reset after a short delay
            setTimeout(() => {
                queueIcon.className = 'fas fa-plus-circle queue-add-icon';
                queueIcon.style.color = '';
            }, 1500);
        });
        
        favoriteItem.appendChild(queueIcon);
    }
}

// Update the other-features section to include queue toggle
document.addEventListener('DOMContentLoaded', () => {
    // Setup queue toggle in the player footer
    const otherFeatures = document.querySelector('.other-features');
    const listIcon = otherFeatures.querySelector('.fa-list-ul');
    
    // Add queue toggle functionality
    listIcon.classList.add('queue-toggle');
    listIcon.addEventListener('click', () => {
        toggleQueuePanel();
        listIcon.classList.toggle('active');
    });
    
    // Setup close button for queue panel
    const closeQueueBtn = document.querySelector('.close-queue');
    if (closeQueueBtn) {
        closeQueueBtn.addEventListener('click', () => {
            toggleQueuePanel();
            listIcon.classList.remove('active');
        });
    }
    
    // Load queue data
    loadQueue();
    
    // Initialize home view
    loadRecentlyPlayed();
    updateRecommendations();
    showHomeView();
    
    // Initialize favorites
    loadFavorites();
    
    // Fix for Repeat button - Add event listener to the repeat button
    const repeatButton = document.querySelector('.fa-undo-alt');
    let repeatActive = false;
    
    if (repeatButton) {
        repeatButton.addEventListener('click', function() {
            repeatActive = !repeatActive;
            this.style.color = repeatActive ? '#1DB954' : '';
            console.log('Repeat mode:', repeatActive ? 'ON' : 'OFF');
        });
    }

    // Draggable Review Button Implementation
    const reviewButtonContainer = document.getElementById('reviewButtonContainer');
    const reviewButton = document.getElementById('reviewButton');
    const reviewModal = document.getElementById('reviewModal');
    const closeModal = document.getElementById('closeModal');
    const starRating = document.getElementById('starRating');
    const stars = starRating.querySelectorAll('i');
    const reviewText = document.getElementById('reviewText');
    const submitReview = document.getElementById('submitReview');
    const sentimentResult = document.getElementById('sentimentResult');
    
    let selectedRating = 0;
    let isDragging = false;
    let initialX, initialY, offsetX = 0, offsetY = 0;

    // Make the review button draggable
    reviewButtonContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Touch events for mobile devices
    reviewButtonContainer.addEventListener('touchstart', dragStart);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        e.preventDefault();
        
        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - offsetX;
            initialY = e.touches[0].clientY - offsetY;
        } else {
            initialX = e.clientX - offsetX;
            initialY = e.clientY - offsetY;
        }
        isDragging = true;
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        if (e.type === 'touchmove') {
            offsetX = e.touches[0].clientX - initialX;
            offsetY = e.touches[0].clientY - initialY;
        } else {
            offsetX = e.clientX - initialX;
            offsetY = e.clientY - initialY;
        }

        // Keep the button within the viewport bounds
        const buttonRect = reviewButtonContainer.getBoundingClientRect();
        const buttonWidth = buttonRect.width;
        const buttonHeight = buttonRect.height;
        
        if (offsetX < 0) offsetX = 0;
        if (offsetY < 0) offsetY = 0;
        if (offsetX + buttonWidth > window.innerWidth) offsetX = window.innerWidth - buttonWidth;
        if (offsetY + buttonHeight > window.innerHeight) offsetY = window.innerHeight - buttonHeight;
        
        reviewButtonContainer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    function dragEnd() {
        initialX = offsetX;
        initialY = offsetY;
        isDragging = false;
    }

    // Open the review modal when the button is clicked
    reviewButton.addEventListener('click', function() {
        if (!isDragging) {
            reviewModal.style.display = 'flex';
        }
    });

    // Close the modal when clicking the close button
    closeModal.addEventListener('click', function() {
        reviewModal.style.display = 'none';
        resetReviewForm();
    });

    // Close the modal when clicking outside of it
    reviewModal.addEventListener('click', function(e) {
        if (e.target === reviewModal) {
            reviewModal.style.display = 'none';
            resetReviewForm();
        }
    });

    // Star rating functionality
    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            highlightStars(rating);
        });

        star.addEventListener('mouseout', function() {
            highlightStars(selectedRating);
        });

        star.addEventListener('click', function() {
            selectedRating = parseInt(this.getAttribute('data-rating'));
            highlightStars(selectedRating);
        });
    });

    function highlightStars(rating) {
        stars.forEach(star => {
            const starRating = parseInt(star.getAttribute('data-rating'));
            if (starRating <= rating) {
                star.classList.remove('far');
                star.classList.add('fas', 'active');
            } else {
                star.classList.remove('fas', 'active');
                star.classList.add('far');
            }
        });
    }

    // Submit review and get sentiment analysis
    submitReview.addEventListener('click', function() {
        if (selectedRating === 0) {
            alert('Please select a rating.');
            return;
        }
        
        if (!reviewText.value.trim()) {
            alert('Please write a review comment.');
            return;
        }
        
        // Disable submit button to prevent multiple submissions
        submitReview.disabled = true;        submitReview.textContent = 'Processing...';
        
        // Send review to server for sentiment analysis
        fetch('/analyze-sentiment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                review: reviewText.value.trim(),
                rating: selectedRating
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Convert numeric sentiment to text
            let sentimentText = 'Unknown';
            
            if (data.sentiment === 0) {
                sentimentText = 'Negative';
            } else if (data.sentiment === 1) {
                sentimentText = 'Neutral';
            } else if (data.sentiment === 2) {
                sentimentText = 'Positive';
            }
            
            // Display sentiment result with appropriate styling
            sentimentResult.style.display = 'block';
            sentimentResult.textContent = `Sentiment: ${sentimentText}`;
            sentimentResult.className = 'sentiment-result';
            
            // Add specific class based on sentiment for styling
            if (sentimentText === 'Positive') {
                sentimentResult.classList.add('sentiment-positive');
            } else if (sentimentText === 'Neutral') {
                sentimentResult.classList.add('sentiment-neutral');
            } else if (sentimentText === 'Negative') {
                sentimentResult.classList.add('sentiment-negative');
            }
            
            // Re-enable submit button
            submitReview.disabled = false;
            submitReview.textContent = 'Submit';
            
            // Optional: Save the review to local storage or send to a database
            console.log('Review submitted:', { 
                text: reviewText.value, 
                rating: selectedRating,
                sentiment: sentimentText
            });
        })
        .catch(error => {
            console.error('Error:', error);
            submitReview.disabled = false;
            submitReview.textContent = 'Submit';
            // Don't show alert here to prevent the error dialog
            
            // Still update the UI to show there was an error
            sentimentResult.style.display = 'block';
            sentimentResult.textContent = 'Error analyzing sentiment. Please try again.';
            sentimentResult.className = 'sentiment-result sentiment-error';
        });
    });

    function resetReviewForm() {
        selectedRating = 0;
        highlightStars(0);
        reviewText.value = '';
        sentimentResult.style.display = 'none';
    }
});

// Home and recommendation functionality
let recentlyPlayed = [];
const MAX_RECENTLY_PLAYED = 10;
const homeButton = document.getElementById('homeButton');
const homeContent = document.getElementById('homeContent');
const searchContent = document.getElementById('searchContent');
const recentlyPlayedContainer = document.getElementById('recentlyPlayedContainer');
const madeForYouContainer = document.getElementById('madeForYouContainer');
const recommendedContainer = document.getElementById('recommendedContainer');
let currentView = 'home';

// Load recently played from localStorage
function loadRecentlyPlayed() {
    const storedRecentlyPlayed = localStorage.getItem('musicPlayerRecentlyPlayed');
    if (storedRecentlyPlayed) {
        recentlyPlayed = JSON.parse(storedRecentlyPlayed);
        updateRecentlyPlayedDisplay();
    }
}

// Save recently played to localStorage
function saveRecentlyPlayed() {
    localStorage.setItem('musicPlayerRecentlyPlayed', JSON.stringify(recentlyPlayed));
}

// Add a song to recently played
function addToRecentlyPlayed(song) {
    // Check if the song is already in recently played
    const existingIndex = recentlyPlayed.findIndex(item => item.videoId === song.videoId);
    if (existingIndex !== -1) {
        // Remove it from its current position
        recentlyPlayed.splice(existingIndex, 1);
    }
    
    // Add to the beginning of the array
    recentlyPlayed.unshift(song);
    
    // Keep only the MAX_RECENTLY_PLAYED most recent
    if (recentlyPlayed.length > MAX_RECENTLY_PLAYED) {
        recentlyPlayed = recentlyPlayed.slice(0, MAX_RECENTLY_PLAYED);
    }
    
    saveRecentlyPlayed();
    updateRecentlyPlayedDisplay();
    updateRecommendations();
}

// Update the recently played display
function updateRecentlyPlayedDisplay() {
    if (recentlyPlayed.length === 0) {
        recentlyPlayedContainer.innerHTML = `
            <div class="empty-section-message">
                <p>Listen to some music to see your recently played tracks here</p>
            </div>
        `;
        return;
    }
    
    recentlyPlayedContainer.innerHTML = '';
    
    // Add each recently played item
    recentlyPlayed.forEach(song => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <img src="${song.thumbnail}" alt="${song.title}">
            <h4>${song.title}</h4>
            <p>${song.channel}</p>
        `;
        itemCard.addEventListener('click', () => {
            selectVideo(song.videoId, song.title, song.thumbnail, song.channel);
        });
        
        recentlyPlayedContainer.appendChild(itemCard);
    });
}

// Generate recommendations based on listening history
function updateRecommendations() {
    if (recentlyPlayed.length === 0) {
        // No recommendations if no listening history
        return;
    }
    
    // "Made for You" - Simulated personalized recommendations
    // In a real app, this would use more sophisticated algorithms
    generateMadeForYou();
    
    // "Recommended" based on recent listens
    generateRecommendations();
}

// Generate Made for You content
function generateMadeForYou() {
    madeForYouContainer.innerHTML = '';
    
    // In a real app, this would use algorithms to generate personalized content
    // For demo purposes, we'll create some mock personalized recommendations
    const mockRecommendations = [
        {
            title: 'Daily Mix 1',
            description: 'Based on your recent listening',
            songs: recentlyPlayed.slice(0, Math.min(3, recentlyPlayed.length))
        },
        {
            title: 'Discover Weekly',
            description: 'New discoveries just for you',
            songs: shuffleArray([...recentlyPlayed]).slice(0, Math.min(3, recentlyPlayed.length))
        },
        {
            title: 'Release Radar',
            description: 'Stay up to date with new music',
            songs: [...recentlyPlayed].reverse().slice(0, Math.min(3, recentlyPlayed.length))
        }
    ];
    
    // Add the mock recommendations to the container
    mockRecommendations.forEach(recommendation => {
        if (recommendation.songs.length > 0) {
            const playlistCard = document.createElement('div');
            playlistCard.className = 'item-card';
            
            // Create a mock playlist cover using up to 4 album art images
            const coverArt = createPlaylistCoverArt(recommendation.songs);
            
            playlistCard.innerHTML = `
                <div class="playlist-cover">${coverArt}</div>
                <h4>${recommendation.title}</h4>
                <p>${recommendation.description}</p>
            `;
            
            // When clicked, play the first song in the playlist
            playlistCard.addEventListener('click', () => {
                if (recommendation.songs.length > 0) {
                    const song = recommendation.songs[0];
                    selectVideo(song.videoId, song.title, song.thumbnail, song.channel);
                }
            });
            
            madeForYouContainer.appendChild(playlistCard);
        }
    });
    
    // If still empty, show a message
    if (madeForYouContainer.children.length === 0) {
        madeForYouContainer.innerHTML = `
            <div class="empty-section-message">
                <p>Personalized recommendations will appear here as you listen to more music</p>
            </div>
        `;
    }
}

// Create a playlist cover art using up to 4 album art images in a 2x2 grid
function createPlaylistCoverArt(songs) {
    if (songs.length === 0) {
        return '<div class="single-cover"><img src="https://via.placeholder.com/150" alt="Playlist cover"></div>';
    }
    
    if (songs.length === 1) {
        // Single image
        return `<div class="single-cover"><img src="${songs[0].thumbnail}" alt="Playlist cover"></div>`;
    } else {
        // Create a 2x2 grid collage
        let coverHtml = '<div class="playlist-cover-grid">';
        
        // For 2 songs, make 2 copies each
        // For 3 songs, repeat the first one
        // For 4+ songs, use the first 4
        const imagesToUse = [];
        
        if (songs.length === 2) {
            // Use the 2 songs twice each
            imagesToUse.push(songs[0], songs[1], songs[0], songs[1]);
        } else if (songs.length === 3) {
            // Use all 3 songs and repeat the first
            imagesToUse.push(songs[0], songs[1], songs[2], songs[0]);
        } else {
            // Use the first 4 songs
            imagesToUse.push(songs[0], songs[1], songs[2], songs[3]);
        }
        
        // Create the grid
        for (let i = 0; i < 4; i++) {
            coverHtml += `<div class="cover-grid-item"><img src="${imagesToUse[i].thumbnail}" alt=""></div>`;
        }
        
        coverHtml += '</div>';
        return coverHtml;
    }
}

// Generate recommendations based on recent listens
function generateRecommendations() {
    recommendedContainer.innerHTML = '';
    
    // In a real app, this would call an API to get similar songs
    // For demo, we'll simulate recommendations by shuffling recently played
    if (recentlyPlayed.length > 0) {
        // Create simulated recommended songs by altering channel names slightly
        const recommendedSongs = recentlyPlayed
            .map(song => ({ ...song })) // Create a copy of each song
            .sort(() => Math.random() - 0.5) // Shuffle the array
            .slice(0, Math.min(6, recentlyPlayed.length)); // Take up to 6 items
        
        recommendedSongs.forEach(song => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.innerHTML = `
                <img src="${song.thumbnail}" alt="${song.title}">
                <h4>${song.title}</h4>
                <p>${song.channel}</p>
            `;
            itemCard.addEventListener('click', () => {
                selectVideo(song.videoId, song.title, song.thumbnail, song.channel);
            });
            
            recommendedContainer.appendChild(itemCard);
        });
    } else {
        recommendedContainer.innerHTML = `
            <div class="empty-section-message">
                <p>Recommendations based on your listening history will appear here</p>
            </div>
        `;
    }
}

// Utility function to shuffle an array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Switch between home view and search results view
function showHomeView() {
    homeContent.style.display = 'block';
    searchContent.style.display = 'none';
    currentView = 'home';
    homeButton.classList.add('active');
}

function showSearchView() {
    homeContent.style.display = 'none';
    searchContent.style.display = 'block';
    currentView = 'search';
    homeButton.classList.remove('active');
}

// Add event listener to home button
homeButton.addEventListener('click', showHomeView);

// Add event listener to search bar for Enter key
document.getElementById("searchBar").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent any default behavior
        searchAndDisplayResults();
    }
});