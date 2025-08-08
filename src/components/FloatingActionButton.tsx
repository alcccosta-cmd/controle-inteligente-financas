import React from "react";
import { Button } from "@/components/ui/button";
import { Receipt, ShoppingCart, Wallet, Plus, X } from "lucide-react";

export type QuickType = "income" | "expense" | "purchase";

interface Props {
  onAction: (type: QuickType) => void;
}

const FloatingActionButton: React.FC<Props> = ({ onAction }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-2">
          <Button variant="secondary" onClick={() => { onAction("income"); setOpen(false); }} aria-label="Adicionar receita">
            <Wallet className="mr-2" /> Receita
          </Button>
          <Button variant="secondary" onClick={() => { onAction("expense"); setOpen(false); }} aria-label="Adicionar despesa">
            <Receipt className="mr-2" /> Despesa
          </Button>
          <Button variant="secondary" onClick={() => { onAction("purchase"); setOpen(false); }} aria-label="Adicionar compra detalhada">
            <ShoppingCart className="mr-2" /> Compra
          </Button>
        </div>
      )}
      <Button variant={open ? "destructive" : "hero"} size="lg" className="rounded-full h-14 w-14 p-0 shadow-[var(--shadow-elevated)]" onClick={() => setOpen(v => !v)} aria-label="Atalho rápido">
        {open ? <X /> : <Plus />}
      </Button>
    </div>
  );
};

export default FloatingActionButton;
