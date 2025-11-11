const express = require("express");
const router = express.Router();
const { createChat, getUserChats } = require("../controller/chat_controller");

router.post("/", createChat);
router.get("/getUserChats/:userId", getUserChats);

module.exports = router;
