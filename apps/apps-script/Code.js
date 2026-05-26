const CONFIG = {
  spreadsheetName: 'Docshare Letter Management',
  driveFolderName: 'Docshare Attachments',
  incomingFolderName: 'Incoming Letters',
  outgoingFolderName: 'Outgoing Letters',
};

const SHEETS = {
  settings: ['key', 'value'],
  users: ['username', 'password', 'displayName', 'role', 'active'],
  incoming: ['id', 'ref', 'dr', 'du', 'by', 'from', 'to', 'subj', 'desc', 'fileId', 'fileName', 'fileType', 'fileUrl', 'status', 'note', 'deAt'],
  outgoing: ['id', 'ref', 'ds', 'du', 'by', 'from', 'to', 'subj', 'desc', 'fileId', 'fileName', 'fileType', 'fileUrl'],
  assignments: ['letterId', 'username', 'displayName', 'status', 'seen'],
  notifications: ['id', 'username', 'title', 'message', 'letterId', 'ref', 'type', 'read', 'createdAt'],
};

const SHEET_ALIASES = {
  incoming: {
    subj: ['subject', 'Subject'],
    desc: ['description', 'Description'],
    dr: ['dateReceived', 'Date Received'],
    du: ['dateUploaded', 'Date Uploaded'],
  },
  outgoing: {
    subj: ['subject', 'Subject'],
    desc: ['description', 'Description'],
    ds: ['dateSent', 'Date Sent'],
    du: ['dateUploaded', 'Date Uploaded'],
  },
  users: {
    username: ['user', 'userName', 'Username'],
    displayName: ['name', 'fullName', 'Display Name'],
  },
  assignments: {
    letterId: ['incomingId', 'documentId'],
    username: ['user', 'userName', 'Username'],
  },
  notifications: {
    username: ['user', 'userName', 'Username'],
    createdAt: ['created', 'dateCreated'],
  },
};

const DEFAULT_USERS = [
  ['DE', 'de537', 'Divisional Engineer', 'DE', 'TRUE'],
  ['CC', 'cc568', 'Chief Clerk', 'CC', 'TRUE'],
  ['MO1', 'mo559', 'Management Officer 1', 'MO', 'TRUE'],
  ['MO2', 'mo587', 'Management Officer 2', 'MO', 'TRUE'],
  ['MO3', 'mo852', 'Management Officer 3', 'MO', 'TRUE'],
  ['MO4', 'mo456', 'Management Officer 4', 'MO', 'TRUE'],
  ['DO1', 'do753', 'Development Officer 1', 'DO', 'TRUE'],
  ['DO2', 'do357', 'Development Officer 2', 'DO', 'TRUE'],
  ['STO KADUWELA', 'kadu753', 'STO Kaduwela', 'STO', 'TRUE'],
  ['STO MAHARAGAMA', 'ma785', 'STO Maharagama', 'STO', 'TRUE'],
  ['STO NUGEGODA', 'nu459', 'STO Nugegoda', 'STO', 'TRUE'],
  ['STO KOLONNAWA', 'ko951', 'STO Kolonnawa', 'STO', 'TRUE'],
  ['KADUWELA TO1', 'kadu852', 'Kaduwela TO1', 'TO', 'TRUE'],
  ['KADUWELA TO2', 'kadu794', 'Kaduwela TO2', 'TO', 'TRUE'],
  ['KADUWELA TO3', 'kadu259', 'Kaduwela TO3', 'TO', 'TRUE'],
  ['KOLONNAWA TO1', 'ko871', 'Kolonnawa TO1', 'TO', 'TRUE'],
  ['KOLONNAWA TO2', 'ko864', 'Kolonnawa TO2', 'TO', 'TRUE'],
  ['NUGEGODA TO1', 'nu169', 'Nugegoda TO1', 'TO', 'TRUE'],
  ['NUGEGODA TO2', 'nu119', 'Nugegoda TO2', 'TO', 'TRUE'],
  ['MAHARAGAMA TO1', 'ma941', 'Maharagama TO1', 'TO', 'TRUE'],
  ['MAHARAGAMA TO2', 'ma241', 'Maharagama TO2', 'TO', 'TRUE'],
];

function initSystem() {
  const ss = getSpreadsheet_();
  Object.keys(SHEETS).forEach(name => ensureSheet_(ss, name, SHEETS[name]));
  ensureDefaultUsers_(ss);
  ensureDriveFolders_();
  return {
    spreadsheetUrl: ss.getUrl(),
    rootFolderId: PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID'),
  };
}

function doPost(e) {
  try {
    initSystem();
    const payload = parsePayload_(e);
    const action = payload.action;

    if (action === 'login') return json_(login_(payload.username, payload.password));
    if (action === 'bootstrap') return json_({ users: publicUsers_(), state: readState_() });
    if (action === 'getState') return json_(readState_());
    if (action === 'saveState') return json_(saveState_(payload.state));
    if (action === 'markNotificationsRead') return json_(markNotificationsRead_(payload.username));

    return json_({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json_({ ok: false, error: error.message || String(error) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'docshare-apps-script-api' });
}

function login_(username, password) {
  const normalized = String(username || '').trim().toUpperCase();
  const pass = String(password || '').trim();
  const user = readUsers_().find(row => row.u === normalized && row.password === pass && row.active);

  if (!user) return { ok: false, error: 'Invalid username or password.' };
  return { ok: true, user: publicUser_(user) };
}

function readState_() {
  const ss = getSpreadsheet_();
  const incomingRows = readObjects_(ss.getSheetByName('incoming'));
  const outgoingRows = readObjects_(ss.getSheetByName('outgoing'));
  const assignments = readObjects_(ss.getSheetByName('assignments'));
  const notifications = readObjects_(ss.getSheetByName('notifications'));
  const settings = settingsMap_(ss);

  const asgnByLetter = assignments.reduce((map, row) => {
    const letterId = row.letterId;
    if (!map[letterId]) map[letterId] = [];
    map[letterId].push({
      u: row.username,
      d: row.displayName,
      s: row.status || 'pending',
      seen: row.seen || null,
    });
    return map;
  }, {});

  const inL = incomingRows.map(row => ({
    id: row.id,
    ref: row.ref,
    dr: row.dr,
    du: row.du,
    by: row.by,
    from: row.from,
    to: row.to,
    subj: row.subj,
    desc: row.desc,
    fileId: row.fileId,
    fn: row.fileName,
    ft: row.fileType,
    fileUrl: row.fileUrl,
    asgn: asgnByLetter[row.id] || [],
    status: row.status || 'pending_de',
    note: row.note || '',
    deAt: row.deAt || '',
  }));

  const outL = outgoingRows.map(row => ({
    id: row.id,
    ref: row.ref,
    ds: row.ds,
    du: row.du,
    by: row.by,
    from: row.from,
    to: row.to,
    subj: row.subj,
    desc: row.desc,
    fileId: row.fileId,
    fn: row.fileName,
    ft: row.fileType,
    fileUrl: row.fileUrl,
  }));

  return {
    inL,
    outL,
    notifications: notifications.map(row => ({
      id: row.id,
      username: row.username,
      title: row.title,
      message: row.message,
      letterId: row.letterId,
      ref: row.ref,
      type: row.type,
      read: String(row.read).toUpperCase() === 'TRUE',
      createdAt: row.createdAt,
    })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    inC: Number(settings.IN_COUNTER || nextCounter_(inL, 'In')),
    outC: Number(settings.OUT_COUNTER || nextCounter_(outL, 'Out')),
  };
}

function saveState_(state) {
  if (!state || !Array.isArray(state.inL) || !Array.isArray(state.outL)) {
    throw new Error('Invalid state payload');
  }

  const ss = getSpreadsheet_();
  const previous = readState_();
  const incoming = state.inL.map(letter => normalizeIncoming_(letter));
  const outgoing = state.outL.map(letter => normalizeOutgoing_(letter));
  const assignments = [];
  const notifications = [
    ...readObjects_(ss.getSheetByName('notifications')),
    ...buildNotifications_(previous, { inL: incoming, outL: outgoing }),
  ];

  incoming.forEach(letter => {
    (letter.asgn || []).forEach(item => {
      assignments.push([letter.id, item.u, item.d, item.s || 'pending', item.seen || '']);
    });
  });

  writeObjects_(ss.getSheetByName('incoming'), incoming.map(letter => ({
    id: letter.id,
    ref: letter.ref,
    dr: letter.dr,
    du: letter.du,
    by: letter.by,
    from: letter.from,
    to: letter.to,
    subj: letter.subj,
    desc: letter.desc,
    fileId: letter.fileId,
    fileName: letter.fn,
    fileType: letter.ft,
    fileUrl: letter.fileUrl,
    status: letter.status,
    note: letter.note,
    deAt: letter.deAt,
  })));

  writeObjects_(ss.getSheetByName('outgoing'), outgoing.map(letter => ({
    id: letter.id,
    ref: letter.ref,
    ds: letter.ds,
    du: letter.du,
    by: letter.by,
    from: letter.from,
    to: letter.to,
    subj: letter.subj,
    desc: letter.desc,
    fileId: letter.fileId,
    fileName: letter.fn,
    fileType: letter.ft,
    fileUrl: letter.fileUrl,
  })));

  writeRows_(ss.getSheetByName('assignments'), assignments);
  writeObjects_(ss.getSheetByName('notifications'), notifications);
  setSetting_(ss, 'IN_COUNTER', String(state.inC || nextCounter_(incoming, 'In')));
  setSetting_(ss, 'OUT_COUNTER', String(state.outC || nextCounter_(outgoing, 'Out')));

  return { ok: true, state: readState_() };
}

function markNotificationsRead_(username) {
  const normalized = String(username || '').trim().toUpperCase();
  const ss = getSpreadsheet_();
  const notifications = readObjects_(ss.getSheetByName('notifications')).map(row => ({
    ...row,
    read: String(row.username || '').toUpperCase() === normalized ? 'TRUE' : row.read,
  }));

  writeObjects_(ss.getSheetByName('notifications'), notifications);
  return { ok: true, state: readState_() };
}

function buildNotifications_(previous, next) {
  const previousLetters = new Map((previous.inL || []).map(letter => [letter.id, letter]));
  const nextLetters = new Map((next.inL || []).map(letter => [letter.id, letter]));
  const items = [];

  next.inL.forEach(letter => {
    const old = previousLetters.get(letter.id);
    if (!old) {
      if (letter.status === 'pending_de') {
        items.push(notification_('DE', 'New letter pending review', `${letter.ref} - ${letter.subj}`, letter, 'pending_review'));
      }
      if (letter.status === 'de_reviewed') {
        (letter.asgn || []).forEach(item => {
          items.push(notification_(item.u, 'New letter assigned', `${letter.ref} - ${letter.subj}`, letter, 'assigned'));
        });
      }
      return;
    }

    if (old.status === 'pending_de' && letter.status === 'de_reviewed') {
      (letter.asgn || []).forEach(item => {
        items.push(notification_(item.u, 'Letter approved and assigned', `${letter.ref} - ${letter.subj}`, letter, 'approved'));
      });
    }

    const oldAssignments = new Map((old.asgn || []).map(item => [item.u, item]));
    (letter.asgn || []).forEach(item => {
      const oldItem = oldAssignments.get(item.u);
      if (!oldItem) {
        items.push(notification_(item.u, 'New assignment', `${letter.ref} - ${letter.subj}`, letter, 'assigned'));
      } else if (oldItem.s !== item.s) {
        items.push(notification_('DE', 'Task status updated', `${item.d} marked ${letter.ref} as ${item.s}`, letter, 'status'));
      }
    });
  });

  (next.outL || []).forEach(letter => {
    if (!previous.outL.find(item => item.id === letter.id)) {
      items.push(notification_('DE', 'Outgoing letter recorded', `${letter.ref} - ${letter.subj}`, letter, 'outgoing'));
      items.push(notification_('CC', 'Outgoing letter recorded', `${letter.ref} - ${letter.subj}`, letter, 'outgoing'));
    }
  });

  return items;
}

function notification_(username, title, message, letter, type) {
  return {
    id: Utilities.getUuid(),
    username,
    title,
    message,
    letterId: letter.id,
    ref: letter.ref,
    type,
    read: 'FALSE',
    createdAt: new Date().toISOString(),
  };
}

function normalizeIncoming_(letter) {
  const file = ensureFile_(letter, 'incoming');
  return {
    ...letter,
    fileId: file.fileId,
    fn: file.fileName,
    ft: file.fileType,
    fileUrl: file.fileUrl,
    fd: '',
  };
}

function normalizeOutgoing_(letter) {
  const file = ensureFile_(letter, 'outgoing');
  return {
    ...letter,
    fileId: file.fileId,
    fn: file.fileName,
    ft: file.fileType,
    fileUrl: file.fileUrl,
    fd: '',
  };
}

function ensureFile_(letter, type) {
  if (letter.fileId) {
    return {
      fileId: letter.fileId,
      fileName: letter.fn || '',
      fileType: letter.ft || '',
      fileUrl: letter.fileUrl || driveFileUrl_(letter.fileId),
    };
  }

  if (!letter.fd || !letter.fn) {
    return {
      fileId: '',
      fileName: letter.fn || '',
      fileType: letter.ft || '',
      fileUrl: letter.fileUrl || '',
    };
  }

  const folder = getAttachmentFolder_(type);
  const bytes = Utilities.base64Decode(letter.fd);
  const blob = Utilities.newBlob(bytes, letter.ft || MimeType.BINARY, letter.fn);
  const file = folder.createFile(blob);

  return {
    fileId: file.getId(),
    fileName: file.getName(),
    fileType: letter.ft || file.getMimeType(),
    fileUrl: driveFileUrl_(file.getId()),
  };
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SPREADSHEET_ID');

  if (existingId) return SpreadsheetApp.openById(existingId);

  const ss = SpreadsheetApp.create(CONFIG.spreadsheetName);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    resizeSheetColumns_(sheet, headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(value => String(value || '').trim());
  const hasData = sheet.getLastRow() > 1;
  const orderedHeadersMatch = headers.every((header, index) => currentHeaders[index] === header);
  const hasExtraColumns = currentHeaders.slice(headers.length).some(Boolean);

  if (!orderedHeadersMatch || hasExtraColumns) {
    const rows = hasData
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues()
      : [];

    if (hasData || hasExtraColumns) backupSheet_(ss, sheet, name);

    const index = currentHeaders.reduce((map, header, idx) => {
      if (header) map[header] = idx;
      return map;
    }, {});
    const aliases = SHEET_ALIASES[name] || {};
    const migratedRows = rows
      .filter(row => row.some(value => value !== ''))
      .map(row => headers.map(header => {
        const candidates = [header, ...(aliases[header] || [])];
        const found = candidates.find(candidate => index[candidate] !== undefined);
        return found ? row[index[found]] : '';
      }));

    sheet.clearContents();
    resizeSheetColumns_(sheet, headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, headers.length).setValues(migratedRows);
  }

  sheet.setFrozenRows(1);
  return sheet;
}

function resizeSheetColumns_(sheet, desiredColumns) {
  const currentColumns = sheet.getMaxColumns();
  if (currentColumns < desiredColumns) {
    sheet.insertColumnsAfter(currentColumns, desiredColumns - currentColumns);
  } else if (currentColumns > desiredColumns) {
    sheet.deleteColumns(desiredColumns + 1, currentColumns - desiredColumns);
  }
}

function backupSheet_(ss, sheet, name) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const backupName = uniqueSheetName_(ss, `${name}_backup_${stamp}`);
  const backup = sheet.copyTo(ss);
  backup.setName(backupName);
  ss.setActiveSheet(sheet);
}

function uniqueSheetName_(ss, desiredName) {
  let name = desiredName.slice(0, 99);
  let counter = 1;
  while (ss.getSheetByName(name)) {
    const suffix = `_${counter}`;
    name = `${desiredName.slice(0, 99 - suffix.length)}${suffix}`;
    counter += 1;
  }
  return name;
}

function ensureDefaultUsers_(ss) {
  const sheet = ss.getSheetByName('users');
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(2, 1, DEFAULT_USERS.length, DEFAULT_USERS[0].length).setValues(DEFAULT_USERS);
}

function ensureDriveFolders_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ROOT_FOLDER_ID')) return;

  const root = DriveApp.createFolder(CONFIG.driveFolderName);
  const incoming = root.createFolder(CONFIG.incomingFolderName);
  const outgoing = root.createFolder(CONFIG.outgoingFolderName);

  props.setProperty('ROOT_FOLDER_ID', root.getId());
  props.setProperty('INCOMING_FOLDER_ID', incoming.getId());
  props.setProperty('OUTGOING_FOLDER_ID', outgoing.getId());
}

function getAttachmentFolder_(type) {
  const props = PropertiesService.getScriptProperties();
  const key = type === 'outgoing' ? 'OUTGOING_FOLDER_ID' : 'INCOMING_FOLDER_ID';
  return DriveApp.getFolderById(props.getProperty(key));
}

function readUsers_() {
  const ss = getSpreadsheet_();
  return readObjects_(ss.getSheetByName('users')).map(row => ({
    u: String(row.username || '').toUpperCase(),
    password: String(row.password || ''),
    d: row.displayName || row.username,
    r: row.role || '',
    active: String(row.active).toUpperCase() !== 'FALSE',
  }));
}

function publicUsers_() {
  return readUsers_().filter(user => user.active).map(publicUser_);
}

function publicUser_(user) {
  return { u: user.u, d: user.d, r: user.r };
}

function readObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift();
  return values
    .filter(row => row.some(value => value !== ''))
    .map(row => headers.reduce((object, header, index) => {
      object[header] = row[index] instanceof Date ? row[index].toISOString() : row[index];
      return object;
    }, {}));
}

function writeObjects_(sheet, objects) {
  const headers = SHEETS[sheet.getName()];
  const rows = objects.map(object => headers.map(header => object[header] || ''));
  writeRows_(sheet, rows);
}

function writeRows_(sheet, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function settingsMap_(ss) {
  return readObjects_(ss.getSheetByName('settings')).reduce((map, row) => {
    map[row.key] = row.value;
    return map;
  }, {});
}

function setSetting_(ss, key, value) {
  const sheet = ss.getSheetByName('settings');
  const data = readObjects_(sheet);
  const index = data.findIndex(row => row.key === key);
  const row = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 2).setValues([[key, value]]);
}

function nextCounter_(letters, type) {
  const prefix = `_${type}_`;
  const max = letters.reduce((value, letter) => {
    const ref = String(letter.ref || '');
    const index = ref.lastIndexOf(prefix);
    if (index === -1) return value;
    const parsed = Number(ref.slice(index + prefix.length));
    return Number.isFinite(parsed) ? Math.max(value, parsed) : value;
  }, 0);
  return max + 1;
}

function driveFileUrl_(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
