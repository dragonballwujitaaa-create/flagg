/**
 * Google Apps Script 最終優化版路由引擎
 */

const CONFIG = {
  SPREADSHEET_ID: '1IzAXRPNX-Qb0JhJEEx0UZxzuJYuxVaepQCjUByisniE',
  SHEET_NAME: 'Leaderboard',
  DEFAULT_PAGE: 'start',
  MAX_ENTRIES: 15
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const page = String(params.page || CONFIG.DEFAULT_PAGE).toLowerCase();
  
  // 【關鍵優化】自動偵測回傳資料：如果帶有新分數參數，先執行存檔
  if (params.name && params.score && params.new === '1') {
    saveScoreInternal(params.name, params.score);
  }

  // 路由合法性檢查
  const validPages = ['start', 'index', 'leaderboard'];
  const fileToLoad = validPages.includes(page) ? page : CONFIG.DEFAULT_PAGE;

  try {
    const template = HtmlService.createTemplateFromFile(fileToLoad);

    // 關鍵注入：動態獲取當前 Script URL
    template.scriptUrl = ScriptApp.getService().getUrl();
    
    // 數據注入：排行榜頁面預載入最新數據 (包含剛存入的那一筆)
    template.serverData = (fileToLoad === 'leaderboard') 
      ? JSON.stringify(getLeaderboardResponse()) 
      : "{}";

    return template.evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle('俄羅斯方塊 - 英雄榜系統')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput(`<h1>系統導覽錯誤</h1><p>嘗試載入 ${fileToLoad} 失敗。</p>`);
  }
}

/** 獲取排行榜資料 */
function getLeaderboardResponse() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) return { result: "success", data: [] };

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    const leaderboard = data.map(row => ({
      username: String(row[0]),
      score: parseInt(row[1]) || 0,
      timestamp: String(row[2])
    })).sort((a, b) => b.score - a.score).slice(0, CONFIG.MAX_ENTRIES);

    return { result: "success", data: leaderboard };
  } catch (err) {
    return { result: "error", message: err.toString() };
  }
}

/** 內部存檔函數 */
function saveScoreInternal(name, score) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['玩家名稱', '分數', '日期']);
    }

    // 安全過濾：移除 HTML 標籤並限制字數
    const cleanName = String(name).replace(/<[^>]*>?/gm, '').substring(0, 15) || "匿名玩家";
    const cleanScore = parseInt(score) || 0;

    sheet.appendRow([cleanName, cleanScore, Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm")]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
