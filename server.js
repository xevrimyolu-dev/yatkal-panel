// server.js (Admin Paneli SİTEDE OLMAYAN Nihai Sürüm)

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

let logGecmisi = []; // Log hafızası (bu kalıyor, admin app burayı okuyacak)

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

// --- Rotalar ---

// Sadece KULLANICI Paneli (QR KOD) kaldı
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user_panel.html'));
});

// '/admin' rotası ARTIK YOK. Bu adrese gidenler 404 hatası alacak.

// API (Değişiklik yok, Android uygulaması burayı kullanmaya devam edecek)
app.post('/api/checkin', (req, res) => {
    const { bilet_kodu, kullanici_verisi } = req.body;

    if (aktifBilet && aktifBilet === bilet_kodu) {
        aktifBilet = null; 
        
        const logData = {
            tarih: new Date().toLocaleString('tr-TR'),
            isim: `${kullanici_verisi.isim} ${kullanici_verisi.soyisim}`,
            form_tc: kullanici_verisi.form_tc,
            nfc_tc: kullanici_verisi.nfc_tc_no || "Okunmadı",
            telefon: kullanici_verisi.telefon,
            mail: kullanici_verisi.mail,
            canlilik_testi: kullanici_verisi.canlilik_testi_basarili ? "Başarılı" : "Başarısız",
            ip_adresi: kullanici_verisi.ip_adresi || "Bilinmiyor",
            wifi_ssid: kullanici_verisi.wifi_ssid || "Bilinmiyor",
            cihaz_modeli: kullanici_verisi.cihaz_modeli || "Bilinmiyor",
            cihaz_id: kullanici_verisi.cihaz_id || "Bilinmiyor"
        };

        logGecmisi.unshift(logData);
        
        // Bu logu YENİ ADMİN UYGULAMASI dinleyecek
        io.emit('yeni_giris_bilgisi', logData);
        console.log("BAŞARILI GİRİŞ:", kullanici_verisi.isim);

        yeniBiletUretVeGonder();
        res.status(200).send({ message: 'Giriş Başarılı' });
    } else {
        res.status(400).send({ message: 'Geçersiz veya Süresi Dolmuş QR Kod' });
    }
});

// WebSocket Bağlantı Yönetimi (Değişiklik yok, Admin APP burayı kullanacak)
io.on('connection', (socket) => {
    console.log('Bir panel (QR veya Admin App) bağlandı.');
    yeniBiletUretVeGonder(); // QR paneline yeni kod gönder

    // Yeni bağlanan Admin App'e tüm geçmişi gönder
    socket.emit('log_gecmisi', logGecmisi);
});

server.listen(port, () => {
    console.log(`YatKal Panel sunucusu ${port} portunda çalışıyor.`);
});
