# 🧠 SECOND-BRAIN - Esports Draft Intelligence Platform

> **Version:** 2.0  
> **Last Updated:** February 9, 2026  
> **Platform:** Next.js 15 + Supabase + Vercel

---

## 📖 Project Overview

**SECOND-BRAIN** เป็นแพลตฟอร์ม AI-Powered สำหรับทีม Esports เพื่อวิเคราะห์และช่วยในกระบวนการ Draft สำหรับเกม Arena of Valor (RoV/AoV) โดยมีระบบ Cerebro AI ที่ให้คำแนะนำ Pick/Ban แบบ Real-time

---

## 🎯 Core Features (ฟังก์ชันหลัก)

### 1. 🎮 **Draft System** (`/admin/draft`)
- **Real-time Draft Interface** - หน้า Draft แบบ Live สำหรับใช้ระหว่างแข่ง
- **Cerebro AI Advisor** - ระบบ AI ให้คำแนะนำ Pick/Ban แบบ Real-time
- **Auto-Select (AI Best Pick)** - เลือกฮีโร่ที่ดีที่สุดอัตโนมัติ
- **History-based Recommendations** - คำแนะนำจากประวัติการแข่ง
- **Win Prediction** - ทำนายโอกาสชนะจาก Draft Composition
- **Post-Draft Analysis** - วิเคราะห์ผลหลังจบ Draft

### 2. 🤖 **Cerebro AI** (`/admin/cerebro`)
- **Knowledge Base** - ฐานข้อมูลความรู้เกี่ยวกับ Meta และกลยุทธ์
- **Team Analysis** - วิเคราะห์จุดแข็ง/จุดอ่อนของทีม
- **Counter-Pick Intelligence** - แนะนำ Counter สำหรับ Draft ของศัตรู
- **Combo Detection** - ระบุ Synergy ระหว่างฮีโร่

### 3. 🏟️ **Draft Simulator** (`/admin/simulator`)
- **Practice Mode** - ซ้อม Draft โดยไม่ต้องเสียตังค์
- **Bot Opponents** - ฝึกกับ AI Bot ที่ Draft อัตโนมัติ
- **Match Simulation** - จำลองแมตช์แบบ BO1/BO3/BO5
- **Strategy Testing** - ทดสอบกลยุทธ์ก่อนแข่งจริง
- **Export to Strategy** - ส่ง Draft ไปยัง Win Conditions

### 4. ⚔️ **Win Conditions** (`/admin/win-conditions`)
- **Strategy Builder** - สร้างแผนการเล่นสำหรับแต่ละแมตช์
- **Objective Tracking** - กำหนดเป้าหมายในเกม
- **Team Briefing** - เอกสารสรุปสำหรับทีม
- **Shareable Links** - แชร์ลิงก์ให้ผู้เล่นดูได้

### 5. 🦸 **Hero Management** (`/admin/heroes`)
- **Hero Database** - ฐานข้อมูลฮีโร่ทั้งหมด
- **Role Assignment** - กำหนด Role ของแต่ละฮีโร่
- **Tier List** - จัดอันดับฮีโร่ตาม Meta ปัจจุบัน
- **Icon & Image Management** - จัดการรูปภาพฮีโร่

### 6. 🔄 **Matchup System** (`/admin/matchups`)
- **Hero vs Hero Data** - ข้อมูล Matchup ระหว่างฮีโร่
- **Win Rate Statistics** - สถิติอัตราชนะ
- **Lane Matchups** - Matchup แยกตาม Lane
- **Counter Tier List** - อันดับ Counter สำหรับแต่ละฮีโร่

### 7. 🔗 **Combo System** (`/admin/combos`)
- **Synergy Database** - ฐานข้อมูล Combo ระหว่างฮีโร่
- **Combo Builder** - สร้าง Combo ใหม่
- **Team Comp Templates** - แม่แบบ Team Composition

### 8. 👥 **Player Management** (`/admin/players`)
- **Player Profiles** - โปรไฟล์ผู้เล่น
- **Hero Pool** - ฮีโร่ที่ผู้เล่นใช้ได้
- **Performance Stats** - สถิติการเล่น

### 9. 📊 **Match History**

#### Scrims (`/admin/scrims`)
- **Scrim Recording** - บันทึกผลการซ้อม
- **Series Management** - จัดการแมตช์ BO1-BO7
- **Draft History** - ประวัติ Draft ในแต่ละเกม
- **Win/Loss Tracking** - ติดตามสถิติชนะ/แพ้

#### Real Matches (`/admin/real-matches`)
- **Tournament Matches** - แมตช์แข่งจริง
- **Official Records** - บันทึกอย่างเป็นทางการ

### 10. 🏆 **Tournaments** (`/admin/tournaments`)
- **Tournament Management** - จัดการทัวร์นาเมนต์
- **Bracket System** - ระบบสายการแข่ง
- **Match Scheduling** - จัดตารางแมตช์

### 11. 📋 **Version Control** (`/admin/versions`)
- **Patch Notes** - บันทึกการอัปเดทเกม
- **Meta Tracking** - ติดตามการเปลี่ยนแปลง Meta
- **Balance Changes** - บันทึก Nerf/Buff

---

## 🛣️ Development Roadmap

### ✅ Phase 1: Core Infrastructure (COMPLETED)
- [x] Next.js 15 App Router Setup
- [x] Supabase Database Integration
- [x] Authentication System
- [x] Hero Database & Management
- [x] Basic Draft Interface

### ✅ Phase 2: Draft Intelligence (COMPLETED)
- [x] Cerebro AI Recommendation Engine
- [x] Pick/Ban Suggestions
- [x] Counter-Pick Analysis
- [x] History-based Recommendations
- [x] Win Prediction System
- [x] Auto-Select Feature

### ✅ Phase 3: Simulation & Practice (COMPLETED)
- [x] Draft Simulator with Bot
- [x] Match Series (BO1-BO7)
- [x] Post-Draft Analysis
- [x] Strategy Export

### ✅ Phase 4: Match Recording (COMPLETED)
- [x] Scrim Recording System
- [x] Game-by-Game Tracking
- [x] MVP Selection
- [x] Win Condition Builder

### 🔄 Phase 5: Analytics & Insights (IN PROGRESS)
- [x] Basic Statistics
- [ ] Advanced Analytics Dashboard
- [ ] Player Performance Trends
- [ ] Meta Analysis Reports
- [ ] AI-Generated Insights

### 📋 Phase 6: Future Features (PLANNED)
- [ ] Mobile-Optimized Interface
- [ ] Real-time Collaborative Draft
- [ ] Team Sync Features
- [ ] Voice Integration
- [ ] Video Replay Tagging
- [ ] Opponent Scouting Reports
- [ ] Community Hero Guides

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│           Next.js 15 + React 19 + TypeScript        │
├─────────────────────────────────────────────────────┤
│                   UI Components                      │
│     shadcn/ui + Tailwind CSS + Lucide Icons         │
├─────────────────────────────────────────────────────┤
│                  State Management                    │
│          React Hooks + Server Actions               │
├─────────────────────────────────────────────────────┤
│                     Backend                          │
│    Next.js API Routes + Supabase Edge Functions     │
├─────────────────────────────────────────────────────┤
│                    Database                          │
│              Supabase (PostgreSQL)                  │
├─────────────────────────────────────────────────────┤
│                    Hosting                           │
│                     Vercel                           │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── cerebro/        # AI Knowledge & Analysis
│   │   ├── combos/         # Hero Synergies
│   │   ├── draft/          # Live Draft Interface
│   │   ├── heroes/         # Hero Management
│   │   ├── matchups/       # Hero vs Hero Data
│   │   ├── players/        # Player Profiles
│   │   ├── real-matches/   # Tournament Matches
│   │   ├── scrims/         # Practice Matches
│   │   ├── simulator/      # Draft Practice
│   │   ├── tournaments/    # Tournament Brackets
│   │   ├── versions/       # Patch Notes
│   │   └── win-conditions/ # Strategy Builder
│   ├── actions/            # Server Actions
│   ├── api/                # API Routes
│   └── share/              # Public Sharing
├── components/
│   ├── draft/              # Draft Components
│   └── ui/                 # shadcn/ui Components
├── lib/                    # Utilities
└── utils/                  # Helper Functions
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 📞 Contact

สำหรับข้อเสนอแนะหรือรายงานบัค สามารถติดต่อผ่าน GitHub Issues

---

*Built with ❤️ for Esports Teams*
