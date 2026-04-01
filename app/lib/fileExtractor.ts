// This file must run on the server only (Node.js APIs: fs, path, unzipper, etc.)
// DO NOT import this in client components

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import unzipper from 'unzipper';
import type { Entry } from 'unzipper';
import { parseStringPromise } from 'xml2js';
import { extractRawText } from 'mammoth';

export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  
  try {
    console.log(`📖 Extracting text from ${fileName} (${ext})`);
    console.log(`   File path: ${filePath}`);

    if (ext === '.pdf') {
      return await extractFromPDF(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
      return await extractFromDocx(filePath);
    } else if (ext === '.ppt' || ext === '.pptx') {
      return await extractFromPPT(filePath);
    } else if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await extractFromExcel(filePath);
    }

    return `[File type ${ext} not supported for extraction]`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error extracting text from ${fileName}:`, errorMsg);
    return `[Error extracting content from ${fileName}: ${errorMsg}]`;
  }
}

async function extractFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    // Dynamic import to avoid canvas dependency at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(dataBuffer);
    return data.text || '[PDF has no extractable text]';
  } catch (error) {
    // Fallback: return file info if pdf-parse fails
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    console.error('PDF extraction error:', error);
    return `[PDF file: ${fileName} (${(fileSize / 1024).toFixed(2)}KB) - Could not extract text]`;
  }
}

async function extractFromDocx(filePath: string): Promise<string> {
  // Try mammoth first (best quality)
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(fileBuffer).buffer;
    const result = await extractRawText({ arrayBuffer });
    if (result.value && result.value.trim().length > 0) {
      return result.value;
    }
  } catch (e) {
    console.error('Mammoth failed, falling back to XML extraction:', e);
  }

  // Fallback: Parse DOCX as ZIP and extract text from word/document.xml
  // (same approach that works for PPTX since DOCX is also a ZIP of XML)
  try {
    const text: string[] = [];
    return new Promise<string>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: Entry) => {
          const entryPath = entry.path;
          // DOCX stores main content in word/document.xml
          if (entryPath === 'word/document.xml') {
            let xmlContent = '';
            entry.on('data', (chunk: Buffer) => {
              xmlContent += chunk.toString('utf-8');
            });
            entry.on('end', async () => {
              try {
                const parsed = await parseStringPromise(xmlContent);
                extractTextFromXML(parsed, text);
              } catch (err) {
                console.error('Error parsing DOCX XML:', err);
              }
            });
          } else {
            entry.autodrain();
          }
        })
        .on('error', (err: Error) => {
          reject(new Error(`DOCX fallback extraction failed: ${err.message}`));
        })
        .on('finish', () => {
          if (text.length === 0) {
            resolve('[DOCX file has no extractable text]');
          } else {
            resolve(text.join('\n'));
          }
        });
    });
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractFromPPT(filePath: string): Promise<string> {
  try {
    const fileName = path.basename(filePath);
    const text: string[] = [];
    
    return new Promise<string>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: Entry) => {
          const entryPath = entry.path;
          
          if (entryPath.match(/^ppt\/slides\/slide\d+\.xml$/)) {
            let xmlContent = '';
            entry.on('data', (chunk: Buffer) => {
              xmlContent += chunk.toString('utf-8');
            });
            
            entry.on('end', async () => {
              try {
                const parsed = await parseStringPromise(xmlContent);
                extractTextFromXML(parsed, text);
              } catch (err) {
                console.error(`Error parsing slide XML: ${entryPath}`, err);
              }
            });
          } else {
            entry.autodrain();
          }
        })
        .on('error', (err: Error) => {
          reject(new Error(`Failed to extract PPTX: ${err.message}`));
        })
        .on('finish', () => {
          if (text.length === 0) {
            resolve(`[PPTX file extracted: ${fileName} - No text content found]`);
          } else {
            const formatted = formatSegmentedText(text.join('\n'));
            resolve(formatted);
          }
        });
    });
  } catch (error) {
    throw new Error(`PPT extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractTextFromXML(obj: unknown, textArray: string[]): void {
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed) {
      textArray.push(trimmed);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTextFromXML(item, textArray);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      extractTextFromXML((obj as Record<string, unknown>)[key], textArray);
    }
  }
}

function formatSegmentedText(text: string): string {
  const lines = text.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
  
  const numberPattern = /^(\d+[\.\):\s]|\d+\.|[-•*]\s)/;
  const result: string[] = [];
  let segmentCount = 0;
  
  lines.forEach((line: string) => {
    if (numberPattern.test(line) && result.length > 0) {
      result.push(''); // Empty line for visual segment separation
      result.push(`[SEGMENT_${++segmentCount}]`); // Explicit segment marker
    }
    result.push(line);
  });
  
  return result.join('\n');
}

async function extractFromExcel(filePath: string): Promise<string> {
  try {
    // Read as buffer and use XLSX.read() instead of XLSX.readFile()
    // readFile uses filesystem access which is unreliable on Vercel serverless
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    let text = '';
    
    workbook.SheetNames.forEach(sheetName => {
      text += `\n=== Sheet: ${sheetName} ===\n`;
      const sheet = workbook.Sheets[sheetName];
      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      text += csvContent;
    });
    
    const formatted = formatSegmentedText(text);
    return formatted || '[Excel file has no extractable text]';
  } catch (error) {
    throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
