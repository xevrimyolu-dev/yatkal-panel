// server.js (JSON GÖNDEREN FİNAL KODU)

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

// Logları saklamak için hafızamız (JSON objeleri olarak)
let logGecmisi = [];

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
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user_panel.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_panel.html'));
});

// --- API (JSON OLUŞTURAN HALİ) ---
app.post('/api/checkin', (req, res) => {
    const { bilet_kodu, kullanici_verisi } = req.body; // kullanici_verisi objesi

    if (aktifBilet && aktifBilet === bilet_kodu) {
        aktifBilet = null; 
        
        // YENİ: Gelen veriyi metin yerine JSON objesi olarak hazırla
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

        // Logu hafızaya kaydet (en yeni en üste)
        logGecmisi.unshift(logData);

        // Logu (JSON objesi olarak) o an bağlı olan tüm adminlere anlık gönder
        io.emit('yeni_giris_bilgisi', logData);
        console.log("BAŞARILI GİRİŞ:", kullanici_verisi.isim);

        yeniBiletUretVeGonder(); // Yeni QR kod üret

        res.status(200).send({ message: 'Giriş Başarılı' });
    } else {
        res.status(400).send({ message: 'Geçersiz veya Süresi Dolmuş QR Kod' });
    }
});

// --- WebSocket Bağlantı Yönetimi ---
io.on('connection', (socket) => {
    console.log('Bir panel bağlandı.');
    yeniBiletUretVeGonder(); // Yeni bağlanan panele QR gönder

    // Yeni bağlanan admin paneline tüm geçmişi (JSON dizisi olarak) gönder
    socket.emit('log_gecmisi', logGecmisi);
});

server.listen(port, () => {
    console.log(`YatKal Panel sunucusu ${port} portunda çalışıyor.`);
});
