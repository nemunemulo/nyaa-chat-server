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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        return cb(new Error('보안 정책상 허용되지 않는 파일 형식입니다.'));
      }
      cb(null, true);
    }
  });

  // Upload API Endpoint
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
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

  return {
    enabled: true,
    getFileType
  };
}

module.exports = {
  setupUploadModule
};
