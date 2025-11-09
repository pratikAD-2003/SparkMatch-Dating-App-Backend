const mongoose = require('mongoose');

const userInteractionSchema = mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    status: {
      type: String,
      enum: ["favorite", "requested", "matched"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userInteractionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model("UserInteraction", userInteractionSchema);
