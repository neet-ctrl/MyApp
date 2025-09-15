import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastCopy,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Create content for copying
        const copyContent = [
          title && (typeof title === 'string' ? title : 'Toast'),
          description && (typeof description === 'string' ? description : 'Description')
        ].filter(Boolean).join(' - ')

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 pr-8">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastCopy content={copyContent} />
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
