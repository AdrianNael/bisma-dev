import approvalAdmin from "../service/approval-admin-service.js";


const approveController = async (req, res) => {
    const { projectId } = req.params;
    try {
      await approvalAdmin.approveService(projectId);
      res.status(200).json({ success: true, message: "Project berhasil disetujui" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  const rejectController = async (req, res) => {
    const { projectId } = req.params;
    const data = req.body;
    data.projectId = projectId;
    try {
      await approvalAdmin.rejectService(data);
      res.status(200).json({ success: true, message: "Project berhasil ditolak" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };


export default{
    approveController,
    rejectController
}