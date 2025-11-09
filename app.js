require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
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

app.use(express.static(path.join(__dirname, "public")));

mongoose
    .connect("mongodb://127.0.0.1:27017/DatingApp")
    .then(() => console.log("✅ Mongo connected"))
    .catch((err) => console.log("❌ MongoDB error:", err));

const userAuth = require('./route/auth_route')
const userDetail = require('./route/user_route')
const chats = require('./route/chat_route')
const messages = require('./route/message_route')
const stories = require('./route/story_route')

app.use('/api/user/auth', userAuth);
app.use("/api/user/item", userDetail);
app.use("/api/user/chat", chats);
app.use("/api/user/messages", messages);
app.use("/api/user/stories", stories);

app.get('/', (req, res) => {
    res.send("Server Working ✅");
});

// ✅ Import socket setup
const setupSocket = require("./socket");
setupSocket(io);

server.listen(5235, "0.0.0.0", () => {
    console.log("🚀 Server running on port 5235");
});
