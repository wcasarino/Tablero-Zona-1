import React from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download } from 'lucide-react';

export default function DownloadPdfButton({ targetRef, filename }: { targetRef: React.RefObject<HTMLElement>, filename: string }) {
  const handleDownload = async () => {
    const element = targetRef.current;
    if (!element) return;

    // Save original styles/classes
    const originalStyles = {
      height: element.style.height,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
    };

    // Find inner scroll/overflow containers and capture original styles
    const overflowContainers = element.querySelectorAll('.overflow-auto, .overflow-y-auto, .overflow-hidden');
    const containerStates = Array.from(overflowContainers).map((el: any) => ({
      el,
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
    }));

    // Find cells that have 'truncate' class or might hold truncated text
    const truncateCells = element.querySelectorAll('.truncate');
    const truncateStates = Array.from(truncateCells).map((el: any) => ({
      el,
      whiteSpace: el.style.whiteSpace,
      overflow: el.style.overflow,
      textOverflow: el.style.textOverflow,
    }));

    // Find buttons and self to hide during PDF capture
    const buttons = element.querySelectorAll('button, .download-btn-wrapper');
    const buttonStates = Array.from(buttons).map((btn: any) => ({
      btn,
      display: btn.style.display,
    }));

    try {
      // 1. Temporarily modify styles to expand completely
      element.style.setProperty('height', 'auto', 'important');
      element.style.setProperty('max-height', 'none', 'important');
      element.style.setProperty('overflow', 'visible', 'important');
      
      // Remove classes that restrict height on the card container
      element.classList.remove('h-40', 'h-56', 'overflow-hidden');

      containerStates.forEach(({ el }) => {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.style.setProperty('overflow-y', 'visible', 'important');
        el.classList.remove('overflow-auto', 'overflow-y-auto', 'overflow-hidden', 'h-40', 'h-56');
      });

      truncateStates.forEach(({ el }) => {
        el.style.setProperty('white-space', 'normal', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.style.setProperty('text-overflow', 'clip', 'important');
        el.classList.remove('truncate');
      });

      buttonStates.forEach(({ btn }) => {
        btn.style.setProperty('display', 'none', 'important');
      });

      // 2. Wait slightly for layout reflow
      await new Promise(resolve => setTimeout(resolve, 200));

      // 3. Capture image with white background to avoid black background issues
      const dataUrl = await toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      // 5. Restore original styles and classes
      element.style.height = originalStyles.height;
      element.style.maxHeight = originalStyles.maxHeight;
      element.style.overflow = originalStyles.overflow;

      if (filename.includes('distribucion-edad-y-sexo')) {
        element.classList.add('h-56', 'overflow-hidden');
      } else {
        element.classList.add('h-40', 'overflow-hidden');
      }

      containerStates.forEach(({ el, height, maxHeight, overflow, overflowY }) => {
        el.style.height = height;
        el.style.maxHeight = maxHeight;
        el.style.overflow = overflow;
        el.style.overflowY = overflowY;
        
        if (el.classList.contains('flex-1')) {
          el.classList.add('overflow-auto');
        } else {
          el.classList.add('overflow-hidden');
        }
      });

      truncateStates.forEach(({ el, whiteSpace, overflow, textOverflow }) => {
        el.style.whiteSpace = whiteSpace;
        el.style.overflow = overflow;
        el.style.textOverflow = textOverflow;
        el.classList.add('truncate');
      });

      buttonStates.forEach(({ btn, display }) => {
        btn.style.display = display;
      });
    }
  };

  return (
    <button 
      onClick={handleDownload}
      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
      title="Descargar PDF"
    >
      <Download size={14} />
    </button>
  );
}
