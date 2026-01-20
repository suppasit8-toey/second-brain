'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { login } from './actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
        <div className="min-h-screen flex text-white relative overflow-hidden bg-[#050b14]">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
            </div>

            <div className="container relative z-10 flex flex-col md:flex-row items-center justify-center min-h-screen gap-12 md:gap-24 px-4">

                {/* Left Side: System Info */}
                <div className="max-w-xl space-y-6 text-center md:text-left animate-in slide-in-from-left-10 duration-700 fade-in">
                    <div className="mb-8 flex justify-center md:justify-start">
                        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-sm">
                            <Brain className="w-16 h-16 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                        ADVANCED<br />INTELLIGENCE
                    </h1>

                    <p className="text-lg text-cyan-100/70 font-light leading-relaxed">
                        <strong className="text-cyan-400">CEREBRO AI</strong> is the ultimate drafting companion.
                        Leveraging deep learning algorithms to analyze historical match data, predict outcomes,
                        and recommend the perfect counter-picks in real-time.
                    </p>
                    <p className="text-sm text-slate-500 border-l-2 border-cyan-500/30 pl-4 py-1 italic">
                        "ระบบปัญญาประดิษฐ์อัจฉริยะวิเคราะห์การดราฟต์ ครองความได้เปรียบตั้งแต่เริ่มเกม"
                    </p>

                    <div className="flex gap-4 justify-center md:justify-start pt-4">
                        <div className="px-4 py-2 bg-slate-900/50 rounded border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            SYSTEM ONLINE
                        </div>
                        <div className="px-4 py-2 bg-slate-900/50 rounded border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                            <ShieldCheck className="w-3 h-3 text-cyan-500" />
                            SECURE ACCESS
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="w-full max-w-md animate-in slide-in-from-right-10 duration-700 fade-in delay-200">
                    <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
                        {/* Decorative scanning line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 animate-scan transition-opacity"></div>

                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold text-white tracking-widest uppercase mb-2">Authentication</h2>
                            <p className="text-xs text-slate-400">Restricted Access // Authorized Personnel Only</p>
                        </div>

                        <form action={formAction} className="space-y-6">
                            <div className="space-y-2 group/input">
                                <label className="text-[10px] uppercase tracking-wider text-cyan-500 font-bold ml-1 group-focus-within/input:text-cyan-300 transition-colors">
                                    Passcode
                                </label>
                                <Input
                                    type="password"
                                    name="password"
                                    placeholder="••••••••"
                                    className="bg-black/50 border-slate-700 text-center text-2xl tracking-[0.5em] text-cyan-50 h-14 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all placeholder:tracking-normal placeholder:text-slate-700"
                                    autoFocus
                                    required
                                />
                            </div>

                            {state.message && (
                                <div className="text-red-400 text-xs text-center bg-red-950/30 border border-red-900/50 p-2 rounded flex items-center justify-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                                    {state.message}
                                </div>
                            )}

                            <div className="pt-2">
                                <SubmitButton />
                            </div>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-[10px] text-slate-600">
                                ID: {new Date().getFullYear()}-SECURE-NODE-01
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
