import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
    console.log('Testing Cloudinary upload...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    
    try {
        // Simple test with a remote image or a local small buffer
        const result = await cloudinary.uploader.upload('https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png', {
            folder: 'test_folder',
        });
        console.log('Upload Success:', result.secure_url);
    } catch (error) {
        console.error('Upload Failed:', error);
    }
}

testUpload();
