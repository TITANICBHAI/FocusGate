// Content script to hide YouTube recommendations and other elements based on keywords
let blockedKeywords = [];
let isSessionActive = false;
let isStandaloneMode = false;
let standaloneUntil = 0;

chrome.storage.local.get(['blockedKeywords', 'timer_isActive', 'standaloneMode', 'standaloneUntil'], (result) => {
  if (result.blockedKeywords) blockedKeywords = result.blockedKeywords.map(k => k.toLowerCase());
  if (result.timer_isActive) isSessionActive = result.timer_isActive;
  if (result.standaloneMode) isStandaloneMode = result.standaloneMode;
  if (result.standaloneUntil) standaloneUntil = result.standaloneUntil;
  
  if (isSessionActive || isStandaloneActive()) {
    observeDOM();
    processElements();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.blockedKeywords) {
      blockedKeywords = (changes.blockedKeywords.newValue || []).map(k => k.toLowerCase());
    }
    if (changes.timer_isActive !== undefined) {
      isSessionActive = changes.timer_isActive.newValue;
    }
    if (changes.standaloneMode !== undefined) {
      isStandaloneMode = changes.standaloneMode.newValue;
    }
    if (changes.standaloneUntil !== undefined) {
      standaloneUntil = changes.standaloneUntil.newValue || 0;
    }
    
    if (isSessionActive || isStandaloneActive()) {
      processElements();
      observeDOM();
    } else {
      // If neither session nor standalone is active, stop observing
      if (!isSessionActive && !isStandaloneActive()) {
        if (observer) observer.disconnect();
        observer = null;
      }
    }
  }
});

function isStandaloneActive() {
  return (isStandaloneMode && standaloneUntil === 0) || standaloneUntil > Date.now();
}

function hasBlockedKeyword(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  // Check against keywords and hashtags
  return blockedKeywords.some(keyword => lowerText.includes(keyword));
}

function processElements() {
  if (!isSessionActive && !isStandaloneActive()) return;

  // YouTube specific logic
  if (window.location.hostname.includes('youtube.com')) {
    // Video items on homepage, sidebar, and shorts
    // Block Shorts shelf completely
    const shortsShelf = document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer');
    shortsShelf.forEach(el => el.style.display = 'none');
    
    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-reel-item-renderer');
    videoElements.forEach(el => {
      // Don't re-process if we already hid it
      if (el.style.display === 'none') return;
      
      const titleEl = el.querySelector('#video-title, .ytd-reel-item-renderer');
      if (titleEl && hasBlockedKeyword(titleEl.textContent)) {
        el.style.display = 'none';
      }
    });
  }

  // Google Search specific logic
  if (window.location.hostname.includes('google.com')) {
    const searchResults = document.querySelectorAll('.g');
    searchResults.forEach(el => {
      if (el.style.display === 'none') return;
      
      const titleEl = el.querySelector('h3');
      if (titleEl && hasBlockedKeyword(titleEl.textContent)) {
        el.style.display = 'none';
      }
    });
  }

  // Reddit specific logic
  if (window.location.hostname.includes('reddit.com')) {
    const redditPosts = document.querySelectorAll('shreddit-post, .Post');
    redditPosts.forEach(el => {
      if (el.style.display === 'none') return;
      const titleEl = el.querySelector('h1, h2, h3, [slot="title"]');
      if (titleEl && hasBlockedKeyword(titleEl.textContent)) {
        el.style.display = 'none';
      }
    });
  }

  // Twitter/X specific logic
  if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    tweets.forEach(el => {
      if (el.style.display === 'none') return;
      const textEl = el.querySelector('[data-testid="tweetText"]');
      if (textEl && hasBlockedKeyword(textEl.textContent)) {
        const tweetContainer = el.closest('[data-testid="cellInnerDiv"]');
        if (tweetContainer) tweetContainer.style.display = 'none';
      }
    });
  }

  // Instagram specific logic
  if (window.location.hostname.includes('instagram.com')) {
    // Hide Reels tabs and links
    const reelsLinks = document.querySelectorAll('a[href^="/reels/"], a[href*="/reels/"]');
    reelsLinks.forEach(el => el.style.display = 'none');
    
  const posts = document.querySelectorAll('article');
    posts.forEach(el => {
      if (el.style.display === 'none') return;
      // Very basic text check for Instagram (captions)
      const textEls = el.querySelectorAll('span[dir="auto"]');
      let shouldBlock = false;
      textEls.forEach(textEl => {
        if (hasBlockedKeyword(textEl.textContent)) shouldBlock = true;
      });
      if (shouldBlock) {
        el.style.display = 'none';
      }
    });
  }

  
  // TikTok specific logic
  if (window.location.hostname.includes('tiktok.com')) {
    // Hide For You feed
    const forYouFeed = document.querySelectorAll('[data-e2e="recommend-list-item-container"], [data-e2e="explore-item"]');
    forYouFeed.forEach(el => el.style.display = 'none');
  }

  // LinkedIn specific logic
  if (window.location.hostname.includes('linkedin.com')) {
    const posts = document.querySelectorAll('.feed-shared-update-v2');
    posts.forEach(el => {
      if (el.style.display === 'none') return;
      const textEl = el.querySelector('.feed-shared-update-v2__commentary, .feed-shared-inline-show-more-text');
      if (textEl && hasBlockedKeyword(textEl.textContent)) {
        el.style.display = 'none';
      }
    });
  }
}

let observer = null;
let debounceTimer = null;

function observeDOM() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    // Debounce processing to save CPU on heavy DOM mutations (like infinite scroll)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processElements();
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Initial run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isSessionActive || isStandaloneActive()) processElements();
  });
} else {
  if (isSessionActive || isStandaloneActive()) processElements();
}
