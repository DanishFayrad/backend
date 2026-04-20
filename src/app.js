import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { sequelize } from './models/index.js';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

// Middleware to pass io to requests
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Emit active client count to admins
    const emitActiveCount = () => {
        const count = io.sockets.sockets.size;
        io.to('admin').emit('active_clients_count', count);
    };

    emitActiveCount();
    
    // Join a room based on user_id for private notifications
    socket.on('join', (user_id) => {
        socket.join(user_id);
        console.log(`User ${user_id} joined their private room.`);
    });

    socket.on('join_admin', () => {
        socket.join('admin');
        console.log(`An Admin joined the admin room.`);
        emitActiveCount(); // Send current count immediately
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        emitActiveCount();
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
// Routes
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import signalRoutes from './routes/signalRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'node-backend' });
});
// Root
app.get('/', (req, res) => {
    res.json({
        message: "Asian FX API - Node.js Backend",
        version: "2.0.0"
    });
});
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        // Sync database
        await sequelize.authenticate();
        console.log('Database connected successfully.');
        // In production, use migrations instead of sync({ alter: true })
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync({ alter: { drop: false } });
            console.log('Database synchronized.');
        }
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Unable to start the server:', error);
        process.exit(1); // Ensure the process exits with error code so Heroku triggers a crash state
    }
};
startServer();
//# sourceMappingURL=app.js.map