const { setSocketIO } = require("./controller/story_controller");

module.exports = (io) => {
    // Save io to controller for emitting
    setSocketIO(io);

    io.on("connection", (socket) => {
        console.log("User connected: " + socket.id);

        // Join a user room
        socket.on("joinUser", (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined their room`);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected: " + socket.id);
        });
    });
};