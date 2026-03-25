import Swal, { SweetAlertResult, SweetAlertIcon } from "sweetalert2";

/**
 * Configuration options for Swal dialogs
 */
interface SwalConfig {
  title?: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: SweetAlertIcon;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
}

/**
 * Show a confirmation dialog
 */
export const showConfirmation = async (
  config: SwalConfig,
): Promise<SweetAlertResult> => {
  return await Swal.fire({
    title: config.title || "Konfirmasi",
    text: config.text,
    html: config.html,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#EAB308",
    cancelButtonColor: "#6B7280",
    confirmButtonText: config.confirmButtonText || "Ya",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
  });
};

/**
 * Show a success message
 */
export const showSuccess = (config: SwalConfig): Promise<SweetAlertResult> => {
  return Swal.fire({
    title: config.title || "Berhasil!",
    text: config.text,
    html: config.html,
    icon: "success",
    confirmButtonColor: "#22C55E",
    confirmButtonText: config.confirmButtonText || "OK",
  });
};

/**
 * Show an error message
 */
export const showError = (config: SwalConfig): Promise<SweetAlertResult> => {
  return Swal.fire({
    title: config.title || "Gagal!",
    text: config.text,
    html: config.html,
    icon: "error",
    confirmButtonColor: "#EF4444",
    confirmButtonText: config.confirmButtonText || "OK",
  });
};

/**
 * Show an info message
 */
export const showInfo = (config: SwalConfig): Promise<SweetAlertResult> => {
  return Swal.fire({
    title: config.title || "Informasi",
    text: config.text,
    html: config.html,
    icon: "info",
    confirmButtonColor: "#3B82F6",
    confirmButtonText: config.confirmButtonText || "OK",
  });
};

/**
 * Show a warning message
 */
export const showWarning = (config: SwalConfig): Promise<SweetAlertResult> => {
  return Swal.fire({
    title: config.title || "Peringatan",
    text: config.text,
    html: config.html,
    icon: "warning",
    confirmButtonColor: "#F59E0B",
    confirmButtonText: config.confirmButtonText || "OK",
  });
};

/**
 * Show a loading state
 */
export const showLoading = (config: SwalConfig = {}): void => {
  Swal.fire({
    title: config.title || "Memproses...",
    text: config.text || "Mohon tunggu",
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

/**
 * Close any open Swal dialog
 */
export const closeSwal = (): void => {
  Swal.close();
};

/**
 * Show a prompt for text input with textarea
 */
export const showTextAreaPrompt = async (
  config: SwalConfig & {
    inputLabel?: string;
    inputPlaceholder?: string;
    required?: boolean;
  },
): Promise<SweetAlertResult> => {
  return await Swal.fire({
    title: config.title || "Input",
    input: "textarea",
    inputLabel: config.inputLabel,
    inputPlaceholder: config.inputPlaceholder,
    showCancelButton: true,
    confirmButtonColor: "#EAB308",
    cancelButtonColor: "#6B7280",
    confirmButtonText: config.confirmButtonText || "Kirim",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
    inputValidator: config.required
      ? (value) => {
          if (!value) {
            return "Input tidak boleh kosong!";
          }
        }
      : undefined,
  });
};

/**
 * Show a delete confirmation with custom styling
 */
export const showDeleteConfirmation = async (
  config: SwalConfig,
): Promise<SweetAlertResult> => {
  return await Swal.fire({
    title: config.title || "Hapus Data?",
    text: config.text || "Data yang dihapus tidak dapat dikembalikan!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#EF4444",
    cancelButtonColor: "#6B7280",
    confirmButtonText: config.confirmButtonText || "Ya, Hapus",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
  });
};

/**
 * Show approval confirmation
 */
export const showApprovalConfirmation = async (
  config: SwalConfig,
): Promise<SweetAlertResult> => {
  return await Swal.fire({
    title: config.title || "Setujui?",
    text: config.text,
    html: config.html,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#22C55E",
    cancelButtonColor: "#6B7280",
    confirmButtonText: config.confirmButtonText || "Ya, Setujui",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
  });
};

/**
 * Show rejection/revision prompt with reason
 */
export const showRejectionPrompt = async (
  config: SwalConfig & {
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: string;
  },
): Promise<SweetAlertResult> => {
  return await Swal.fire({
    title: config.title || "Revisi",
    input: "textarea",
    inputLabel: config.inputLabel || "Alasan Revisi",
    inputPlaceholder: config.inputPlaceholder || "Masukkan alasan revisi...",
    inputValue: config.inputValue || "",
    showCancelButton: true,
    confirmButtonColor: "#EF4444",
    cancelButtonColor: "#6B7280",
    confirmButtonText: config.confirmButtonText || "Revisi",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
    inputValidator: (value) => {
      if (!value) {
        return "Alasan harus diisi!";
      }
    },
  });
};

/**
 * Execute async action with loading and result handling
 */
export const executeWithLoading = async <T>(
  action: () => Promise<T>,
  config: {
    loadingText?: string;
    successTitle?: string;
    successText?: string;
    errorTitle?: string;
    errorText?: string;
    onSuccess?: (result: T) => void;
    onError?: (error: any) => void;
  } = {},
): Promise<T | null> => {
  try {
    showLoading({
      title: config.loadingText || "Memproses...",
      text: "Mohon tunggu",
    });

    const result = await action();

    await showSuccess({
      title: config.successTitle || "Berhasil!",
      text: config.successText,
    });

    if (config.onSuccess) {
      config.onSuccess(result);
    }

    return result;
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      config.errorText ||
      "Terjadi kesalahan";

    await showError({
      title: config.errorTitle || "Gagal!",
      text: errorMessage,
    });

    if (config.onError) {
      config.onError(error);
    }

    return null;
  }
};

/**
 * Show a three-button approval dialog (Approve, Cancel, Revisi)
 * Returns: { isConfirmed: true } for Approve, { isDismissed: true, dismiss: 'cancel' } for Cancel
 * onRevisi callback is called when Revisi button is clicked
 */
export const showApprovalWithRevision = async (
  config: SwalConfig & {
    onRevisi?: () => void;
    revisiButtonText?: string;
  },
): Promise<SweetAlertResult> => {
  const result = await Swal.fire({
    title: config.title || "Pilih Tindakan",
    text: config.text || "Apa yang ingin Anda lakukan?",
    icon: config.icon || "question",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonColor: config.confirmButtonColor || "#3085d6",
    denyButtonColor: "#f59e0b",
    cancelButtonColor: config.cancelButtonColor || "#6B7280",
    confirmButtonText: config.confirmButtonText || "Setujui",
    denyButtonText: config.revisiButtonText || "Butuh Revisi",
    cancelButtonText: config.cancelButtonText || "Batal",
    reverseButtons: true,
  });

  if (result.isDenied && config.onRevisi) {
    config.onRevisi();
  }

  return result;
};
