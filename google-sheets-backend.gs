/**
 * PLANORA — Google Sheets Backend (Apps Script)
 * 
 * Paste this into Google Sheets -> Extensions -> Apps Script
 * Then Deploy -> New deployment -> Select type: Web app
 * - Execute as: Me
 * - Who has access: Anyone
 * Copy the Web app URL and paste it into Planora!
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);

  var params = e.parameter || {};
  var postData = {};
  if (e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (err) {
      postData = {};
    }
  }

  var action = postData.action || params.action || 'getAll';
  var userId = postData.userId || params.userId || '';

  var output = { success: true };

  try {
    if (action === 'getAll') {
      output.profile = getProfile(ss, userId);
      output.subjects = getSubjects(ss, userId);
      output.chapters = getChapters(ss, userId);
      output.blocks = getBlocks(ss, userId);
    } else if (action === 'upsertProfile') {
      output.profile = saveProfile(ss, postData.profile);
    } else if (action === 'saveSubjects') {
      output.subjects = saveSubjects(ss, postData.subjects);
    } else if (action === 'saveChapters') {
      output.chapters = saveChapters(ss, postData.chapters);
    } else if (action === 'saveBlocks') {
      output.blocks = saveBlocks(ss, postData.blocks);
    } else if (action === 'updateBlockStatus') {
      updateBlockStatus(ss, postData.blockId, postData.status);
    } else if (action === 'updateChapter') {
      updateChapter(ss, postData.chapterId, postData.updates);
    } else if (action === 'replaceIncompleteBlocks') {
      output.blocks = replaceIncompleteBlocks(ss, postData.userId, postData.todayStr, postData.newBlocks);
    } else if (action === 'clearUserData') {
      clearUserData(ss, postData.userId);
    } else {
      output = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    output = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheets(ss) {
  var headers = {
    profiles: ['id', 'user_id', 'name', 'daily_hours', 'session_min', 'break_min', 'created_at'],
    subjects: ['id', 'user_id', 'name', 'color_key', 'exam_date', 'difficulty', 'priority', 'created_at'],
    chapters: ['id', 'user_id', 'subject_id', 'title', 'est_min', 'is_done', 'position', 'created_at'],
    blocks: ['id', 'user_id', 'chapter_id', 'date', 'start_min', 'duration_min', 'status', 'created_at']
  };

  for (var name in headers) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers[name]);
      sheet.setFrozenRows(1);
    }
  }
}

function getRowsAsObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function getProfile(ss, userId) {
  var rows = getRowsAsObjects(ss.getSheetByName('profiles'));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === userId || rows[i].user_id === userId) return rows[i];
  }
  return null;
}

function getSubjects(ss, userId) {
  var rows = getRowsAsObjects(ss.getSheetByName('subjects'));
  return rows.filter(function(r) { return !userId || r.user_id === userId; });
}

function getChapters(ss, userId) {
  var rows = getRowsAsObjects(ss.getSheetByName('chapters'));
  return rows.filter(function(r) { return !userId || r.user_id === userId; });
}

function getBlocks(ss, userId) {
  var rows = getRowsAsObjects(ss.getSheetByName('blocks'));
  return rows.filter(function(r) { return !userId || r.user_id === userId; });
}

function saveProfile(ss, profile) {
  var sheet = ss.getSheetByName('profiles');
  var data = sheet.getDataRange().getValues();
  var foundIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === profile.id) {
      foundIndex = i + 1;
      break;
    }
  }

  var row = [
    profile.id,
    profile.user_id || profile.id,
    profile.name || '',
    profile.daily_hours || 3,
    profile.session_min || 45,
    profile.break_min || 10,
    profile.created_at || new Date().toISOString()
  ];

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return profile;
}

function saveSubjects(ss, subjects) {
  var sheet = ss.getSheetByName('subjects');
  for (var i = 0; i < subjects.length; i++) {
    var s = subjects[i];
    s.id = s.id || ('sub_' + Date.now() + '_' + i);
    sheet.appendRow([
      s.id,
      s.user_id,
      s.name,
      s.color_key,
      s.exam_date,
      s.difficulty,
      s.priority || 2,
      new Date().toISOString()
    ]);
  }
  return subjects;
}

function saveChapters(ss, chapters) {
  var sheet = ss.getSheetByName('chapters');
  for (var i = 0; i < chapters.length; i++) {
    var c = chapters[i];
    c.id = c.id || ('ch_' + Date.now() + '_' + i);
    sheet.appendRow([
      c.id,
      c.user_id,
      c.subject_id,
      c.title,
      c.est_min,
      c.is_done ? true : false,
      c.position || (i + 1),
      new Date().toISOString()
    ]);
  }
  return chapters;
}

function saveBlocks(ss, blocks) {
  var sheet = ss.getSheetByName('blocks');
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    b.id = b.id || ('blk_' + Date.now() + '_' + i);
    sheet.appendRow([
      b.id,
      b.user_id,
      b.chapter_id,
      b.date,
      b.start_min,
      b.duration_min,
      b.status || 'scheduled',
      new Date().toISOString()
    ]);
  }
  return blocks;
}

function updateBlockStatus(ss, blockId, status) {
  var sheet = ss.getSheetByName('blocks');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === blockId) {
      sheet.getRange(i + 1, 7).setValue(status);
      break;
    }
  }
}

function updateChapter(ss, chapterId, updates) {
  var sheet = ss.getSheetByName('chapters');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === chapterId) {
      if (updates.is_done !== undefined) {
        sheet.getRange(i + 1, 6).setValue(updates.is_done);
      }
      break;
    }
  }
}

function replaceIncompleteBlocks(ss, userId, todayStr, newBlocks) {
  var sheet = ss.getSheetByName('blocks');
  var data = sheet.getDataRange().getValues();
  var rowsToKeep = [data[0]]; // keep headers

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowUserId = row[1];
    var rowDate = String(row[3]);
    var rowStatus = row[6];

    // Keep if not this user OR status is 'done' OR date is before today
    if (rowUserId !== userId || rowStatus === 'done' || rowDate < todayStr) {
      rowsToKeep.push(row);
    }
  }

  // Clear sheet and rewrite kept rows
  sheet.clearContents();
  sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);

  // Append new blocks
  return saveBlocks(ss, newBlocks);
}

function clearUserData(ss, userId) {
  var sheetNames = ['profiles', 'subjects', 'chapters', 'blocks'];
  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = ss.getSheetByName(sheetNames[s]);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    var keep = [data[0]];
    for (var i = 1; i < data.length; i++) {
      var rowUserId = sheetNames[s] === 'profiles' ? data[i][0] : data[i][1];
      if (rowUserId !== userId) {
        keep.push(data[i]);
      }
    }
    sheet.clearContents();
    sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
  }
}

