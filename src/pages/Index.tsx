import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, Legend } from "recharts";
import * as XLSX from "xlsx";
import FloatingActionButton from "@/components/FloatingActionButton";
import QuickAddModal from "@/components/QuickAddModal";
import { createTransaction as createSupabaseTransaction } from "@/services/api/transactions";

// Tipos básicos
interface Categoria { id: string; nome: string; tipo: "Receita" | "Despesa"; centroDeCusto?: string; cor: string }
interface Receita { id: string; data: string; fonte: string; valor: number; categoriaId: string; obs?: string }
interface Despesa { id: string; data: string; descricao: string; valor: number; categoriaId: string; forma: string; parcelas: number; vencimento: string; pago: boolean; obs?: string; cartao?: string }
interface CompraItem { id: string; data: string; estabelecimento: string; item: string; quantidade: number; valorUnit: number; valorTotal: number; categoriaId: string; forma: string; notaUrl?: string; compraId: string }
interface Planejamento { mes: string; receitaPrevista: number; despesaPrevista: number; comentarios?: string }

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM

const Index: React.FC = () => {
  // Categorias iniciais
  const [categorias, setCategorias] = React.useState<Categoria[]>([
    { id: "cat-salario", nome: "Salário", tipo: "Receita", cor: "hsl(var(--brand))" },
    { id: "cat-freela", nome: "Freelas", tipo: "Receita", cor: "hsl(var(--brand-alt))" },
    { id: "cat-reembolso", nome: "Reembolsos", tipo: "Receita", cor: "hsl(var(--accent-foreground))" },
    { id: "cat-invest", nome: "Investimentos", tipo: "Receita", cor: "hsl(var(--primary))" },
    { id: "cat-mercado", nome: "Supermercado", tipo: "Despesa", cor: "#22c55e" },
    { id: "cat-moradia", nome: "Moradia", tipo: "Despesa", cor: "#ef4444" },
    { id: "cat-transp", nome: "Transporte", tipo: "Despesa", cor: "#f59e0b" },
    { id: "cat-lazer", nome: "Lazer", tipo: "Despesa", cor: "#3b82f6" },
  ]);

  const [receitas, setReceitas] = React.useState<Receita[]>([]);
  const [despesas, setDespesas] = React.useState<Despesa[]>([]);
  const [compras, setCompras] = React.useState<CompraItem[]>([]);
  const [planejamento, setPlanejamento] = React.useState<Planejamento[]>([]);

  // Quick Add (FAB)
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [quickAddType, setQuickAddType] = React.useState<'income'|'expense'|'purchase'>('expense');

  async function handleQuickAddSubmit(payload: { type: 'income'|'expense'|'purchase'; date: string; description: string; amount: number; categoryId?: string; paymentMethod?: string; }) {
    try {
      // Otimismo local
      if (payload.type === 'income') {
        setReceitas(prev => [...prev, { id: crypto.randomUUID(), data: payload.date, fonte: payload.description, valor: payload.amount, categoriaId: payload.categoryId || '', obs: 'Quick Add' }]);
      } else if (payload.type === 'expense') {
        setDespesas(prev => [...prev, { id: crypto.randomUUID(), data: payload.date, descricao: payload.description, valor: payload.amount, categoriaId: payload.categoryId || '', forma: payload.paymentMethod || 'Cartão', parcelas: 1, vencimento: payload.date, pago: false, obs: 'Quick Add' }]);
      }

      // Persistência Supabase (best-effort)
      await createSupabaseTransaction({
        date: new Date(payload.date).toISOString(),
        description: payload.description || (payload.type === 'income' ? 'Receita rápida' : 'Despesa rápida'),
        amount: Number(payload.amount),
        category_id: payload.categoryId,
        payment_method: payload.paymentMethod,
        is_paid: payload.type === 'expense' ? false : true,
        source: 'manual',
      });
      toast({ title: 'Lançamento salvo', description: 'Sincronizado com Supabase.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Salvo localmente', description: 'Não foi possível sincronizar agora. Verifique a configuração do Supabase.' });
    }
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = `${anoAtual}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Distribuição de parcelas por mês (para cálculos e faturas)
  function parcelasPorMes(d: Despesa) {
    const partes: { mes: string; valor: number; cartao?: string }[] = [];
    const primeira = new Date(d.vencimento);
    for (let i = 0; i < Math.max(1, d.parcelas || 1); i++) {
      const data = new Date(primeira);
      data.setMonth(primeira.getMonth() + i);
      partes.push({ mes: monthKey(data.toISOString()), valor: d.valor / Math.max(1, d.parcelas || 1), cartao: d.cartao });
    }
    return partes;
  }

  // Totais por mês
  const receitasMes = receitas.filter(r => monthKey(r.data) === mesAtual).reduce((s, r) => s + r.valor, 0);
  const despesasMes = despesas.reduce((s, d) => s + parcelasPorMes(d).filter(p => p.mes === mesAtual).reduce((a, p) => a + p.valor, 0), 0);
  const saldoMes = receitasMes - despesasMes;

  const receitasAnoPorMes: Record<string, number> = {};
  const despesasAnoPorMes: Record<string, number> = {};
  for (let m = 0; m < 12; m++) {
    const k = `${anoAtual}-${String(m + 1).padStart(2, "0")}`;
    receitasAnoPorMes[k] = receitas.filter(r => monthKey(r.data) === k).reduce((s, r) => s + r.valor, 0);
    despesasAnoPorMes[k] = despesas.reduce((s, d) => s + parcelasPorMes(d).filter(p => p.mes === k).reduce((a, p) => a + p.valor, 0), 0);
  }
  const dataBar = Object.keys(receitasAnoPorMes).map(k => ({ mes: k.slice(5), Receitas: receitasAnoPorMes[k], Despesas: despesasAnoPorMes[k] }));

  // Despesas por categoria (mês atual)
  const despesasPorCategoria: { nome: string; valor: number; cor: string }[] = categorias
    .filter(c => c.tipo === "Despesa")
    .map(c => ({
      nome: c.nome,
      valor: despesas.reduce((s, d) => d.categoriaId === c.id ? s + parcelasPorMes(d).filter(p => p.mes === mesAtual).reduce((a, p) => a + p.valor, 0) : s, 0),
      cor: c.cor,
    }))
    .filter(c => c.valor > 0);

  // Alerta de gasto excessivo: categorias > 35% do total do mês
  const totalDespesasMes = despesasPorCategoria.reduce((s, c) => s + c.valor, 0);
  const categoriasExcesso = despesasPorCategoria.filter(c => totalDespesasMes > 0 && c.valor / totalDespesasMes > 0.35).map(c => c.nome);

  function exportarExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receitas), "Receitas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesas), "Despesas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras), "Compras");

    // Faturas derivadas: por cartão e mês
    const faturas: { cartao: string; mes: string; estabelecimento?: string; valor: number; parcelas: number; categoria?: string; pago?: string; obs?: string }[] = [];
    despesas.forEach(d => {
      if (d.forma.toLowerCase().includes("cart")) {
        parcelasPorMes(d).forEach(p => {
          faturas.push({ cartao: d.cartao || "Cartão", mes: p.mes, valor: p.valor, parcelas: Math.max(1, d.parcelas || 1), obs: d.obs });
        });
      }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(faturas), "Faturas");

    const catSheet = categorias.map(c => ({ Categoria: c.nome, Tipo: c.tipo, CentroDeCusto: c.centroDeCusto || "", Cor: c.cor }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catSheet), "Categorias");

    const plan = planejamento.map(p => ({ Mes: p.mes, ReceitaPrevista: p.receitaPrevista, ReceitaReal: Object.keys(receitasAnoPorMes).includes(p.mes) ? receitas.filter(r => monthKey(r.data) === p.mes).reduce((s, r) => s + r.valor, 0) : 0, DespesaPrevista: p.despesaPrevista, DespesaReal: Object.keys(despesasAnoPorMes).includes(p.mes) ? despesas.reduce((s, d) => s + parcelasPorMes(d).filter(x => x.mes === p.mes).reduce((a, x) => a + x.valor, 0), 0) : 0, Comentarios: p.comentarios || "" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plan), "Planejamento");

    XLSX.writeFile(wb, "planilha-controle-financeiro.xlsx");
    toast({ title: "Exportação concluída", description: "Sua planilha Excel foi gerada." });
  }

  // Form helpers
  const [novaReceita, setNovaReceita] = React.useState<Partial<Receita>>({ data: new Date().toISOString().slice(0,10), valor: 0 });
  const [novaDespesa, setNovaDespesa] = React.useState<Partial<Despesa>>({ data: new Date().toISOString().slice(0,10), parcelas: 1, pago: false, forma: "Cartão", vencimento: new Date().toISOString().slice(0,10) });
  const [novoItem, setNovoItem] = React.useState<Partial<CompraItem>>({ data: new Date().toISOString().slice(0,10), quantidade: 1, valorUnit: 0, valorTotal: 0 });
  const [novoPlano, setNovoPlano] = React.useState<Partial<Planejamento>>({ mes: mesAtual, receitaPrevista: 0, despesaPrevista: 0 });

  function addReceita() {
    if (!novaReceita?.data || !novaReceita?.valor || !novaReceita?.categoriaId) return toast({ title: "Preencha os campos obrigatórios" });
    setReceitas(prev => [...prev, { id: crypto.randomUUID(), data: novaReceita.data!, fonte: novaReceita.fonte || "", valor: Number(novaReceita.valor), categoriaId: novaReceita.categoriaId!, obs: novaReceita.obs }]);
    setNovaReceita({ data: new Date().toISOString().slice(0,10), valor: 0 });
  }
  function addDespesa() {
    if (!novaDespesa?.data || !novaDespesa?.valor || !novaDespesa?.categoriaId) return toast({ title: "Preencha os campos obrigatórios" });
    setDespesas(prev => [...prev, { id: crypto.randomUUID(), data: novaDespesa.data!, descricao: novaDespesa.descricao || "", valor: Number(novaDespesa.valor), categoriaId: novaDespesa.categoriaId!, forma: novaDespesa.forma || "Cartão", parcelas: Number(novaDespesa.parcelas) || 1, vencimento: novaDespesa.vencimento!, pago: !!novaDespesa.pago, obs: novaDespesa.obs, cartao: novaDespesa.cartao }]);
    setNovaDespesa({ data: new Date().toISOString().slice(0,10), parcelas: 1, pago: false, forma: "Cartão", vencimento: new Date().toISOString().slice(0,10) });
  }
  function addItem() {
    if (!novoItem?.data || !novoItem?.estabelecimento || !novoItem?.item || !novoItem?.categoriaId) return toast({ title: "Preencha os campos obrigatórios" });
    const total = Number(novoItem.valorTotal || ((novoItem.valorUnit || 0) * (novoItem.quantidade || 1)));
    const compraId = novoItem.compraId || crypto.randomUUID();
    setCompras(prev => [...prev, { id: crypto.randomUUID(), data: novoItem.data!, estabelecimento: novoItem.estabelecimento!, item: novoItem.item!, quantidade: Number(novoItem.quantidade) || 1, valorUnit: Number(novoItem.valorUnit) || 0, valorTotal: total, categoriaId: novoItem.categoriaId!, forma: novoItem.forma || "Cartão", notaUrl: novoItem.notaUrl, compraId }]);
    setNovoItem({ data: new Date().toISOString().slice(0,10), quantidade: 1, valorUnit: 0, valorTotal: 0 });
  }
  function addPlano() {
    if (!novoPlano?.mes) return toast({ title: "Selecione o mês" });
    setPlanejamento(prev => [...prev.filter(p => p.mes !== novoPlano.mes), { mes: novoPlano.mes!, receitaPrevista: Number(novoPlano.receitaPrevista) || 0, despesaPrevista: Number(novoPlano.despesaPrevista) || 0, comentarios: novoPlano.comentarios }]);
  }

  // Agrupamento de compras por compraId
  const comprasPorCompra = compras.reduce((acc, c) => {
    acc[c.compraId] = acc[c.compraId] || [];
    acc[c.compraId].push(c);
    return acc;
  }, {} as Record<string, CompraItem[]>);

  // Alertas de vencimento/pagamento
  const hojeISO = new Date().toISOString().slice(0,10);

  return (
    <main className="min-h-screen bg-background">
      <header className="container py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Planilha de Controle Financeiro Pessoal</h1>
            <p className="text-muted-foreground mt-2">Dashboard com gráficos, validações, alertas e exportação para Excel.</p>
          </div>
          <Button variant="hero" size="lg" onClick={exportarExcel}>Exportar para Excel (beta)</Button>
        </div>
      </header>

      <section className="container pb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Receitas (mês)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{currency(receitasMes)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Despesas (mês)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{currency(despesasMes)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Saldo (mês)</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${saldoMes < 0 ? "text-destructive" : "text-foreground"}`}>{currency(saldoMes)}</CardContent>
        </Card>
      </section>

      <section className="container grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <Card>
          <CardHeader><CardTitle>Despesas por Categoria (mês)</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={despesasPorCategoria} dataKey="valor" nameKey="nome" innerRadius={60} outerRadius={100}>
                  {despesasPorCategoria.map((c, i) => (
                    <Cell key={i} fill={c.cor} />
                  ))}
                </Pie>
                <Legend />
                <RTooltip formatter={(val: any) => currency(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
            {categoriasExcesso.length > 0 && (
              <p className="mt-3 text-sm text-destructive">Alerta: gastos elevados em {categoriasExcesso.join(", ")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Receitas x Despesas (ano)</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataBar}>
                <XAxis dataKey="mes" />
                <YAxis />
                <Legend />
                <RTooltip formatter={(val: any) => currency(Number(val))} />
                <Bar dataKey="Receitas" fill="hsl(var(--brand))" />
                <Bar dataKey="Despesas" fill="hsl(var(--accent-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="container pb-16">
        <Tabs defaultValue="receitas" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-7">
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="compras">Compras</TabsTrigger>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
            <TabsTrigger value="sobre">Sobre</TabsTrigger>
          </TabsList>

          <TabsContent value="receitas">
            <Card>
              <CardHeader><CardTitle>Lançar Receita</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={novaReceita.data} onChange={e => setNovaReceita(r => ({...r, data: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Fonte</Label>
                  <Input value={novaReceita.fonte || ""} onChange={e => setNovaReceita(r => ({...r, fonte: e.target.value}))} />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" step="0.01" value={novaReceita.valor ?? 0} onChange={e => setNovaReceita(r => ({...r, valor: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={novaReceita.categoriaId} onValueChange={(v) => setNovaReceita(r => ({...r, categoriaId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.filter(c => c.tipo === "Receita").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input value={novaReceita.obs || ""} onChange={e => setNovaReceita(r => ({...r, obs: e.target.value}))} />
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={addReceita}>Adicionar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle>Receitas</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receitas.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.data}</TableCell>
                        <TableCell>{r.fonte}</TableCell>
                        <TableCell>{currency(r.valor)}</TableCell>
                        <TableCell>{categorias.find(c => c.id === r.categoriaId)?.nome}</TableCell>
                        <TableCell>{r.obs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="despesas">
            <Card>
              <CardHeader><CardTitle>Lançar Despesa</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-8 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={novaDespesa.data} onChange={e => setNovaDespesa(d => ({...d, data: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={novaDespesa.descricao || ""} onChange={e => setNovaDespesa(d => ({...d, descricao: e.target.value}))} />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" step="0.01" value={novaDespesa.valor ?? 0} onChange={e => setNovaDespesa(d => ({...d, valor: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={novaDespesa.categoriaId} onValueChange={(v) => setNovaDespesa(d => ({...d, categoriaId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.filter(c => c.tipo === "Despesa").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forma</Label>
                  <Select value={novaDespesa.forma} onValueChange={(v) => setNovaDespesa(d => ({...d, forma: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Cartão', 'PIX', 'Débito', 'Dinheiro', 'Boleto'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" min={1} value={novaDespesa.parcelas ?? 1} onChange={e => setNovaDespesa(d => ({...d, parcelas: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={novaDespesa.vencimento} onChange={e => setNovaDespesa(d => ({...d, vencimento: e.target.value}))} />
                </div>
                <div>
                  <Label>Pago?</Label>
                  <div className="h-10 flex items-center"><Switch checked={!!novaDespesa.pago} onCheckedChange={(v) => setNovaDespesa(d => ({...d, pago: v}))} /></div>
                </div>
                <div className="md:col-span-2">
                  <Label>Cartão (opcional)</Label>
                  <Input value={novaDespesa.cartao || ""} onChange={e => setNovaDespesa(d => ({...d, cartao: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Observações</Label>
                  <Input value={novaDespesa.obs || ""} onChange={e => setNovaDespesa(d => ({...d, obs: e.target.value}))} />
                </div>
                <div className="md:col-span-8 flex justify-end">
                  <Button onClick={addDespesa}>Adicionar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle>Despesas</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pago?</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesas.map(d => {
                      const venc = d.vencimento;
                      const atrasado = !d.pago && venc < hojeISO;
                      const vencendo = !d.pago && venc >= hojeISO && new Date(venc).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000;
                      return (
                        <TableRow key={d.id} className={atrasado ? "bg-destructive/10" : vencendo ? "bg-accent" : undefined}>
                          <TableCell>{d.data}</TableCell>
                          <TableCell>{d.descricao}</TableCell>
                          <TableCell>{currency(d.valor)}</TableCell>
                          <TableCell>{categorias.find(c => c.id === d.categoriaId)?.nome}</TableCell>
                          <TableCell>{d.forma}{d.cartao ? ` (${d.cartao})` : ''}</TableCell>
                          <TableCell>{d.parcelas}</TableCell>
                          <TableCell>{d.vencimento}</TableCell>
                          <TableCell>{d.pago ? "Sim" : "Não"}</TableCell>
                          <TableCell>{d.obs}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compras">
            <Card>
              <CardHeader><CardTitle>Adicionar Item</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-8 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={novoItem.data} onChange={e => setNovoItem(i => ({...i, data: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Estabelecimento</Label>
                  <Input value={novoItem.estabelecimento || ""} onChange={e => setNovoItem(i => ({...i, estabelecimento: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Item</Label>
                  <Input value={novoItem.item || ""} onChange={e => setNovoItem(i => ({...i, item: e.target.value}))} />
                </div>
                <div>
                  <Label>Qtd</Label>
                  <Input type="number" min={1} value={novoItem.quantidade ?? 1} onChange={e => setNovoItem(i => ({...i, quantidade: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Vlr Unit</Label>
                  <Input type="number" step="0.01" value={novoItem.valorUnit ?? 0} onChange={e => setNovoItem(i => ({...i, valorUnit: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Vlr Total</Label>
                  <Input type="number" step="0.01" value={novoItem.valorTotal ?? 0} onChange={e => setNovoItem(i => ({...i, valorTotal: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={novoItem.categoriaId} onValueChange={(v) => setNovoItem(i => ({...i, categoriaId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categorias.filter(c => c.tipo === "Despesa").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Forma</Label>
                  <Select value={novoItem.forma} onValueChange={(v) => setNovoItem(i => ({...i, forma: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Cartão', 'PIX', 'Débito', 'Dinheiro', 'Boleto'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Nota Fiscal (URL)</Label>
                  <Input value={novoItem.notaUrl || ""} onChange={e => setNovoItem(i => ({...i, notaUrl: e.target.value}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Agrupar em compra</Label>
                  <Input value={novoItem.compraId || ""} onChange={e => setNovoItem(i => ({...i, compraId: e.target.value}))} placeholder="ID da compra (opcional)" />
                </div>
                <div className="md:col-span-8 flex justify-end">
                  <Button onClick={addItem}>Adicionar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle>Compras Agrupadas</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(comprasPorCompra).map(([id, itens]) => {
                  const totalCompra = itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <div key={id} className="mb-6">
                      <div className="flex items-center justify-between py-2">
                        <div className="font-semibold">Compra #{id.slice(0,6)} — {itens[0]?.estabelecimento} — {itens[0]?.data}</div>
                        <div className="text-sm text-muted-foreground">Total: {currency(totalCompra)}</div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Vlr Unit</TableHead>
                            <TableHead>Vlr Total</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Forma</TableHead>
                            <TableHead>Nota</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map(i => (
                            <TableRow key={i.id}>
                              <TableCell>{i.item}</TableCell>
                              <TableCell>{i.quantidade}</TableCell>
                              <TableCell>{currency(i.valorUnit)}</TableCell>
                              <TableCell>{currency(i.valorTotal)}</TableCell>
                              <TableCell>{categorias.find(c => c.id === i.categoriaId)?.nome}</TableCell>
                              <TableCell>{i.forma}</TableCell>
                              <TableCell>{i.notaUrl ? <a className="underline text-primary" href={i.notaUrl} target="_blank" rel="noreferrer">Abrir</a> : "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faturas">
            <Card>
              <CardHeader><CardTitle>Faturas do Cartão (derivadas)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cartão</TableHead>
                      <TableHead>Mês</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Parcelas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesas.filter(d => d.forma.toLowerCase().includes("cart")).flatMap(d => parcelasPorMes(d).map(p => ({...p, cartao: d.cartao || "Cartão", parcelas: Math.max(1, d.parcelas || 1)}))).map((f, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{f.cartao}</TableCell>
                        <TableCell>{f.mes}</TableCell>
                        <TableCell>{currency(f.valor)}</TableCell>
                        <TableCell>{f.parcelas}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">Dica: futuramente poderemos importar CSV/PDF/OCR para conciliar faturas automaticamente.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categorias">
            <Card>
              <CardHeader><CardTitle>Categorias e Centros de Custo</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Cor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{c.nome}</TableCell>
                        <TableCell>{c.tipo}</TableCell>
                        <TableCell>{c.centroDeCusto || '-'}</TableCell>
                        <TableCell><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.cor }} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                  <div>
                    <Label>Categoria</Label>
                    <Input id="cat-nome" placeholder="Nome" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select defaultValue="Despesa" onValueChange={(v) => { (document.getElementById('cat-tipo') as HTMLInputElement).value = v }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Receita">Receita</SelectItem>
                        <SelectItem value="Despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <input id="cat-tipo" hidden defaultValue="Despesa" />
                  </div>
                  <div>
                    <Label>Centro de Custo</Label>
                    <Input id="cat-cc" placeholder="Opcional" />
                  </div>
                  <div>
                    <Label>Cor (HSL/HEX)</Label>
                    <Input id="cat-cor" placeholder="#22c55e" />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button onClick={() => {
                    const nome = (document.getElementById('cat-nome') as HTMLInputElement).value;
                    const tipo = (document.getElementById('cat-tipo') as HTMLInputElement).value as Categoria['tipo'];
                    const cc = (document.getElementById('cat-cc') as HTMLInputElement).value;
                    const cor = (document.getElementById('cat-cor') as HTMLInputElement).value || 'hsl(var(--brand))';
                    if (!nome) return toast({ title: 'Informe o nome da categoria' });
                    setCategorias(prev => [...prev, { id: crypto.randomUUID(), nome, tipo, centroDeCusto: cc, cor }]);
                    ['cat-nome','cat-cc','cat-cor'].forEach(id => (document.getElementById(id) as HTMLInputElement).value = '');
                  }}>Adicionar Categoria</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planejamento">
            <Card>
              <CardHeader><CardTitle>Planejamento Mensal</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>Mês</Label>
                  <Input type="month" value={novoPlano.mes} onChange={e => setNovoPlano(p => ({...p, mes: e.target.value}))} />
                </div>
                <div>
                  <Label>Receita Prevista</Label>
                  <Input type="number" step="0.01" value={novoPlano.receitaPrevista ?? 0} onChange={e => setNovoPlano(p => ({...p, receitaPrevista: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>Despesa Prevista</Label>
                  <Input type="number" step="0.01" value={novoPlano.despesaPrevista ?? 0} onChange={e => setNovoPlano(p => ({...p, despesaPrevista: Number(e.target.value)}))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Comentários</Label>
                  <Input value={novoPlano.comentarios || ''} onChange={e => setNovoPlano(p => ({...p, comentarios: e.target.value}))} />
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={addPlano}>Salvar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Receita Prevista</TableHead>
                      <TableHead>Receita Real</TableHead>
                      <TableHead>Despesa Prevista</TableHead>
                      <TableHead>Despesa Real</TableHead>
                      <TableHead>Saldo Previsto</TableHead>
                      <TableHead>Saldo Real</TableHead>
                      <TableHead>Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planejamento.sort((a,b)=>a.mes.localeCompare(b.mes)).map(p => {
                      const receitaReal = receitas.filter(r => monthKey(r.data) === p.mes).reduce((s, r) => s + r.valor, 0);
                      const despesaReal = despesas.reduce((s, d) => s + parcelasPorMes(d).filter(x => x.mes === p.mes).reduce((a, x) => a + x.valor, 0), 0);
                      const saldoPrev = p.receitaPrevista - p.despesaPrevista;
                      const saldoReal = receitaReal - despesaReal;
                      const dif = saldoReal - saldoPrev;
                      return (
                        <TableRow key={p.mes} className={dif < 0 ? 'bg-destructive/10' : undefined}>
                          <TableCell>{p.mes}</TableCell>
                          <TableCell>{currency(p.receitaPrevista)}</TableCell>
                          <TableCell>{currency(receitaReal)}</TableCell>
                          <TableCell>{currency(p.despesaPrevista)}</TableCell>
                          <TableCell>{currency(despesaReal)}</TableCell>
                          <TableCell>{currency(saldoPrev)}</TableCell>
                          <TableCell>{currency(saldoReal)}</TableCell>
                          <TableCell>{currency(dif)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sobre">
            <Card>
              <CardHeader><CardTitle>Sobre esta planilha</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Estruturada para futura importação por OCR/CSV/PDF e integração com apps (Glide, AppSheet, Notion). Utilize as listas suspensas para validação dos dados.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
      <QuickAddModal
        open={quickAddOpen}
        type={quickAddType}
        categories={(quickAddType === 'income' ? categorias.filter(c => c.tipo === 'Receita') : categorias.filter(c => c.tipo === 'Despesa')).map(c => ({ id: c.id, name: c.nome }))}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={handleQuickAddSubmit}
      />
      <FloatingActionButton onAction={(t) => { setQuickAddType(t); setQuickAddOpen(true); }} />
    </main>
  );
};

export default Index;
