"use client"

import { useRouter } from "next/navigation"
import { useChats } from "@/context/ChatContext"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChatView } from "./ChatView"

/** The chat as a modal: same ChatView as /chat, with "Open as page". */
export function ChatModal() {
  const { chats, modalId, closeModal } = useChats()
  const router = useRouter()
  const title = chats.find((c) => c.id === modalId)?.title ?? "Chat"

  return (
    <Dialog open={!!modalId} onOpenChange={(open) => { if (!open) closeModal() }}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(82vh,780px)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl sm:max-w-3xl sm:rounded-xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {modalId && (
          <ChatView
            chatId={modalId}
            variant="modal"
            onNavigate={closeModal}
            onExpand={() => { closeModal({ keep: true }); router.push(`/chat?id=${encodeURIComponent(modalId)}`) }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
