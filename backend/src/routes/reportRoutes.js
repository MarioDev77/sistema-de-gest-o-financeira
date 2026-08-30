const express = require('express');
const { salesReportPdf, expensesReportPdf, cashFlowReportPdf, loansReportPdf } = require('../controllers/reportPdfController');
const { exportExcel } = require('../controllers/reportExcelController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/pdf/vendas', salesReportPdf);
router.get('/pdf/despesas', expensesReportPdf);
router.get('/pdf/fluxo-caixa', cashFlowReportPdf);
router.get('/pdf/emprestimos', loansReportPdf);
router.get('/excel', exportExcel);

module.exports = router;
