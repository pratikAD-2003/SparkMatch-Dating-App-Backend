const express = require("express");
const router = express.Router();
const { getMessages, sendMessage } = require("../controller/message_controlller");

router.get("/:chatId", getMessages);
router.post("/", sendMessage);

module.exports = router;
