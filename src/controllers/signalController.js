import { Signal, UserSignal, User, Notification, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { sendEmail } from '../services/emailService.js';
import cloudinary from '../config/cloudinary.js';
export const getSignalsDashboard = async (req, res) => {
    try {
        const { symbol, limit = 20 } = req.query;
        const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
        const where = { 
            status: 'active',
            created_at: { [Op.gte]: seventyTwoHoursAgo }
        };

        // Filter by user unless admin
        if (!req.user.is_admin) {
            const currentUserId = parseInt(req.user.user_id);
            where[Op.and] = [
                {
                    [Op.or]: [
                        { target_user_id: null },
                        { target_user_id: currentUserId }
                    ]
                }
            ];
        }

        if (symbol) {
            where.symbol = { [Op.iLike]: `%${symbol}%` };
        }
        const active_signals = await Signal.findAll({
            where,
            limit: parseInt(limit),
            order: [['created_at', 'DESC']]
        });
        const recent_signals = await Signal.findAll({
            limit: 10,
            order: [['created_at', 'DESC']]
        });
        // Stats
        const privacyFilter = !req.user.is_admin ? {
            [Op.and]: [
                {
                    [Op.or]: [
                        { target_user_id: null },
                        { target_user_id: parseInt(req.user.user_id) }
                    ]
                }
            ]
        } : {};

        const active_count = await Signal.count({ 
            where: { 
                ...where,
                ...privacyFilter
            } 
        });

        const total_count = await Signal.count({ 
            where: { 
                created_at: { [Op.gte]: seventyTwoHoursAgo },
                ...privacyFilter
            } 
        });

        return res.status(200).json({
            active_signals,
            recent_signals,
            stats: {
                total_signals: total_count,
                active_signals: active_count,
                success_rate: "0.00"
            }
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
export const takeSignal = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { user_id, signal_id, taken_price, invested_amount } = req.body;
        const user = await User.findByPk(user_id, { transaction: t });
        const signal = await Signal.findByPk(signal_id, { transaction: t });
        if (!user || !signal) {
            await t.rollback();
            return res.status(404).json({ message: 'User or Signal not found' });
        }
        if (user.wallet_balance < invested_amount) {
            await t.rollback();
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        // Create UserSignal entry
        const userSignal = await UserSignal.create({
            user_id,
            signal_id,
            taken_price,
            invested_amount,
            result: 'pending',
            taken_at: new Date()
        }, { transaction: t });
        // Update user balance
        user.wallet_balance -= invested_amount;
        await user.save({ transaction: t });
        // Update signal stats
        signal.total_taken += 1;
        await signal.save({ transaction: t });
        
        await t.commit();
        
        // Notify admins for the "Who purchased" stat
        if (req.io) {
            req.io.to('admin').emit('admin_notification', {
                type: 'SIGNAL_PURCHASED',
                signal_id: signal.id,
                total_taken: signal.total_taken
            });
        }
        
        return res.status(201).json({ message: 'Signal taken successfully', data: userSignal });
    }
    catch (error) {
        await t.rollback();
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
export const getUserSignalHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { result } = req.query;
        const where = { user_id };
        if (result) {
            where.result = result;
        }
        const history = await UserSignal.findAll({
            where,
            include: [{ model: Signal }],
            order: [['taken_at', 'DESC']]
        });
        return res.status(200).json(history);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
export const createSignal = async (req, res) => {
    try {
        const { 
            symbol, type, entry_price, target_price, stop_loss, 
            signal_type = 'free', description, expires_at, target_user_id,
            timer_minutes,
            release_at: req_release_at
        } = req.body;
        
        let release_at = req_release_at || null;
        if (timer_minutes && parseInt(timer_minutes) > 0) {
            release_at = new Date(Date.now() + parseInt(timer_minutes) * 60 * 1000);
        }

        let image_url = null;
        if (req.file) {
            try {
                console.log(`Uploading signal image to Cloudinary...`);
                const base64Image = req.file.buffer.toString('base64');
                const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;
                
                const uploadResult = await cloudinary.uploader.upload(dataUri, {
                    folder: 'asianfx_signals',
                });
                image_url = uploadResult.secure_url;
                console.log('Signal image uploaded successfully:', image_url);
            } catch (err) {
                console.error('Signal image upload failed:', err);
                // We'll continue without image if upload fails, or you could return error
            }
        }
        
        // Strict check: if this comes from a targeted action, ensure ID is valid
        const final_target_user_id = target_user_id ? parseInt(target_user_id) : null;
        
        const signal = await Signal.create({
            symbol,
            type,
            entry_price: parseFloat(entry_price),
            target_price: parseFloat(target_price),
            stop_loss: parseFloat(stop_loss),
            signal_type,
            description,
            expires_at,
            release_at,
            image_url,
            created_by: req.user.user_id,
            status: 'active',
            result: 'pending',
            target_user_id: final_target_user_id
        });

        // Determine users to notify
        let usersToNotify = [];
        if (final_target_user_id) {
            const user = await User.findByPk(final_target_user_id);
            if (user) {
                usersToNotify = [user];
            } else {
                return res.status(404).json({ message: 'Target user not found' });
            }
        } else {
            usersToNotify = await User.findAll({ attributes: ['id', 'email', 'name', 'is_active'] });
        }

        // Loop through users to notify them
        for (const user of usersToNotify) {
             // 1. Create DB Notification
             await Notification.create({
                 user_id: user.id,
                 title: `New Signal: ${symbol} (${type.toUpperCase()})`,
                 message: `A new ${signal_type} signal for ${symbol} is available. Entry: ${entry_price}, TP: ${target_price}, SL: ${stop_loss}.`,
                 type: 'signal',
                 link: '/dashboard'
             });

             // 2. Emit Socket IO
             if (req.io) {
                 req.io.to(user.id).emit('notification', {
                     title: `New Signal: ${symbol}`,
                     message: `Take action on ${symbol} ${type.toUpperCase()}`,
                     type: 'signal',
                     signal: signal
                 });
             }

             // 3. Send Email
             if (user.is_active) {
                const emailHtml = `
                    <h2>New ${target_user_id ? 'Personalized ' : ''}Signal</h2>
                    <p>Hello ${user.name},</p>
                    <p>A new trading signal has been broadcasted:</p>
                    <ul>
                        <li><b>Asset:</b> ${symbol}</li>
                        <li><b>Action:</b> ${type.toUpperCase()}</li>
                        <li><b>Entry Price:</b> ${entry_price}</li>
                        <li><b>Target:</b> ${target_price}</li>
                        <li><b>Stop Loss:</b> ${stop_loss}</li>
                    </ul>
                    <p>Login to your dashboard to take the trade.</p>
                `;
                sendEmail(user.email, `New Signal Alert: ${symbol}`, `New Signal for ${symbol} is active.`, emailHtml)
                    .catch(err => console.error(`Failed to send email to ${user.email}`, err));
             }
        }

        return res.status(201).json({
            message: target_user_id ? 'Signal sent to specific user successfully' : 'Signal created and broadcasted successfully',
            signal
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const deleteSignal = async (req, res) => {
    try {
        const { id } = req.params;
        const signal = await Signal.findByPk(id);
        
        if (!signal) {
            return res.status(404).json({ message: 'Signal not found' });
        }

        const currentUserId = parseInt(req.user.user_id);
        
        // Authorization check: 
        // 1. Admins can delete anything.
        // 2. Normal users can ONLY delete signals specifically targeted to them.
        const isTargetUser = signal.target_user_id && parseInt(signal.target_user_id) === currentUserId;

        if (!req.user.is_admin && !isTargetUser) {
            console.warn(`Unauthorized delete attempt by user ${currentUserId} on signal ${id}`);
            return res.status(403).json({ message: 'You can only remove signals sent specifically to you.' });
        }

        await signal.destroy();
        return res.status(200).json({ message: 'Signal deleted successfully' });
    } catch (error) {
        console.error("DELETE_SIGNAL_ERROR:", error);
        return res.status(500).json({ message: 'Server error', details: error.message });
    }
};

export const extendTimer = async (req, res) => {
    try {
        const { id } = req.params;
        const { additional_minutes } = req.body;
        
        const signal = await Signal.findByPk(id);
        if (!signal) {
            return res.status(404).json({ message: 'Signal not found' });
        }
        
        if (!signal.release_at) {
            return res.status(400).json({ message: 'This signal does not have a timer' });
        }
        
        const current_release = new Date(signal.release_at);
        const new_release = new Date(current_release.getTime() + parseInt(additional_minutes) * 60 * 1000);
        
        signal.release_at = new_release;
        await signal.save();
        
        // Notify users about the change
        if (req.io) {
            // Only broadcast to target user if it's a private signal
            if (signal.target_user_id) {
                req.io.to(signal.target_user_id).emit('signal_timer_updated', {
                    signal_id: id,
                    new_release_at: new_release
                });
            } else {
                req.io.emit('signal_timer_updated', {
                    signal_id: id,
                    new_release_at: new_release
                });
            }
        }
        
        return res.status(200).json({ 
            message: `Timer extended by ${additional_minutes} minutes`,
            new_release_at: new_release
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
//# sourceMappingURL=signalController.js.map