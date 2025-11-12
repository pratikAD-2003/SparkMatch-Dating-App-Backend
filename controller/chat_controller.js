const mongoose = require("mongoose");
const Chat = require("../model/chat_schema");
const Story = require("../model/story_schema");
const UserProfile = require("../model/user_profile_schema");

exports.createChat = async (req, res) => {
    try {
        const { userId, otherUserId } = req.body;

        let chat = await Chat.findOne({
            participants: { $all: [userId, otherUserId] }
        });

        if (!chat) {
            chat = await Chat.create({ participants: [userId, otherUserId] });
        }

        res.json({ success: true, chat });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// exports.getUserChats = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(userId)) {
//             return res.status(400).json({ success: false, message: "Invalid userId" });
//         }

//         const objectUserId = new mongoose.Types.ObjectId(userId);

//         const chats = await Chat.aggregate([
//             { $match: { members: objectUserId } },

//             // Identify other participant
//             {
//                 $addFields: {
//                     otherParticipantId: {
//                         $arrayElemAt: [
//                             { $filter: { input: "$members", as: "m", cond: { $ne: ["$$m", objectUserId] } } },
//                             0,
//                         ],
//                     },
//                 },
//             },

//             // Lookup participant profile
//             {
//                 $lookup: {
//                     from: "userprofiles",
//                     localField: "otherParticipantId",
//                     foreignField: "userId",
//                     as: "participantProfile",
//                 },
//             },
//             { $unwind: { path: "$participantProfile", preserveNullAndEmptyArrays: true } },

//             // Lookup stories
//             {
//                 $lookup: {
//                     from: "stories",
//                     let: { participantId: "$otherParticipantId" },
//                     pipeline: [{ $match: { $expr: { $eq: ["$userId", "$$participantId"] } } }],
//                     as: "stories",
//                 },
//             },

//             // Lookup messages
//             {
//                 $lookup: {
//                     from: "messages",
//                     let: { chatId: "$_id" },
//                     pipeline: [
//                         { $match: { $expr: { $eq: ["$chatId", "$$chatId"] } } },
//                         { $sort: { createdAt: -1 } },
//                     ],
//                     as: "messages",
//                 },
//             },

//             // Project final fields
//             {
//                 $project: {
//                     chatId: "$_id",
//                     participant: {
//                         fullName: "$participantProfile.fullName",
//                         profilePhotoUrl: "$participantProfile.profilePhotoUrl",
//                     },
//                     lastMessage: { $arrayElemAt: ["$messages.message", 0] },
//                     byMe: { $eq: [{ $arrayElemAt: ["$messages.senderId", 0] }, objectUserId] },
//                     isSeenMessage: {
//                         $cond: [
//                             { $in: [objectUserId, { $arrayElemAt: ["$messages.seenBy", 0] }] },
//                             true,
//                             false,
//                         ],
//                     },
//                     isSeenStory: {
//                         $cond: [
//                             {
//                                 $allElementsTrue: {
//                                     $map: {
//                                         input: "$stories",
//                                         as: "story",
//                                         in: { $in: [objectUserId, "$$story.viewedBy.userId"] },
//                                     },
//                                 },
//                             },
//                             true,
//                             false,
//                         ],
//                     },
//                     updatedAt: 1,
//                     unseenMessagesCount: {
//                         $size: {
//                             $filter: {
//                                 input: "$messages",
//                                 as: "msg",
//                                 cond: {
//                                     $and: [
//                                         { $eq: ["$$msg.senderId", "$otherParticipantId"] },
//                                         { $not: { $in: [objectUserId, "$$msg.seenBy"] } },
//                                     ],
//                                 },
//                             },
//                         },
//                     },
//                 },
//             },

//             { $sort: { updatedAt: -1 } },
//         ]);

//         res.json({ success: true, chats });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

exports.getUserChats = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, size = 10, search = "" } = req.body;

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        }

        const objectUserId = new mongoose.Types.ObjectId(userId);
        const skip = (parseInt(page) - 1) * parseInt(size);
        const limit = parseInt(size);

        // Build dynamic match for search (after participant lookup)
        const matchSearch = search
            ? {
                "participantProfile.fullName": {
                    $regex: search,
                    $options: "i", // case-insensitive
                },
            }
            : {};

        const chats = await Chat.aggregate([
            { $match: { members: objectUserId } },

            // Identify other participant
            {
                $addFields: {
                    otherParticipantId: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$members",
                                    as: "m",
                                    cond: { $ne: ["$$m", objectUserId] },
                                },
                            },
                            0,
                        ],
                    },
                },
            },

            // Lookup participant profile
            {
                $lookup: {
                    from: "userprofiles",
                    localField: "otherParticipantId",
                    foreignField: "userId",
                    as: "participantProfile",
                },
            },
            { $unwind: { path: "$participantProfile", preserveNullAndEmptyArrays: true } },

            // Optional search filter on participant name
            { $match: matchSearch },

            // Lookup stories
            {
                $lookup: {
                    from: "stories",
                    let: { participantId: "$otherParticipantId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$userId", "$$participantId"] } } },
                    ],
                    as: "stories",
                },
            },

            // Lookup messages
            {
                $lookup: {
                    from: "messages",
                    let: { chatId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$chatId", "$$chatId"] } } },
                        { $sort: { createdAt: -1 } },
                    ],
                    as: "messages",
                },
            },

            // Project final structure
            {
                $project: {
                    chatId: "$_id",
                    participant: {
                        fullName: "$participantProfile.fullName",
                        profilePhotoUrl: "$participantProfile.profilePhotoUrl",
                    },
                    lastMessage: { $arrayElemAt: ["$messages.message", 0] },
                    byMe: { $eq: [{ $arrayElemAt: ["$messages.senderId", 0] }, objectUserId] },
                    isSeenMessage: {
                        $cond: [
                            { $in: [objectUserId, { $arrayElemAt: ["$messages.seenBy", 0] }] },
                            true,
                            false,
                        ],
                    },
                    isSeenStory: {
                        $cond: [
                            {
                                $allElementsTrue: {
                                    $map: {
                                        input: "$stories",
                                        as: "story",
                                        in: { $in: [objectUserId, "$$story.viewedBy.userId"] },
                                    },
                                },
                            },
                            true,
                            false,
                        ],
                    },
                    updatedAt: 1,
                    unseenMessagesCount: {
                        $size: {
                            $filter: {
                                input: "$messages",
                                as: "msg",
                                cond: {
                                    $and: [
                                        { $eq: ["$$msg.senderId", "$otherParticipantId"] },
                                        { $not: { $in: [objectUserId, "$$msg.seenBy"] } },
                                    ],
                                },
                            },
                        },
                    },
                },
            },

            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]);

        // Total count for pagination
        const totalCountPipeline = [
            { $match: { members: objectUserId } },
            {
                $lookup: {
                    from: "userprofiles",
                    localField: "members",
                    foreignField: "userId",
                    as: "profiles",
                },
            },
            {
                $match: search
                    ? {
                        "profiles.fullName": { $regex: search, $options: "i" },
                    }
                    : {},
            },
            { $count: "total" },
        ];

        const totalResult = await Chat.aggregate(totalCountPipeline);
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        res.json({
            success: true,
            page: parseInt(page),
            size: parseInt(size),
            total,
            totalPages: Math.ceil(total / size),
            chats,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
