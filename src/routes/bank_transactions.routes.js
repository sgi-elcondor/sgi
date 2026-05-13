const router = require('express').Router();
const ctrl   = require('../controllers/bank_transactions.controller');

router.get('/',          ctrl.getAll);
router.post('/batch',    ctrl.createBatch);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

module.exports = router;