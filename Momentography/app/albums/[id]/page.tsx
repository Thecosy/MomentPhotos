'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { MapPin, Calendar, Camera, X } from '@phosphor-icons/react';
import AMapContainer from '@/app/components/AMapContainer';
import { formatDate, parseExifDate } from '@/app/utils/dateFormat';

interface Photo {
  id: string;
  url: string;
  exif: {
    camera_model?: string;
    lens_model?: string;
    exposure_time?: string;
    f_number?: number;
    iso?: number;
    focal_length?: string;
    date_time?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    orientation?: string;
  };
}

interface Album {
  id: string;
  title: string;
  desc: string;
  date: string;
  location: string;
  coordinates: [number, number];
  images: string[];
}

interface AlbumData {
  [key: string]: {
    title: string;
    desc: string;
    date: string;
    location: string;
    images: string[];
  };
}

export default function AlbumPage() {
  const params = useParams();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlbum() {
      try {
        setIsLoading(true);
        
        // 处理URL编码的ID
        let albumId = Array.isArray(params.id) ? params.id[0] : params.id;
        
        // 确保albumId是字符串类型
        if (typeof albumId !== 'string') {
          setError('无效的相册ID');
          setIsLoading(false);
          return;
        }
        
        // 尝试URL解码
        try {
          albumId = decodeURIComponent(albumId);
        } catch (e) {
          // 忽略解码错误
        }
        
        // 获取相册数据
        const albumsResp = await fetch(`/api/data/albums/${encodeURIComponent(albumId)}`);
        if (!albumsResp.ok) {
          if (albumsResp.status === 404) {
            setError(`相册 "${albumId}" 不存在`);
          } else {
            throw new Error('无法加载相册数据');
          }
          setIsLoading(false);
          return;
        }
        
        const albumData = await albumsResp.json();
        
        // 解析坐标
        const locationStr = albumData.location || '';
        const coordinates = locationStr.split(',').map((coord: string) => parseFloat(coord.trim())) as [number, number];
        
        // 设置相册数据
        const albumWithId: Album = {
          id: albumId,
          title: albumData.title,
          desc: albumData.desc,
          date: albumData.date,
          location: albumData.location,
          coordinates: coordinates.length === 2 && !isNaN(coordinates[0]) && !isNaN(coordinates[1]) 
            ? coordinates 
            : [0, 0],
          images: albumData.images || []
        };
        
        setAlbum(albumWithId);
        
        // 获取带 EXIF 的图片列表（包含数据库中编辑后的数据）
        const photosResp = await fetch('/api/photos/list?withExif=true');
        if (!photosResp.ok) throw new Error('无法加载照片数据');
        const photosData = await photosResp.json();
        const list = Array.isArray(photosData.photos) ? photosData.photos : [];
        
        // 处理照片数据
        const processedPhotos = albumWithId.images.map((url, index) => {
          const matched = list.find((p: any) => p.url === url || p.url?.endsWith(url.split('/').pop()));
          return {
            id: matched?.id || `${albumId}_${index}`,
            url,
            exif: matched?.exif || {},
          };
        });

        // 如果相册缺少日期/地点，用第一张照片的 EXIF 填充
        const firstPhoto = processedPhotos.find(p => p.exif?.date_time || p.exif?.location);
        if (firstPhoto) {
          albumWithId.date = albumWithId.date || firstPhoto.exif?.date_time || '';
          albumWithId.location = albumWithId.location || firstPhoto.exif?.location || '';
        }
        
        setPhotos(processedPhotos);
      } catch (error) {
        setError('加载相册数据时出错');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (params.id) {
      loadAlbum();
    }
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">出错了</h1>
        <p className="text-gray-600 mb-8">{error || '无法加载相册'}</p>
        <p className="text-gray-600">相册ID: {params.id}</p>
        <p className="text-gray-600 mt-4">可用相册: {album ? '有' : '无'}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 相册标题和描述 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl font-bold mb-4">{album.title}</h1>
        <div className="h-16 flex items-center justify-center">
          <p className="text-gray-600 max-w-2xl mx-auto line-clamp-2">{album.desc}</p>
        </div>
        
        <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-600">
          <div className="flex items-center">
            <MapPin size={18} className="mr-2" />
            <span>{album.location || '未知地点'}</span>
          </div>
          <div className="flex items-center">
            <Calendar size={18} className="mr-2" />
            <span>{album.date ? formatDate(album.date, 'full') : '未知时间'}</span>
          </div>
        </div>
      </motion.div>
      
      {/* 照片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="cursor-pointer"
            onClick={() => setSelectedPhoto(photo)}
          >
            <div className={`relative rounded-lg overflow-hidden ${
              (photo.exif?.orientation || '') && /90|270|Rotated 90|Rotated 270/i.test(photo.exif.orientation || '')
                ? 'aspect-[3/4]'
                : 'aspect-[4/3]'
            }`}>
              <Image
                src={photo.url}
                alt={`${album.title} - 照片 ${index + 1}`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* 照片详情弹窗 */}
      <Dialog
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-6xl transform rounded-2xl bg-black text-left align-middle shadow-xl transition-all">
              {selectedPhoto && (
                <div className="relative">
                  {/* 关闭按钮 - 调整位置到左上角 */}
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="absolute left-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/75 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>

                  {/* 主要内容区域 */}
                  <div className="flex flex-col lg:flex-row">
                    {/* 左侧大图 */}
                    <div className="relative lg:w-3/4 aspect-[4/3]">
                      <Image
                        src={selectedPhoto.url}
                        alt={`${album.title} 照片`}
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>

                    {/* 右侧信息面板 */}
                    <div className="lg:w-1/4 bg-white dark:bg-gray-900 p-6 overflow-y-auto max-h-[calc(100vh-2rem)]">
                      {/* 标题和位置 */}
                      <div className="mb-6">
                        <h2 className="text-xl font-medium dark:text-white mb-2">{album.title}</h2>
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                          <MapPin weight="fill" size={18} className="mr-2" />
                          <span className="text-sm">{selectedPhoto.exif.location || album.location || '未知地点'}</span>
                        </div>
                      </div>

                      {/* 地图 */}
                      {selectedPhoto.exif.latitude && selectedPhoto.exif.longitude && (
                        <div className="mb-6 rounded-lg overflow-hidden h-48">
                          <AMapContainer
                            center={[selectedPhoto.exif.latitude, selectedPhoto.exif.longitude]}
                            zoom={15}
                            marker={true}
                            location={selectedPhoto.exif.location || album.title}
                          />
                        </div>
                      )}
                      {!selectedPhoto.exif.latitude && !selectedPhoto.exif.longitude && (
                        <div className="h-48 w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 mb-6 rounded-lg">
                          <MapPin size={24} className="mr-2" />
                          <span>该照片没有位置信息</span>
                        </div>
                      )}

                      {/* 拍摄信息 */}
                      <div className="space-y-6">
                        {/* 基本信息 */}
                        <div className="space-y-3">
                          <div className="flex items-center text-gray-600 dark:text-gray-300">
                            <Calendar weight="fill" size={18} className="mr-2" />
                            <span className="text-sm">
                              {(() => {
                                const dateValue = selectedPhoto.exif.date_time || album.date;
                                const parsed = dateValue ? parseExifDate(dateValue) : null;
                                return parsed ? parsed.toLocaleString() : (dateValue || '未知时间');
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-600 dark:text-gray-300">
                            <Camera weight="fill" size={18} className="mr-2" />
                            <span className="text-sm">{selectedPhoto.exif.camera_model || '未知相机'}</span>
                          </div>
                        </div>

                        {/* EXIF 信息 */}
                        {(selectedPhoto.exif.f_number || selectedPhoto.exif.iso || selectedPhoto.exif.focal_length || selectedPhoto.exif.exposure_time) && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                              拍摄参数
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="space-y-2">
                                {selectedPhoto.exif.f_number && (
                                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                    <span>光圈</span>
                                    <span className="font-mono">ƒ/{selectedPhoto.exif.f_number}</span>
                                  </div>
                                )}
                                {selectedPhoto.exif.exposure_time && (
                                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                    <span>快门速度</span>
                                    <span className="font-mono">{selectedPhoto.exif.exposure_time}s</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                {selectedPhoto.exif.iso && (
                                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                    <span>ISO</span>
                                    <span className="font-mono">{selectedPhoto.exif.iso}</span>
                                  </div>
                                )}
                                {selectedPhoto.exif.focal_length && (
                                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                    <span>焦距</span>
                                    <span className="font-mono">{selectedPhoto.exif.focal_length}mm</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 镜头信息 */}
                        {selectedPhoto.exif.lens_model && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <Camera weight="fill" size={16} className="mr-2" />
                              <span className="text-sm">{selectedPhoto.exif.lens_model}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
