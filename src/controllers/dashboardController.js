import { User, Transaction, UserSignal } from '../models/index.js';
import { Op } from 'sequelize';
export const getDashboard = async (req, res) => {
    try {
        const { user_id } = req.params;
        if (typeof user_id !== 'string') {
            return res.status(400).json({ message: 'Invalid User ID' });
        }
        // Check if user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const current_balance = user.wallet_balance || 0.0;
        // 1. Calculate trade stats
        const total_trades = await UserSignal.count({ where: { user_id } });
        const winning_trades = await UserSignal.count({ where: { user_id, result: 'win' } });
        const losing_trades = await UserSignal.count({ where: { user_id, result: 'loss' } });
        const week_ago = new Date();
        week_ago.setDate(week_ago.getDate() - 7);
        const trades_this_week = await UserSignal.count({
            where: {
                user_id,
                taken_at: { [Op.gte]: week_ago }
            }
        });
        // 2. Financial stats
        const total_deposit = await Transaction.sum('amount', { where: { user_id, type: 'deposit' } }) || 0.0;
        const total_withdrawal = await Transaction.sum('amount', { where: { user_id, type: 'deduction' } }) || 0.0;
        const total_balance = total_deposit;
        const total_profit = Math.max(0, current_balance - total_deposit + total_withdrawal);
        const total_loss = total_withdrawal;
        let profit_percentage = 0, loss_percentage = 0, roi_percentage = 0;
        if (total_deposit > 0) {
            profit_percentage = (total_profit / total_deposit) * 100;
            loss_percentage = (total_loss / total_deposit) * 100;
            roi_percentage = ((current_balance - total_deposit) / total_deposit) * 100;
        }
        const total_transactions = await Transaction.count({ where: { user_id } });
        const deposit_transactions = await Transaction.count({ where: { user_id, type: 'deposit' } });
        const withdrawal_transactions = await Transaction.count({ where: { user_id, type: 'deduction' } });
        // 3. Recent transactions
        const recent_transactions = await Transaction.findAll({
            where: { user_id },
            order: [['created_at', 'DESC']],
            limit: 10
        });
        // 4. Profit/Loss overview (last 30 days)
        const profit_loss_overview = [];
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        
        const last30DaysTransactions = await Transaction.findAll({
            where: {
                user_id,
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            }
        });

        // Initialize array with 30 days of 0 profit/loss
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            profit_loss_overview.push({
                date: dateStr,
                profit: 0,
                loss: 0
            });
        }

        // Aggregate transactions into the overview
        for (const t of last30DaysTransactions) {
            if (!t.created_at) continue;
            
            const tDateStr = new Date(t.created_at).toISOString().split('T')[0];
            const dayStat = profit_loss_overview.find(d => d.date === tDateStr);
            
            if (dayStat) {
                const amount = Number(t.amount) || 0;
                if (t.type === 'profit') {
                    dayStat.profit += amount;
                } else if (t.type === 'deduction') {
                    dayStat.loss += amount;
                }
            }
        }
        const win_rate = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0.0;
        const loss_rate = total_trades > 0 ? (losing_trades / total_trades) * 100 : 0.0;
        return res.status(200).json({
            stats: {
                current_balance,
                total_balance,
                total_deposit,
                total_withdrawal,
                total_profit,
                total_loss,
                profit_percentage,
                loss_percentage,
                roi_percentage,
                total_transactions,
                deposit_transactions,
                withdrawal_transactions,
                total_trades,
                winning_trades,
                losing_trades,
                win_rate,
                loss_rate,
                trades_this_week,
                recent_transactions
            },
            profit_loss_overview
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
//# sourceMappingURL=dashboardController.js.map