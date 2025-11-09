const express = require("express");
const router = express.Router();
const parser = require('../middleware/upload');

const { uploadStory, getStories, deleteStory, getUserStoriesById, viewStory, getViewedStoryUsers } = require("../controller/story_controller");

router.post("/uploadStory", parser.single('storyImg'), uploadStory);

router.post("/viewStory", viewStory);

router.get("/getStories", getStories);

router.get("/getUserStoriesById", getUserStoriesById);

router.get("/getViewedStoryUsers", getViewedStoryUsers);

router.delete("/deleteStory", deleteStory);

module.exports = router;
