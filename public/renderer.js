const { ipcRenderer } = require('electron');

// Core elements
const audio = new Audio();
const timeBar = document.getElementById('time-bar');
const elapsedTime = document.getElementById('elapsed-time');
const totalTime = document.getElementById('total-time');
const visualizerCanvas = document.getElementById('visualizer');
const ctx = visualizerCanvas.getContext('2d');

// Ensure canvas dimensions are correct
visualizerCanvas.width = document.getElementById('now-playing').offsetWidth;  // Take the width of the #now-playing div
visualizerCanvas.height = document.getElementById('now-playing').offsetHeight;  // Take the height of the #now-playing div

// Visualizer setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audio);

source.connect(analyser);
analyser.connect(audioContext.destination);
analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        
        // Create a rainbow effect based on the frequency index (i)
        const red = Math.sin(i * 0.1 + 0) * 127 + 128; // Red component
        const green = Math.sin(i * 0.1 + 2) * 127 + 128; // Green component
        const blue = Math.sin(i * 0.1 + 4) * 127 + 128; // Blue component

        ctx.fillStyle = `rgb(${Math.floor(red)}, ${Math.floor(green)}, ${Math.floor(blue)})`;
        ctx.fillRect(x, visualizerCanvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }
}

// Start the visualizer once the page loads and the audio is ready
drawVisualizer();

// Event listeners for audio
audio.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(audio.duration);
    timeBar.max = audio.duration;

    // Send Discord RPC after the duration is loaded
    ipcRenderer.send('update-discord-rpc', audio.src, formatTime(audio.duration));
});

audio.addEventListener('timeupdate', () => {
    elapsedTime.textContent = formatTime(audio.currentTime);
    timeBar.value = audio.currentTime;
});

// Handle time bar click to change the song position
timeBar.addEventListener('click', (e) => {
    const rect = timeBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * audio.duration;
});

// Helper functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Music and playlist logic
let currentSongIndex = 0;
let playlist = [];

// Fetch and load the playlist
document.addEventListener('DOMContentLoaded', () => {

    let playlist = [];
    let playlists = []; // Array to store playlists

    fetch('/music')
        .then(response => response.json())
        .then(files => {
            playlist = files;
            const musicFilesElement = document.getElementById('music-files');
            files.forEach((file, index) => {
                const li = document.createElement('li');
                li.textContent = file;
                li.addEventListener('click', () => playMusic(file, index));
                musicFilesElement.appendChild(li);
            });
        });

    document.getElementById('play-button').addEventListener('click', togglePlay);
    document.getElementById('prev-button').addEventListener('click', playPrevious);
    document.getElementById('next-button').addEventListener('click', playNext);
    document.getElementById('loop-button').addEventListener('click', toggleLoop);

    // Add event listener for 'Add Playlist' button
    document.getElementById('add-playlist-button').addEventListener('click', () => {
        // Clear previous selections in the playlist popup
        const playlistSongSelection = document.getElementById('playlist-song-selection');
        playlistSongSelection.innerHTML = ''; // Clear any existing list items

        // Populate the popup with the list of songs
        playlist.forEach((song, index) => {
            const li = document.createElement('li');
            li.textContent = song;
            li.addEventListener('click', () => {
                // Toggle selection for the song
                if (li.style.backgroundColor === 'rgb(51, 51, 51)') {
                    // Deselect if already selected
                    li.style.backgroundColor = ''; // Remove highlight
                } else {
                    // Select the song
                    li.style.backgroundColor = '#333'; // Highlight the selected song
                }
            });
            playlistSongSelection.appendChild(li);
        });

        // Show the popup and overlay
        document.getElementById('playlist-popup').style.display = 'block';
        document.getElementById('overlay').style.display = 'block';
    });

    // Event listener for the playlist naming button
    // Modify the playlist name creation logic to send to main process
document.getElementById('name-playlist-button').addEventListener('click', () => {
    const playlistName = document.getElementById('playlist-name').value.trim();
    if (playlistName) {
        const selectedSongs = [];
        const playlistSongSelection = document.getElementById('playlist-song-selection').children;
        for (let song of playlistSongSelection) {
            if (song.style.backgroundColor === 'rgb(51, 51, 51)') {
                selectedSongs.push(song.textContent);
            }
        }

        if (selectedSongs.length > 0) {
            // Create a new playlist object
            const newPlaylist = { name: playlistName, songs: selectedSongs };

            // Send the new playlist to the main process to be saved
            ipcRenderer.send('save-playlist', newPlaylist);

            alert(`Playlist "${playlistName}" created with ${selectedSongs.length} song(s)!`);
        } else {
            alert("Please select at least one song.");
        }

        // Hide the popup
        document.getElementById('playlist-popup').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
    } else {
        alert("Please enter a playlist name.");
    }
});

    // Function to update the playlist display
    function updatePlaylistDisplay() {
        const playlistFilesElement = document.getElementById('playlist-files');
        playlistFilesElement.innerHTML = ''; // Clear existing playlists

        playlists.forEach((playlist, index) => {
            const li = document.createElement('li');
            li.textContent = playlist.name;
            li.dataset.index = index;

            // Add event listener to play songs when clicked
            li.addEventListener('click', () => playPlaylist(index));

            // Add event listener for right-click (context menu)
            li.addEventListener('contextmenu', (event) => {
                event.preventDefault(); // Prevent default context menu
                showContextMenu(event, li);
            });

            playlistFilesElement.appendChild(li);
        });
    }

    // Function to play songs in a playlist
    function playPlaylist(index) {
        const selectedPlaylist = playlists[index];
        let currentSongIndex = 0; // Start from the first song in the playlist

        // Function to play the next song in the playlist
        function playNextSong() {
            if (currentSongIndex < selectedPlaylist.songs.length) {
                playMusic(selectedPlaylist.songs[currentSongIndex], currentSongIndex);
                currentSongIndex++; // Move to the next song
            } else {
                // If no more songs in the playlist, reset and stop playback
                currentSongIndex = 0;
                document.getElementById('song-title').textContent = 'End of Playlist';
                document.getElementById('song-artist').textContent = '';
            }
        }

        // Set the 'ended' event to play the next song when the current one finishes
        audio.addEventListener('ended', playNextSong);

        // Start playing the first song in the playlist
        playNextSong();
    }

    // Function to play a specific song
    function playMusic(file, index) {
        audio.src = `/music/${file}`;
        audio.play();
        document.getElementById('song-title').textContent = file;
        document.getElementById('play-button').textContent = 'Pause';

        // Send Discord RPC after the song starts playing
        audio.addEventListener('loadedmetadata', () => {
            ipcRenderer.send('update-discord-rpc', file, formatTime(audio.duration));
        });
    }

    // Function to format time in MM:SS format
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Close popup when overlay is clicked
    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('playlist-popup').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
    });
});

// Event listener for audio to detect when the song ends
audio.addEventListener('ended', playNext);

// Function to play music based on file and index
function playMusic(file, index) {
    audio.src = `/music/${file}`;
    audio.play();
    document.getElementById('song-title').textContent = file;
    document.getElementById('play-button').textContent = 'Pause';
    currentSongIndex = index; // Save the current song index
    // Send Discord RPC after the song starts playing
    audio.addEventListener('loadedmetadata', () => {
        ipcRenderer.send('update-discord-rpc', file, formatTime(audio.duration));
    });
}

// Toggle play/pause functionality
function togglePlay() {
    if (audio.paused) {
        audio.play();
        document.getElementById('play-button').textContent = 'Pause';
    } else {
        audio.pause();
        document.getElementById('play-button').textContent = 'Play';
    }
}

// Play the previous song in the playlist
function playPrevious() {
    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    playMusic(playlist[currentSongIndex], currentSongIndex);
}

// Play the next song in the playlist
function playNext() {
    currentSongIndex = (currentSongIndex + 1) % playlist.length;
    playMusic(playlist[currentSongIndex], currentSongIndex);
}

// Toggle loop functionality
function toggleLoop() {
    audio.loop = !audio.loop;
    document.getElementById('loop-button').textContent = audio.loop ? 'Looping' : 'Loop';
}
