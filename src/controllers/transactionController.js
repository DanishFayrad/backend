import { Transaction, User, Notification, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import cloudinary from '../config/cloudinary.js';

export const requestDeposit = async (req, res) => {
    try {
        let { amount, payment_method } = req.body;
        const user_id = req.user.user_id;

        amount = parseFloat(amount) || 0;

        if (amount < 5) {
            console.error('DEPOSIT_ERROR: Amount less than 5');
            return res.status(400).json({ message: 'Minimum deposit is $5.' });
        }

        if (!req.file) {
            console.error('DEPOSIT_ERROR: No file uploaded');
            return res.status(400).json({ message: 'Proof of payment screenshot is required.' });
        }

        console.log(`Uploading proof for user ${user_id} to Cloudinary...`);
        
        // Convert buffer to Base64 for Cloudinary upload
        const base64Image = req.file.buffer.toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;

        let publicUrl;
        try {
            const cloudinaryResult = await cloudinary.uploader.upload(dataUri, {
                folder: 'asianfx_proofs',
            });
            console.log('Cloudinary Upload Success:', cloudinaryResult.secure_url);
            publicUrl = cloudinaryResult.secure_url;
        } catch (cloudinaryError) {
            console.error('CLOUDINARY_UPLOAD_ERROR:', cloudinaryError);
            return res.status(500).json({ 
                message: 'Failed to upload image to Cloudinary',
                details: cloudinaryError.message 
            });
        }

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

            // Affiliate Commission Logic
            if (user.referred_by) {
                const referrer = await User.findByPk(user.referred_by, { transaction: t });
                if (referrer) {
                    const commission = transaction.amount * 0.30; // 30% commission
                    referrer.affiliate_balance += commission;
                    referrer.total_referral_deposits += transaction.amount;
                    await referrer.save({ transaction: t });
                    
                    console.log(`Credited $${commission} affiliate commission to user ${referrer.id} for deposit of $${transaction.amount} by user ${user.id}`);
                }
            }
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
        
        const totalDeposit = await Transaction.sum('amount', { where: { status: 'approved', type: 'deposit' } }) || 0;
        const totalWithdrawal = await Transaction.sum('amount', { where: { status: 'approved', type: 'withdrawal' } }) || 0;
        const depositCount = await Transaction.count({ where: { status: 'approved', type: 'deposit' } });
        const withdrawalCount = await Transaction.count({ where: { status: 'approved', type: 'withdrawal' } });

        const totalProfit = totalDeposit - totalWithdrawal; // Basic calculation

        const today = new Date();
        today.setHours(0,0,0,0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const dailyDepositSum = await Transaction.sum('amount', { 
            where: { 
                status: 'approved', 
                type: 'deposit',
                created_at: { [Op.gte]: today }
            } 
        }) || 0;

        const monthlyDepositSum = await Transaction.sum('amount', { 
            where: { 
                status: 'approved', 
                type: 'deposit',
                created_at: { [Op.gte]: firstDayOfMonth }
            } 
        }) || 0;

        const dailyRegistrationCount = await User.count({
            where: {
                created_at: { [Op.gte]: today }
            }
        });

        const pendingDeposits = await Transaction.count({ where: { status: 'pending', type: 'deposit' } });
        const approvedDeposits = await Transaction.count({ where: { status: 'approved', type: 'deposit' } });

        return res.status(200).json({
            total_users: totalUsers,
            today_registrations: dailyRegistrationCount,
            platform_balance: totalBalance.toLocaleString(),
            total_deposit: totalDeposit.toLocaleString(),
            today_deposit: dailyDepositSum.toLocaleString(),
            monthly_deposit: monthlyDepositSum.toLocaleString(),
            total_withdrawal: totalWithdrawal.toLocaleString(),
            total_profit: totalProfit.toLocaleString(),
            pending_deposits: pendingDeposits,
            approved_deposits: approvedDeposits,
            deposit_count: depositCount,
            withdrawal_count: withdrawalCount
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
        
        const totalDeposit = await Transaction.sum('amount', { where: { user_id, status: 'approved', type: 'deposit' } }) || 0;
        const totalWithdrawal = await Transaction.sum('amount', { where: { user_id, status: 'approved', type: 'withdrawal' } }) || 0;
        const depositCount = await Transaction.count({ where: { user_id, status: 'approved', type: 'deposit' } });
        const withdrawalCount = await Transaction.count({ where: { user_id, status: 'approved', type: 'withdrawal' } });

        const totalSignalFees = await UserSignal.sum('invested_amount', { where: { user_id } }) || 0;

        return res.status(200).json({
            balance: user.wallet_balance,
            total_deposit: totalDeposit,
            total_withdrawal: totalWithdrawal,
            deposit_count: depositCount,
            withdrawal_count: withdrawalCount,
            total_profit: (user.wallet_balance + totalWithdrawal) - totalDeposit,
            total_signal_fees: totalSignalFees
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await Transaction.findByPk(id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        await transaction.destroy();
        return res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
