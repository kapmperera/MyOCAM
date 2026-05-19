import { XMLParser } from "fast-xml-parser";

/**
 * Parses XML content assuming a standard format:
 * <Students>
 *   <Student>
 *     <ID>12345</ID>
 *     <Name>John Doe</Name>
 *     <Mark>85</Mark>
 *   </Student>
 * </Students>
 */
export function parseXMLData(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
  });
  
  const result = parser.parse(xmlContent);
  let students = [];

  try {
    // Navigate SpreadsheetML structure: Workbook -> Worksheet -> Table -> Row
    const worksheet = Array.isArray(result.Workbook.Worksheet) 
      ? result.Workbook.Worksheet[0] 
      : result.Workbook.Worksheet;
    
    const rows = Array.isArray(worksheet.Table.Row) 
      ? worksheet.Table.Row 
      : [worksheet.Table.Row];

    // Skip the first row (header row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.Cell) continue;

      const cells = Array.isArray(row.Cell) ? row.Cell : [row.Cell];
      
      // Cell 0 is Registration Number, Cell 1 is Mark
      if (cells.length >= 2) {
        const idData = cells[0].Data;
        const markData = cells[1].Data;
        
        // The value is inside the text node which fast-xml-parser maps to '#text'
        const id = idData ? (idData['#text'] !== undefined ? idData['#text'] : idData) : null;
        const mark = markData ? (markData['#text'] !== undefined ? markData['#text'] : markData) : 0;

        if (id) {
          students.push({
            id: String(id),
            name: "Unknown", // Name is not provided in this specific XML format
            mark: parseFloat(mark) || 0
          });
        }
      }
    }
  } catch (error) {
    console.error("Error parsing SpreadsheetML:", error);
  }

  return students.filter(s => s.id && s.id !== "undefined");
}

/**
 * Calculates Final OCAM based on CAT marks using official university formulas.
 */
export function calculateOCAM(cat1_1, cat1_2, cat2_1, cat2_2) {
  // Normally the highest or average of entries is taken if multiple exist.
  // Assuming we use the latest entry or best entry for CAT1 and CAT2 if multiple exist,
  // or average them. Since the logic specifies CAT1 and CAT2, we'll pick the highest entry for each CAT
  // or default to 0 if null. If the user expects averaging Entries 1 & 2, we can do that.
  // For safety, let's take the highest of the two entries if both exist, which is standard, 
  // or just average them. We will average them if both are provided, otherwise use the one provided.
  
  const getMark = (entry1, entry2) => {
    if (entry1 !== null && entry2 !== null) return Math.max(entry1, entry2); // usually taking highest entry is standard
    if (entry1 !== null) return entry1;
    if (entry2 !== null) return entry2;
    return 0;
  };

  const cat1 = getMark(cat1_1, cat1_2);
  const cat2 = getMark(cat2_1, cat2_2);
  
  // Step 1: CAT 1 Weighted Mark
  const cat1Weighted = cat1 * 0.40;
  
  // Step 2: CAT 2 Weighted Mark
  const cat2Weighted = cat2 * 0.60;
  
  // Step 3 & 4: Final OCAM Mark & Rounded
  const rawOcam = cat1Weighted + cat2Weighted;
  const finalOCAM = Math.round(rawOcam);
  
  // Step 5: Eligibility Calculation
  let eligibility = "No";
  if (cat1 === 0 && cat2 === 0) {
    eligibility = "AB";
  } else if (finalOCAM >= 35) {
    eligibility = "Yes";
  }

  // Step 6: Performance Band Classification
  let grade = "Fail";
  if (eligibility === "AB") {
    grade = "Absent";
  } else if (finalOCAM >= 80) {
    grade = "Distinction";
  } else if (finalOCAM >= 65) {
    grade = "Merit";
  } else if (finalOCAM >= 50) {
    grade = "Credit";
  } else if (finalOCAM >= 35) {
    grade = "Pass";
  }
  
  return {
    finalOCAM,
    grade,
    passFail: eligibility
  };
}
