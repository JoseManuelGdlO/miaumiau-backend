const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

function uniqueFilename() {
  return crypto.randomBytes(16).toString('hex');
}

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');
const PRODUCTOS_DIR = path.join(UPLOADS_BASE, 'productos');
const PAQUETES_DIR = path.join(UPLOADS_BASE, 'paquetes');
const CONVERSACIONES_DIR = path.join(UPLOADS_BASE, 'conversaciones');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const CONVERSACIONES_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extFromMime(mimeType) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function getStorage(subdir) {
  const dirMap = {
    productos: PRODUCTOS_DIR,
    paquetes: PAQUETES_DIR,
    conversaciones: CONVERSACIONES_DIR,
  };
  const dir = dirMap[subdir] || PRODUCTOS_DIR;
  ensureDir(dir);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = extFromMime(file.mimetype) || path.extname(file.originalname) || '.jpg';
      cb(null, `${uniqueFilename()}${ext}`);
    }
  });
}

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Solo se permiten imágenes (JPG, PNG, GIF, WEBP)';
    cb(null, false);
  }
};

const conversacionesFileFilter = (req, file, cb) => {
  if (CONVERSACIONES_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Solo se permiten imágenes (JPG, PNG, WEBP)';
    cb(null, false);
  }
};

const uploadProductos = multer({
  storage: getStorage('productos'),
  limits: { fileSize: MAX_SIZE },
  fileFilter
});

const uploadPaquetes = multer({
  storage: getStorage('paquetes'),
  limits: { fileSize: MAX_SIZE },
  fileFilter
});

const uploadConversaciones = multer({
  storage: getStorage('conversaciones'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: conversacionesFileFilter
});

function ensureUploadsDirs() {
  ensureDir(PRODUCTOS_DIR);
  ensureDir(PAQUETES_DIR);
  ensureDir(CONVERSACIONES_DIR);
}

function deleteConversationImage(filename) {
  if (!filename || typeof filename !== 'string') return;
  const filePath = path.join(CONVERSACIONES_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  uploadProductos,
  uploadPaquetes,
  uploadConversaciones,
  ensureUploadsDirs,
  deleteConversationImage,
  UPLOADS_BASE,
  PRODUCTOS_DIR,
  PAQUETES_DIR,
  CONVERSACIONES_DIR,
  extFromMime,
  uniqueFilename,
  MAX_SIZE,
  CONVERSACIONES_MIMES,
};
