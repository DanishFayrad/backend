import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { sendEmail } from '../services/emailService.js';
dotenv.config();

export const register = async (req, res) => {
    try {
        const { name, email, password, phone, country, referral_code, ...otherData } = req.body;
        
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Handle Referral
        let referredBy = null;
        if (referral_code) {
            console.log(`Processing registration with referral code: ${referral_code}`);
            const referrer = await User.findOne({ where: { referral_code: referral_code.trim().toUpperCase() } });
            if (referrer) {
                referredBy = referrer.id;
                referrer.referral_count += 1;
                await referrer.save();
                console.log(`Referral matched! Referrer ID: ${referrer.id}, Name: ${referrer.name}`);
            } else {
                console.log(`No referrer found for code: ${referral_code}`);
            }
        }

        // Generate unique referral code for the new user
        const newReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            country,
            is_email_verified: false,
            otp,
            otp_expires: otpExpires,
            referral_code: newReferralCode,
            referred_by: referredBy,
            is_admin: false // Ensure new registrations are NEVER admin by default
        });

        // Send OTP via Email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2 style="color: #d4af37;">Welcome to Asian FX</h2>
                <p>Hello ${name},</p>
                <p>Your verification code is:</p>
                <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes.</p>
            </div>
        `;
        
        await sendEmail(email, 'Verify Your Asian FX Account', `Your OTP is ${otp}`, emailHtml);

        return res.status(201).json({ 
            message: 'Registration successful! Please check your email for the verification code.', 
            user_id: user.id 
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ where: { email, otp } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (new Date() > user.otp_expires) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        user.is_email_verified = true;
        user.otp = null;
        user.otp_expires = null;
        await user.save();

        return res.status(200).json({ message: 'Email verified successfully!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.reset_password_otp = otp;
        user.reset_password_expires = expires;
        await user.save();

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2 style="color: #d4af37;">Password Reset Request</h2>
                <p>Your password reset code is:</p>
                <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `;

        await sendEmail(email, 'Reset Your Asian FX Password', `Your password reset code is ${otp}`, emailHtml);

        return res.status(200).json({ message: 'Password reset OTP sent to your email.' });
    } catch (error) {
        console.error("FORGOT_PASSWORD_ERROR:", error);
        return res.status(500).json({ message: 'Server error', details: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ where: { email, reset_password_otp: otp } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (new Date() > user.reset_password_expires) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.reset_password_otp = null;
        user.reset_password_expires = null;
        await user.save();

        return res.status(200).json({ message: 'Password reset successful!' });
    } catch (error) {
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

        // Check if email is verified
        if (!user.is_email_verified && !user.is_admin) {
            return res.status(403).json({ message: 'Please verify your email address first.' });
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

export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.is_email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otp = otp;
        user.otp_expires = expires;
        await user.save();

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                <h2 style="color: #d4af37;">Verify Your Asian FX Account</h2>
                <p>Hello ${user.name},</p>
                <p>Your new verification code is:</p>
                <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes.</p>
            </div>
        `;

        await sendEmail(email, 'Verify Your Asian FX Account', `Your OTP is ${otp}`, emailHtml);

        return res.status(200).json({ message: 'New verification code sent to your email.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
//# sourceMappingURL=authController.js.map