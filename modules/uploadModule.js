/**
 * Nyaa Chat - Media & File Upload Module (Separated)
 * 
 * This module encapsulates all file/image/video upload handling, Multer storage,
 * and static upload asset serving.
 * 
 * By default, this module is DISABLED and completely separated from core chat functionality.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

function setupUploadModule(app, options = {}) {
  const enabled = Boolean(options.enabled);
  const uploadsDir = options.uploadsDir || path.join(__dirname, '..', 'uploads');
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
  const MAX_TOTAL_STORAGE = 2 * 1024 * 1024 * 1024; // 2GB total storage cap

  const DANGEROUS_EXTENSIONS = new Set([
    '.svg', '.html', '.htm', '.xhtml', '.js', '.mjs', '.exe', '.bat', '.cmd',
    '.sh', '.php', '.phtml', '.py', '.vbs', '.msi', '.com', '.scr', '.ps1'
  ]);

  // Helper to determine file classification
  function getFileType(mimetype, filename) {
    if (mimetype.startsWith('image/')) {
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.svg') return 'file'; // Treat SVG as raw file, never inline image
      return 'image';
    }
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    const ext = path.extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
    if (['.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext)) return 'video';
    if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
    return 'file';
  }

  // Calculate current storage usage
  function getDirectorySize(dirPath) {
    let total = 0;
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const f of files) {
          try {
            const p = path.join(dirPath, f);
            const stat = fs.statSync(p);
            if (stat.isFile()) {
              total += stat.size;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    return total;
  }

  // IP Rate Limiter for uploads (5/min, 20/hr)
  const ipUploadRecords = new Map();
  function checkUploadRateLimit(ip) {
    const now = Date.now();
    let rec = ipUploadRecords.get(ip);
    if (!rec) {
      rec = { minuteCount: 0, minuteReset: now + 60000, hourCount: 0, hourReset: now + 3600000 };
      ipUploadRecords.set(ip, rec);
    }
    if (now > rec.minuteReset) {
      rec.minuteCount = 0;
      rec.minuteReset = now + 60000;
    }
    if (now > rec.hourReset) {
      rec.hourCount = 0;
      rec.hourReset = now + 3600000;
    }
    if (rec.minuteCount >= 5) {
      return { allowed: false, error: '분당 최대 업로드 횟수(5회)를 초과했습니다. 1분 후 다시 시도하세요.' };
    }
    if (rec.hourCount >= 20) {
      return { allowed: false, error: '시간당 최대 업로드 횟수(20회)를 초과했습니다. 잠시 후 다시 시도하세요.' };
    }
    rec.minuteCount++;
    rec.hourCount++;
    return { allowed: true };
  }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of ipUploadRecords.entries()) {
      if (now > rec.hourReset + 3600000) {
        ipUploadRecords.delete(ip);
      }
    }
  }, 600000).unref();

  if (!enabled) {
    // Return 403 Forbidden for any upload attempts when module is disabled
    app.post('/api/upload', (req, res) => {
      return res.status(403).json({
        success: false,
        error: '이미지, 동영상 및 파일 업로드 기능은 서버 정책에 따라 비활성화되어 있습니다.'
      });
    });
    return {
      enabled: false,
      getFileType
    };
  }

  // Ensure uploads directory exists if enabled
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve static uploads with strict security headers
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; img-src 'self'");
    next();
  }, express.static(uploadsDir));

  // Multer storage config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      let originalName = file.originalname;
      try {
        originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (e) {}
      const ext = path.extname(originalName).toLowerCase();
      const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}_${base}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        return cb(new Error('보안 정책상 허용되지 않는 파일 형식입니다.'));
      }
      cb(null, true);
    }
  });

  // Upload API Endpoint with rate limit & storage quota defenses
  app.post('/api/upload', (req, res) => {
    const clientIp = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || 'unknown';
    
    // 1. IP Rate Limiting
    const rateCheck = checkUploadRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ success: false, error: rateCheck.error });
    }

    // 2. Total Storage Quota (2GB cap)
    const currentUsage = getDirectorySize(uploadsDir);
    if (currentUsage >= MAX_TOTAL_STORAGE) {
      return res.status(507).json({ success: false, error: '서버 업로드 저장소 용량 한도(2GB)를 초과하여 새 파일을 업로드할 수 없습니다.' });
    }

    // 3. Process File Upload with Multer
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ success: false, error: '파일 크기가 50MB 제한을 초과했습니다.' });
        }
        return res.status(400).json({ success: false, error: err.message || '파일 업로드 처리 중 오류가 발생했습니다.' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: '파일이 제공되지 않았습니다.' });
      }

      let originalName = req.file.originalname;
      try {
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch (e) {}

      const fileType = getFileType(req.file.mimetype, originalName);

      res.json({
        success: true,
        file: {
          url: `/uploads/${req.file.filename}`,
          filename: req.file.filename,
          originalName,
          size: req.file.size,
          mimetype: req.file.mimetype,
          fileType
        }
      });
    });
  });

  return {
    enabled: true,
    getFileType
  };
}

module.exports = {
  setupUploadModule
};
