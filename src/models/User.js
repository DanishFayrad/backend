import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db.js';
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true
    },
    wallet_balance: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    free_signal_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    otp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    otp_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reset_password_otp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    referral_code: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    referred_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    affiliate_balance: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});
export default User;
//# sourceMappingURL=User.js.map