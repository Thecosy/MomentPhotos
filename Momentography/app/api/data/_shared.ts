import { getAlbums, getAllImages } from '@/app/utils/dbUtils';

interface AlbumPayload {
  title: string;
  desc: string;
  location: string;
  date: string;
  images: string[];
}

type GenericRecord = Record<string, unknown>;

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toPosition(value: unknown): number {
  const position = toNumber(value);
  return position === null ? Number.MAX_SAFE_INTEGER : position;
}

function topAlbumId(albumId: string): string {
  const normalized = toText(albumId);
  const [topLevel] = normalized.split('/');
  return topLevel || normalized;
}

function createAlbumPayload(id: string): AlbumPayload {
  return {
    title: id,
    desc: '',
    location: '',
    date: '',
    images: [],
  };
}

function addImage(album: AlbumPayload, imageUrl: string): void {
  if (!imageUrl) {
    return;
  }

  if (!album.images.includes(imageUrl)) {
    album.images.push(imageUrl);
  }
}

function extractFileStem(url: string): string {
  if (!url) {
    return '';
  }

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split('?')[0];
  }

  const normalizedPath = pathname.replace(/\\/g, '/');
  const fileName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
  if (!fileName) {
    return '';
  }

  const extensionIndex = fileName.lastIndexOf('.');
  return extensionIndex === -1 ? fileName : fileName.substring(0, extensionIndex);
}

export function buildAlbumsPayload(): Record<string, AlbumPayload> {
  const albumsFromDb = getAlbums() as GenericRecord[];
  const imagesFromDb = getAllImages(false) as GenericRecord[];
  const albums: Record<string, AlbumPayload> = {};

  for (const album of albumsFromDb) {
    const albumId = toText(album.id);
    if (!albumId) {
      continue;
    }

    albums[albumId] = {
      title: toText(album.title) || albumId,
      desc: toText(album.description),
      location: toText(album.location),
      date: toText(album.date),
      images: [],
    };
  }

  const sortedImages = [...imagesFromDb].sort((left, right) => {
    const leftAlbumId = toText(left.album_id);
    const rightAlbumId = toText(right.album_id);
    if (leftAlbumId !== rightAlbumId) {
      return leftAlbumId.localeCompare(rightAlbumId, 'zh-Hans-CN');
    }

    const leftPosition = toPosition(left.position);
    const rightPosition = toPosition(right.position);
    if (leftPosition !== rightPosition) {
      return leftPosition - rightPosition;
    }

    const leftCreatedAt = toText(left.created_at);
    const rightCreatedAt = toText(right.created_at);
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return toText(left.id).localeCompare(toText(right.id));
  });

  for (const image of sortedImages) {
    const albumId = toText(image.album_id);
    const imageUrl = toText(image.url);
    if (!albumId || !imageUrl) {
      continue;
    }

    if (!albums[albumId]) {
      albums[albumId] = createAlbumPayload(albumId);
    }
    addImage(albums[albumId], imageUrl);

    const topLevelId = topAlbumId(albumId);
    if (!topLevelId) {
      continue;
    }

    if (!albums[topLevelId]) {
      albums[topLevelId] = createAlbumPayload(topLevelId);
    }
    addImage(albums[topLevelId], imageUrl);

    if (!albums[topLevelId].location && albums[albumId].location) {
      albums[topLevelId].location = albums[albumId].location;
    }
    if (!albums[topLevelId].date && albums[albumId].date) {
      albums[topLevelId].date = albums[albumId].date;
    }
  }

  return albums;
}

export function buildExifPayload(): Record<string, GenericRecord> {
  const images = getAllImages(true) as GenericRecord[];
  const exifData: Record<string, GenericRecord> = {};

  for (const image of images) {
    const albumId = toText(image.album_id);
    const imageUrl = toText(image.url);
    if (!albumId || !imageUrl) {
      continue;
    }

    const fileStem = extractFileStem(imageUrl);
    if (!fileStem) {
      continue;
    }

    const exif = (image.exif || {}) as GenericRecord;
    const mapKey = `${topAlbumId(albumId)}/${fileStem}`;

    if (exifData[mapKey]) {
      continue;
    }

    exifData[mapKey] = {
      DateTime: toText(exif.date_time) || toText(image.date),
      Location: toText(exif.location) || toText(image.location),
      CameraModel: toText(exif.camera_model),
      LensModel: toText(exif.lens_model),
      FNumber: toNumber(exif.f_number),
      ExposureTime: toText(exif.exposure_time),
      ISO: toNumber(exif.iso),
      FocalLength: toText(exif.focal_length),
      Orientation: toText(exif.orientation),
      Latitude: toNumber(exif.latitude),
      Longitude: toNumber(exif.longitude),
      star: toNumber(image.star) || 0,
    };
  }

  return exifData;
}
