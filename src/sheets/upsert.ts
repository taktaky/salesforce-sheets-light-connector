const ID_COLUMN = 'Id';

function ensureSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): GoogleAppsScript.Spreadsheet.Sheet {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function collectColumns(records: Record<string, string>[]): string[] {
  const columns = new Set<string>();
  for (const record of records) {
    Object.keys(record).forEach((key) => columns.add(key));
  }

  const ordered = Array.from(columns).sort((a, b) => a.localeCompare(b));
  if (!ordered.includes(ID_COLUMN)) {
    throw new Error('SOQL 結果に Id 列がありません。SELECT に Id を含めてください。');
  }

  ordered.splice(ordered.indexOf(ID_COLUMN), 1);
  ordered.unshift(ID_COLUMN);
  return ordered;
}

function buildRow(headers: string[], record: Record<string, string>, previous?: string[]): string[] {
  return headers.map((header, index) => {
    if (record[header] !== undefined) {
      return record[header];
    }
    return previous?.[index] ?? '';
  });
}

export function upsertRecords(sheetName: string, records: Record<string, string>[]): number {
  if (records.length === 0) {
    return 0;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet(spreadsheet, sheetName);
  const incomingColumns = collectColumns(records);

  const existingValues = sheet.getDataRange().getValues();
  let headers: string[] = [];
  const rowsById = new Map<string, string[]>();

  if (existingValues.length > 0 && String(existingValues[0][0] ?? '') !== '') {
    headers = existingValues[0].map((cell) => String(cell));
    const idIndex = headers.indexOf(ID_COLUMN);
    if (idIndex >= 0) {
      for (let i = 1; i < existingValues.length; i++) {
        const id = String(existingValues[i][idIndex] ?? '').trim();
        if (id) {
          rowsById.set(id, existingValues[i].map((cell) => String(cell ?? '')));
        }
      }
    }
  } else {
    headers = incomingColumns.slice();
  }

  for (const column of incomingColumns) {
    if (!headers.includes(column)) {
      headers.push(column);
    }
  }

  for (const [, row] of rowsById) {
    while (row.length < headers.length) {
      row.push('');
    }
  }

  for (const record of records) {
    const id = record[ID_COLUMN];
    if (!id) {
      continue;
    }
    const previous = rowsById.get(id);
    rowsById.set(id, buildRow(headers, record, previous));
  }

  const outputRows = [headers, ...rowsById.values()];
  sheet.clearContents();
  sheet.getRange(1, 1, outputRows.length, headers.length).setValues(outputRows);

  return records.length;
}
