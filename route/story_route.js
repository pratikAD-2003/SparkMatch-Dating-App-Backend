const express = require('express');
const route = express.Router()
const parser = require('../middleware/upload');

const { uploadStory, getStories, markStorySeen, getUserStoriesById } = require('../controller/story_controller')

route.post('/uploadStory', parser.single('storyImageUrl'), uploadStory);

route.get('/getStories/:userId', getStories);

route.post('/markStorySeen', markStorySeen);

route.get("/getUserStoriesById", getUserStoriesById);

module.exports = route;