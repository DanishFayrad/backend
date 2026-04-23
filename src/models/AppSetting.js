import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const AppSetting = sequelize.define('AppSetting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'app_settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default AppSetting;
