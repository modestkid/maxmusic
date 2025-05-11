const { ipcRenderer } = require('electron');
const audio = new Audio();
const analyser = new (window.AudioContext?.prototype.createAnalyser ? AudioContext : webkitAudioContext)().createAnalyser();
const source = new (window.AudioContext || webkitAudioContext)().createMediaElementSource(audio);
source.connect(analyser);
analyser.connect((window.AudioContext || webkitAudioContext)().destination);
analyser.fftSize = 256;

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  canvas.width = document.getElementById('now-playing').clientWidth;
  canvas.height = document.getElementById('now-playing').clientHeight;
}

// Draw color-shifting bars
function draw() {
  requestAnimationFrame(draw);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const w = canvas.width / data.length * 1.5;
  let x = 0;
  data.forEach((v,i) => {
    const h = v * 1.5;
    const r = Math.sin(i*0.1)*128+128;
    const g = Math.sin(i*0.1+2)*128+128;
    const b = Math.sin(i*0.1+4)*128+128;
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.8)`;
    ctx.fillRect(x,canvas.height-h, w, h);
    x+=w+1;
  });
}
draw();

// DOM refs
const listEl = document.getElementById('music-list');
const playlistEl = document.getElementById('playlist-list');
const searchEl = document.getElementById('search');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const loopBtn = document.getElementById('loop');
const volEl = document.getElementById('volume');
const elapsedEl = document.getElementById('elapsed');
const durationEl = document.getElementById('duration');
const progBar = document.getElementById('progress-bar');
const titleEl = document.getElementById('song-title');
const artistEl = document.getElementById('song-artist');
const artEl = document.getElementById('album-art');

let tracks = [], current = 0;

// Load files
fetch('/music').then(r=>r.json()).then(files=>{
  tracks = files;
  renderList(tracks);
});

// Render list
function renderList(arr){
  listEl.innerHTML = '';
  arr.forEach((f,i)=>{
    const div = document.createElement('div');
    div.className='list-item';
    div.innerHTML = `<span>${f}</span><i class="fa fa-play"></i>`;
    div.onclick = ()=>play(i);
    listEl.appendChild(div);
  });
}

// Search
searchEl.addEventListener('input',e=>{
  renderList(tracks.filter(t=>t.toLowerCase().includes(e.target.value.toLowerCase())));
});

// Playback
audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = format(audio.duration);
  progBar.max = audio.duration;
  sendRPC('START');
});
audio.addEventListener('timeupdate', () => {
  elapsedEl.textContent = format(audio.currentTime);
  progBar.value = audio.currentTime;
  sendRPC('UPDATE');
});
audio.addEventListener('ended', ()=> next());

// Controls
playBtn.onclick = ()=> audio.paused ? audio.play() : audio.pause();
audio.onplay = ()=> { playBtn.innerHTML = '<i class="fa fa-pause"></i>'; sendRPC('START'); };
audio.onpause = ()=> { playBtn.innerHTML = '<i class="fa fa-play"></i>'; sendRPC('PAUSE'); };
prevBtn.onclick = prev;
nextBtn.onclick = next;
loopBtn.onclick = ()=> audio.loop = !audio.loop;
volEl.oninput = ()=> audio.volume = volEl.value;

function play(idx){
  current = idx;
  audio.src = `/music/${tracks[idx]}`;
  audio.play().catch(console.error);
  const [name, artist='Unknown'] = tracks[idx].replace(/\.mp3$/,'').split(' - ');
  titleEl.textContent = name;
  artistEl.textContent = artist;
  // Optionally fetch album-art per track
}

function prev(){ current=(current-1+tracks.length)%tracks.length; play(current); }
function next(){ current=(current+1)%tracks.length; play(current); }

function format(sec){
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return `${m}:${s<10?'0':''}${s}`;
}

// Discord RPC
let rpcState = null;
function sendRPC(event){
  const song = titleEl.textContent;
  const dur = audio.duration||0;
  const now = Date.now();
  ipcRenderer.send('update-discord-rpc', {
    event, song,
    start: audio.played.length? now - audio.currentTime*1000 : now,
    end: now + (dur - audio.currentTime)*1000
  });
}
