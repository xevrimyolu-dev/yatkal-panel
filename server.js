// server.js (TÜM YENİ VERİLERİ ALAN FİNAL KODU)

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

// Logları saklamak için hafızamız (Render uyursa sıfırlanır)
let logGecmisi = [];

const BILET_OMRU_SANIYE = 10;
let aktifBilet = null;
let biletYenilemeZamanlayicisi;

// QR Kod üretir ve SADECE KULLANICI PANELLERİNE gönderir
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

// --- API (Tüm yeni verileri alacak şekilde güncellendi) ---
app.post('/api/checkin', (req, res) => {
    const { bilet_kodu, kullanici_verisi } = req.body; // Artık 'kullanici_verisi' objesi çok daha büyük

    if (aktifBilet && aktifBilet === bilet_kodu) {
        aktifBilet = null; 
        
        // Yeni gelen tüm verileri log mesajına ekliyoruz
        const logMesaji = `
-----------------------------------------
GİRİŞ TARİHİ: ${new Date().toLocaleString('tr-TR')}
-----------------------------------------
MÜŞTERİ BİLGİLERİ:
  İsim Soyisim: ${kullanici_verisi.isim} ${kullanici_verisi.soyisim}
  Form TC:      ${kullanici_verisi.form_tc}
  NFC TC:       ${kullanici_verisi.nfc_tc_no || "Okunmadı"}
  Telefon:      ${kullanici_verisi.telefon}
  Mail:         ${kullanici_verisi.mail}
  
GÜVENLİK BİLGİLERİ:
  Canlılık Testi: ${kullanici_verisi.canlilik_testi_basarili ? "Başarılı" : "Başarısız"}
  IP Adresi:      ${kullanici_verisi.ip_adresi || "Bilinmiyor"}
  WiFi Adı:       ${kullanici_verisi.wifi_ssid || "Bilinmiyor"}
  Cihaz Modeli:   ${kullanici_verisi.cihaz_modeli || "Bilinmiyor"}
  Cihaz ID:       ${kullanici_verisi.cihaz_id || "Bilinmiyor"}
`;

        // Logu hafızaya kaydet (en yeni en üste)
        logGecmisi.unshift(logMesaji);

        // Logu o an bağlı olan tüm adminlere anlık gönder
        io.emit('yeni_giris_bilgisi', logMesaji);
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

    // Yeni bağlanan admin paneline tüm geçmişi gönder
    socket.emit('log_gecmisi', logGecmisi);
});

server.listen(port, () => {
    console.log(`YatKal Panel sunucusu ${port} portunda çalışıyor.`);
});
