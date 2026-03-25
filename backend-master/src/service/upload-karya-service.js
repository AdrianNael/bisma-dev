import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseDir = path.join(process.cwd(), 'documents', 'karya');

const listFiles = (id, project, tanggal) => {
    return new Promise((resolve, reject) => {
        const directoryPath = baseDir;
        const filename = `${project}_${tanggal}_${id}_karya`;
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                return reject(err);
            }
            const matchingFiles = files.filter(file => file.startsWith(filename));
            resolve(matchingFiles);
        });
    });
};

const getFilePath = (userId, project, tanggal) => {
    const basePath = path.join(process.cwd(), 'documents', 'karya');
    const formattedTanggal = new Date(tanggal).toISOString().split('T')[0];
    const directoryPath = path.join(basePath, `${project}_${formattedTanggal}_${userId}_karya`);

    // Pastikan direktori ada
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    return directoryPath;
};

  

const deleteFile = (id, project, tanggal) => {
    return new Promise((resolve, reject) => {
        const filepath = getFilePath(id, project, tanggal);
        fs.unlink(filepath, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

export default {
    listFiles
    , getFilePath
    , deleteFile
}