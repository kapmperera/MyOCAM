import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse using XLSX
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json({ error: 'Failed to read file. Please ensure it is a valid Excel or CSV file.' }, { status: 400 });
    }

    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: 'The uploaded file has no sheets.' }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array to dynamically find the header row (skipping merged title rows)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rows.length) {
      return NextResponse.json({ error: 'The uploaded file sheet is empty.' }, { status: 400 });
    }

    // Header normalization keys
    const regNoKeys = ['registrationnumber', 'regno', 'studentid', 'student_id', 'regnumber', 'registration_no', 'reg_no', 'reg_number'];
    const centerKeys = ['registeredcentername', 'center', 'registeredcenter', 'centername', 'registered_center_name', 'registered_center', 'center_name'];

    let headerRowIndex = -1;
    let regColIndex = -1;
    let centerColIndex = -1;

    // Scan first 10 rows to dynamically find the correct header row
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      let foundReg = -1;
      let foundCenter = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (regNoKeys.includes(val)) {
          foundReg = c;
        } else if (centerKeys.includes(val)) {
          foundCenter = c;
        }
      }

      // If both are found in the same row, this is our header row!
      if (foundReg !== -1 && foundCenter !== -1) {
        headerRowIndex = r;
        regColIndex = foundReg;
        centerColIndex = foundCenter;
        break;
      }
    }

    // Fallback: If no custom dynamic headers are matched, check the standard XLSX keys (in case of objects)
    if (headerRowIndex === -1) {
      const rawData = XLSX.utils.sheet_to_json(worksheet);
      if (rawData.length > 0) {
        const firstRow = rawData[0];
        const rowKeys = Object.keys(firstRow);
        
        const findHeaderKey = (keys) => {
          return rowKeys.find(rowKey => {
            const normalized = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            return keys.includes(normalized);
          });
        };

        const regNoHeader = findHeaderKey(regNoKeys);
        const centerHeader = findHeaderKey(centerKeys);

        if (regNoHeader && centerHeader) {
          // Process from rawData objects
          const mappings = [];
          const seenRegNumbers = new Set();

          for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            const regVal = String(row[regNoHeader] ?? '').trim();
            const centerVal = String(row[centerHeader] ?? '').trim();

            if (!regVal) continue;

            if (!centerVal) {
              return NextResponse.json({
                error: `Validation error at row ${i + 2}: Registered Center Name cannot be empty for student '${regVal}'.`
              }, { status: 400 });
            }

            if (seenRegNumbers.has(regVal)) {
              return NextResponse.json({
                error: `Validation error at row ${i + 2}: Duplicate registration number '${regVal}' found.`
              }, { status: 400 });
            }

            seenRegNumbers.add(regVal);
            mappings.push({
              registrationNumber: regVal,
              centerName: centerVal
            });
          }

          if (mappings.length > 0) {
            await prisma.$transaction([
              prisma.centerMapping.deleteMany(),
              ...mappings.map(m => prisma.centerMapping.create({ data: m }))
            ]);

            return NextResponse.json({
              success: true,
              count: mappings.length,
              message: `Successfully imported ${mappings.length} student-center mappings.`
            });
          }
        }
      }

      return NextResponse.json({
        error: `Could not identify required columns. Your file must have columns matching 'Registration Number' and 'Registered Center Name'.`
      }, { status: 400 });
    }

    // Process rows starting from the row after the header
    const mappings = [];
    const seenRegNumbers = new Set();

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      const regVal = String(row[regColIndex] ?? '').trim();
      const centerVal = String(row[centerColIndex] ?? '').trim();

      if (!regVal) {
        continue; // Skip empty rows
      }

      if (!centerVal) {
        return NextResponse.json({
          error: `Validation error at row ${r + 1}: Registered Center Name cannot be empty for student '${regVal}'.`
        }, { status: 400 });
      }

      if (seenRegNumbers.has(regVal)) {
        return NextResponse.json({
          error: `Validation error at row ${r + 1}: Duplicate registration number '${regVal}' found.`
        }, { status: 400 });
      }

      seenRegNumbers.add(regVal);
      mappings.push({
        registrationNumber: regVal,
        centerName: centerVal
      });
    }

    if (!mappings.length) {
      return NextResponse.json({ error: 'No valid student rows found in the mapping file.' }, { status: 400 });
    }

    // Save in transaction: delete old center mappings and insert new
    await prisma.$transaction([
      prisma.centerMapping.deleteMany(),
      ...mappings.map(m => prisma.centerMapping.create({ data: m }))
    ]);

    return NextResponse.json({
      success: true,
      count: mappings.length,
      message: `Successfully imported ${mappings.length} student-center mappings.`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
