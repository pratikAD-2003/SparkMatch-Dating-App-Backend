const UserAuth = require('../model/user_auth_schema');
const UserProfile = require('../model/user_profile_schema');
const UserPreferences = require('../model/user_preference_schema');
const UserInteraction = require('../model/user_interection_schems');
const mongoose = require('mongoose')

exports.getHomeMatches = async (req, res) => {
    try {
        const { userId, distance, genderPreference, language, minAge, maxAge, interest, location } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        // 🔹 Step 1: Get current user location
        let myLocation;
        if (location) {
            // Expect ?location=77.5946,12.9716 (lon,lat)
            const [lon, lat] = location.split(",").map(Number);
            if (isNaN(lon) || isNaN(lat)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid location format. Use longitude,latitude",
                });
            }
            myLocation = [lon, lat];
        } else {
            const myPref = await UserPreferences.findOne({ userId }).lean();
            if (!myPref || !myPref.location?.coordinates) {
                return res.status(404).json({
                    success: false,
                    message: "User preferences or location not found",
                });
            }
            myLocation = myPref.location.coordinates;
        }

        // 🔹 Step 2: Find already interacted users
        const interacted = await UserInteraction.find({ fromUser: userId }).select("toUser");
        const interactedUserIds = interacted.map((i) => i.toUser.toString());

        // 🔹 Step 3: Build filters
        const matchFilter = {};

        if (genderPreference) matchFilter["preferences.genderPreference"] = genderPreference;
        if (language) matchFilter["preferences.languages"] = language;
        if (interest) matchFilter["preferences.interests"] = interest;

        // 🔹 Step 4: Age filter
        const today = new Date();
        if (minAge || maxAge) {
            const minDOB = maxAge ? new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate()) : null;
            const maxDOB = minAge ? new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate()) : null;
            matchFilter["profile.dateOfBirth"] = {};
            if (minDOB) matchFilter["profile.dateOfBirth"].$lte = minDOB;
            if (maxDOB) matchFilter["profile.dateOfBirth"].$gte = maxDOB;
        }

        // 🔹 Step 5: Geo filter — ensure same field path for all users
        const geoFilter = distance
            ? {
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: myLocation },
                        $maxDistance: Number(distance) * 1000, // km → m
                    },
                },
            }
            : {};

        // 🔹 Step 6: Aggregate matches
        const users = await UserPreferences.aggregate([
            {
                $match: {
                    userId: {
                        $ne: new mongoose.Types.ObjectId(userId),
                        $nin: interactedUserIds.map((id) => new mongoose.Types.ObjectId(id)),
                    },
                    ...geoFilter,
                },
            },
            {
                $lookup: {
                    from: "userprofiles",
                    localField: "userId",
                    foreignField: "userId",
                    as: "profile",
                },
            },
            { $unwind: "$profile" },
            {
                $lookup: {
                    from: "userauths",
                    localField: "userId",
                    foreignField: "_id",
                    as: "auth",
                },
            },
            { $unwind: "$auth" },
            {
                $match: {
                    ...matchFilter,
                    "auth.isUpdated": true,
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: 1,
                    fullName: "$profile.fullName",
                    profession: "$profile.profession",
                    profilePhotoUrl: "$profile.profilePhotoUrl",
                    age: {
                        $cond: [
                            { $ifNull: ["$profile.dateOfBirth", false] },
                            {
                                $floor: {
                                    $divide: [
                                        { $subtract: [new Date(), { $toDate: "$profile.dateOfBirth" }] },
                                        1000 * 60 * 60 * 24 * 365,
                                    ],
                                },
                            },
                            null,
                        ],
                    },
                    distance: {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $acos: {
                                            $add: [
                                                {
                                                    $multiply: [
                                                        { $sin: { $degreesToRadians: myLocation[1] } },
                                                        { $sin: { $degreesToRadians: { $arrayElemAt: ["$location.coordinates", 1] } } },
                                                    ],
                                                },
                                                {
                                                    $multiply: [
                                                        { $cos: { $degreesToRadians: myLocation[1] } },
                                                        { $cos: { $degreesToRadians: { $arrayElemAt: ["$location.coordinates", 1] } } },
                                                        {
                                                            $cos: {
                                                                $subtract: [
                                                                    { $degreesToRadians: myLocation[0] },
                                                                    { $degreesToRadians: { $arrayElemAt: ["$location.coordinates", 0] } },
                                                                ],
                                                            },
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    },
                                    6371,
                                ],
                            },
                            1,
                        ],
                    },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        console.error("Error fetching home matches:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

exports.handleInteraction = async (req, res) => {
    try {
        const { fromUser, toUser, status } = req.body;

        if (!fromUser || !toUser || !status) {
            return res.status(400).json({ success: false, message: "fromUser, toUser, and status are required" });
        }

        if (fromUser === toUser) {
            return res.status(400).json({ success: false, message: "You cannot interact with yourself" });
        }

        // 🔹 Check existing interaction
        const existing = await UserInteraction.findOne({ fromUser, toUser });

        // ✅ Handle 'favorite' - simple one-direction status
        if (status === "favorite") {
            if (existing && existing.status === "favorite") {
                return res.status(200).json({ success: false, message: "Already marked as favorite" });
            }
            await UserInteraction.findOneAndUpdate(
                { fromUser, toUser },
                { $set: { status: "favorite" } },
                { upsert: true, new: true }
            );
            return res.status(200).json({ success: true, message: "User marked as favorite" });
        }

        // ✅ Handle 'requested' logic
        if (status === "requested") {
            // Check reverse record for mutual match
            const reverse = await UserInteraction.findOne({ fromUser: toUser, toUser: fromUser });

            if (reverse && reverse.status === "requested") {
                // Mutual match: update both
                await Promise.all([
                    UserInteraction.findOneAndUpdate({ fromUser, toUser }, { $set: { status: "matched" } }, { upsert: true }),
                    UserInteraction.findOneAndUpdate({ fromUser: toUser, toUser: fromUser }, { $set: { status: "matched" } }),
                ]);

                return res.status(200).json({
                    success: true,
                    message: "It's a match!",
                });
            }

            // If already requested, return info
            if (existing && existing.status === "requested") {
                return res.status(200).json({ success: false, message: "Request already sent" });
            }

            // Otherwise create request
            await UserInteraction.findOneAndUpdate(
                { fromUser, toUser },
                { $set: { status: "requested" } },
                { upsert: true }
            );

            return res.status(200).json({ success: true, message: "Request sent successfully" });
        }

        return res.status(400).json({ success: false, message: "Invalid status type" });
    } catch (error) {
        console.error("Error handling interaction:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

exports.getRequestedUsers = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query; // 'sent' or 'received'

        let filter = {};
        if (type === "sent") filter = { fromUser: userId, status: "requested" };
        else filter = { toUser: userId, status: "requested" };

        const requests = await UserInteraction.find(filter)
            .populate({
                path: type === "sent" ? "toUser" : "fromUser",
                select: "_id email",
            })
            .lean();

        // Extract matched user IDs
        const userIds = requests.map(req =>
            type === "sent" ? req.toUser._id : req.fromUser._id
        );

        const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();

        const users = profiles.map(profile => ({
            userId: profile.userId.toString(),
            fullName: profile.fullName,
            profession: profile.profession,
            profilePhotoUrl: profile.profilePhotoUrl,
            age: Math.floor(
                (new Date() - new Date(profile.dateOfBirth)) /
                (1000 * 60 * 60 * 24 * 365)
            ),
        }));

        res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
        console.error("Error fetching requested users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching requested users",
            error: error.message,
        });
    }
};


exports.getMatchedUsers = async (req, res) => {
    try {
        const { userId } = req.params;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const matches = await UserInteraction.aggregate([
            {
                $match: {
                    status: "matched",
                    $or: [{ fromUser: userObjectId }, { toUser: userObjectId }],
                },
            },
            // 👇 Normalize pair so A↔B becomes the same (avoid duplicate)
            {
                $addFields: {
                    pairKey: {
                        $cond: [
                            { $lt: ["$fromUser", "$toUser"] },
                            { $concat: [{ $toString: "$fromUser" }, "_", { $toString: "$toUser" }] },
                            { $concat: [{ $toString: "$toUser" }, "_", { $toString: "$fromUser" }] },
                        ],
                    },
                },
            },
            { $group: { _id: "$pairKey", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },

            // 👇 Identify the other user
            {
                $addFields: {
                    matchedUserId: {
                        $cond: {
                            if: { $eq: ["$fromUser", userObjectId] },
                            then: "$toUser",
                            else: "$fromUser",
                        },
                    },
                },
            },

            // 👇 Join with user profile
            {
                $lookup: {
                    from: "userprofiles",
                    localField: "matchedUserId",
                    foreignField: "userId",
                    as: "profile",
                },
            },
            { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

            // 👇 Prepare final projection
            {
                $project: {
                    _id: 0,
                    userId: "$matchedUserId",
                    fullName: "$profile.fullName",
                    profession: "$profile.profession",
                    profilePhotoUrl: "$profile.profilePhotoUrl",
                    age: {
                        $floor: {
                            $divide: [
                                { $subtract: [new Date(), { $toDate: "$profile.dateOfBirth" }] },
                                1000 * 60 * 60 * 24 * 365,
                            ],
                        },
                    },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            count: matches.length,
            users: matches,
        });
    } catch (error) {
        console.error("Error fetching matched users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching matched users",
            error: error.message,
        });
    }
};


exports.getFavoriteUsers = async (req, res) => {
    try {
        const { userId } = req.params;

        const favorites = await UserInteraction.find({
            fromUser: userId,
            status: "favorite",
        })
            .populate("toUser", "_id email")
            .lean();

        const userIds = favorites.map(fav => fav.toUser._id);
        const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();

        const users = profiles.map(profile => ({
            userId: profile.userId.toString(),
            fullName: profile.fullName,
            profession: profile.profession,
            profilePhotoUrl: profile.profilePhotoUrl,
            age: Math.floor(
                (new Date() - new Date(profile.dateOfBirth)) /
                (1000 * 60 * 60 * 24 * 365)
            ),
        }));

        res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
        console.error("Error fetching favorite users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching favorites",
            error: error.message,
        });
    }
};
