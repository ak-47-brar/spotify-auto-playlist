// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

let accessToken = null;
let refreshToken = null;

// Step 1: Redirect to Spotify Authorization URL
app.get('/login', (req, res) => {
  const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    scope: 'playlist-modify-private playlist-modify-public user-read-playback-state',
  })}`;
  res.redirect(authUrl);
});

// Step 2: Handle Callback and Exchange Code for Tokens
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    res.send('Authorization successful! You can now use the /add-track endpoint.');
  } catch (error) {
    console.error('Error during token exchange:', error.response ? error.response.data : error);
    res.status(500).send('Error getting tokens: ' + error);
  }
});

// Step 3: Function to Refresh the Access Token
async function refreshAccessToken() {
  if (!refreshToken) {
    console.error('No refresh token available.');
    return;
  }
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    accessToken = response.data.access_token;
    console.log('Access token refreshed:', accessToken);
  } catch (error) {
    console.error('Error refreshing token:', error.response ? error.response.data : error);
  }
}

// Step 4: Get Currently Playing Track
async function getCurrentTrack() {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Ensure we have a currently playing track
    if (response.data && response.data.item) {
      return response.data.item.uri;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching current track:', error.response ? error.response.data : error);
    return null;
  }
}

// Step 5: Add Track to Playlist
app.get('/add-track', async (req, res) => {
  const playlistId = process.env.PLAYLIST_ID; // Set your Playlist ID in the .env file
  const trackUri = await getCurrentTrack();

  if (!trackUri) {
    return res.send('No song is currently playing.');
  }

  try {
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      { uris: [trackUri] },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.send('Track added to playlist!');
  } catch (error) {
    console.error('Error adding track:', error.response ? error.response.data : error);
    res.status(500).send('Error adding track: ' + error);
  }
});

// Step 6: Set Up Automatic Token Refresh Every 55 Minutes
setInterval(refreshAccessToken, 55 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
