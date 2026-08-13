// Background service worker for FocusGate

let blockedSites = [];
let blockedKeywords = [];
let isSessionActive = false;
let sessionMode = 'work';
let standaloneMode = false;
let standaloneUntil = 0;
let schedules = [];
let dailyAllowances = {};
let dailyUsage = {};
let usageDate = new Date().toLocaleDateString();
let whitelistedUrls = [];
let cooldownEnd = {};
let temptationLog = [];

// Initialize state from storage
chrome.storage.local.get([
  'blockedSites', 
  'blockedKeywords', 
  'timer_isActive',
  'timer_mode',
  'standaloneMode',
  'standaloneUntil',
  'schedules',
  'dailyAllowances',
  'dailyUsage',
  'usageDate',
  'sessionHistory',
  'whitelistedUrls',
  'cooldownEnd',
  'temptationLog'
], (result) => {
  if (result.blockedSites) blockedSites = result.blockedSites;
  if (result.blockedKeywords) blockedKeywords = result.blockedKeywords;
  if (result.timer_isActive) isSessionActive = result.timer_isActive;
  if (result.timer_mode) sessionMode = result.timer_mode;
  if (result.standaloneUntil) standaloneUntil = result.standaloneUntil;
  if (result.standaloneMode) standaloneMode = result.standaloneMode;
  if (result.schedules) schedules = result.schedules;
  if (result.dailyAllowances) dailyAllowances = result.dailyAllowances;
  if (result.whitelistedUrls) whitelistedUrls = result.whitelistedUrls;
  if (result.cooldownEnd) cooldownEnd = result.cooldownEnd;
  if (result.temptationLog) temptationLog = result.temptationLog;
  
  if (result.usageDate === usageDate && result.dailyUsage) {
    dailyUsage = result.dailyUsage;
  } else {
    dailyUsage = {};
    chrome.storage.local.set({ dailyUsage, usageDate });
  }
});

function logAttempt(urlStr) {
  try {
    const url = new URL(urlStr);
    const domain = url.hostname.replace(/^www\./i, '');
    temptationLog.push({ domain, timestamp: Date.now() });
    if (temptationLog.length > 100) temptationLog.shift();
    chrome.storage.local.set({ temptationLog });
  } catch(e) {}
}

// Handle installation for onboarding
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'index.html?onboarding=true' });
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-focus') {
    chrome.storage.local.get(['timer_isActive'], (result) => {
      const active = result.timer_isActive || false;
      chrome.storage.local.set({ timer_isActive: !active });
      
      // Log session start/stop via command
      if (active) {
        // Stopping session
        logSession(false);
      } else {
        // Starting session
        logSession(true, 25 * 60); // default 25 min if started via shortcut
      }
    });
  }
});

function logSession(isStarting, durationSec = 0) {
  chrome.storage.local.get(['sessionHistory', 'timer_timeLeft'], (res) => {
    let history = res.sessionHistory || [];
    if (!isStarting) {
      // Find last active session and mark completed/abandoned
      const lastSession = history.find(s => s.status === 'active');
      if (lastSession) {
        const now = Date.now();
        const elapsed = (now - lastSession.startTime) / 1000;
        const timeLeft = res.timer_timeLeft || 0;
        
        // Clock tamper detection: if elapsed is long enough but timeLeft is still large,
        // it means they skipped time instead of waiting out the timer.
        // We consider it tampered if elapsed >= duration but timeLeft is > 60.
        const isTampered = (elapsed >= (lastSession.duration - 60)) && (timeLeft > 60);
        
        lastSession.status = (!isTampered && elapsed >= (lastSession.duration - 60)) ? 'completed' : 'abandoned';
        if (isTampered) {
          lastSession.status = 'abandoned';
        }
        
        lastSession.elapsed = elapsed;
        chrome.storage.local.set({ sessionHistory: history });
      }
    } else {
      history.push({
        id: Date.now().toString(),
        startTime: Date.now(),
        duration: durationSec,
        status: 'active'
      });
      chrome.storage.local.set({ sessionHistory: history });
    }
  });
}

// Listen for updates to storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  let needsDnrUpdate = false;
  if (changes.blockedSites) { blockedSites = changes.blockedSites.newValue || []; needsDnrUpdate = true; }
  if (changes.blockedKeywords) { blockedKeywords = changes.blockedKeywords.newValue || []; needsDnrUpdate = true; }
  if (changes.timer_isActive !== undefined) { isSessionActive = changes.timer_isActive.newValue; needsDnrUpdate = true; }
  if (changes.timer_mode !== undefined) { sessionMode = changes.timer_mode.newValue; needsDnrUpdate = true; }
  if (changes.standaloneMode !== undefined) { standaloneMode = changes.standaloneMode.newValue; needsDnrUpdate = true; }
  if (changes.standaloneUntil !== undefined) {
    standaloneUntil = changes.standaloneUntil.newValue || 0;
    if (standaloneUntil > Date.now()) {
      chrome.alarms.create('standalone_expire', { when: standaloneUntil });
    }
    needsDnrUpdate = true;
  }
  if (changes.schedules) { schedules = changes.schedules.newValue || []; needsDnrUpdate = true; }
  if (changes.dailyAllowances) { dailyAllowances = changes.dailyAllowances.newValue || {}; needsDnrUpdate = true; }
  if (changes.whitelistedUrls) { whitelistedUrls = changes.whitelistedUrls.newValue || []; needsDnrUpdate = true; }
  if (changes.cooldownEnd) { cooldownEnd = changes.cooldownEnd.newValue || {}; needsDnrUpdate = true; }
  
  if (needsDnrUpdate) {
    updateDNRRules();
  }
});

async function updateDNRRules() {
  if (!chrome.declarativeNetRequest) return; // Feature detection
  
  const rules = [];
  let ruleId = 1;

  // Add allow rules for whitelisted URLs (highest priority)
  for (const wUrl of whitelistedUrls) {
    rules.push({
      id: ruleId++,
      priority: 2, // Higher priority than block rules
      action: { type: 'allow' },
      condition: {
        urlFilter: `|${wUrl}*`,
        resourceTypes: ['main_frame']
      }
    });
  }
  
  // Only add blocking rules if session or standalone mode is active, or a schedule is active
  const isAnyScheduleActive = schedules.some(s => {
    if (!s.isActive) return false;
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday
    if (!s.days.includes(day)) return false;
    
    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);
    const currentM = now.getHours() * 60 + now.getMinutes();
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    return currentM >= startTotal && currentM <= endTotal;
  });

  const isStandaloneActive = (standaloneMode && standaloneUntil === 0) || (standaloneUntil > Date.now());
  const shouldBlock = (isSessionActive && sessionMode !== 'break') || isStandaloneActive || isAnyScheduleActive;

  if (shouldBlock) {
    for (const site of blockedSites) {
      // Exclude sites that have available daily allowance
      if (dailyAllowances[site]) {
        const config = dailyAllowances[site];
        let hasAllowance = false;
        if (typeof config === 'number' || config.type === 'time') {
          const limit = typeof config === 'number' ? config : config.limit;
          if ((dailyUsage[site] || 0) < limit) hasAllowance = true;
        } else if (config.type === 'interval') {
          if (!cooldownEnd[site] || cooldownEnd[site] <= Date.now()) hasAllowance = true;
        }
        if (hasAllowance) continue;
      }
      
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { extensionPath: '/index.html' }
        },
        condition: {
          urlFilter: `||${site}`,
          resourceTypes: ['main_frame']
        }
      });
    }
  }

  // Also block sites that have exhausted their daily allowance, even if not in blockedSites
  for (const [site, config] of Object.entries(dailyAllowances)) {
    let shouldBlockSite = false;
    if (typeof config === 'number' || config.type === 'time') {
      const limit = typeof config === 'number' ? config : config.limit;
      const used = dailyUsage[site] || 0;
      if (used >= limit) shouldBlockSite = true;
    } else if (config.type === 'interval') {
      if (cooldownEnd[site] && cooldownEnd[site] > Date.now()) {
        shouldBlockSite = true;
      }
    }
    
    if (shouldBlockSite) {
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { extensionPath: '/index.html' }
        },
        condition: {
          urlFilter: `||${site}`,
          resourceTypes: ['main_frame']
        }
      });
    }
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(r => r.id);
  
    await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: rules
  });

  // Audit open tabs and redirect if now blocked
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url) continue;
      if (isUrlBlocked(tab.url)) {
        logAttempt(tab.url);
      const blockUrl = chrome.runtime.getURL("index.html") + "?blocked=true&url=" + encodeURIComponent(tab.url);
        chrome.tabs.update(tab.id, { url: blockUrl });
      }
    }
  });
}

// Call initially
setTimeout(updateDNRRules, 1000);

// Helper to check if URL is blocked
function isUrlBlocked(urlStr) {
  try {
    // 0. Whitelist override
    if (whitelistedUrls.some(wUrl => urlStr.startsWith(wUrl))) {
      return false;
    }

    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    
    const domain = url.hostname.replace(/^www\./i, '');
    
    const searchParams = [url.searchParams.get('q'), url.searchParams.get('search_query'), url.searchParams.get('p')].filter(Boolean);
    const searchString = searchParams.join(' ').toLowerCase();

    // 1. Session or Standalone block
    if ((isSessionActive && sessionMode !== 'break') || (standaloneMode && standaloneUntil === 0) || (standaloneUntil > Date.now())) {
      if (blockedSites.some(site => {
        const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
        return domain === cleanSite || domain.endsWith('.' + cleanSite);
      })) {
        return true;
      }

      if (searchString && blockedKeywords.some(keyword => searchString.includes(keyword.toLowerCase()))) {
        return true; 
      }
    }

    // 2. Schedules
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const schedule of schedules) {
      if (schedule.isActive && schedule.days.includes(currentDay)) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        
        let inTimeWindow = false;
        if (startTotal <= endTotal) {
          inTimeWindow = currentTime >= startTotal && currentTime <= endTotal;
        } else {
          // Crosses midnight
          inTimeWindow = currentTime >= startTotal || currentTime <= endTotal;
        }

        if (inTimeWindow) {
          if (schedule.sites && schedule.sites.some(site => {
            const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
            return domain === cleanSite || domain.endsWith('.' + cleanSite);
          })) {
            return true;
          }
          if (searchString && schedule.keywords && schedule.keywords.some(keyword => searchString.includes(keyword.toLowerCase()))) {
            return true;
          }
        }
      }
    }

    // 3. Daily Allowances
    for (const [site, config] of Object.entries(dailyAllowances)) {
      const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (domain === cleanSite || domain.endsWith('.' + cleanSite)) {
        if (typeof config === 'number' || config.type === 'time') {
          const limit = typeof config === 'number' ? config : config.limit;
          const used = dailyUsage[site] || 0;
          if (used >= limit) return true;
        } else if (config.type === 'interval') {
          if (cooldownEnd[site] && cooldownEnd[site] > Date.now()) return true;
        }
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

// Check tabs as they load using webNavigation for SPA support
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    if (isUrlBlocked(details.url)) {
      logAttempt(details.url);
      const blockUrl = chrome.runtime.getURL("index.html") + "?blocked=true&url=" + encodeURIComponent(details.url);
      chrome.tabs.update(details.tabId, { url: blockUrl });
    } else {
      try {
         const url = new URL(details.url);
         const domain = url.hostname.replace(/^www\./i, '').toLowerCase();
         let updatedCooldown = false;
         for (const [site, config] of Object.entries(dailyAllowances)) {
            if (config && config.type === 'interval') {
               const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
               if (domain === cleanSite || domain.endsWith('.' + cleanSite)) {
                  cooldownEnd[site] = Date.now() + config.limit * 60 * 1000;
                  updatedCooldown = true;
               }
            }
         }
         if (updatedCooldown) {
            chrome.storage.local.set({ cooldownEnd });
            updateDNRRules();
         }
       } catch(e) {}
    }
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0 && isUrlBlocked(details.url)) {
    logAttempt(details.url);
      const blockUrl = chrome.runtime.getURL("index.html") + "?blocked=true&url=" + encodeURIComponent(details.url);
    chrome.tabs.update(details.tabId, { url: blockUrl });
  }
});

// Daily Allowance Tracker
chrome.alarms.create("allowanceTracker", { periodInMinutes: 1 });
chrome.alarms.create("weeklyDigest", { periodInMinutes: 7 * 24 * 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'weeklyDigest') {
    chrome.storage.local.get(['sessionHistory', 'temptationLog'], (res) => {
      const history = res.sessionHistory || [];
      const blocks = res.temptationLog || [];
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      const weeklySessions = history.filter(s => s.startTime >= oneWeekAgo);
      const completed = weeklySessions.filter(s => s.status === 'completed').length;
      const weeklyBlocks = blocks.filter(log => log.timestamp >= oneWeekAgo).length;
      
      const focusTime = Math.floor(weeklySessions.filter(s => s.status === 'completed').reduce((acc, curr) => acc + curr.duration, 0) / 3600);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'FocusGate Weekly Digest',
        message: `You completed ${completed} sessions (${focusTime} hours) and blocked ${weeklyBlocks} distractions this week.`
      });
    });
  }

  if (alarm.name === 'standalone_expire') {
    chrome.storage.local.set({ standaloneUntil: 0, standaloneMode: false });
  }
  if (alarm.name === "allowanceTracker") {
    const today = new Date().toLocaleDateString();
    if (usageDate !== today) {
      usageDate = today;
      dailyUsage = {};
      chrome.storage.local.set({ usageDate, dailyUsage });
    }

    
    if (Object.keys(dailyAllowances).length === 0) return;

    chrome.tabs.query({}, (tabs) => {
      let updatedTime = false;
      let updatedCooldown = false;
      
      const openDomains = new Set();
      for (const tab of tabs) {
        if (!tab.url) continue;
        try {
           const url = new URL(tab.url);
           openDomains.add(url.hostname.replace(/^www\./i, '').toLowerCase());
        } catch(e) {}
      }

      for (const [site, config] of Object.entries(dailyAllowances)) {
        const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
        let isOpen = false;
        let isActive = false;
        
        for (const tab of tabs) {
          if (!tab.url) continue;
          try {
            const url = new URL(tab.url);
            const domain = url.hostname.replace(/^www\./i, '').toLowerCase();
            if (domain === cleanSite || domain.endsWith('.' + cleanSite)) {
               isOpen = true;
               if (tab.active) isActive = true;
            }
          } catch(e) {}
        }
        
        if (typeof config === 'number' || config.type === 'time') {
          if (isActive) {
            dailyUsage[site] = (dailyUsage[site] || 0) + 1;
            updatedTime = true;
            
            const limit = typeof config === 'number' ? config : config.limit;
            if (dailyUsage[site] >= limit) {
               // Redirect tabs that are on this site
               for (const tab of tabs) {
                 if (!tab.url) continue;
                 try {
                   const url = new URL(tab.url);
                   const domain = url.hostname.replace(/^www\./i, '').toLowerCase();
                   if (domain === cleanSite || domain.endsWith('.' + cleanSite)) {
                     logAttempt(tab.url);
      const blockUrl = chrome.runtime.getURL("index.html") + "?blocked=true&url=" + encodeURIComponent(tab.url);
                     chrome.tabs.update(tab.id, { url: blockUrl });
                   }
                 } catch(e) {}
               }
            }
          }
        } else if (config.type === 'interval') {
          if (isOpen) {
            cooldownEnd[site] = Date.now() + config.limit * 60 * 1000;
            updatedCooldown = true;
          } else {
             if (cooldownEnd[site] && cooldownEnd[site] <= Date.now()) {
                // Cooldown passed, we don't need to do anything, updateDNRRules will remove block
             }
          }
        }
      }

      if (updatedTime) {
        chrome.storage.local.set({ dailyUsage });
      }
      if (updatedCooldown) {
        chrome.storage.local.set({ cooldownEnd });
      }
      if (updatedTime || updatedCooldown) {
        updateDNRRules();
      }
    });

  }
});

// Keep tabs.onUpdated as a fallback
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (isUrlBlocked(changeInfo.url)) {
      logAttempt(changeInfo.url);
      const blockUrl = chrome.runtime.getURL("index.html") + "?blocked=true&url=" + encodeURIComponent(changeInfo.url);
      chrome.tabs.update(tabId, { url: blockUrl });
    }
  }
});
