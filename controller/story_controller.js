const Story = require("../model/story_schema");

exports.uploadStory = async (req, res) => {
    try {
        const { userId, mediaUrl, caption } = req.body;
        const story = await Story.create({ userId, mediaUrl, caption });
        res.json({ success: true, story });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllStories = async (req, res) => {
    try {
        const stories = await Story.find()
            .populate("userId", "fullName profilePhoto")
            .sort({ createdAt: -1 });
        res.json({ success: true, stories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.viewStory = async (req, res) => {
    try {
        const { storyId, viewerId } = req.body;
        await Story.findByIdAndUpdate(storyId, {
            $addToSet: { viewedBy: viewerId }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
