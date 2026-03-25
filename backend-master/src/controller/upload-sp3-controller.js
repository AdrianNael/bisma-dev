import multer from "multer";
import path from "path";
import tmstProjectService from "../service/tmst-project-service.js";

// PATCH /api/uploadSp3/:id/tempatMagang/force
const forceUpdateTempatMagang = async (req, res) => {
  const idProject = req.params.id;
  const { tempat_magang } = req.body;
  if (!tempat_magang) {
    return res.status(400).json({ message: 'Tempat magang wajib diisi' });
  }
  try {
    // Update langsung field tempat_magang tanpa validasi lain
    const updated = await import('../application/database.js').then(({ prismaClient }) =>
      prismaClient.tmst_project.update({
        where: { id: Number(idProject) },
        data: { tempat_magang }
      })
    );
    return res.status(200).json({ message: 'Tempat magang berhasil disimpan', tempat_magang: updated.tempat_magang });
  } catch (e) {
    console.error('[DEBUG] FORCE PATCH tempat_magang ERROR', e, e?.stack);
    return res.status(500).json({ message: 'Gagal menyimpan tempat magang', error: e.message, stack: e?.stack });
  }
};
// PATCH /api/uploadSp3/:id/picJabatan/force
const forceUpdatePicJabatan = async (req, res) => {
  const idProject = req.params.id;
  const { pic_jabatan } = req.body;
  if (!pic_jabatan) {
    return res.status(400).json({ message: 'Jabatan wajib diisi' });
  }
  try {
    const updated = await import('../application/database.js').then(({ prismaClient }) =>
      prismaClient.tmst_project.update({
        where: { id: Number(idProject) },
        data: { pic_jabatan }
      })
    );
    return res.status(200).json({ message: 'Jabatan berhasil disimpan', pic_jabatan: updated.pic_jabatan });
  } catch (e) {
    console.error('[DEBUG] FORCE PATCH pic_jabatan ERROR', e, e?.stack);
    return res.status(500).json({ message: 'Gagal menyimpan jabatan', error: e.message, stack: e?.stack });
  }
};
// PATCH /api/uploadSp3/:id/tempatMagang
const updateTempatMagang = async (req, res) => {
  const idProject = req.params.id;
  const { tempat_magang } = req.body;
  if (!tempat_magang) {
    return res.status(400).json({ message: 'Tempat magang wajib diisi' });
  }
  try {
    // Ambil data project lama
    const oldData = await tmstProjectService.select(idProject);
    // Merge dengan tempat_magang baru
    // Helper untuk konversi dd/MM/yyyy ke yyyy-MM-dd
    function parseDate(str) {
      if (!str) return undefined;
      if (typeof str === 'string' && str.includes('/')) {
        const [d, m, y] = str.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return str;
    }
    const updateData = {
      id_kategori: oldData.kategoriId || oldData.id_kategori,
      nama: oldData.nama,
      pic: oldData.picId || oldData.pic,
      tanggal_mulai: parseDate(oldData.tanggal_mulai),
      tanggal_selesai: parseDate(oldData.tanggal_selesai),
      created_by: oldData.created_by || oldData.picId || oldData.pic,
      kriteria: oldData.kriteria,
      kuota: oldData.kuota,
      pendaftaran_mulai: parseDate(oldData.pendaftaran_mulai),
      pendaftaran_selesai: parseDate(oldData.pendaftaran_selesai),
      status: oldData.status,
      durasi_per_mahasiswa: oldData.durasi_default,
      tempat_magang: tempat_magang
    };
    console.log('[DEBUG] PATCH tempat_magang', { idProject, updateData });
    await tmstProjectService.update(updateData, idProject);
    return res.status(200).json({ message: 'Tempat magang berhasil disimpan' });
  } catch (e) {
    console.error('[DEBUG] PATCH tempat_magang ERROR', e, e?.stack);
    return res.status(500).json({ message: 'Gagal menyimpan tempat magang', error: e.message, stack: e?.stack });
  }
};

// PATCH /api/uploadSp3/:id/picJabatan
const updatePicJabatan = async (req, res) => {
  const idProject = req.params.id;
  const { pic_jabatan } = req.body;
  if (!pic_jabatan) {
    return res.status(400).json({ message: 'Jabatan wajib diisi' });
  }
  try {
    const oldData = await tmstProjectService.select(idProject);
    function parseDate(str) {
      if (!str) return undefined;
      if (typeof str === 'string' && str.includes('/')) {
        const [d, m, y] = str.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return str;
    }
    const updateData = {
      id_kategori: oldData.kategoriId || oldData.id_kategori,
      nama: oldData.nama,
      pic: oldData.picId || oldData.pic,
      tanggal_mulai: parseDate(oldData.tanggal_mulai),
      tanggal_selesai: parseDate(oldData.tanggal_selesai),
      created_by: oldData.created_by || oldData.picId || oldData.pic,
      kriteria: oldData.kriteria,
      kuota: oldData.kuota,
      pendaftaran_mulai: parseDate(oldData.pendaftaran_mulai),
      pendaftaran_selesai: parseDate(oldData.pendaftaran_selesai),
      status: oldData.status,
      durasi_per_mahasiswa: oldData.durasi_default,
      pic_jabatan: pic_jabatan
    };
    console.log('[DEBUG] PATCH pic_jabatan', { idProject, updateData });
    await tmstProjectService.update(updateData, idProject);
    return res.status(200).json({ message: 'Jabatan berhasil disimpan' });
  } catch (e) {
    console.error('[DEBUG] PATCH pic_jabatan ERROR', e, e?.stack);
    return res.status(500).json({ message: 'Gagal menyimpan jabatan', error: e.message, stack: e?.stack });
  }
};
// Konfigurasi multer untuk menyimpan file di direktori "uploads"
const storageConfig = (result) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "documents/sp3");
    },
    filename: (req, file, cb) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const formattedDate = `${year}${String(month).padStart(2, "0")}`;

      const safeFileName = result.inisial_project + "_" + formattedDate + "_" + "sp3" + ".pdf";

      cb(null, safeFileName);
    },
  });
};

const controllerUploadSp3 = async (req, res, next) => {
  try {
    const idProject = req.params.id;
    const result = await tmstProjectService.select(idProject);
    const storage = storageConfig(result);

    const upload = multer({ storage: storage }).single("pdfFile");

    upload(req, res, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Terjadi kesalahan saat mengunggah file.");
      }
      res.json({ message: "File berhasil diupload!" });
    });
  } catch (e) {
    next(e);
  }
};

const uploadSp3 = async (req, res) => {
  const idProject = req.params.id;
  const date = req.params.date.replace('-', ''); 
  const result = await tmstProjectService.select(idProject);

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ message: 'Tidak ada file yang diupload' });
  }

  const uploadedFiles = [];

  const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];

  files.forEach(file => {
    const ext = path.extname(file.name);
    const fileName = `${result.inisial_project}_${date}_sp3${ext}`;
    const targetPath = path.join(process.cwd(), 'documents/sp3', fileName);

    file.mv(targetPath, (err) => {
      if (err) {
        console.error('Error saving file:', err); 
        return res.status(500).json({ message: 'Gagal menyimpan file', error: err });
      }
    });

    uploadedFiles.push(fileName);
  });

  return res.status(200).json({ message: 'Files berhasil disimpan', files: uploadedFiles });
};


export default {
  controllerUploadSp3,
  uploadSp3,
  updateTempatMagang,
  forceUpdateTempatMagang,
  updatePicJabatan,
  forceUpdatePicJabatan
};
