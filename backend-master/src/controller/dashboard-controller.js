import dashboardService from "../service/dashboard-service.js";
import { ResponseError } from "../error/response-error.js";

const totalExpense = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw new ResponseError(400, "User ID is required");

    const total_estimasi = await dashboardService.getTotalEstimasiByUser(userId);

    return res.status(200).json({
      success: true,
      data: { id_user: userId, total_estimasi },
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    // Log detailed error for debugging
    console.error('monthlyExpenses error:', e && e.stack ? e.stack : e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const summary = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw new ResponseError(400, "User ID is required");

    const total_estimasi = await dashboardService.getTotalEstimasiByUser(userId);
    const counts = await dashboardService.getProjectCountsByUser(userId);

    return res.status(200).json({
      success: true,
      data: {
        id_user: userId,
        total_estimasi,
        finished_projects: counts.finished,
        approved_projects: counts.approved,
        waiting_payment: counts.waitingPayment,
      },
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const monthlyExpenses = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw new ResponseError(400, "User ID is required");

    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const result = await dashboardService.getMonthlyExpensesByUser(userId, year);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const availableYears = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw new ResponseError(400, "User ID is required");

    const years = await dashboardService.getAvailableYearsByUser(userId);

    return res.status(200).json({
      success: true,
      data: { years },
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const globalSummary = async (req, res) => {
  try {
    const total_estimasi = await dashboardService.getTotalEstimasiGlobal();
    const counts = await dashboardService.getProjectCountsGlobal();

    return res.status(200).json({
      success: true,
      data: {
        total_estimasi,
        finished_projects: counts.finished,
        approved_projects: counts.approved,
        waiting_payment: counts.waitingPayment,
      },
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const globalMonthlyExpenses = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const result = await dashboardService.getMonthlyExpensesGlobal(year);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const globalAvailableYears = async (req, res) => {
  try {
    const years = await dashboardService.getAvailableYearsGlobal();

    return res.status(200).json({
      success: true,
      data: { years },
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const kategoriMagangStats = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const result = await dashboardService.getKategoriMagangStats(year);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    if (e instanceof ResponseError) return res.status(e.status).json({ success: false, message: e.message });
    console.error(e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default {
  totalExpense,
  summary,
  monthlyExpenses,
  availableYears,
  globalSummary,
  globalMonthlyExpenses,
  globalAvailableYears,
  kategoriMagangStats,
};
