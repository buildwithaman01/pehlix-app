import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/index.js';
import { AppError } from './errors.js';

const s3Client = new S3Client({
  endpoint: `https://${config.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export const R2Service = {
  /**
   * Uploads a buffer to R2 bucket.
   * Key format: labs/${labId}/reports/${reportCode}.pdf
   * Returns the key string.
   */
  async uploadBuffer(key, buffer, contentType = 'application/pdf') {
    try {
      const command = new PutObjectCommand({
        Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      await s3Client.send(command);
      return key;
    } catch (error) {
      console.error('R2 uploadBuffer failed:', error);
      throw new AppError('Storage upload failed', 'STORAGE_UPLOAD_FAILED', 500, { originalError: error.message });
    }
  },

  /**
   * Generates a pre-signed URL for an object key.
   */
  async getSignedUrl(key, expiresInSeconds) {
    try {
      const command = new GetObjectCommand({
        Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
      });
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
      return signedUrl;
    } catch (error) {
      console.error('R2 getSignedUrl failed:', error);
      throw new AppError('Signed URL generation failed', 'STORAGE_UPLOAD_FAILED', 500, { originalError: error.message });
    }
  },

  /**
   * Generates a pre-signed URL for direct download (forces Content-Disposition: attachment).
   */
  async getSignedDownloadUrl(key) {
    try {
      const filename = key.split('/').pop() || 'report.pdf';
      const command = new GetObjectCommand({
        Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });
      // 24 hours expiry for internal download link (86400 seconds)
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
      return signedUrl;
    } catch (error) {
      console.error('R2 getSignedDownloadUrl failed:', error);
      throw new AppError('Signed download URL generation failed', 'STORAGE_UPLOAD_FAILED', 500, { originalError: error.message });
    }
  },

  /**
   * Deletes an object from the R2 bucket.
   */
  async deleteObject(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('R2 deleteObject failed:', error);
      throw new AppError('Storage delete failed', 'STORAGE_UPLOAD_FAILED', 500, { originalError: error.message });
    }
  },

  /**
   * Copies an object inside the bucket (used for archiving on PDF regeneration).
   */
  async copyObject(sourceKey, destKey) {
    try {
      const command = new CopyObjectCommand({
        Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
        CopySource: `${config.CLOUDFLARE_R2_BUCKET_NAME}/${sourceKey}`,
        Key: destKey,
      });
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('R2 copyObject failed:', error);
      throw new AppError('Storage copy failed', 'STORAGE_UPLOAD_FAILED', 500, { originalError: error.message });
    }
  }
};

export default R2Service;
