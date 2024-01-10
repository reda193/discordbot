//Import the 'node-fetch' library to achieve HTTP requests
const fetch = require('node-fetch');

// Retrieves the YouTube API key from .env folder.
const youtubeAPI = process.env.YOUTUBE_API;

//Class for handling YouTube functionalities
class YoutubeModule{
    constructor(client, discordChannelID) {
        this.client = client;
        this.discordChannelID = discordChannelID;
    }
    //Method to search for videos on YouTube based on a keyword given by th user.
    async youtubeSearch(keyword) {

        const url = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&key=${youtubeAPI}`;
       
        // Fetch data from the url above
        const response = await fetch(url); 
        const data = await response.json();

        //Retrieves the discord channel using the stored channel ID.
        const channel = this.client.channels.cache.get(this.discordChannelID);

        //Ensures that the channel exists
        if (!channel) {
            console.log("Channel not found");
        }

        //Ensures there are search results
        if (!data.items || data.items.length === 0) {
            channel.send("No search results found. Be more specific.");
            return;
        }

        //Extracts important video information from the search results as a map.
        const video = data.items.map(item => {
            return {
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.high.url,
                link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            };
        });

        //For loop that sends the first video to the channel.
        for (let i = 0; i < video.length; i++) {
            if (video[i].id) {
                channel.send(video[i].link);
                return;
            }
        }
    }
}
// Export the YouTube class to be used in other modules/files.
module.exports = YoutubeModule;
