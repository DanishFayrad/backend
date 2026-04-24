import './src/models/index.js';
import User from './src/models/User.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

async function fixReferralCodes() {
    try {
        const users = await User.findAll({ where: { referral_code: null } });
        console.log(`Found ${users.length} users without referral codes.`);
        
        for (const user of users) {
            user.referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
            await user.save();
            console.log(`Generated code ${user.referral_code} for user ${user.email}`);
        }
        
        console.log('Finished fixing referral codes.');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing referral codes:', error);
        process.exit(1);
    }
}

fixReferralCodes();
