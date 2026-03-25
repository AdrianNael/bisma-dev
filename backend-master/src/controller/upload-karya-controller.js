import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import moment from 'moment';

// Allowed file extensions whitelist
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.mp3', '.mp4', 'moi'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Validate file extension
const isAllowedFileType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
};

// Sanitize filename to prevent path traversal
const sanitizeFileName = (filename) => {
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
};

const uploadFileController = async (req, res) => {
    const { project, tanggal, userId } = req.params;

    // Sanitize input parameters
    const safeProject = sanitizeFileName(project);
    const safeUserId = sanitizeFileName(userId);

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    const parsedDate = moment(tanggal, moment.ISO_8601, true);

    if (!parsedDate.isValid()) {
        return res.status(400).json({ message: 'Format tanggal tidak valid' });
    }

    const formattedDate = parsedDate.format('YYYY-MM-DD');
    const uploadedFiles = [];

    const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];

    // Validate all files before processing
    for (const file of files) {
        if (!isAllowedFileType(file.name)) {
            return res.status(400).json({
                message: `Tipe file tidak diizinkan: ${path.extname(file.name)}. Tipe yang diizinkan: ${ALLOWED_EXTENSIONS.join(', ')}`
            });
        }
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                message: `Ukuran file terlalu besar. Maksimum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
            });
        }
    }

    const uploadPromises = files.map(file => {
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            const ext = path.extname(file.name).toLowerCase();
            const fileName = `${safeProject}_${formattedDate}_${safeUserId}_${timestamp}${ext}`;
            const targetPath = path.join(process.cwd(), 'documents/karya', fileName);

            file.mv(targetPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    uploadedFiles.push(fileName);
                    resolve();
                }
            });
        });
    });

    try {
        await Promise.all(uploadPromises);
        return res.status(200).json({ message: 'File berhasil disimpan', files: uploadedFiles });
    } catch (error) {
        return res.status(500).json({ message: 'Gagal menyimpan file' });
    }
};

const listFilesController = async (req, res) => {
    const { project, tanggal, userId } = req.params;

    // Sanitize input parameters
    const safeProject = sanitizeFileName(project);
    const safeTanggal = sanitizeFileName(tanggal);
    const safeUserId = sanitizeFileName(userId);

    try {
        const filePath = path.join(process.cwd(), 'documents/karya');
        const files = await fs.readdir(filePath);

        const matchedFiles = files.filter(file => file.startsWith(`${safeProject}_${safeTanggal}_${safeUserId}`));

        if (matchedFiles.length > 0) {
            return res.status(200).json({ files: matchedFiles });
        } else {
            return res.status(404).json({ message: 'Tidak ada file yang ditemukan' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Gagal membaca direktori' });
    }
};

const downloadFileController = async (req, res) => {
    const { fileName } = req.params;

    // Sanitize filename to prevent path traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'documents/karya', safeFileName);

    try {
        await fs.access(filePath);
        res.download(filePath, safeFileName, (err) => {
            if (err && !res.headersSent) {
                return res.status(500).json({ message: 'Error selama proses download file' });
            }
        });
    } catch (error) {
        return res.status(404).json({ message: 'File tidak ditemukan.' });
    }
};

const deleteFileController = async (req, res) => {
    const { fileName } = req.params;

    // Sanitize filename to prevent path traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'documents/karya', safeFileName);

    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        return res.status(200).json({ message: 'File berhasil dihapus' });
    } catch (error) {
        return res.status(404).json({ message: 'File tidak ditemukan' });
    }
};

export default {
    uploadFileController
    , listFilesController
    , downloadFileController
    , deleteFileController
}