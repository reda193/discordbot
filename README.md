**Last.fm Discord Bot**


Description
===========================

A simple discord bot program that uses JavaScript and Node.js to allow users to showcaise their listening staistics using the Last.FM API to fetch user information.
Stores their discord ID and Last.Fm username in a database to allow efficent and secure data retrievel.
Also utilizies Youtube Api to allow users to search up youtube videos with a keyword.

Important Notes
===========================
You will need to provide your own database, discord token, last.fm api, discord channel, and youtibe api in order to make this work.


Important Dependencies
===========================
mysql2 (Important note: mysql would not work for some reason ?)
node-fetch
dotenv
discord.js

Important commands for the bot 
===========================
When you first authorize your last.fm username enter ,fm authorize to get started.
If you wish to update your username enter ,fm update.

**,fm** Utilizies all the ,fm commands present in the code. 
This includes tt or toptracks, ta or topalbums, topartists or artists, getcurrentlyplaying or playing or current.

For example, if you wish to show your toptracks for the past 180d, you would enter ,fm toptracks 180d.


