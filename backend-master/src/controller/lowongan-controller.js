import { logger } from "../application/logging.js";
import lowonganService from "../service/lowongan-service.js";

const getAvailableJobs = async (req, res, next) => {
  try {
    const mahasiswaId = req.user?.id || null;          
    const result = await lowonganService.getAvailableJobs(mahasiswaId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data lowongan berhasil diambil.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) { next(e); }
};

const getJobDetail = async (req, res, next) => {
  try {
    const jobId = req.params.jobId;
    const mahasiswaId = req.user?.id || null;        
    const result = await lowonganService.getJobDetail(jobId, mahasiswaId); 
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Detail lowongan berhasil diambil.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) { next(e); }
};

const applyJob = async (req, res, next) => {
  try {
    const rawJobId =
      req.params.jobId ??
      req.params.id ??
      req.params.projectId ??
      req.body?.jobId ??
      req.query?.jobId;

    const mahasiswaId = req.user.id;
    const jobIdNum = Number(rawJobId);

    if (!Number.isInteger(jobIdNum)) {
      return res.status(400).json({ message: "Job ID tidak valid" });
    }

    const result = await lowonganService.applyJob(jobIdNum, mahasiswaId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Lamaran berhasil dikirim.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};


const getMyApplications = async (req, res, next) => {
  try {
    const mahasiswaId = req.user.id; 
    const result = await lowonganService.getMyApplications(mahasiswaId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data lamaran berhasil diambil.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const selectApplicant = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body; 

    if (!status) {
      return res.status(400).json({ message: "Status (Accepted/Rejected) must be provided." });
    }

    const result = await lowonganService.selectApplicant(applicationId, status);
    
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Status lamaran berhasil diperbarui.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

  
export default {
  getAvailableJobs,
  getJobDetail,
  applyJob,
  getMyApplications,
  selectApplicant
};