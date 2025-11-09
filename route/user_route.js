const express = require('express');
const route = express.Router()

const { getHomeMatches, handleInteraction, getFavoriteUsers, getMatchedUsers, getRequestedUsers } = require('../controller/user_controller');

route.get('/getHomeMatches', getHomeMatches);

// manage relation b/w users
route.put('/handleInteraction', handleInteraction);

route.get('/getFavoriteUsers/:userId', getFavoriteUsers);

route.get('/getMatchedUsers/:userId', getMatchedUsers);

route.get('/getRequestedUsers/:userId', getRequestedUsers);

module.exports = route;