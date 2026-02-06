'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, Circle, Clock, Rocket, Zap, Bug, Sparkles, Code2, GraduationCap, BookOpen, Brain } from "lucide-react"

export default function RoadmapPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    PROJECT ROADMAP
                </h1>
                <p className="text-slate-400">แผนการพัฒนาในอนาคตและฟีเจอร์ใหม่สำหรับระบบ Cerebro</p>
            </div>

            {/* PROJECT PURPOSE */}
            <Card className="bg-gradient-to-br from-[#0B0B15] to-[#1A1A2E] border-white/5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                <CardContent className="pt-6 relative z-10 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                <Sparkles className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-wide">วัตถุประสงค์ของโครงการ</h2>
                        </div>
                        <p className="text-slate-400 leading-lazy text-sm text-balance">
                            เพื่อวิเคราะห์ Win condition ที่จะเกิดได้ในอนาคตอย่างละเอียดเพื่อสร้างกลยุทธ์การดราฟในเกมต่อไปเรื่อยๆ และยังเป็นเครื่องมือในการฝึกซ้อมการดราฟ
                        </p>
                    </div>

                    <div className="w-px bg-white/5 hidden md:block"></div>

                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <Zap className="w-5 h-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-wide">แหล่งข้อมูลการวิเคราะห์</h2>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-400">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                ข้อมูลการซ้อม (Scrimmage Data)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                                ข้อมูลการแข่งในทัวร์นาเมนต์ (Tournament Data)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                ข้อมูลความคิดเห็นจาก Professor
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="developer" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#0B0B15] border border-white/5 p-1 h-auto mb-8">
                    <TabsTrigger
                        value="developer"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-cyan-400 py-3 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <Code2 className="w-4 h-4 mb-1 md:mb-0" />
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <span className="font-bold text-[10px] md:text-sm">DEVELOPER</span>
                            <span className="hidden md:block text-[10px] font-normal opacity-70">App Building & Features</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger
                        value="professor"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-purple-400 py-3 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <GraduationCap className="w-4 h-4 mb-1 md:mb-0" />
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <span className="font-bold text-[10px] md:text-sm">PROFESSOR</span>
                            <span className="hidden md:block text-[10px] font-normal opacity-70">Knowledge Base & Data</span>
                        </div>
                    </TabsTrigger>
                    <TabsTrigger
                        value="tester"
                        className="data-[state=active]:bg-[#1A1A2E] data-[state=active]:text-green-400 py-3 text-slate-400 flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 transition-all duration-300"
                    >
                        <Bug className="w-4 h-4 mb-1 md:mb-0" />
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <span className="font-bold text-[10px] md:text-sm">SYSTEM TESTER</span>
                            <span className="hidden md:block text-[10px] font-normal opacity-70">QA & Bug Hunting</span>
                        </div>
                    </TabsTrigger>
                </TabsList>

                {/* DEVELOPER ROADMAP */}
                <TabsContent value="developer" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* DOING */}
                        <RoadmapColumn
                            title="กำลังดำเนินการ"
                            phase="เฟส 1"
                            color="cyan"
                            icon={Rocket}
                            items={[
                                {
                                    status: "doing",
                                    title: "ตรรกะระบบจำลองการดราฟ",
                                    description: "ปรับปรุงคำแนะนำ AI และการเลือกแก้เกม",
                                    tags: ['Core', 'Logic']
                                },
                                {
                                    status: "doing",
                                    title: "รองรับการใช้งานบนมือถือ",
                                    description: "ปรับปรุงหน้า Admin Dashboard สำหรับมือถือ",
                                    tags: ['UI/UX', 'Mobile']
                                },
                                {
                                    status: "doing",
                                    title: "ระบบห้องแข่งขัน",
                                    description: "สร้างระบบ Backend สำหรับห้องแข่งขันที่แชร์ได้",
                                    tags: ['Backend', 'System']
                                }
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="แผนงานถัดไป"
                            phase="เฟส 2"
                            color="blue"
                            icon={Sparkles}
                            items={[
                                {
                                    status: "planned",
                                    title: "ระบบบันทึกการแข่งจริง",
                                    description: "เครื่องมือบันทึกเหตุการณ์การแข่งขันแบบเรียลไทม์",
                                    tags: ['Feature', 'Tool']
                                },
                                {
                                    status: "planned",
                                    title: "ฝึกซ้อมดราฟกับ AI",
                                    description: "โหมดฝึกซ้อมกับบอทที่ปรับแต่งได้",
                                    tags: ['Feature', 'AI']
                                }
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="แนวคิดในอนาคต"
                            phase="รอการพิจารณา"
                            color="slate"
                            icon={Clock}
                            items={[
                                {
                                    status: "backlog",
                                    title: "Public API",
                                    description: "REST API สำหรับนักพัฒนาภายนอก",
                                    tags: ['Backend']
                                },
                                {
                                    status: "backlog",
                                    title: "ระบบ WebSocket",
                                    description: "อัปเดตข้อมูลแบบเรียลไทม์สำหรับผู้ใช้ทุกคน",
                                    tags: ['System']
                                }
                            ]}
                        />
                    </div>
                </TabsContent>

                {/* PROFESSOR ROADMAP */}
                <TabsContent value="professor" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* DOING */}
                        <RoadmapColumn
                            title="การป้อนข้อมูล"
                            phase="กำลังทำ"
                            color="purple"
                            icon={Zap}
                            items={[
                                {
                                    status: "doing",
                                    title: "ข้อมูลการชนะทางฮีโร่",
                                    description: "เพิ่มข้อมูลการแก้เกมฮีโร่ลงในฐานข้อมูล",
                                    tags: ['Data', 'Meta']
                                },
                                {
                                    status: "doing",
                                    title: "วิเคราะห์กลยุทธ์การแบน",
                                    description: "กำหนดลำดับความสำคัญการแบนสำหรับแต่ละทีม",
                                    tags: ['Strategy', 'Analysis']
                                }
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="การวิจัย"
                            phase="วางแผนไว้"
                            color="pink"
                            icon={BookOpen}
                            items={[
                                {
                                    status: "planned",
                                    title: "คอมโบฮีโร่ที่เข้ากัน",
                                    description: "รวบรวมคอมโบที่มีอัตราชนะสูง",
                                    tags: ['Strategy']
                                },
                                {
                                    status: "planned",
                                    title: "เงื่อนไขชัยชนะ (Win Conditions)",
                                    description: "วิเคราะห์เงื่อนไขชนะสำหรับแต่ละรูปแบบทีม",
                                    tags: ['Analysis']
                                }
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="การเรียนรู้เชิงลึก"
                            phase="อนาคต"
                            color="slate"
                            icon={Brain}
                            items={[
                                {
                                    status: "backlog",
                                    title: "วิเคราะห์โปรไฟล์ผู้เล่น",
                                    description: "สร้างโปรไฟล์เชิงจิตวิทยาสำหรับผู้เล่นโปร",
                                    tags: ['Data', 'Psychology']
                                },
                                {
                                    status: "backlog",
                                    title: "ติดตามวิวัฒนาการเมต้า",
                                    description: "วิเคราะห์การเปลี่ยนแปลงของเมต้าตามฤดูกาล",
                                    tags: ['Data', 'History']
                                }
                            ]}
                        />
                    </div>
                </TabsContent>

                {/* SYSTEM TESTER ROADMAP */}
                <TabsContent value="tester" className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* DOING */}
                        <RoadmapColumn
                            title="กำลังดำเนินการ"
                            phase="เฟส 1"
                            color="green"
                            icon={Bug}
                            items={[
                                {
                                    status: "doing",
                                    title: "ทดสอบระบบ Manual",
                                    description: "ตรวจสอบความถูกต้องของการทำงานทุกฟีเจอร์",
                                    tags: ['QA', 'Manual']
                                },
                                {
                                    status: "doing",
                                    title: "แจ้งปัญหาและติดตามผล",
                                    description: "รวบรวมและแจ้ง Bug ที่พบให้ทีมพัฒนา",
                                    tags: ['QA', 'Report']
                                }
                            ]}
                        />

                        {/* PLANNED */}
                        <RoadmapColumn
                            title="แผนงานถัดไป"
                            phase="เฟส 2"
                            color="orange"
                            icon={Code2}
                            items={[
                                {
                                    status: "planned",
                                    title: "จัดทำ Test Case",
                                    description: "สร้างเอกสาร Test Cases มาตรฐาน",
                                    tags: ['Doc', 'Standard']
                                },
                                {
                                    status: "planned",
                                    title: "ตรวจสอบ Usability",
                                    description: "ประเมินความยากง่ายในการใช้งาน",
                                    tags: ['UX', 'Review']
                                }
                            ]}
                        />

                        {/* BACKLOG */}
                        <RoadmapColumn
                            title="แนวคิดในอนาคต"
                            phase="รอการพิจารณา"
                            color="slate"
                            icon={Brain}
                            items={[
                                {
                                    status: "backlog",
                                    title: "Automated Testing",
                                    description: "นำระบบทดสอบอัตโนมัติมาช่วยลดงาน",
                                    tags: ['Automation']
                                },
                                {
                                    status: "backlog",
                                    title: "Load Testing",
                                    description: "ทดสอบประสิทธิภาพการรองรับผู้ใช้จำนวนมาก",
                                    tags: ['Performance']
                                }
                            ]}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
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
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className={`text-lg font-bold flex items-center gap-2 ${colorStyles[color]?.split(" ")[0]}`}>
                        <Icon className="w-5 h-5" />
                        {title}
                    </CardTitle>
                    <Badge variant="secondary" className={`${colorStyles[color]}`}>
                        {phase}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
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
            case 'done': return <CheckCircle2 className="w-5 h-5 text-green-500" />
            case 'doing': return <Zap className="w-5 h-5 text-yellow-500" />
            case 'planned': return <Circle className="w-5 h-5 text-blue-500" />
            case 'backlog': return <Circle className="w-5 h-5 text-slate-500" />
        }
    }

    return (
        <div className="flex gap-3 group">
            <div className="mt-1">
                {getIcon()}
            </div>
            <div className="space-y-1">
                <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors">{title}</h3>
                <p className="text-sm text-slate-500 leading-snug">{description}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Missing imports need to be added if not present in the new file content,
// strictly checking imports at the top. I added BookOpen, Brain, etc. to lucide-react imports implicitly in the full replacement.
// Wait, I need to make sure I imported `BookOpen`, `Brain`, `Code2`, `GraduationCap` in the component code I wrote above.
// Yes, looking at line 5: `import { CheckCircle2, Circle, Clock, Rocket, Zap, Bug, Sparkles, Code2, GraduationCap } from "lucide-react"`
// I missed `BookOpen` and `Brain` in that import line.
// I will correct this in the `multi_replace_file_content` or `replace_file_content` call if I can, but `replace_file_content` is safer for full file replacement.
// I'll rewrite the import line in my `ReplacementContent`.
