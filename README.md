# YouTube Live Chat Overlay

ระบบ YouTube Live Chat Overlay สำหรับ OBS ที่รันบนเครื่อง local ใช้ unofficial InnerTube API ผ่าน [youtube-chat-next](https://www.npmjs.com/package/youtube-chat-next)

## คุณสมบัติ

- **Scrolling chat** — แชทไหลด้านขวา พื้นหลังโปร่งใส ไม่มีกล่อง
- **Featured chat** — การ์ดข้อความด้านบน สำหรับไฮไลท์ข้อความที่เลือก
- **Control Dock** — หน้าควบคุมในเบราว์เซอร์ คลิกเลือกแชทเพื่อแสดงบน Featured overlay
- **TTS overlay** — อ่านข้อความสมาชิก / Super Chat ออกเสียงบนไลฟ์
- **Auto-update** — Launcher ตรวจสอบและอัปเดตจาก GitHub Releases อัตโนมัติ

## Quick Start

### สำหรับผู้ใช้ Windows (แนะนำ)

1. ดาวน์โหลด `YouTubeLiveChat-Setup-x.x.x.exe` จาก [GitHub Releases](https://github.com/zookzonnakab/youtube-live-chat-overlay/releases/latest)
2. ติดตั้ง (ไม่ต้องเป็น Admin — ติดตั้งในโฟลเดอร์ผู้ใช้) → เปิดจาก Desktop
3. Launcher จะเช็คอัปเดตอัตโนมัติ → กด **เริ่มโปรแกรม** เมื่อพร้อม
4. ใน Dock วางลิงก์ช่อง YouTube / ไลฟ์ แล้วกดบันทึก — ถ้าไม่ใส่ลิงก์ แชทจะไม่ขึ้น

> ถ้าเคยติดตั้ง v1.0.2 ใน `Program Files` ให้ถอนการติดตั้งก่อน แล้วติดตั้งใหม่ (เวอร์ชันเก่าเขียน config ไม่ได้เพราะสิทธิ์โฟลเดอร์)

### ด้วย Docker

```bash
cp .env.example .env
# แก้ไข .env ใส่ YOUTUBE_CHANNEL_ID หรือ YOUTUBE_HANDLE

docker compose up --build
```

### ด้วย Node.js

```bash
cp .env.example .env
npm install
npm run dev
```

เปิดเบราว์เซอร์:

| หน้า | URL |
|------|-----|
| Scrolling overlay | http://localhost:43123/overlay/scroll |
| Featured overlay | http://localhost:43123/overlay/featured |
| TTS overlay | http://localhost:43123/overlay/tts |
| Control Dock | http://localhost:43123/dock |

## ตั้งค่า

ตั้งค่าได้ 2 ทาง:

1. **`.env`** — ค่าเริ่มต้น
2. **Dock UI** — แก้ไขแล้วบันทึก (override ลง `data/config.json`)

ต้องระบุอย่างน้อย 1 ค่า:

```
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxx
YOUTUBE_HANDLE=@channel_name
YOUTUBE_LIVE_ID=VIDEO_ID
YOUTUBE_CHAT_TYPE=live
```

- `live` — ทุกข้อความ (แนะนำสำหรับสตรีม)
- `top` — Top chat ที่ YouTube กรองแล้ว

## ตั้งค่า OBS

### 1. Scrolling Chat Overlay

1. เพิ่ม **Browser Source**
2. URL: `http://localhost:43123/overlay/scroll`
3. ขนาด: 1920 × 1080
4. เปิด **Shutdown source when not visible**
5. Custom CSS (ถ้าจำเป็น):

```css
body { background-color: rgba(0,0,0,0); }
```

### 2. Featured Chat Overlay

1. เพิ่ม **Browser Source**
2. URL: `http://localhost:43123/overlay/featured`
3. ขนาด: 1920 × 1080
4. Custom CSS เหมือนด้านบน

### 3. Control Dock

เปิดบนจอที่ 2: `http://localhost:43123/dock`

- คลิกข้อความในรายการ → แสดงบน Featured overlay ทันที
- Featured จะคงอยู่จนกว่าจะเลือกข้อความใหม่ หรือกด "ล้าง Featured"

## API

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/status` | สถานะการเชื่อมต่อ |
| GET | `/api/messages?limit=50` | ข้อความล่าสุด |
| GET | `/api/config` | อ่าน config |
| PUT | `/api/config` | อัปเดต config + restart chat |
| POST | `/api/featured` | `{ "messageId": "..." }` |
| DELETE | `/api/featured` | ล้าง featured |

WebSocket: `ws://localhost:43123/ws`

Events: `chat:history`, `chat:new`, `featured:update`, `status:update`

## โครงสร้าง

```
src/
  domain/       # types + message normalizer
  services/     # chat ingest, featured, broadcast, config
  api/          # REST routes
  ws/           # WebSocket hub
public/
  overlay/      # OBS browser sources
  dock/         # control panel
```

## Build & Release (สำหรับ Developer)

### ตั้งค่า GitHub Repo

แก้ไข `version.json`:
```json
{
  "version": "1.0.3",
  "githubRepo": "zookzonnakab/youtube-live-chat-overlay"
}
```

### Build Windows Installer (เครื่อง local)

```powershell
# ติดตั้ง Inno Setup จาก https://jrsoftware.org/isinfo.php
npm run build:windows
```

ผลลัพธ์ใน `release/`:
- `YouTubeLiveChat.exe` — Launcher (เช็คอัปเดต + เริ่มโปรแกรม)
- `app-v1.0.3.zip` — ไฟล์อัปเดตสำหรับ GitHub Release
- `YouTubeLiveChat-Setup-1.0.3.exe` — ตัวติดตั้ง

### Publish Release อัตโนมัติ

```bash
git tag v1.0.3
git push origin v1.0.3
```

GitHub Actions จะ build และสร้าง Release พร้อมอัปโหลด:
- `app-v1.0.3.zip` — Launcher ดาวน์โหลดเพื่ออัปเดต
- `YouTubeLiveChat-Setup-1.0.3.exe` — ติดตั้งครั้งแรก
- `YouTubeLiveChat.exe` — Launcher standalone

### วิธีทำงาน Auto-Update

1. ผู้ใช้ดับเบิลคลิก `YouTubeLiveChat.exe`
2. Launcher เช็ค `api.github.com/repos/{owner}/{repo}/releases/latest`
3. ถ้ามีเวอร์ชันใหม่ → ดาวน์โหลด `app-vX.X.X.zip` → ติดตั้งทับ
4. เมื่อเป็นเวอร์ชันล่าสุด → ปุ่ม **เริ่มโปรแกรม** กดได้
5. เปิด Dashboard ที่ `http://localhost:43123/dock`

## หมายเหตุ

- ใช้ unofficial API — อาจพังเมื่อ YouTube เปลี่ยนโครงสร้าง
- ไม่ต้อง OAuth / API Key / Google Cloud
- Port เริ่มต้น: **43123**
