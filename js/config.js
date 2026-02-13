// config.js — Version, configuration, global state, constants

const UI_VERSION = 'V5.5-260211-1200';
console.log('🔧 CHIMERA UI Version:', UI_VERSION);

const CONFIG = {
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxh-jfsyL6fQP_bjFqd6zRk1sFOYdd_C-A8Ojb5bM-ddax9F3rn9UN_nbuRZ5D34ucjzA/exec',
    gpsInterval: 10000,
    organizations: ['Baled It!', 'Help A Brother Out Foundation', 'West Montgomery Action Committee'],
    urls: { fieldTestMap: 'feb_3_fieldtest.html', demoGame: 'chimera-hunt.html' }
};

const PIN_REGEX = /^[a-zA-Z]{2}[0-9]{2}$/;

const RATING_DESCRIPTIONS = {
    0: 'Clean/Minimal', 1: 'Clean/Minimal', 2: 'Clean/Minimal',
    3: 'Light litter', 4: 'Light litter',
    5: 'Moderate litter', 6: 'Moderate litter',
    7: 'Heavy litter', 8: 'Heavy litter',
    9: 'Severe litter', 10: 'Severe litter'
};

const ALL_SCREEN_IDS = [
    'loginScreen', 'mainScreen', 'scoutScreen', 'activeTrackingScreen',
    'postTrackingScreen', 'editProfileScreen', 'recycleScreen',
    'eventManagerScreen', 'proposeEventScreen', 'upcomingEventsScreen', 'eventDetailScreen',
    'adminScreen'
];

// ==================== GLOBAL STATE ====================

let currentUser = {
    userId: null, handle: null, organization: null,
    addresses: [], safetyLegalAccepted: false, lastSafetyLegalCheck: null
};

let sessionState = {
    sessionId: null, isTracking: false, startTime: null,
    gpsPoints: [], photos: [], totalDistance: 0, mode: null,
    durationTimer: null, gpsTimer: null, ratingTouched: false
};

let bags = [];
let bagCounter = 0;
let sunLocked = false;

// Hunt Integration (query parameter handshake)
let huntIntegration = {
    fromHunt: false,
    action: null  // 'scout' or 'collect'
};

// Event system
let currentEventData = null;
let currentSupplies = [];

// API call tracker (for feedback context)
let _lastApiCall = { action: null, result: null, timestamp: null };
