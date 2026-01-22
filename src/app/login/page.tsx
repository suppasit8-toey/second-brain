'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { login } from './actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { ShieldCheck, Cpu, Zap, Brain } from 'lucide-react'
import Image from 'next/image'

const initialState = {
    message: '',
    success: false
}

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)]"
            disabled={pending}
        >
            {pending ? (
                <span className="flex items-center gap-2">
                    <Cpu className="animate-spin w-4 h-4" /> ACCESSING CORE...
                </span>
            ) : (
                <span className="flex items-center gap-2 justify-center">
                    INITIALIZE SYSTEM <Zap className="w-4 h-4 fill-black" />
                </span>
            )}
        </Button>
    )
}

export default function LoginPage() {
    const [state, formAction] = useActionState(login, initialState)

    return (
        <div className="h-[100dvh] flex text-white relative overflow-hidden bg-[#050b14] font-sans selection:bg-cyan-500/30">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-900/10 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] bg-[size:40px_40px]"></div>
                {/* Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050b14] via-transparent to-[#050b14]/80"></div>
            </div>

            <div className="container relative z-10 flex flex-col md:flex-row items-center justify-center h-full gap-6 md:gap-24 px-6 md:px-8 py-6">

                {/* Left Side: System Info */}
                <div className="max-w-xl flex flex-col items-center md:items-start text-center md:text-left animate-in slide-in-from-bottom-10 md:slide-in-from-left-10 duration-1000 fade-in shrink-0">
                    <div className="mb-4 md:mb-8 relative group">
                        <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full group-hover:bg-cyan-400/30 transition-all duration-500"></div>
                        <div className="relative p-3 md:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-700/50 shadow-2xl backdrop-blur-md">
                            <Brain className="w-12 h-12 md:w-16 md:h-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-slate-400 mb-2 md:mb-6 drop-shadow-sm">
                        ADVANCED<br /><span className="text-cyan-400/90">INTELLIGENCE</span>
                    </h1>

                    <div className="space-y-4 max-w-sm md:max-w-none">
                        <p className="text-sm md:text-lg text-slate-400 font-medium leading-relaxed">
                            <strong className="text-cyan-400">CEREBRO AI</strong> / SYSTEM ACCESS
                        </p>
                        <p className="hidden md:block text-slate-500 font-light leading-relaxed max-w-lg">
                            Leveraging deep learning algorithms to analyze historical match data, predict outcomes,
                            and recommend the perfect counter-picks in real-time.
                        </p>
                        <p className="text-xs md:text-sm text-slate-600 border-l-2 border-cyan-500/20 pl-4 py-1 italic hidden sm:block">
                            "ระบบปัญญาประดิษฐ์อัจฉริยะวิเคราะห์การดราฟต์ ครองความได้เปรียบตั้งแต่เริ่มเกม"
                        </p>
                    </div>

                    <div className="flex gap-3 justify-center md:justify-start pt-6 md:pt-8 opacity-80">
                        <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 px-3 py-1 text-[10px] md:text-xs tracking-wider font-mono uppercase">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-2 shadow-[0_0_5px_rgba(16,185,129,0.5)] inline-block"></div>
                            Online
                        </Badge>
                        <Badge variant="outline" className="bg-cyan-500/5 text-cyan-400 border-cyan-500/20 px-3 py-1 text-[10px] md:text-xs tracking-wider font-mono uppercase flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Secure
                        </Badge>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="w-full max-w-[360px] md:max-w-md animate-in slide-in-from-bottom-10 md:slide-in-from-right-10 duration-1000 fade-in delay-200 shrink-0">
                    <div className="relative group perspective-1000">
                        {/* Glow effect */}
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

                        <div className="relative bg-slate-950/80 backdrop-blur-2xl border border-white/5 p-6 md:p-10 rounded-3xl shadow-2xl">
                            <div className="text-center mb-6 md:mb-8">
                                <h2 className="text-base md:text-lg font-bold text-white tracking-[0.2em] uppercase mb-1">Authentication</h2>
                                <div className="h-0.5 w-12 bg-cyan-500/50 mx-auto rounded-full mb-2"></div>
                                <p className="text-[10px] text-slate-500 font-mono uppercase">Restricted Access</p>
                            </div>

                            <form action={formAction} className="space-y-4 md:space-y-6">
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            type="password"
                                            name="password"
                                            placeholder="••••••••"
                                            className="bg-slate-900/50 border-slate-700/50 text-center text-lg md:text-xl tracking-[0.5em] text-white h-12 md:h-14 rounded-xl focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 focus:bg-slate-900 transition-all placeholder:tracking-normal placeholder:text-slate-800"
                                            autoFocus
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            <div className="w-2 h-2 rounded-full bg-cyan-500/50 animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>

                                {state.message && (
                                    <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg flex items-center justify-center gap-2 animate-in fade-in zoom-in-95">
                                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping"></div>
                                        {state.message}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <SubmitButton />
                                </div>
                            </form>

                            <div className="mt-6 md:mt-8 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
                                <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">
                                    V.{new Date().getFullYear()}.1.0
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
