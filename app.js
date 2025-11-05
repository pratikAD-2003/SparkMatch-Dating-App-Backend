require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.use(express.json());

mongoose
    .connect("mongodb://127.0.0.1:27017/DatingApp")
    .then(() => console.log("✅ Mongo connected"))
    .catch((err) => console.log("❌ MongoDB error:", err));

const userAuth = require('./route/auth_route')

app.use('/api/user/auth',userAuth);

app.use('/', (req, res, next) => {
    res.send("working")
})


const users = new Map();

io.use((socket, next) => {
    const userId = socket.handshake.query.token || socket.handshake.auth?.token;
    if (!userId) return next(new Error("No userId provided"));
    socket.userId = userId;
    next();
});

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.userId);
    users.set(socket.userId, socket.id);

    socket.on("send_message", async (data) => {
        const { receiverId, message } = data;

        // Convert senderId and receiverId to ObjectId correctly
        const senderObjectId = new mongoose.Types.ObjectId(socket.userId);
        const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

        // 1️⃣ Create or get chat
        let chat = await ChatModel.findOne({
            members: { $all: [senderObjectId, receiverObjectId] }
        });

        if (!chat) {
            chat = new ChatModel({
                members: [senderObjectId, receiverObjectId]
            });
            await chat.save();
        }

        // 2️⃣ Save message
        const newMsg = new Message({
            chatId: chat._id,
            senderId: senderObjectId,
            receiverId: receiverObjectId,
            message
        });
        await newMsg.save();

        // 3️⃣ Update lastMessage in chat
        chat.lastMessage = {
            message,
            senderId: senderObjectId,
            createdAt: new Date(),
        };
        await chat.save();
        
        // 3️⃣ Emit message to receiver
        const receiverSocket = users.get(receiverId);
        if (receiverSocket) {
            io.to(receiverSocket).emit("receive_message", {
                senderId: socket.userId,
                message,
            });
        }
    });


    socket.on("disconnect", () => {
        users.delete(socket.userId);
        console.log(`🔴 User ${socket.userId} disconnected`);
    });
});


server.listen(5235, "0.0.0.0", () => {
    console.log("🚀 Server running on port 5235");
});
