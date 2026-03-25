-- Update tanggal project id=3 ke tahun 2026
UPDATE tmst_project 
SET tanggal_mulai = '2026-01-01', 
    tanggal_selesai = '2026-12-31'
WHERE id = 3;

-- Atau jika ingin tanggal yang lebih spesifik seperti di screenshot:
UPDATE tmst_project 
SET tanggal_mulai = '2026-01-25', 
    tanggal_selesai = '2026-01-25'
WHERE id = 3;

-- Cek hasil update
SELECT id, nama, tanggal_mulai, tanggal_selesai 
FROM tmst_project 
WHERE id = 3;
