const Message = require("../model/message_schems");
const Chat = require("../model/chat_schema");

exports.getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { chatId, sender, text, image } = req.body;

        const message = await Message.create({ chatId, sender, text, image });

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: { text, sender, createdAt: new Date() }
        });

        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
