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

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getStorage(subdir) {
  const dir = subdir === 'productos' ? PRODUCTOS_DIR : PAQUETES_DIR;
  ensureDir(dir);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = (file.mimetype === 'image/jpeg' && '.jpg') || (file.mimetype === 'image/png' && '.png') || (file.mimetype === 'image/gif' && '.gif') || (file.mimetype === 'image/webp' && '.webp') || path.extname(file.originalname) || '.jpg';
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

function ensureUploadsDirs() {
  ensureDir(PRODUCTOS_DIR);
  ensureDir(PAQUETES_DIR);
}

module.exports = {
  uploadProductos,
  uploadPaquetes,
  ensureUploadsDirs,
  UPLOADS_BASE,
  PRODUCTOS_DIR,
  PAQUETES_DIR
};
