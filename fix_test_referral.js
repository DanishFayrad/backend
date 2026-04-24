import './src/models/index.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function fixSpecificReferral() {
    try {
        const referrer = await User.findOne({ where: { referral_code: '360218A6' } });
        const referred = await User.findOne({ where: { referral_code: '51227B9C' } });

        if (referrer && referred) {
            referred.referred_by = referrer.id;
            await referred.save();
            
            // Re-calculate count
            const count = await User.count({ where: { referred_by: referrer.id } });
            referrer.referral_count = count;
            await referrer.save();
            
            console.log(`Success: Linked ${referred.email} to referrer ${referrer.email}. Total referrals for ${referrer.email}: ${count}`);
        } else {
            console.log('Referrer or referred user not found.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error fixing referral:', error);
        process.exit(1);
    }
}

fixSpecificReferral();
