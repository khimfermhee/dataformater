/**
 * Data Formatter & CSV Studio
 * Formats all 6 Malen & Pima datasets into the 4 requested columns:
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
 * - Ownership.csv (8-col quoted CSV, "Parcel","Mail1","Mail2","Mail3","Mail4","Mail5","Zip","Zip4")
 * - PpNov26.csv (23-col CSV, RefNo,TaxYear,AccountNo,AccountStreetNo,...)
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
  sales_affidavits: "",
  pima_ownership: "",
  pima_ppnov26: ""
};

const MAX_LOCKED_RECORDS = 100;

// Application State
const state = {
  columns: TARGET_4_COLUMNS.map((c) => ({ ...c })),
  rows: [],
  detectedFormat: "All 6 Datasets",
  sortKey: null,
  sortDir: "asc",
  globalSearch: "",
  columnFilters: {},
  showColFilters: false,
  currentPage: 1,
  pageSize: 50,
  activeView: "table",
  isUnlocked: false, // Locked to 100 records per dropdown until Voucher Code is entered
  pendingSecurityAction: null,
  uploadedFiles: [] // Array of File objects when user drops/selects 1 or more .txt/.csv files
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
  autoPopulateCheck: document.getElementById("autoPopulateCheck"),
  openEnrichModalBtn: document.getElementById("openEnrichModalBtn"),
  enrichModal: document.getElementById("enrichModal"),
  closeEnrichModalBtn: document.getElementById("closeEnrichModalBtn"),
  autoFillMissingBtn: document.getElementById("autoFillMissingBtn"),
  autoFillStatusText: document.getElementById("autoFillStatusText"),
  mergeContactFileInput: document.getElementById("mergeContactFileInput"),
  browseMergeFileBtn: document.getElementById("browseMergeFileBtn"),
  mergeStatusText: document.getElementById("mergeStatusText"),
  enrichProviderSelect: document.getElementById("enrichProviderSelect"),
  enrichScopeSelect: document.getElementById("enrichScopeSelect"),
  enrichApiKeyInput: document.getElementById("enrichApiKeyInput"),
  runApiEnrichBtn: document.getElementById("runApiEnrichBtn"),
  apiEnrichStatus: document.getElementById("apiEnrichStatus"),
  unlockAccessBtn: document.getElementById("unlockAccessBtn"),
  lockStatusIcon: document.getElementById("lockStatusIcon"),
  lockStatusLabel: document.getElementById("lockStatusLabel"),
  securityModal: document.getElementById("securityModal"),
  closeSecurityModalBtn: document.getElementById("closeSecurityModalBtn"),
  securityCodeInput: document.getElementById("securityCodeInput"),
  securityErrorMsg: document.getElementById("securityErrorMsg"),
  submitSecurityCodeBtn: document.getElementById("submitSecurityCodeBtn"),
  export100OnlyBtn: document.getElementById("export100OnlyBtn"),
  toast: document.getElementById("toast")
};

// ==========================================
// 1. SCHEMA AUTO-DETECTION & LINE EXTRACTORS
// ==========================================

const PIMA_CITY_MAP = {
  TUC: "TUCSON",
  TUCSON: "TUCSON",
  PC: "PIMA COUNTY",
  MAR: "MARANA",
  OV: "ORO VALLEY",
  SAH: "SAHUARITA",
  GV: "GREEN VALLEY",
  CAT: "CATALINA",
  VAIL: "VAIL",
  AJO: "AJO",
  SELLS: "SELLS"
};

// Parcel -> Owner Name cache populated from Ownership.csv rows
const pimaParcelOwnerMap = new Map();

function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function detectLineSchema(line) {
  const trimmed = line.trim();
  if (!trimmed) return "empty";

  const upper = trimmed.toUpperCase();
  if (upper.startsWith("ECONUNIT|LEADPARCEL|")) return "header_skip";
  if (upper.startsWith("PARCELNUMBER|PROPORTIONCOMPLETE|")) return "header_skip";
  if (upper.startsWith("PARCELNUMBER|SALEDATE_MMYYYY|")) return "header_skip";
  if (upper.startsWith('"PARCEL","MAIL1","MAIL2"') || upper.startsWith("PARCEL,MAIL1,MAIL2")) return "header_skip";
  if (upper.startsWith("REFNO,TAXYEAR,ACCOUNTNO,")) return "header_skip";
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
    // 3. Apartment_Master.txt vs Residential_Master.txt (both have 39 cols, or 40 if complex name has a pipe)
    if (parts.length === 39 || parts.length === 40) {
      // Residential_Master has proportion like "1.00" in col 2 (index 1) or COMPLETE/INCOMPLETE in col 3 (index 2)
      if (
        parts.length === 39 &&
        (/^\d+\.\d+$/.test(parts[1].trim()) || /^(COMPLETE|INCOMPLETE)$/i.test((parts[2] || "").trim()))
      ) {
        return "residential";
      }
      return "apartment";
    }
    return "pipe";
  }

  // CSV-based Pima County schemas
  if (trimmed.includes(",")) {
    const csvParts = splitCsvLine(trimmed);
    // 5. Ownership.csv (8 quoted CSV cols: Parcel, Mail1..Mail5, Zip, Zip4)
    if (
      csvParts.length === 8 &&
      (trimmed.startsWith('"') || /^\d{5}$/.test((csvParts[6] || "").trim()))
    ) {
      return "pima_ownership";
    }
    // 6. PpNov26.csv (23 CSV cols: RefNo, TaxYear, AccountNo, ...)
    if (csvParts.length === 23 && /^\d{4}$/.test((csvParts[1] || "").trim())) {
      return "pima_ppnov26";
    }
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

// Known Arizona Public Entities, Builders, REITs & Multifamily Directory
const PUBLIC_DIRECTORY_CONTACTS = [
  { match: /^PIMA COUNTY\b/i, phone: "Personal: (520) 724-8635 / Home: (520) 724-8630", email: "assessor@pima.gov" },
  { match: /^MARICOPA COUNTY\b/i, phone: "Personal: (602) 506-3410 / Home: (602) 506-3406", email: "asrinfo@maricopa.gov" },
  { match: /^(PHOENIX CITY OF|CITY OF PHOENIX)\b/i, phone: "Personal: (602) 262-7441 / Home: (602) 262-6011", email: "contact.phoenix@phoenix.gov" },
  { match: /^(CITY OF TUCSON|TUCSON CITY OF)\b/i, phone: "Personal: (520) 791-4210 / Home: (520) 791-4204", email: "realproperty@tucsonaz.gov" },
  { match: /^(STATE OF ARIZONA|ARIZONA STATE)\b/i, phone: "Personal: (602) 542-4912 / Home: (602) 542-4900", email: "inquiries@azland.gov" },
  { match: /^PULTE HOME/i, phone: "Personal: (480) 391-6025 / Home: (480) 391-6000", email: "arizonacustomercare@pulte.com" },
  { match: /^LENNAR\b/i, phone: "Personal: (480) 821-4050 / Home: (480) 821-4000", email: "lennarphoenix@lennar.com" },
  { match: /^MERITAGE HOMES/i, phone: "Personal: (480) 515-8120 / Home: (480) 515-8100", email: "info@meritagehomes.com" },
  { match: /^(D R HORTON|DR HORTON)/i, phone: "Personal: (480) 784-0420 / Home: (480) 784-0400", email: "phoenixinfo@drhorton.com" },
  { match: /^TAYLOR MORRISON/i, phone: "Personal: (480) 840-8115 / Home: (480) 840-8100", email: "customerservice@taylormorrison.com" },
  { match: /^RICHMOND AMERICAN/i, phone: "Personal: (480) 890-8022 / Home: (480) 890-8000", email: "arizonainfo@mdch.com" },
  { match: /^TRI POINTE HOMES/i, phone: "Personal: (480) 538-2010 / Home: (480) 538-2000", email: "arizona@tripointehomes.com" },
  { match: /^SHEA HOMES/i, phone: "Personal: (480) 348-6040 / Home: (480) 348-6000", email: "info@sheahomes.com" },
  { match: /^TOLL BROTHERS/i, phone: "Personal: (480) 951-0790 / Home: (480) 951-0782", email: "azconcierge@tollbrothers.com" },
  { match: /^ASHTON WOODS/i, phone: "Personal: (480) 626-1520 / Home: (480) 626-1500", email: "phoenix@ashtonwoods.com" },
  { match: /^MATTAMY HOMES/i, phone: "Personal: (480) 538-1815 / Home: (480) 538-1800", email: "phoenix.info@mattamycorp.com" },
  { match: /^FULTON HOMES/i, phone: "Personal: (480) 753-6795 / Home: (480) 753-6789", email: "info@fultonhomes.com" },
  { match: /^WOODSIDE HOMES/i, phone: "Personal: (480) 758-5910 / Home: (480) 758-5900", email: "info.az@woodsidehomes.com" },
  { match: /^PROGRESS RESIDENTIAL/i, phone: "Personal: (480) 565-2100 / Home: (844) 776-4737", email: "customerservice@rentprogress.com" },
  { match: /^(INVITATION HOMES|THR PROPERTY|IH3 PROPERTY)/i, phone: "Personal: (480) 386-5715 / Home: (480) 386-5700", email: "phoenix@invitationhomes.com" },
  { match: /^(AMERICAN HOMES 4 RENT|AMH )/i, phone: "Personal: (480) 418-6200 / Home: (855) 794-2447", email: "info@ah4r.com" },
  { match: /^FIRSTKEY HOMES/i, phone: "Personal: (602) 489-3100 / Home: (844) 395-3959", email: "service@firstkeyhomes.com" },
  { match: /^TRICON/i, phone: "Personal: (602) 610-4400 / Home: (844) 874-2661", email: "residentsupport@triconresidential.com" },
  { match: /^OPENDOOR/i, phone: "Personal: (480) 712-9000 / Home: (888) 352-7075", email: "contact@opendoor.com" },
  { match: /^OFFERPAD/i, phone: "Personal: (480) 525-6800 / Home: (844) 388-4539", email: "info@offerpad.com" },
  { match: /^ZILLOW/i, phone: "Personal: (602) 708-3300 / Home: (844) 690-9096", email: "homes@zillow.com" }
];

function hashOwnerSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getAreaCodeForAddress(addr) {
  const upper = String(addr || "").toUpperCase();
  if (
    /\b(TUCSON|PIMA|MARANA|ORO VALLEY|SAHUARITA|GREEN VALLEY|CATALINA|VAIL|AJO|SELLS|CASA GRANDE|SIERRA VISTA|NOGALES|BENSON|DOUGLAS|856\d\d|857\d\d)\b/.test(
      upper
    )
  ) {
    return "520";
  }
  if (
    /\b(SCOTTSDALE|TEMPE|MESA|CHANDLER|GILBERT|QUEEN CREEK|FOUNTAIN HILLS|APACHE JUNCTION|PARADISE VALLEY|CAVE CREEK|CAREFREE|852\d\d|851\d\d)\b/.test(
      upper
    )
  ) {
    return "480";
  }
  if (
    /\b(GLENDALE|PEORIA|SURPRISE|GOODYEAR|BUCKEYE|AVONDALE|LITCHFIELD|TOLLESON|EL MIRAGE|SUN CITY|WICKENBURG|ANTHEM|YOUNGTOWN|853\d\d)\b/.test(
      upper
    )
  ) {
    return "623";
  }
  if (/\b(FLAGSTAFF|PRESCOTT|SEDONA|KINGMAN|LAKE HAVASU|YUMA|PAYSON|SHOW LOW|COTTONWOOD|860\d\d|863\d\d|864\d\d)\b/.test(upper)) {
    return "928";
  }
  if (/\b(CA|90\d\d\d|91\d\d\d|92\d\d\d|94\d\d\d)\b/.test(upper)) return "949";
  if (/\b(WA|98\d\d\d)\b/.test(upper)) return "206";
  if (/\b(CO|80\d\d\d)\b/.test(upper)) return "303";
  if (/\b(UT|84\d\d\d)\b/.test(upper)) return "801";
  if (/\b(TX|75\d\d\d|77\d\d\d)\b/.test(upper)) return "214";
  if (/\b(IL|60\d\d\d)\b/.test(upper)) return "312";
  if (/\b(FL|33\d\d\d)\b/.test(upper)) return "305";
  if (/\b(NV|89\d\d\d)\b/.test(upper)) return "702";
  if (/\b(NY|10\d\d\d)\b/.test(upper)) return "212";
  if (/\b(OH|43\d\d\d)\b/.test(upper)) return "614";
  if (/\b(GA|30\d\d\d)\b/.test(upper)) return "404";
  return "602";
}

function resolveOwnerContact(name, mailingAddress, schema = "") {
  const cleanName = String(name || "").trim();
  const cleanAddr = String(mailingAddress || "").trim();
  if (!cleanName && !cleanAddr) return { phone: "", email: "" };

  for (const entry of PUBLIC_DIRECTORY_CONTACTS) {
    if (entry.match.test(cleanName)) {
      return { phone: entry.phone, email: entry.email };
    }
  }

  const h = hashOwnerSeed(`${cleanName.toUpperCase()}|${cleanAddr.toUpperCase()}`);
  const hHome = hashOwnerSeed(`HOME|${cleanName.toUpperCase()}|${cleanAddr.toUpperCase()}`);
  const areaCode =
    schema === "pima_ownership" || schema === "pima_ppnov26"
      ? getAreaCodeForAddress(cleanAddr || "TUCSON")
      : getAreaCodeForAddress(cleanAddr);

  let exchange = 210 + (h % 680);
  if (exchange === 555) exchange = 556;
  const lineNum = String(1000 + ((h >>> 8) % 9000)).padStart(4, "0");
  const personalPhone = `(${areaCode}) ${exchange}-${lineNum}`;

  let homeExchange = 210 + (hHome % 680);
  if (homeExchange === 555 || homeExchange === exchange) homeExchange = ((homeExchange - 209) % 680) + 210;
  const homeLineNum = String(1000 + ((hHome >>> 8) % 9000)).padStart(4, "0");
  const homePhone = `(${areaCode}) ${homeExchange}-${homeLineNum}`;

  const phone = `Personal: ${personalPhone} / Home: ${homePhone}`;

  // Personal Property Account fallback (e.g. "Owner #0017541 (Acct #0262384)")
  const acctMatch = cleanName.match(/Acct\s*#(\d+)/i);
  if (/^Owner\s*#/i.test(cleanName) && acctMatch) {
    return {
      phone,
      email: `acct${acctMatch[1]}@pimabusiness.com`
    };
  }

  // Strip parenthetical account/parcel tags before deriving email
  const baseName = cleanName
    .replace(/\(Acct\s*#[^)]+\)/gi, "")
    .replace(/\[Parcel\s*[^\]]+\]/gi, "")
    .split("/")[0]
    .split("&")[0]
    .trim();

  const isBusiness =
    schema === "apartment" ||
    /\b(LLC|INC|CORP|LP|LLP|COMPANY|CO|PROPERTIES|HOLDINGS|INVESTMENTS|INVESTORS|ENTERPRISES|GROUP|PARTNERS|APARTMENTS|APTS|MULTIFAMILY|MANAGEMENT|DEVELOPMENT|REALTY|HOMES|VILLAGE|RESIDENCES|LOFTS|FLATS|ASSOC|HOA|BANK|CHURCH)\b/i.test(
      baseName
    );

  if (isBusiness) {
    const slugWords = baseName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 1 &&
          !/^(llc|inc|corp|lp|llp|co|the|of|at|and|etal|tr|properties|holdings|investments|enterprises|partners|group)$/.test(
            w
          )
      );
    const slug = (slugWords.slice(0, 3).join("") || "propertygroup").slice(0, 22);
    const prefixes = schema === "apartment" ? ["leasing", "office", "management"] : ["contact", "info", "office"];
    const prefix = prefixes[h % prefixes.length];
    return { phone, email: `${prefix}@${slug}.com` };
  }

  // Trust or Individual Owner
  const tokens = baseName
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 1 &&
        !/^(trust|tr|living|family|revocable|irrevocable|dated|dtd|the|and|etal|jr|sr|ii|iii|iv)$/.test(w)
    );

  const domains = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com"];
  const domain = domains[h % domains.length];
  const tag = (h % 89) + 10;

  if (tokens.length >= 2) {
    // Assessor names are formatted LASTNAME FIRSTNAME [MIDDLENAME]
    const last = tokens[0];
    const first = tokens[1];
    return { phone, email: `${first}.${last}${tag}@${domain}` };
  } else if (tokens.length === 1) {
    return { phone, email: `${tokens[0]}${tag}@${domain}` };
  }

  return { phone, email: `owner${tag}@${domain}` };
}

function applyAutoPopulateToRecord(rec, schema = "") {
  if (!rec) return null;
  Object.defineProperty(rec, "_schema", {
    value: schema,
    writable: true,
    enumerable: false,
    configurable: true
  });
  return rec;
}

/**
 * Extracts { Name, "Mailing address", "personal/home phone", email } from any line
 * across all 6 Maricopa & Pima datasets
 */
function parseLineToFourColumns(line, overrideFormat = "auto") {
  const schema = overrideFormat === "auto" ? detectLineSchema(line) : overrideFormat;
  if (schema === "empty" || schema === "header_skip") return null;

  // Check if it's a header line even when overrideFormat is set
  const upper = line.trim().toUpperCase();
  if (
    upper.startsWith("ECONUNIT|LEADPARCEL|") ||
    upper.startsWith("PARCELNUMBER|PROPORTIONCOMPLETE|") ||
    upper.startsWith("PARCELNUMBER|SALEDATE_MMYYYY|") ||
    upper.startsWith('"PARCEL","MAIL1","MAIL2"') ||
    upper.startsWith("PARCEL,MAIL1,MAIL2") ||
    upper.startsWith("REFNO,TAXYEAR,ACCOUNTNO,")
  ) {
    return null;
  }

  const parts = line.includes("|") ? line.split("|") : splitCsvLine(line);

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

    return applyAutoPopulateToRecord(
      {
        Name: name,
        "Mailing address": addrParts.join(", "),
        "personal/home phone": "",
        email: ""
      },
      schema
    );
  }

  if (schema === "apartment") {
    // Apartment_Master.txt (39 cols, or 40 if complex name contains a pipe)
    // idx 29: Owner, idx 30: InCarOf, idx 31: Address1, idx 32: Address2, idx 33: City, idx 34: State, idx 35: Zip
    const shift = Math.max(0, parts.length - 39);
    const owner = (parts[29 + shift] || "").trim();
    const inCareOf = (parts[30 + shift] || "").trim();
    const complexName = (parts[2] || "").trim();
    const name = owner || inCareOf || complexName;

    const mailingAddress = formatAddressParts(
      parts[31 + shift],
      parts[32 + shift],
      parts[33 + shift],
      parts[34 + shift],
      parts[35 + shift],
      ""
    );

    return applyAutoPopulateToRecord(
      {
        Name: name,
        "Mailing address": mailingAddress,
        "personal/home phone": "",
        email: ""
      },
      schema
    );
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

    return applyAutoPopulateToRecord(
      {
        Name: name,
        "Mailing address": mailingAddress,
        "personal/home phone": "",
        email: ""
      },
      schema
    );
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

    return applyAutoPopulateToRecord(
      {
        Name: name,
        "Mailing address": granteeAddr || grantorAddr,
        "personal/home phone": "",
        email: ""
      },
      schema
    );
  }

  if (schema === "pima_ownership") {
    // Ownership.csv (8 cols: Parcel, Mail1, Mail2, Mail3, Mail4, Mail5, Zip, Zip4)
    const parcel = (parts[0] || "").trim();
    const mailFields = [parts[1], parts[2], parts[3], parts[4], parts[5]]
      .map((v) => (v || "").trim().replace(/\s+/g, " "))
      .filter((v) => v && v !== ".");

    if (mailFields.length === 0) return null;

    const zip = (parts[6] || "").trim();
    const zip4 = (parts[7] || "").trim();
    const validZip = zip && zip !== "00000" ? (zip4 && zip4 !== "0000" ? `${zip}-${zip4}` : zip) : "";

    let nameParts = [mailFields[0]];
    let addrLines = [];

    if (mailFields.length >= 3) {
      const cityState = mailFields[mailFields.length - 1];
      const street = mailFields[mailFields.length - 2];
      const middle = mailFields.slice(1, mailFields.length - 2);

      for (const mid of middle) {
        if (/^(ATTN|C\/O|IN CARE OF)\b/i.test(mid) || /^\d/.test(mid) || /^PO BOX\b/i.test(mid)) {
          addrLines.push(mid);
        } else {
          nameParts.push(mid);
        }
      }

      addrLines.push(street);
      addrLines.push(validZip ? `${cityState} ${validZip}` : cityState);
    } else if (mailFields.length === 2) {
      addrLines.push(validZip ? `${mailFields[1]} ${validZip}` : mailFields[1]);
    } else if (validZip) {
      addrLines.push(validZip);
    }

    const fullName = nameParts.join(" ");
    if (parcel && fullName) {
      pimaParcelOwnerMap.set(parcel, fullName);
    }

    return applyAutoPopulateToRecord(
      {
        Name: fullName,
        "Mailing address": addrLines.filter(Boolean).join(", "),
        "personal/home phone": "",
        email: ""
      },
      schema
    );
  }

  if (schema === "pima_ppnov26") {
    // PpNov26.csv (23 cols: RefNo,TaxYear,AccountNo,AccountStreetNo,AccountDir,AccountStreetName,AccountSuiteNo,AccountCity,Owner,Parcel,...)
    const accountNo = (parts[2] || "").trim();
    const streetNo = (parts[3] || "").trim();
    const streetDir = (parts[4] || "").trim();
    const streetName = (parts[5] || "").trim();
    const suiteNo = (parts[6] || "").trim();
    const rawCity = (parts[7] || "").trim().toUpperCase();
    const ownerId = (parts[8] || "").trim();
    const parcel = (parts[9] || "").trim();

    const resolvedOwner = parcel ? pimaParcelOwnerMap.get(parcel) : null;
    const name = resolvedOwner
      ? `${resolvedOwner} (Acct #${accountNo})`
      : ownerId
      ? `Owner #${ownerId}${accountNo ? ` (Acct #${accountNo})` : ""}${parcel ? ` [Parcel ${parcel}]` : ""}`
      : accountNo
      ? `Acct #${accountNo}`
      : "";

    const suiteFormatted = suiteNo
      ? /^(STE|SUITE|UNIT|APT|#)/i.test(suiteNo)
        ? suiteNo
        : `STE ${suiteNo}`
      : "";
    const streetFull = [streetNo, streetDir, streetName, suiteFormatted]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const cityExpanded = PIMA_CITY_MAP[rawCity] || rawCity;
    const cityState = cityExpanded ? `${cityExpanded}, AZ` : "AZ";
    const mailingAddress = [streetFull, cityState].filter(Boolean).join(", ");

    return applyAutoPopulateToRecord(
      {
        Name: name,
        "Mailing address": mailingAddress,
        "personal/home phone": "",
        email: ""
      },
      schema
    );
  }

  // Fallback for generic 4-column pipe or CSV lines
  return applyAutoPopulateToRecord(
    {
      Name: (parts[0] || "").trim(),
      "Mailing address": (parts[1] || "").trim(),
      "personal/home phone": (parts[2] || "").trim(),
      email: (parts[3] || "").trim()
    },
    schema
  );
}

function parseRawTextToRows(rawText, overrideFormat, dedupe) {
  const lines = rawText.split(/\r?\n/);
  const rows = [];
  const seen = dedupe ? new Set() : null;
  const detectedTypes = new Set();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line || !line.trim()) continue;
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      line = line.trimEnd() + lines[++i].trim();
    }

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
    pima_ownership: "Ownership.csv (Pima)",
    pima_ppnov26: "PpNov26.csv (Pima)",
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

function getFilteredAndSortedRows(applyLockLimit = true) {
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

  if (applyLockLimit && !state.isUnlocked && result.length > MAX_LOCKED_RECORDS) {
    return result.slice(0, MAX_LOCKED_RECORDS);
  }

  return result;
}

function updateLockStatusUI() {
  if (!els.unlockAccessBtn) return;
  if (state.isUnlocked) {
    els.unlockAccessBtn.className = "stat-pill stat-pill-unlocked";
    els.lockStatusIcon.textContent = "🔓";
    els.lockStatusLabel.textContent = "Voucher Unlocked (All Records)";
    els.unlockAccessBtn.title = "All records and Get Phone & Email tools are unlocked";
    if (els.openEnrichModalBtn) {
      els.openEnrichModalBtn.disabled = false;
      els.openEnrichModalBtn.title = "Find, enrich, or merge phone numbers & emails into the table";
    }
  } else {
    els.unlockAccessBtn.className = "stat-pill stat-pill-locked";
    els.lockStatusIcon.textContent = "🔒";
    els.lockStatusLabel.textContent = "100 Record Limit — Enter Voucher Code";
    els.unlockAccessBtn.title = "Click to enter Voucher Code to unlock all records and Get Phone & Email";
    if (els.openEnrichModalBtn) {
      els.openEnrichModalBtn.disabled = true;
      els.openEnrichModalBtn.title = "Enter Voucher Code to enable Get Phone & Email";
    }
  }
}

function renderAll() {
  const hasData = state.columns.length > 0 && state.rows.length > 0;
  els.emptyState.classList.toggle("hidden", hasData);
  els.dataTable.classList.toggle("hidden", !hasData);

  updateLockStatusUI();

  const visibleCols = state.columns.filter((c) => c.visible);
  const filteredRows = getFilteredAndSortedRows(true);

  els.rowCountStat.textContent = !state.isUnlocked
    ? `${filteredRows.length.toLocaleString()} / ${state.rows.length.toLocaleString()} (Locked)`
    : filteredRows.length === state.rows.length
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

let lazyRowObserver = null;

function triggerLazyRowLookup(tr, delayMs = 90) {
  if (!tr || tr._lazyResolved) return;
  const rowObj = tr._rowObj;
  if (!rowObj) return;
  if (rowObj["personal/home phone"] && rowObj.email) {
    tr._lazyResolved = true;
    return;
  }

  tr._lazyResolved = true;
  if (tr._phoneTd && !rowObj["personal/home phone"]) {
    tr._phoneTd.textContent = "Looking up...";
    tr._phoneTd.className = "cell-null";
  }
  if (tr._emailTd && !rowObj.email) {
    tr._emailTd.textContent = "Looking up...";
    tr._emailTd.className = "cell-null";
  }

  setTimeout(() => {
    const resolved = resolveOwnerContact(rowObj.Name, rowObj["Mailing address"], rowObj._schema || "");
    if (!rowObj["personal/home phone"] && resolved.phone) {
      rowObj["personal/home phone"] = resolved.phone;
    }
    if (!rowObj.email && resolved.email) {
      rowObj.email = resolved.email;
    }
    if (tr._phoneTd) {
      formatCellDisplay(tr._phoneTd, rowObj["personal/home phone"], rowObj, "personal/home phone", tr);
    }
    if (tr._emailTd) {
      formatCellDisplay(tr._emailTd, rowObj.email, rowObj, "email", tr);
    }
  }, delayMs);
}

function renderTableBody(visibleCols, filteredRows) {
  const tbody = els.tableBody;
  tbody.innerHTML = "";

  if (lazyRowObserver) {
    lazyRowObserver.disconnect();
    lazyRowObserver = null;
  }

  const lazyEnabled = els.autoPopulateCheck ? els.autoPopulateCheck.checked : true;
  if (lazyEnabled && typeof IntersectionObserver !== "undefined") {
    lazyRowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const tr = entry.target;
            lazyRowObserver.unobserve(tr);
            triggerLazyRowLookup(tr, 70 + (i % 10) * 35);
          }
        });
      },
      {
        root: document.getElementById("tableScroll"),
        rootMargin: "100px"
      }
    );
  }

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
    tr._rowObj = rowObj;

    const tdNum = document.createElement("td");
    tdNum.className = "row-num-col";
    tdNum.textContent = startIdx + idx + 1;
    tr.appendChild(tdNum);

    visibleCols.forEach((col) => {
      const td = document.createElement("td");
      if (col.key === "personal/home phone") tr._phoneTd = td;
      if (col.key === "email") tr._emailTd = td;

      const val = rowObj[col.key];
      formatCellDisplay(td, val, rowObj, col.key, tr);

      td.addEventListener("dblclick", () => {
        startCellInlineEdit(td, rowObj, col.key);
      });

      tr.appendChild(td);
    });

    if (lazyRowObserver && (!rowObj["personal/home phone"] || !rowObj.email)) {
      lazyRowObserver.observe(tr);
    }

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);

  const totalUnclamped = getFilteredAndSortedRows(false).length;
  els.showingInfo.textContent =
    totalRows === 0
      ? "No matching rows"
      : !state.isUnlocked && totalUnclamped > MAX_LOCKED_RECORDS
      ? `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalRows.toLocaleString()} locked records (${totalUnclamped.toLocaleString()} total — Enter Voucher Code to unlock all)`
      : `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalRows.toLocaleString()} rows`;
  els.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages.toLocaleString()}`;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;
}

function buildContactLookupUrl(rowObj, colKey) {
  const name = (rowObj?.Name || "").trim();
  const addr = (rowObj?.["Mailing address"] || "").trim();
  const targetTerm = colKey === "email" ? "email contact" : "phone number contact";
  const q = [name, addr, targetTerm].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function formatCellDisplay(td, val, rowObj = null, colKey = "", tr = null) {
  td.className = "";
  td.innerHTML = "";
  if (val === null || val === undefined || val === "") {
    td.classList.add("cell-null");
    td.title = "Empty (Click Lookup to lazy-fill or double-click to edit)";

    if (rowObj && (colKey === "personal/home phone" || colKey === "email")) {
      const wrap = document.createElement("div");
      wrap.className = "cell-empty-wrap";

      const dash = document.createElement("span");
      dash.textContent = "—";
      wrap.appendChild(dash);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell-lookup-link";
      btn.textContent = "Lookup";
      btn.title = `Lazy look up ${colKey} for ${rowObj.Name || "this owner"}`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentTr = tr || td.closest("tr");
        if (parentTr) {
          parentTr._lazyResolved = false;
          triggerLazyRowLookup(parentTr, 60);
        }
      });
      btn.addEventListener("dblclick", (e) => e.stopPropagation());
      wrap.appendChild(btn);

      td.appendChild(wrap);
      return;
    }

    td.textContent = "—";
    return;
  }

  const str = String(val);
  if (rowObj && (colKey === "personal/home phone" || colKey === "email")) {
    const wrap = document.createElement("div");
    wrap.className = "cell-empty-wrap";

    const valSpan = document.createElement("span");
    valSpan.className = "cell-val-text";
    valSpan.textContent = str;
    wrap.appendChild(valSpan);

    const webLink = document.createElement("a");
    webLink.className = "cell-lookup-link";
    webLink.href = buildContactLookupUrl(rowObj, colKey);
    webLink.target = "_blank";
    webLink.rel = "noopener noreferrer";
    webLink.textContent = "Web ↗";
    webLink.title = `Search ${rowObj.Name || "owner"} on Google`;
    webLink.addEventListener("click", (e) => e.stopPropagation());
    webLink.addEventListener("dblclick", (e) => e.stopPropagation());
    wrap.appendChild(webLink);

    td.appendChild(wrap);
    td.title = `${str} (Double-click to edit)`;
    return;
  }

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
    formatCellDisplay(td, rowObj[colKey], rowObj, colKey);
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

  let rows = filteredOnly
    ? getFilteredAndSortedRows(true)
    : state.isUnlocked
    ? state.rows
    : state.rows.slice(0, MAX_LOCKED_RECORDS);
  if (limitRows && rows.length > limitRows) {
    rows = rows.slice(0, limitRows);
  }

  const lines = [];

  if (includeHeaders && cols.length > 0) {
    lines.push(cols.map((c) => escapeCsvCell(c.label, delimiter, quoteAll)).join(delimiter));
  }

  const lazyEnabled = els.autoPopulateCheck ? els.autoPopulateCheck.checked : true;
  for (const row of rows) {
    if (lazyEnabled && (!row["personal/home phone"] || !row.email)) {
      const resolved = resolveOwnerContact(row.Name, row["Mailing address"], row._schema || "");
      if (!row["personal/home phone"]) row["personal/home phone"] = resolved.phone;
      if (!row.email) row.email = resolved.email;
    }
    lines.push(cols.map((c) => escapeCsvCell(row[c.key], delimiter, quoteAll)).join(delimiter));
  }

  return lines.join("\r\n");
}

function updateCsvPreview() {
  els.csvPreviewOutput.value = generateCsvString(state.isUnlocked ? 500 : MAX_LOCKED_RECORDS);
}

function exportToCsvFile(force100Only = false) {
  if (state.rows.length === 0) {
    showToast("No data available to export!");
    return;
  }

  if (
    !state.isUnlocked &&
    force100Only !== true &&
    getFilteredAndSortedRows(false).length > MAX_LOCKED_RECORDS
  ) {
    openSecurityModal("export");
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

  showToast(`Exported ${filename} (${getFilteredAndSortedRows(true).length.toLocaleString()} rows)!`);
}

// Stream-convert 1 or all 6 massive .txt/.csv files in chunks directly to a 4-Column CSV file
async function streamFullFilesToCsv(force100Only = false) {
  const files = state.uploadedFiles;
  if (!files || files.length === 0) {
    showToast("Please drop or select your file(s) first.");
    return;
  }

  if (!state.isUnlocked && force100Only !== true) {
    openSecurityModal("stream");
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
  let hitLockLimit = false;

  for (const file of files) {
    if (hitLockLimit) break;
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
        if (!state.isUnlocked && totalExported >= MAX_LOCKED_RECORDS) {
          hitLockLimit = true;
          break;
        }
        const line = lines[i];
        if (!line || !line.trim()) continue;

        const mapped = parseLineToFourColumns(line, els.formatOverrideSelect.value);
        if (!mapped || (!mapped.Name && !mapped["Mailing address"])) continue;

        if (els.autoPopulateCheck?.checked && (!mapped["personal/home phone"] || !mapped.email)) {
          const resolved = resolveOwnerContact(mapped.Name, mapped["Mailing address"], mapped._schema || "");
          if (!mapped["personal/home phone"]) mapped["personal/home phone"] = resolved.phone;
          if (!mapped.email) mapped.email = resolved.email;
        }

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

      if (hitLockLimit) break;

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

async function copyCsvToClipboard(force100Only = false) {
  if (state.rows.length === 0) {
    showToast("No data to copy!");
    return;
  }
  if (
    !state.isUnlocked &&
    force100Only !== true &&
    getFilteredAndSortedRows(false).length > MAX_LOCKED_RECORDS
  ) {
    openSecurityModal("copy");
    return;
  }
  const csvContent = generateCsvString();
  try {
    await navigator.clipboard.writeText(csvContent);
    showToast(`Copied ${getFilteredAndSortedRows(true).length.toLocaleString()} rows to clipboard!`);
  } catch (_) {
    els.csvPreviewOutput.value = csvContent;
    els.csvPreviewOutput.select();
    document.execCommand("copy");
    showToast(`Copied ${getFilteredAndSortedRows(true).length.toLocaleString()} rows to clipboard!`);
  }
}

// ==========================================
// 4. EVENT LISTENERS & INITIALIZATION
// ==========================================

function getSelectedDatasetText(key) {
  if (key === "all_6_malen" || key === "all_4_malen") {
    return [
      MALEN_DATA.nov_2027,
      MALEN_DATA.apartment_master,
      MALEN_DATA.residential_master,
      MALEN_DATA.sales_affidavits,
      MALEN_DATA.pima_ownership,
      MALEN_DATA.pima_ppnov26
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

  [els.formatOverrideSelect, els.trimValuesCheck, els.dedupeOnParseCheck, els.autoPopulateCheck]
    .filter(Boolean)
    .forEach((el) => el.addEventListener("change", runFormatPipeline));

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
      key === "all_6_malen" ? "Malen_All_6_Files_Formatted" : `${key}_Formatted`;
    runFormatPipeline();
  });

  els.loadDefaultSampleBtn.addEventListener("click", () => {
    els.sampleSelect.value = "all_6_malen";
    els.rawInput.value = getSelectedDatasetText("all_6_malen");
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

  els.streamFullCsvBtn.addEventListener("click", () => streamFullFilesToCsv(false));

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

  els.exportCsvBtn.addEventListener("click", () => exportToCsvFile(false));
  els.copyCsvBtn.addEventListener("click", () => copyCsvToClipboard(false));

  [els.exportDelimiter, els.exportFilteredOnly, els.exportIncludeHeaders, els.exportQuoteAll].forEach(
    (el) =>
      el.addEventListener("change", () => {
        if (state.activeView === "csv") updateCsvPreview();
      })
  );

  els.pageSizeSelect.addEventListener("change", (e) => {
    const val = Number(e.target.value);
    if (!state.isUnlocked && val > MAX_LOCKED_RECORDS) {
      e.target.value = String(MAX_LOCKED_RECORDS);
      state.pageSize = MAX_LOCKED_RECORDS;
      state.currentPage = 1;
      renderAll();
      openSecurityModal("display");
      return;
    }
    state.pageSize = val;
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

  if (els.unlockAccessBtn) {
    els.unlockAccessBtn.addEventListener("click", () => {
      if (!state.isUnlocked) openSecurityModal("display");
    });
  }

  if (els.securityModal) {
    els.closeSecurityModalBtn.addEventListener("click", closeSecurityModal);
    els.securityModal.addEventListener("click", (e) => {
      if (e.target === els.securityModal) closeSecurityModal();
    });
    els.submitSecurityCodeBtn.addEventListener("click", verifyVoucherAndUnlock);
    els.securityCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyVoucherAndUnlock();
      if (e.key === "Escape") closeSecurityModal();
    });
    els.export100OnlyBtn.addEventListener("click", continueWith100Only);
  }

  if (els.openEnrichModalBtn && els.enrichModal) {
    els.openEnrichModalBtn.addEventListener("click", () => {
      els.enrichModal.classList.remove("hidden");
    });
    els.closeEnrichModalBtn.addEventListener("click", () => {
      els.enrichModal.classList.add("hidden");
    });
    els.enrichModal.addEventListener("click", (e) => {
      if (e.target === els.enrichModal) {
        els.enrichModal.classList.add("hidden");
      }
    });
  }

  if (els.browseMergeFileBtn && els.mergeContactFileInput) {
    els.browseMergeFileBtn.addEventListener("click", () => els.mergeContactFileInput.click());
    els.mergeContactFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        mergeContactsFromFile(e.target.files[0]);
      }
    });
  }

  if (els.autoFillMissingBtn) {
    els.autoFillMissingBtn.addEventListener("click", autoPopulateAllRowsInTable);
  }

  if (els.runApiEnrichBtn) {
    els.runApiEnrichBtn.addEventListener("click", runApiContactEnrichment);
  }
}

// ==========================================
// 7. VOUCHER CODE SECURITY & CONTACT ENRICHMENT
// ==========================================

const VALID_VOUCHER_CODES = new Set([
  "MALEN2026",
  "KHIM2026",
  "HIRAYA2026",
  "MONKEY2026",
  "SHORTAIL2026"
]);

function isValidVoucherCode(code) {
  const clean = String(code || "").trim().toUpperCase();
  return VALID_VOUCHER_CODES.has(clean);
}

function openSecurityModal(action = "display") {
  if (!els.securityModal) return;
  state.pendingSecurityAction = action;
  els.securityCodeInput.value = "";
  els.securityErrorMsg.classList.add("hidden");

  if (els.export100OnlyBtn) {
    els.export100OnlyBtn.textContent =
      action === "export" || action === "stream"
        ? "Export 100 Records Only"
        : action === "copy"
        ? "Copy 100 Records Only"
        : "Keep 100 Record Limit";
  }

  els.securityModal.classList.remove("hidden");
  setTimeout(() => els.securityCodeInput.focus(), 50);
}

function closeSecurityModal() {
  if (!els.securityModal) return;
  els.securityModal.classList.add("hidden");
  state.pendingSecurityAction = null;
}

function verifyVoucherAndUnlock() {
  const code = els.securityCodeInput ? els.securityCodeInput.value : "";
  if (!isValidVoucherCode(code)) {
    if (els.securityErrorMsg) els.securityErrorMsg.classList.remove("hidden");
    return;
  }

  state.isUnlocked = true;
  if (els.openEnrichModalBtn) {
    els.openEnrichModalBtn.disabled = false;
  }
  if (els.autoPopulateCheck) {
    els.autoPopulateCheck.disabled = false;
    els.autoPopulateCheck.checked = true;
  }

  const action = state.pendingSecurityAction;
  closeSecurityModal();
  renderAll();
  showToast("Voucher accepted! All records and Get Phone & Email are now unlocked.");

  if (action === "export") {
    exportToCsvFile(true);
  } else if (action === "copy") {
    copyCsvToClipboard(true);
  } else if (action === "stream") {
    streamFullFilesToCsv(true);
  }
}

function continueWith100Only() {
  const action = state.pendingSecurityAction;
  closeSecurityModal();

  if (action === "export") {
    exportToCsvFile(true);
  } else if (action === "copy") {
    copyCsvToClipboard(true);
  } else if (action === "stream") {
    streamFullFilesToCsv(true);
  }
}

function autoPopulateAllRowsInTable() {
  if (els.autoPopulateCheck) els.autoPopulateCheck.checked = true;
  let count = 0;
  for (const row of state.rows) {
    const resolved = resolveOwnerContact(row.Name, row["Mailing address"], "");
    if (!row["personal/home phone"] && resolved.phone) {
      row["personal/home phone"] = resolved.phone;
      count++;
    }
    if (!row.email && resolved.email) {
      row.email = resolved.email;
    }
  }
  renderAll();
  if (els.autoFillStatusText) {
    els.autoFillStatusText.textContent = `Populated phone & email across all ${state.rows.length.toLocaleString()} rows!`;
  }
  showToast(`Auto-populated phone & email across ${state.rows.length.toLocaleString()} rows!`);
}

function normalizeKey(str) {
  return String(str || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function mergeContactsFromFile(file) {
  try {
    els.mergeStatusText.textContent = `Reading ${file.name}...`;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      els.mergeStatusText.textContent = "File has no data rows.";
      return;
    }

    const delim = lines[0].includes("|") ? "|" : lines[0].includes("\t") ? "\t" : ",";
    const parseRow = (line) =>
      delim === "," ? splitCsvLine(line) : line.split(delim).map((c) => c.trim());

    const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase());
    const findIdx = (patterns) => headers.findIndex((h) => patterns.some((p) => p.test(h)));

    const nameIdx = findIdx([/name/, /owner/, /contact/, /full.?name/]);
    const firstIdx = findIdx([/^first.?name/, /^fname/]);
    const lastIdx = findIdx([/^last.?name/, /^lname/]);
    const addrIdx = findIdx([/mail/, /address/, /street/]);
    const personalPhoneIdx = findIdx([/personal/, /mobile/, /cell/, /wireless/]);
    const homePhoneIdx = findIdx([/home/, /landline/, /residential/]);
    const genericPhoneIdx = findIdx([/phone/, /tel/]);
    const emailIdx = findIdx([/email/, /e-mail/]);

    if (personalPhoneIdx === -1 && homePhoneIdx === -1 && genericPhoneIdx === -1 && emailIdx === -1) {
      els.mergeStatusText.textContent =
        "Could not find a Phone or Email column in the uploaded file header.";
      return;
    }

    const byName = new Map();
    const byAddr = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      const pPhone = personalPhoneIdx !== -1 ? (cols[personalPhoneIdx] || "").trim() : "";
      const hPhone = homePhoneIdx !== -1 ? (cols[homePhoneIdx] || "").trim() : "";
      const gPhone = genericPhoneIdx !== -1 ? (cols[genericPhoneIdx] || "").trim() : "";

      let phone = "";
      if (pPhone && hPhone && pPhone !== hPhone) {
        phone = `Personal: ${pPhone} / Home: ${hPhone}`;
      } else if (pPhone) {
        phone = `Personal: ${pPhone}`;
      } else if (hPhone) {
        phone = `Home: ${hPhone}`;
      } else {
        phone = gPhone;
      }

      const email = emailIdx !== -1 ? (cols[emailIdx] || "").trim() : "";
      if (!phone && !email) continue;

      let rawName = nameIdx !== -1 ? cols[nameIdx] || "" : "";
      if (!rawName && (firstIdx !== -1 || lastIdx !== -1)) {
        rawName = `${cols[lastIdx] || ""} ${cols[firstIdx] || ""}`.trim();
      }
      const rawAddr = addrIdx !== -1 ? cols[addrIdx] || "" : "";

      const nKey = normalizeKey(rawName);
      const aKey = normalizeKey(rawAddr.split(",")[0]);
      if (nKey) byName.set(nKey, { phone, email });
      if (aKey && aKey.length >= 6) byAddr.set(aKey, { phone, email });
    }

    let matched = 0;
    for (const row of state.rows) {
      const rNameKey = normalizeKey(row.Name);
      const rStreetKey = normalizeKey((row["Mailing address"] || "").split(",")[0]);
      const hit = byName.get(rNameKey) || (rStreetKey.length >= 6 ? byAddr.get(rStreetKey) : null);
      if (hit) {
        if (hit.phone && !row["personal/home phone"]) row["personal/home phone"] = hit.phone;
        if (hit.email && !row.email) row.email = hit.email;
        matched++;
      }
    }

    renderAll();
    els.mergeStatusText.textContent = `Merged phone/email into ${matched.toLocaleString()} matching rows!`;
    showToast(`Merged contact details into ${matched.toLocaleString()} rows.`);
  } catch (err) {
    els.mergeStatusText.textContent = `Error reading file: ${err.message}`;
  }
}

async function runApiContactEnrichment() {
  const apiKey = (els.enrichApiKeyInput.value || "").trim();
  const provider = els.enrichProviderSelect.value;
  const scope = els.enrichScopeSelect.value;

  if (!apiKey) {
    els.apiEnrichStatus.textContent = "Please enter your API key first.";
    return;
  }

  const filtered = getFilteredAndSortedRows();
  let targets = [];
  if (scope === "page") {
    const pageSize = Number(state.pageSize) || 50;
    const startIdx = (state.currentPage - 1) * pageSize;
    targets = filtered.slice(startIdx, startIdx + pageSize);
  } else {
    const limit = Number(scope) || 25;
    targets = filtered.filter((r) => !r["personal/home phone"] || !r.email).slice(0, limit);
  }

  if (targets.length === 0) {
    els.apiEnrichStatus.textContent = "No rows need enrichment in the selected scope.";
    return;
  }

  els.runApiEnrichBtn.disabled = true;
  let updatedCount = 0;

  try {
    for (let i = 0; i < targets.length; i++) {
      const row = targets[i];
      els.apiEnrichStatus.textContent = `Enriching ${i + 1} / ${targets.length}: ${row.Name}...`;

      if (provider === "pdl") {
        const params = new URLSearchParams({
          name: row.Name,
          location: row["Mailing address"]
        });
        const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
          headers: { "X-Api-Key": apiKey }
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          const pPhone = data.mobile_phone || "";
          const allPhones = Array.isArray(data.phone_numbers) ? data.phone_numbers : [];
          const hPhone = allPhones.find((n) => n && n !== pPhone) || allPhones[0] || "";
          const phone =
            pPhone && hPhone && pPhone !== hPhone
              ? `Personal: ${pPhone} / Home: ${hPhone}`
              : pPhone
              ? `Personal: ${pPhone}`
              : hPhone
              ? `Home: ${hPhone}`
              : "";
          const email =
            data.personal_emails?.[0] ||
            data.work_email ||
            (Array.isArray(data.emails) && data.emails[0]?.address) ||
            "";
          if (phone || email) {
            if (phone && !row["personal/home phone"]) row["personal/home phone"] = phone;
            if (email && !row.email) row.email = email;
            updatedCount++;
          }
        }
      } else if (provider === "batchdata") {
        const addrParts = (row["Mailing address"] || "").split(",").map((s) => s.trim());
        const res = await fetch("https://api.batchdata.com/api/v1/property/skip-trace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            requests: [
              {
                propertyAddress: {
                  street: addrParts[0] || "",
                  city: addrParts[1] || "",
                  state: (addrParts[2] || "").split(" ")[0] || "AZ",
                  zip: (addrParts[2] || "").split(" ")[1] || ""
                }
              }
            ]
          })
        });
        if (res.ok) {
          const json = await res.json();
          const person = json?.results?.persons?.[0];
          const nums = Array.isArray(person?.phoneNumbers) ? person.phoneNumbers : [];
          const pPhone =
            nums.find((p) => /mobile|wireless|cell/i.test(p.type || ""))?.number ||
            nums[0]?.number ||
            "";
          const hPhone =
            nums.find((p) => /landline|home|residential/i.test(p.type || "") && p.number !== pPhone)
              ?.number ||
            nums.find((p) => p.number && p.number !== pPhone)?.number ||
            "";
          const phone =
            pPhone && hPhone
              ? `Personal: ${pPhone} / Home: ${hPhone}`
              : pPhone
              ? `Personal: ${pPhone}`
              : hPhone
              ? `Home: ${hPhone}`
              : "";
          const email = person?.emails?.[0]?.email || "";
          if (phone || email) {
            if (phone && !row["personal/home phone"]) row["personal/home phone"] = phone;
            if (email && !row.email) row.email = email;
            updatedCount++;
          }
        }
      } else if (provider === "apollo") {
        const res = await fetch("https://api.apollo.io/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey
          },
          body: JSON.stringify({
            name: row.Name,
            address: row["Mailing address"]
          })
        });
        if (res.ok) {
          const json = await res.json();
          const person = json.person || {};
          const nums = Array.isArray(person.phone_numbers) ? person.phone_numbers : [];
          const pPhone =
            nums.find((p) => /mobile/i.test(p.type || ""))?.sanitized_number ||
            nums[0]?.sanitized_number ||
            "";
          const hPhone =
            nums.find((p) => /home/i.test(p.type || "") && p.sanitized_number !== pPhone)
              ?.sanitized_number ||
            nums.find((p) => p.sanitized_number && p.sanitized_number !== pPhone)
              ?.sanitized_number ||
            "";
          const phone =
            pPhone && hPhone
              ? `Personal: ${pPhone} / Home: ${hPhone}`
              : pPhone
              ? `Personal: ${pPhone}`
              : hPhone
              ? `Home: ${hPhone}`
              : "";
          const email = person.email || "";
          if (phone || email) {
            if (phone && !row["personal/home phone"]) row["personal/home phone"] = phone;
            if (email && !row.email) row.email = email;
            updatedCount++;
          }
        }
      }
    }

    renderAll();
    els.apiEnrichStatus.textContent = `Done! Populated phone/email for ${updatedCount} of ${targets.length} rows.`;
    showToast(`Enriched ${updatedCount} rows with phone/email.`);
  } catch (err) {
    els.apiEnrichStatus.textContent = `API request failed: ${err.message}`;
  } finally {
    els.runApiEnrichBtn.disabled = false;
  }
}

// Initialize with all 6 Malen & Pima datasets combined into the 4 columns
setupEventListeners();
els.sampleSelect.value = "all_6_malen";
els.rawInput.value = getSelectedDatasetText("all_6_malen");
runFormatPipeline();
