import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";

export type ToastOptions = ExternalToast;
export type ToastId = string | number;

/**
 * App-wide notifications, rendered by <Toaster /> in the root layout.
 * Client-side only (call from event handlers and effects).
 *
 *   toast.success("Project saved")
 *   toast.error("Upload failed", { description: err.message })
 *   const id = toast.loading("Rendering video…"); … toast.success("Video ready", { id })
 *   toast.promise(save(), { loading: "Saving…", success: "Saved", error: (e) => String(e) })
 */
export const toast = {
  success: (message: ReactNode, options?: ToastOptions): ToastId => sonner.success(message, options),
  /** errors stay up longer by default */
  error: (message: ReactNode, options?: ToastOptions): ToastId => sonner.error(message, { duration: 8000, ...options }),
  info: (message: ReactNode, options?: ToastOptions): ToastId => sonner.info(message, options),
  warning: (message: ReactNode, options?: ToastOptions): ToastId => sonner.warning(message, options),
  /** stays until replaced (pass the returned id to success/error) or dismissed */
  loading: (message: ReactNode, options?: ToastOptions): ToastId => sonner.loading(message, options),
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: {
      loading: ReactNode;
      success: ReactNode | ((data: T) => ReactNode);
      error: ReactNode | ((error: unknown) => ReactNode);
    },
    options?: Omit<ToastOptions, "description">,
  ) => sonner.promise(promise, { ...options, ...messages }),
  dismiss: (id?: ToastId) => sonner.dismiss(id),
};
