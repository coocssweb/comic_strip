import COS from 'cos-nodejs-sdk-v5';
import { env } from '../config/env.js';

const cos = new COS({
  SecretId: env.cosAccessKeyId,
  SecretKey: env.cosSecretAccessKey,
});

export function createPresignedUploadUrl({ objectKey, contentType }) {
  return new Promise((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: env.cosBucket,
        Region: env.cosRegion,
        Key: objectKey,
        Method: 'PUT',
        Sign: true,
        Expires: env.cosUploadExpiresSeconds,
        Headers: { 'Content-Type': contentType },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.Url);
      },
    );
  });
}
