// utils.js — Utility and formatting functions

function togglePIN(inputId, toggleElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; toggleElement.textContent = '🙈'; }
    else { input.type = 'password'; toggleElement.textContent = '👁️'; }
}

function hideAllScreens() {
    ALL_SCREEN_IDS.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTimeShort(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${m}/${d} ${h}:${min}`;
}

function formatTimeVague(date) {
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);
    if (diffHours < 24) return 'earlier today';
    if (diffHours < 48) return 'yesterday';
    return 'this week';
}

function formatRelativeTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const h = date.getHours();
    const min = date.getMinutes().toString().padStart(2, '0');
    const hour12 = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const timeStr = `${hour12}:${min} ${ampm}`;

    if (dateDay.getTime() === today.getTime()) {
        if (h < 12) return `Since ${timeStr} this morning`;
        if (h < 17) return `Since ${timeStr} this afternoon`;
        return `Since ${timeStr} this evening`;
    } else if (dateDay.getTime() === yesterday.getTime()) {
        return `Since ${timeStr} yesterday`;
    } else {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        return `Since ${m}/${d} ${timeStr}`;
    }
}

function formatTime12Hour(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${suffix}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHrs < 24) return diffHrs + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return then.toLocaleDateString();
}

function trackApiCall(action, result) {
    _lastApiCall = {
        action: action,
        result: typeof result === 'string' ? result : (result?.status || 'unknown'),
        timestamp: new Date().toISOString()
    };
}
