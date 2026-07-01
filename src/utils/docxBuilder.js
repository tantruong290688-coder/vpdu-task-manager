/**
 * docxBuilder — Dựng file .docx (OOXML) hoàn toàn bằng code, không cần template.
 * Zip bằng PizZip, tải bằng file-saver. Font mặc định Times New Roman.
 *
 * Đơn vị Word: 1 inch = 1440 twips ; 1 pt cỡ chữ = 2 đơn vị sz.
 * Khổ A4 11906×16838 twips; lề chuẩn hành chính: trên/dưới 20mm, trái 30mm, phải 15mm.
 */
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

const FONT = 'Times New Roman';
const USABLE_WIDTH = 9355; // 11906 - left 1701 - right 850

export const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
));

const rPr = ({ bold, italic, size = 26, color } = {}) =>
  `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${bold ? '<w:b/><w:bCs/>' : ''}${italic ? '<w:i/><w:iCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;

// 1 run, hỗ trợ xuống dòng \n
const run = (text, opts = {}) => {
  const parts = String(text ?? '').split('\n');
  const body = parts.map((p, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(p)}</w:t>`).join('');
  return `<w:r>${rPr(opts)}${body}</w:r>`;
};

/**
 * Đoạn văn. content: string | mảng {text, ...opts}
 */
export const para = (content, { align = 'left', bold, italic, size = 26, spacingAfter = 60, spacingBefore = 0, indent } = {}) => {
  const runs = Array.isArray(content)
    ? content.map(r => run(r.text, { bold: r.bold ?? bold, italic: r.italic ?? italic, size: r.size ?? size, color: r.color })).join('')
    : run(content, { bold, italic, size });
  const ind = indent ? `<w:ind w:firstLine="${indent}"/>` : '';
  const pPr = `<w:pPr><w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="276" w:lineRule="auto"/><w:jc w:val="${align}"/>${ind}<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${size}"/></w:rPr></w:pPr>`;
  return `<w:p>${pPr}${runs}</w:p>`;
};

export const emptyPara = (size = 16) => para('', { size, spacingAfter: 0 });

/**
 * Ô bảng. content: string | mảng đoạn (chuỗi XML <w:p>)
 */
export const cell = (content, { width, bold, italic, align = 'left', size = 24, fill, gridSpan, vMerge, valign = 'center' } = {}) => {
  const inner = Array.isArray(content)
    ? content.join('')
    : para(content, { align, bold, italic, size, spacingAfter: 0 });
  const tcPr =
    `<w:tcPr>` +
    (width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '') +
    (gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : '') +
    (vMerge ? `<w:vMerge w:val="${vMerge}"/>` : '') +
    (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '') +
    `<w:vAlign w:val="${valign}"/>` +
    `</w:tcPr>`;
  return `<w:tc>${tcPr}${inner || para('', { size, spacingAfter: 0 })}</w:tc>`;
};

export const row = (cells, { header } = {}) =>
  `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;

/**
 * Bảng. colWidths: mảng twips (tổng ~9355).
 */
export const table = (rows, colWidths = []) => {
  const grid = colWidths.length
    ? `<w:tblGrid>${colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
    : '';
  const borders = `<w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b =>
      `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('') +
    `</w:tblBorders>`;
  const tblPr = `<w:tblPr><w:tblW w:w="${colWidths.reduce((a, b) => a + b, 0) || USABLE_WIDTH}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr>`;
  return `<w:tbl>${tblPr}${grid}${rows.join('')}</w:tbl>`;
};

const SECT = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

/** Header quốc hiệu - tiêu ngữ (bảng 2 cột không viền) */
export const buildDocx = (bodyXml) => {
  const docXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}${SECT}</w:body></w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`);
  zip.file('_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`);
  zip.file('word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  zip.file('word/document.xml', docXml);

  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
};

export const saveDocx = (bodyXml, fileName) => saveAs(buildDocx(bodyXml), fileName);

/** Khối tiêu đề quốc hiệu/tiêu ngữ + cơ quan (bảng 2 cột, không viền) */
export const headerBlock = ({ orgTop = 'ĐẢNG ỦY XÃ TRÀ BỒNG', orgSub = 'VĂN PHÒNG', place = 'Trà Bồng' } = {}) => {
  const left = [
    para(orgTop, { align: 'center', bold: true, size: 24, spacingAfter: 0 }),
    orgSub ? para(orgSub, { align: 'center', bold: true, size: 24, spacingAfter: 0 }) : '',
    para('★', { align: 'center', size: 20, spacingAfter: 0 }),
  ].join('');
  const right = [
    para('ĐẢNG CỘNG SẢN VIỆT NAM', { align: 'center', bold: true, size: 26, spacingAfter: 0 }),
    para([{ text: `${place}, ngày … tháng … năm …`, italic: true }], { align: 'center', size: 24, spacingAfter: 0 }),
  ].join('');
  const noBorder = `<w:tblPr><w:tblW w:w="${USABLE_WIDTH}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`;
  const grid = `<w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="5355"/></w:tblGrid>`;
  const r = `<w:tr><w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${left}</w:tc><w:tc><w:tcPr><w:tcW w:w="5355" w:type="dxa"/></w:tcPr>${right}</w:tc></w:tr>`;
  return `<w:tbl>${noBorder}${grid}${r}</w:tbl>`;
};

export { USABLE_WIDTH };
