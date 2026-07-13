const router = require("express").Router();
const multer = require("multer");
const ctrl   = require("../controllers/uploads.controller");

const upload        = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const uploadAvatar  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadLoteFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}

router.post("/baucher",    handleUpload(upload.single("baucher")),        ctrl.uploadBaucher);
router.post("/avatar",     handleUpload(uploadAvatar.single("avatar")),   ctrl.uploadAvatar);
router.post("/lote-foto",  handleUpload(uploadLoteFoto.single("foto")),   ctrl.uploadLoteFoto);

module.exports = router;
