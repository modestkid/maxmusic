const { ipcRenderer } = require('electron');

// Core elements
const audio = new Audio();
const timeBar = document.getElementById('time-bar');
const elapsedTime = document.getElementById('elapsed-time');
const totalTime = document.getElementById('total-time');
const visualizerCanvas = document.getElementById('visualizer');
const ctx = visualizerCanvas.getContext('2d');

// Ensure canvas dimensions are correct
visualizerCanvas.width = document.getElementById('now-playing').offsetWidth;
visualizerCanvas.height = document.getElementById('now-playing').offsetHeight;

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

        const red = Math.sin(i * 0.1 + 0) * 127 + 128;
        const green = Math.sin(i * 0.1 + 2) * 127 + 128;
        const blue = Math.sin(i * 0.1 + 4) * 127 + 128;

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
    ipcRenderer.send('update-discord-rpc', formatSongTitle(audio.src), formatTime(audio.duration));
});

audio.addEventListener('timeupdate', () => {
    elapsedTime.textContent = formatTime(audio.currentTime);
    timeBar.value = audio.currentTime;
});

timeBar.addEventListener('click', (e) => {
    const rect = timeBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * audio.duration;
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatSongTitle(filePath) {
    const fileName = filePath.split('/').pop();
    return fileName.replace(/\.mp3$/, '');
}

let currentSongIndex = 0;
let playlist = [];

document.addEventListener('DOMContentLoaded', () => {
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
});

audio.addEventListener('ended', () => {
    if (playlist.length > 0) {
        playNext();
    } else {
        console.warn("No more songs to play.");
        document.getElementById('song-title').textContent = "End of Playlist";
        document.getElementById('play-button').textContent = 'Play';
    }
});

async function playMusic(file, index) {
    try {
        currentSongIndex = index;
        audio.src = `/music/${file}`;
        await audio.play();
        const songTitle = formatSongTitle(file);
        document.getElementById('song-title').textContent = `${songTitle}`;
        document.getElementById('play-button').textContent = 'Pause';
        ipcRenderer.send('update-discord-rpc', songTitle, formatTime(audio.duration));
    } catch (error) {
        console.error(`Error playing ${file}:`, error);
        playNext(); // Skip to the next song on error
    }
}

function playNext() {
    if (playlist.length === 0) {
        console.warn("Playlist is empty.");
        document.getElementById('song-title').textContent = "No Songs Available";
        return;
    }

    currentSongIndex = (currentSongIndex + 1) % playlist.length;

    if (currentSongIndex === 0 && !audio.loop) {
        console.log("Reached the end of the playlist. Restarting.");
    }

    playMusic(playlist[currentSongIndex], currentSongIndex);
}

function playPrevious() {
    if (playlist.length === 0) {
        console.warn("Playlist is empty.");
        return;
    }

    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    playMusic(playlist[currentSongIndex], currentSongIndex);
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        document.getElementById('play-button').textContent = 'Pause';
    } else {
        audio.pause();
        document.getElementById('play-button').textContent = 'Play';
    }
}

function toggleLoop() {
    audio.loop = !audio.loop;
    document.getElementById('loop-button').textContent = audio.loop ? 'Looping' : 'Loop';
}
