/**
 * Unified Prompt Templates
 * Centralizes all Gemini prompts and replaces duplicate prompt logic
 */

import { ProcessOptions } from './Interfaces';

export class PromptTemplates {
  /**
   * Main extraction prompt for product data
   * This is the unified prompt that replaces all old prompts
   */
  static buildExtractionPrompt(options: ProcessOptions = {}): string {
    const useCompactFormat = options.useCompactFormat || false;
    const preferredLanguage = options.preferredLanguage || 'Indonesian';
    const currency = options.currency || 'IDR';
    
    const formatExample = useCompactFormat 
      ? `[{"n":"Beras Premium","p":15000,"u":"kg","c":"Bahan Pokok","s":0.95}, {"n":"Minyak Goreng","p":25000,"u":"liter","c":"Minyak","s":0.9}]`
      : `[{"name":"Beras Premium","price":15000,"unit":"kg","category":"Bahan Pokok","confidence":0.95}, {"name":"Minyak Goreng","price":25000,"unit":"liter","category":"Minyak","confidence":0.9}]`;

    const formatInstructions = useCompactFormat
      ? `Use COMPACT format: {"n":"name","p":price,"u":"unit","c":"category","s":confidence}`
      : `Use STANDARD format: {"name":"name","price":price,"unit":"unit","category":"category","confidence":confidence}`;

    return `Anda adalah ahli ekstraksi data yang menganalisis dokumen supplier makanan dan minuman di Indonesia (HORECA - Hotel, Restaurant, Cafe).

TUGAS: Ekstrak SEMUA produk dari dokumen ini dalam format JSON array.

ATURAN EKSTRAKSI:
1. **Nama Produk**: Ekstrak nama lengkap produk persis seperti tertulis
2. **Harga**: Konversi semua format harga Indonesia ke angka:
   - "15k", "15rb" → 15000
   - "2.5jt", "2,5juta" → 2500000  
   - "Rp 10.000" → 10000
   - Jika tidak ada harga, gunakan null
3. **Unit**: Ekstrak unit kemasan (kg, liter, dus, karton, pcs, dll)
4. **Kategori**: Tentukan kategori berdasarkan jenis produk
5. **Confidence**: Skor kepercayaan 0.0-1.0 berdasarkan kejelasan data

FORMAT OUTPUT: ${formatInstructions}
${formatExample}

PENTING:
- Ekstrak SEMUA produk yang terlihat, jangan ada yang terlewat
- Bahasa utama: ${preferredLanguage}
- Mata uang: ${currency}
- Jika data tidak jelas, tetap ekstrak dengan confidence rendah
- TIDAK ada penjelasan tambahan, HANYA JSON array

MULAI EKSTRAKSI:`;
  }

  /**
   * Batch processing prompt for large datasets
   */
  static buildBatchPrompt(batchNumber: number, totalBatches: number, options: ProcessOptions = {}): string {
    const basePrompt = this.buildExtractionPrompt(options);
    
    return `${basePrompt}

BATCH INFO: Ini adalah batch ${batchNumber} dari ${totalBatches} batch total.
Ekstrak SEMUA produk dari bagian data ini.`;
  }

  /**
   * Document type detection prompt
   */
  static buildDocumentTypePrompt(): string {
    return `Analisis dokumen ini dan tentukan jenisnya.

JENIS DOKUMEN YANG MUNGKIN:
- "price_list": Daftar harga produk
- "invoice": Faktur/tagihan
- "catalog": Katalog produk
- "order": Pesanan/order form
- "unknown": Tidak dapat ditentukan

Berikan jawaban dalam format JSON:
{"documentType": "jenis_dokumen", "confidence": skor_kepercayaan_0_sampai_1}

MULAI ANALISIS:`;
  }

  /**
   * Supplier information extraction prompt
   */
  static buildSupplierExtractionPrompt(): string {
    return `Ekstrak informasi supplier dari dokumen ini.

INFORMASI YANG DICARI:
- Nama perusahaan/supplier
- Email
- Nomor telepon
- Alamat
- Website (jika ada)
- Nama contact person (jika ada)

FORMAT OUTPUT JSON:
{
  "name": "nama_supplier",
  "email": "email@example.com",
  "phone": "nomor_telepon",
  "address": "alamat_lengkap",
  "website": "website_url",
  "contactPerson": "nama_contact"
}

Jika informasi tidak ditemukan, gunakan null untuk field tersebut.

MULAI EKSTRAKSI:`;
  }

  /**
   * Quality assessment prompt
   */
  static buildQualityAssessmentPrompt(): string {
    return `Evaluasi kualitas ekstraksi data dari dokumen ini.

KRITERIA PENILAIAN:
1. Kelengkapan data (0.0-1.0)
2. Kejelasan informasi (0.0-1.0)
3. Akurasi format (0.0-1.0)
4. Konsistensi data (0.0-1.0)

FORMAT OUTPUT:
{
  "extractionQuality": skor_rata_rata_0_sampai_1,
  "completeness": skor_kelengkapan,
  "clarity": skor_kejelasan,
  "accuracy": skor_akurasi,
  "consistency": skor_konsistensi,
  "notes": "catatan_evaluasi"
}

MULAI EVALUASI:`;
  }

  /**
   * Error recovery prompt for failed extractions
   */
  static buildErrorRecoveryPrompt(errorType: string): string {
    return `Terjadi error dalam ekstraksi: ${errorType}

Coba ekstrak data dengan metode alternatif:
1. Fokus pada data yang paling jelas terlihat
2. Abaikan bagian yang rusak/tidak terbaca
3. Berikan confidence score rendah untuk data yang meragukan

${this.buildExtractionPrompt({ useCompactFormat: true })}`;
  }

  /**
   * Validation prompt for extracted data
   */
  static buildValidationPrompt(): string {
    return `Validasi data produk yang telah diekstrak.

VALIDASI YANG DIPERLUKAN:
1. Apakah nama produk masuk akal?
2. Apakah harga realistis untuk produk HORECA Indonesia?
3. Apakah unit kemasan sesuai?
4. Apakah kategori tepat?

FORMAT OUTPUT:
{
  "isValid": true/false,
  "issues": ["list_masalah_jika_ada"],
  "suggestions": ["saran_perbaikan"],
  "validatedCount": jumlah_produk_valid,
  "totalCount": total_produk
}

MULAI VALIDASI:`;
  }

  /**
   * Standardization prompt for units and categories
   */
  static buildStandardizationPrompt(): string {
    return `Standardisasi unit dan kategori produk Indonesia.

UNIT STANDAR:
- Berat: kg, gram, ton
- Volume: liter, ml
- Kemasan: dus, karton, box, pcs, pack
- Porsi: porsi, serving

KATEGORI STANDAR:
- Bahan Pokok (beras, minyak, gula, dll)
- Protein (daging, ayam, ikan, telur)
- Sayuran & Buah
- Minuman
- Bumbu & Rempah
- Frozen Food
- Dry Goods
- Cleaning Supplies

FORMAT OUTPUT: JSON dengan field tambahan standardizedUnit dan standardizedCategory

MULAI STANDARDISASI:`;
  }

  /**
   * Build prompt based on processing strategy
   */
  static buildPromptForStrategy(strategy: string, options: ProcessOptions = {}): string {
    switch (strategy) {
      case 'compact':
        return this.buildExtractionPrompt({ ...options, useCompactFormat: true });
      
      case 'batch':
        const batchNumber = options.batchSize || 1;
        return this.buildBatchPrompt(batchNumber, 1, options);
      
      case 'validation':
        return this.buildValidationPrompt();
      
      case 'standardization':
        return this.buildStandardizationPrompt();
      
      case 'supplier':
        return this.buildSupplierExtractionPrompt();
      
      case 'quality':
        return this.buildQualityAssessmentPrompt();
      
      default:
        return this.buildExtractionPrompt(options);
    }
  }

  /**
   * Get prompt statistics
   */
  static getPromptStats(prompt: string) {
    return {
      length: prompt.length,
      wordCount: prompt.split(/\s+/).length,
      estimatedTokens: Math.ceil(prompt.length / 4), // Rough estimate
      lines: prompt.split('\n').length
    };
  }

  /**
   * Optimize prompt for token limits
   */
  static optimizePrompt(prompt: string, maxTokens: number = 2000): string {
    const stats = this.getPromptStats(prompt);
    
    if (stats.estimatedTokens <= maxTokens) {
      return prompt;
    }

    // Remove examples and detailed explanations if too long
    return prompt
      .replace(/CONTOH:[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '')
      .replace(/PENJELASAN:[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }
}