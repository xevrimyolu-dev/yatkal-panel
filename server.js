// server.js (HAFIZALI FİNAL KODU)

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json()); 
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); 

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = process.env.PORT || 3000; 

// --- YENİ EKLENDİ: GİRİŞ LOGLARI İÇİN "HAFIZA" ---
// Gelen her logu bu dizide saklayacağız.
let logGecmisi = [];
// ------------------------------------------------

const BILET_OMRU_SANIYE = 10;
let aktifBilet = null;
let biletYenilemeZamanlayicisi;

const yeniBiletUretVeGonder = () => {
    clearTimeout(biletYenilemeZamanlayicisi);
    aktifBilet = uuidv4();
    io.emit('yeni_qr_kodu', aktifBilet); 
    console.log(`Yeni bilet üretildi: ${aktifBilet}`);
    biletYenilemeZamanlayicisi = setTimeout(yeniBiletUretVeGonder, BILET_OMRU_SANIYE * 1000);
};

// --- ROTALAR ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user_panel.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_panel.html'));
});

// --- API (GÜNCELLENDİ) ---
app.post('/api/checkin', (req, res) => {
    const { bilet_kodu, kullanici_verisi } = req.body;

    if (aktifBilet && aktifBilet === bilet_kodu) {
        aktifBilet = null; 
        
        const logMesaji = `Giriş: ${new Date().toLocaleString('tr-TR')}
İsim: ${kullanici_verisi.isim} ${kullanici_verisi.soyisim}
TC: ${kullanici_verisi.tc}
Telefon: ${kullanici_verisi.telefon}
Mail: ${kullanici_verisi.mail}`;

        // --- YENİ EKLENDİ: LOGU HAFIZAYA KAYDET ---
        // Yeni logu dizinin en başına ekle (en yeni en üstte)
        logGecmisi.unshift(logMesaji);
        // ----------------------------------------

        // Logu o an bağlı olan tüm adminlere anlık gönder
        io.emit('yeni_giris_bilgisi', logMesaji);
        console.log("BAŞARILI GİRİŞ:", kullanici_verisi.isim);

        yeniBiletUretVeGonder(); // Yeni QR kod üret

        res.status(200).send({ message: 'Giriş Başarılı' });
    } else {
        res.status(400).send({ message: 'Geçersiz veya Süresi Dolmuş QR Kod' });
    }
});

// --- WebSocket Bağlantı Yönetimi (GÜNCELLENDİ) ---
io.on('connection', (socket) => {
    console.log('Bir panel bağlandı.');
    
    // Yeni bağlanan panele mevcut QR kodunu gönder
    yeniBiletUretVeGonder(); // (veya aktifBilet varsa onu gönder)

    // --- YENİ EKLENDİ: GEÇMİŞİ GÖNDER ---
    // Yeni bağlanan istemciye (admin veya kullanıcı) tüm log geçmişini gönder.
    // (user_panel.html bunu dinlemediği için görmezden gelecek)
    socket.emit('log_gecmisi', logGecmisi);
    // --------------------------------------
});

server.listen(port, () => {
    console.log(`YatKal Panel sunucusu ${port} portunda çalışıyor.`);
});
