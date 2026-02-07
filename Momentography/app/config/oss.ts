export const OSS_CONFIG = {
  // 七牛云配置
  ACCESS_KEY: process.env.QINIU_ACCESS_KEY || '',
  SECRET_KEY: process.env.QINIU_SECRET_KEY || '',
  BUCKET: process.env.QINIU_BUCKET || '',
  DOMAIN: process.env.QINIU_DOMAIN || '',
  RSF_HOST: process.env.QINIU_RSF_HOST || '',
  
  // 数据库配置
  DB_PATH: process.env.DB_PATH || 'data/gallery.db',
  
  // 文件路径配置
  EXIF_JSON_PATH: process.env.EXIF_JSON_PATH || 'public/data/exif_data.json',
  ALBUMS_JSON_PATH: process.env.ALBUMS_JSON_PATH || 'public/data/albums.json',
  
  // 存储路径
  OSS_EXIF_DATA_KEY: 'gallery/exif_data.json',
  OSS_GALLERY_PREFIX: 'gallery',
  
  // Webhook 配置
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'update_momentography'
}; 
