// Import required libraries and modules
const { Client, IntentsBitField } = require('discord.js');
const LastFmModule = require('./LastFmModule');
const YouTubeSearchModule = require('./YoutubeModule');
const mysql = require('mysql2');

const lastFmApi = process.env.LAST_FM_API;
const lastFmUser = process.env.LAST_FM_USER;

//Creates and Defines Discordmodule class
class DiscordModule {
    constructor(token,discordChannelID){
        //Initliaizes a Discord Client with specific intents
        this.client = new Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
                IntentsBitField.Flags.GuildPresences
            ],
        });
        this.token=token;
        this.discordChannelID = discordChannelID;
        this.prefixes= [',fm', ',youtube']; // Command prefixes
        this.usernameID = null; // Initalize username ID

        //Esatablish MySQL connection using credentials from environmental variables
        this.connection = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            insecureAuth: true,
        });
        // Connects to MySQL database
        this.connection.connect((err) => {
            if (err) {
              console.error('Error connecting to MySQL database: ' + err.stack);
              return;
            }
            console.log('Connected to MySQL database as id ' + this.connection.threadId);
          });
        }
        //Function to log in to the Discord bot
    
        login() {
            this.client.login(this.token);
        }
        //Setter for usernameID
        setUsernameID(username){
            this.usernameID = username;
        }
        //Get function for usernameID
        getUsernameID(){
            return this.usernameID;
        }
        //Set up event listeners for Discord Bot
        setupEventListeners(){
            //Intitalize LastFMModule and YoutubeSearchModule
            const lastFmModule = new LastFmModule(lastFmApi, lastFmUser, this.client);
            const youtubeModule = new YouTubeSearchModule(this.client,this.discordChannelID);

            //Makes sure that the bot is ready
            this.client.on('ready', (c) =>{
                console.log(`${c.user.tag} is online.`);
            });

            //Event listener for incoming messages
            this.client.on('messageCreate', async (message) => {
                //Get the username of the message author
                const userID = message.author.username;
                //Finds the prefix used in the message content
                const prefixUsed = this.prefixes.find(prefix => message.content.startsWith(prefix));

                if (!prefixUsed) return;

                //Extract arguments from the message content after removing the prefix
                const args = message.content.slice(prefixUsed.length).trim().split(' ');

                //Extract the command from the argumentrs and convert it to lower case
                const command = args.shift().toLowerCase();

                // If command for the authorization process for Last.fm username
                if (command === 'authorize') {
                    const username = message.author.username;
                    this.setUsernameID(username);

                    //Prompts the user to enter their Last.fm username                    
                    message.channel.send("Enter your last.fm username").then(() => {
                        
                        // Sets up a message collector to collect the Last.fm username
                        const filter = m => m.author.id === message.author.id;
                        const collector = message.channel.createMessageCollector(filter, { max: 1, time: 30000 });
                        
                        //Collect the Last.fm username and inserts it into the database
                        collector.on('collect', m => {
                            const lastFmUserName = m.content;
                            const data ={
                                UserID:username,
                                LastFMUsername:lastFmUserName
                            }
                            
                            this.connection.query('INSERT INTO userprofile SET ?', data, (error) =>{
                                if (error){
                                    message.reply("This username already has a last fm associated with it. Try [,fm update] to change you username.");
                                    return;
                                }else{
                                    message.reply('Data inserted succesfully.');

                                }
                            });
                
                            collector.stop();
                        });
                        
                        // If the user didnt provide the data fast enough, the bot will let you know.
                        collector.on('end', collected => {
                            if (collected.size === 0) {
                                message.reply('You did not provide last.fm data in time.');
                            }
                        });
                    });
                }
                // If command for updating any your last.fm username in the database
                if(command === 'update'){

                    const username = message.author.username;

                    message.channel.send("Enter your new last.fm usernamne").then(() =>{ 
                        const filter = m => m.author.id === message.author.id;
                        const collector = message.channel.createMessageCollector(filter, { max: 1, time: 30000 });
                        collector.on('collect', m => {
                            const lastFmUser = m.content;

                            const data = {
                                UserID:username,
                                LastFMUsername:lastFmUser
                            }

                    
                            this.connection.query('UPDATE userprofile SET LastFMUsername = ? WHERE UserID = ?', [lastFmUser,username], (error) =>{
                                if(error){
                                    message.reply("Error updating");
                                }else {
                                    message.reply("Data updated successfully");
                                }
                            });
                            collector.stop();
                        });
                        collector.on('end', collected => {
                            if(collected.size ===0){
                                message.reply("You did not provide last.fm data in time.");
                            }
                        });
                    });
                }
                //If statements that takes in the command, argument length, and days into consideration.
                //If the appropiate command is selected, it will call the appropiate method.
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && args[0] === '7d') {
                    lastFmModule.getTopTracks("7day",userID); 
                }
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && (args[0] === '30d' || args[0] === '1month')) {
                    const userID = message.author.username;
                    lastFmModule.getTopTracks("1month",userID); 
                }
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && (args[0] === '90d' || args[0] === '3month')) {
                    lastFmModule.getTopTracks("3month",userID); 
                }
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && (args[0] === '180d' || args[0] === '6month')) {
                    lastFmModule.getTopTracks("6month",userID); 
                }
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && (args[0] === '365d' || args[0] === '12month')) {
                    lastFmModule.getTopTracks("12month",userID); 
                }
                if ((command === 'tt' || command === 'toptracks') && args.length === 1 && (args[0] === 'overall' || args[0] === 'alltime')) {
                    lastFmModule.getTopTracks("overall",userID); 
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && args[0]==='7d'){
                    lastFmModule.getTopAlbums("7day",userID);
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && (args[0] === '30d' || args[0] === '1month')){
                    lastFmModule.getTopAlbums("1month",userID);
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && (args[0] === '90d' || args[0] === '6month')){
                    lastFmModule.getTopAlbums("6month",userID);
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && (args[0] === '180d' || args[0] === '6month')){
                    lastFmModule.getTopAlbums("6month",userID);
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && (args[0] === '365d' || args[0] === '12month')){
                    lastFmModule.getTopAlbums("12month",userID);
                }
                if((command ===  'ta' || command ==='topalbums') ** args.length ===1 && (args[0] === 'overall' || args[0] === 'alltime')){
                    lastFmModule.getTopAlbums("overall",userID);
                }
                if ((command === 'topartists' || command === 'artists') && args.length === 1 && args[0] === '7d') {
                    lastFmModule.getTopArtists("7day",userID);
                }
                if((command ===  'artists' || command ==='topartists') ** args.length ===1 && (args[0] === '30d' || args[0] === '1month')){
                    lastFmModule.getTopArtists("1month",userID);
                }
                if((command ===  'artists' || command ==='topartists') ** args.length ===1 && (args[0] === '90d' || args[0] === '3month')){
                    lastFmModule.getTopArtists("3month",userID);
                }
                if((command ===  'artists' || command ==='topartists') ** args.length ===1 && (args[0] === '180d' || args[0] === '6month')){
                    lastFmModule.getTopArtists("6month",userID);
                }
                if((command ===  'artists' || command ==='topartists') ** args.length ===1 && (args[0] === '365d' || args[0] === '12month')){
                    lastFmModule.getTopArtists("12month",userID);
                }
                if((command ===  'artists' || command ==='topartists') ** args.length ===1 && (args[0] === 'overall' || args[0] === 'alltime')){
                    lastFmModule.getTopArtists("overall",userID);
                }
            
                if(command === 'getcurrentlyplaying' || command === 'playing' || command ==="current"){
                    const userID = message.author.username;
                    lastFmModule.currentlyPlaying(userID);
                }
                if(command === 'search'){
                    const string = args.join(' ');
                    youtubeModule.youtubeSearch(string);
                }
                
                

            });
    }


}

module.exports = DiscordModule;