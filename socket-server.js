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
async function addUserToRoom(roomId, userName) {
    const key = `room:${roomId}:users`;
    await redis.sAdd(key, userName);
    return await redis.sMembers(key);
}

async function removeUserFromRoom(roomId, userName) {
    const key = `room:${roomId}:users`;
    await redis.sRem(key, userName);
    return await redis.sMembers(key);
}

async function getRoomUsers(roomId) {
    const key = `room:${roomId}:users`;
    return await redis.sMembers(key);
}

io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, userName }) => {
        try {
            socket.join(roomId);
            socket.userName = userName;
            socket.roomId = roomId;

            const users = await addUserToRoom(roomId, userName);
            io.to(roomId).emit("users-update", users);
        } catch (error) {
            console.error("Error joining room:", error);
            socket.emit("error", "Failed to join room");
        }
    });

    socket.on("disconnect", async () => {
        const { roomId, userName } = socket;
        if (roomId && userName) {
            try {
                const users = await removeUserFromRoom(roomId, userName);
                io.to(roomId).emit("users-update", users);
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