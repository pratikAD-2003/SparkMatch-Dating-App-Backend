const mongoose = require("mongoose");
const UserPreferences = require("../model/user_preference_schema");

const updateUserPreference = async (req, res) => {
    try {
        const { userId, interests, languages, distancePreference, ageRangePreference, genderPreference, location } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required." });
        }

        // Collect uploaded images (if any)
        let gallery = [];
        if (req.files && req.files.images) {
            gallery = req.files.images.map((file) => file.path);
        }

        const updateData = {};
        if (interests) updateData.interests = Array.isArray(interests) ? interests : JSON.parse(interests);
        if (languages) updateData.languages = Array.isArray(languages) ? languages : JSON.parse(languages);
        if (distancePreference) updateData.distancePreference = distancePreference;
        if (ageRangePreference) {
            updateData.ageRangePreference =
                typeof ageRangePreference === "string"
                    ? JSON.parse(ageRangePreference)
                    : ageRangePreference;
        }
        if (genderPreference) updateData.genderPreference =
            Array.isArray(genderPreference)
                ? genderPreference
                : JSON.parse(genderPreference);
        if (gallery.length > 0) updateData.gallery = gallery;
        if (location) {
            updateData.location =
                typeof location === "string" ? JSON.parse(location) : location;
        }

        const preferences = await UserPreferences.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            message: "User preferences updated successfully.",
            data: preferences,
        });
    } catch (err) {
        console.error("Error updating user preferences:", err);
        return res.status(500).json({ message: "Failed to update user preferences." });
    }
};

// ------------------ Update Interests ------------------
const updateInterests = async (req, res) => {
    try {
        const { userId, interests } = req.body;

        if (!interests || !Array.isArray(interests)) {
            return res.status(400).json({ message: "Interests must be an array of strings." });
        }

        const updated = await UserPreferences.findOneAndUpdate(
            { userId },
            { interests },
            { new: true, upsert: true } // create if not exists
        );

        return res.status(200).json({
            message: "Interests updated successfully",
            data: updated.interests, // only languages
        });
    } catch (err) {
        console.error("Error updating interests:", err);
        return res.status(500).json({ message: "Failed to update interests." });
    }
};

// ------------------ Update Languages ------------------
const updateLanguages = async (req, res) => {
    try {
        const { userId, languages } = req.body;

        if (!languages || !Array.isArray(languages)) {
            return res.status(400).json({ message: "Languages must be an array of strings." });
        }

        const updated = await UserPreferences.findOneAndUpdate(
            { userId },
            { languages },
            { new: true, upsert: true } // create if not exists
        );

        return res.status(200).json({
            message: "Languages updated successfully",
            data: updated.languages,
        });
    } catch (err) {
        console.error("Error updating languages:", err);
        return res.status(500).json({ message: "Failed to update languages." });
    }
};

module.exports = {
    updateUserPreference,
    updateInterests,
    updateLanguages,
};