import { Notification } from '../models/index.js';

export const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            where: { user_id: req.user.user_id },
            order: [['created_at', 'DESC']],
            limit: 20
        });
        return res.status(200).json(notifications);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.update({ is_read: true }, {
            where: { id, user_id: req.user.user_id }
        });
        return res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
