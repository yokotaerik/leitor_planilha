import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  UploadCloud, 
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Settings2,
  Check
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

interface RowData {
  'Código'?: string;
  'Material'?: string;
  'Quantidade Disponível'?: number;
  'Quantidade Física'?: number;
  'Unidade'?: string;
  'Valor Venda Unitário'?: number;
  'Valor Venda Estoque'?: number;
  'Cobertura (Dias)'?: number;
  abcCategory?: 'A' | 'B' | 'C';
}

const COLORS = ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#E5E5E5', '#F5F5F5'];

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function App() {
  const [data, setData] = useState<RowData[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [showCharts, setShowCharts] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets['Planilha4'];
        if (!ws) throw new Error('Aba "Planilha4" não encontrada.');
        const range = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let headerIdx = -1;
        for (let i = 0; i < 15; i++) {
          if (range[i]?.some(c => String(c).toLowerCase().includes('material'))) { headerIdx = i; break; }
        }
        const json = XLSX.utils.sheet_to_json<any>(ws, { range: headerIdx !== -1 ? headerIdx : 0 });
        const raw = json.map(r => {
          const n: any = {};
          Object.keys(r).forEach(k => { n[k.trim()] = r[k]; });
          return n;
        }).filter(r => r['Material'] && !String(r['Material']).toLowerCase().includes('total'));

        const totalV = raw.reduce((a, c) => a + (Number(c['Valor Venda Estoque']) || 0), 0);
        const sorted = [...raw].sort((a, b) => (Number(b['Valor Venda Estoque']) || 0) - (Number(a['Valor Venda Estoque']) || 0));
        
        const final = raw.map(item => {
          const idx = sorted.findIndex(s => s['Código'] === item['Código']);
          const sub = sorted.slice(0, idx + 1);
          const cum = sub.reduce((a, c) => a + (Number(c['Valor Venda Estoque']) || 0), 0);
          const p = (cum / totalV) * 100;
          let catABC: 'A' | 'B' | 'C' = p <= 70 ? 'A' : p <= 90 ? 'B' : 'C';
          return { ...item, abcCategory: catABC };
        });
        setData(final);
      } catch (err) { alert('Erro no arquivo'); }
    };
    reader.readAsBinaryString(file);
  };

  const columns = useMemo<ColumnDef<RowData>[]>(() => [
    {
      accessorKey: 'abcCategory',
      header: 'ABC',
      cell: info => <span className="font-bold">{String(info.getValue())}</span>
    },
    {
      accessorKey: 'Código',
      header: 'Código',
    },
    {
      accessorKey: 'Material',
      header: 'Material',
      cell: info => (
        <div>
          <p className="font-bold uppercase leading-tight">{String(info.getValue())}</p>
          <p className="text-[9px] opacity-40">{info.row.original['Código']}</p>
        </div>
      )
    },
    {
      accessorKey: 'Quantidade Física',
      header: 'Físico',
      cell: info => (
        <span className="tabular-nums">
          {Number(info.getValue() || 0).toLocaleString()} {info.row.original['Unidade']}
        </span>
      ),
      meta: { align: 'right' }
    },
    {
      accessorKey: 'Quantidade Disponível',
      header: 'Disponível',
      cell: info => {
        const val = Number(info.getValue() || 0);
        return (
          <span className={`tabular-nums font-bold ${val < 0 ? 'text-red-600' : ''}`}>
            {val.toLocaleString()}
          </span>
        );
      },
      meta: { align: 'right' }
    },
    {
      accessorKey: 'Unidade',
      header: 'UN',
    },
    {
      accessorKey: 'Valor Venda Unitário',
      header: 'Venda Unit.',
      cell: info => formatCurrency(Number(info.getValue() || 0)),
      meta: { align: 'right' }
    },
    {
      accessorKey: 'Valor Venda Estoque',
      header: 'Venda Total',
      cell: info => <span className="font-bold">{formatCurrency(Number(info.getValue() || 0))}</span>,
      meta: { align: 'right' }
    }
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const biTotals = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    const unitGroups: Record<string, number> = {};
    let totalVenda = 0;
    rows.forEach(({ original: item }) => {
      totalVenda += Number(item['Valor Venda Estoque']) || 0;
      const unit = String(item['Unidade'] || 'UN').toUpperCase();
      unitGroups[unit] = (unitGroups[unit] || 0) + (Number(item['Quantidade Física']) || 0);
    });
    return { totalVenda, unitSummary: Object.entries(unitGroups) };
  }, [table.getFilteredRowModel().rows]);

  const categorySummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    const groups: Record<string, { price: number; quantity: number }> = {};
    rows.forEach(({ original: item }) => {
      const mat = String(item['Material'] || '').toUpperCase();
      const cat = ['BALDE', 'CINTA', 'TAMPA', 'PAPEL', 'BOBINA', 'SACO', 'CAIXA'].find(k => mat.includes(k)) || 'OUTROS';
      if (!groups[cat]) groups[cat] = { price: 0, quantity: 0 };
      groups[cat].price += (Number(item['Valor Venda Estoque']) || 0);
      groups[cat].quantity += (Number(item['Quantidade Física']) || 0);
    });
    return Object.entries(groups)
      .map(([name, vals]) => ({ name, price: vals.price, quantity: vals.quantity }))
      .sort((a, b) => b.price - a.price);
  }, [table.getFilteredRowModel().rows]);

  return (
    <div className="min-h-screen bg-white text-black font-sans p-4 md:p-10">
      
      {/* Top - Only Import */}
      <div className="flex justify-end mb-8">
        <label className="flex items-center gap-2 cursor-pointer border border-black px-4 py-2 text-xs font-bold uppercase hover:bg-black hover:text-white transition-all">
          <UploadCloud className="w-4 h-4" />
          Importar Planilha
          <input type="file" accept=".xlsx, .xlsm" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {data.length > 0 && (
        <div className="space-y-10">
          
          {/* Summary - Clean B&W */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-black pb-10">
            <div>
              <p className="text-[10px] font-bold uppercase mb-2">Soma Faturamento (Filtro)</p>
              <p className="text-4xl font-light">
                {formatCurrency(biTotals.totalVenda)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase mb-2">Quantidades por Unidade</p>
              <div className="flex flex-wrap gap-6">
                {biTotals.unitSummary.map(([unit, qty], i) => (
                  <div key={i} className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{Math.round(qty).toLocaleString()}</span>
                    <span className="text-[10px] font-bold opacity-50">{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter & Column Picker */}
          <div className="flex flex-col md:flex-row gap-4 items-center border-b border-black">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
              <input 
                type="text" 
                placeholder="PESQUISAR PRODUTO..."
                className="w-full pl-8 py-4 text-sm font-bold outline-none uppercase placeholder:opacity-20"
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="flex items-center gap-2 px-4 py-4 text-[10px] font-bold uppercase hover:bg-gray-100 transition-all border-l border-black"
              >
                <Settings2 className="w-4 h-4" />
                Colunas
              </button>
              {showColumnPicker && (
                <div className="absolute right-0 top-full z-10 w-48 bg-white border border-black shadow-xl p-2 mt-1">
                  <p className="text-[9px] font-bold uppercase mb-2 px-2 opacity-50">Exibir/Ocultar</p>
                  <div className="space-y-1">
                    {table.getAllLeafColumns().map(column => (
                      <label key={column.id} className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase cursor-pointer hover:bg-gray-50">
                        <div className={`w-3 h-3 border border-black flex items-center justify-center ${column.getIsVisible() ? 'bg-black' : ''}`}>
                          {column.getIsVisible() && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="hidden"
                        />
                        {String(column.columnDef.header)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expandable Charts */}
          <div className="border border-black">
            <button 
              onClick={() => setShowCharts(!showCharts)}
              className="w-full p-4 flex justify-between items-center text-[10px] font-bold uppercase hover:bg-black hover:text-white transition-all"
            >
              Análise de Categorias
              {showCharts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCharts && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-10 border-t border-black">
                {/* Bar Chart - Price */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase text-center">Faturamento por Categoria (BRL)</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categorySummary}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                        <YAxis 
                          tick={{ fontSize: 9 }} 
                          tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          cursor={{fill: '#f5f5f5'}} 
                          formatter={(val: number | string | (number | string)[] | undefined) => [formatCurrency(Number(val) || 0), 'Valor']}
                          labelStyle={{ fontSize: 10, fontWeight: 'bold' }}
                          contentStyle={{ fontSize: 10 }}
                        />
                        <Bar dataKey="price" fill="#000" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart - Quantity */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase text-center">Distribuição de Quantidade</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categorySummary}
                          dataKey="quantity"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }: { name?: string, percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                          fontSize={9}
                          fontWeight="bold"
                        >
                          {categorySummary.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number | string | (number | string)[] | undefined) => [(Number(val) || 0).toLocaleString(), 'Quantidade']}
                          contentStyle={{ fontSize: 10 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border-t border-black">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="text-[10px] font-bold uppercase border-b border-black">
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        className={`py-4 px-2 select-none ${header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-50' : ''} ${(header.column.columnDef.meta as any)?.align === 'right' ? 'text-right' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1 inline-flex">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <div className="w-3 h-3">
                              {{
                                asc: <ChevronUp className="w-3 h-3" />,
                                desc: <ChevronDown className="w-3 h-3" />,
                              }[header.column.getIsSorted() as string] ?? <ArrowUpDown className="w-3 h-3 opacity-20" />}
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="text-[11px] hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        className={`py-4 px-2 ${(cell.column.columnDef.meta as any)?.align === 'right' ? 'text-right' : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
