# BeyTool

Cihazda, çevrimdışı çalışan medya uygulaması: video oynatıcı, galeri tarzı dosya
göz atma ve dönüştürme araçları.

Vite + React + TypeScript + Tailwind ile yazıldı; Capacitor ile Android APK'ye
sarıldı. Tüm işlemler (dönüştürme, hash, arşiv) cihazın işlemcisinde, internete
yüklenmeden yapılır.

## Özellikler

- **İzin ekranı**: İlk açılışta dosya/medya erişimi izni istenir (Android 13+:
  `READ_MEDIA_IMAGES/VIDEO/AUDIO`, daha eski sürümlerde `READ_EXTERNAL_STORAGE`).
- **Video Oynat**: Özel oynatıcı arayüzü — oynat/duraklat, ±10 sn, hız (0.5x–2x),
  ilerleme çubuğu, tam ekran. Oynatılabilirlik cihazın codec desteğine bağlıdır.
- **Dosyalar**: Klasör veya çoklu dosya seçimi, kategori filtreleri, küçük
  kareler, görsel ışığı, ses önizleme, dosya özeti + SHA-256.
- **Editör**: Çok izli (video, ses, metin) zaman çizelgesi, iki parmakla
  yakınlaştırma, kırp/böl/sil/çoğalt/taşı, 0.25x–4x hız, ters çevirme, ses
  seviyesi, fade in/out, 9:16–16:9–1:1–4:5 oranları, döndürme/yansıtma, geri
  al/yinele ve proje listesi. Solma/kayma/yakınlaşma geçişleri, renk
  filtreleri, stillendirilmiş metin, resim içinde resim, donmuş kare, Ken
  Burns, müzik, ses ayırma ve mikrofonla seslendirme vardır. Dışa aktarma
  FFmpeg.wasm ile 480p/720p/1080p yapılır; ilerleme, iptal, galeriye kaydetme
  ve paylaşma vardır.
- **Paketler**: Ayarlar → Paketler bölümünden geçiş, filtre, font, çıkartma ve
  müzik paketleri GitHub Releases'ten indirilir. Boyut ve lisans indirmeden
  önce gösterilir; SHA-256 doğrulanır; ilerleme ve iptal vardır. Paketler
  `beytool/packs` altında kalır ve aynı bölümden silinir.
- **Araçlar**: Video → MP3, ses kırpma (MP3/WAV), görsel sıkıştırma, görsel
  biçim dönüştürme (JPEG/PNG/WebP), ZIP arşivi, SHA-256 parmak izi, video
  bilgisi + codec destek tablosu.
- **Koyu mod**: Anasayfadaki anahtarla açılıp kapanır, seçim hatırlanır.
- Arayüz sade ve mat; iOS tarzı büyük butonlar; sayfa geçişleri ve liste
  animasyonları Framer Motion ile.

## APK nereden alınır

Her push'ta GitHub Actions APK üretir:

1. **Actions** sekmesindeki `Build APK` çalıştırmasını açın.
2. `BeyTool-debug-apk` (veya eklenmişse `BeyTool-release-apk`) artifact'ini indirin.
3. `main` dalına push edildiğinde APK ayrıca **Releases → "En son APK"**
   (prerelease etiketi `latest`) sayfasına da eklenir.

## İmzalı (güncellenebilir) sürüm için

Debug APK'lar CI makinesinin anahtarıyla imzalandığı için her derlemede imza
değişir; aynı cihaza üstüne kurulamaz. Kendi anahtarınızla imzalı release
üretmek için repo **Settings → Secrets and variables → Actions** altına
ekleyin:

| Secret | Değer |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release-keystore.jks` çıktısı |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore parolası |
| `ANDROID_KEY_ALIAS` | Anahtar adı |
| `ANDROID_KEY_PASSWORD` | Anahtar parolası |

Secret'lar tanımlandığında akış `assembleRelease` de çalıştırıp imzalı APK'yi
`BeyTool-release-<sha>.apk` adıyla artifact'e ve release'e ekler.

Yerel keystore üretimi:

```sh
keytool -genkeypair -v -keystore release-keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias medya
base64 -w0 release-keystore.jks   # çıktıyı secret'a yapıştırın
```

## Yerel geliştirme

```sh
bun install
bun run dev        # http://0.0.0.0:5173
bun run build      # tsc + vite build → dist/
bunx cap sync android   # web derlemesini Android projesine kopyalar
```

Android kaynak kodu `android/` klasöründedir. Paket kimliği `com.BeyTool.app`.
Uygulamanın kendi izin eklentisi
`android/app/src/main/java/com/BeyTool/app/MediaPermissionsPlugin.java`
dosyasında tanımlıdır ve `MainActivity` içinde kaydedilir.

## Notlar

- Seçilen dosyalar uygulamanın özel depolamasına (`beytool/library`) kopyalanır;
  kitaplık uygulama kapatılıp açıldığında geri yüklenir. Gizli klasördeki
  dosyalar da aynı yolu kullanır. Kopyalama base64 üzerinden yapıldığı için çok
  büyük kitaplıklarda açılış yavaşlayabilir ve bellek kullanımı artabilir.
- Editör projeleri `beytool/projects` altında JSON olarak otomatik kaydedilir.
- FFmpeg.wasm tarayıcı bellek alanında çalışır. Uzun/1080p projelerde dışa
  aktarma yavaşlayabilir veya bellek yetersizliğiyle durabilir; uygulama bunu
  dışa aktarma sayfasında uyarır. Gerçek telefonlarda hız ve bellek sınırı
  ölçülmemiştir.
- Editör önizlemesi `<video>` etiketiyle yapılır; ters çevirme, donmuş kare
  ve bulanık geçişin bir kısmı yalnızca dışa aktarmada tam uygulanır.
- Paket indirmeleri APK'da yerel indiriciyle (CORS'suz) yapılır. Tarayıcı
  önizlemesinde GitHub Release indirmeleri CORS nedeniyle engellenebilir;
  uygulama bunu ayrı bir hata olarak gösterir.
- Paket kaynakları ve lisansları `src/packs/manifest.json` içindedir.
  Geçiş/filtre/çıkartma/müzik paketleri CC0-1.0; fontlar SIL OFL 1.1'dir.
  Paket görselleri `node scripts/build-packs.mjs` ile yeniden üretilebilir.
- MP3 çıkarma, cihazın WebAudio çözücüsüyle çalışır. Çözümleyemediği codec'ler
  için araç açık bir hata mesajı gösterir.
- Araç çıktıları uygulama içinde önizlenebilir; "Cihaza Kaydet" Android'de
  sistem paylaşma sayfası üzerinden kaydeder.
