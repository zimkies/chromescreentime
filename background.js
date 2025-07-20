/*
Overall Strategy:

Whenever we switch windows or tabs or update a tab url, 
check if the currently opened tab is a YouTube tab.

If it is, set up an interval call that checks every second if the tab is still active and a YouTube tab.
If it is, increment the time spent on YouTube for that day.
If the time spent exceeds a daily limit, redirect the tab to a block page. 
*/
const dailyLimitMinutes = 60;

console.log("Loading background script...");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeSpent: 0, lastTrackedDate: getTodayString() });
});

// For when the Tab is activated
chrome.tabs.onActivated.addListener(onTabActivated);

// For when the Window changes focus
chrome.windows.onFocusChanged.addListener(onFocusChanged);

// Add this to track when a new YouTube tab is opened or updated
chrome.tabs.onUpdated.addListener(onTabUpdated);

// If the current tab is Youtube, track and update the time
function onTabActivated() {
  console.log("Tab Activated");
  checkforYoutube();
}

function onTabUpdated(tabId, changeInfo, tab) {
  console.log("Tab Updated");
  if (
    changeInfo.status === "complete" &&
    tab.active &&
    tab.url &&
    tab.url.includes("youtube.com")
  ) {
    checkforYoutube();
  }
}

function onFocusChanged() {
  console.log("Window Focus Changed");
  checkforYoutube();
}

function getTodayString() {
  const today = new Date();
  return today.toISOString().split("T")[0]; // e.g., "2025-07-18"
}

function checkforYoutube() {
  console.log("Checking YouTube tab...");
  getCurrentTab().then((currentTab) => {
    console.log("Current Tab: ", currentTab);
    if (
      currentTab &&
      currentTab.url &&
      currentTab.url.includes("youtube.com")
    ) {
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

let interval;
const trackTimeIntervalLengthSeconds = 1;
const trackTimeIntervalLengthMS = 1000 * trackTimeIntervalLengthSeconds;

function trackTime() {
  if (interval) {
    return;
  }

  console.log("tracking time");
  interval = setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (
        !tabs.length ||
        !tabs[0].url ||
        !tabs[0].url.includes("youtube.com")
      ) {
        console.log("No active Youtube tab, clearing interval")
        clearInterval(interval);
        interval = null;
        return;
      }

      chrome.storage.local.get(["timeSpent", "lastTrackedDate"], (data) => {
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
        console.log({ timeSpent: newTime, lastTrackedDate });

        if (newTime >= dailyLimitMinutes * 60) {
          // Redirect YouTube tabs
          chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
              if (tab.url.includes("youtube.com")) {
                chrome.tabs.update(tab.id, {
                  url: chrome.runtime.getURL("block.html"),
                });
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
