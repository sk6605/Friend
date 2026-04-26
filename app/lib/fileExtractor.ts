// 严重声明：此文件属于深层 Node.js 运行时绑定，必须只在 Server Action 或 API 路由里运行。
// 千万不要在任何带 'use client' 的客户端组件里导入它，这会导致前端 Webpack 无法打包 fs/path 引擎。

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import unzipper from 'unzipper';
import type { Entry } from 'unzipper';
import { parseStringPromise } from 'xml2js';
// 采用强大的 mammoth 库进行 docx 的深度抓取
import { extractRawText } from 'mammoth';

/**
 * 后端核心处理枢纽：通用文档结构抽离器（将办公文档扒出纯字符串投喂给 RAG 大模型）
 * 
 * @param {string} filePath 文件保存在服务器 /tmp 这个物理盘的相对或绝对路径
 * @param {string} fileName 供打印报错和抓取校验扩展名的真名
 * @returns {Promise<string>} 被彻底脱去 UI 格式、表格、画笔的裸奔状态纯内文文本
 */
export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
  // 获取小写的后缀名
  const ext = path.extname(fileName).toLowerCase();
  
  try {
    console.log(`📖 Extracting text from ${fileName} (${ext})`);
    console.log(`   File path: ${filePath}`);

    // 利用强行分支判断分发给不同类型的专属抽离函子
    if (ext === '.pdf') {
      return await extractFromPDF(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
      return await extractFromDocx(filePath);
    } else if (ext === '.ppt' || ext === '.pptx') {
      return await extractFromPPT(filePath);
    } else if (ext === '.txt') {
      // txt 最简单，不需要引入外部解析，以 utf8 原生读取法
      return fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await extractFromExcel(filePath);
    }

    // 兜底返回错误警示字符串（这段字符串本身也会被喂给大模型看到，这样大模型可以自然告诉用户：我不支持这东西）
    return `[File type ${ext} not supported for extraction]`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error extracting text from ${fileName}:`, errorMsg);
    return `[Error extracting content from ${fileName}: ${errorMsg}]`;
  }
}

/**
 * 子模块：PDF 脱壳机 
 */
async function extractFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    // 动态引用防御方案：为了规避 `pdf-parse` 的底层依赖 `canvas` 在某些 Vercel 没有底层 c++ 编译器的机器上部署炸雷，
    // 这里采用 inline require 在真正用到的 runtime 时才在内存拉起它。
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(dataBuffer);
    return data.text || '[PDF has no extractable text]';
  } catch (error) {
    // 降级：如果 pdf-parse 崩溃毁坏，至少把 PDF 的大体信息（名字+体积大小）给抽离出来做占位符。
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    console.error('PDF extraction error:', error);
    return `[PDF file: ${fileName} (${(fileSize / 1024).toFixed(2)}KB) - Could not extract text]`;
  }
}

/**
 * 子模块：Word / Docx 解析器
 */
async function extractFromDocx(filePath: string): Promise<string> {
  // 路线 1：走 mammoth 解析路线（优点：对段落、连字符处理极佳，没有乱码）
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(fileBuffer).buffer;
    const result = await extractRawText({ arrayBuffer });
    if (result.value && result.value.trim().length > 0) {
      return result.value; // 如果解析有效直接返回成功值
    }
  } catch (e) {
    console.error('Mammoth failed, falling back to XML extraction:', e);
  }

  // 路线 2 降级补全：强行解压路线 (Fallback)
  // 本质上从 Office2007 起，扩展名为 '.docx' 都可以被看作一个压缩版 ZIP。里面塞满了 XML。
  try {
    const text: string[] = [];
    return new Promise<string>((resolve, reject) => {
      // 架设文件流通过 unzipper 流库一层层深入寻找
      fs.createReadStream(filePath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: Entry) => {
          const entryPath = entry.path;
          // DOCX 将自己人的文字藏在 word/document.xml 下 
          if (entryPath === 'word/document.xml') {
            let xmlContent = '';
            entry.on('data', (chunk: Buffer) => {
              xmlContent += chunk.toString('utf-8');
            });
            entry.on('end', async () => {
              try {
                // 等到拿完了 XML，利用 xml2js 将标签全部废弃，通过递归取用里面包裹的净肉字
                const parsed = await parseStringPromise(xmlContent);
                extractTextFromXML(parsed, text);
              } catch (err) {
                console.error('Error parsing DOCX XML:', err);
              }
            });
          } else {
            entry.autodrain(); // 对长得不像文字包的东西快速排水抛弃以防爆内存
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

/**
 * 子模块：PowerPoint 解析器
 * 特性：一样属于 .ZIP 的底层特性。它被藏在了 "ppt/slides/slideN.xml" 这个循环体当中。
 */
async function extractFromPPT(filePath: string): Promise<string> {
  try {
    const fileName = path.basename(filePath);
    const text: string[] = [];
    
    return new Promise<string>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: Entry) => {
          const entryPath = entry.path;
          
          // 正则匹配所有包含了 "ppt/slides/slide数字.xml" 的目标
          if (entryPath.match(/^ppt\/slides\/slide\d+\.xml$/)) {
            let xmlContent = '';
            entry.on('data', (chunk: Buffer) => {
              xmlContent += chunk.toString('utf-8');
            });
            
            entry.on('end', async () => {
              try {
                const parsed = await parseStringPromise(xmlContent);
                extractTextFromXML(parsed, text); // 全面递归
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
            // 对抽出来的全文字使用切块优化策略
            const formatted = formatSegmentedText(text.join('\n'));
            resolve(formatted);
          }
        });
    });
  } catch (error) {
    throw new Error(`PPT extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 助手递归算子：剥离 XML 外套
 */
function extractTextFromXML(obj: unknown, textArray: string[]): void {
  // 如果是字符串就清洗掉前后没用的空格推进库里
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed) {
      textArray.push(trimmed);
    }
  } else if (Array.isArray(obj)) {
    // 若遇到数组则向下进入循环探究
    for (const item of obj) {
      extractTextFromXML(item, textArray);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    // 遇到嵌套 Object 类也一律向下找，抛弃 Key 的名称不要只要嵌套内容
    for (const key in obj) {
      extractTextFromXML((obj as Record<string, unknown>)[key], textArray);
    }
  }
}

/**
 * 大模型体验优化的辅助函数：“长篇大论打段机”
 * 作用：用 PPT 强行抽出来的句子如果一股脑交出去会造成类似“面条代码”极难阅读。
 * 我们可以人为地在中间基于前缀编号或者标点插入 [SEGMENT_N] 来告诉 AI 这是一个段落边界。
 */
function formatSegmentedText(text: string): string {
  const lines = text.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
  
  // Regex 寻查行头是不是类似于 1) / 1. / - / * 等具有列表引导特性的符号
  const numberPattern = /^(\d+[\.\):\s]|\d+\.|[-•*]\s)/;
  const result: string[] = [];
  let segmentCount = 0;
  
  lines.forEach((line: string) => {
    // 当遇到新一段的列表起手式
    if (numberPattern.test(line) && result.length > 0) {
      result.push(''); // 原文插入空白行
      result.push(`[SEGMENT_${++segmentCount}]`); // 强行插入人造占位签，辅助后续在 RAG 切割时被算法注意
    }
    result.push(line);
  });
  
  return result.join('\n');
}

/**
 * 子模块：Excel (.xlsx) 获取器
 */
async function extractFromExcel(filePath: string): Promise<string> {
  try {
    // 强制声明：一定要用以 NodeJS 环境流 Buffer 取用，因为 XLSX 内部原生的 readFile 对于 Vercel 很多时候根本拿不到对 /tmp 这个内存盘的访问权限。
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    let text = '';
    
    // 把里面的所有“下方的表单卡片页”全遍历出来
    workbook.SheetNames.forEach(sheetName => {
      text += `\n=== Sheet: ${sheetName} ===\n`; // 人为给大模型提供一个 Sheet 标头告诉它是别的表了
      const sheet = workbook.Sheets[sheetName];
      // 利用 CSV 的天性将其还原为文本数据排版
      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      text += csvContent;
    });
    
    const formatted = formatSegmentedText(text);
    return formatted || '[Excel file has no extractable text]';
  } catch (error) {
    throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
