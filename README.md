# Amatu Docs

Pengolah dokumen di browser — https://liemyo.github.io/docs/

Menggabungkan alur kerja Google Docs (menu, toolbar, komentar, mode menyarankan, histori versi, smart chip, garis besar) dengan fitur Microsoft Word (gaya paragraf yang dapat diubah, border & bayangan, drop cap, kolom, watermark, garis tepi halaman, kutipan & daftar pustaka, penggaris, mode baca, status bar).

## Fitur utama

- Halaman nyata (A4, Letter, F4, Legal, A3, A5, B5, …) dengan margin, orientasi, header/footer, nomor halaman, catatan kaki, dan format tanpa halaman
- Format teks & paragraf lengkap, 36 font, gaya paragraf (Judul, Heading 1–6, Kutipan, Kode) yang dapat diubah dan disimpan sebagai default
- Tabel (gabung/pisah sel, ubah lebar kolom, urutkan, warna sel, properti), gambar (unggah/URL/kamera, ubah ukuran, bungkus teks), gambar bebas, diagram, persamaan LaTeX, karakter khusus, daftar isi otomatis, bookmark, tautan
- Komentar dengan balasan, mode menyarankan (track changes) dengan terima/tolak, histori versi dengan pratinjau & pemulihan
- Cari & ganti (huruf besar/kecil, kata utuh, regex), jumlah kata, ketik dengan suara, telusuri menu, pemformatan otomatis Markdown
- Ekspor .docx (gaya, daftar, tabel, gambar, catatan kaki, komentar, track changes, header/footer), PDF (cetak presisi per halaman), HTML, Markdown, TXT, cadangan JSON; impor .docx/.html/.md/.txt
- Tautan berbagi (isi dokumen dikemas di dalam tautan), tema terang/gelap, 9 warna aksen, material liquid glass / kaca buram / solid

Semua dokumen tersimpan di IndexedDB perangkat — tidak ada server.

## Struktur

Vanilla ES modules tanpa build step: `index.html`, `css/app.css` (antarmuka & tema), `css/doc.css` (isi dokumen), `js/*.js` (editor, paginasi, fitur, ekspor).
