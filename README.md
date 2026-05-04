# 🔴 Redstone Volume v2

> **Per-tab volume control for your browser — boost, mute, fade, EQ, and more.**

A browser extension that gives you full control over the audio of every tab independently. You can boost volume beyond 100%, apply EQ, set sleep timers, sync tabs together, and much more.

---

## ✨ Features

### 🔊 Per-Tab Volume Control
Set any tab's volume from **0% to 200%** independently. Other tabs are not affected.

**When to use:**  
- A YouTube video is too quiet compared to your music tab → boost it to 150%  
- A noisy ad tab is too loud → mute just that tab without touching anything else

---

### 📈 Volume Amplification (up to 200%)
Go beyond the browser's default 100% cap by routing audio through a Web Audio gain node.

**When to use:**  
- A podcast or video is recorded too quietly and maxing out your system volume isn't enough

---

### 🎚️ Fade In / Fade Out
Gradually increase or decrease volume over a custom duration (0.5s – 10s).

**When to use:**  
- Fading out a song before a meeting  
- Slowly bringing music in so it doesn't startle you

---

### ⏱️ Sleep Timer
Set a timer (1–120 minutes). When it fires, the tab's volume fades to 0 automatically.

**When to use:**  
- Falling asleep to music or a podcast — the audio stops on its own  
- Limiting a long video to stop playing after 30 minutes

---

### 🎛️ EQ Presets (3-Band)
Quick one-click presets: **Flat**, **Bass+**, **Voice**, **Night**.

| Preset | Bass | Mid | Treble | Best For |
|--------|------|-----|--------|----------|
| Flat   | 0    | 0   | 0      | Default, no change |
| Bass+  | +8   | -2  | -2     | Music, EDM, hip-hop |
| Voice  | -4   | +6  | +2     | Podcasts, calls, narration |
| Night  | -6   | +2  | -8     | Late night, soft listening |

---

### 🎚️ 10-Band Equalizer
Fine-grained EQ across 10 frequency bands (32Hz – 16kHz). Includes presets: **Rock**, **Pop**, **Classical**, **Electronic**, and **Custom**.

**When to use:**  
- Boosting highs for better vocal clarity in a lecture  
- Deep bass boost for a music tab while keeping other tabs neutral

---

### 📊 Audio Visualizer
A real-time waveform/frequency visualizer rendered on a canvas in the popup.

**When to use:**  
- Quickly confirm a tab has active audio  
- Fun visual feedback while listening to music

---

### 🔕 Noise Gate
Automatically mutes a tab when the audio level drops below a configurable threshold (dB). Unmutes when sound returns.

**When to use:**  
- Muting a tab during silence between songs  
- Reducing background hiss or noise from a streaming tab

---

### 🦆 Auto-Duck
When a selected "source" tab is playing audio, all other active tabs are automatically reduced to a lower volume. They return to normal when the source tab goes quiet.

**When to use:**  
- You're watching a tutorial and a notification sound plays — other tabs duck  
- A voice assistant or alarm tab activates and temporarily lowers your music

---

### 🧠 Per-Site Memory
Automatically remembers your preferred volume for each domain. Next time you visit the same site, your volume setting is restored.

**When to use:**  
- YouTube always gets 130%, Spotify always stays at 80%  
- You never have to re-adjust the same site again

---

### 🔗 Tab Sync
Link multiple tabs into a sync group. Adjusting volume on one tab adjusts all others in the group simultaneously.

**When to use:**  
- Two music tabs playing at once — keep them balanced together  
- Multiple video tabs that should always stay at the same level

---

### ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+↑` | Volume +10% |
| `Ctrl+Shift+↓` | Volume -10% |
| `Ctrl+Shift+M` | Toggle Mute |

These work **from anywhere**, without needing to open the popup.

---

## 🚀 Installation

1. Download or clone this repository
2. Open your browser and navigate to the extensions page
3. Enable **Developer Mode**
4. Click **Load unpacked** and select the project folder
5. The Redstone Volume icon will appear in your toolbar

> **Note:** Icon images (`icons/icon_16.png`, `icon_32.png`, `icon_48.png`, `icon_128.png`) must be present. The extension will not load without them.

---

## 🛠️ How It Works

The extension uses the **Tab Capture API** and the **Web Audio API** (via an offscreen document) to intercept and process each tab's audio stream in real time. A **service worker keepalive alarm** (every 20 seconds) ensures the background process stays alive as long as active tabs exist.

---

## 🤝 Authors

- [MamadjavadAlizade (User)](https://github.com/MamadjavadAlizade)
- [As1hkan](https://github.com/as1hkan)

---

---

<div dir="rtl">

# 🔴 Redstone Volume v2

> **کنترل صدا برای هر تب جداگانه در مرورگر — تقویت، بی‌صدا، فید، اکولایزر، و بیشتر.**

یک افزونه مرورگر که کنترل کامل صدای هر تب را به صورت مستقل به شما می‌دهد. می‌توانید صدا را تا ۲۰۰٪ تقویت کنید، اکولایزر اعمال کنید، تایمر خواب تنظیم کنید، تب‌ها را همگام‌سازی کنید و بسیار بیشتر.

---

## ✨ ویژگی‌ها

### 🔊 کنترل صدا برای هر تب
صدای هر تب را از **۰٪ تا ۲۰۰٪** به صورت مستقل تنظیم کنید. تب‌های دیگر تحت تأثیر قرار نمی‌گیرند.

**چه وقت استفاده کنیم:**  
- یک ویدیوی یوتیوب نسبت به تب موسیقی‌تان خیلی ساکت است → آن را به ۱۵۰٪ تقویت کنید  
- یک تب تبلیغاتی خیلی پر سر و صداست → فقط همان تب را بی‌صدا کنید

---

### 📈 تقویت صدا (تا ۲۰۰٪)
فراتر از محدودیت پیش‌فرض ۱۰۰٪ مرورگر بروید.

**چه وقت استفاده کنیم:**  
- یک پادکست یا ویدیو خیلی آرام ضبط شده و حتی با بیشترین صدای سیستم هم کافی نیست

---

### 🎚️ فید صدا (Fade In / Fade Out)
افزایش یا کاهش تدریجی صدا در مدت زمان دلخواه (۰.۵ تا ۱۰ ثانیه).

**چه وقت استفاده کنیم:**  
- خاموش کردن تدریجی موسیقی قبل از یک جلسه  
- آوردن آرام موسیقی تا شما را نترساند

---

### ⏱️ تایمر خواب
تایمر تنظیم کنید (۱ تا ۱۲۰ دقیقه). وقتی تایمر تمام شد، صدای تب به صورت خودکار خاموش می‌شود.

**چه وقت استفاده کنیم:**  
- با موسیقی یا پادکست به خواب می‌روید و نمی‌خواهید تا صبح پخش شود  
- می‌خواهید یک ویدیو بعد از ۳۰ دقیقه متوقف شود

---

### 🎛️ پریست‌های اکولایزر (۳ باند)
پریست‌های سریع یک کلیک: **Flat**، **Bass+**، **Voice**، **Night**.

| پریست | باس | میانه | تریبل | مناسب برای |
|-------|-----|-------|-------|------------|
| Flat  | 0   | 0     | 0     | پیش‌فرض |
| Bass+ | +8  | -2    | -2    | موسیقی، EDM |
| Voice | -4  | +6    | +2    | پادکست، مکالمه |
| Night | -6  | +2    | -8    | گوش دادن آرام شبانه |

---

### 🎚️ اکولایزر ۱۰ باند
اکولایزر دقیق روی ۱۰ فرکانس (32Hz تا 16kHz) با پریست‌های Rock، Pop، Classical، Electronic و Custom.

**چه وقت استفاده کنیم:**  
- تقویت فرکانس‌های بالا برای وضوح صدا در درس آنلاین  
- تقویت باس عمیق برای یک تب موسیقی

---

### 📊 ویژوالایزر صدا
نمایش زنده امواج صوتی در پاپ‌آپ افزونه.

**چه وقت استفاده کنیم:**  
- تأیید اینکه یک تب واقعاً صدا دارد  
- تجربه بصری جذاب هنگام گوش دادن به موسیقی

---

### 🔕 دروازه نویز (Noise Gate)
تب را به صورت خودکار بی‌صدا می‌کند وقتی سطح صدا زیر آستانه تنظیم‌شده (dB) می‌افتد. وقتی صدا برمی‌گردد، صدا هم برمی‌گردد.

**چه وقت استفاده کنیم:**  
- بی‌صدا کردن تب در سکوت بین آهنگ‌ها  
- کاهش نویز پس‌زمینه از یک تب استریمینگ

---

### 🦆 Auto-Duck
وقتی یک تب انتخاب‌شده صدا پخش می‌کند، همه تب‌های فعال دیگر به صورت خودکار کمتر می‌شوند و وقتی آن تب ساکت می‌شود، دیگران به حالت عادی برمی‌گردند.

**چه وقت استفاده کنیم:**  
- دارید آموزش می‌بینید و نوتیفیکیشنی می‌آید — بقیه تب‌ها آرام می‌شوند  
- یک دستیار صوتی یا زنگ هشدار صدا می‌زند و موسیقی‌تان موقتاً کمتر می‌شود

---

### 🧠 حافظه سایت
صدای ترجیحی شما را برای هر دامنه به یاد می‌آورد. دفعه بعد که همان سایت را باز کردید، تنظیم شما خودکار برگردانده می‌شود.

**چه وقت استفاده کنیم:**  
- یوتیوب همیشه روی ۱۳۰٪ و اسپاتیفای روی ۸۰٪ بماند  
- دیگر نیازی به تنظیم مجدد همان سایت ندارید

---

### 🔗 همگام‌سازی تب‌ها (Tab Sync)
چندین تب را در یک گروه همگام‌سازی کنید. تنظیم صدا در یک تب، همه تب‌های گروه را تغییر می‌دهد.

**چه وقت استفاده کنیم:**  
- دو تب موسیقی به طور هم‌زمان پخش می‌کنند — تعادل آن‌ها را با هم حفظ کنید  
- چند تب ویدیویی که باید همیشه سطح یکسانی داشته باشند

---

### ⌨️ میانبرهای صفحه‌کلید

| میانبر | عملکرد |
|--------|---------|
| `Ctrl+Shift+↑` | صدا +۱۰٪ |
| `Ctrl+Shift+↓` | صدا -۱۰٪ |
| `Ctrl+Shift+M` | تغییر حالت بی‌صدا |

این میانبرها **از هر جایی** کار می‌کنند، بدون نیاز به باز کردن پاپ‌آپ.

---

## 🚀 نصب

۱. این مخزن را دانلود یا کلون کنید  
۲. مرورگر خود را باز کنید و به صفحه افزونه‌ها بروید  
۳. **Developer Mode** را فعال کنید  
۴. روی **Load unpacked** کلیک کنید و پوشه پروژه را انتخاب کنید  
۵. آیکون Redstone Volume در نوار ابزار شما ظاهر می‌شود

> **توجه:** فایل‌های آیکون (`icons/icon_16.png`, `icon_32.png`, `icon_48.png`, `icon_128.png`) باید وجود داشته باشند. بدون آن‌ها افزونه بارگذاری نمی‌شود.

---

## 🤝 سازندگان

- [MamadjavadAlizade (User)](https://github.com/MamadjavadAlizade)
- [As1hkan](https://github.com/as1hkan)

</div>
