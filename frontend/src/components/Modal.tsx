import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Contador, não booleano: se dois modais se sobrepuserem, a página só destrava quando o último fechar.
let openModals = 0;

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();

  // Trava a rolagem da página enquanto o modal está aberto. Sem isso, rolar a lista até o fim
  // passa a rolar a página por trás, e o navegador redesenha tudo o que está atrás do modal.
  useEffect(() => {
    openModals += 1;
    document.body.style.overflow = "hidden";

    return () => {
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-finn-navy/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 shadow-2xl">
        <header className="flex items-center justify-between">
          <h2 id={titleId} className="text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <button
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
