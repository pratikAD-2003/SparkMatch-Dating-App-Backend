const Chat = require("../model/chat_schema");

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

exports.getUserChats = async (req, res) => {
    try {
        const { userId } = req.params;
        const chats = await Chat.find({ participants: userId })
            .populate("participants", "fullName profilePhoto")
            .sort({ updatedAt: -1 });
        res.json({ success: true, chats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
