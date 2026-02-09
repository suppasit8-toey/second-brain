'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, Circle, Clock, Rocket, Zap, Bug, Sparkles, Code2, GraduationCap, BookOpen, Brain, Gamepad2, Shield, Users, Trophy, BarChart3, Settings } from "lucide-react"

export default function RoadmapPage() {
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    PROJECT ROADMAP
                </h1>
                <p className="text-slate-400 text-sm md:text-base">แผนการพัฒนาและฟีเจอร์ของระบบ SECOND-BRAIN - Esports Draft Intelligence Platform</p>
            </div>

            {/* CORE FEATURES OVERVIEW */}
            <Card className="bg-gradient-to-br from-[#0B0B15] to-[#1A1A2E] border-white/5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                        ฟังก์ชันหลักของระบบ (Core Features)
                    </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <FeatureCard icon={Gamepad2} title="Draft System" desc="Draft แบบ Live + AI" color="cyan" />
                        <FeatureCard icon={Brain} title="Cerebro AI" desc="AI แนะนำ Pick/Ban" color="purple" />
                        <FeatureCard icon={Rocket} title="Simulator" desc="ซ้อม Draft กับ Bot" color="blue" />
                        <FeatureCard icon={Trophy} title="Win Conditions" desc="สร้างแผนการเล่น" color="yellow" />
                        <FeatureCard icon={Shield} title="Heroes" desc="ฐานข้อมูลฮีโร่" color="green" />
                        <FeatureCard icon={Zap} title="Matchups" desc="Counter Pick Data" color="red" />
                        <FeatureCard icon={Users} title="Players" desc="โปรไฟล์ผู้เล่น" color="pink" />
                        <FeatureCard icon={BarChart3} title="Match History" desc="Scrims & Tournaments" color="orange" />
                    </div>
                </CardContent>
            </Card>

            {/* PROJECT PURPOSE */}
            <Card className="bg-gradient-to-br from-[#0B0B15] to-[#1A1A2E] border-white/5 shadow-xl relative overflow-hidden">
                <CardContent className="pt-6 relative z-10 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                <Sparkles className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white tracking-wide">วัตถุประสงค์</h2>
                        </div>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            AI-Powered Platform สำหรับทีม Esports เพื่อวิเคราะห์และช่วยในกระบวนการ Draft สำหรับเกม Arena of Valor โดยมีระบบ Cerebro AI ให้คำแนะนำ Pick/Ban แบบ Real-time
                        </p>
                    </div>

                    <div className="w-px bg-white/5 hidden md:block"></div>

                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <Settings className="w-5 h-5 text-purple-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white tracking-wide">Tech Stack</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <TechBadge label="Next.js 15" />
                            <TechBadge label="React 19" />
                            <TechBadge label="TypeScript" />
                            <TechBadge label="Supabase" />
                            <TechBadge label="Tailwind" />
                            <TechBadge label="Vercel" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="developer" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#0B0B15] border border-white/5 p-1 h-auto mb-6">
                    <TabsTrigger
                        value="developer"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-cyan-400 py-2.5 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <Code2 className="w-4 h-4" />
                        <span className="font-bold text-[10px] md:text-sm">DEVELOPER</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="professor"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-purple-400 py-2.5 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <GraduationCap className="w-4 h-4" />
                        <span className="font-bold text-[10px] md:text-sm">PROFESSOR</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="tester"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-green-400 py-2.5 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <Bug className="w-4 h-4" />
                        <span className="font-bold text-[10px] md:text-sm">TESTER</span>
                    </TabsTrigger>
                </TabsList>

                {/* DEVELOPER ROADMAP */}
                <TabsContent value="developer" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* COMPLETED */}
                        <RoadmapColumn
                            title="เสร็จสมบูรณ์"
                            phase="Phase 1-4"
                            color="green"
                            icon={CheckCircle2}
                            items={[
                                { status: "done", title: "Draft Interface", description: "หน้า Draft แบบ Live + Post-Draft Analysis", tags: ['Core'] },
                                { status: "done", title: "Cerebro AI Engine", description: "ระบบแนะนำ Pick/Ban + Auto-Select", tags: ['AI'] },
                                { status: "done", title: "Draft Simulator", description: "ซ้อม Draft กับ Bot + BO1-BO7", tags: ['Feature'] },
                                { status: "done", title: "Win Conditions", description: "สร้างแผนการเล่น + Share Links", tags: ['Feature'] },
                                { status: "done", title: "Match Recording", description: "บันทึก Scrims + MVP Selection", tags: ['System'] },
                            ]}
                        />

                        {/* DOING */}
                        <RoadmapColumn
                            title="กำลังดำเนินการ"
                            phase="Phase 5"
                            color="cyan"
                            icon={Rocket}
                            items={[
                                { status: "doing", title: "Mobile Optimization", description: "ปรับปรุง UI/UX สำหรับมือถือ", tags: ['UI/UX'] },
                                { status: "doing", title: "Analytics Dashboard", description: "แดชบอร์ดสถิติและ Insights", tags: ['Feature'] },
                                { status: "doing", title: "Bug Fixes", description: "แก้ไข Error บน Mobile", tags: ['QA'] },
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="แผนงานถัดไป"
                            phase="Phase 6"
                            color="blue"
                            icon={Sparkles}
                            items={[
                                { status: "planned", title: "Player Performance", description: "วิเคราะห์ Trends ผู้เล่น", tags: ['Analytics'] },
                                { status: "planned", title: "Meta Reports", description: "รายงานวิเคราะห์ Meta", tags: ['AI'] },
                                { status: "planned", title: "Opponent Scouting", description: "รายงานวิเคราะห์คู่แข่ง", tags: ['Feature'] },
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="อนาคต"
                            phase="Backlog"
                            color="slate"
                            icon={Clock}
                            items={[
                                { status: "backlog", title: "Real-time Collab", description: "Draft ร่วมกันแบบ Real-time", tags: ['System'] },
                                { status: "backlog", title: "Voice Integration", description: "ระบบเสียงระหว่าง Draft", tags: ['Feature'] },
                                { status: "backlog", title: "Video Replay", description: "แทก Timestamp ใน VOD", tags: ['Feature'] },
                            ]}
                        />
                    </div>
                </TabsContent>

                {/* PROFESSOR ROADMAP */}
                <TabsContent value="professor" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* COMPLETED */}
                        <RoadmapColumn
                            title="เสร็จสมบูรณ์"
                            phase="Done"
                            color="green"
                            icon={CheckCircle2}
                            items={[
                                { status: "done", title: "Hero Database", description: "ฐานข้อมูลฮีโร่ครบถ้วน", tags: ['Data'] },
                                { status: "done", title: "Matchup Data", description: "ข้อมูล Counter Pick", tags: ['Data'] },
                                { status: "done", title: "Combo System", description: "Synergy ระหว่างฮีโร่", tags: ['Strategy'] },
                            ]}
                        />

                        {/* DOING */}
                        <RoadmapColumn
                            title="การป้อนข้อมูล"
                            phase="กำลังทำ"
                            color="purple"
                            icon={Zap}
                            items={[
                                { status: "doing", title: "Matchup Updates", description: "อัปเดตข้อมูล Counter ตาม Meta", tags: ['Data'] },
                                { status: "doing", title: "Ban Priority", description: "กำหนดลำดับแบนสำหรับแต่ละทีม", tags: ['Strategy'] },
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="การวิจัย"
                            phase="วางแผนไว้"
                            color="pink"
                            icon={BookOpen}
                            items={[
                                { status: "planned", title: "Win Rate Combos", description: "รวบรวม Combo อัตราชนะสูง", tags: ['Strategy'] },
                                { status: "planned", title: "Team Comp Analysis", description: "วิเคราะห์ Team Composition", tags: ['Analysis'] },
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="เชิงลึก"
                            phase="อนาคต"
                            color="slate"
                            icon={Brain}
                            items={[
                                { status: "backlog", title: "Player Profiles", description: "โปรไฟล์เชิงจิตวิทยาผู้เล่น Pro", tags: ['Psychology'] },
                                { status: "backlog", title: "Meta Evolution", description: "ติดตามวิวัฒนาการ Meta", tags: ['History'] },
                            ]}
                        />
                    </div>
                </TabsContent>

                {/* SYSTEM TESTER ROADMAP */}
                <TabsContent value="tester" className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* COMPLETED */}
                        <RoadmapColumn
                            title="เสร็จสมบูรณ์"
                            phase="Done"
                            color="green"
                            icon={CheckCircle2}
                            items={[
                                { status: "done", title: "Core Features Test", description: "ทดสอบฟีเจอร์หลักทั้งหมด", tags: ['QA'] },
                                { status: "done", title: "Draft Flow Test", description: "ทดสอบ Flow การ Draft", tags: ['QA'] },
                            ]}
                        />

                        {/* DOING */}
                        <RoadmapColumn
                            title="กำลังดำเนินการ"
                            phase="Phase 1"
                            color="orange"
                            icon={Bug}
                            items={[
                                { status: "doing", title: "Mobile Testing", description: "ทดสอบบน iOS และ Android", tags: ['QA', 'Mobile'] },
                                { status: "doing", title: "Bug Reports", description: "รวบรวมและแจ้ง Bug", tags: ['Report'] },
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="แผนงานถัดไป"
                            phase="Phase 2"
                            color="blue"
                            icon={Code2}
                            items={[
                                { status: "planned", title: "Test Cases", description: "สร้างเอกสาร Test Cases", tags: ['Doc'] },
                                { status: "planned", title: "Usability Review", description: "ประเมินความง่ายในการใช้งาน", tags: ['UX'] },
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="อนาคต"
                            phase="Backlog"
                            color="slate"
                            icon={Brain}
                            items={[
                                { status: "backlog", title: "Automated Tests", description: "ระบบทดสอบอัตโนมัติ", tags: ['Automation'] },
                                { status: "backlog", title: "Load Testing", description: "ทดสอบรองรับผู้ใช้จำนวนมาก", tags: ['Performance'] },
                            ]}
                        />
                    </div>
                </TabsContent>
            </Tabs>

            {/* VERSION INFO */}
            <div className="text-center text-slate-600 text-xs pt-4">
                <p>SECOND-BRAIN v2.0 • Last Updated: February 9, 2026</p>
            </div>
        </div>
    )
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) {
    const colorMap: Record<string, string> = {
        cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
        green: "bg-green-500/10 border-green-500/20 text-green-400",
        red: "bg-red-500/10 border-red-500/20 text-red-400",
        pink: "bg-pink-500/10 border-pink-500/20 text-pink-400",
        orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    }

    return (
        <div className={`p-3 rounded-lg border ${colorMap[color]} flex items-center gap-3`}>
            <Icon className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
                <p className="font-bold text-xs text-white truncate">{title}</p>
                <p className="text-[10px] text-slate-500 truncate">{desc}</p>
            </div>
        </div>
    )
}

function TechBadge({ label }: { label: string }) {
    return (
        <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10">
            {label}
        </span>
    )
}

function RoadmapColumn({ title, phase, color, icon: Icon, items }: { title: string, phase: string, color: string, icon: any, items: any[] }) {
    const colorStyles: Record<string, string> = {
        cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
        green: "text-green-400 bg-green-500/10 border-green-500/20",
        orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
        slate: "text-slate-400 bg-slate-700/50 border-white/10",
    }

    const cardBorderColors: Record<string, string> = {
        cyan: "border-cyan-500/20",
        blue: "border-blue-500/20",
        purple: "border-purple-500/20",
        pink: "border-pink-500/20",
        green: "border-green-500/20",
        orange: "border-orange-500/20",
        slate: "border-white/5",
    }

    return (
        <Card className={`bg-[#1A1A2E]/50 shadow-lg backdrop-blur-sm ${cardBorderColors[color] || cardBorderColors.slate}`}>
            <CardHeader className="pb-2 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-bold flex items-center gap-2 ${colorStyles[color]?.split(" ")[0]}`}>
                        <Icon className="w-4 h-4" />
                        {title}
                    </CardTitle>
                    <Badge variant="secondary" className={`text-[10px] ${colorStyles[color]}`}>
                        {phase}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
                {items.map((item, index) => (
                    <RoadmapItem key={index} {...item} />
                ))}
            </CardContent>
        </Card>
    )
}

function RoadmapItem({ title, description, tags, status }: { title: string, description: string, tags: string[], status: 'done' | 'doing' | 'planned' | 'backlog' }) {
    const getIcon = () => {
        switch (status) {
            case 'done': return <CheckCircle2 className="w-4 h-4 text-green-500" />
            case 'doing': return <Zap className="w-4 h-4 text-yellow-500" />
            case 'planned': return <Circle className="w-4 h-4 text-blue-500" />
            case 'backlog': return <Circle className="w-4 h-4 text-slate-500" />
        }
    }

    return (
        <div className="flex gap-2 group">
            <div className="mt-0.5 shrink-0">
                {getIcon()}
            </div>
            <div className="space-y-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-200 group-hover:text-white transition-colors truncate">{title}</h3>
                <p className="text-xs text-slate-500 leading-snug line-clamp-2">{description}</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                    {tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
