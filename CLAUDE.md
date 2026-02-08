# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MomentPhotos is a photography portfolio system with two main components:
- **Backend (Python)**: Photo processing, EXIF extraction, OSS synchronization
- **Frontend (Next.js)**: Photo gallery display in `Momentography/` subdirectory

The system follows a "file as source of truth" philosophy - photos stored locally are automatically processed, compressed to WebP, uploaded to Qiniu OSS, and metadata is extracted for web display.

## Architecture

### Data Flow
1. Local photo library → Image processing → WebP compression + EXIF extraction
2. Upload to Qiniu OSS (cloud storage)
3. Generate `albums.json` and `exif_data.json` metadata files
4. Webhook triggers frontend to sync metadata from OSS
5. Frontend imports JSON data into SQLite database via `scripts/import-json-to-db.js`

### Key Components

**Backend (`/`):**
- `server.py` - Flask webhook server (port 8089) that receives OSS update notifications
- `local_image_process/upload_oss.py` - Core image processor: EXIF parsing, WebP conversion, watermarking, OSS upload
- `read_oss.py` - Syncs metadata from Qiniu OSS to local JSON files
- `util.py` - EXIF data retrieval from local JSON cache
- `config.py` - Paths to `data/albums.json` and `data/exif_data.json`

**Frontend (`Momentography/`):**
- Next.js 15 app with SQLite database (`data/gallery.db`)
- `scripts/import-json-to-db.js` - Imports JSON metadata into SQLite
- Admin routes at `/admin` and `/admin/oss` for local management

### Photo Library Structure

The system supports Apple Photos-style `.library` directories:
- Scans `images/`, `Originals/`, or `Masters/` subdirectories
- Reads `metadata.json` at library root for folder ID → name mapping
- Infers album names from directory structure or metadata
- Skips system directories (`.`, `resources`, `database`, `caches`, `thumbnails`)

## Development Commands

### Backend

**Start backend server:**
```bash
python server.py
# Runs on http://0.0.0.0:8089
# Webhook endpoint: http://127.0.0.1:8089/webhook
```

**Process photos manually:**
```bash
# One-time processing
python local_image_process/upload_oss.py /path/to/photos

# Or set environment variable
export WATCH_DIR=/path/to/photos
export RUN_ONCE=1
python local_image_process/upload_oss.py
```

**Sync metadata from OSS:**
```bash
python read_oss.py
```

### Frontend

**Start frontend (from Momentography/):**
```bash
cd Momentography
npm install  # First time only
HOSTNAME=127.0.0.1 npm run dev -- --port 3001
# Access at http://localhost:3001
```

**Build for production:**
```bash
cd Momentography
npm run build
npm start
```

**Import JSON to database:**
```bash
cd Momentography
node scripts/import-json-to-db.js
```

### Windows Shortcuts

- `Start-MomentPhotos.bat` - Starts frontend on Windows
- `Start-MomentPhotos.command` - Starts frontend on Mac/Linux

## Configuration

### Environment Variables (`.env`)

**Required:**
- `WATCH_DIR` - Local photo directory path (e.g., `E:\w.library` on Windows, `/Users/apple/Pictures/摄影照片.library/` on Mac)
- `QINIU_ACCESS_KEY`, `QINIU_SECRET_KEY` - Qiniu OSS credentials
- `QINIU_BUCKET` - OSS bucket name
- `QINIU_DOMAIN` - OSS domain for public access
- `QINIU_REGION` - Region code (e.g., `huanan` for South China)

**Optional:**
- `GAODE_KEY` - Gaode Maps API key for GPS reverse geocoding (fallback to Nominatim if not set)
- `USERNAME`, `PASSWORD` - Admin authentication (default: admin/admin123)
- `WEBHOOK_URL` - Frontend webhook URL (default: http://localhost:8089/webhook)
- `FULL_UPLOAD=1` - Force full re-upload instead of incremental
- `PORT` - Backend server port (default: 8089)

### Path Handling

**CRITICAL:** When working across platforms:
- Windows paths use backslashes: `C:\Users\...` or `E:\w.library`
- Mac/Linux paths use forward slashes: `/Users/apple/...`
- Always update `WATCH_DIR` in `.env` to match the current OS

## Image Processing Pipeline

The `ImageProcessor` class in `upload_oss.py`:

1. **Scans** photo library, skipping thumbnails and system directories
2. **Extracts EXIF** using `exifread` library (camera model, lens, exposure settings, GPS, datetime)
3. **Converts to WebP** at quality=20 with EXIF preservation
4. **Applies watermark** (`sy.png`) at bottom-left with 80% opacity
5. **Uploads to OSS** with prefix `gallery/{album_name}/`
6. **Generates metadata**:
   - `exif_data.json` - Keyed by `{album}/{filename}`, contains parsed EXIF
   - `albums.json` - Album structure with image URLs and YAML metadata
7. **Logs progress** to SQLite `updates` table for frontend status display

### GPS Location Parsing

Two-tier fallback system:
1. `parse_location_rg()` - Uses Nominatim (OpenStreetMap) geocoder
2. `parse_location_gaode()` - Falls back to Gaode Maps API if Nominatim fails

## Webhook Flow

When photos are updated on OSS:
1. OSS triggers POST to `/webhook` endpoint
2. Backend calls `update_albums_json_data()` to sync metadata from OSS
3. Backend runs `node scripts/import-json-to-db.js` to update SQLite
4. Frontend can now display updated photos

## Common Patterns

### Reading EXIF Data
Frontend calls backend, which reads from cached `data/exif_data.json`:
```python
from util import get_exif_data
info = get_exif_data("https://domain.com/gallery/album/photo.webp")
# Returns: {设备, 光圈, 快门速度, 焦距, ISO, 时间, 位置, 版权, 镜头, Longitude, Latitude, star, likes}
```

### Album Name Inference
Priority order:
1. Directory's `metadata.json` → folder IDs → library root `metadata.json` mapping
2. Path structure: `images/{album_name}/...` → use `album_name`
3. Fallback to first directory component or "default"

## Docker Deployment

```bash
docker run -d \
  -p 8089:8089 \
  -v /your/local/data:/app/data \
  -v /your/local/.env:/app/.env \
  angyi123/photo_gallery:v1.0
```

## Important Notes

- **Incremental uploads**: By default, only new files are uploaded. Set `FULL_UPLOAD=1` to re-upload everything
- **Thumbnail cleanup**: The system automatically deletes `_thumbnail` files from OSS and skips them during processing
- **EXIF orientation**: Images are auto-rotated using `ImageOps.exif_transpose()` to fix portrait/landscape issues
- **Watermark**: Default watermark is `local_image_process/sy.png`, configurable in code
- **Database location**: Frontend uses `Momentography/data/gallery.db` (SQLite)
- **Output directory**: Processed images are temporarily stored in `local_image_process/output/` before upload
- **Bidirectional sync**:
  - Local deletion → Cloud deletion (automatic during upload)
  - Cloud deletion → Local deletion (automatic before next upload)
  - Deleted photos are tracked in `Momentography/data/deleted_photos.json`
