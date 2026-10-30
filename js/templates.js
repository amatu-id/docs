// Starter templates. Placeholders are in [brackets] so they are easy to spot and replace.

const today = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const nb = 'class="nb"';

export const TEMPLATES = [
  { id: 'blank', name: 'Dokumen kosong', cat: '', html: () => '<p><br></p>' },

  {
    id: 'letter', name: 'Surat resmi', cat: 'Kerja', sub: 'Kop perusahaan',
    styles: { normal: { font: 'Times New Roman', size: 12, lh: 1.15 } },
    page: { margins: { t: 2, b: 2.5, l: 3, r: 2.5 } },
    html: () => `
<table ${nb} style="width:100%"><colgroup><col style="width:16%"><col></colgroup><tbody><tr>
<td style="vertical-align:middle"><p style="text-align:center"><span style="font-family:Arial, Helvetica, sans-serif;font-size:26pt;font-weight:700;color:#1c4587">PT</span></p></td>
<td><p><span style="font-family:Arial, Helvetica, sans-serif;font-size:17pt;font-weight:700;color:#1c4587">PT [NAMA PERUSAHAAN]</span></p>
<p><span style="font-family:Arial, Helvetica, sans-serif;font-size:9pt;color:#434343">[Jalan Alamat Kantor No. 00], [Kota] [Kode Pos]</span></p>
<p><span style="font-family:Arial, Helvetica, sans-serif;font-size:9pt;color:#434343">Telp. (021) 000 0000 · surel@perusahaan.co.id · www.perusahaan.co.id</span></p></td>
</tr></tbody></table>
<hr style="border-top:2.5px double #1c4587">
<p style="text-align:right">[Kota], ${today()}</p>
<p><br></p>
<table ${nb} style="width:70%"><colgroup><col style="width:22%"><col style="width:4%"><col></colgroup><tbody>
<tr><td style="padding:1pt 0"><p>Nomor</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[001/ABC/X/${new Date().getFullYear()}]</p></td></tr>
<tr><td style="padding:1pt 0"><p>Lampiran</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>1 (satu) berkas</p></td></tr>
<tr><td style="padding:1pt 0"><p>Perihal</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p><b>[Perihal Surat]</b></p></td></tr>
</tbody></table>
<p><br></p>
<p>Kepada Yth.</p><p><b>[Nama Penerima]</b></p><p>[Jabatan Penerima]</p><p>[Nama Instansi]</p><p>di [Tempat]</p>
<p><br></p>
<p>Dengan hormat,</p>
<p style="text-align:justify;--sa:8pt">Sehubungan dengan [uraikan latar belakang atau rujukan surat], bersama surat ini kami sampaikan [maksud dan tujuan surat secara singkat dan jelas].</p>
<p style="text-align:justify;--sa:8pt">Adapun rincian yang perlu kami sampaikan adalah sebagai berikut. [Isi pokok surat dapat ditulis dalam beberapa paragraf. Gunakan bahasa yang sopan, ringkas, dan mudah dipahami.]</p>
<p style="text-align:justify;--sa:8pt">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.</p>
<p><br></p>
<table ${nb}><tbody><tr><td><p><br></p></td><td><p style="text-align:center">Hormat kami,</p><p style="text-align:center">PT [Nama Perusahaan]</p><p><br></p><p><br></p><p><br></p><p style="text-align:center"><b><u>[Nama Penanda Tangan]</u></b></p><p style="text-align:center">[Jabatan]</p></td></tr></tbody></table>
<p><br></p>
<p><span style="font-size:10pt">Tembusan:</span></p>
<ol><li><span style="font-size:10pt">[Pihak terkait 1]</span></li><li><span style="font-size:10pt">Arsip</span></li></ol>`,
  },

  {
    id: 'application', name: 'Surat lamaran kerja', cat: 'Pribadi', sub: 'Formal',
    styles: { normal: { font: 'Times New Roman', size: 12, lh: 1.15 } },
    page: { margins: { t: 2.5, b: 2.5, l: 3, r: 2.5 } },
    html: () => `
<p style="text-align:right">[Kota], ${today()}</p>
<p><br></p>
<p>Perihal: <b>Lamaran Pekerjaan sebagai [Posisi]</b></p>
<p><br></p>
<p>Kepada Yth.</p><p>Bagian Personalia / HRD</p><p>[Nama Perusahaan]</p><p>[Alamat Perusahaan]</p>
<p><br></p>
<p>Dengan hormat,</p>
<p style="text-align:justify;--sa:8pt">Berdasarkan informasi lowongan pekerjaan yang saya peroleh dari [sumber informasi] pada tanggal [tanggal], saya bermaksud mengajukan lamaran untuk posisi <b>[Posisi]</b> di perusahaan yang Bapak/Ibu pimpin. Berikut data diri saya:</p>
<table ${nb} style="width:85%;margin-left:36px"><colgroup><col style="width:34%"><col style="width:4%"><col></colgroup><tbody>
<tr><td style="padding:1pt 0"><p>Nama lengkap</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Nama Lengkap]</p></td></tr>
<tr><td style="padding:1pt 0"><p>Tempat, tanggal lahir</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Kota], [tanggal lahir]</p></td></tr>
<tr><td style="padding:1pt 0"><p>Pendidikan terakhir</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[S1 Jurusan, Universitas]</p></td></tr>
<tr><td style="padding:1pt 0"><p>Alamat</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Alamat lengkap]</p></td></tr>
<tr><td style="padding:1pt 0"><p>Telepon / surel</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[08xx xxxx xxxx] / [nama@surel.com]</p></td></tr>
</tbody></table>
<p style="text-align:justify;--sb:8pt;--sa:8pt">Saya memiliki pengalaman [jumlah] tahun di bidang [bidang], terbiasa bekerja dalam tim, dan mampu beradaptasi dengan target kerja yang dinamis. Sebagai bahan pertimbangan, saya lampirkan:</p>
<ol><li>Daftar riwayat hidup</li><li>Fotokopi ijazah dan transkrip nilai</li><li>Fotokopi KTP</li><li>Pas foto terbaru</li><li>Sertifikat pendukung</li></ol>
<p style="text-align:justify;--sb:8pt">Besar harapan saya untuk dapat diberi kesempatan wawancara agar dapat menjelaskan potensi diri secara lebih mendalam. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.</p>
<p><br></p>
<p>Hormat saya,</p><p><br></p><p><br></p><p><br></p><p><b>[Nama Lengkap]</b></p>`,
  },

  {
    id: 'cv', name: 'Curriculum vitae', cat: 'Pribadi', sub: 'Modern',
    styles: { normal: { font: 'Lato', size: 10.5, color: '#202124', lh: 1.3 }, title: { font: 'Lato', size: 28, bold: true, color: '#1c4587', sa: 2 }, subtitle: { font: 'Lato', size: 12.5, color: '#5f6368', sa: 6 }, h2: { font: 'Lato', size: 11, bold: true, color: '#1c4587', sb: 16, sa: 6 }, h3: { font: 'Lato', size: 11, bold: true, color: '#202124', sb: 10, sa: 1 } },
    page: { margins: { t: 1.8, b: 1.8, l: 2, r: 2 } },
    html: () => `
<p class="title">[Nama Lengkap]</p>
<p class="subtitle">[Posisi / Profesi]</p>
<p><span style="color:#5f6368">[Kota, Indonesia]  ·  [08xx xxxx xxxx]  ·  [nama@surel.com]  ·  [linkedin.com/in/nama]</span></p>
<hr style="border-top:2px solid #1c4587">
<h2>RINGKASAN PROFESIONAL</h2>
<p style="text-align:justify">[Dua sampai tiga kalimat yang menggambarkan pengalaman, keahlian utama, dan nilai yang Anda bawa. Contoh: Profesional dengan 5 tahun pengalaman di bidang manajemen proyek konstruksi, terbiasa memimpin tim lintas fungsi dan mengendalikan biaya proyek bernilai miliaran rupiah.]</p>
<h2>PENGALAMAN KERJA</h2>
<h3>[Jabatan] — [Nama Perusahaan]</h3>
<p><span style="color:#5f6368;font-style:italic">[Bulan Tahun] – Sekarang · [Kota]</span></p>
<ul><li>[Pencapaian terukur, misalnya: menurunkan biaya material 12% melalui negosiasi pemasok]</li><li>[Tanggung jawab utama dan hasil yang dicapai]</li><li>[Proyek atau inisiatif penting]</li></ul>
<h3>[Jabatan] — [Nama Perusahaan]</h3>
<p><span style="color:#5f6368;font-style:italic">[Bulan Tahun] – [Bulan Tahun] · [Kota]</span></p>
<ul><li>[Pencapaian terukur]</li><li>[Tanggung jawab utama]</li></ul>
<h2>PENDIDIKAN</h2>
<h3>[Gelar, Jurusan] — [Nama Universitas]</h3>
<p><span style="color:#5f6368;font-style:italic">[Tahun] – [Tahun] · IPK [3,xx]</span></p>
<h2>KEAHLIAN</h2>
<table ${nb}><tbody><tr><td style="padding:0"><ul><li>[Keahlian teknis 1]</li><li>[Keahlian teknis 2]</li><li>[Perangkat lunak]</li></ul></td><td style="padding:0"><ul><li>[Kepemimpinan]</li><li>[Komunikasi]</li><li>[Pemecahan masalah]</li></ul></td></tr></tbody></table>
<h2>BAHASA &amp; SERTIFIKASI</h2>
<p>Bahasa Indonesia (penutur asli) · Bahasa Inggris ([tingkat]) · [Nama Sertifikasi, Tahun]</p>`,
  },

  {
    id: 'minutes', name: 'Notulen rapat', cat: 'Kerja', sub: 'Rapat koordinasi',
    styles: { normal: { font: 'Arial', size: 11, lh: 1.25 }, title: { size: 22, bold: true, color: '#0b5394' }, h2: { size: 13, bold: true, color: '#0b5394', sb: 14, sa: 6 } },
    html: () => `
<p class="title">Notulen Rapat</p>
<p class="subtitle">[Nama Rapat / Unit Kerja]</p>
<table><colgroup><col style="width:28%"><col></colgroup><tbody>
<tr><td style="background-color:#eef3fb"><p><b>Hari, tanggal</b></p></td><td><p>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></td></tr>
<tr><td style="background-color:#eef3fb"><p><b>Waktu</b></p></td><td><p>[09.00] – [11.00] WIB</p></td></tr>
<tr><td style="background-color:#eef3fb"><p><b>Tempat</b></p></td><td><p>[Ruang rapat / tautan daring]</p></td></tr>
<tr><td style="background-color:#eef3fb"><p><b>Pimpinan rapat</b></p></td><td><p>[Nama]</p></td></tr>
<tr><td style="background-color:#eef3fb"><p><b>Notulis</b></p></td><td><p>[Nama]</p></td></tr>
</tbody></table>
<h2>Peserta</h2>
<ul><li>[Nama — Jabatan]</li><li>[Nama — Jabatan]</li><li>[Nama — Jabatan]</li></ul>
<h2>Agenda</h2>
<ol><li>[Agenda 1]</li><li>[Agenda 2]</li><li>Lain-lain</li></ol>
<h2>Pembahasan</h2>
<p><b>1. [Agenda 1]</b></p>
<p style="text-align:justify;--sa:6pt">[Ringkasan diskusi, data yang disampaikan, dan pendapat peserta.]</p>
<p><b>2. [Agenda 2]</b></p>
<p style="text-align:justify;--sa:6pt">[Ringkasan diskusi.]</p>
<h2>Keputusan</h2>
<ol><li>[Keputusan yang disepakati]</li><li>[Keputusan yang disepakati]</li></ol>
<h2>Tindak Lanjut</h2>
<table><colgroup><col style="width:8%"><col style="width:46%"><col style="width:24%"><col></colgroup><tbody>
<tr><th><p>No</p></th><th><p>Tindakan</p></th><th><p>Penanggung jawab</p></th><th><p>Tenggat</p></th></tr>
<tr><td><p>1</p></td><td><p>[Uraian tindakan]</p></td><td><p>[Nama]</p></td><td><p>[Tanggal]</p></td></tr>
<tr><td><p>2</p></td><td><p>[Uraian tindakan]</p></td><td><p>[Nama]</p></td><td><p>[Tanggal]</p></td></tr>
</tbody></table>
<p><br></p>
<p>Rapat berikutnya: <b>[tanggal, waktu, tempat]</b></p>`,
  },

  {
    id: 'proposal', name: 'Proposal proyek', cat: 'Kerja', sub: 'Penawaran',
    styles: { normal: { font: 'Source Sans 3', size: 11.5, color: '#263238', lh: 1.35 }, title: { font: 'Montserrat', size: 30, bold: true, color: '#0d47a1' }, subtitle: { font: 'Montserrat', size: 14, color: '#546e7a', sa: 18 }, h1: { font: 'Montserrat', size: 17, bold: true, color: '#0d47a1', sb: 22, sa: 8 }, h2: { font: 'Montserrat', size: 13, bold: true, color: '#1565c0', sb: 14, sa: 6 } },
    html: () => `
<p><span style="font-family:Montserrat, sans-serif;font-size:10pt;font-weight:700;color:#1565c0;letter-spacing:2px">PROPOSAL PROYEK</span></p>
<p class="title">[Nama Proyek]</p>
<p class="subtitle">[Satu kalimat yang merangkum manfaat utama proyek]</p>
<table ${nb} style="width:100%"><tbody><tr>
<td style="padding:0"><p><span style="color:#546e7a">Disiapkan untuk</span></p><p><b>[Nama Klien]</b></p><p>[Instansi / Perusahaan]</p></td>
<td style="padding:0"><p><span style="color:#546e7a">Disiapkan oleh</span></p><p><b>[Nama Anda]</b></p><p>[Perusahaan Anda]</p></td>
<td style="padding:0"><p><span style="color:#546e7a">Tanggal</span></p><p><b>${today()}</b></p></td>
</tr></tbody></table>
<h1>1. Latar Belakang</h1>
<p style="text-align:justify">[Jelaskan kondisi saat ini, masalah yang dihadapi klien, dan mengapa proyek ini penting sekarang.]</p>
<h1>2. Tujuan</h1>
<ul><li>[Tujuan terukur pertama]</li><li>[Tujuan terukur kedua]</li><li>[Tujuan terukur ketiga]</li></ul>
<h1>3. Ruang Lingkup Pekerjaan</h1>
<h2>3.1 Termasuk dalam lingkup</h2>
<ul><li>[Pekerjaan / keluaran 1]</li><li>[Pekerjaan / keluaran 2]</li></ul>
<h2>3.2 Di luar lingkup</h2>
<ul><li>[Hal yang tidak termasuk]</li></ul>
<h1>4. Jadwal Pelaksanaan</h1>
<table><colgroup><col style="width:36%"><col style="width:22%"><col style="width:22%"><col></colgroup><tbody>
<tr><th style="background-color:#0d47a1"><p><span style="color:#ffffff">Tahap</span></p></th><th style="background-color:#0d47a1"><p><span style="color:#ffffff">Mulai</span></p></th><th style="background-color:#0d47a1"><p><span style="color:#ffffff">Selesai</span></p></th><th style="background-color:#0d47a1"><p><span style="color:#ffffff">Keluaran</span></p></th></tr>
<tr><td><p>Persiapan &amp; survei</p></td><td><p>[Minggu 1]</p></td><td><p>[Minggu 2]</p></td><td><p>Laporan awal</p></td></tr>
<tr><td style="background-color:#f1f6fd"><p>Pelaksanaan</p></td><td style="background-color:#f1f6fd"><p>[Minggu 3]</p></td><td style="background-color:#f1f6fd"><p>[Minggu 8]</p></td><td style="background-color:#f1f6fd"><p>[Keluaran]</p></td></tr>
<tr><td><p>Uji &amp; serah terima</p></td><td><p>[Minggu 9]</p></td><td><p>[Minggu 10]</p></td><td><p>Berita acara</p></td></tr>
</tbody></table>
<h1>5. Rencana Anggaran</h1>
<table><colgroup><col style="width:8%"><col style="width:52%"><col></colgroup><tbody>
<tr><th><p>No</p></th><th><p>Uraian</p></th><th><p style="text-align:right">Biaya (Rp)</p></th></tr>
<tr><td><p>1</p></td><td><p>[Komponen biaya]</p></td><td><p style="text-align:right">[0]</p></td></tr>
<tr><td><p>2</p></td><td><p>[Komponen biaya]</p></td><td><p style="text-align:right">[0]</p></td></tr>
<tr><td colspan="2"><p style="text-align:right"><b>Total</b></p></td><td><p style="text-align:right"><b>[0]</b></p></td></tr>
</tbody></table>
<h1>6. Penutup</h1>
<p style="text-align:justify">[Tegaskan kembali manfaat proyek, sebutkan langkah berikutnya, dan cantumkan kontak yang dapat dihubungi.]</p>`,
  },

  {
    id: 'report', name: 'Laporan bulanan', cat: 'Kerja', sub: 'Kinerja',
    styles: { normal: { font: 'Roboto', size: 10.5, color: '#202124', lh: 1.35 }, title: { font: 'Roboto', size: 24, bold: true }, subtitle: { color: '#1a73e8', size: 13 }, h1: { size: 15, bold: true, color: '#1a73e8', sb: 18, sa: 6 }, h2: { size: 12, bold: true, sb: 12, sa: 4 } },
    html: () => `
<p class="title">Laporan Bulanan</p>
<p class="subtitle">[Divisi / Unit] · Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
<h1>Ringkasan Eksekutif</h1>
<p style="text-align:justify">[Ringkas capaian utama bulan ini dalam 3–4 kalimat: kinerja terhadap target, isu penting, dan rekomendasi.]</p>
<h1>Indikator Kinerja Utama</h1>
<table><colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col></colgroup><tbody>
<tr><th><p>Indikator</p></th><th><p style="text-align:right">Target</p></th><th><p style="text-align:right">Realisasi</p></th><th><p style="text-align:center">Status</p></th></tr>
<tr><td><p>[Indikator 1]</p></td><td><p style="text-align:right">100</p></td><td><p style="text-align:right">104</p></td><td style="background-color:#e6f4ea"><p style="text-align:center"><span style="color:#137333">Tercapai</span></p></td></tr>
<tr><td><p>[Indikator 2]</p></td><td><p style="text-align:right">80%</p></td><td><p style="text-align:right">72%</p></td><td style="background-color:#fef7e0"><p style="text-align:center"><span style="color:#b06000">Perlu perhatian</span></p></td></tr>
<tr><td><p>[Indikator 3]</p></td><td><p style="text-align:right">50</p></td><td><p style="text-align:right">38</p></td><td style="background-color:#fce8e6"><p style="text-align:center"><span style="color:#c5221f">Di bawah target</span></p></td></tr>
</tbody></table>
<h1>Pencapaian</h1>
<ul><li>[Pencapaian penting dan dampaknya]</li><li>[Pencapaian penting dan dampaknya]</li></ul>
<h1>Kendala &amp; Mitigasi</h1>
<h2>[Kendala 1]</h2>
<p>[Penyebab, dampak, dan langkah mitigasi yang telah atau akan diambil.]</p>
<h1>Rencana Bulan Berikutnya</h1>
<ul class="checklist"><li>[Rencana kerja 1]</li><li>[Rencana kerja 2]</li><li>[Rencana kerja 3]</li></ul>`,
  },

  {
    id: 'paper', name: 'Makalah', cat: 'Pendidikan', sub: 'Format akademik',
    styles: { normal: { font: 'Times New Roman', size: 12, lh: 1.5 }, title: { font: 'Times New Roman', size: 16, bold: true, sa: 6 }, h1: { font: 'Times New Roman', size: 14, bold: true, sb: 0, sa: 12 }, h2: { font: 'Times New Roman', size: 12, bold: true, sb: 12, sa: 6 } },
    page: { margins: { t: 4, b: 3, l: 4, r: 3 }, footer: { html: '<p style="text-align:center"><span class="fld" data-f="page" contenteditable="false">1</span></p>', first: '' }, firstDiff: true },
    html: () => `
<p class="title" style="text-align:center">MAKALAH</p>
<p class="title" style="text-align:center">[JUDUL MAKALAH]</p>
<p style="text-align:center"><br></p>
<p style="text-align:center">Disusun untuk memenuhi tugas mata kuliah [Nama Mata Kuliah]</p>
<p style="text-align:center">Dosen pengampu: [Nama Dosen]</p>
<p style="text-align:center"><br></p><p style="text-align:center"><br></p>
<p style="text-align:center"><b>Disusun oleh:</b></p>
<p style="text-align:center">[Nama Mahasiswa] — [NIM]</p>
<p style="text-align:center"><br></p><p style="text-align:center"><br></p><p style="text-align:center"><br></p>
<p style="text-align:center"><b>PROGRAM STUDI [NAMA PRODI]</b></p>
<p style="text-align:center"><b>FAKULTAS [NAMA FAKULTAS]</b></p>
<p style="text-align:center"><b>UNIVERSITAS [NAMA UNIVERSITAS]</b></p>
<p style="text-align:center"><b>${new Date().getFullYear()}</b></p>
<hr class="pb">
<h1 style="text-align:center">DAFTAR ISI</h1>
<div class="toc" contenteditable="false" data-kind="numbers"></div>
<hr class="pb">
<h1 style="text-align:center">BAB I<br>PENDAHULUAN</h1>
<h2>1.1 Latar Belakang</h2>
<p style="text-align:justify;text-indent:1.27cm">[Uraikan konteks permasalahan, fenomena yang diamati, serta alasan topik ini penting untuk dibahas. Sertakan rujukan bila perlu.]</p>
<h2>1.2 Rumusan Masalah</h2>
<ol><li>[Pertanyaan pertama yang akan dijawab]</li><li>[Pertanyaan kedua]</li></ol>
<h2>1.3 Tujuan Penulisan</h2>
<ol><li>[Tujuan pertama]</li><li>[Tujuan kedua]</li></ol>
<hr class="pb">
<h1 style="text-align:center">BAB II<br>PEMBAHASAN</h1>
<h2>2.1 [Subbab Pembahasan]</h2>
<p style="text-align:justify;text-indent:1.27cm">[Isi pembahasan.]</p>
<hr class="pb">
<h1 style="text-align:center">BAB III<br>PENUTUP</h1>
<h2>3.1 Kesimpulan</h2>
<p style="text-align:justify;text-indent:1.27cm">[Kesimpulan yang menjawab rumusan masalah.]</p>
<h2>3.2 Saran</h2>
<p style="text-align:justify;text-indent:1.27cm">[Saran.]</p>
<hr class="pb">
<h1 style="text-align:center">DAFTAR PUSTAKA</h1>
<p style="padding-left:1.27cm;text-indent:-1.27cm">[Nama Belakang, Inisial. (Tahun). <i>Judul buku</i>. Kota: Penerbit.]</p>`,
  },

  {
    id: 'handover', name: 'Berita acara serah terima', cat: 'Kerja', sub: 'Pekerjaan / barang',
    styles: { normal: { font: 'Times New Roman', size: 12, lh: 1.3 } },
    page: { margins: { t: 2.5, b: 2.5, l: 3, r: 2.5 } },
    html: () => `
<p style="text-align:center"><span style="font-size:14pt"><b><u>BERITA ACARA SERAH TERIMA PEKERJAAN</u></b></span></p>
<p style="text-align:center">Nomor: [001/BAST/X/${new Date().getFullYear()}]</p>
<p><br></p>
<p style="text-align:justify">Pada hari ini [hari], tanggal [tanggal] bulan [bulan] tahun [tahun], yang bertanda tangan di bawah ini:</p>
<table ${nb} style="width:100%"><colgroup><col style="width:6%"><col style="width:24%"><col style="width:4%"><col></colgroup><tbody>
<tr><td style="padding:1pt 0"><p>1.</p></td><td style="padding:1pt 0"><p>Nama</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Nama]</p></td></tr>
<tr><td style="padding:1pt 0"><p><br></p></td><td style="padding:1pt 0"><p>Jabatan</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Jabatan, Perusahaan]</p></td></tr>
</tbody></table>
<p style="text-align:justify;padding-left:6%">selanjutnya disebut <b>PIHAK PERTAMA</b>.</p>
<table ${nb} style="width:100%"><colgroup><col style="width:6%"><col style="width:24%"><col style="width:4%"><col></colgroup><tbody>
<tr><td style="padding:1pt 0"><p>2.</p></td><td style="padding:1pt 0"><p>Nama</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Nama]</p></td></tr>
<tr><td style="padding:1pt 0"><p><br></p></td><td style="padding:1pt 0"><p>Jabatan</p></td><td style="padding:1pt 0"><p>:</p></td><td style="padding:1pt 0"><p>[Jabatan, Instansi]</p></td></tr>
</tbody></table>
<p style="text-align:justify;padding-left:6%;--sa:8pt">selanjutnya disebut <b>PIHAK KEDUA</b>.</p>
<p style="text-align:justify;--sa:8pt">PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima hasil pekerjaan [nama pekerjaan] sesuai Surat Perjanjian Nomor [nomor] tanggal [tanggal], dengan rincian sebagai berikut:</p>
<table><colgroup><col style="width:8%"><col style="width:52%"><col style="width:16%"><col></colgroup><tbody>
<tr><th><p style="text-align:center">No</p></th><th><p style="text-align:center">Uraian Pekerjaan</p></th><th><p style="text-align:center">Volume</p></th><th><p style="text-align:center">Keterangan</p></th></tr>
<tr><td><p style="text-align:center">1</p></td><td><p>[Uraian]</p></td><td><p style="text-align:center">[0 m³]</p></td><td><p>Selesai 100%</p></td></tr>
<tr><td><p style="text-align:center">2</p></td><td><p>[Uraian]</p></td><td><p style="text-align:center">[0 unit]</p></td><td><p>Selesai 100%</p></td></tr>
</tbody></table>
<p style="text-align:justify;--sb:8pt">Demikian berita acara ini dibuat dalam rangkap 2 (dua) dengan kekuatan hukum yang sama untuk dipergunakan sebagaimana mestinya.</p>
<p><br></p>
<table ${nb}><tbody><tr>
<td><p style="text-align:center"><b>PIHAK PERTAMA</b></p><p><br></p><p><br></p><p><br></p><p style="text-align:center"><b><u>[Nama]</u></b></p><p style="text-align:center">[Jabatan]</p></td>
<td><p style="text-align:center"><b>PIHAK KEDUA</b></p><p><br></p><p><br></p><p><br></p><p style="text-align:center"><b><u>[Nama]</u></b></p><p style="text-align:center">[Jabatan]</p></td>
</tr></tbody></table>`,
  },

  {
    id: 'memo', name: 'Memo internal', cat: 'Kerja', sub: 'Singkat',
    styles: { normal: { font: 'Arial', size: 11, lh: 1.3 }, title: { size: 28, bold: true, color: '#202124' } },
    html: () => `
<p class="title">MEMO</p>
<hr style="border-top:3px solid #202124">
<table ${nb} style="width:100%"><colgroup><col style="width:18%"><col></colgroup><tbody>
<tr><td style="padding:2pt 0"><p><b>Kepada</b></p></td><td style="padding:2pt 0"><p>[Nama / Tim]</p></td></tr>
<tr><td style="padding:2pt 0"><p><b>Dari</b></p></td><td style="padding:2pt 0"><p>[Nama, Jabatan]</p></td></tr>
<tr><td style="padding:2pt 0"><p><b>Tembusan</b></p></td><td style="padding:2pt 0"><p>[Nama]</p></td></tr>
<tr><td style="padding:2pt 0"><p><b>Tanggal</b></p></td><td style="padding:2pt 0"><p>${today()}</p></td></tr>
<tr><td style="padding:2pt 0"><p><b>Perihal</b></p></td><td style="padding:2pt 0"><p>[Perihal]</p></td></tr>
</tbody></table>
<hr style="border-top:1px solid #9aa0a6">
<p style="text-align:justify;--sa:8pt">[Paragraf pembuka: sampaikan inti pesan secara langsung.]</p>
<p style="text-align:justify;--sa:8pt">[Paragraf rincian: jelaskan latar belakang, data pendukung, atau instruksi.]</p>
<p><b>Yang perlu dilakukan:</b></p>
<ul class="checklist"><li>[Tindakan 1 — tenggat]</li><li>[Tindakan 2 — tenggat]</li></ul>
<p style="--sb:8pt">Terima kasih atas perhatiannya.</p>`,
  },

  {
    id: 'notes', name: 'Catatan kuliah', cat: 'Pendidikan', sub: 'Terstruktur',
    styles: { normal: { font: 'Nunito', size: 11, lh: 1.4, color: '#263238' }, title: { font: 'Nunito', size: 24, bold: true, color: '#6a1b9a' }, h2: { font: 'Nunito', size: 14, bold: true, color: '#6a1b9a' } },
    html: () => `
<p class="title">[Judul Materi]</p>
<p class="subtitle">[Mata kuliah] · ${today()}</p>
<h2>Ringkasan</h2>
<p>[Tulis ringkasan materi dalam beberapa kalimat setelah perkuliahan.]</p>
<h2>Poin penting</h2>
<ul><li>[Konsep 1] — [penjelasan singkat]</li><li>[Konsep 2] — [penjelasan singkat]</li></ul>
<h2>Istilah</h2>
<table><colgroup><col style="width:30%"><col></colgroup><tbody><tr><th><p>Istilah</p></th><th><p>Definisi</p></th></tr><tr><td><p>[Istilah]</p></td><td><p>[Definisi]</p></td></tr></tbody></table>
<h2>Pertanyaan untuk dibahas</h2>
<ul class="checklist"><li>[Pertanyaan 1]</li><li>[Pertanyaan 2]</li></ul>`,
  },
];
