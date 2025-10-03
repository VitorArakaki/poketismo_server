# Poketismo Server

Socket.IO server with Redis integration for real-time communication.

## 🚀 Deploy Instructions

### Railway (Recommended)

1. Push this code to GitHub
2. Go to [Railway](https://railway.app)
3. Create new project from GitHub repo
4. Set environment variables:
   - `REDIS_HOST`: Your Redis host
   - `REDIS_PORT`: Your Redis port
   - `REDIS_PASSWORD`: Your Redis password
   - `REDIS_USERNAME`: default
   - `REDIS_SSL`: false
   - `PORT`: (Railway sets this automatically)

### Environment Variables

Copy the values from your local `.env` file to the hosting platform.

**Required:**

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_USERNAME`
- `REDIS_SSL`

**Optional:**

- `PORT` (automatically set by most platforms)
- `REDIS_DB`

## 🔗 Frontend Connection

After deploy, your frontend should connect to:

```javascript
const socket = io("https://your-app-name.up.railway.app");
```

## 📝 Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your Redis credentials
npm start
```

## 🛠 Features

- Real-time Socket.IO communication
- Redis for persistent storage
- Room-based user management
- Auto-scaling ready
- SSL/TLS support
