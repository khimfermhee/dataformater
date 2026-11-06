/**
 * Data Formatter & CSV Studio
 * Formats all 4 Malen datasets into the 4 requested columns:
 * 1. Name
 * 2. Mailing address
 * 3. personal/home phone
 * 4. email
 *
 * Supported Files:
 * - 2027_NOV_Redacted.txt (47-col pipe, headerless)
 * - Apartment_Master.txt (39-col pipe, EconUnit|LeadParcel|...)
 * - Residential_Master.txt (39-col pipe, ParcelNumber|ProportionComplete|...)
 * - Sales_Affidavits.txt (44-col pipe, PARCELNUMBER|SALEDATE_MMYYYY|...)
 * - Plus any generic CSV / Pipe / Tab / JSON input
 */

const TARGET_4_COLUMNS = [
  { key: "Name", label: "Name", visible: true },
  { key: "Mailing address", label: "Mailing address", visible: true },
  { key: "personal/home phone", label: "personal/home phone", visible: true },
  { key: "email", label: "email", visible: true }
];

const MALEN_DATA = window.MALEN_DATASETS || {
  nov_2027: "",
  apartment_master: "",
  residential_master: "",
  sales_affidavits: ""
};

// Application State
const state = {
  columns: TARGET_4_COLUMNS.map((c) => ({ ...c })),
  rows: [],
  detectedFormat: "All 4 Malen Files",
  sortKey: null,
  sortDir: "asc",
  globalSearch: "",
  columnFilters: {},
  showColFilters: false,
  currentPage: 1,
  pageSize: 50,
  activeView: "table",
  uploadedFiles: [] // Array of File objects when user drops/selects 1 or more .txt files
};

// DOM Elements
const els = {
  workspace: document.querySelector(".workspace"),
  rawInput: document.getElementById("rawInput"),
  detectedFormatBadge: document.getElementById("detectedFormatBadge"),
  formatOverrideSelect: document.getElementById("formatOverrideSelect"),
  trimValuesCheck: document.getElementById("trimValuesCheck"),
  dedupeOnParseCheck: document.getElementById("dedupeOnParseCheck"),
  formatDataBtn: document.getElementById("formatDataBtn"),
  clearInputBtn: document.getElementById("clearInputBtn"),
  sampleSelect: document.getElementById("sampleSelect"),
  loadDefaultSampleBtn: document.getElementById("loadDefaultSampleBtn"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  browseFileBtn: document.getElementById("browseFileBtn"),
  largeFileBanner: document.getElementById("largeFileBanner"),
  lfName: document.getElementById("lfName"),
  lfSize: document.getElementById("lfSize"),
  previewRowLimit: document.getElementById("previewRowLimit"),
  streamFullCsvBtn: document.getElementById("streamFullCsvBtn"),
  streamProgressWrap: document.getElementById("streamProgressWrap"),
  streamProgressBar: document.getElementById("streamProgressBar"),
  streamProgressText: document.getElementById("streamProgressText"),
  toggleInputPanelBtn: document.getElementById("toggleInputPanelBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  rowCountStat: document.getElementById("rowCountStat"),
  colCountStat: document.getElementById("colCountStat"),
  globalSearchInput: document.getElementById("globalSearchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  dedupeBtn: document.getElementById("dedupeBtn"),
  toggleColFiltersBtn: document.getElementById("toggleColFiltersBtn"),
  columnsMenuBtn: document.getElementById("columnsMenuBtn"),
  columnsPopover: document.getElementById("columnsPopover"),
  columnChecklist: document.getElementById("columnChecklist"),
  showAllColsBtn: document.getElementById("showAllColsBtn"),
  hideAllColsBtn: document.getElementById("hideAllColsBtn"),
  tableHead: document.getElementById("tableHead"),
  tableBody: document.getElementById("tableBody"),
  emptyState: document.getElementById("emptyState"),
  dataTable: document.getElementById("dataTable"),
  showingInfo: document.getElementById("showingInfo"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageIndicator: document.getElementById("pageIndicator"),
  tableViewContainer: document.getElementById("tableViewContainer"),
  csvViewContainer: document.getElementById("csvViewContainer"),
  csvPreviewOutput: document.getElementById("csvPreviewOutput"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  copyCsvBtn: document.getElementById("copyCsvBtn"),
  csvOptionsBtn: document.getElementById("csvOptionsBtn"),
  csvOptionsPopover: document.getElementById("csvOptionsPopover"),
  exportFilename: document.getElementById("exportFilename"),
  exportDelimiter: document.getElementById("exportDelimiter"),
  exportFilteredOnly: document.getElementById("exportFilteredOnly"),
  exportIncludeHeaders: document.getElementById("exportIncludeHeaders"),
  exportQuoteAll: document.getElementById("exportQuoteAll"),
  exportBom: document.getElementById("exportBom"),
  toast: document.getElementById("toast")
};

// ==========================================
// 1. SCHEMA AUTO-DETECTION & LINE EXTRACTORS
// ==========================================

function detectLineSchema(line) {
  const trimmed = line.trim();
  if (!trimmed) return "empty";

  const upper = trimmed.toUpperCase();
  if (upper.startsWith("ECONUNIT|LEADPARCEL|")) return "header_skip";
  if (upper.startsWith("PARCELNUMBER|PROPORTIONCOMPLETE|")) return "header_skip";
  if (upper.startsWith("PARCELNUMBER|SALEDATE_MMYYYY|")) return "header_skip";
  if (upper.startsWith("NAME|MAILING ADDRESS") || upper.startsWith("NAME,MAILING ADDRESS")) return "header_skip";

  if (trimmed.includes("|")) {
    const parts = trimmed.split("|");
    // 1. 2027_NOV_Redacted.txt (47 cols, starts with 2-digit county code '07')
    if (parts.length === 47 && /^\d{2}$/.test(parts[0].trim())) {
      return "nov47";
    }
    // 2. Sales_Affidavits.txt (44 cols)
    if (parts.length === 44) {
      return "sales";
    }
    // 3. Apartment_Master.txt vs Residential_Master.txt (both have 39 cols)
    if (parts.length === 39) {
      // Residential_Master has "CLASS R..." or proportion like "1.00" in col 2 (index 1)
      if (/^\d+\.\d+$/.test(parts[1].trim()) || upper.includes("|CLASS ")) {
        return "residential";
      }
      return "apartment";
    }
    return "pipe";
  }

  return "csv";
}

function formatAddressParts(street1, street2, city, state, zip, country) {
  const s1 = (street1 || "").trim();
  const s2 = (street2 || "").trim();
  const c = (city || "").trim();
  const st = (state || "").trim();
  const z = (zip || "").trim();
  const cntry = (country || "").trim();

  const streetFull = [s1, s2].filter(Boolean).join(" ");
  const stateZip = [st, z].filter(Boolean).join(" ");
  const addrParts = [streetFull, c, stateZip].filter(Boolean);

  if (cntry && cntry.toUpperCase() !== "USA") {
    addrParts.push(cntry);
  }
  return addrParts.join(", ");
}

/**
 * Extracts { Name, "Mailing address", "personal/home phone", email } from any line
 * across 2027_NOV_Redacted.txt, Apartment_Master.txt, Residential_Master.txt, and Sales_Affidavits.txt
 */
function parseLineToFourColumns(line, overrideFormat = "auto") {
  const schema = overrideFormat === "auto" ? detectLineSchema(line) : overrideFormat;
  if (schema === "empty" || schema === "header_skip") return null;

  // Check if it's a header line even when overrideFormat is set
  const upper = line.trim().toUpperCase();
  if (
    upper.startsWith("ECONUNIT|LEADPARCEL|") ||
    upper.startsWith("PARCELNUMBER|PROPORTIONCOMPLETE|") ||
    upper.startsWith("PARCELNUMBER|SALEDATE_MMYYYY|")
  ) {
    return null;
  }

  const parts = line.includes("|") ? line.split("|") : line.split(",");

  if (schema === "nov47") {
    // 2027_NOV_Redacted.txt
    const contoOwner = (parts[2] || "").trim();
    const feeOwner = (parts[3] || "").trim();
    const inCareOf = (parts[4] || "").trim();
    const name = feeOwner || contoOwner || inCareOf;

    const street1 = (parts[5] || "").trim();
    const street2 = (parts[6] || "").trim();
    const cityStateZip = (parts[7] || "").trim();
    const country = (parts[8] || "").trim();

    const streetFull = [street1, street2].filter(Boolean).join(" ");
    const addrParts = [streetFull, cityStateZip].filter(Boolean);
    if (country && country.toUpperCase() !== "USA") {
      addrParts.push(country);
    }

    return {
      Name: name,
      "Mailing address": addrParts.join(", "),
      "personal/home phone": "",
      email: ""
    };
  }

  if (schema === "apartment") {
    // Apartment_Master.txt (39 cols)
    // idx 29: Owner, idx 30: InCarOf, idx 31: Address1, idx 32: Address2, idx 33: City, idx 34: State, idx 35: Zip
    const owner = (parts[29] || "").trim();
    const inCareOf = (parts[30] || "").trim();
    const complexName = (parts[2] || "").trim();
    const name = owner || inCareOf || complexName;

    const mailingAddress = formatAddressParts(
      parts[31],
      parts[32],
      parts[33],
      parts[34],
      parts[35],
      ""
    );

    return {
      Name: name,
      "Mailing address": mailingAddress,
      "personal/home phone": "",
      email: ""
    };
  }

  if (schema === "residential") {
    // Residential_Master.txt (39 cols)
    // idx 24: OwnerName, idx 25: OwnerAddr1stLine, idx 26: OwnerAddr2ndLine, idx 27: OwnerCity, idx 28: OwnerState, idx 29: OwnerZipCode, idx 30: OwnerCountry
    const name = (parts[24] || "").trim();
    const mailingAddress = formatAddressParts(
      parts[25],
      parts[26],
      parts[27],
      parts[28],
      parts[29],
      parts[30]
    );

    return {
      Name: name,
      "Mailing address": mailingAddress,
      "personal/home phone": "",
      email: ""
    };
  }

  if (schema === "sales") {
    // Sales_Affidavits.txt (44 cols)
    // Grantee (Buyer): idx 21: GRANTEEOWNERNAME, idx 22..27: GRANTEEADDRESSLINE1..GRANTEECOUNTRY
    // Grantor (Seller): idx 14: GRANTOROWNERNAME, idx 15..20: GRANTORADDRESSLINE1..GRANTORCOUNTRY
    const granteeName = (parts[21] || "").trim();
    const grantorName = (parts[14] || "").trim();
    const name = granteeName || grantorName;

    const granteeAddr = formatAddressParts(
      parts[22],
      parts[23],
      parts[24],
      parts[25],
      parts[26],
      parts[27]
    );
    const grantorAddr = formatAddressParts(
      parts[15],
      parts[16],
      parts[17],
      parts[18],
      parts[19],
      parts[20]
    );

    return {
      Name: name,
      "Mailing address": granteeAddr || grantorAddr,
      "personal/home phone": "",
      email: ""
    };
  }

  // Fallback for generic 4-column pipe or CSV lines
  return {
    Name: (parts[0] || "").trim(),
    "Mailing address": (parts[1] || "").trim(),
    "personal/home phone": (parts[2] || "").trim(),
    email: (parts[3] || "").trim()
  };
}

function parseRawTextToRows(rawText, overrideFormat, dedupe) {
  const lines = rawText.split(/\r?\n/);
  const rows = [];
  const seen = dedupe ? new Set() : null;
  const detectedTypes = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const schema = overrideFormat === "auto" ? detectLineSchema(line) : overrideFormat;
    if (schema === "empty" || schema === "header_skip") continue;

    detectedTypes.add(schema);
    const rec = parseLineToFourColumns(line, schema);
    if (!rec || (!rec.Name && !rec["Mailing address"])) continue;

    if (seen) {
      const sig = `${rec.Name.toUpperCase()}|${rec["Mailing address"].toUpperCase()}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
    }

    rows.push(rec);
  }

  const labelMap = {
    nov47: "2027_NOV_Redacted",
    apartment: "Apartment_Master",
    residential: "Residential_Master",
    sales: "Sales_Affidavits",
    pipe: "Pipe Data",
    csv: "CSV Data"
  };

  const badgeText =
    detectedTypes.size > 1
      ? `Combined (${detectedTypes.size} File Formats)`
      : labelMap[[...detectedTypes][0]] || "Formatted 4-Col";

  return { badgeText, rows };
}

// ==========================================
// 2. FILTERING, SORTING & TABLE RENDERING
// ==========================================

function getFilteredAndSortedRows() {
  const visibleCols = state.columns.filter((c) => c.visible);
  const globalQuery = state.globalSearch.trim().toLowerCase();
  const activeColFilters = Object.entries(state.columnFilters).filter(
    ([_, val]) => val && val.trim() !== ""
  );

  let result = state.rows;

  if (activeColFilters.length > 0 || globalQuery) {
    result = state.rows.filter((row) => {
      for (const [colKey, filterVal] of activeColFilters) {
        const cellVal = String(row[colKey] ?? "").toLowerCase();
        if (!cellVal.includes(filterVal.trim().toLowerCase())) {
          return false;
        }
      }

      if (globalQuery) {
        return visibleCols.some((col) => {
          const val = String(row[col.key] ?? "").toLowerCase();
          return val.includes(globalQuery);
        });
      }
      return true;
    });
  }

  if (state.sortKey) {
    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;

    result = [...result].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (valA === undefined || valA === null || valA === "") return 1;
      if (valB === undefined || valB === null || valB === "") return -1;

      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }

  return result;
}

function renderAll() {
  const hasData = state.columns.length > 0 && state.rows.length > 0;
  els.emptyState.classList.toggle("hidden", hasData);
  els.dataTable.classList.toggle("hidden", !hasData);

  const visibleCols = state.columns.filter((c) => c.visible);
  const filteredRows = getFilteredAndSortedRows();

  els.rowCountStat.textContent =
    filteredRows.length === state.rows.length
      ? state.rows.length.toLocaleString()
      : `${filteredRows.length.toLocaleString()} / ${state.rows.length.toLocaleString()}`;
  els.colCountStat.textContent = visibleCols.length;

  if (!hasData) {
    els.tableHead.innerHTML = "";
    els.tableBody.innerHTML = "";
    els.showingInfo.textContent = "Showing 0 of 0 rows";
    els.csvPreviewOutput.value = "";
    renderColumnChecklist();
    return;
  }

  renderTableHead(visibleCols);
  renderTableBody(visibleCols, filteredRows);
  renderColumnChecklist();

  if (state.activeView === "csv") {
    updateCsvPreview();
  }
}

function renderTableHead(visibleCols) {
  const thead = els.tableHead;
  thead.innerHTML = "";

  const trHead = document.createElement("tr");
  const thNum = document.createElement("th");
  thNum.className = "row-num-col";
  thNum.textContent = "#";
  trHead.appendChild(thNum);

  visibleCols.forEach((col) => {
    const th = document.createElement("th");
    th.title = `${col.label} — Click to sort • Double-click to rename`;

    const inner = document.createElement("div");
    inner.className = "th-inner";

    const labelSpan = document.createElement("span");
    labelSpan.className = "th-label";
    labelSpan.textContent = col.label;

    if (state.sortKey === col.key) {
      const sortSpan = document.createElement("span");
      sortSpan.className = "sort-indicator";
      sortSpan.textContent = state.sortDir === "asc" ? "▲" : "▼";
      labelSpan.appendChild(sortSpan);
    }

    labelSpan.addEventListener("click", () => {
      if (state.sortKey === col.key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = col.key;
        state.sortDir = "asc";
      }
      renderAll();
    });

    labelSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startHeaderInlineEdit(th, col);
    });

    inner.appendChild(labelSpan);
    th.appendChild(inner);
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);

  if (state.showColFilters) {
    const trFilter = document.createElement("tr");
    trFilter.className = "filter-row";

    const thEmpty = document.createElement("th");
    thEmpty.className = "row-num-col";
    trFilter.appendChild(thEmpty);

    visibleCols.forEach((col) => {
      const th = document.createElement("th");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "col-filter-input";
      input.placeholder = `Filter ${col.label}...`;
      input.value = state.columnFilters[col.key] || "";

      input.addEventListener("input", (e) => {
        state.columnFilters[col.key] = e.target.value;
        state.currentPage = 1;
        const fRows = getFilteredAndSortedRows();
        els.rowCountStat.textContent =
          fRows.length === state.rows.length
            ? state.rows.length.toLocaleString()
            : `${fRows.length.toLocaleString()} / ${state.rows.length.toLocaleString()}`;
        renderTableBody(
          state.columns.filter((c) => c.visible),
          fRows
        );
      });

      th.appendChild(input);
      trFilter.appendChild(th);
    });

    thead.appendChild(trFilter);
  }
}

function renderTableBody(visibleCols, filteredRows) {
  const tbody = els.tableBody;
  tbody.innerHTML = "";

  const totalRows = filteredRows.length;
  const pageSize = Number(state.pageSize) || 50;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  const startIdx = (state.currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pageRows = filteredRows.slice(startIdx, endIdx);

  const frag = document.createDocumentFragment();

  pageRows.forEach((rowObj, idx) => {
    const tr = document.createElement("tr");

    const tdNum = document.createElement("td");
    tdNum.className = "row-num-col";
    tdNum.textContent = startIdx + idx + 1;
    tr.appendChild(tdNum);

    visibleCols.forEach((col) => {
      const td = document.createElement("td");
      const val = rowObj[col.key];
      formatCellDisplay(td, val);

      td.addEventListener("dblclick", () => {
        startCellInlineEdit(td, rowObj, col.key);
      });

      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);

  els.showingInfo.textContent =
    totalRows === 0
      ? "No matching rows"
      : `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalRows.toLocaleString()} rows`;
  els.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages.toLocaleString()}`;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;
}

function formatCellDisplay(td, val) {
  td.className = "";
  if (val === null || val === undefined || val === "") {
    td.textContent = "—";
    td.classList.add("cell-null");
    td.title = "Empty (Double-click to enter value)";
    return;
  }

  const str = String(val);
  td.textContent = str;
  td.title = str;
}

function startCellInlineEdit(td, rowObj, colKey) {
  if (td.classList.contains("cell-editing")) return;
  const currentVal = rowObj[colKey] ?? "";
  td.classList.add("cell-editing");
  td.innerHTML = "";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-edit-input";
  input.value = String(currentVal);

  const commit = () => {
    rowObj[colKey] = input.value;
    td.classList.remove("cell-editing");
    formatCellDisplay(td, rowObj[colKey]);
    if (state.activeView === "csv") updateCsvPreview();
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = String(currentVal);
      input.blur();
    }
  });

  td.appendChild(input);
  input.focus();
  input.select();
}

function startHeaderInlineEdit(th, col) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-edit-input";
  input.value = col.label;

  th.innerHTML = "";
  th.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const newLabel = input.value.trim();
    if (newLabel) col.label = newLabel;
    renderAll();
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = col.label;
      input.blur();
    }
  });
}

function renderColumnChecklist() {
  els.columnChecklist.innerHTML = "";
  state.columns.forEach((col) => {
    const label = document.createElement("label");
    label.className = "checkbox-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = col.visible;
    checkbox.addEventListener("change", () => {
      col.visible = checkbox.checked;
      renderAll();
    });

    const span = document.createElement("span");
    span.textContent = col.label;

    label.appendChild(checkbox);
    label.appendChild(span);
    els.columnChecklist.appendChild(label);
  });
}

// ==========================================
// 3. CSV GENERATION & STREAMING EXPORT ENGINE
// ==========================================

function escapeCsvCell(val, delimiter, quoteAll) {
  if (val === null || val === undefined) return quoteAll ? '""' : "";
  const str = String(val);
  const needsQuotes =
    quoteAll ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r");

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsvString(limitRows = null) {
  const delimiter = els.exportDelimiter.value || ",";
  const filteredOnly = els.exportFilteredOnly.checked;
  const includeHeaders = els.exportIncludeHeaders.checked;
  const quoteAll = els.exportQuoteAll.checked;

  const cols = filteredOnly
    ? state.columns.filter((c) => c.visible)
    : state.columns;

  let rows = filteredOnly ? getFilteredAndSortedRows() : state.rows;
  if (limitRows && rows.length > limitRows) {
    rows = rows.slice(0, limitRows);
  }

  const lines = [];

  if (includeHeaders && cols.length > 0) {
    lines.push(cols.map((c) => escapeCsvCell(c.label, delimiter, quoteAll)).join(delimiter));
  }

  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvCell(row[c.key], delimiter, quoteAll)).join(delimiter));
  }

  return lines.join("\r\n");
}

function updateCsvPreview() {
  els.csvPreviewOutput.value = generateCsvString(500);
}

function exportToCsvFile() {
  if (state.rows.length === 0) {
    showToast("No data available to export!");
    return;
  }

  const csvContent = generateCsvString();
  const useBom = els.exportBom.checked;
  const bom = useBom ? "\uFEFF" : "";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });

  const rawName = (els.exportFilename.value || "Malen_Formatted_Contacts").trim().replace(/\.csv$/i, "");
  const filename = `${rawName}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${filename} (${getFilteredAndSortedRows().length.toLocaleString()} rows)!`);
}

// Stream-convert 1 or all 4 massive .txt files in chunks directly to a 4-Column CSV file
async function streamFullFilesToCsv() {
  const files = state.uploadedFiles;
  if (!files || files.length === 0) {
    showToast("Please drop or select your .txt file(s) first.");
    return;
  }

  const delimiter = els.exportDelimiter.value || ",";
  const filteredOnly = els.exportFilteredOnly.checked;
  const includeHeaders = els.exportIncludeHeaders.checked;
  const quoteAll = els.exportQuoteAll.checked;
  const rawName = (els.exportFilename.value || "Malen_Formatted_Contacts").trim().replace(/\.csv$/i, "");
  const filename = `${rawName}_Full.csv`;

  const visibleCols = filteredOnly ? state.columns.filter((c) => c.visible) : state.columns;

  let writableStream = null;
  const csvChunks = [];

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "CSV File", accept: { "text/csv": [".csv"] } }]
      });
      writableStream = await handle.createWritable();
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }

  els.streamProgressWrap.classList.remove("hidden");
  els.streamFullCsvBtn.disabled = true;

  const writeChunk = async (str) => {
    if (writableStream) {
      await writableStream.write(str);
    } else {
      csvChunks.push(str);
    }
  };

  if (els.exportBom.checked) {
    await writeChunk("\uFEFF");
  }

  if (includeHeaders) {
    const headerLine =
      visibleCols.map((c) => escapeCsvCell(c.label, delimiter, quoteAll)).join(delimiter) + "\r\n";
    await writeChunk(headerLine);
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  let processedBytes = 0;
  let totalExported = 0;
  const globalQuery = filteredOnly ? state.globalSearch.trim().toLowerCase() : "";
  const CHUNK_SIZE = 8 * 1024 * 1024;

  for (const file of files) {
    let offset = 0;
    let leftover = "";

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const chunkText = await slice.text();
      const combined = leftover + chunkText;
      const lines = combined.split(/\r?\n/);
      leftover = offset + CHUNK_SIZE < file.size ? lines.pop() : "";

      let outBuffer = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.trim()) continue;

        const mapped = parseLineToFourColumns(line, els.formatOverrideSelect.value);
        if (!mapped || (!mapped.Name && !mapped["Mailing address"])) continue;

        if (globalQuery) {
          const match =
            mapped.Name.toLowerCase().includes(globalQuery) ||
            mapped["Mailing address"].toLowerCase().includes(globalQuery);
          if (!match) continue;
        }

        const rowCells = visibleCols.map((c) =>
          escapeCsvCell(mapped[c.key] ?? "", delimiter, quoteAll)
        );
        outBuffer += rowCells.join(delimiter) + "\r\n";
        totalExported++;
      }

      if (outBuffer) {
        await writeChunk(outBuffer);
      }

      offset += CHUNK_SIZE;
      processedBytes += Math.min(CHUNK_SIZE, file.size - (offset - CHUNK_SIZE));
      const pct = Math.min(100, Math.round((processedBytes / totalBytes) * 100));
      els.streamProgressBar.style.width = `${pct}%`;
      els.streamProgressText.textContent = `${pct}%`;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (writableStream) {
    await writableStream.close();
  } else {
    const blob = new Blob(csvChunks, { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  els.streamFullCsvBtn.disabled = false;
  showToast(`Completed! Exported ${totalExported.toLocaleString()} rows to ${filename}.`);
}

async function copyCsvToClipboard() {
  if (state.rows.length === 0) {
    showToast("No data to copy!");
    return;
  }
  const csvContent = generateCsvString();
  try {
    await navigator.clipboard.writeText(csvContent);
    showToast("Formatted CSV copied to clipboard!");
  } catch (_) {
    els.csvPreviewOutput.value = csvContent;
    els.csvPreviewOutput.select();
    document.execCommand("copy");
    showToast("Formatted CSV copied to clipboard!");
  }
}

// ==========================================
// 4. EVENT LISTENERS & INITIALIZATION
// ==========================================

function getSelectedDatasetText(key) {
  if (key === "all_4_malen") {
    return [
      MALEN_DATA.nov_2027,
      MALEN_DATA.apartment_master,
      MALEN_DATA.residential_master,
      MALEN_DATA.sales_affidavits
    ]
      .filter(Boolean)
      .join("\n");
  }
  return MALEN_DATA[key] || "";
}

function runFormatPipeline() {
  const raw = els.rawInput.value;
  const overrideFormat = els.formatOverrideSelect.value;
  const dedupe = els.dedupeOnParseCheck.checked;

  const { badgeText, rows } = parseRawTextToRows(raw, overrideFormat, dedupe);
  state.detectedFormat = badgeText;
  state.rows = rows;
  state.sortKey = null;
  state.currentPage = 1;
  state.columnFilters = {};

  els.detectedFormatBadge.textContent = badgeText;
  renderAll();
}

async function handleSelectedFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  state.uploadedFiles = files;
  const totalSizeMB = (files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1);

  if (files.length === 1) {
    const baseName = files[0].name.replace(/\.[^/.]+$/, "");
    if (baseName) els.exportFilename.value = `${baseName}_Formatted`;
  } else {
    els.exportFilename.value = `Malen_${files.length}_Files_Formatted`;
  }

  els.largeFileBanner.classList.remove("hidden");
  els.lfName.textContent =
    files.length === 1 ? files[0].name : `${files.length} Files Selected (${files.map((f) => f.name).join(", ")})`;
  els.lfSize.textContent = `${totalSizeMB} MB total`;

  await loadPreviewFromUploadedFiles();
}

async function loadPreviewFromUploadedFiles() {
  const files = state.uploadedFiles;
  if (!files || files.length === 0) return;

  const maxRowsPerFile = Number(els.previewRowLimit.value) || 5000;
  const chunks = [];

  for (const file of files) {
    const bytesToRead = Math.min(file.size, maxRowsPerFile * 280);
    const slice = file.slice(0, bytesToRead);
    const text = await slice.text();
    const lines = text.split(/\r?\n/);
    if (bytesToRead < file.size) lines.pop();
    chunks.push(lines.slice(0, maxRowsPerFile).join("\n"));
  }

  els.rawInput.value = chunks.join("\n");
  els.formatOverrideSelect.value = "auto";
  runFormatPipeline();
  showToast(
    `Loaded ${state.rows.length.toLocaleString()} formatted rows across ${files.length} file(s).`
  );
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3400);
}

function closeAllPopovers() {
  els.columnsPopover.classList.add("hidden");
  els.csvOptionsPopover.classList.add("hidden");
}

function setupEventListeners() {
  els.formatDataBtn.addEventListener("click", runFormatPipeline);

  let debounceTimer;
  els.rawInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runFormatPipeline, 250);
  });

  [els.formatOverrideSelect, els.trimValuesCheck, els.dedupeOnParseCheck].forEach((el) =>
    el.addEventListener("change", runFormatPipeline)
  );

  els.clearInputBtn.addEventListener("click", () => {
    els.rawInput.value = "";
    els.sampleSelect.value = "";
    state.uploadedFiles = [];
    els.largeFileBanner.classList.add("hidden");
    runFormatPipeline();
  });

  els.sampleSelect.addEventListener("change", (e) => {
    const key = e.target.value;
    if (!key) return;
    state.uploadedFiles = [];
    els.largeFileBanner.classList.add("hidden");
    els.rawInput.value = getSelectedDatasetText(key);
    els.formatOverrideSelect.value = "auto";
    els.exportFilename.value =
      key === "all_4_malen" ? "Malen_All_4_Files_Formatted" : `${key}_Formatted`;
    runFormatPipeline();
  });

  els.loadDefaultSampleBtn.addEventListener("click", () => {
    els.sampleSelect.value = "all_4_malen";
    els.rawInput.value = getSelectedDatasetText("all_4_malen");
    els.formatOverrideSelect.value = "auto";
    runFormatPipeline();
  });

  els.browseFileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleSelectedFiles(e.target.files);
  });

  els.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropzone.classList.add("dragover");
  });
  els.dropzone.addEventListener("dragleave", () => {
    els.dropzone.classList.remove("dragover");
  });
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) handleSelectedFiles(e.dataTransfer.files);
  });

  els.previewRowLimit.addEventListener("change", () => {
    if (state.uploadedFiles.length > 0) loadPreviewFromUploadedFiles();
  });

  els.streamFullCsvBtn.addEventListener("click", streamFullFilesToCsv);

  els.globalSearchInput.addEventListener("input", (e) => {
    state.globalSearch = e.target.value;
    els.clearSearchBtn.classList.toggle("hidden", !state.globalSearch);
    state.currentPage = 1;
    renderAll();
  });

  els.clearSearchBtn.addEventListener("click", () => {
    els.globalSearchInput.value = "";
    state.globalSearch = "";
    els.clearSearchBtn.classList.add("hidden");
    state.currentPage = 1;
    renderAll();
  });

  els.dedupeBtn.addEventListener("click", () => {
    const seen = new Set();
    const before = state.rows.length;
    state.rows = state.rows.filter((r) => {
      const sig = `${r.Name.toUpperCase()}|${r["Mailing address"].toUpperCase()}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    renderAll();
    showToast(`Removed ${(before - state.rows.length).toLocaleString()} duplicate Name + Mailing address rows.`);
  });

  els.toggleColFiltersBtn.addEventListener("click", () => {
    state.showColFilters = !state.showColFilters;
    els.toggleColFiltersBtn.classList.toggle("btn-primary", state.showColFilters);
    els.toggleColFiltersBtn.classList.toggle("btn-ghost", !state.showColFilters);
    renderAll();
  });

  const setupPopover = (btn, popover) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = popover.classList.contains("hidden");
      closeAllPopovers();
      if (isHidden) popover.classList.remove("hidden");
    });
    popover.addEventListener("click", (e) => e.stopPropagation());
  };

  setupPopover(els.columnsMenuBtn, els.columnsPopover);
  setupPopover(els.csvOptionsBtn, els.csvOptionsPopover);
  document.addEventListener("click", closeAllPopovers);

  els.showAllColsBtn.addEventListener("click", () => {
    state.columns.forEach((c) => (c.visible = true));
    renderAll();
  });

  els.hideAllColsBtn.addEventListener("click", () => {
    state.columns.forEach((c) => (c.visible = false));
    renderAll();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeView = btn.dataset.view;
      els.tableViewContainer.classList.toggle("hidden", state.activeView !== "table");
      els.csvViewContainer.classList.toggle("hidden", state.activeView !== "csv");
      if (state.activeView === "csv") updateCsvPreview();
    });
  });

  els.exportCsvBtn.addEventListener("click", exportToCsvFile);
  els.copyCsvBtn.addEventListener("click", copyCsvToClipboard);

  [els.exportDelimiter, els.exportFilteredOnly, els.exportIncludeHeaders, els.exportQuoteAll].forEach(
    (el) =>
      el.addEventListener("change", () => {
        if (state.activeView === "csv") updateCsvPreview();
      })
  );

  els.pageSizeSelect.addEventListener("change", (e) => {
    state.pageSize = e.target.value;
    state.currentPage = 1;
    renderAll();
  });

  els.prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderAll();
    }
  });

  els.nextPageBtn.addEventListener("click", () => {
    state.currentPage++;
    renderAll();
  });

  els.toggleInputPanelBtn.addEventListener("click", () => {
    els.workspace.classList.toggle("input-collapsed");
  });

  els.themeToggleBtn.addEventListener("click", () => {
    const html = document.documentElement;
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
  });
}

// Initialize with all 4 Malen datasets combined into the 4 columns
setupEventListeners();
els.sampleSelect.value = "all_4_malen";
els.rawInput.value = getSelectedDatasetText("all_4_malen");
runFormatPipeline();
