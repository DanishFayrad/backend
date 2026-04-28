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
const userSessions = new Map(); // Track unique user IDs and their socket counts

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    const emitActiveCount = () => {
        // Count unique authenticated users + guest connections
        const authenticatedCount = userSessions.size;
        const totalSockets = io.engine.clientsCount;
        
        // We calculate 'active users' as unique logged-in users 
        // plus any sockets that haven't 'joined' yet (guests)
        // But to be most accurate to the user's request, we'll count unique users.
        const guestSockets = Array.from(io.sockets.sockets.values()).filter(s => !s.user_id).length;
        
        const count = authenticatedCount + guestSockets;
        console.log(`Broadcasting active client count: ${count} (Users: ${authenticatedCount}, Guests: ${guestSockets})`);
        io.to('admin').emit('active_clients_count', count);
    };

    emitActiveCount();
    
    socket.on('join', (user_id) => {
        socket.join(user_id);
        socket.user_id = user_id;
        
        // Track unique user session
        if (!userSessions.has(user_id)) {
            userSessions.set(user_id, new Set());
        }
        userSessions.get(user_id).add(socket.id);
        
        console.log(`User ${user_id} joined. Total unique users: ${userSessions.size}`);
        emitActiveCount();
    });

    socket.on('join_admin', () => {
        socket.join('admin');
        console.log(`An Admin joined the admin room: ${socket.id}`);
        emitActiveCount();
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.user_id && userSessions.has(socket.user_id)) {
            userSessions.get(socket.user_id).delete(socket.id);
            if (userSessions.get(socket.user_id).size === 0) {
                userSessions.delete(socket.user_id);
            }
        }
        
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

// Global Error Handler to prevent app crashes
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        // Don't leak stack traces in production
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

const PORT = process.env.PORT || 5000;
const startServer = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
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
            return; // Success, exit the retry loop
        }
        catch (error) {
            console.error(`Attempt ${i + 1} failed. Unable to start the server:`, error.message || error);
            
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All retry attempts failed. Exiting...');
                process.exit(1);
            }
        }
    }
};
startServer();
//# sourceMappingURL=app.js.map