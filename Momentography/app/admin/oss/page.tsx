'use client';

import { useState, useEffect } from 'react';
import { updateAlbumsJsonData } from '@/app/utils/ossUtils';
import { motion } from 'framer-motion';
import { CloudArrowUp, Clock, Spinner, CheckCircle, XCircle, ArrowLeft, Database, Calendar } from '@phosphor-icons/react';
import Link from 'next/link';
import { OSS_CONFIG } from '@/app/config/oss';

export default function OssManagementPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; status?: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ 
    albums: { time: string | null; record: any | null }; 
    exif: { time: string | null; record: any | null }; 
  }>({
    albums: { time: null, record: null },
    exif: { time: null, record: null }
  });
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string>('••••••••••••••••');
  const [updates, setUpdates] = useState<any[]>([]);
  const [progressValue, setProgressValue] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [localDir, setLocalDir] = useState('');
  const [localUploadStatus, setLocalUploadStatus] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [pathStatus, setPathStatus] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string>('');

  useEffect(() => {
    // 获取数据库的最后更新时间
    async function getLastUpdatedTime() {
      try {
        // 添加时间戳参数，确保每次请求都是新的
        const timestamp = new Date().getTime();
        const albumsResponse = await fetch(`/api/files/lastModified?type=albums&_t=${timestamp}`);
        const exifResponse = await fetch(`/api/files/lastModified?type=exif&_t=${timestamp}`);
        
        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          setLastUpdated(prev => ({ 
            ...prev, 
            albums: { 
              time: albumsData.lastModified, 
              record: albumsData.lastUpdate 
            } 
          }));
        }
        
        if (exifResponse.ok) {
          const exifData = await exifResponse.json();
          setLastUpdated(prev => ({ 
            ...prev, 
            exif: { 
              time: exifData.lastModified, 
              record: exifData.lastUpdate 
            } 
          }));
        }
      } catch (error) {
        console.error('获取更新时间失败:', error);
      }
    }
    
    // 获取Webhook密钥
    async function getWebhookSecret() {
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/config/webhook-secret?_t=${timestamp}`);
        if (response.ok) {
          const data = await response.json();
          setWebhookSecret(data.webhookSecret);
        }
      } catch (error) {
        console.error('获取Webhook密钥失败:', error);
      }
    }
    
    getLastUpdatedTime();
    getWebhookSecret();
    fetchUpdates();
    const saved = localStorage.getItem('favorite_upload_dirs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUpdates();
    }, isLoading ? 2000 : 8000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const fetchUpdates = async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/updates?limit=50&_t=${timestamp}`);
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data.updates) ? data.updates : [];
      setUpdates(list);
      const latestProgress = list.find((item: any) => item.progress !== null && item.progress !== undefined);
      if (latestProgress) {
        setProgressValue(Math.max(0, Math.min(100, Number(latestProgress.progress))));
        setProgressLabel(latestProgress.message || '');
      } else {
        setProgressValue(null);
        setProgressLabel('');
      }
      const latestUpload = list.find((item: any) => item.type === 'upload' && item.progress !== null && item.progress !== undefined);
      if (latestUpload) {
        setUploadProgress(Math.max(0, Math.min(100, Number(latestUpload.progress))));
        setUploadLabel(latestUpload.message || '');
      } else {
        setUploadProgress(null);
        setUploadLabel('');
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateData = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log("开始更新七牛数据...");
      const updateResult = await updateAlbumsJsonData();
      console.log("更新结果:", updateResult);
      setResult(updateResult);

      // 同步完成后，自动导入本地 EXIF
      try {
        setLocalUploadStatus('同步完成，正在导入本地 EXIF…');
        setUpdates((prev) => [
          { id: Date.now(), type: 'exif', status: 'info', message: '开始导入本地 EXIF', created_at: new Date().toISOString(), progress: null },
          ...prev,
        ]);
        const exifResp = await fetch('/api/admin/import-local-exif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const exifData = await exifResp.json();
        if (!exifResp.ok) {
          const msg = exifResp.status === 400 && exifData?.path
            ? `未找到本地 EXIF 文件，请先上传一次（${exifData.path}）`
            : (exifData.error || '导入本地 EXIF 失败');
          setLocalUploadStatus(msg);
          if (exifResp.status === 400) {
            setModalMessage(msg);
          }
          setUpdates((prev) => [
            { id: Date.now() + 1, type: 'exif', status: 'error', message: msg, created_at: new Date().toISOString(), progress: null },
            ...prev,
          ]);
        } else {
          setLocalUploadStatus(exifData.message || '已同步七牛并导入本地 EXIF');
          setUpdates((prev) => [
            { id: Date.now() + 2, type: 'exif', status: 'success', message: exifData.message || '本地 EXIF 导入成功', created_at: new Date().toISOString(), progress: null },
            ...prev,
          ]);
        }
      } catch (exifError) {
        setLocalUploadStatus(`导入本地 EXIF 失败: ${exifError instanceof Error ? exifError.message : String(exifError)}`);
        setModalMessage(`导入本地 EXIF 失败: ${exifError instanceof Error ? exifError.message : String(exifError)}`);
        setUpdates((prev) => [
          { id: Date.now() + 3, type: 'exif', status: 'error', message: `导入本地 EXIF 失败: ${exifError instanceof Error ? exifError.message : String(exifError)}`, created_at: new Date().toISOString(), progress: null },
          ...prev,
        ]);
      }
      
      // 更新成功后，刷新最后更新时间
      if (updateResult.success) {
        console.log("正在获取最新的更新时间...");
        // 添加时间戳参数，确保每次请求都是新的
        const timestamp = new Date().getTime();
        const albumsResponse = await fetch(`/api/files/lastModified?type=albums&_t=${timestamp}`);
        const exifResponse = await fetch(`/api/files/lastModified?type=exif&_t=${timestamp}`);
        
        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          console.log("相册更新时间数据:", albumsData);
          setLastUpdated(prev => ({ 
            ...prev, 
            albums: { 
              time: albumsData.lastModified, 
              record: albumsData.lastUpdate 
            } 
          }));
        } else {
          console.error("获取相册更新时间失败:", albumsResponse.statusText);
        }
        
        if (exifResponse.ok) {
          const exifData = await exifResponse.json();
          console.log("EXIF 更新时间数据:", exifData);
          setLastUpdated(prev => ({ 
            ...prev, 
            exif: { 
              time: exifData.lastModified, 
              record: exifData.lastUpdate 
            } 
          }));
        } else {
          console.error("获取 EXIF 更新时间失败:", exifResponse.statusText);
        }
      }
    } catch (error) {
      console.error("更新数据时出错:", error);
      setResult({ success: false, message: `更新失败: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsLoading(false);
      
      // 无论成功与否，都刷新最后更新时间
      try {
        // 添加时间戳参数，确保每次请求都是新的
        const timestamp = new Date().getTime();
        const albumsResponse = await fetch(`/api/files/lastModified?type=albums&_t=${timestamp}`);
        const exifResponse = await fetch(`/api/files/lastModified?type=exif&_t=${timestamp}`);
        
        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          setLastUpdated(prev => ({ 
            ...prev, 
            albums: { 
              time: albumsData.lastModified, 
              record: albumsData.lastUpdate 
            } 
          }));
        }
        
        if (exifResponse.ok) {
          const exifData = await exifResponse.json();
          setLastUpdated(prev => ({ 
            ...prev, 
            exif: { 
              time: exifData.lastModified, 
              record: exifData.lastUpdate 
            } 
          }));
        }
      } catch (refreshError) {
        console.error("刷新更新时间失败:", refreshError);
      }
    }
  };

  const handleLocalUpload = async (mode: 'incremental' | 'full' = 'incremental') => {
    setLocalUploadStatus(null);
    try {
      const response = await fetch('/api/admin/upload-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localDir || null, mode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalUploadStatus(data.error || '触发上传失败');
        return;
      }
      setLocalUploadStatus(mode === 'full' ? '已触发全量上传，请稍后查看同步日志' : '已触发上传，请稍后查看同步日志');
    } catch (error) {
      setLocalUploadStatus(`触发上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRebuildExif = async () => {
    try {
      setLocalUploadStatus('正在重新生成 EXIF…');
      const response = await fetch('/api/admin/rebuild-exif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localDir || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalUploadStatus(data.error || '重新生成 EXIF 失败');
        setUpdates((prev) => [
          { id: Date.now(), type: 'exif', status: 'error', message: data.error || '重新生成 EXIF 失败', created_at: new Date().toISOString(), progress: null },
          ...prev,
        ]);
        return;
      }
      setLocalUploadStatus('EXIF 已重新生成，接下来请同步七牛数据');
      setUpdates((prev) => [
        { id: Date.now() + 1, type: 'exif', status: 'success', message: data.message || 'EXIF 重新生成完成', created_at: new Date().toISOString(), progress: null },
        ...prev,
      ]);
    } catch (error) {
      setLocalUploadStatus(`重新生成 EXIF 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImportLocalExif = async () => {
    try {
      const response = await fetch('/api/admin/import-local-exif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        setLocalUploadStatus(data.error || '导入 EXIF 失败');
        return;
      }
      setLocalUploadStatus('已从本地 EXIF 导入，请刷新页面查看');
    } catch (error) {
      setLocalUploadStatus(`导入 EXIF 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleValidatePath = async () => {
    setPathStatus(null);
    try {
      const response = await fetch('/api/admin/validate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localDir || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPathStatus(data.error || '路径不可用');
        return;
      }
      setPathStatus('路径可用');
    } catch (error) {
      setPathStatus(`路径验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addFavorite = () => {
    if (!localDir.trim()) return;
    const next = Array.from(new Set([localDir.trim(), ...favorites]));
    setFavorites(next);
    localStorage.setItem('favorite_upload_dirs', JSON.stringify(next));
  };

  const removeFavorite = (dir: string) => {
    const next = favorites.filter((d) => d !== dir);
    setFavorites(next);
    localStorage.setItem('favorite_upload_dirs', JSON.stringify(next));
  };

  // 格式化日期时间
  const formatDateTime = (dateTimeStr: string | null) => {
    if (!dateTimeStr) return '未知';
    
    try {
      const date = new Date(dateTimeStr);
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.warn('无效的日期字符串:', dateTimeStr);
        return '未知';
      }
      
      // 将UTC时间转换为东八区时间
      // 创建一个新的日期对象，加上8小时的时差
      const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      
      // 格式化北京时间
      return beijingDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      console.error('格式化日期时出错:', e, dateTimeStr);
      return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {modalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6">
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">提示</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {modalMessage}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setModalMessage(null)}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">七牛数据管理</h1>
          <Link 
            href="/admin" 
            className="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft size={20} className="mr-1" />
            返回管理面板
          </Link>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6"
        >
          <div className="flex items-center mb-4">
            <CloudArrowUp size={24} className="text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">同步七牛数据</h2>
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            点击下面的按钮从七牛云获取最新的相册数据和 EXIF 数据。同步过程可能需要几分钟时间，请耐心等待。
          </p>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <motion.button
              onClick={handleUpdateData}
              disabled={isLoading}
              whileHover={!isLoading ? { scale: 1.02 } : {}}
              whileTap={!isLoading ? { scale: 0.98 } : {}}
              className={`px-6 py-3 rounded-lg flex items-center justify-center ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md'
              } transition-all`}
            >
              {isLoading ? (
                <>
                  <Spinner size={20} className="animate-spin mr-2" />
                  同步中...
                </>
              ) : (
                <>
                  <CloudArrowUp size={20} className="mr-2" />
                  同步七牛数据
                </>
              )}
            </motion.button>
            
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <Clock size={18} className="mr-2" />
              <span>上次同步时间：</span>
              <span className="ml-1 font-medium">
                {formatDateTime(lastUpdated.albums.time) ? formatDateTime(lastUpdated.albums.time) : '从未同步'}
              </span>
            </div>
          </div>
          
          {result && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`p-4 rounded-md flex items-start ${
                result.status === 'success' 
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                  : result.status === 'partial_success'
                    ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : result.status === 'warning'
                      ? 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {result.status === 'success' ? (
                <CheckCircle size={20} weight="fill" className="mr-2 mt-0.5 flex-shrink-0" />
              ) : result.status === 'partial_success' || result.status === 'warning' ? (
                <CheckCircle size={20} weight="fill" className="mr-2 mt-0.5 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
              ) : (
                <XCircle size={20} weight="fill" className="mr-2 mt-0.5 flex-shrink-0" />
              )}
              <div>
                {result.message}
              </div>
            </motion.div>
          )}
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <Database size={20} className="text-blue-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">相册数据</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">最后更新:</span>
                <span className="text-gray-900 dark:text-gray-200">{formatDateTime(lastUpdated.albums.time)}</span>
              </div>
              {lastUpdated.albums.record && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">更新状态:</span>
                  <span className={`font-medium ${
                    lastUpdated.albums.record.status === 'success' 
                      ? 'text-green-600 dark:text-green-400' 
                      : lastUpdated.albums.record.status === 'warning' || lastUpdated.albums.record.status === 'partial_success'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}>
                    {lastUpdated.albums.record.status === 'success' ? '成功' : 
                     lastUpdated.albums.record.status === 'warning' ? '警告' :
                     lastUpdated.albums.record.status === 'partial_success' ? '部分成功' : '失败'}
                  </span>
                </div>
              )}
              {lastUpdated.albums.record && lastUpdated.albums.record.message && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  {lastUpdated.albums.record.message}
                </div>
              )}
              {lastUpdated.albums.record && lastUpdated.albums.record.created_at && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  <Calendar size={16} className="mr-1" />
                  {formatDateTime(lastUpdated.albums.record.created_at)}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <Database size={20} className="text-blue-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">EXIF 数据</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">最后更新:</span>
                <span className="text-gray-900 dark:text-gray-200">{formatDateTime(lastUpdated.exif.time)}</span>
              </div>
              {lastUpdated.exif.record && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">更新状态:</span>
                  <span className={`font-medium ${
                    lastUpdated.exif.record.status === 'success' 
                      ? 'text-green-600 dark:text-green-400' 
                      : lastUpdated.exif.record.status === 'warning' || lastUpdated.exif.record.status === 'partial_success'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}>
                    {lastUpdated.exif.record.status === 'success' ? '成功' : 
                     lastUpdated.exif.record.status === 'warning' ? '警告' :
                     lastUpdated.exif.record.status === 'partial_success' ? '部分成功' : '失败'}
                  </span>
                </div>
              )}
              {lastUpdated.exif.record && lastUpdated.exif.record.message && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  {lastUpdated.exif.record.message}
                </div>
              )}
              {lastUpdated.exif.record && lastUpdated.exif.record.created_at && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  <Calendar size={16} className="mr-1" />
                  {formatDateTime(lastUpdated.exif.record.created_at)}
                </div>
              )}
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">本地目录上传</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            输入本地目录路径，服务器将触发上传脚本处理该目录。
          </p>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              value={localDir}
              onChange={(e) => setLocalDir(e.target.value)}
              placeholder="例如：/Users/apple/Pictures/摄影照片.library/"
              className="flex-1 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            />
            <div className="flex gap-2">
              <button
                onClick={handleValidatePath}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
              >
                验证路径
              </button>
              <button
                onClick={addFavorite}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
              >
                收藏
              </button>
              <button
                onClick={() => handleLocalUpload('incremental')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                触发上传
              </button>
              <button
                onClick={() => handleLocalUpload('full')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
              >
                全量上传
              </button>
              <button
                onClick={handleRebuildExif}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md"
              >
                EXIF 重新生成
              </button>
            </div>
          </div>
          {pathStatus && (
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {pathStatus}
            </div>
          )}
          {favorites.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">常用目录</div>
              <div className="flex flex-wrap gap-2">
                {favorites.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setLocalDir(dir)}
                    className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  >
                    {dir}
                  </button>
                ))}
                {favorites.map((dir) => (
                  <button
                    key={`${dir}-remove`}
                    onClick={() => removeFavorite(dir)}
                    className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  >
                    删除 {dir}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>上传进度</span>
              <span>{uploadProgress !== null ? `${uploadProgress.toFixed(0)}%` : '—'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
            {uploadLabel && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {uploadLabel}
              </div>
            )}
          </div>
          {localUploadStatus && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {localUploadStatus}
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">同步日志</h2>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>任务进度</span>
              <span>{progressValue !== null ? `${progressValue.toFixed(0)}%` : '—'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                style={{ width: `${progressValue ?? 0}%` }}
              />
            </div>
            {progressLabel && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {progressLabel}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {isLoading ? '同步中，日志自动刷新…' : '最近同步日志（自动刷新）'}
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-md p-3 max-h-60 overflow-y-auto font-mono text-xs space-y-2">
            {updates.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">暂无日志</div>
            ) : (
              updates.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDateTime(item.created_at)}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {item.type}
                  </span>
                  <span className={`whitespace-nowrap ${
                    item.status === 'success' ? 'text-green-600 dark:text-green-400' :
                    item.status === 'warning' || item.status === 'partial_success' ? 'text-yellow-600 dark:text-yellow-400' :
                    item.status === 'info' ? 'text-blue-600 dark:text-blue-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {item.status}
                  </span>
                  {item.progress !== null && item.progress !== undefined && (
                    <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {Number(item.progress).toFixed(0)}%
                    </span>
                  )}
                  <span className="text-gray-800 dark:text-gray-200">{item.message || ''}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Webhook 信息</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            您可以通过以下 Webhook 端点自动更新数据：
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md mb-4 font-mono text-sm overflow-x-auto">
            POST /api/webhook
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            请在请求头中添加以下验证信息：
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md font-mono text-sm overflow-x-auto flex justify-between items-center">
            <span>x-webhook-secret: {showWebhookSecret ? webhookSecret : '••••••••••••••••'}</span>
            <button 
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showWebhookSecret ? '隐藏' : '显示'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
