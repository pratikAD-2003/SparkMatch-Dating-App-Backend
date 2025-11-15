const Story = require("../model/story_schema");
const UserProfile = require("../model/user_profile_schema");
const mongoose = require("mongoose");

// We'll store io globally here for emitting
let ioInstance = null;
const setSocketIO = (io) => {
    ioInstance = io;
};

// Upload story
const uploadStory = async (req, res) => {
    try {
        const { userId } = req.body;  // userId = UserAuth _id
        const storyImageUrl = req.file.path;

        if (!userId || !storyImageUrl) {
            return res.status(400).json({ success: false, message: "UserId and storyImage required" });
        }

        // Create story
        const story = await Story.create({ userId, storyImageUrl });

        // Get user profile
        const userProfile = await UserProfile.findOne({ userId });

        // Return story with user info
        res.status(201).json({
            success: true,
            story: {
                storyId: story._id,
                userId,
                fullName: userProfile?.fullName || "Unknown",
                profilePhotoUrl: userProfile?.profilePhotoUrl || "",
                storyImageUrl: story.storyImageUrl,
                isSeen: false,  // default
                createdAt: story.createdAt
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to upload story" });
    }
};


const getStories = async (req, res) => {
    try {
        const viewerIdStr = req.params.userId; // string
        if (!mongoose.Types.ObjectId.isValid(viewerIdStr)) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        }
        const viewerId = new mongoose.Types.ObjectId(viewerIdStr); // convert to ObjectId

        // Get all stories
        const stories = await Story.find().sort({ createdAt: -1 }).lean();

        // Map stories with user info and isSeen status
        const formattedStories = await Promise.all(
            stories.map(async (story) => {
                const userProfile = await UserProfile.findOne({ userId: story.userId });

                // Check if viewer has seen this story
                const isSeen = story.seenBy?.some(id => id.equals(viewerId)) || false;

                return {
                    storyId: story._id,
                    userId: story.userId,
                    fullName: userProfile?.fullName || "Unknown",
                    profilePhotoUrl: userProfile?.profilePhotoUrl || "",
                    storyImageUrl: story.storyImageUrl,
                    isSeen,
                    createdAt: story.createdAt
                };
            })
        );

        res.json({ success: true, stories: formattedStories });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to fetch stories" });
    }
};

const markStorySeen = async (req, res) => {
    try {
        let { storyId, userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(storyId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid storyId or userId" });
        }

        storyId = new mongoose.Types.ObjectId(storyId);
        userId = new mongoose.Types.ObjectId(userId);

        const story = await Story.findByIdAndUpdate(
            storyId,
            { $addToSet: { seenBy: userId } },
            { new: true }
        ).populate("userId", "fullName profilePhotoUrl");

        if (!story) return res.status(404).json({ success: false, message: "Story not found" });

        const storyData = {
            storyId: story._id,
            userId: story.userId._id,
            fullName: story.userId.fullName,
            profilePhotoUrl: story.userId.profilePhotoUrl,
            storyImageUrl: story.storyImageUrl,
            isSeen: story.seenBy.includes(userId),
        };

        // Emit real-time update
        if (ioInstance) ioInstance.emit("storySeenUpdate", storyData);

        res.json({ success: true, story: storyData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to mark story as seen", error: err.message });
    }
};


const getUserStoriesById = async (req, res) => {
    try {
        const { userId, viewerId } = req.query; // viewerId = current logged-in user who is viewing the story

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        // Fetch all stories for the given user
        const stories = await Story.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        // Fetch user profile
        const profile = await UserProfile.findOne({ userId }).lean();

        // Prepare response
        const response = {
            userId,
            fullName: profile?.fullName || "",
            profilePhotoUrl: profile?.profilePhotoUrl || "",
            stories: stories.map(story => ({
                storyId: story._id,
                mediaUrl: story.storyImageUrl, // field from your schema
                createdAt: story.createdAt,
                isSeen: story.seenBy?.includes(viewerId) || false, // check if current viewer has seen it
            })),
        };

        res.status(200).json({ success: true, user: response });
    } catch (error) {
        console.error("Error fetching user stories:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};


module.exports = {
    uploadStory,
    getStories,
    markStorySeen,
    setSocketIO,
    getUserStoriesById
};
