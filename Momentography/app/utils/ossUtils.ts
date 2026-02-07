'use server';

import fs from 'fs';
import path from 'path';
import * as qiniu from 'qiniu';
import yaml from 'js-yaml';
import { OSS_CONFIG } from '../config/oss';
import { saveAlbums, saveExifData, logUpdate } from './dbUtils';

// 确保目录存在
function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// 创建七牛客户端
function createQiniuManagers() {
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

// 从 OSS 获取 EXIF 数据并更新数据库
export async function getExifJson() {
  try {
    if (!OSS_CONFIG.DOMAIN) {
      const errorMsg = '七牛域名未配置，请设置 QINIU_DOMAIN';
      logUpdate('exif', 'error', errorMsg);
      return { success: false, message: errorMsg, status: 'error' };
    }
    logUpdate('progress', 'info', '开始同步 EXIF 数据', undefined, 0);
    const exifUrl = `https://${OSS_CONFIG.DOMAIN}/${OSS_CONFIG.OSS_EXIF_DATA_KEY}`;
    const response = await fetch(exifUrl, { cache: 'no-store' });
    if (!response.ok) {
      const errorMsg = `从七牛获取 EXIF 数据失败：HTTP ${response.status}`;
      logUpdate('exif', 'error', errorMsg);
      return { success: false, message: errorMsg, status: 'error' };
    }

    try {
      const contentStr = await response.text();

      
      // 尝试解析 JSON
      let exifDataDict;
      try {
        exifDataDict = JSON.parse(contentStr);

      } catch (parseError) {

        const errorMsg = `解析 EXIF 数据失败，请检查数据格式`;
        logUpdate('exif', 'error', errorMsg);
        return { success: false, message: errorMsg, status: 'error' };
      }
      
      // 验证解析后的数据是否为对象
      if (!exifDataDict) {
        const errorMsg = `解析的 EXIF 数据为空`;
        logUpdate('exif', 'error', errorMsg);
        return { success: false, message: errorMsg, status: 'error' };
      }
      
      if (typeof exifDataDict !== 'object') {
        const errorMsg = `解析的 EXIF 数据不是对象类型: ${typeof exifDataDict}`;
        logUpdate('exif', 'error', errorMsg);
        return { success: false, message: errorMsg, status: 'error' };
      }
      
      // 如果是数组，尝试转换为对象
      if (Array.isArray(exifDataDict)) {
        const convertedData: Record<string, any> = {};
        let hasValidData = false;
        
        for (let i = 0; i < exifDataDict.length; i++) {
          const item = exifDataDict[i];
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            // 尝试找到可以作为键的字段
            const key = item.FileName || item.fileName || item.filename || 
                       item.file_name || item.name || item.id || 
                       `item_${i}`;
            
            convertedData[key] = item;
            hasValidData = true;

          }
        }
        
        if (!hasValidData) {
          const errorMsg = `EXIF 数据数组中没有有效的数据项`;
          logUpdate('exif', 'error', errorMsg);
          return { success: false, message: errorMsg, status: 'error' };
        }
        
        exifDataDict = convertedData;
      }
      
      // 检查是否为空对象
      if (Object.keys(exifDataDict).length === 0) {
        const warningMsg = `EXIF 数据为空对象`;
        logUpdate('exif', 'warning', warningMsg);
        return { success: true, message: warningMsg, status: 'warning' };
      }
      
      // 确保 exifDataDict 是一个普通对象
      const safeExifData: Record<string, any> = {};
      
      try {
        // 安全地复制键值对
        for (const key of Object.keys(exifDataDict)) {
          if (key && typeof key === 'string') {
            safeExifData[key] = exifDataDict[key];
          }
        }
      } catch (copyError) {
        const errorMsg = `处理 EXIF 数据时出错: ${copyError instanceof Error ? copyError.message : String(copyError)}`;
        logUpdate('exif', 'error', errorMsg);
        return { success: false, message: errorMsg, status: 'error' };
      }
      
      // 保存到数据库
      logUpdate('progress', 'info', `准备写入 EXIF 数据，共 ${Object.keys(safeExifData).length} 条`, undefined, 60);
      const saveResult = saveExifData(safeExifData);
      
      // 记录更新操作
      if (saveResult.success) {
        logUpdate('exif', 'success', saveResult.message);
        logUpdate('progress', 'info', 'EXIF 数据写入完成', undefined, 100);
      } else {
        logUpdate('exif', 'error', saveResult.message);
      }
      
      return { ...saveResult, status: saveResult.success ? saveResult.status : 'error' };
    } catch (parseError) {
      const errorMsg = `解析 EXIF 数据失败，请检查数据格式`;
      logUpdate('exif', 'error', errorMsg);
      return { success: false, message: errorMsg, status: 'error' };
    }
  } catch (error) {
    const errorMsg = `从七牛获取 EXIF 数据失败，请检查网络连接和七牛配置`;
    logUpdate('exif', 'error', errorMsg);
    return { success: false, message: errorMsg, status: 'error' };
  }
}

// 将日期对象转换为字符串
function convertDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => convertDates(item));
    }
    
    const result: Record<string, any> = {};
    for (const key in obj) {
      result[key] = convertDates(obj[key]);
    }
    return result;
  }
  
  return obj;
}

// 更新相册数据
export async function updateAlbumsJsonData() {
  try {
    if (!OSS_CONFIG.DOMAIN) {
      return { success: false, message: '七牛域名未配置，请设置 QINIU_DOMAIN', status: 'error' };
    }
    logUpdate('progress', 'info', '开始同步相册数据', undefined, 0);
    const { mac } = createQiniuManagers();
    
    // 存储相册信息的字典
    const albums: Record<string, any> = {};
    
    // 列出文件夹中的所有文件
    const ossPrefix = OSS_CONFIG.OSS_GALLERY_PREFIX;
    
    // 使用七牛 BucketManager 遍历所有对象
    const allObjects: Array<{ key: string }> = [];
    let marker: string | undefined;
    let eof = false;

    let page = 0;
    let prevMarker: string | undefined;
    while (!eof) {
      page += 1;
      logUpdate('progress', 'info', `请求对象列表：第 ${page} 页`, undefined, 5);
      const listResult = await retryListPrefix(mac, `${ossPrefix}/`, marker, page);
      if (listResult.items?.length) {
        allObjects.push(...listResult.items);
      }
      if (listResult.eof || (!listResult.marker && page > 1)) {
        eof = true;
      } else {
        eof = listResult.eof;
      }
      if (listResult.marker && listResult.marker === prevMarker) {
        logUpdate('progress', 'warning', '对象列表 marker 未变化，停止分页以避免死循环', undefined, 10);
        break;
      }
      prevMarker = listResult.marker;
      marker = listResult.marker;
    }
    logUpdate('progress', 'info', `已获取对象数量：${allObjects.length}`, undefined, 30);

    // 遍历对象列表，找出所有 YAML 文件和图片
    let albumCount = 0;
    
    let yamlCount = 0;
    let imageCount = 0;
    for (const obj of allObjects) {
      const key = obj.key;
      
      // 如果是YAML文件，则读取内容
      if (key.endsWith('.yaml') || key.endsWith('.yml')) {
        try {
          const yamlUrl = `https://${OSS_CONFIG.DOMAIN}/${key}`;
          const yamlResp = await fetch(yamlUrl, { cache: 'no-store' });
          if (!yamlResp.ok) {
            continue;
          }
          const yamlContent = await yamlResp.text();
          
          // 解析YAML
          const albumData = yaml.load(yamlContent) as Record<string, any>;
          
          // 从路径中提取相册ID
          const parts = key.split('/');
          const albumId = parts[parts.length - 2]; // 假设路径格式是 prefix/albumId/info.yaml
          
          if (albumId && albumData) {
            // 将数据添加到相册字典中
            if (!albums[albumId]) {
              albums[albumId] = { images: [] };
            }
            albums[albumId] = { ...albums[albumId], ...albumData };
            albumCount++;
            yamlCount++;
          }
        } catch (yamlError) {
          continue;
        }
      }

      if (key.endsWith('.webp')) {
        const parts = key.split('/');
        const albumId = parts[1];
        if (albumId === 'images') {
          continue;
        }
        if (!albumId) continue;
        if (!albums[albumId]) {
          albums[albumId] = { images: [] };
        }
        const imageUrl = `https://${OSS_CONFIG.DOMAIN}/${key}`;
        albums[albumId].images = albums[albumId].images || [];
        albums[albumId].images.push(imageUrl);
        imageCount++;
      }
    }
    logUpdate('progress', 'info', `解析完成：相册 ${albumCount}，YAML ${yamlCount}，图片 ${imageCount}`, undefined, 60);
    
    const albumKeys = Object.keys(albums);
    if (albumKeys.length === 0) {
      return { success: false, message: '没有获取到任何相册数据', status: 'error' };
    }
    
    // 如果已存在非 .info 的相册名称，则忽略旧的 .info 目录
    const hasCleanAlbum = Object.keys(albums).some((id) => !id.endsWith('.info'));
    if (hasCleanAlbum) {
      Object.keys(albums).forEach((id) => {
        if (id.endsWith('.info')) {
          delete albums[id];
        }
      });
    }

    // 处理相册数据，确保兼容性
    Object.entries(albums).forEach(([albumId, album]) => {
      if (album.desc && !album.description) {
        // 将desc字段映射到description字段
        album.description = album.desc;
      }
      if (!album.title) {
        album.title = albumId;
      }
    });
    
    // 保存相册数据到数据库
    const saveResult = saveAlbums(albums);
    logUpdate('progress', 'info', '相册数据写入数据库完成', undefined, 85);
    
    // 记录更新操作
    if (saveResult.success) {
      logUpdate('albums', 'success', '相册数据已更新');
      logUpdate('progress', 'info', '相册同步完成', undefined, 100);
    }
    
    return { success: true, message: '相册数据已更新', status: 'success' };
  } catch (error) {
    const errorMessage = `更新相册数据失败: ${error instanceof Error ? error.message : String(error)}`;
    logUpdate('albums', 'error', errorMessage);
    return { success: false, message: errorMessage, status: 'error' };
  }
}

async function retryListPrefix(
  mac: qiniu.auth.digest.Mac,
  prefix: string,
  marker?: string,
  page?: number
) {
  const maxRetries = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await listQiniuObjects(mac, prefix, marker);
      return result;
    } catch (error) {
      lastError = error;
      logUpdate(
        'progress',
        'warning',
        `对象列表请求失败（第 ${page || 1} 页，第 ${attempt} 次重试）: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        5
      );
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

async function listQiniuObjects(
  mac: qiniu.auth.digest.Mac,
  prefix: string,
  marker?: string
): Promise<{ items: Array<{ key: string }>; marker?: string; eof: boolean }> {
  const rsfHost = OSS_CONFIG.RSF_HOST || 'rsf-z2.qbox.me';
  const params = new URLSearchParams({
    bucket: OSS_CONFIG.BUCKET,
    prefix,
    limit: '200',
  });
  if (marker) params.set('marker', marker);

  const url = `https://${rsfHost}/list?${params.toString()}`;
  const accessToken = qiniu.util.generateAccessTokenV2(
    mac,
    url,
    'POST',
    'application/x-www-form-urlencoded',
    ''
  );

  const controller = new AbortController();
  const timeoutMs = 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const startedAt = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal,
    });
    const elapsed = Date.now() - startedAt;
    if (!resp.ok) {
      throw new Error(`七牛列表请求失败：HTTP ${resp.status}`);
    }
    logUpdate('progress', 'info', `对象列表请求成功（耗时 ${elapsed}ms）`, undefined, 10);
    return (await resp.json()) as any;
  } finally {
    clearTimeout(timer);
  }
}

// 更新所有数据
export async function updateAllData() {
  // 更新相册数据
  const albumsResult = await updateAlbumsJsonData();
  
  // 更新EXIF数据
  // 添加重试机制，因为EXIF数据较大，可能需要多次尝试
  const maxRetries = 3;
  let retryCount = 0;
  let exifResult = { success: false, message: '初始化', status: 'pending' as 'pending' | 'success' | 'error' | 'warning' };
  
  while (retryCount < maxRetries) {
    try {
      exifResult = await getExifJson();
      
      if (exifResult.success || exifResult.status === 'warning') {
        break;
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 3000));
      retryCount++;
    } catch (retryError) {
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 3000));
      retryCount++;
    }
  }
  
  // 获取最终状态
  const albumsStatus = albumsResult.status || (albumsResult.success ? 'success' : 'error');
  const exifStatus = exifResult.status || (exifResult.success ? 'success' : 'error');
  
  // 获取消息
  const albumsMessage = albumsResult.message || (albumsResult.success ? '相册数据更新成功' : '相册数据更新失败');
  const exifMessage = exifResult.message || (exifResult.success ? 'EXIF数据更新成功' : 'EXIF数据更新失败');
  
  // 检查是否都成功
  if (albumsStatus === 'success' || albumsStatus === 'warning') {
    if (exifStatus === 'success' || exifStatus === 'warning') {
      return { 
        success: true, 
        message: `所有数据已更新${albumsStatus === 'warning' || exifStatus === 'warning' ? '（有警告）' : ''}`, 
        albumsResult, 
        exifResult 
      };
    } else {
      return { 
        success: false, 
        message: `相册数据更新成功，但EXIF数据更新失败: ${exifMessage}`, 
        albumsResult, 
        exifResult 
      };
    }
  } else {
    return { 
      success: false, 
      message: `数据更新失败: 相册=${albumsMessage}, EXIF=${exifMessage}`, 
      albumsResult, 
      exifResult 
    };
  }
} 
