// Importing required modules
const fetch = require('node-fetch'); // Library to make HTTP requests
const { EmbedBuilder } = require('discord.js'); // Discord.js module for creating embeds
const path = require('path'); // Module to handle file paths

// Load environment variables from the '.env' file
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

//Retrieve required environment variables
const lastFmApi = process.env.LAST_FM_API;
const discordChannelID = process.env.DISCORD_CHANNEL;

// Class for handling Last.fm functionalities
class LastFmModule {
    constructor(lastFmApi, lastFmUser,client){
        this.lastFmApi = lastFmApi; // Last.fm API key
        this.lastFmUser = lastFmUser; // Last.fm username
        this.client=client; // Discord client
    }

    // Async method to retrieve Last.fm username based on Discord ID
    async getLastFmUsername(discordID){
        const mysql = require('mysql2/promise'); // Import MySQL (Important note mysql2 is the only one that worked)

        //Creating a connection pool to connect to a MySQL database.
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            insecureAuth: true,
        });

        // Try...catch block for error handling, incase there was an error treiving the last.fm username send a message.
        try{
            // Attemps to get a connection from the MySQL connection pool, uses await to wait for the getConnection method to return a connection
            const connection = await pool.getConnection();

            // After obtaining database connection this line executes the SQL query and retrieves the LastFMUsername .
            const [rows] = await connection.execute(
                'SELECT LastFMUsername from userprofile WHERE UserID = ?', [discordID]
            );
            
            //If the rows length is greater than 0 this means that there was an entry in the database, other return a null value.
            if (rows.length > 0){
                return rows[0].LastFMUsername;
            }else {
                return null;
            }
        }catch(error){
            console.error('Error retrieving Last.Fm username');
            return null;
        }
    }
    // Async method to obtain the users toptracks takes in the days from Last.fm based on time time period and userid.
    async getTopTracks(days,userID) {
        // Saving the return value from the getLastFmUsername method into a variable.
        const lastFmName = await this.getLastFmUsername(userID);
        try {
            //Construct the URL to fetch top tracks data from the Last.fm API
            const url = `http://ws.audioscrobbler.com/2.0/?method=user.getTopTracks&user=${lastFmName}&api_key=${lastFmApi}&period=${days}&format=json&limit=10`;
            
            // Fetch the data from the consturcted url
            const response = await fetch(url);

            //Parse the fetched response as JSON
            const data = await response.json();
            
            //Checks if the toptracks property exists in the retrieved data.

            if (data.toptracks) { // Check if data.toptracks exists
                //Gets the discord channel to send the data to
                const channel = this.client.channels.cache.get(discordChannelID);
                const topTenTracks = [];

                //Intializing variables to manage text formatting to embed in the future.
                let maxLength = 0;
                const userImage = await this.getUserAvatar(lastFmName);
                const account = await this.fetchAccountLink(lastFmName);
                let checkDay ="";

                //Determines the time period for hte tracks
                if((days === '7d' || days ==='7day')){
                    checkDay = 'weekly top tracks';
                }else if((days === '30d' || days ==='1month')){
                    checkDay = 'mothly top tracks';
                }else if((days === '90d' || days ==='3month')){
                    checkDay = 'past 3 months top tracks';
                }else if((days === '180d' || days ==='6month')){
                    checkDay = 'past 6 months top tracks';
                }else if((days === '365d' || days ==='12month')){
                    checkDay = 'past 12 months top tracks';
                }else if((days ==='overall' ||days === 'alltime')){
                    checkDay = 'top tracks';
                }

                //For loop to loop through the top tracks data. Only the top 10 tracks are taken into consideration.
                for (let i = 0; i < 10; i++) {
                    let track = data.toptracks.track[i];
                    let artist = track.artist.name;
                    let trackName = track.name;
                    let playCount = track.playcount;

                    //Generates formatted line for each track
                    const lastFmTrackLink = await this.getArtistTrack(artist,trackName);
                    const line = `**${i + 1},**. **[${trackName}](<${lastFmTrackLink}>)** by **${artist}**   (${playCount})`;
                    topTenTracks.push(line);
                    maxLength = Math.max(maxLength, line.length);
                }
                // Pad the track information for consistent display
                const paddedTopTenTracks = topTenTracks.map((line) => {
                    const padding = ' '.repeat(maxLength - line.length);
                    return `${line}${padding}`;
                });
                
                // Create an embedded messsage for Discord with the top tracks information
                const exampleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${lastFmName}'s ${checkDay}`)
                    .setAuthor({ name: `Last.fm: ${lastFmName}`, iconURL: userImage, url: account })
    
                    .setDescription(paddedTopTenTracks.join('\n'))
                    .setTimestamp();
                //Sends the embedded message wit the top tracks info to the Discord channel
                channel.send({ embeds: [exampleEmbed] });
            } else {
                console.error('No toptracks data found in the response.');
            }
        } catch (error) {
            console.error('Error fetching Last.fm data:', error);
        }
    
    }

    // Async method to retrieve what the user is currently playing through the Last.fm API
    async currentlyPlaying(userID) {
        // Get Last.fm username associated with the Discord userID
        const lastFmName = await this.getLastFmUsername(userID);
    
        try {
            // Construct the URL to fetch recent tracks data from Last.fm API
            const url = `http://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${lastFmName}&api_key=${lastFmApi}&format=json&limit=1`;
            
            // Fetch data from the constructed URL
            const response = await fetch(url);
            const data = await response.json();
            
            // Get the Discord channel to send the currently playing data to
            const channel = this.client.channels.cache.get(discordChannelID);
            
            // Extract information about the currently playing track
            let track = data.recenttracks.track[0];
            let artist = track.artist['#text'];
            let album = track.album['#text'];
            let trackName = track.name;
    
            // Generate URLs for Last.fm track and artist pages
            const lastFmTrackLink = await this.getArtistTrack(artist, trackName);
            const lastFmArtist = await this.getArtistLink(artist);
    
            // Retrieve album cover image URL from Last.fm
            const image = await this.getAlbumCover(album, artist);
    
            // Get Last.fm user's avatar URL and total play count
            const userImage = await this.getUserAvatar(lastFmName);
            const totalPlayCount = await this.fetchTotalPlayCount(lastFmName);
    
            // Get the Last.fm user's account URL
            const account = await this.fetchAccountLink(lastFmName);
    
            // Create an embedded message for Discord with current playing track information
            const currentPlayingEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setAuthor({ name: `Last.fm: ${lastFmName}`, iconURL: `${userImage}`, url: `${account}` })
                .setThumbnail(`${image}`)
                .addFields(
                    { name: 'Track', value: `[${trackName}](<${lastFmTrackLink}>)`, inline: true },
                    { name: 'Artist', value: `[${artist}](<${lastFmArtist}>)`, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: `Total Playcount: ${totalPlayCount} Album: ${album}` });
    
            // Send the embedded message with currently playing track info to the Discord channel
            channel.send({ embeds: [currentPlayingEmbed] });
        } catch (error) {
            // Catch any errors that occur during the process and log them
            console.error('Error fetching Last.fm data:', error);
        }
    }
    
    async getTopAlbums(days, userID) {
        // Get Last.fm username associated with the userID
        const lastFmName = await this.getLastFmUsername(userID);
    
        try {
            // Construct the URL for retrieving top albums data
            const url = `http://ws.audioscrobbler.com/2.0/?method=user.getTopAlbums&user=${lastFmName}&api_key=${lastFmApi}&period=${days}&format=json&limit=10`;
            
            // Fetch data from the constructed URL
            const response = await fetch(url);
            const data = await response.json();
    
            // Check if top albums data exists in the response
            if (data.topalbums) {
                // Get Discord channel and user details for embedding
                const channel = this.client.channels.cache.get(discordChannelID);
                const topTenTracks = [];
                let maxLength = 0;
                const userImage = await this.getUserAvatar(lastFmName);
                const account = await this.fetchAccountLink(lastFmName);
    
                let checkDay = "";
                // Determine the time period for the top tracks
                if (days === '7d' || days === '7day') {
                    checkDay = 'weekly top tracks';
                } else if (days === '30d' || days === '1month') {
                    checkDay = 'monthly top tracks';
                } else if (days === '90d' || days === '3month') {
                    checkDay = 'past 3 months top tracks';
                } else if (days === '180d' || days === '6month') {
                    checkDay = 'past 6 months top tracks';
                } else if (days === '365d' || days === '12month') {
                    checkDay = 'past 12 months top tracks';
                } else if (days === 'overall') {
                    checkDay = 'overall top artists';
                }
    
                // Iterate through the top albums data and format information for embedding
                for (let i = 0; i < 10; i++) {
                    let track = data.topalbums.album[i];
                    let artist = track.artist.name;
                    let trackName = track.name;
                    let playCount = track.playcount;
                    const album = await this.getArtistAlbum(artist, track);
    
                    const line = `**${i + 1}**. **[${trackName}](<${album}>)** by **${artist}**   (${playCount})`;
                    topTenTracks.push(line);
                    maxLength = Math.max(maxLength, line.length);
                }
    
                // Format the top albums data into an embed
                const paddedTopTenTracks = topTenTracks.map((line) => {
                    const padding = ' '.repeat(maxLength - line.length);
                    return `${line}${padding}`;
                });
    
                const exampleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${lastFmName}'s ${checkDay}`)
                    .setAuthor({ name: `Last.fm: ${lastFmName}`, iconURL: userImage, url: account })
                    .setDescription(paddedTopTenTracks.join('\n'))
                    .setTimestamp();
    
                // Send the embedded top albums data to the Discord channel
                channel.send({ embeds: [exampleEmbed] });
            } else {
                console.error('No topalbums data found in the response.');
            }
        } catch (error) {
            // Handle errors if there are any during the process
            console.error('Error fetching Last.fm data:', error);
        }
    }
    
    async getTopArtists(days, userID) {
        // Retrieve Last.fm username associated with the userID
        const lastFmName = await this.getLastFmUsername(userID);

        try {
            // Construct the URL to fetch top artists data
            const url = `http://ws.audioscrobbler.com/2.0/?method=user.getTopArtists&user=${lastFmName}&api_key=${lastFmApi}&period=${days}&format=json&limit=10`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.topartists) {
                // Get Discord channel and user details for embedding
                const channel = this.client.channels.cache.get(discordChannelID);
                const topTenArtists = [];
                let maxLength = 0;
                const userImage = await this.getUserAvatar(lastFmName);
                const account = await this.fetchAccountLink(lastFmName);

                let checkDay = "";
                // Determine the time period for the top artists
                if ((days === '7d' || days === '7day')) {
                    checkDay = 'weekly top artists';
                } else if ((days === '30d' || days === '1month')) {
                    checkDay = 'monthly top artists';
                } else if ((days === '90d' || days === '3month')) {
                    checkDay = 'past 3 months top artists';
                } else if ((days === '180d' || days === '6month')) {
                    checkDay = 'past 6 months top artists';
                } else if ((days === '365d' || days === '12month')) {
                    checkDay = 'past 12 months top artists';
                }

                // Iterate through the top artists data and format information for embedding
                for (let i = 0; i < 10; i++) {
                    let artist = data.topartists.artist[i].name;
                    let playCount = data.topartists.artist[i].playcount;
                    const artistLink = await this.getArtistLink(artist);

                    const line = `**${i + 1}**.**[${artist}](<${artistLink}>)**  (${playCount} Plays)`;
                    topTenArtists.push(line);
                    maxLength = Math.max(maxLength, line.length);
                }
                const paddedTopTenArtist = topTenArtists.map((line) => {
                    const padding = ' '.repeat(maxLength - line.length);
                    return `${line}${padding}`;
                });
                const exampleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${lastFmName}s ${checkDay}`)
                    .setAuthor({ name: `Last.fm: ${lastFmName}`, iconURL: userImage, url: account })
                    .setDescription(paddedTopTenArtist.join('\n'))
                    .setTimestamp();

                channel.send({ embeds: [exampleEmbed] });
            }
        } catch (error) {
            console.error('Error fetching Last.fm data:', error);
        }
    }

    

    async getUserAvatar(username) {
        try {
            //Constructs the url to fetch users avatar from Last fm
            const url = `http://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${username}&api_key=${lastFmApi}&format=json`;
            //Fetch data from the constructued url
            const response = await fetch(url);
            const data = await response.json();
            
            //Ensures there is a user that exists and saves their avatar in a variable and returns it. 
            //If it does not exist return an error, 
            if (data.user) {
                const user = data.user;
                const avatarURL = user.image.find(img => img.size === 'extralarge')['#text'];
                return avatarURL;
            } else {
                console.error('No user data found in the response.');
                return null; 
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null; 
        }
    }
    //Function to retrieve the total playcount the user has from Last.fm through the userID
    async fetchTotalPlayCount(userID) {

        const url = `http://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${userID}&api_key=${lastFmApi}&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        return data.user.playcount;
    }
    //Function to retrieve the account link from Last.fm through the userID
    async fetchAccountLink(userID) {

        const url = `http://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${userID}&api_key=${lastFmApi}&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        return data.user.url;
    }
    //Function to retrieve the artist link from Last.fm through the artist name
    async getArtistLink(artist){
        const lastFmArtist = `https://www.last.fm/music/${encodeURIComponent(artist)}`;
        return lastFmArtist;
    }
    //Function to retrieve the artist track link from Last.fm through the artist nameand track name
    async getArtistTrack(artist,trackName){
        const lastFmTrackLink = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/` + encodeURIComponent(trackName);
        return lastFmTrackLink;
    }
    //Function to retrieve the artist album link from Last.fm through the artist name and album name
    async getArtistAlbum(artist, albumName) {
        const lastFmAlbumLink = `https://www.last.fm/music/${encodeURIComponent(artist)}/${encodeURIComponent(albumName)}`;
        return lastFmAlbumLink;
    }
    //Function to retrieve the album cover  from Last.fm through the album name and artist name
    async getAlbumCover(albumName, artistName) {    
        try {
                const url = `http://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${lastFmApi}&artist=${artistName}&album=${albumName}&format=json`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.album) {
                    const image = data.album.image[3]['#text']; // Adjust the index for the desired image size
                    return image;
                } else {
                    console.error('No album info found in the response.');
                    return null;
                }
            } catch (error) {
                console.error('Error fetching album cover data:', error);
                return null;
            }
        }

    


}
//Export the LastFmModule to be used in other modules/files
module.exports = LastFmModule;