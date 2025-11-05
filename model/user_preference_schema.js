const mongoose = require('mongoose')

const userPreferencesSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserAuth",
            required: true,
        },
        interests: [
            {
                type: String,
            },
        ],
        languages: [
            {
                type: String,
            },
        ],
        distancePreference: {
            type: Number,
            default: 50, // in km
        },
        ageRangePreference: {
            min: { type: Number, default: 18 },
            max: { type: Number, default: 50 },
        },
        genderPreference: {
            type: [String],
            enum: ["Male", "Female", "Non-binary", "Other"],
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
            city: String,
            country: String,
        },
    },
    {
        timestamps: true,
    }
);

userPreferencesSchema.index({ location: "2dsphere" });

moduel.exports = mongoose.model("UserPreferences", userPreferencesSchema);
