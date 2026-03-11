import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Reads a File object and returns its text content.
 * Supports: PDF, images (OCR), DOCX, TXT, MD
 */
export async function readDocument(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    return await readPDF(file, onProgress);
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'heic'].includes(ext)) {
    return await readImageOCR(file, onProgress);
  }

  if (ext === 'docx') {
    return await readDOCX(file);
  }

  if (['txt', 'md', 'csv'].includes(ext)) {
    return await readTextFile(file);
  }

  throw new Error(`Formato "${ext}" não suportado. Use PDF, imagem, DOCX ou TXT.`);
}

/**
 * Extracts text from a PDF using pdfjs-dist.
 */
async function readPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100), `Lendo página ${i} de ${pdf.numPages}...`);
  }

  return fullText.trim();
}

/**
 * Reads text from an image using Tesseract.js OCR.
 */
async function readImageOCR(file, onProgress) {
  if (onProgress) onProgress(5, 'Iniciando reconhecimento de texto...');

  const worker = await createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        const percent = Math.round(m.progress * 100);
        onProgress(percent, `Reconhecendo texto: ${percent}%`);
      }
    },
  });

  const imageUrl = URL.createObjectURL(file);
  const { data: { text } } = await worker.recognize(imageUrl);
  await worker.terminate();
  URL.revokeObjectURL(imageUrl);

  if (onProgress) onProgress(100, 'Texto reconhecido com sucesso!');
  return text.trim();
}

/**
 * Reads a .docx file using mammoth.js.
 */
async function readDOCX(file) {
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

/**
 * Reads a plain text file.
 */
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.trim());
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

export const SUPPORTED_FORMATS = [
  '.pdf',
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff',
  '.docx',
  '.txt', '.md',
];

export const ACCEPT_STRING = SUPPORTED_FORMATS.join(',');
