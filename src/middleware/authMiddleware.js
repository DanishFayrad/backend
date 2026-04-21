import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ message: 'Token missing or invalid' });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret)
            throw new Error('JWT_SECRET not defined');
        const decoded = jwt.verify(token, jwtSecret);
        
        req.user = decoded; // { user_id, is_admin }
        next();
    }
    catch (err) {
        console.error(err);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};
export const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};
//# sourceMappingURL=authMiddleware.js.map