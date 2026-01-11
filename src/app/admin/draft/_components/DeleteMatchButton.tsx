'use client'

import { useState, useTransition } from 'react'
import { Trash } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteMatch } from '../actions'

interface DeleteMatchButtonProps {
    matchId: string
    matchTitle: string
    onDelete?: () => void
}

import { useRouter } from 'next/navigation'

export default function DeleteMatchButton({ matchId, matchTitle, onDelete }: DeleteMatchButtonProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        startTransition(async () => {
            const result = await deleteMatch(matchId)
            if (result.success) {
                setOpen(false)
                router.refresh()
                onDelete?.()
            } else {
                // In a real app we might want to show a toast here
                console.error(result.message)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors absolute top-2 right-2 z-10"
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                >
                    <Trash className="w-4 h-4" />
                </button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Delete Match?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the match <strong>{matchTitle}</strong>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpen(false)
                        }}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        {isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
