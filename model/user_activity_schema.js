const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isOnline: { type: Boolean, default: false },
    typingIn: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", default: null },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserActivity", userActivitySchema);
