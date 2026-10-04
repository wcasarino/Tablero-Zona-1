import React from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';

interface DownloadExcelButtonProps {
  filename?: string;
  sheetName?: string;
  data?: any[];
  tableRef?: React.RefObject<HTMLElement | null>;
  onClick?: () => void;
  title?: string;
}

export default function DownloadExcelButton({
  filename = 'datos',
  sheetName = 'Datos',
  data,
  tableRef,
  onClick,
  title = 'Descargar XLSX',
}: DownloadExcelButtonProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (onClick) {
        onClick();
        return;
      }

      if (data && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
        XLSX.writeFile(wb, `${filename}.xlsx`);
        return;
      }

      if (tableRef && tableRef.current) {
        const tableEl = tableRef.current.querySelector('table') || tableRef.current;
        const ws = XLSX.utils.table_to_sheet(tableEl);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
        XLSX.writeFile(wb, `${filename}.xlsx`);
        return;
      }
    } catch (err) {
      console.error('Error generating Excel file:', err);
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-emerald-600 transition-colors"
      title={title}
      type="button"
    >
      <FileSpreadsheet size={14} />
    </button>
  );
}
