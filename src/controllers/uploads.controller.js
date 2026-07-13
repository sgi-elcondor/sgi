const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

exports.uploadAvatar = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibio ningun archivo" });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Formato no permitido. Use JPG, PNG o WebP" });
  }

  const MAX_BYTES = 5 * 1024 * 1024;
  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: "El archivo supera el limite de 5 MB" });
  }

  let uploadStream;
  try {
    uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:          "sgi/avatars",
        resource_type:   "image",
        allowed_formats: ["jpg", "png", "webp"],
        transformation:  [{ width: 400, height: 400, crop: "scale" }, { quality: "auto:good", fetch_format: "webp" }],
      },
      (err, result) => {
        if (err) return res.status(500).json({ error: "Error al subir imagen: " + err.message });
        res.json({ url: result.secure_url, public_id: result.public_id });
      }
    );
  } catch (err) {
    return res.status(500).json({ error: "Cloudinary no configurado: " + err.message });
  }

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
};

exports.uploadBaucher = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibio ningun archivo" });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Formato no permitido. Use JPG, PNG, WebP o PDF" });
  }

  const MAX_BYTES = 8 * 1024 * 1024;
  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: "El archivo supera el limite de 8 MB" });
  }

  let uploadStream;
  try {
    uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:          "sgi/bauchers",
        resource_type:   "auto",
        allowed_formats: ["jpg", "png", "webp", "gif", "pdf"],
      },
      (err, result) => {
        if (err) return res.status(500).json({ error: "Error al subir archivo: " + err.message });
        res.json({ url: result.secure_url, public_id: result.public_id });
      }
    );
  } catch (err) {
    return res.status(500).json({ error: "Cloudinary no configurado: " + err.message });
  }

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
};

exports.uploadLoteFoto = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibio ningun archivo" });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Formato no permitido. Use JPG, PNG o WebP" });
  }

  const MAX_BYTES = 5 * 1024 * 1024;
  if (req.file.size > MAX_BYTES) {
    return res.status(400).json({ error: "El archivo supera el limite de 5 MB" });
  }

  let uploadStream;
  try {
    uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:          "sgi/lotes",
        resource_type:   "image",
        allowed_formats: ["jpg", "png", "webp"],
        transformation:  [{ width: 1200, height: 800, crop: "limit" }, { quality: "auto:good", fetch_format: "webp" }],
      },
      (err, result) => {
        if (err) return res.status(500).json({ error: "Error al subir imagen: " + err.message });
        res.json({ url: result.secure_url, public_id: result.public_id });
      }
    );
  } catch (err) {
    return res.status(500).json({ error: "Cloudinary no configurado: " + err.message });
  }

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
};
