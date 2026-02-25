'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import {
  Camera,
  MapPin,
  Calendar,
  X,
  Star,
  PencilSimple,
  CheckCircle,
  XCircle,
  Trash
} from '@phosphor-icons/react';
import ExifEditor from './ExifEditor';
import { parseExifDate } from '@/app/utils/dateFormat';

interface Photo {
  id: string;
  url: string;
  title?: string;
  location?: string;
  date?: string;
  star?: number;
  album_id?: string;
  album_title?: string;
  exif?: {
    camera_model?: string | null;
    lens_model?: string | null;
    f_number?: number | null;
    exposure_time?: string | null;
    iso?: number | null;
    focal_length?: string | null;
    location?: string | null;
    date_time?: string | null;
    orientation?: string | null;
    raw_data?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    raw?: any;
  };
}

interface PhotoDetailProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onStarUpdate?: (photoId: string, newStars: number) => Promise<void>;
  onRefresh?: () => void;
  onDelete?: (photoId: string) => void;
}

export default function PhotoDetail({ photo, isOpen, onClose, onStarUpdate, onRefresh, onDelete }: PhotoDetailProps) {
  const [stars, setStars] = useState(photo.star || 0);
  const [isUpdatingStar, setIsUpdatingStar] = useState(false);
  const [showExifEditor, setShowExifEditor] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCloud, setDeleteCloud] = useState(false);
  const [deleteLocal, setDeleteLocal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStarClick = async (newStars: number) => {
    if (isUpdatingStar || !onStarUpdate) return;
    
    setIsUpdatingStar(true);
    try {
      await onStarUpdate(photo.id, newStars);
      setStars(newStars);
      setUpdateStatus('success');
      setTimeout(() => setUpdateStatus('idle'), 2000);
    } finally {
      setIsUpdatingStar(false);
    }
  };

  const handleSaveExif = async (data: any) => {
    try {
      const response = await fetch('/api/photos/update-exif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('更新EXIF数据失败');
      }

      // 如果有刷新函数，调用它来刷新数据
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteCloud && !deleteLocal) {
      alert('请至少选择一个删除选项');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/photos/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoId: photo.id,
          deleteCloud,
          deleteLocal
        }),
      });

      if (!response.ok) {
        throw new Error('删除照片失败');
      }

      // 关闭对话框
      setShowDeleteDialog(false);
      onClose();

      // 调用删除回调
      if (onDelete) {
        onDelete(photo.id);
      }

      // 刷新数据
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('删除照片失败:', error);
      alert('删除照片失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="relative z-[50]"
      >
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-6xl bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden">
            <div className="relative">
              <button
                onClick={onClose}
                className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col lg:flex-row">
                {/* 左侧大图 */}
                <div className="relative lg:w-3/4 aspect-[4/3]">
                  <Image
                    src={photo.url}
                    alt={photo.title || "照片"}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>

                {/* 右侧信息面板 */}
                <div className="lg:w-1/4 bg-white dark:bg-gray-900 p-6 overflow-y-auto max-h-[calc(100vh-2rem)]">
                  {/* 标题和位置 */}
                  <div className="mb-6">
                    <div className="flex justify-between items-start">
                      <h2 className="text-xl font-medium dark:text-white mb-2">{photo.title || photo.album_title || "未命名照片"}</h2>

                      <div className="flex gap-2">
                        {/* 删除按钮 */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowDeleteDialog(true)}
                          className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="删除照片"
                        >
                          <Trash size={20} className="text-red-500" />
                        </motion.button>

                        {/* 星级评分 */}
                        {onStarUpdate && (
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <motion.button
                                key={n}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleStarClick(n)}
                                className={`p-1 ${isUpdatingStar ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isUpdatingStar}
                              >
                                <Star
                                  size={20}
                                  weight={n <= stars ? "fill" : "regular"}
                                  className={`${n <= stars ? 'text-yellow-400' : 'text-gray-400'}`}
                                />
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {updateStatus === 'success' && (
                      <div className="mt-2 p-2 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md text-sm flex items-center">
                        <CheckCircle size={16} weight="fill" className="mr-2" />
                        星级已更新
                      </div>
                    )}
                    
                    {updateStatus === 'error' && (
                      <div className="mt-2 p-2 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm flex items-center">
                        <XCircle size={16} weight="fill" className="mr-2" />
                        更新星级失败
                      </div>
                    )}
                    
                    {(photo.exif?.location || photo.location) && (
                      <div className="flex items-center text-gray-600 dark:text-gray-300">
                        <MapPin weight="fill" size={18} className="mr-2" />
                        <span className="text-sm">{photo.exif?.location || photo.location}</span>
                      </div>
                    )}
                    
                    {(photo.exif?.date_time || photo.date) && (
                      <div className="flex items-center text-gray-600 dark:text-gray-300 mt-1">
                        <Calendar weight="fill" size={18} className="mr-2" />
                        <span className="text-sm">
                          {(() => {
                            const dateValue = photo.exif?.date_time || photo.date;
                            const parsed = dateValue ? parseExifDate(dateValue) : null;
                            return parsed ? parsed.toLocaleString() : (dateValue || '未知');
                          })()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* EXIF数据 */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        EXIF数据
                      </h3>
                      <button
                        onClick={() => setShowExifEditor(!showExifEditor)}
                        className={`text-sm px-3 py-1 rounded-lg flex items-center ${
                          showExifEditor
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <PencilSimple size={16} className="mr-1" />
                        {showExifEditor ? '取消编辑' : '编辑'}
                      </button>
                    </div>
                    
                    {showExifEditor ? (
                      <div className="mt-4">
                        <ExifEditor
                          photoId={photo.id}
                          exifData={photo.exif || {}}
                          onClose={() => setShowExifEditor(false)}
                          onSave={async (updatedData) => {
                            try {
                              const response = await fetch('/api/photos/update-exif', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(updatedData),
                              });
                              
                              if (!response.ok) {
                                throw new Error('更新EXIF数据失败');
                              }
                              
                              // 更新成功后关闭编辑器并刷新数据
                              setShowExifEditor(false);
                              if (onRefresh) {
                                await onRefresh();
                              }
                            } catch (error) {
                              throw error;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 方向信息 */}
                        {(photo.exif?.orientation || (photo.exif?.raw && (photo.exif.raw['Image Orientation'] || photo.exif.raw['Orientation'] || photo.exif.raw['EXIF Orientation']))) && (
                          <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                            <span className="mr-2">Orientation</span>
                            <span className="font-mono">
                              {photo.exif?.orientation || photo.exif?.raw?.['Image Orientation'] || photo.exif?.raw?.['Orientation'] || photo.exif?.raw?.['EXIF Orientation']}
                            </span>
                          </div>
                        )}

                        {/* 相机和镜头信息 */}
                        <div className="space-y-2">
                          {photo.exif?.camera_model && (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <Camera weight="fill" size={16} className="mr-2" />
                              <span className="text-sm">{photo.exif.camera_model}</span>
                            </div>
                          )}
                          
                          {photo.exif?.lens_model && (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <span className="text-sm ml-6">{photo.exif.lens_model}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 拍摄参数 */}
                        {(photo.exif?.f_number || photo.exif?.iso || photo.exif?.focal_length || photo.exif?.exposure_time) && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              {photo.exif?.f_number && (
                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                  <span>光圈</span>
                                  <span className="font-mono">ƒ/{photo.exif.f_number}</span>
                                </div>
                              )}
                              
                              {photo.exif?.exposure_time && (
                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                  <span>快门速度</span>
                                  <span className="font-mono">{photo.exif.exposure_time}s</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {photo.exif?.iso && (
                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                  <span>ISO</span>
                                  <span className="font-mono">{photo.exif.iso}</span>
                                </div>
                              )}
                              
                              {photo.exif?.focal_length && (
                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                  <span>焦距</span>
                                  <span className="font-mono">{photo.exif.focal_length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* 位置和时间 */}
                        <div className="space-y-2">
                          {photo.exif?.location && (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <MapPin weight="fill" size={16} className="mr-2" />
                              <span className="text-sm">{photo.exif.location}</span>
                            </div>
                          )}
                          
                          {(photo.exif?.latitude || photo.exif?.longitude) && (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <MapPin weight="fill" size={16} className="mr-2" />
                              <span className="text-sm">
                                {photo.exif.latitude?.toFixed(6)}, {photo.exif.longitude?.toFixed(6)}
                              </span>
                            </div>
                          )}
                          
                          {photo.exif?.date_time && (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <Calendar weight="fill" size={16} className="mr-2" />
                              <span className="text-sm">{photo.exif.date_time}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 相册信息 */}
                  {photo.album_title && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        相册
                      </h3>
                      <div className="text-gray-600 dark:text-gray-300 text-sm">
                        {photo.album_title}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        className="relative z-[60]"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
            <Dialog.Title className="text-lg font-semibold mb-4 dark:text-white">
              删除照片
            </Dialog.Title>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              请选择要删除的内容：
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteCloud}
                  onChange={(e) => setDeleteCloud(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-200">删除七牛云文件</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteLocal}
                  onChange={(e) => setDeleteLocal(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-200">删除本地文件</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting || (!deleteCloud && !deleteLocal)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 
