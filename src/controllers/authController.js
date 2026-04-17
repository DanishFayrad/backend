import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const register = async (req, res) => {
    try {
        const { name, email, password, phone, country, ...otherData } = req.body;
        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            country,
            ...otherData,
            is_email_verified: true // Setting true for now as we don't have email service setup, following user's usual flow
        });
        return res.status(201).json({ message: 'User registered successfully', user_id: user.id });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for Super Admin (from .env)
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (email === adminEmail && password === adminPassword) {
            // Find or create the admin in DB to have a valid user_id for signals
            let [adminUser] = await User.findOrCreate({
                where: { email: adminEmail },
                defaults: {
                    name: 'Super Admin',
                    password: await bcrypt.hash(adminPassword, 10),
                    is_admin: true,
                    is_email_verified: true
                }
            });

            // Ensure is_admin is true even if user was created manually before
            if (!adminUser.is_admin) {
                adminUser.is_admin = true;
                await adminUser.save();
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) throw new Error('JWT_SECRET not defined');

            const token = jwt.sign(
                { user_id: adminUser.id, is_admin: true }, 
                jwtSecret, 
                { expiresIn: process.env.JWT_EXPIRE || '2h' }
            );

            return res.status(200).json({ 
                access_token: token, 
                token_type: 'bearer', 
                is_admin: true,
                user: {
                    id: adminUser.id,
                    name: adminUser.name,
                    email: adminUser.email,
                    is_admin: true,
                    is_active: true
                },
                message: 'Super Admin login successful' 
            });
        }

        // Standard User Login
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        // Generate token
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpire = process.env.JWT_EXPIRE;
        if (!jwtSecret)
            throw new Error('JWT_SECRET not defined');
        const token = jwt.sign({ user_id: user.id, is_admin: user.is_admin }, jwtSecret, { expiresIn: jwtExpire || '2h' });
        
        return res.status(200).json({ 
            access_token: token, 
            token_type: 'bearer', 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                is_admin: user.is_admin,
                is_active: user.is_active,
                wallet_balance: user.wallet_balance
            },
            message: 'Login successful' 
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const logout = async (req, res) => {
    try {
        // Since we use stateless JWT, we just return success
        // In the future, you could implement token blacklisting here
        return res.status(200).json({ message: 'Logout successful' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.user_id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json(user);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
//# sourceMappingURL=authController.js.map