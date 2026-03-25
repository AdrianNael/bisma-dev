import fs from "fs";
import path from "path";
import crypto from "crypto";

const baseDir = path.join(process.cwd(), "documents", "signatures");
const studentDir = path.join(baseDir, "student");
const lecturerDir = path.join(baseDir, "lecturer");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[-+\w.]+);base64,(.*)$/i);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function imageFileToDataUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const b64 = fs.readFileSync(filePath).toString("base64");
  // try to guess mime from extension
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${b64}`;
}

function encryptFileName(identifier) {
  return crypto.createHash('sha256').update(identifier).digest('hex');
}

function findSignatureFileInDir(dir, baseName) {
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  for (const ext of exts) {
    const p = path.join(dir, `${baseName}.${ext}`);
    try {
      if (fs.existsSync(p)) {
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
        return { path: p, mime, ext };
      }
    } catch (e) { }
  }
  return null;
}

const saveStudentSignature = async (req, res, next) => {
  try {
    const { userId, dataUrl } = req.body || {};
    if (!userId || !dataUrl) {
      return res.status(400).json({ message: "userId dan dataUrl wajib diisi" });
    }
    ensureDir(studentDir);
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ message: "Format dataUrl tidak valid" });
    const { mime, base64 } = parsed;
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const encryptedFileName = encryptFileName(userId);
    const filePath = path.join(studentDir, `${encryptedFileName}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    const url = imageFileToDataUrl(filePath);
    // remove other ext variants to keep single canonical file
    try {
      const others = ['png', 'jpg', 'jpeg', 'webp'].filter(e => e !== ext);
      for (const o of others) {
        const p = path.join(studentDir, `${encryptedFileName}.${o}`);
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) { }
        }
      }
    } catch (e) { }
    return res.status(200).json({ success: true, url });
  } catch (e) {
    next(e);
  }
};

const getStudentSignature = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: "userId wajib diisi" });
    const encryptedFileName = encryptFileName(userId);
    const found = findSignatureFileInDir(studentDir, encryptedFileName);
    if (!found) return res.status(404).json({ message: "Signature tidak ditemukan" });
    const url = imageFileToDataUrl(found.path);
    return res.status(200).json({ success: true, url });
  } catch (e) {
    next(e);
  }
};

const deleteStudentSignature = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: "userId wajib diisi" });
    const encryptedFileName = encryptFileName(userId);
    const exts = ['png', 'jpg', 'jpeg', 'webp'];
    let deleted = false;
    for (const ext of exts) {
      const p = path.join(studentDir, `${encryptedFileName}.${ext}`);
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          deleted = true;
        }
      } catch (e) { }
    }
    if (!deleted) {
      return res.status(404).json({ message: "Signature tidak ditemukan" });
    }
    return res.status(200).json({ success: true, message: "Signature berhasil dihapus" });
  } catch (e) {
    next(e);
  }
};

const saveLecturerSignature = async (req, res, next) => {
  try {
    const { key, dataUrl } = req.body || {};
    if (!key || !dataUrl) {
      return res.status(400).json({ message: "key dan dataUrl wajib diisi" });
    }
    ensureDir(lecturerDir);
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ message: "Format dataUrl tidak valid" });
    const { mime, base64 } = parsed;
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const encryptedFileName = encryptFileName(key);
    const filePath = path.join(lecturerDir, `${encryptedFileName}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    const url = imageFileToDataUrl(filePath);
    // remove other ext variants to keep single canonical file
    try {
      const others = ['png', 'jpg', 'jpeg', 'webp'].filter(e => e !== ext);
      for (const o of others) {
        const p = path.join(lecturerDir, `${encryptedFileName}.${o}`);
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) { }
        }
      }
    } catch (e) { }
    return res.status(200).json({ success: true, url });
  } catch (e) {
    next(e);
  }
};

const getLecturerSignature = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).json({ message: "key wajib diisi" });
    const encryptedFileName = encryptFileName(key);
    const found = findSignatureFileInDir(lecturerDir, encryptedFileName);
    if (!found) return res.status(404).json({ message: "Signature tidak ditemukan" });
    const url = imageFileToDataUrl(found.path);
    return res.status(200).json({ success: true, url });
  } catch (e) {
    next(e);
  }
};

/**
 * Resolve the correct lecturer signature for a given student-project-month context.
 *
 * Priority (mirrors loadSignatures in tran-timesheet-controller):
 *   1. Frozen snapshot  – present when the student's status is Approved.
 *   2. Latest user_<picId> signature – shown for non-approved students.
 *
 * Query params: nim, project, month (1-12), picId
 */
const getResolvedLecturerSignature = async (req, res, next) => {
  try {
    const { nim, project, month, picId } = req.query;
    if (!nim || !project || !month) {
      return res.status(400).json({ message: "nim, project, dan month wajib diisi" });
    }

    const _sanitize = (s) => (s || "").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthPadded = String(month).padStart(2, "0");

    // 1. Try frozen snapshot
    const frozenKey = `frozen_${_sanitize(project)}_${_sanitize(nim)}_${monthPadded}`;
    const frozenHash = encryptFileName(frozenKey);
    const frozenFile = findSignatureFileInDir(lecturerDir, frozenHash);
    if (frozenFile) {
      const url = imageFileToDataUrl(frozenFile.path);
      return res.status(200).json({ success: true, url, source: "frozen" });
    }

    // 2. Latest signature of the PIC
    if (picId) {
      const latestHash = encryptFileName(`user_${picId}`);
      const latestFile = findSignatureFileInDir(lecturerDir, latestHash);
      if (latestFile) {
        const url = imageFileToDataUrl(latestFile.path);
        return res.status(200).json({ success: true, url, source: "latest" });
      }
    }

    return res.status(404).json({ message: "Signature tidak ditemukan" });
  } catch (e) {
    next(e);
  }
};

// =====================================================
// JABATAN (Position/Title) Management
// =====================================================

const jabatanDir = path.join(baseDir, "jabatan");

const saveLecturerJabatan = async (req, res, next) => {
  try {
    const { key, jabatan } = req.body || {};
    if (!key) {
      return res.status(400).json({ message: "key wajib diisi" });
    }
    ensureDir(jabatanDir);
    const encryptedFileName = encryptFileName(key);
    const filePath = path.join(jabatanDir, `${encryptedFileName}.json`);
    const data = { jabatan: jabatan || "Dosen Pembimbing", updatedAt: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return res.status(200).json({ success: true, jabatan: data.jabatan });
  } catch (e) {
    next(e);
  }
};

const getLecturerJabatan = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).json({ message: "key wajib diisi" });
    ensureDir(jabatanDir);
    const encryptedFileName = encryptFileName(key);
    const filePath = path.join(jabatanDir, `${encryptedFileName}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ success: true, jabatan: null });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return res.status(200).json({ success: true, jabatan: data.jabatan || null });
  } catch (e) {
    next(e);
  }
};

export default {
  saveStudentSignature,
  getStudentSignature,
  deleteStudentSignature,
  saveLecturerSignature,
  getLecturerSignature,
  getResolvedLecturerSignature,
  saveLecturerJabatan,
  getLecturerJabatan,
};

