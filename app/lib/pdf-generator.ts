import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface ContractData {
  contractorName?: string;
  position?: string;
  startDate?: string;
  rate?: string;
  companyName?: string;
}

export async function generateContractorAgreementPDF(
  data: ContractData = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let yPosition = height - margin;

  const addText = (
    text: string,
    fontSize: number = 12,
    fontType = font,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(text, {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: fontType,
      color,
    });
    yPosition -= fontSize + 8;
  };

  const addParagraph = (
    text: string,
    fontSize: number = 12,
    fontType = font
  ) => {
    const words = text.split(" ");
    let line = "";
    const maxWidth = width - margin * 2;

    for (const word of words) {
      const testLine = line + (line ? " " : "") + word;
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
    yPosition -= 10;
  };

  addText("INDEPENDENT CONTRACTOR AGREEMENT", 18, boldFont);
  yPosition -= 10;

  addParagraph(
    `This Independent Contractor Agreement ("Agreement") is entered into on ${
      data.startDate || "[DATE]"
    } between ${
      data.companyName || "[COMPANY NAME]"
    } ("Company") and Vargas JR ("Contractor").`
  );

  addText("1. SERVICES", 14, boldFont);
  addParagraph(
    `Contractor agrees to provide ${
      data.position || "[SERVICES DESCRIPTION]"
    } services to Company. Contractor shall perform such duties and responsibilities as agreed upon by both parties while maintaining independence as a contractor.`
  );

  addText("2. COMPENSATION", 14, boldFont);
  addParagraph(
    `As compensation for services rendered, Company shall pay Contractor ${
      data.rate || "[RATE AMOUNT]"
    }, payable according to the agreed payment schedule.`
  );

  addText("3. TERM OF AGREEMENT", 14, boldFont);
  addParagraph(
    "This Agreement shall commence on the date first written above and shall continue until terminated in accordance with the provisions herein."
  );

  addText("4. CONFIDENTIALITY", 14, boldFont);
  addParagraph(
    "Contractor acknowledges that they may have access to confidential and proprietary information of the Company. Contractor agrees to maintain the confidentiality of such information and not to disclose it to any third party without prior written consent of the Company."
  );

  addText("5. TERMINATION", 14, boldFont);
  addParagraph(
    "Either party may terminate this Agreement at any time with or without cause upon thirty (30) days written notice to the other party."
  );

  addText("6. GOVERNING LAW", 14, boldFont);
  addParagraph(
    "This Agreement shall be governed by and construed in accordance with the laws of the State of Florida."
  );

  yPosition -= 30;
  addText("SIGNATURES:", 14, boldFont);
  yPosition -= 20;

  addText("Company: _________________________    Date: _________");
  addText(`${data.companyName || "[COMPANY NAME]"}`);
  yPosition -= 20;

  addText("Contractor: _________________________   Date: _________");
  addText("Vargas JR");

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
