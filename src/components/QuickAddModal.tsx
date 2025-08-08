import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type QuickType = "income" | "expense" | "purchase";

interface QuickAddPayload {
  type: QuickType;
  date: string;
  description: string;
  amount: number;
  categoryId?: string;
  paymentMethod?: string;
}

interface Props {
  open: boolean;
  type: QuickType;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (p: QuickAddPayload) => void | Promise<void>;
}

const QuickAddModal: React.FC<Props> = ({ open, type, categories, onClose, onSubmit }) => {
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState<string>("");
  const [amount, setAmount] = React.useState<number>(0);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = React.useState<string>("Cartão");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setAmount(0);
      setCategoryId(undefined);
      setPaymentMethod("Cartão");
      setSubmitting(false);
    }
  }, [open]);

  const title = type === "income" ? "Adicionar Receita" : type === "expense" ? "Adicionar Despesa" : "Adicionar Compra";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preencha os campos para lançar rapidamente.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>{type === "income" ? "Fonte" : "Descrição"}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type !== "income" && (
            <div>
              <Label>Forma de Pagamento</Label>
              <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={async () => {
              setSubmitting(true);
              await onSubmit({ type, date, description, amount, categoryId, paymentMethod });
              setSubmitting(false);
              onClose();
            }}
            disabled={submitting || !date || !amount || !categoryId}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAddModal;
