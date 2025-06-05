import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ContractData {
  employeeName?: string;
  position?: string;
  startDate?: string;
  salary?: string;
  companyName?: string;
}

export async function generateHiringAgreementPDF(data: ContractData = {}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Standard letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  const margin = 50;
  let yPosition = height - margin;
  
  const addText = (text: string, fontSize: number = 12, fontType = font, color = rgb(0, 0, 0)) => {
    page.drawText(text, {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: fontType,
      color,
    });
    yPosition -= fontSize + 8;
  };
  
  const addParagraph = (text: string, fontSize: number = 12, fontType = font) => {
    const words = text.split(' ');
    let line = '';
    const maxWidth = width - (margin * 2);
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const textWidth = fontType.widthOfTextAtSize(testLine, fontSize);
      
      if (textWidth > maxWidth && line) {
        addText(line, fontSize, fontType);
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      addText(line, fontSize, fontType);
    }
    yPosition -= 10; // Extra spacing after paragraph
  };
  
  addText('EMPLOYMENT AGREEMENT', 18, boldFont);
  yPosition -= 10;
  
  addParagraph(`This Employment Agreement ("Agreement") is entered into on ${data.startDate || '[DATE]'} between ${data.companyName || 'Vargas JR'} ("Company") and ${data.employeeName || '[EMPLOYEE NAME]'} ("Employee").`);
  
  addText('1. POSITION AND DUTIES', 14, boldFont);
  addParagraph(`Employee is hereby employed as ${data.position || '[POSITION TITLE]'}. Employee agrees to perform such duties and responsibilities as may be assigned by the Company and to devote their full business time and attention to the Company's business.`);
  
  addText('2. COMPENSATION', 14, boldFont);
  addParagraph(`As compensation for services rendered, Employee shall receive an annual salary of ${data.salary || '[SALARY AMOUNT]'}, payable in accordance with Company's standard payroll practices.`);
  
  addText('3. BENEFITS', 14, boldFont);
  addParagraph('Employee shall be entitled to participate in all employee benefit plans and programs maintained by the Company for its employees, subject to the terms and conditions of such plans.');
  
  addText('4. TERM OF EMPLOYMENT', 14, boldFont);
  addParagraph('This Agreement shall commence on the date first written above and shall continue until terminated in accordance with the provisions herein.');
  
  addText('5. CONFIDENTIALITY', 14, boldFont);
  addParagraph('Employee acknowledges that they may have access to confidential and proprietary information of the Company. Employee agrees to maintain the confidentiality of such information and not to disclose it to any third party without prior written consent of the Company.');
  
  addText('6. TERMINATION', 14, boldFont);
  addParagraph('Either party may terminate this Agreement at any time with or without cause upon thirty (30) days written notice to the other party.');
  
  addText('7. GOVERNING LAW', 14, boldFont);
  addParagraph('This Agreement shall be governed by and construed in accordance with the laws of the State of California.');
  
  yPosition -= 30;
  addText('SIGNATURES:', 14, boldFont);
  yPosition -= 20;
  
  addText('Company: _________________________    Date: _________');
  addText(`${data.companyName || 'Vargas JR'}`);
  yPosition -= 20;
  
  addText('Employee: _________________________   Date: _________');
  addText(`${data.employeeName || '[EMPLOYEE NAME]'}`);
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
