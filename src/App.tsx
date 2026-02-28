import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  UploadCloud, 
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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

export default function App() {
  const [data, setData] = useState<RowData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCharts, setShowCharts] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof RowData; direction: 'asc' | 'desc' } | null>(null);

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

  const filtered = useMemo(() => {
    return data.filter(item => {
      const mat = String(item['Material'] || '').toLowerCase();
      const cod = String(item['Código'] || '').toLowerCase();
      return mat.includes(searchTerm.toLowerCase()) || cod.includes(searchTerm.toLowerCase());
    }).sort((a, b) => {
      if (!sortConfig) return 0;
      const av = a[sortConfig.key] ?? '';
      const bv = b[sortConfig.key] ?? '';
      return sortConfig.direction === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [data, searchTerm, sortConfig]);

  const biTotals = useMemo(() => {
    const unitGroups: Record<string, number> = {};
    let totalVenda = 0;
    filtered.forEach(item => {
      totalVenda += Number(item['Valor Venda Estoque']) || 0;
      const unit = String(item['Unidade'] || 'UN').toUpperCase();
      unitGroups[unit] = (unitGroups[unit] || 0) + (Number(item['Quantidade Física']) || 0);
    });
    return { totalVenda, unitSummary: Object.entries(unitGroups) };
  }, [filtered]);

  const categoryData = useMemo(() => {
    const groups: Record<string, number> = {};
    filtered.forEach(item => {
      const mat = String(item['Material'] || '').toUpperCase();
      const cat = ['BALDE', 'CINTA', 'TAMPA', 'PAPEL', 'BOBINA', 'SACO', 'CAIXA'].find(k => mat.includes(k)) || 'OUTROS';
      groups[cat] = (groups[cat] || 0) + (Number(item['Valor Venda Estoque']) || 0);
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(biTotals.totalVenda)}
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

          {/* Filter */}
          <div className="relative border-b border-black">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="PESQUISAR PRODUTO..."
              className="w-full pl-8 py-4 text-sm font-bold outline-none uppercase placeholder:opacity-20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Expandable Charts */}
          <div className="border border-black">
            <button 
              onClick={() => setShowCharts(!showCharts)}
              className="w-full p-4 flex justify-between items-center text-[10px] font-bold uppercase hover:bg-black hover:text-white transition-all"
            >
              Gráficos de Categoria
              {showCharts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCharts && (
              <div className="p-6 h-80 w-full border-t border-black">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                    <Bar dataKey="value" fill="#000" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border-t border-black">
              <thead>
                <tr className="text-[10px] font-bold uppercase border-b border-black">
                  <th className="py-4 px-2">ABC</th>
                  <th className="py-4 px-2 cursor-pointer" onClick={() => setSortConfig({ key: 'Material', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>Material <ArrowUpDown className="inline w-3 h-3"/></th>
                  <th className="py-4 px-2 text-right">Físico</th>
                  <th className="py-4 px-2 text-right">Livre</th>
                  <th className="py-4 px-2 text-right">Venda Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item, i) => (
                  <tr key={i} className="text-[11px] hover:bg-gray-50">
                    <td className="py-4 px-2 font-bold">{item.abcCategory}</td>
                    <td className="py-4 px-2">
                      <p className="font-bold uppercase">{item['Material']}</p>
                      <p className="text-[9px] opacity-40">{item['Código']}</p>
                    </td>
                    <td className="py-4 px-2 text-right tabular-nums">{item['Quantidade Física']} {item['Unidade']}</td>
                    <td className={`py-4 px-2 text-right tabular-nums font-bold ${Number(item['Quantidade Disponível']) < 0 ? 'text-red-600' : ''}`}>{item['Quantidade Disponível']}</td>
                    <td className="py-4 px-2 text-right tabular-nums font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item['Valor Venda Estoque']) || 0)}
                    </td>
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
