const express = require("express");
const router = express.Router();
const { uploadStory, getAllStories, viewStory } = require("../controller/story_controller");

router.post("/", uploadStory);
router.get("/", getAllStories);
router.post("/view", viewStory);

module.exports = router;
