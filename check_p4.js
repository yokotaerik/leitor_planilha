import XLSX from 'xlsx';
const wb = XLSX.readFile(process.argv[2]);
const ws = wb.Sheets['Planilha4'];
const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
console.log("Colunas Reais da Planilha4:", headers);
