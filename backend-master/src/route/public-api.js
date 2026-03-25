import express from "express";
import multer from 'multer';
import userController from "../controller/user-controller.js";
import lowonganController from "../controller/lowongan-controller.js";
import mahasiswaController from "../controller/mahasiswa-controller.js";
import UploadController from '../controller/upload-karya-controller.js';
import tmstInternCategoryController from "../controller/tmst-internCategory-controller.js";
import tmstIncentiveUnitController from "../controller/tmst-incentiveUnit-controller.js";
import tranIncentiveController from "../controller/tran-incentive-controller.js";
import tmstUserController from "../controller/tmst-user-controller.js";
import tmstProjectController from "../controller/tmst-project-controller.js";
import dashboardController from "../controller/dashboard-controller.js";
import tranProjectController from "../controller/tran-project-controller.js";
import tranTimesheetController from "../controller/tran-timesheet-controller.js";
import tmstActivityCategoryController from "../controller/tmst-activity-category-controller.js";
import tmstPaymentStatusController from "../controller/tmst-payment-status-controller.js";
import tmstStatusTimesheetController from "../controller/tmst-timesheet-status-controller.js";
import tmstPositionController from "../controller/tmst-position-controller.js";
import tranUserPositionController from "../controller/tran-user-position-controller.js";
import tranPaymentController from "../controller/tran-payment-controller.js";
import uploadSp3Controller from "../controller/upload-sp3-controller.js";
import projectHistoryController from "../controller/project-history-controller.js";
import timesheetHistoryController from "../controller/timesheet-history-controller.js";
import paymentHistoryController from "../controller/payment-history-controller.js";
import stafController from '../controller/staf-controller.js';
import tmstDepartmentController from "../controller/tmst-department-controller.js";
import tmstFacultyController from "../controller/tmst-faculty-controller.js";
import approvalAdminController from "../controller/approval-admin-controller.js";
import signatureController from "../controller/signature-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { requireRole, requireOwnerOrAdmin, ROLES } from "../middleware/role-middleware.js";

const publicRouter = new express.Router();

publicRouter.get("/", function (req, res) {
  res.status(200).json({
    message: "Application Programming Interface of BISMA Apps v.1.0.0",
  });
});

publicRouter.post("/api/users/register", userController.register);
publicRouter.post("/api/users/login", userController.login);

// Intern Category API
publicRouter.post("/api/internCategory", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstInternCategoryController.create);
publicRouter.put("/api/internCategory/:categoryId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstInternCategoryController.update);
publicRouter.delete("/api/internCategory/:categoryId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), tmstInternCategoryController.remove);
publicRouter.get("/api/internCategory", tmstInternCategoryController.list);
publicRouter.get("/api/internCategory/:categoryId", tmstInternCategoryController.select);

// Intern Unit API
publicRouter.post("/api/incentiveUnit", tmstIncentiveUnitController.create);
publicRouter.get("/api/incentiveUnit", tmstIncentiveUnitController.list);
publicRouter.put("/api/incentiveUnit/:unitId", tmstIncentiveUnitController.update);
publicRouter.delete("/api/incentiveUnit/:unitId", tmstIncentiveUnitController.remove);

// Incentive API
publicRouter.post("/api/incentive", tranIncentiveController.create);
publicRouter.get("/api/incentive", tranIncentiveController.list);
publicRouter.get("/api/incentive/get", tranIncentiveController.read);
publicRouter.put("/api/incentive/update/:incentiveId", tranIncentiveController.update);
publicRouter.delete("/api/incentive/:incentiveId", tranIncentiveController.remove);
publicRouter.get("/api/incentive/:incentiveId", tranIncentiveController.select);
publicRouter.get("/api/incentive/project/:projectId", tranIncentiveController.getProject);

// tmst_pengguna
publicRouter.post("/api/masterUser", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), tmstUserController.create);
publicRouter.delete("/api/masterUser/:userId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), tmstUserController.remove);
publicRouter.get("/api/masterUser", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstUserController.list);
publicRouter.put("/api/masterUser/:userId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), tmstUserController.update);
publicRouter.get("/api/masterUser/showPic", tmstUserController.showPic);

// tmst_project
publicRouter.post("/api/masterProject", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.create);
publicRouter.get("/api/masterProject/myproject/:userId", tmstProjectController.getMyProject);
publicRouter.delete("/api/masterProject/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.remove);
publicRouter.get("/api/masterProject", tmstProjectController.list);
publicRouter.get("/api/masterProject/show/:userId", tmstProjectController.showAvailableStudent);
publicRouter.get("/api/masterProject/:projectId", tmstProjectController.select);
publicRouter.put("/api/masterProject/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.update);
publicRouter.get("/api/masterProject/timesheet/:userId", tmstProjectController.get);
publicRouter.get("/api/masterProject/timesheet/edit/:userId", tmstProjectController.getEdit);
publicRouter.put("/api/masterProject/:projectId/submit", tmstProjectController.submitForApproval);
publicRouter.put("/api/masterProject/:projectId/complete", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.complete);
publicRouter.put("/api/masterProject/:projectId/approve-timesheets", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.approveTimesheets);
publicRouter.put("/api/masterProject/:projectId/approve-student/:userId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.approveStudentTimesheets);
publicRouter.put("/api/masterProject/:projectId/revise-student/:userId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.reviseStudentTimesheets);
publicRouter.get("/api/masterProject/:projectId/has-approved-timesheets", tmstProjectController.hasApprovedTimesheets);

// tran_project
publicRouter.post("/api/project", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranProjectController.create);
publicRouter.delete("/api/project/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranProjectController.remove);
publicRouter.get("/api/project", tranProjectController.list);
publicRouter.get("/api/project/timesheet", tranProjectController.get);
publicRouter.get("/api/project/user/:userId", tranProjectController.detailAvailableStudent);
publicRouter.get("/api/getDataPdfRecap", tranProjectController.generatePdf);
publicRouter.get("/api/generatePdfRecap", tranProjectController.recapPdf);
publicRouter.get("/api/getUserRecap", tranProjectController.userRecapPdf);
publicRouter.get("/api/generateUserRecap", tranProjectController.userRecapPdf);
publicRouter.get("/api/myproject/recap-pdf", tranProjectController.myProjectRecapPdf);
publicRouter.get("/api/project/recap-pdf", tranProjectController.projectRecapPdf);
publicRouter.put("/api/project/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranProjectController.update);
publicRouter.get("/api/project/:projectId", tranProjectController.getOne);
publicRouter.delete("/api/project/deleteMany/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranProjectController.removeMany);
publicRouter.patch("/api/project/markReviewed", tranProjectController.markAsReviewed);

// tran_timesheet
publicRouter.post("/api/timesheet", tranTimesheetController.create);
publicRouter.post("/api/timesheet/update", tranTimesheetController.createUpdate);
publicRouter.delete("/api/timesheet/:timesheetId", tranTimesheetController.remove);
publicRouter.delete("/api/timesheet/deleteMany/:projectId", tranTimesheetController.deleteMany);
publicRouter.get("/api/timesheet", tranTimesheetController.list);
publicRouter.put("/api/timesheet/:timesheetId", tranTimesheetController.update);
publicRouter.put("/api/tran-timesheet/status/:userId/:month/:year", tranTimesheetController.updateStatus);
publicRouter.get("/api/timesheet/show", tranTimesheetController.show);
publicRouter.get("/api/timesheet/getEdit/:projectId", tranTimesheetController.getEdit);
publicRouter.get("/api/timesheet/getOneShow/:userId", tranTimesheetController.getOneShow);
publicRouter.get("/api/timesheet/edit/:timesheetId", tranTimesheetController.showEdit);
publicRouter.get("/api/availableStudent", tranTimesheetController.availableStudent);
publicRouter.get("/api/availableStudent/:userId", tranTimesheetController.selectAvailable);
publicRouter.get("/api/checkAvailable", tranTimesheetController.checkAvailable);
publicRouter.get("/api/getDataPdfTimesheet", tranTimesheetController.generatePdf);
publicRouter.get("/api/generatePdfTimesheet", tranTimesheetController.generatePdfTimesheet);
publicRouter.get("/api/generateAllPdf", tranTimesheetController.getAllPdf);
publicRouter.get("/api/timesheet/submitPayment", tranTimesheetController.submitPayment);
publicRouter.get("/api/timesheet/submitPayment/get", tranTimesheetController.getSubmitPayment);
publicRouter.get("/api/timesheet/myproject/get/:userId", tranTimesheetController.getSubmitPayment);
publicRouter.get("/api/timesheet/karya-info/:tranProjectId", tranTimesheetController.getKaryaInfo);

// tmst_kategori_kegiatan
publicRouter.post("/api/activity", tmstActivityCategoryController.create);
publicRouter.delete("/api/activity/:activityId", tmstActivityCategoryController.remove);
publicRouter.get("/api/activity", tmstActivityCategoryController.list);
publicRouter.put("/api/activity/:activityId", tmstActivityCategoryController.update);

// tmst_status_pembayaran
publicRouter.post("/api/paymentStatus", tmstPaymentStatusController.create);
publicRouter.delete("/api/paymentStatus/:statusId", tmstPaymentStatusController.remove);
publicRouter.get("/api/paymentStatus", tmstPaymentStatusController.list);
publicRouter.put("/api/paymentStatus/:statusId", tmstPaymentStatusController.update);

// tmst_status_timesheet
publicRouter.post("/api/timesheetStatus", tmstStatusTimesheetController.create);
publicRouter.delete("/api/timesheetStatus/:statusId", tmstStatusTimesheetController.remove);
publicRouter.get("/api/timesheetStatus", tmstStatusTimesheetController.list);
publicRouter.put("/api/timesheetStatus/:statusId", tmstStatusTimesheetController.update);

// tmst_positions
publicRouter.post("/api/positions", tmstPositionController.create);
publicRouter.delete("/api/positions/:positionId", tmstPositionController.remove);
publicRouter.get("/api/positions", tmstPositionController.list);
publicRouter.get("/api/positions/:id", tmstPositionController.getOneData);
publicRouter.put("/api/positions/:positionId", tmstPositionController.update);

// tran_user_position
publicRouter.post("/api/usersPosition", tranUserPositionController.create);
publicRouter.delete("/api/usersPosition/:userId", tranUserPositionController.remove);
publicRouter.get("/api/usersPosition", tranUserPositionController.list);
publicRouter.put("/api/usersPosition/:userId", tranUserPositionController.update);

// tran_payment
publicRouter.post("/api/payments", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranPaymentController.create);
publicRouter.get("/api/payments", tranPaymentController.list);
publicRouter.get("/api/payments/listAdmin/:status", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranPaymentController.list_admin);
publicRouter.get("/api/payments/showSp3", tranPaymentController.showSp3);
publicRouter.get("/api/payments/listAdmin/detail/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranPaymentController.detail_payment);
publicRouter.put("/api/payments/updateStatus", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranPaymentController.updatePaymentStatus);
publicRouter.delete("/api/payments/:paymentId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), tranPaymentController.remove);
publicRouter.put("/api/payments/:paymentId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tranPaymentController.update);

// project_status_history
publicRouter.post("/api/projectHistory", projectHistoryController.upsert);
publicRouter.delete("/api/projectHistory/:statusId", projectHistoryController.remove);
publicRouter.get("/api/projectHistory", projectHistoryController.list);
publicRouter.put("/api/projectHistory/:statusId", projectHistoryController.update);

// timesheet_status_history
publicRouter.post("/api/timesheetHistory", timesheetHistoryController.upsert);
publicRouter.delete("/api/timesheetHistory/:statusId", timesheetHistoryController.remove);
publicRouter.get("/api/timesheetHistory", timesheetHistoryController.list);
publicRouter.put("/api/timesheetHistory/:statusId", timesheetHistoryController.update);

// payment_status_history
publicRouter.post("/api/paymentHistory", paymentHistoryController.upsert);
publicRouter.delete("/api/paymentHistory/:statusId", paymentHistoryController.remove);
publicRouter.get("/api/paymentHistory", paymentHistoryController.list);
publicRouter.put("/api/paymentHistory/:statusId", paymentHistoryController.update);

//upload
publicRouter.post("/api/uploadSp3/:id/:date", uploadSp3Controller.uploadSp3);
publicRouter.patch("/api/uploadSp3/:id/tempatMagang", uploadSp3Controller.updateTempatMagang);
publicRouter.patch("/api/uploadSp3/:id/tempatMagang/force", uploadSp3Controller.forceUpdateTempatMagang);
publicRouter.patch("/api/uploadSp3/:id/picJabatan", uploadSp3Controller.updatePicJabatan);
publicRouter.patch("/api/uploadSp3/:id/picJabatan/force", uploadSp3Controller.forceUpdatePicJabatan);
publicRouter.post('/api/uploadKarya/upload/:userId/:project/:tanggal', UploadController.uploadFileController);
publicRouter.get('/api/uploadKarya/:userId/:project/:tanggal', UploadController.listFilesController);
publicRouter.get('/api/uploadKarya/download/:fileName', UploadController.downloadFileController);
publicRouter.delete('/api/uploadKarya/delete/:fileName', UploadController.deleteFileController);


// user Staf
publicRouter.get('/api/staf/get', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), stafController.getStaf);
publicRouter.post('/api/staf/create', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), stafController.createStaf);
publicRouter.get('/api/staf/:username', requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), stafController.getOneStaf);
publicRouter.delete('/api/staf/:username', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), stafController.deleteOneStaf);
publicRouter.patch('/api/staf/update/:username', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), stafController.updateStafController);
publicRouter.get('/api/masterProject/:projectId/applicants', requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), tmstProjectController.getApplicants);
publicRouter.post('/api/applications/:applicationId/select', requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), lowonganController.selectApplicant);
// Dashboard
publicRouter.get('/api/dashboard/total-expense/:userId', dashboardController.totalExpense);
publicRouter.get('/api/dashboard/summary/:userId', dashboardController.summary);
publicRouter.get('/api/dashboard/monthly-expenses/:userId', dashboardController.monthlyExpenses);
publicRouter.get('/api/dashboard/available-years/:userId', dashboardController.availableYears);
// Global Dashboard (all users)
publicRouter.get('/api/dashboard/global/summary', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), dashboardController.globalSummary);
publicRouter.get('/api/dashboard/global/monthly-expenses', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), dashboardController.globalMonthlyExpenses);
publicRouter.get('/api/dashboard/global/available-years', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), dashboardController.globalAvailableYears);
publicRouter.get('/api/dashboard/global/kategori-magang-stats', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), dashboardController.kategoriMagangStats);
publicRouter.put("/api/projects/:id/approve", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), approvalAdminController.approveController);
publicRouter.put("/api/projects/:id/reject", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), approvalAdminController.rejectController);

// user Mahasiswa
publicRouter.get('/api/mahasiswa/get', requireRole([ROLES.MANAGER, ROLES.DIRMAWA, ROLES.STAF]), mahasiswaController.getMahasiswa);
publicRouter.get('/api/mahasiswa/project-counts', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), mahasiswaController.getStudentProjectCounts);
publicRouter.post('/api/mahasiswa/create', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), mahasiswaController.createMahasiswa);
publicRouter.get('/api/mahasiswa/quota', mahasiswaController.getMonthlyQuota);
publicRouter.get('/api/mahasiswa/applications', mahasiswaController.getApplicationHistory);
publicRouter.get('/api/mahasiswa/:username', mahasiswaController.getOneMahasiswa);
publicRouter.delete('/api/mahasiswa/:username', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), mahasiswaController.deleteOneMahasiswa);
publicRouter.patch('/api/mahasiswa/update/:username', requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), mahasiswaController.updateMahasiswaController);
publicRouter.get('/api/lowongan', lowonganController.getAvailableJobs);
publicRouter.post('/api/lowongan/:projectId/apply', lowonganController.applyJob);

// tmst_department
publicRouter.post("/api/department", tmstDepartmentController.create);
publicRouter.delete("/api/department/:departmentId", tmstDepartmentController.remove);
publicRouter.get("/api/department", tmstDepartmentController.list);
publicRouter.get("/api/department/:id", tmstDepartmentController.getOneData);
publicRouter.put("/api/department/:departmentId", tmstDepartmentController.update);

// tmst_faculty
publicRouter.post("/api/faculty", tmstFacultyController.create);
publicRouter.delete("/api/faculty/:facultyId", tmstFacultyController.remove);
publicRouter.get("/api/faculty", tmstFacultyController.list);
publicRouter.get("/api/faculty/:id", tmstFacultyController.getOneData);
publicRouter.put("/api/faculty/:facultyId", tmstFacultyController.update);


// Approval admin (MANAGER)
publicRouter.post("/api/approvalAdmin/approve/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), approvalAdminController.approveController);
publicRouter.post("/api/approvalAdmin/reject/:projectId", requireRole([ROLES.MANAGER, ROLES.DIRMAWA]), approvalAdminController.rejectController);

// signatures
publicRouter.post("/api/signature/student", signatureController.saveStudentSignature);
publicRouter.get("/api/signature/student/:userId", signatureController.getStudentSignature);
publicRouter.delete("/api/signature/student/:userId", signatureController.deleteStudentSignature);
publicRouter.post("/api/signature/lecturer", signatureController.saveLecturerSignature);
publicRouter.get("/api/signature/lecturer/resolved", signatureController.getResolvedLecturerSignature);
publicRouter.get("/api/signature/lecturer/:key", signatureController.getLecturerSignature);

// jabatan (position/title for lecturer)
publicRouter.post("/api/signature/jabatan", signatureController.saveLecturerJabatan);
publicRouter.get("/api/signature/jabatan/:key", signatureController.getLecturerJabatan);


export { publicRouter };
