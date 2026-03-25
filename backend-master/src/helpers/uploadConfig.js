import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Definisikan path untuk menyimpan file
const storagePath = path.join(process.cwd(), 'documents', 'karya');
console.log('Storage Path:', storagePath);

if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        cb(null, storagePath);
    },
    filename: (req, file, cb) => {
        const project = req.params.project;
        const tanggalRaw = req.params.tanggal;
        const userId = req.params.userId;

        // Ubah format tanggal menjadi 'YYYY-MM-DD' jika formatnya tidak sesuai
        const tanggal = new Date(tanggalRaw).toISOString().split('T')[0];
        
        console.log('Project:', project);
        console.log('Tanggal:', tanggal);
        console.log('User ID:', userId);

        const extension = path.extname(file.originalname);
        const newFilename = `${project}_${tanggal}_${userId}_karya${extension}`;
        console.log('New Filename:', newFilename);

        cb(null, newFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas ukuran file 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only JPEG, PNG images, and PDF files are allowed.'));
        }
        cb(null, true);
    }
}).array('file');

export default upload;
