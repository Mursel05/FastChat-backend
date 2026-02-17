const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

function getFileExtension(file) {
  const parts = file.originalname.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
}

const publicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userDir = path.join("public", req.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    const fileName = `${uuidv4()}.${getFileExtension(file)}`;
    req.fileType = file.mimetype;
    const baseUrl = process.env.BASE_URL;
    req.filePath = `${baseUrl}/public/${req.userId}/${fileName}`;
    cb(null, fileName);
  },
});

const privateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userDir = path.join("uploads", req.params.chatId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    const fileName = `${uuidv4()}.${getFileExtension(file)}`;
    req.fileType = file.mimetype;
    req.filePath = path.join(req.params.chatId, fileName);
    cb(null, fileName);
  },
});

exports.privateUpload = multer({ storage: privateStorage });
exports.publicUpload = multer({ storage: publicStorage });
