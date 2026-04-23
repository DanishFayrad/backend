import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const SignalRequest = sequelize.define('SignalRequest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending' // pending, approved, rejected
    },
    requested_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'signal_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default SignalRequest;
