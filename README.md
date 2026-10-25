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

Android kaynak kodu `android/` klasöründedir. Uygulamanın kendi izin eklentisi
`android/app/src/main/java/com/medya/app/MediaPermissionsPlugin.java` dosyasında
tanımlıdır ve `MainActivity` içinde kaydedilir.

## Notlar

- Dosyalar oturum içi tutulur; uygulama kapatıldığında seçim listesi sıfırlanır.
- MP3 çıkarma, cihazın WebAudio çözücüsüyle çalışır. Çözümleyemediği codec'ler
  için araç açık bir hata mesajı gösterir.
- Araç çıktıları uygulama içinde önizlenebilir; "Cihaza Kaydet" Android'de
  sistem paylaşma sayfası üzerinden kaydeder.
