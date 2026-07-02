-- ============================================================
-- Seed Data: 15 transaksi dummy untuk testing dashboard
-- ============================================================

INSERT INTO transactions (wa_number, type, amount, category, description, transaction_date, raw_message) VALUES
-- Pemasukan (income)
('6281234567890', 'income',  5000000.00, 'gaji',       'Gaji bulanan Juni',              '2025-06-01', 'masuk 5jt gaji bulan juni'),
('6281234567890', 'income',   500000.00, 'lainnya',    'Transfer dari teman',            '2025-06-05', 'masuk 500rb transfer dari andi'),
('6281234567890', 'income',  1500000.00, 'lainnya',    'Bayaran freelance desain logo',  '2025-06-12', 'masuk 1.5jt bayaran freelance logo'),

-- Pengeluaran (expense)
('6281234567890', 'expense',   25000.00, 'makanan',    'Makan siang nasi padang',        '2025-06-02', 'keluar 25rb makan siang nasi padang'),
('6281234567890', 'expense',   15000.00, 'transport',  'Grab ke kantor',                 '2025-06-02', 'keluar 15rb grab ke kantor'),
('6281234567890', 'expense',   50000.00, 'makanan',    'Makan malam berdua',             '2025-06-03', 'keluar 50rb makan malam berdua'),
('6281234567890', 'expense',  350000.00, 'tagihan',    'Bayar listrik bulan Juni',       '2025-06-05', 'keluar 350rb bayar listrik'),
('6281234567890', 'expense',  150000.00, 'hiburan',    'Nonton bioskop + snack',         '2025-06-07', 'keluar 150rb nonton bioskop'),
('6281234567890', 'expense',   75000.00, 'kesehatan',  'Beli obat di apotek',            '2025-06-08', 'keluar 75rb beli obat'),
('6281234567890', 'expense',  200000.00, 'belanja',    'Belanja bulanan minimarket',     '2025-06-10', 'keluar 200rb belanja di indomaret'),
('6281234567890', 'expense',   30000.00, 'makanan',    'Kopi dan roti pagi',             '2025-06-11', 'keluar 30rb ngopi pagi'),
('6281234567890', 'expense',  100000.00, 'transport',  'Isi bensin motor',               '2025-06-13', 'keluar 100rb isi bensin'),
('6281234567890', 'expense',  500000.00, 'pendidikan', 'Beli buku pemrograman',          '2025-06-15', 'keluar 500rb beli buku programming'),
('6281234567890', 'expense',   45000.00, 'makanan',    'Makan siang ayam geprek',        '2025-06-16', 'keluar 45rb makan ayam geprek'),
('6281234567890', 'expense',  250000.00, 'tagihan',    'Bayar internet bulanan',         '2025-06-18', 'keluar 250rb bayar wifi');
