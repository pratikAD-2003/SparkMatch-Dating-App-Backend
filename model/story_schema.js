const mongoose = require('mongoose');

const storySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    storyImageUrl: {
      type: String,
      required: true,
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserAuth",
      }
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 24*60*60*1000) // optional: auto expire after 24h
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Story", storySchema);
