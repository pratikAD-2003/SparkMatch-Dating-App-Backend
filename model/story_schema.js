const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mediaUrl: String,
    caption: String,
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ⏳ Delete automatically after 24 hours
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("Story", storySchema);
