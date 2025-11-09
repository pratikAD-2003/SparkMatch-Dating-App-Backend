const mongoose = require("mongoose");
const UserProfile = require("../model/user_profile_schema");
const UserAuth = require("../model/user_auth_schema");

const updateProfileDetails = async (req, res) => {
    try {
        const { userId, fullName, profession, dateOfBirth, gender, bio } = req.body;

        let profilePhotoUrl = req.body.profilePhotoUrl || "";
        if (req.file && req.file.path) {
            profilePhotoUrl = req.file.path;
        }

        // Prepare updated data
        const updateData = {
            fullName,
            profession,
            dateOfBirth,
            gender,
            bio,
            profilePhotoUrl,
        };

        // Find and update if exists, else create a new one
        const userProfile = await UserProfile.findOneAndUpdate(
            { userId },
            updateData,
            { new: true, upsert: true }
        );
        // ✅ Also mark user as updated in UserAuth
        await UserAuth.findByIdAndUpdate(userId, { isUpdated: true });

        return res.status(200).json({
            message: "Profile updated successfully",
            data: userProfile,
        });
    } catch (err) {
        console.error("Profile Updation Failed:", err);
        return res
            .status(500)
            .json({ message: "Profile Updation Failed. Try again." });
    }
};

module.exports = { updateProfileDetails };
