const mongoose = require('mongoose')

const userProfileSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAuth",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Non-binary", "Other"],
      required: true,
    },
    profilePhotoUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UserProfile", userProfileSchema);
