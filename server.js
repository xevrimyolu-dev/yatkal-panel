// server.js (WiFi'SİZ, 2 PANELLİ FİNAL KODU)

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json()); 
app.use(cors());
// 'public' klasörünü statik olarak sun
app.use(express.static(path.join(__dirname, 'public'))); 

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = process.env.PORT || 3000; 

const BILET_OMRU_SANIYE = 10;
let aktifBilet = null;
let biletYenilemeZamanlayicisi;

const yeniBiletUretVeGonder = () => {
    clearTimeout(biletYenilemeZamanlayicisi);
    aktifBilet = uuidv4();
    
    // QR kodu 'yeni_qr_kodu' odasına (Kullanıcı Paneline) gönder
    io.emit('yeni_qr_kodu', aktifBilet); 
    console.log(`Yeni bilet üretildi: ${aktifBilet}`);
    
    biletYenilemeZamanlayicisi = setTimeout(yeniBiletUretVeGonder, BILET_OMRU_SANIYE * 1000);
};

// --- ROTALAR ---
// Rota 1: KULLANICI Paneli (Ana sayfa - QR KOD)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user_panel.html'));
});

// Rota 2: ADMIN Paneli (LOGLAR)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_panel.html'));
});

// Rota 3: Android API (WiFi'siz Hali)
app.post('/api/checkin', (req, res) => {
    const { bilet_kodu, kullanici_verisi } = req.body;
    console.log("API isteği, Bilet:", bilet_kodu);

    if (aktifBilet && aktifBilet === bilet_kodu) {
        aktifBilet = null; 
        
        // WiFi'siz sade log mesajı
        const logMesaji = `Giriş: ${new Date().toLocaleString('tr-TR')}
İsim: ${kullanici_verisi.isim} ${kullanici_verisi.soyisim}
TC: ${kullanici_verisi.tc}
Telefon: ${kullanici_verisi.telefon}
Mail: ${kullanici_verisi.mail}`;

        // Logu 'yeni_giris_bilgisi' odasına (Admin Paneline) gönder
        io.emit('yeni_giris_bilgisi', logMesaji);
        console.log("BAŞARILI GİRİŞ:", kullanici_verisi.isim);

        yeniBiletUretVeGonder(); // Yeni QR kod üret

        res.status(200).send({ message: 'Giriş Başarılı' });
    } else {
        console.log("GEÇERSİZ BİLET:", bilet_kodu);
        res.status(400).send({ message: 'Geçersiz veya Süresi Dolmuş QR Kod' });
    }
});

// --- WebSocket Bağlantı Yönetimi ---
io.on('connection', (socket) => {
    console.log('Bir panel bağlandı.');
    // Panel bağlanır bağlanmaz ona ilk QR kodunu gönder
    yeniBiletUretVeGonder();
});

server.listen(port, () => {
    console.log(`YatKal Panel sunucusu ${port} portunda çalışıyor.`);
});