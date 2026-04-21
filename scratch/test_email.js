import { sendEmail } from '../src/services/emailService.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function test() {
    console.log('Testing email with:');
    console.log('USER:', process.env.EMAIL_USER);
    console.log('PASS:', process.env.EMAIL_PASS ? '********' : 'MISSING');
    
    try {
        await sendEmail(process.env.EMAIL_USER, 'Test Email', 'Security Test');
        console.log('SUCCESS: Email sent successfully!');
    } catch (error) {
        console.error('FAILED: could not send email.');
        console.error(error);
    }
}

test();
