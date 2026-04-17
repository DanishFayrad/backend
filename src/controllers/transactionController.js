import { Transaction, User, Notification, sequelize } from '../models/index.js';
import path from 'path';
import fs from 'fs';
import cloudinary from '../config/cloudinary.js';

export const requestDeposit = async (req, res) => {
    try {
        let { amount, payment_method } = req.body;
        const user_id = req.user.user_id;

        amount = parseFloat(amount) || 0;

        if (!req.file) {
            return res.status(400).json({ message: 'Proof of payment screenshot is required.' });
        }

        // Convert buffer to Base64 for Cloudinary upload
        const base64Image = req.file.buffer.toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;

        const cloudinaryResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'asianfx_proofs',
        });
        
        console.log('Cloudinary Upload Result:', cloudinaryResult);
        const publicUrl = cloudinaryResult.secure_url;

        const transaction = await Transaction.create({
            user_id,
            amount,
            type: 'deposit',
            payment_method,
            proof_image: publicUrl,
            status: 'pending',
            description: `Deposit request via ${payment_method}`
        });

        // Notify Admin via Socket.io
        if (req.io) {
            req.io.to('admin').emit('admin_notification', {
                type: 'NEW_DEPOSIT',
                message: `New deposit request of $${amount} from User ID: ${user_id}`,
                transaction
            });
        }

        return res.status(201).json({ 
            message: 'Deposit request submitted successfully. Waiting for admin approval.',
            transaction 
        });
    } catch (error) {
        console.error('DEPOSIT_ERROR:', error);
        return res.status(500).json({ 
            message: 'Server error during deposit submission',
            details: error.message 
        });
    }
};

export const getMyTransactions = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const transactions = await Transaction.findAll({
            where: { user_id },
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json(transactions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getPendingTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            where: { status: 'pending' },
            include: [{
                model: User,
                attributes: ['id', 'name', 'email', 'phone']
            }],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json(transactions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const approveTransaction = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { amount } = req.body;
        const transaction = await Transaction.findByPk(id, { transaction: t });

        if (!transaction) {
            await t.rollback();
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (transaction.status !== 'pending') {
            await t.rollback();
            return res.status(400).json({ message: 'Transaction already processed' });
        }

        const user = await User.findByPk(transaction.user_id, { transaction: t });
        if (!user) {
            await t.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        // Update status
        transaction.status = 'approved';
        if (amount !== undefined && !isNaN(parseFloat(amount))) {
            transaction.amount = parseFloat(amount);
        }
        await transaction.save({ transaction: t });

        // Update wallet balance if it's a deposit
        if (transaction.type === 'deposit') {
            user.wallet_balance += transaction.amount;
            user.is_active = true; // Activate user for signals
            await user.save({ transaction: t });
        }

        // Create Notification
        const notification = await Notification.create({
            user_id: user.id,
            title: 'Payment Approved',
            message: `Hi ${user.name}, your deposit of $${transaction.amount} has been approved. Your account is now active!`,
            type: 'payment_approval',
            link: '/dashboard'
        }, { transaction: t });

        await t.commit();

        // Emit Socket.io Notification
        if (req.io) {
            req.io.to(user.id).emit('notification', {
                title: notification.title,
                message: notification.message,
                type: notification.type,
                created_at: notification.createdAt
            });
        }

        return res.status(200).json({ 
            message: 'Transaction approved and user activated successfully.',
            transaction,
            notification
        });
    } catch (error) {
        await t.rollback();
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const rejectTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await Transaction.findByPk(id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        transaction.status = 'rejected';
        await transaction.save();

        return res.status(200).json({ message: 'Transaction rejected' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            include: [{
                model: User,
                attributes: ['id', 'name', 'email', 'phone']
            }],
            order: [['created_at', 'DESC']]
        });
        return res.status(200).json(transactions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.count();
        const totalBalance = await User.sum('wallet_balance') || 0;
        
        const deposits = await Transaction.findAll({ where: { status: 'approved', type: 'deposit' } });
        const withdrawals = await Transaction.findAll({ where: { status: 'approved', type: 'withdrawal' } });

        const totalDeposit = deposits.reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawal = withdrawals.reduce((sum, t) => sum + t.amount, 0);
        const totalProfit = totalDeposit - totalWithdrawal; // Basic calculation

        const pendingDeposits = await Transaction.count({ where: { status: 'pending', type: 'deposit' } });
        const approvedDeposits = deposits.length;

        return res.status(200).json({
            total_users: totalUsers,
            platform_balance: totalBalance.toLocaleString(),
            total_deposit: totalDeposit.toLocaleString(),
            total_withdrawal: totalWithdrawal.toLocaleString(),
            total_profit: totalProfit.toLocaleString(),
            pending_deposits: pendingDeposits,
            approved_deposits: approvedDeposits,
            deposit_count: approvedDeposits,
            withdrawal_count: withdrawals.length
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getUserWalletStats = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const user = await User.findByPk(user_id);
        
        const deposits = await Transaction.findAll({ where: { user_id, status: 'approved', type: 'deposit' } });
        const withdrawals = await Transaction.findAll({ where: { user_id, status: 'approved', type: 'withdrawal' } });

        const totalDeposit = deposits.reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawal = withdrawals.reduce((sum, t) => sum + t.amount, 0);

        return res.status(200).json({
            balance: user.wallet_balance,
            total_deposit: totalDeposit,
            total_withdrawal: totalWithdrawal,
            deposit_count: deposits.length,
            withdrawal_count: withdrawals.length,
            total_profit: (user.wallet_balance + totalWithdrawal) - totalDeposit
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
