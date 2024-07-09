const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    fetch('/music')
        .then(response => response.json())
        .then(files => {
            const musicFilesElement = document.getElementById('music-files');
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                li.addEventListener('click', () => playMusic(file));
                musicFilesElement.appendChild(li);
            });
        });

    document.getElementById('play-button').addEventListener('click', togglePlay);
    document.getElementById('prev-button').addEventListener('click', playPrevious);
    document.getElementById('next-button').addEventListener('click', playNext);
    document.getElementById('loop-button').addEventListener('click', toggleLoop);
});

let currentSongIndex = -1;
let isPlaying = false;
let isLooping = false;
let audio = new Audio();

function updateNowPlaying(file) {
    document.getElementById('song-title').textContent = file;
    document.getElementById('song-artist').textContent = 'Unknown Artist'; // Update with actual artist info if available
    console.log(`Now playing: ${file}`);
    ipcRenderer.send('update-discord-rpc', file, 'Unknown duration', '00:00'); // Initial duration and current time
}

function playMusic(file) {
    currentSongIndex = Array.from(document.getElementById('music-files').children).findIndex(li => li.textContent === file);
    audio.src = `/music/${file}`;
    audio.play();
    isPlaying = true;
    updateNowPlaying(file);
    document.getElementById('play-button').textContent = 'Pause';

    audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration ? new Date(audio.duration * 1000).toISOString().substr(11, 8) : 'Unknown duration';
        console.log(`Loaded metadata: song = ${file}, duration = ${duration}`);
        ipcRenderer.send('update-discord-rpc', file, duration, formatTime(audio.currentTime));
        document.getElementById('time-bar').max = audio.duration;
    });

    audio.addEventListener('timeupdate', () => {
        document.getElementById('time-bar').value = audio.currentTime;
        ipcRenderer.send('update-discord-rpc', file, formatTime(audio.duration), formatTime(audio.currentTime));
    });

    // Add the onended event listener to play the next song or loop the current song
    audio.addEventListener('ended', () => {
        if (isLooping) {
            playMusic(file);
        } else {
            playNext();
        }
    });
}

function togglePlay() {
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        document.getElementById('play-button').textContent = 'Play';
    } else {
        audio.play();
        isPlaying = true;
        document.getElementById('play-button').textContent = 'Pause';
    }
}

function playPrevious() {
    if (currentSongIndex > 0) {
        currentSongIndex--;
        const file = document.getElementById('music-files').children[currentSongIndex].textContent;
        playMusic(file);
    }
}

function playNext() {
    if (currentSongIndex < document.getElementById('music-files').children.length - 1) {
        currentSongIndex++;
        const file = document.getElementById('music-files').children[currentSongIndex].textContent;
        playMusic(file);
    }
}

function toggleLoop() {
    isLooping = !isLooping;
    const loopButton = document.getElementById('loop-button');
    loopButton.textContent = isLooping ? 'Looping' : 'Loop';
    if (isLooping) {
        loopButton.classList.add('looping');
    } else {
        loopButton.classList.remove('looping');
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
