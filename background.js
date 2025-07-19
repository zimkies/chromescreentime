const dailyLimitMinutes = 60; 

console.log("Loading background script...");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeSpent: 0, lastTrackedDate: getTodayString() });
});


// Plan/Notes:
// Whenever a tab is activated, add a new listener for constantly checking
// Tab is activated whenever it is newly opened or switched to.  
chrome.tabs.onActivated.addListener(onTabActivated);

// For when the Window changes focus
chrome.windows.onFocusChanged.addListener(onFocusChanged);

// Add this to track when a new YouTube tab is opened or updated
chrome.tabs.onUpdated.addListener(onTabUpdated);

function onFocusChanged() {
  console.log("Window Focus Changed");
  checkforYoutube()
}


function onTabUpdated(tabId, changeInfo, tab) {
  console.log("Tab Updated")
  if (
    changeInfo.status === "complete" &&
    tab.active &&
    tab.url &&
    tab.url.includes("youtube.com")
  ) {
    checkforYoutube();
  }
}


function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // e.g., "2025-07-18"
}

function checkforYoutube() {
  console.log("Checking YouTube tab...");
  getCurrentTab().then(currentTab =>  {
    console.log("Current Tab: ", currentTab); 
    if (currentTab && currentTab.url && currentTab.url.includes("youtube.com")) {
      trackTime();
    }
  });
}

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        resolve(null);
      } else {
        resolve(tabs[0]);
      }
    });
  });
}


// If the current tab is Youtube, track and update the time
function onTabActivated(tab) {
  console.log("Tab Activated")
  checkforYoutube()
}

let interval; 
function trackTime() {
  if (interval) { return; }

  console.log("tracking time");
  const trackTimeIntervalLengthSeconds = 1; 
  const trackTimeIntervalLengthMS = 1000 * trackTimeIntervalLengthSeconds;
  interval = setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs.length || !tabs[0].url.includes("youtube.com")) {
        clearInterval(interval);
        interval = null;
        return;
      }

      chrome.storage.local.get(["timeSpent", "lastTrackedDate"], data => {
        const todayStr = getTodayString();
        let timeSpent = data.timeSpent || 0;
        let lastTrackedDate = data.lastTrackedDate || todayStr;

        // Reset if new day
        if (lastTrackedDate !== todayStr) {
          timeSpent = 0;
          lastTrackedDate = todayStr;
        }

        const newTime = timeSpent + trackTimeIntervalLengthSeconds;
        chrome.storage.local.set({ timeSpent: newTime, lastTrackedDate });
        console.log({timeSpent: newTime, lastTrackedDate}); 

        if (newTime >= dailyLimitMinutes * 60) {
          // Redirect YouTube tabs
          chrome.tabs.query({}, tabs => {
            for (let tab of tabs) {
              if (tab.url.includes("youtube.com")) {
                chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("block.html") });
              }
            }
          });
          clearInterval(interval);
          interval = null;
        }
      });
    });
  }, trackTimeIntervalLengthMS);
}