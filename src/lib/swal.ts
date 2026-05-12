import Swal from "sweetalert2";

export async function confirmDelete(opts: {
  title: string;
  text?: string;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

export async function confirmAction(opts: {
  title: string;
  text?: string;
  confirmText?: string;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Confirmar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#3b82f6",
    cancelButtonColor: "#6b7280",
    reverseButtons: true,
  });
  return result.isConfirmed;
}
