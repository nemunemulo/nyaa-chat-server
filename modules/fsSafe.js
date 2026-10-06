/**
 * fsSafe.js - Safe Atomic File Persistence for NyaaChat
 * Prevents JSON corruption or 0-byte truncation on power-cuts / sudden restarts
 * by writing to a temporary file in the same directory and performing an atomic rename.
 */

const fs = require('fs');
const path = require('path');

function safeAtomicWriteFile(filePath, data, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = 'utf8';
  }
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpFile = path.join(dir, `.${base}.tmp_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 4)}`);

  fs.writeFile(tmpFile, data, options, (err) => {
    if (err) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      if (callback) callback(err);
      return;
    }
    fs.rename(tmpFile, filePath, (renameErr) => {
      if (renameErr) {
        // Fallback: If atomic rename fails (e.g. rare Windows locking race), copy and remove
        fs.copyFile(tmpFile, filePath, (copyErr) => {
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          if (callback) callback(copyErr);
        });
      } else {
        if (callback) callback(null);
      }
    });
  });
}

function safeAtomicWriteFileSync(filePath, data, options) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpFile = path.join(dir, `.${base}.tmp_${Date.now()}_${process.pid}_${Math.random().toString(36).substr(2, 4)}`);

  try {
    fs.writeFileSync(tmpFile, data, options);
    try {
      fs.renameSync(tmpFile, filePath);
    } catch (renameErr) {
      fs.copyFileSync(tmpFile, filePath);
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    throw err;
  }
}

module.exports = {
  safeAtomicWriteFile,
  safeAtomicWriteFileSync
};
