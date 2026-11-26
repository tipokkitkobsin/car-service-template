# แจ้งเตือนเข้า Discord (ไม่บังคับ)

[English](discord.en.md)

เมื่อเปิดใช้ ทุกเช้า 09:00 น. GitHub จะตรวจรายการ ถ้ามีงานใกล้ถึงหรือเกินกำหนด จะส่งข้อความเข้าห้อง Discord ที่เลือก
ถ้าไม่ได้จดเลขไมล์นาน 30 วัน จะส่งข้อความถามเลขไมล์ด้วย

ไม่ต้องมีเครื่องเปิดทิ้งไว้ ใช้ GitHub Actions ฟรี

## 1. สร้าง bot บน Discord

1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications) แล้วกด **New Application** ตั้งชื่อ เช่น `เช็คระยะ`
2. เมนูซ้าย **Bot** กด **Reset Token** แล้วคัดลอก token ไว้ ใช้ในขั้นที่ 3
3. เมนูซ้าย **OAuth2** > **URL Generator**:
   - Scopes: ติ๊ก `bot` และ `applications.commands`
   - Bot Permissions: ติ๊ก `View Channels` และ `Send Messages`
4. คัดลอกลิงก์ด้านล่าง เปิดในเบราว์เซอร์ แล้วเลือก server ของคุณ

## 2. หา Channel ID

1. ใน Discord ไปที่ ตั้งค่าผู้ใช้ > ขั้นสูง (Advanced) แล้วเปิด **Developer Mode**
2. คลิกขวาที่ห้องที่จะให้แจ้งเตือน แล้วกด **Copy Channel ID**

## 3. ใส่ค่าใน GitHub

ต้องใช้ token อีกตัวให้ GitHub Actions อ่านข้อมูลรถ สร้างแบบเดียวกับขั้นที่ 4 ใน README
ตั้งชื่อ `car-service-actions` เลือกเฉพาะ repo ข้อมูล และให้ Contents: Read and write

ใน repo ตัวเว็บ (ไม่ใช่ repo ข้อมูล) ไปที่ **Settings** > **Secrets and variables** > **Actions**

แท็บ **Secrets** กด **New repository secret** ทีละตัว:

| Name | ค่า |
|---|---|
| `DATA_TOKEN` | GitHub token `car-service-actions` |
| `DISCORD_BOT_TOKEN` | token ของ bot จากข้อ 1 |
| `DISCORD_CHANNEL_ID` | Channel ID จากข้อ 2 |

แท็บ **Variables** กด **New repository variable**:

| Name | ค่า |
|---|---|
| `REMINDERS_ENABLED` | `true` |
| `DATA_REPO` | ชื่อ repo ข้อมูล ถ้าไม่ใช่ `car-service-data` |

## 4. ทดสอบ

1. แท็บ **Actions** > **Daily reminder** > **Run workflow**
2. ติ๊ก **Send one test message only** แล้วกด **Run workflow**
3. ห้อง Discord ควรได้ข้อความ "ทดสอบการแจ้งเตือนเช็คระยะ"

ถ้าไม่ได้ ให้กดดูรายละเอียดของ workflow ที่ล้มเหลว สาเหตุที่พบบ่อย:
- ชื่อ secret พิมพ์ผิด
- bot ไม่มีสิทธิ์ส่งข้อความในห้องนั้น
- token หมดอายุ

ปิดการแจ้งเตือนได้โดยเปลี่ยน `REMINDERS_ENABLED` เป็น `false`

### ถ้าแจ้งเตือนหยุดไปเอง

GitHub จะหยุดงานตั้งเวลาใน repo public ที่ไม่มีการแก้ไขอะไรเลย 60 วัน และจะส่งอีเมลเตือนก่อน
ถ้าเจอ ให้ไปที่แท็บ **Actions** > **Daily reminder** แล้วกด **Enable workflow**
หรือแก้ไฟล์อะไรก็ได้ใน repo ตัวเว็บสักครั้ง เช่น เพิ่มโน้ตใน README ก่อนครบ 60 วัน

---

# Bot จดเลขไมล์ใน Discord (ไม่บังคับ สำหรับคนที่มีเครื่องเปิดตลอด)

ใช้คำสั่ง `/km 85000` เพื่อจดเลขไมล์ และ `/status` เพื่อดูงานค้างใน Discord ได้เลย
ต้องมีเครื่องที่รัน Docker ได้และเปิดตลอด เช่น NAS (Synology, QNAP), Raspberry Pi หรือ VPS
bot ต่อออกไปหา Discord และ GitHub อย่างเดียว ไม่ต้องเปิด port

ใช้ bot ตัวเดียวกับข้อ 1 ได้ และต้องมี:
- Server ID: คลิกขวาที่ชื่อ server แล้วกด Copy Server ID
- User ID ของคุณ: คลิกขวาที่ชื่อตัวเอง แล้วกด Copy User ID
- GitHub token ที่ให้สิทธิ์ repo ข้อมูล สร้างใหม่ชื่อ `car-service-bot`

bot ตอบเฉพาะคุณ และตอบเฉพาะในห้องที่ตั้งไว้

บนเครื่องที่จะรัน bot (เปลี่ยน `<ชื่อบัญชี>` และชื่อ repo ให้ตรงของคุณ):

```bash
curl -L https://github.com/<ชื่อบัญชี>/car-service/archive/refs/heads/main.tar.gz | tar xz
```

```bash
cd car-service-main/bot && bash setup-env.sh
```

`setup-env.sh` จะถามค่าทีละช่อง ส่วน token จะพิมพ์แบบซ่อน ไม่ขึ้นในประวัติคำสั่ง จากนั้นรัน:

```bash
sudo docker compose up -d --build
```

ดูว่า bot ทำงานไหม:

```bash
sudo docker logs --tail 5 car-service-bot
```

ควรเห็น `Bot ready`

ห้ามแชร์ไฟล์ `bot/.env` เพราะมี token อยู่ข้างใน
