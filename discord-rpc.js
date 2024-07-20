const RPC = require('discord-rpc');
const clientId = '1254880462535528479'; // Ensure this is correct

const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
    console.log('Discord RPC ready');
    setActivity('No song', '0:00'); // Set initial state
});

rpc.on('error', (error) => {
    console.error('Discord RPC error:', error);
});

function setActivity(song, duration) {
    console.log(`Setting Discord RPC activity: song = ${song}, duration = ${duration}`);
    if (!rpc) {
        console.error('RPC client not initialized');
        return;
    }

    rpc.setActivity({
        details: `Listening to ${song}`,
        state: `Duration: ${duration}`,
        startTimestamp: Date.now(),
        largeImageKey: 'bigimage', // Replace with your image key
        largeImageText: 'Max Music',
        SmallImageKey: 'smallimage', // Replace with your image key
        SmallImageText: 'by modestkidstudio',
        instance: false,
    }).catch(console.error);
}

function startRpc() {
    RPC.register(clientId);
    rpc.login({ clientId }).catch(console.error);
}

module.exports = {
    setActivity,
    startRpc,
};
