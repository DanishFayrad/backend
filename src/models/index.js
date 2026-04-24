import sequelize from '../config/db.js';
import User from './User.js';
import Signal from './Signal.js';
import Transaction from './Transaction.js';
import Notification from './Notification.js';
import UserSignal from './UserSignal.js';
import AppSetting from './AppSetting.js';
import SignalRequest from './SignalRequest.js';

// Associations
User.hasMany(Transaction, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'user_id' });

// Referral Associations
User.hasMany(User, { as: 'ReferredUsers', foreignKey: 'referred_by' });
User.belongsTo(User, { as: 'Referrer', foreignKey: 'referred_by' });

// User <-> Notification
User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(UserSignal, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserSignal.belongsTo(User, { foreignKey: 'user_id' });
Signal.hasMany(UserSignal, { foreignKey: 'signal_id', onDelete: 'CASCADE' });
UserSignal.belongsTo(Signal, { foreignKey: 'signal_id' });

User.hasMany(SignalRequest, { foreignKey: 'user_id', onDelete: 'CASCADE' });
SignalRequest.belongsTo(User, { foreignKey: 'user_id' });

export { sequelize, User, Signal, Transaction, UserSignal, Notification, AppSetting, SignalRequest };
//# sourceMappingURL=index.js.map