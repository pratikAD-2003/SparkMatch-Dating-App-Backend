// socket.js
const mongoose = require("mongoose");
const ChatModel = require("./model/chat_schema");
const MessageModel = require("./model/message_schems");
const UserActivity = require("./model/user_activity_schema");

const users = new Map(); // Map<userId, socketId>

function setupSocket(io) {
  io.use((socket, next) => {
    const userId = socket.handshake.query.token || socket.handshake.auth?.token;
    if (!userId) return next(new Error("No userId provided"));
    socket.userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    console.log("🟢 User connected:", socket.userId);
    users.set(socket.userId, socket.id);

    await UserActivity.findOneAndUpdate(
      { userId: socket.userId },
      { isOnline: true, lastSeen: new Date() },
      { upsert: true }
    );
    io.emit("user_status", { userId: socket.userId, isOnline: true });

    socket.join(socket.userId);

    // join chat room
    socket.on("join_chat", ({ chatId }) => {
      if (chatId) {
        socket.join(chatId.toString());
        console.log(`User ${socket.userId} joined chat ${chatId}`);
      }
    });

    // typing indicator
    socket.on("typing", async ({ chatId, isTyping }) => {
      try {
        await UserActivity.findOneAndUpdate(
          { userId: socket.userId },
          { typingIn: isTyping ? chatId : null }
        );
        socket.to(chatId.toString()).emit("user_typing", { userId: socket.userId, isTyping });
      } catch (err) {
        console.error("typing error:", err.message);
      }
    });

    // mark messages as seen
    socket.on("mark_seen", async ({ chatId, userId }) => {
      try {
        // add userId to seenBy for all messages in chat that don't already have it
        await MessageModel.updateMany(
          { chatId: new mongoose.Types.ObjectId(chatId), seenBy: { $ne: userId } },
          { $push: { seenBy: userId } }
        );

        // Notify every member in chat room (so client UI can update)
        const chat = await ChatModel.findById(chatId).lean();
        if (chat && chat.members && chat.members.length) {
          // emit to everyone in the chat room
          io.to(chatId.toString()).emit("messages_seen", { chatId, seenBy: userId });
        } else {
          // fallback: emit to chat room anyway
          io.to(chatId.toString()).emit("messages_seen", { chatId, seenBy: userId });
        }
      } catch (err) {
        console.error("❌ Seen update error:", err.message);
      }
    });

    // send message
    socket.on("send_message", async (data) => {
      try {
        const { receiverId, message } = data;
        if (!receiverId || !message) return;

        const senderObjectId = new mongoose.Types.ObjectId(socket.userId);
        const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

        // find or create chat
        let chat = await ChatModel.findOne({
          members: { $all: [senderObjectId, receiverObjectId] },
        });

        if (!chat) {
          chat = await ChatModel.create({
            members: [senderObjectId, receiverObjectId],
          });
        }

        // store message
        const newMsg = await MessageModel.create({
          chatId: chat._id,
          senderId: senderObjectId,
          receiverId: receiverObjectId,
          message,
          seenBy: [], // starts empty
        });

        // update lastMessage
        chat.lastMessage = {
          message,
          senderId: senderObjectId,
          createdAt: new Date(),
        };
        await chat.save();

        // emit to receiver if online
        const receiverSocket = users.get(receiverId);
        if (receiverSocket) {
          // tell receiver
          io.to(receiverSocket).emit("receive_message", {
            message: newMsg.message,
            chatId: chat._id.toString(),
            messageId: newMsg._id.toString(),
            senderId: socket.userId,
            createdAt: newMsg.createdAt,
          });

          // let sender know it was delivered
          io.to(socket.id).emit("message_delivered", {
            messageId: newMsg._id.toString(),
            chatId: chat._id.toString(),
            receiverId,
          });
        } else {
          // receiver offline: still notify sender that message saved (not delivered)
          io.to(socket.id).emit("message_sent", {
            message: newMsg.message,
            chatId: chat._id.toString(),
            messageId: newMsg._id.toString(),
            receiverId,
          });
        }

        // also emit to sender to render (if not already)
        // (if delivered branch ran, sender already got message_delivered; still emit message_sent for uniformity)
        io.to(socket.id).emit("message_sent", {
          message: newMsg.message,
          chatId: chat._id.toString(),
          messageId: newMsg._id.toString(),
          receiverId,
        });

      } catch (err) {
        console.error("❌ Message error:", err.message);
      }
    });

    // disconnect
    socket.on("disconnect", async () => {
      users.delete(socket.userId);
      await UserActivity.findOneAndUpdate(
        { userId: socket.userId },
        { isOnline: false, typingIn: null, lastSeen: new Date() }
      );
      io.emit("user_status", { userId: socket.userId, isOnline: false });
      console.log(`🔴 User ${socket.userId} disconnected`);
    });
  });
}

module.exports = setupSocket;
