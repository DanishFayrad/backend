import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db.js';
const UserSignal = sequelize.define('UserSignal', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    signal_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    taken_price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    result: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    profit_loss: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    invested_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    deducted_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    taken_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    closed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'usersignals',
    timestamps: false
});
export default UserSignal;
//# sourceMappingURL=UserSignal.js.map