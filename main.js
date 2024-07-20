const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const formidable = require('formidable');
const fs = require('fs');
const { setActivity, startRpc } = require('./discord-rpc');
const { updateFiles } = require('./updatescript');

const expressApp = express();
const port = 3000;

const musicDir = path.join(__dirname, 'music');
const publicDir = path.join(__dirname, 'public');
const playlistsDir = path.join(__dirname, 'playlists');

if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir);
}

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

if (!fs.existsSync(playlistsDir)) {
    fs.mkdirSync(playlistsDir);
}

expressApp.use(express.static(publicDir));

// Upload endpoint using formidable
expressApp.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({
        uploadDir: musicDir,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        multiples: false
    });

    form.onPart = (part) => {
        if (!part.filename || part.filename.match(/\.(mp3|wav|ogg)$/i)) {
            form.handlePart(part);
        } else {
            res.status(400).send('Error: Audio Files Only!');
        }
    };

    form.parse(req, (err, fields, files) => {
        if (err) {
            res.status(400).send(err.message);
            return;
        }
        if (!files.musicFile) {
            res.status(400).send('No file selected');
            return;
        }
        const uploadedFile = files.musicFile;
        const newFilePath = path.join(musicDir, uploadedFile.name);
        fs.rename(uploadedFile.path, newFilePath, (err) => {
            if (err) {
                res.status(500).send('Error moving file');
                return;
            }
            res.send(`File uploaded: ${uploadedFile.name}`);
        });
    });
});

expressApp.get('/music', (req, res) => {
    fs.readdir(musicDir, (err, files) => {
        if (err) {
            res.status(500).send('Unable to scan directory');
        } else {
            res.json(files);
        }
    });
});

expressApp.get('/music/:filename', (req, res) => {
    const file = path.join(musicDir, req.params.filename);
    const stat = fs.statSync(file);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(file, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        };

        res.writeHead(206, head);
        fileStream.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(200, head);
        fs.createReadStream(file).pipe(res);
    }
});

// Endpoint to save playlists
expressApp.post('/playlists', (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const playlist = JSON.parse(body);
        const playlistFilePath = path.join(playlistsDir, `${playlist.name}.json`);
        fs.writeFile(playlistFilePath, JSON.stringify(playlist), err => {
            if (err) {
                res.status(500).send('Error saving playlist');
            } else {
                res.send('Playlist saved successfully');
            }
        });
    });
});

// Endpoint to get all playlists
expressApp.get('/playlists', (req, res) => {
    fs.readdir(playlistsDir, (err, files) => {
        if (err) {
            res.status(500).send('Unable to scan playlists directory');
        } else {
            const playlists = files.map(file => path.parse(file).name);
            res.json(playlists);
        }
    });
});

// Endpoint to get a specific playlist
expressApp.get('/playlists/:name', (req, res) => {
    const playlistFilePath = path.join(playlistsDir, `${req.params.name}.json`);
    fs.readFile(playlistFilePath, (err, data) => {
        if (err) {
            res.status(500).send('Error reading playlist file');
        } else {
            const playlist = JSON.parse(data);
            res.json(playlist);
        }
    });
});

// Endpoint to delete a playlist
expressApp.delete('/playlists/:name', (req, res) => {
    const playlistFilePath = path.join(playlistsDir, `${req.params.name}.json`);
    fs.unlink(playlistFilePath, (err) => {
        if (err) {
            res.status(500).send('Error deleting playlist');
        } else {
            res.send('Playlist deleted successfully');
        }
    });
});


const server = expressApp.listen(port, () => {
    console.log(`Express server started on port ${server.address().port}`);
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadURL(`http://localhost:${server.address().port}`);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();
    startRpc();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on('update-discord-rpc', (event, song, duration) => {
    console.log(`Received update-discord-rpc event: song = ${song}, duration = ${duration}`);
    setActivity(song, duration);
});

updateFiles().then(() => {
        console.log('Update check complete');
    }).catch(error => {
        console.error('Error during update check:', error);
    });
