import * as qiniu from 'qiniu';
import { OSS_CONFIG } from '../config/oss';

function createQiniuBucketManager() {
  const mac = new qiniu.auth.digest.Mac(OSS_CONFIG.ACCESS_KEY, OSS_CONFIG.SECRET_KEY);
  const config = new qiniu.conf.Config({
    zone: qiniu.zone.Zone_z2,
    useHttpsDomain: true,
  });
  if (OSS_CONFIG.RSF_HOST) {
    (config as any).rsfHost = OSS_CONFIG.RSF_HOST;
  }
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  return { mac, bucketManager };
}

function listPrefix(bucketManager: qiniu.rs.BucketManager, bucket: string, prefix: string, marker?: string) {
  return new Promise<{ items: Array<{ key: string }>; marker?: string; eof: boolean }>((resolve, reject) => {
    bucketManager.listPrefix(
      bucket,
      { prefix, marker, limit: 200 },
      (err, respBody, respInfo) => {
        if (err) return reject(err);
        if (respInfo?.statusCode !== 200) {
          return reject(new Error(`七牛列表请求失败：HTTP ${respInfo?.statusCode}`));
        }
        resolve(respBody as any);
      }
    );
  });
}

export async function deleteAlbumFromQiniu(albumId: string) {
  if (!OSS_CONFIG.ACCESS_KEY || !OSS_CONFIG.SECRET_KEY || !OSS_CONFIG.BUCKET) {
    return { success: false, message: '七牛配置不完整' };
  }
  const { bucketManager } = createQiniuBucketManager();
  const prefix = `gallery/${albumId}/`;
  let marker: string | undefined;
  let eof = false;
  let deleted = 0;
  let failed = 0;

  while (!eof) {
    const result = await listPrefix(bucketManager, OSS_CONFIG.BUCKET, prefix, marker);
    const items = result.items || [];
    for (const item of items) {
      try {
        await new Promise<void>((resolve, reject) => {
          bucketManager.delete(OSS_CONFIG.BUCKET, item.key, (err, respBody, respInfo) => {
            if (err) return reject(err);
            if (respInfo?.statusCode !== 200) {
              return reject(new Error(`删除失败：HTTP ${respInfo?.statusCode}`));
            }
            resolve();
          });
        });
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    marker = result.marker;
    eof = result.eof || !result.marker;
  }

  if (failed > 0) {
    return { success: false, message: `七牛删除失败 ${failed} 个`, deleted, failed };
  }
  return { success: true, deleted, failed };
}
