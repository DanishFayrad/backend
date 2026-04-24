import './src/models/index.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function syncReferralCounts() {
    try {
        const users = await User.findAll();
        console.log(`Syncing referral counts for ${users.length} users...`);
        
        for (const user of users) {
            const actualCount = await User.count({ where: { referred_by: user.id } });
            if (user.referral_count !== actualCount) {
                console.log(`Updating ${user.email}: ${user.referral_count} -> ${actualCount}`);
                user.referral_count = actualCount;
                await user.save();
            }
        }
        
        console.log('Referral counts synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing counts:', error);
        process.exit(1);
    }
}

syncReferralCounts();
