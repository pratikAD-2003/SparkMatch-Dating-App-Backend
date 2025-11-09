const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        mediaUrl: {
            type: String,
            required: true,
            trim: true,
        },
        viewedBy: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                viewedAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// 🕒 Automatically delete stories after 24 hours
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("Story", storySchema);
