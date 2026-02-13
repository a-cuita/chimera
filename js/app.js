// app.js — App entry, main screen, sun check, site pause, initialization

// ==================== SUN CHECK ====================

async function checkSunSchedule() {
    if (currentUser && currentUser.overrides && currentUser.overrides.includes('sun_override')) {
        sunLocked = false;
        return;
    }

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=sun_check');
        const result = await response.json();

        if (result.status === 'success') {
            sunLocked = result.locked;
            if (sunLocked) {
                document.getElementById('menuLockoutBanner').classList.add('show');
                document.getElementById('menuLockoutSunrise').textContent = result.tomorrowSunrise || '--:--';
                document.getElementById('menuScout').classList.add('disabled');
                document.getElementById('menuTrack').classList.add('disabled');
            }
        }
    } catch (error) { console.error('Sun check error:', error); }
}

// ==================== SITE PAUSE ====================

async function checkSitePause() {
    if (currentUser && currentUser.overrides && currentUser.overrides.includes('site_pause_bypass')) {
        return false;
    }

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_site_status');
        const result = await response.json();

        if (result.status === 'success' && result.site_status === 'paused') {
            document.getElementById('sitePauseMessage').textContent = result.message || "We'll be back soon.";
            document.getElementById('sitePauseOverlay').classList.add('show');
            return true;
        }
    } catch (error) { console.error('Site status check error:', error); }
    return false;
}

// ==================== NOTIFICATION BADGE ====================

async function checkNotifications() {
    let count = 0;

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_upcoming_events');
        const result = await response.json();
        if (result.status === 'success' && result.events) {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            count += result.events.filter(e => {
                const eventDate = new Date(e.eventDate);
                return eventDate >= now && eventDate <= tomorrow;
            }).length;
        }
    } catch (e) { /* ignore */ }

    updateNotificationBadge(count);
}

// ==================== APP ENTRY ====================

function enterApp() {
    const needsCheck = !currentUser.safetyLegalAccepted || !currentUser.lastSafetyLegalCheck ||
                       (new Date() - new Date(currentUser.lastSafetyLegalCheck)) > 7 * 24 * 60 * 60 * 1000;

    if (needsCheck) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('safetyLegalModal').classList.add('show');
    } else {
        showMainScreen();
    }
}

function showMainScreen() {
    hideAllScreens();
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('menuUsername').textContent = currentUser.handle;
    document.getElementById('hamburgerBtn').classList.remove('hidden');

    loadActivityFeed(true);
    loadUpcomingBanner();
    checkSunSchedule();
    checkCoordinatorStatus();
    checkNotifications();

    // Hunt Integration: Check query params and redirect if needed
    const urlParams = new URLSearchParams(window.location.search);
    const fromHunt = urlParams.get('from') === 'hunt';
    const action = urlParams.get('action');

    if (fromHunt) {
        huntIntegration.fromHunt = true;
        huntIntegration.action = action;

        // Clear query params from URL without reload
        window.history.replaceState({}, document.title, window.location.pathname);

        if (action === 'scout') { showScoutMode(); }
        else if (action === 'collect') { startCollection(); }
    }
}

// ==================== PAGE LOAD ====================

window.addEventListener('load', async function () {
    // Initialize all modules
    initUI();
    initAuth();
    initScout();
    initTracking();
    initProfile();
    initRecycling();
    initEvents();
    initFeedbackListeners();

    // Admin menu click handler
    document.getElementById('menuAdmin')?.addEventListener('click', showAdminScreen);

    // Pre-login feed
    loadActivityFeed(false);

    // Check site pause (before login)
    const isPaused = await checkSitePause();
    if (isPaused) return;

    if (restoreSession() && currentUser.userId) {
        const stillPaused = await checkSitePause();
        if (!stillPaused) {
            enterApp();
            initAdminTab();
        }
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
    }
});

// Auto-refresh feed every 60s
setInterval(() => {
    if (!document.getElementById('mainScreen').classList.contains('hidden')) {
        loadActivityFeed(true);
    }
}, 60000);
