require('dotenv').config();
const { Server } = require("socket.io");
const http = require("http");
const { createClient } = require("redis");

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" } // Permite conexões de qualquer origem (ajuste para produção)
});

// Redis client setup
const redisConfig = {};

if (process.env.REDIS_URL) {
    redisConfig.url = process.env.REDIS_URL;
} else {
    redisConfig.socket = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        tls: process.env.REDIS_SSL === 'true'
    };
    if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
    }
    if (process.env.REDIS_USERNAME) {
        redisConfig.username = process.env.REDIS_USERNAME;
    }
    if (process.env.REDIS_DB) {
        redisConfig.database = parseInt(process.env.REDIS_DB);
    }
}

const redis = createClient(redisConfig);

// Connect to Redis
redis.connect().then(() => {
    console.log("Connected to Redis successfully");
}).catch(err => {
    console.error("Redis connection error:", err);
    process.exit(1);
});

// Redis error handling
redis.on('error', (err) => {
    console.error('Redis error:', err);
});

// Helper functions for Redis operations
async function addUserToRoom(roomId, userName, vote = null) {
    const usersKey = `room:${roomId}:users`;
    await redis.sAdd(usersKey, userName);

    // Store user vote if provided
    if (vote !== null) {
        const votesKey = `room:${roomId}:votes`;
        await redis.hSet(votesKey, userName, vote);
    }

    return await getRoomData(roomId);
}

async function removeUserFromRoom(roomId, userName) {
    const usersKey = `room:${roomId}:users`;
    const votesKey = `room:${roomId}:votes`;

    await redis.sRem(usersKey, userName);
    await redis.hDel(votesKey, userName);

    return await getRoomData(roomId);
}

async function getRoomUsers(roomId) {
    const key = `room:${roomId}:users`;
    return await redis.sMembers(key);
}

async function setUserVote(roomId, userName, vote) {
    const votesKey = `room:${roomId}:votes`;
    await redis.hSet(votesKey, userName, vote);
    return await getRoomData(roomId);
}

async function getRoomVotes(roomId) {
    const key = `room:${roomId}:votes`;
    return await redis.hGetAll(key);
}

async function getRoomShow(roomId) {
    const key = `room:${roomId}:show`;
    const show = await redis.get(key);
    return show === 'true';
}

async function getRoomData(roomId) {
    const users = await getRoomUsers(roomId);
    const votes = await getRoomVotes(roomId);
    const show = await getRoomShow(roomId);
    return { users, votes, show };
}

async function setRoomShow(roomId, show) {
    const showKey = `room:${roomId}:show`;
    await redis.set(showKey, show.toString());
    return await getRoomData(roomId);
}

io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, userName, vote, show }) => {
        try {
            socket.join(roomId);
            socket.userName = userName;
            socket.roomId = roomId;

            const roomData = await addUserToRoom(roomId, userName, vote, show);
            io.to(roomId).emit("users-update", roomData.users);
            io.to(roomId).emit("votes-update", roomData.votes);
            io.to(roomId).emit("votes-show-update", roomData.show);
        } catch (error) {
            console.error("Error joining room:", error);
            socket.emit("error", "Failed to join room");
        }
    });

    socket.on("user-vote", async ({ roomId, userName, vote }) => {
        try {
            const roomData = await setUserVote(roomId, userName, vote);
            io.to(roomId).emit("votes-update", roomData.votes);
        } catch (error) {
            console.error("Error updating vote:", error);
            socket.emit("error", "Failed to update vote");
        }
    });

    socket.on("vote-show", async ({ roomId, show }) => {
        try {
            const roomData = await setRoomShow(roomId, show);
            io.to(roomId).emit("votes-show-update", roomData.show);
        } catch (error) {
            console.error("Error updating show state:", error);
            socket.emit("error", "Failed to update show state");
        }
    });

    socket.on("clean-votes", async ({ roomId }) => {
        try {
            const votesKey = `room:${roomId}:votes`;
            await redis.del(votesKey); // Remove todos os votos da sala
            const roomData = await getRoomData(roomId);
            io.to(roomId).emit("votes-update", roomData.votes); // Atualiza todos os clientes
        } catch (error) {
            console.error("Error cleaning votes:", error);
            socket.emit("error", "Failed to clean votes");
        }
    });

    socket.on("disconnect", async () => {
        const { roomId, userName } = socket;
        if (roomId && userName) {
            try {
                const roomData = await removeUserFromRoom(roomId, userName);
                io.to(roomId).emit("users-update", roomData.users);
                io.to(roomId).emit("votes-update", roomData.votes);
            } catch (error) {
                console.error("Error removing user from room:", error);
            }
        }
    });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Graceful shutdown...');
    try {
        await redis.quit();
        console.log('Redis connection closed.');
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM. Graceful shutdown...');
    try {
        await redis.quit();
        console.log('Redis connection closed.');
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }
    process.exit(0);
});