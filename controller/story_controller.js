const Story = require("../model/story_schema");
const UserProfile = require("../model/user_profile_schema");
const cloudinary = require("../cloudinary"); // your cloudinary config

// Upload a story
exports.uploadStory = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        if (!req.file || !req.file.path) {
            return res.status(400).json({ success: false, message: "Story media is required" });
        }

        const newStory = await Story.create({
            userId,
            mediaUrl: req.file.path,
        });

        res.status(201).json({
            success: true,
            message: "Story uploaded successfully",
            story: newStory,
        });
    } catch (error) {
        console.error("Upload story error:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};


exports.getStories = async (req, res) => {
    try {
        const { userId } = req.query; // current logged-in user

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        // Fetch all stories, latest first
        const stories = await Story.find()
            .sort({ createdAt: -1 })
            .lean();

        // Map to store latest story per user
        const uniqueStoriesMap = new Map();

        stories.forEach(story => {
            const uid = story.userId.toString();
            if (!uniqueStoriesMap.has(uid)) {
                uniqueStoriesMap.set(uid, story);
            }
        });

        const uniqueStories = Array.from(uniqueStoriesMap.values());

        // Fetch user profiles
        const userIds = uniqueStories.map(story => story.userId);
        const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();

        // Prepare final response
        const response = uniqueStories.map(story => {
            const profile = profiles.find(p => p.userId.toString() === story.userId.toString());
            const isSeen = story.viewedBy.some(v => v.userId?.toString() === userId.toString());

            return {
                storyId: story._id,
                fullName: profile?.fullName || "",
                profilePhotoUrl: profile?.profilePhotoUrl || "",
                isSeen,
            };
        });

        // Put current user's story first if exists
        const myStoryIndex = response.findIndex(s => s.storyId.toString() === userId.toString());
        if (myStoryIndex > -1) {
            const [myStory] = response.splice(myStoryIndex, 1);
            response.unshift(myStory);
        }

        res.status(200).json({
            success: true,
            count: response.length,
            stories: response,
        });
    } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// Helper to extract Cloudinary public ID from URL
function extractPublicId(imageUrl) {
    try {
        if (!imageUrl) return null;

        const parts = imageUrl.split("/upload/");
        if (parts.length < 2) return null;

        const publicIdWithExt = parts[1]; // everything after /upload/
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ""); // remove extension
        return publicId;
    } catch (err) {
        console.error("Error extracting publicId:", err.message);
        return null;
    }
}

exports.deleteStory = async (req, res) => {
    try {
        const { storyId, userId } = req.body;

        if (!storyId || !userId) {
            return res.status(400).json({ success: false, message: "storyId and userId are required" });
        }

        const story = await Story.findById(storyId);

        if (!story) {
            return res.status(404).json({ success: false, message: "Story not found" });
        }

        if (story.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this story" });
        }

        // Extract public ID and delete from Cloudinary
        const publicId = extractPublicId(story.mediaUrl);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }

        // Delete story from MongoDB
        await Story.findByIdAndDelete(storyId);

        res.status(200).json({ success: true, message: "Story deleted successfully" });
    } catch (error) {
        console.error("Delete story error:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};


// Mark a story as viewed
exports.viewStory = async (req, res) => {
    try {
        const { storyId, userId } = req.body;

        if (!storyId || !userId) {
            return res.status(400).json({ success: false, message: "storyId and userId are required" });
        }

        const story = await Story.findById(storyId);

        if (!story) {
            return res.status(404).json({ success: false, message: "Story not found" });
        }

        // Only add if not already viewed
        const alreadyViewed = story.viewedBy.some(v => v.userId?.toString() === userId.toString());

        if (!alreadyViewed) {
            story.viewedBy.push({ userId, viewedAt: new Date() });
            await story.save();
        }

        res.status(200).json({
            success: true,
            message: "Story viewed successfully",
            views: story.viewedBy.length, // current total unique views
        });
    } catch (error) {
        console.error("View story error:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

exports.getUserStoriesById = async (req, res) => {
    try {
        const { userId } = req.query; // userId = whose stories we want, viewerId = current logged-in

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        // Fetch stories for the specific user
        const stories = await Story.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        if (!stories.length) {
            return res.status(404).json({ success: false, message: "No stories found for this user" });
        }

        // Fetch user profile
        const profile = await UserProfile.findOne({ userId }).lean();

        // Prepare response
        const response = {
            userId,
            fullName: profile?.fullName || "",
            profilePhotoUrl: profile?.profilePhotoUrl || "",
            stories: stories.map(story => ({
                storyId: story._id,
                mediaUrl: story.mediaUrl,
                createdAt: story.createdAt
            })),
        };

        res.status(200).json({ success: true, user: response });
    } catch (error) {
        console.error("Error fetching user stories:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};


exports.getViewedStoryUsers = async (req, res) => {
    try {
        const { storyId } = req.query; // storyId passed in query or body

        if (!storyId) {
            return res.status(400).json({ success: false, message: "storyId is required" });
        }

        // Fetch the story with viewedBy
        const story = await Story.findById(storyId).lean();

        if (!story) {
            return res.status(404).json({ success: false, message: "Story not found" });
        }

        // Get all userIds who viewed the story
        const viewedUserIds = story.viewedBy.map(v => v.userId);

        if (!viewedUserIds.length) {
            return res.status(200).json({ success: true, users: [] });
        }

        // Fetch user profiles
        const profiles = await UserProfile.find({ userId: { $in: viewedUserIds } }).lean();

        // Prepare response with name, profilePhoto, and viewedAt
        const response = story.viewedBy.map(v => {
            const profile = profiles.find(p => p.userId.toString() === v.userId.toString());
            return {
                fullName: profile?.fullName || "",
                profilePhotoUrl: profile?.profilePhotoUrl || "",
                viewedAt: v.viewedAt,
            };
        });

        res.status(200).json({ success: true, users: response });
    } catch (error) {
        console.error("Error fetching viewed users:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};
