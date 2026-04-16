import { Transaction, User, Notification, sequelize } from '../models/index.js';
import { supabase } from '../config/supabaseClient.js';
import path from 'path';

export const requestDeposit = async (req, res) => {
    try {
        const { amount, payment_method } = req.body;
        const user_id = req.user.user_id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Proof of payment screenshot is required.' });
        }

        if (!supabase) {
            return res.status(500).json({ message: 'Server Configuration Error: SUPABASE_KEY is missing in .env file.' });
        }

        // Upload to Supabase Storage
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${user_id}-${Date.now()}${fileExt}`;
        const filePath = `proofs/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('proofs')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return res.status(500).json({ 
                message: `Supabase Upload Failed: ${uploadError.message}. Make sure you have created a bucket named 'proofs' in Supabase Storage and set it to Public.` 
            });
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('proofs')
            .getPublicUrl(filePath);

        const transaction = await Transaction.create({
            user_id,
            amount,
            type: 'deposit',
            payment_method,
            proof_image: publicUrl, // Store the Supabase public URL
            status: 'pending',
            description: `Deposit request via ${payment_method}`
        });

        // In a real app, you might emit a socket event here for real-time admin notification
        return res.status(201).json({ 
            message: 'Deposit request submitted successfully. Waiting for admin approval.',
            transaction 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
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
