import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db.js';
const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING, // 'deposit' or 'withdrawal'
        allowNull: false
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending' // 'pending', 'approved', 'rejected'
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    },
    proof_image: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});
export default Transaction;
//# sourceMappingURL=Transaction.js.map