const router = require("express").Router();
const multer = require("multer");
const ctrl   = require("../controllers/uploads.controller");

const upload       = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/baucher", upload.single("baucher"),             ctrl.uploadBaucher);
router.post("/avatar",  uploadAvatar.single("avatar"),        ctrl.uploadAvatar);

module.exports = router;
