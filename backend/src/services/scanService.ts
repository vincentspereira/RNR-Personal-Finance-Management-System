import sharp from 'sharp';
import fs from 'fs';
import { query, getClient } from '../db';
import { getVisionProvider } from './vision';
import { validateAccountExists, validateCategoryExists, validateScanExists } from '../utils/validators';


const EXTRACTION_SYSTEM_PROMPT = `You are an expert financial document parser. Extract ALL financial information from this invoice/receipt/bill image with maximum accuracy.

Return ONLY a valid JSON object with this structure:
{
  "document_type": "invoice|receipt|bill|statement|unknown",
  "vendor": {
    "name": "string",
    "address": null,
    "phone": null,
    "email": null,
    "website": null,
    "tax_id": null
  },
  "document_number": null,
  "dates": {
    "document_date": "YYYY-MM-DD or null",
    "due_date": "YYYY-MM-DD or null",
    "service_period": null
  },
  "amounts": {
    "subtotal": null,
    "discount": null,
    "tax": null,
    "tax_rate": null,
    "tips": null,
    "total": 0,
    "amount_paid": null,
    "amount_due": null,
    "currency": "USD"
  },
  "line_items": [
    {
      "description": "string",
      "quantity": null,
      "unit": null,
      "unit_price": null,
      "total": 0
    }
  ],
  "payment": {
    "method": null,
    "reference": null,
    "status": "paid|unpaid|partial|unknown"
  },
  "suggested_category": "string",
  "confidence": 0.0,
  "notes": null
}

If any field is not present in the document, use null. Never hallucinate data. Confidence = your certainty in extraction accuracy.`;

const MULTI_DETECT_PROMPT = `Look at this image. Does it contain multiple separate invoices, receipts, or bills? If yes, describe the bounding regions of each document (e.g., top-left, top-right, bottom section, etc.) and how many there are.

Return ONLY valid JSON: { "multiple_documents": boolean, "count": number, "regions": ["description of region 1", "..."], "layout": "grid|stack|mixed" }`;

async function preprocessImage(filePath: string): Promise<Buffer> {
  return sharp(filePath)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
}

function imageToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

async function callVision(base64Image: string, prompt: string): Promise<string> {
  return getVisionProvider().callVision(base64Image, prompt);
}

function parseJsonResponse(text: string): any {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function detectMultipleDocuments(base64Image: string): Promise<{
  multiple: boolean;
  count: number;
  regions: string[];
}> {
  try {
    const response = await callVision(base64Image, MULTI_DETECT_PROMPT);
    const parsed = parseJsonResponse(response);
    return {
      multiple: parsed.multiple_documents || false,
      count: parsed.count || 1,
      regions: parsed.regions || [],
    };
  } catch {
    return { multiple: false, count: 1, regions: [] };
  }
}

async function extractSingleDocument(base64Image: string): Promise<any> {
  const response = await callVision(base64Image, EXTRACTION_SYSTEM_PROMPT);
  return parseJsonResponse(response);
}

async function extractMultipleDocuments(base64Image: string, count: number): Promise<any[]> {
  const multiPrompt = `This image contains ${count} separate financial documents (invoices, receipts, or bills).
Extract data from EACH document separately.

Return ONLY a valid JSON array where each element follows this structure:
[{
  "document_type": "invoice|receipt|bill|statement|unknown",
  "vendor": {
    "name": "string",
    "address": null,
    "phone": null,
    "email": null,
    "website": null,
    "tax_id": null
  },
  "document_number": null,
  "dates": {
    "document_date": "YYYY-MM-DD or null",
    "due_date": "YYYY-MM-DD or null",
    "service_period": null
  },
  "amounts": {
    "subtotal": null,
    "discount": null,
    "tax": null,
    "tax_rate": null,
    "tips": null,
    "total": 0,
    "amount_paid": null,
    "amount_due": null,
    "currency": "USD"
  },
  "line_items": [],
  "payment": {
    "method": null,
    "reference": null,
    "status": "unknown"
  },
  "suggested_category": "string",
  "confidence": 0.0,
  "notes": null
}]

Process each document independently. If any field is not present, use null. Never hallucinate data.`;

  try {
    const response = await callVision(base64Image, multiPrompt);
    const parsed = parseJsonResponse(response);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Fallback: try single extraction
    const single = await extractSingleDocument(base64Image);
    return [single];
  }
}

async function processFile(filePath: string): Promise<any[]> {
  const processedBuffer = await preprocessImage(filePath);
  const base64Image = imageToBase64(processedBuffer);

  // Check for multiple documents in one image
  const detection = await detectMultipleDocuments(base64Image);

  if (detection.multiple && detection.count > 1) {
    return extractMultipleDocuments(base64Image, detection.count);
  }

  const data = await extractSingleDocument(base64Image);
  return [data];
}

export async function processScan(scanId: string) {
  try {
    // Update status to processing
    await query(`UPDATE scans SET status = 'processing' WHERE id = $1`, [scanId]);

    // Get scan record
    const scanResult = await query('SELECT * FROM scans WHERE id = $1', [scanId]);
    const scan = scanResult.rows[0];
    if (!scan) throw new Error('Scan not found');

    const allDocuments: any[] = [];

    // Check if this is a single file or we need to handle the path
    const filePath = scan.original_path;

    if (fs.existsSync(filePath)) {
      const docs = await processFile(filePath);
      allDocuments.push(...docs);
    }

    // Store raw AI response
    await query(
      `UPDATE scans SET raw_ai_response = $1, document_count = $2 WHERE id = $3`,
      [JSON.stringify(allDocuments), allDocuments.length, scanId]
    );

    // Insert scan_documents for each extracted document
    for (let i = 0; i < allDocuments.length; i++) {
      const doc = allDocuments[i];
      await query(
        `INSERT INTO scan_documents (
          scan_id, document_index, document_type, vendor_name, vendor_address,
          document_date, due_date, invoice_number, subtotal, tax_amount, total_amount,
          currency, line_items, payment_method, confidence_score, raw_extracted_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          scanId, i,
          doc.document_type || 'unknown',
          doc.vendor?.name || null,
          doc.vendor?.address || null,
          doc.dates?.document_date || null,
          doc.dates?.due_date || null,
          doc.document_number || null,
          doc.amounts?.subtotal || null,
          doc.amounts?.tax || null,
          doc.amounts?.total || 0,
          doc.amounts?.currency || 'USD',
          JSON.stringify(doc.line_items || []),
          doc.payment?.method || null,
          doc.confidence || 0,
          JSON.stringify(doc),
        ]
      );
    }

    await query(
      `UPDATE scans SET status = 'completed', processed_at = NOW() WHERE id = $1`,
      [scanId]
    );
  } catch (err: any) {
    console.error(`Scan ${scanId} failed:`, err);
    await query(
      `UPDATE scans SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message, scanId]
    );
  }
}

export async function createScanRecord(userId: string, filename: string, filePath: string) {
  const result = await query(
    `INSERT INTO scans (user_id, filename, original_path, status) VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, filename, filePath]
  );
  return result.rows[0];
}

export async function getScan(id: string, userId: string) {
  const result = await query('SELECT * FROM scans WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0] || null;
}

export async function getScanDocuments(scanId: string) {
  const result = await query(
    'SELECT * FROM scan_documents WHERE scan_id = $1 ORDER BY document_index',
    [scanId]
  );
  return result.rows;
}

export async function listScans(userId: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  const [data, count] = await Promise.all([
    query('SELECT * FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset]),
    query('SELECT COUNT(*) FROM scans WHERE user_id = $1', [userId]),
  ]);
  return {
    rows: data.rows,
    total: parseInt(count.rows[0].count),
    page,
    limit,
    totalPages: Math.ceil(parseInt(count.rows[0].count) / limit),
  };
}

export async function retryScan(scanId: string, userId: string) {
  const scan = await getScan(scanId, userId);
  if (!scan) return null;
  if (scan.status !== 'failed') return null;

  await query(`UPDATE scans SET status = 'pending', error_message = NULL WHERE id = $1`, [scanId]);
  // Clean up old documents
  await query('DELETE FROM scan_documents WHERE scan_id = $1', [scanId]);

  // Re-process asynchronously
  processScan(scanId).catch(console.error);
  return scan;
}

export async function confirmDocuments(userId: string, scanId: string, documents: Array<{
  documentIndex: number;
  categoryId: string;
  accountId: string;
  amount: number;
  description: string;
  merchantName: string;
  transactionDate: string;
}>) {
  // P0-3: Validate scan + accounts + categories all belong to this user
  await validateScanExists(scanId, userId);
  const accountIds = Array.from(new Set(documents.map(d => d.accountId).filter(Boolean)));
  const categoryIds = Array.from(new Set(documents.map(d => d.categoryId).filter(Boolean)));
  await Promise.all([
    ...accountIds.map(id => validateAccountExists(id, userId)),
    ...categoryIds.map(id => validateCategoryExists(id, userId)),
  ]);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    for (const doc of documents) {
      // Create transaction
      const txnResult = await client.query(
        `INSERT INTO transactions (
          user_id, account_id, category_id, type, amount, description, merchant_name,
          transaction_date, source, scan_id
        ) VALUES ($1, $2, $3, 'expense', $4, $5, $6, $7, 'scanned', $8)
        RETURNING id`,
        [userId, doc.accountId, doc.categoryId, doc.amount, doc.description, doc.merchantName,
         doc.transactionDate, scanId]
      );

      // Link transaction to scan_document
      await client.query(
        `UPDATE scan_documents SET transaction_id = $1 WHERE scan_id = $2 AND document_index = $3`,
        [txnResult.rows[0].id, scanId, doc.documentIndex]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
