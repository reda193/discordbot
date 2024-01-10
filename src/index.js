//Import required modules
const DiscordModule = require('./DiscordModule');
const LastFmModule = require('./LastFmModule');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Loading environmental variables from .env

//Create instance of the DiscordModule with provided token and discord channel.
const discordModule = new DiscordModule(process.env.DISCORD_TOKEN, process.env.DISCORD_CHANNEL);


// Log in the Discord bot using the token
discordModule.login();

//Set up event listeners for Discord bot actions
discordModule.setupEventListeners();

