const RPC = require('discord-rpc');
const clientId = '1254880462535528479';
RPC.register(clientId);
const rpc = new RPC.Client({ transport: 'ipc' });

let currentActivity = {};

rpc.on('ready', () => {
  console.log('Discord RPC ready');
  setActivity({ song: 'Idle', start: Date.now(), end: Date.now() });
});

rpc.on('error', console.error);

function setActivity({ song, start, end }) {
  if (!rpc) return;
  rpc.setActivity({
    details: `🎵 ${song}`,
    state: `Listening`,
    startTimestamp: start,
    endTimestamp: end,
    largeImageKey: 'bigimage',          // define in your bot assets
    largeImageText: song,
    smallImageKey: 'play_icon',          // show play/pause icon
    smallImageText: 'MaxMusic Player',
    instance: false,
    buttons: [
      { label: 'Get MaxMusic', url: 'https://github.com/yourrepo' },
      { label: 'Join Support', url: 'https://discord.gg/yourinvite' }
    ]
  }).catch(console.error);
}

rpc.login({ clientId }).catch(console.error);

module.exports = { setActivity };
