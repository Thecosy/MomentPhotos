'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash, ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';

interface AlbumImage {
  id: string;
  url: string;
  position: number | null;
}

interface Album {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date?: string;
  cover_image?: string;
  images: AlbumImage[];
}

function SortablePhoto({ image, selected }: { image: AlbumImage; selected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg overflow-hidden border ${
        selected ? 'border-blue-500' : 'border-transparent'
      } ${isDragging ? 'opacity-70' : 'opacity-100'}`}
      {...attributes}
      {...listeners}
    >
      <div className="relative w-full h-32 bg-gray-100 dark:bg-gray-800">
        <Image src={image.url} alt={image.id} fill className="object-cover" />
      </div>
    </div>
  );
}

export default function AlbumsAdminPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAlbum = useMemo(
    () => albums.find((a) => a.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  const loadAlbums = async () => {
    setError(null);
    const response = await fetch('/api/admin/albums');
    if (!response.ok) {
      setError('获取相册失败');
      return;
    }
    const data = await response.json();
    const list = Array.isArray(data.albums) ? data.albums : [];
    setAlbums(list);
    if (!selectedAlbumId && list.length > 0) {
      setSelectedAlbumId(list[0].id);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  const handleDragEnd = async (event: any) => {
    if (!selectedAlbum) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = selectedAlbum.images || [];
    const oldIndex = current.findIndex((img) => img.id === active.id);
    const newIndex = current.findIndex((img) => img.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newImages = arrayMove(current, oldIndex, newIndex);
    setAlbums((prev) =>
      prev.map((album) =>
        album.id === selectedAlbum.id ? { ...album, images: newImages } : album
      )
    );

    setSaving(true);
    await fetch(`/api/admin/albums/${selectedAlbum.id}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newImages.map((img) => img.id) }),
    });
    setSaving(false);
  };

  const handleDeleteAlbum = async () => {
    if (!selectedAlbum) return;
    const ok = window.confirm(`确定删除相册「${selectedAlbum.title || selectedAlbum.id}」吗？这会删除七牛上的图片。`);
    if (!ok) return;

    setSaving(true);
    const res = await fetch(`/api/admin/albums/${selectedAlbum.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!res.ok) {
      setError('删除失败，请稍后重试');
      return;
    }
    await loadAlbums();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-blue-600 dark:text-blue-400 flex items-center">
              <ArrowLeft size={18} className="mr-1" />
              返回管理面板
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">相册管理</h1>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {saving ? '保存中…' : '拖拽图片调整排序'}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">相册列表</div>
            <div className="space-y-2">
              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`w-full text-left px-3 py-2 rounded-md ${
                    selectedAlbumId === album.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <div className="font-medium">{album.title || album.id}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {album.images?.length || 0} 张
                  </div>
                </button>
              ))}
              {albums.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">暂无相册</div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            {!selectedAlbum ? (
              <div className="text-gray-500 dark:text-gray-400">请选择一个相册</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedAlbum.title || selectedAlbum.id}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedAlbum.images?.length || 0} 张照片
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteAlbum}
                    className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center"
                  >
                    <Trash size={16} className="mr-2" />
                    删除相册
                  </button>
                </div>

                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selectedAlbum.images.map((img) => img.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {selectedAlbum.images.map((img) => (
                        <SortablePhoto key={img.id} image={img} selected={false} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
