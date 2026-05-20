import { S3Client, CreateBucketCommand, PutBucketPolicyCommand, HeadBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple custom .env parser to avoid external dependencies
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
      }
    }
  });
}

const minioEndpoint = env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000';
const accessKey = env.MINIO_ACCESS_KEY || 'admin_vpdu';
const secretKey = env.MINIO_SECRET_KEY || 'VpduPassword2026!';
const avatarBucket = env.MINIO_AVATAR_BUCKET || 'avatars';
const chatBucket = env.MINIO_CHAT_BUCKET || 'message-attachments';

console.log(`Connecting to MinIO endpoint: ${minioEndpoint}`);
console.log(`Using access key: ${accessKey}`);

const s3 = new S3Client({
  endpoint: minioEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
  forcePathStyle: true,
});

async function main() {
  const buckets = [avatarBucket, chatBucket];
  for (const bucket of buckets) {
    try {
      console.log(`Checking bucket: "${bucket}"...`);
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`Bucket "${bucket}" already exists.`);
    } catch (err) {
      const isNotFound = err.name === 'NotFound' || 
                         err.$metadata?.httpStatusCode === 404 || 
                         (err.message && err.message.includes('404'));
      if (isNotFound) {
        console.log(`Bucket "${bucket}" does not exist. Creating...`);
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`Bucket "${bucket}" created successfully.`);
        
        if (bucket === avatarBucket) {
          console.log(`Setting public read policy for avatar bucket "${bucket}"...`);
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
              },
            ],
          };
          await s3.send(new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify(policy),
          }));
          console.log(`Public read policy set for "${bucket}" successfully.`);
        }
      } else {
        console.error(`Error checking/creating bucket "${bucket}":`, err);
        throw err;
      }
    }

    // Set CORS policy for each bucket to allow client direct uploads
    try {
      console.log(`Setting CORS policy for bucket "${bucket}"...`);
      const corsRules = {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag', 'Content-Type', 'Accept', 'Range'],
            MaxAgeSeconds: 3000
          }
        ]
      };
      await s3.send(new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: corsRules
      }));
      console.log(`CORS policy set for "${bucket}" successfully.`);
    } catch (corsErr) {
      console.error(`Failed to set CORS policy for "${bucket}":`, corsErr.message);
    }
  }
  console.log('MinIO buckets initialization completed successfully.');
}

main().catch((err) => {
  console.error('Critical initialization error:', err);
  process.exit(1);
});
