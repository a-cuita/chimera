// admin.js — Feedback system + Admin dashboard

// ==================== FEEDBACK SYSTEM ====================

let selectedFeedbackType = 'bug';

function openFeedbackModal() {
    // Close hamburger menu first if open
    const overlay = document.getElementById('menuOverlay');
    const menu = document.getElementById('slideMenu');
    if (overlay) overlay.classList.remove('show');
    if (menu) menu.classList.remove('show');

    document.getElementById('feedbackOverlay').classList.add('show');
    document.getElementById('feedbackMessage').value = '';
    document.getElementById('feedbackSubmitBtn').disabled = true;
    selectedFeedbackType = 'bug';

    // Reset type buttons
    document.querySelectorAll('.feedback-type-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === 'bug');
    });

    updateFeedbackContextNote();
}

function closeFeedbackModal() {
    document.getElementById('feedbackOverlay').classList.remove('show');
}

function updateFeedbackContextNote() {
    const note = document.getElementById('feedbackContextNote');
    if (selectedFeedbackType === 'bug') {
        note.textContent = 'Bug reports automatically include your device info, current screen, and GPS state to help us diagnose the issue.';
        note.style.display = 'block';
    } else if (selectedFeedbackType === 'suggestion') {
        note.textContent = 'We read every suggestion. Thank you for helping improve CHIMERA!';
        note.style.display = 'block';
    } else {
        note.style.display = 'none';
    }
}

function gatherFeedbackContext() {
    let currentScreen = 'unknown';
    const screens = document.querySelectorAll('[id$="Screen"]');
    screens.forEach(s => {
        if (!s.classList.contains('hidden') && s.offsetParent !== null) {
            currentScreen = s.id;
        }
    });

    let gpsState = 'unknown';
    if (!navigator.geolocation) {
        gpsState = 'not_supported';
    } else if (typeof sessionState !== 'undefined' && sessionState.gpsPoints && sessionState.gpsPoints.length > 0) {
        gpsState = 'active_tracking (' + sessionState.gpsPoints.length + ' points)';
    } else {
        gpsState = 'available';
    }

    let sessState = 'none';
    if (typeof sessionState !== 'undefined') {
        if (sessionState.isTracking) {
            sessState = 'active_collection';
        } else if (sessionState.startTime) {
            sessState = 'post_collection';
        }
    }

    let appVersion = 'unknown';
    if (typeof UI_VERSION !== 'undefined') appVersion = UI_VERSION;

    return {
        currentScreen: currentScreen,
        deviceInfo: navigator.userAgent,
        screenSize: window.innerWidth + 'x' + window.innerHeight,
        gpsState: gpsState,
        sessionState: sessState,
        lastApiAction: _lastApiCall.action || 'none',
        lastApiResult: _lastApiCall.result || 'none',
        appVersion: appVersion
    };
}

async function submitFeedback() {
    const message = document.getElementById('feedbackMessage').value.trim();
    if (!message) return;

    const btn = document.getElementById('feedbackSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const context = gatherFeedbackContext();
    const token = sessionStorage.getItem('rh_token');

    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'submitFeedback',
                token: token,
                userId: currentUser?.userId || '',
                handle: currentUser?.handle || 'anonymous',
                feedbackType: selectedFeedbackType,
                message: message,
                ...context
            })
        });
        const result = await response.json();
        trackApiCall('submitFeedback', result);

        if (result.status === 'success') {
            showToast('Feedback sent! Thank you.', 'success');
            closeFeedbackModal();
        } else {
            showToast(result.message || 'Failed to send', 'error');
        }
    } catch (error) {
        console.error('Feedback submit error:', error);
        showToast('Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Send Feedback';
}

function initFeedbackListeners() {
    document.getElementById('menuFeedback')?.addEventListener('click', openFeedbackModal);
    document.getElementById('feedbackCloseBtn')?.addEventListener('click', closeFeedbackModal);
    document.getElementById('feedbackSubmitBtn')?.addEventListener('click', submitFeedback);

    document.getElementById('feedbackOverlay')?.addEventListener('click', function(e) {
        if (e.target === this) closeFeedbackModal();
    });

    document.querySelectorAll('.feedback-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.feedback-type-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedFeedbackType = this.dataset.type;
            updateFeedbackContextNote();
        });
    });

    document.getElementById('feedbackMessage')?.addEventListener('input', function() {
        document.getElementById('feedbackSubmitBtn').disabled = this.value.trim().length === 0;
    });
}


// ==================== ADMIN DASHBOARD ====================

let adminFeedbackData = [];
let adminCurrentFeedbackId = null;

function initAdminTab() {
    const role = sessionStorage.getItem('rh_role');
    const adminSection = document.getElementById('adminMenuSection');

    if (role === 'admin' && adminSection) {
        adminSection.style.display = 'block';
        loadAdminFeedbackCount();
    }
}

function showAdminScreen() {
    document.querySelectorAll('[id$="Screen"]').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminScreen').classList.remove('hidden');

    // Close menu
    document.getElementById('menuOverlay')?.classList.remove('show');
    document.getElementById('slideMenu')?.classList.remove('show');

    // Load all sections
    loadAdminStats();
    loadAdminFeedback('all');
    loadAdminSiteStatus();
    loadAdminBanners();
    loadAdminPendingEvents();
    loadAdminUserOverrides();
    loadAdminContentEditors();
}
// Show zone manager for coordinator+
    const role = sessionStorage.getItem('rh_role');
    const zoneSection = document.getElementById('zoneManagerSection');
    if (zoneSection) {
        zoneSection.style.display = (role === 'admin' || role === 'coordinator' || role === 'public_admin') ? 'block' : 'none';
    }
// Init zone map when section is visible
    if (role === 'admin' || role === 'coordinator' || role === 'public_admin') {
        setTimeout(initZoneManager, 500);
    }
function toggleAdminSection(headerEl) {
    headerEl.classList.toggle('collapsed');
    const body = headerEl.nextElementSibling;
    body.classList.toggle('collapsed');
}

// --- Stats ---
async function loadAdminStats() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_stats&token=' + token);
        const result = await response.json();
        trackApiCall('get_stats', result);

        if (result.status === 'success' && result.stats) {
            result.stats.forEach(stat => {
                if (stat.label === 'User Profiles') {
                    document.getElementById('adminStatUsers').textContent = stat.value;
                } else if (stat.label === 'Sessions') {
                    document.getElementById('adminStatSessions').textContent = stat.value;
                } else if (stat.label === 'Validation Results') {
                    document.getElementById('adminStatValidations').textContent = stat.value;
                }
            });
        }
    } catch (error) {
        console.error('Admin stats error:', error);
    }
}

// --- Feedback Inbox ---
async function loadAdminFeedbackCount() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_feedback&status=new&token=' + token);
        const result = await response.json();

        if (result.status === 'success') {
            const count = result.counts?.new || 0;
            const badge = document.getElementById('adminMenuBadge');
            const inboxBadge = document.getElementById('feedbackInboxBadge');

            if (count > 0) {
                if (badge) { badge.textContent = count; badge.style.display = 'inline-flex'; }
                if (inboxBadge) { inboxBadge.textContent = count; inboxBadge.style.display = 'inline-flex'; }
            } else {
                if (badge) badge.style.display = 'none';
                if (inboxBadge) inboxBadge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Feedback count error:', error);
    }
}

async function loadAdminFeedback(statusFilter) {
    document.getElementById('adminFeedbackDetail').style.display = 'none';
    document.getElementById('adminFeedbackList').style.display = 'block';

    const list = document.getElementById('adminFeedbackList');
    list.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:20px;">Loading...</div>';

    const token = sessionStorage.getItem('rh_token');
    const filterParam = statusFilter === 'all' ? '' : '&status=' + statusFilter;

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_feedback&token=' + token + filterParam);
        const result = await response.json();
        trackApiCall('get_feedback', result);

        if (result.status !== 'success') {
            list.innerHTML = '<div style="text-align:center; color:#dc2626; padding:20px;">Failed to load</div>';
            return;
        }

        adminFeedbackData = result.feedback || [];

        const newCount = result.counts?.new || 0;
        const badge = document.getElementById('feedbackInboxBadge');
        if (newCount > 0) {
            badge.textContent = newCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }

        if (adminFeedbackData.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:20px;">No feedback items</div>';
            return;
        }

        const typeLabels = { bug: 'Bug', suggestion: 'Idea', question: 'Question', general: 'General' };
        const typeColors = { bug: '#dc2626', suggestion: '#2563eb', question: '#d97706', general: '#6b7280' };

        list.innerHTML = adminFeedbackData.slice(0, 20).map(fb => {
            const typeLabel = typeLabels[fb.type] || fb.type;
            const typeColor = typeColors[fb.type] || '#6b7280';
            const timeAgo = getRelativeTime(fb.timestamp);
            const truncMsg = fb.message.length > 80 ? fb.message.substring(0, 80) + '...' : fb.message;

            return `<div class="feedback-item type-${fb.type} status-${fb.status}" onclick="showFeedbackDetail('${fb.feedbackId}')">
                <div class="feedback-item-header">
                    <span class="feedback-item-type" style="color:${typeColor};">${typeLabel}</span>
                    <span class="feedback-status-badge ${fb.status}">${fb.status.replace('_',' ')}</span>
                </div>
                <div class="feedback-item-message">${escapeHtml(truncMsg)}</div>
                <div class="feedback-item-user">${escapeHtml(fb.handle)} · ${timeAgo}</div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error('Feedback load error:', error);
        list.innerHTML = '<div style="text-align:center; color:#dc2626; padding:20px;">Error loading</div>';
    }
}

function showFeedbackDetail(feedbackId) {
    const fb = adminFeedbackData.find(f => f.feedbackId === feedbackId);
    if (!fb) return;

    adminCurrentFeedbackId = feedbackId;

    document.getElementById('adminFeedbackList').style.display = 'none';
    document.getElementById('adminFeedbackDetail').style.display = 'block';

    const typeLabels = { bug: 'Bug Report', suggestion: 'Suggestion', question: 'Question', general: 'General' };
    document.getElementById('fbDetailType').textContent = typeLabels[fb.type] || fb.type;
    document.getElementById('fbDetailMessage').textContent = fb.message;
    document.getElementById('fbDetailUser').textContent = fb.handle;
    document.getElementById('fbDetailTime').textContent = fb.timestamp ? new Date(fb.timestamp).toLocaleString() : '';
    document.getElementById('fbDetailNotes').value = fb.adminNotes || '';

    let ctx = '';
    if (fb.currentScreen) ctx += 'Screen: ' + fb.currentScreen + '\n';
    if (fb.deviceInfo) ctx += 'Device: ' + fb.deviceInfo.substring(0, 120) + '\n';
    if (fb.screenSize) ctx += 'Viewport: ' + fb.screenSize + '\n';
    if (fb.gpsState) ctx += 'GPS: ' + fb.gpsState + '\n';
    if (fb.sessionState && fb.sessionState !== 'none') ctx += 'Session: ' + fb.sessionState + '\n';
    if (fb.lastApiAction && fb.lastApiAction !== 'none') ctx += 'Last API: ' + fb.lastApiAction + ' → ' + fb.lastApiResult + '\n';
    if (fb.appVersion) ctx += 'Version: ' + fb.appVersion;

    document.getElementById('fbDetailContext').textContent = ctx || 'No context captured';
}

function closeFeedbackDetail() {
    document.getElementById('adminFeedbackDetail').style.display = 'none';
    document.getElementById('adminFeedbackList').style.display = 'block';
    adminCurrentFeedbackId = null;
}

async function updateFeedbackStatus(newStatus) {
    if (!adminCurrentFeedbackId) return;

    const token = sessionStorage.getItem('rh_token');
    const notes = document.getElementById('fbDetailNotes').value.trim();

    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateFeedback',
                token: token,
                feedbackId: adminCurrentFeedbackId,
                status: newStatus,
                adminNotes: notes,
                resolvedBy: currentUser?.handle || 'admin'
            })
        });
        const result = await response.json();
        trackApiCall('updateFeedback', result);

        if (result.status === 'success') {
            showToast('Feedback updated', 'success');
            closeFeedbackDetail();
            loadAdminFeedback('all');
            loadAdminFeedbackCount();
        } else {
            showToast(result.message || 'Update failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// --- Site Pause ---
async function loadAdminSiteStatus() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_site_status&token=' + token);
        const result = await response.json();
        trackApiCall('get_site_status', result);

        if (result.status === 'success') {
            const isPaused = result.site_status === 'paused';
            document.getElementById('adminSitePauseToggle').checked = isPaused;
            document.getElementById('adminSiteStatusDesc').textContent = isPaused ? 'PAUSED — users see maintenance message' : 'Active — site is live';
            document.getElementById('adminSiteStatusDesc').style.color = isPaused ? '#dc2626' : '#059669';
            document.getElementById('adminPauseMessage').value = result.message || '';
        }
    } catch (error) {
        console.error('Site status error:', error);
    }
}

async function toggleAdminSitePause() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'toggle_site_pause', token: token })
        });
        const result = await response.json();
        trackApiCall('toggle_site_pause', result);

        if (result.status === 'success') {
            const isPaused = result.site_status === 'paused';
            document.getElementById('adminSiteStatusDesc').textContent = isPaused ? 'PAUSED — users see maintenance message' : 'Active — site is live';
            document.getElementById('adminSiteStatusDesc').style.color = isPaused ? '#dc2626' : '#059669';
            showToast('Site ' + (isPaused ? 'paused' : 'resumed'), isPaused ? 'warning' : 'success');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

async function saveAdminPauseMessage() {
    const token = sessionStorage.getItem('rh_token');
    const message = document.getElementById('adminPauseMessage').value.trim();
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'set_pause_message', token: token, message: message })
        });
        const result = await response.json();
        trackApiCall('set_pause_message', result);
        showToast(result.status === 'success' ? 'Message saved' : 'Failed', result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// --- Banners ---
async function loadAdminBanners() {
    const token = sessionStorage.getItem('rh_token');
    const list = document.getElementById('adminBannersList');
    list.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:10px;">Loading...</div>';

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_all_banners&token=' + token);
        const result = await response.json();
        trackApiCall('get_all_banners', result);

        if (result.status !== 'success') {
            list.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Failed</div>';
            return;
        }

        const banners = result.banners || [];
        if (banners.length === 0) {
            list.innerHTML = '<div style="color:#9ca3af; text-align:center; font-size:13px; padding:10px;">No banners</div>';
            return;
        }

        const typeColors = { info: '#2563eb', success: '#059669', warning: '#d97706', event: '#7c3aed' };

        list.innerHTML = banners.map(b => {
            const color = typeColors[b.bannerType] || '#6b7280';
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f9fafb; border-radius:8px; margin-bottom:6px; border-left:3px solid ${color};">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(b.message)}</div>
                    <div style="font-size:11px; color:#9ca3af;">${b.bannerType} · ${b.active ? 'Active' : 'Inactive'}</div>
                </div>
                <label class="admin-toggle" style="margin-left:10px;">
                    <input type="checkbox" ${b.active ? 'checked' : ''} onchange="toggleBannerActive('${b.bannerId}', this.checked)">
                    <span class="admin-toggle-slider"></span>
                </label>
            </div>`;
        }).join('');

    } catch (error) {
        list.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Error</div>';
    }
}

async function toggleBannerActive(bannerId, active) {
    const token = sessionStorage.getItem('rh_token');
    try {
        await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'updateBanner', token: token, bannerId: bannerId, active: active })
        });
        showToast(active ? 'Banner activated' : 'Banner deactivated', 'success');
    } catch (error) {
        showToast('Error updating banner', 'error');
    }
}

async function createQuickBanner() {
    const message = document.getElementById('adminNewBannerMessage').value.trim();
    if (!message) { showToast('Enter a message', 'error'); return; }

    const bannerType = document.getElementById('adminNewBannerType').value;
    const token = sessionStorage.getItem('rh_token');

    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'createBanner',
                token: token,
                message: message,
                bannerType: bannerType,
                active: true,
                createdBy: currentUser?.handle || 'admin'
            })
        });
        const result = await response.json();
        trackApiCall('createBanner', result);

        if (result.status === 'success') {
            showToast('Banner posted!', 'success');
            document.getElementById('adminNewBannerMessage').value = '';
            loadAdminBanners();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// --- Pending Events ---
async function loadAdminPendingEvents() {
    const token = sessionStorage.getItem('rh_token');
    const list = document.getElementById('adminPendingEventsList');
    list.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:10px;">Loading...</div>';

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_pending_events&token=' + token);
        const result = await response.json();
        trackApiCall('get_pending_events', result);

        if (result.status !== 'success') {
            list.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Failed</div>';
            return;
        }

        const events = result.events || [];

        const badge = document.getElementById('pendingEventsBadge');
        if (events.length > 0) {
            badge.textContent = events.length;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }

        if (events.length === 0) {
            list.innerHTML = '<div style="color:#9ca3af; text-align:center; font-size:13px; padding:10px;">No pending events</div>';
            return;
        }

        list.innerHTML = events.map(ev => {
            const dateStr = ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : 'No date';
            const publicToggle = ev.requestPublic
                ? `<div style="margin:8px 0; padding:8px; background:#eff6ff; border-radius:6px; font-size:12px;">
                     <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#1e40af;">
                       <input type="checkbox" id="approvePublic_${ev.eventId}" checked>
                       🌐 Coordinator requested public visibility — approve?
                     </label>
                   </div>`
                : '';
            return `<div class="admin-event-card">
                <div class="admin-event-title">${escapeHtml(ev.title)}</div>
                <div class="admin-event-meta">
                    ${escapeHtml(ev.coordinatorName)} · ${dateStr} · ${ev.locationName || 'No location'}
                </div>
                ${ev.description ? '<div style="font-size:12px; color:#6b7280; margin-top:6px;">' + escapeHtml(ev.description.substring(0, 120)) + '</div>' : ''}
                ${publicToggle}
                <div class="admin-event-actions">
                    <button class="admin-action-btn primary" onclick="reviewEvent('${ev.eventId}', 'approved')">Approve</button>
                    <button class="admin-action-btn danger" onclick="reviewEvent('${ev.eventId}', 'rejected')">Reject</button>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        list.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Error</div>';
    }
}

async function reviewEvent(eventId, decision) {
    const action = decision === 'approved' ? 'Approve' : 'Reject';
    if (!confirm(action + ' this event?')) return;

    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'reviewEvent',
                token: token,
                eventId: eventId,
                decision: decision,
                reviewedBy: currentUser?.handle || 'admin',
                approvePublic: document.getElementById('approvePublic_' + eventId)?.checked || false
            })
        });
        const result = await response.json();
        trackApiCall('reviewEvent', result);

        if (result.status === 'success') {
            showToast('Event ' + decision, 'success');
            loadAdminPendingEvents();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// --- Operations ---
async function runAdminValidation() {
    const btn = document.getElementById('adminRunValidationBtn');
    btn.disabled = true;
    btn.textContent = 'Running...';

    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'run_validation', token: token })
        });
        const result = await response.json();
        trackApiCall('run_validation', result);
        showToast(result.status === 'success' ? 'Validation complete!' : 'Failed: ' + result.message, result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Run';
}

async function runAdminEvaluateRules() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'evaluateRules', token: token })
        });
        const result = await response.json();
        trackApiCall('evaluateRules', result);
        showToast(result.status === 'success' ? 'Rules evaluated!' : 'Failed', result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// ==================== USER OVERRIDES MANAGEMENT ====================

const AVAILABLE_OVERRIDES = [
  { id: 'sun_override', label: 'Sun Override', desc: 'Bypass sunrise/sunset restrictions' },
  { id: 'site_pause_bypass', label: 'Site Pause Bypass', desc: 'Access site during maintenance pause' },
  { id: 'event_coordinator', label: 'Event Coordinator', desc: 'Can propose and manage events' }
];

let adminUserList = [];

async function loadAdminUserOverrides() {
    const token = sessionStorage.getItem('rh_token');
    const container = document.getElementById('adminOverridesList');
    container.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:10px;">Loading...</div>';

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_user_list&token=' + token);
        const result = await response.json();
        trackApiCall('get_user_list', result);

        if (result.status !== 'success') {
            container.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Failed to load</div>';
            return;
        }

        adminUserList = result.users || [];

        if (adminUserList.length === 0) {
            container.innerHTML = '<div style="color:#9ca3af; text-align:center; font-size:13px; padding:10px;">No users</div>';
            return;
        }

        container.innerHTML = adminUserList.map(user => {
            const overrideTags = user.overrides.length > 0
                ? user.overrides.map(o => {
                    const meta = AVAILABLE_OVERRIDES.find(a => a.id === o);
                    const label = meta ? meta.label : o;
                    return `<span style="display:inline-flex; align-items:center; gap:4px; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-size:11px; margin:2px;">
                        ${escapeHtml(label)}
                        <span onclick="removeUserOverride('${user.userId}', '${o}')" style="cursor:pointer; color:#dc2626; font-weight:bold; margin-left:2px;">&times;</span>
                    </span>`;
                }).join('')
                : '<span style="font-size:11px; color:#9ca3af;">None</span>';

            const roleColor = user.role === 'admin' ? '#7c3aed' : user.role === 'coordinator' ? '#2563eb' : '#6b7280';

            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f9fafb; border-radius:8px; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                <div style="min-width:0; flex:1;">
                    <div style="font-size:13px; font-weight:600; color:#374151;">
                        ${escapeHtml(user.handle)}
                        <span style="font-size:10px; color:${roleColor}; font-weight:400; margin-left:4px;">${user.role}</span>
                    </div>
                    <div style="margin-top:4px;">${overrideTags}</div>
                </div>
                <button onclick="showAddOverrideMenu('${user.userId}')" style="padding:4px 10px; background:#2D5F3F; color:white; border:none; border-radius:6px; font-size:11px; cursor:pointer; white-space:nowrap;">+ Add</button>
            </div>`;
        }).join('');

    } catch (error) {
        console.error('User overrides error:', error);
        container.innerHTML = '<div style="color:#dc2626; text-align:center; padding:10px;">Error loading</div>';
    }
}

function showAddOverrideMenu(userId) {
    const user = adminUserList.find(u => u.userId === userId);
    if (!user) return;

    const available = AVAILABLE_OVERRIDES.filter(o => !user.overrides.includes(o.id));

    if (available.length === 0) {
        showToast('All overrides already assigned', 'warning');
        return;
    }

    const options = available.map(o => `${o.label} (${o.id})`).join('\n');
    const choice = prompt('Add override for ' + user.handle + ':\n\nAvailable:\n' + options + '\n\nType override ID:');

    if (!choice) return;
    const trimmed = choice.trim();
    const valid = AVAILABLE_OVERRIDES.find(o => o.id === trimmed);

    if (!valid) {
        showToast('Invalid override ID', 'error');
        return;
    }

    if (user.overrides.includes(trimmed)) {
        showToast('Already assigned', 'warning');
        return;
    }

    const updated = [...user.overrides, trimmed];
    saveUserOverrides(userId, updated);
}

async function removeUserOverride(userId, overrideId) {
    const user = adminUserList.find(u => u.userId === userId);
    if (!user) return;

    if (!confirm('Remove "' + overrideId + '" from ' + user.handle + '?')) return;

    const updated = user.overrides.filter(o => o !== overrideId);
    saveUserOverrides(userId, updated);
}

async function saveUserOverrides(userId, overrides) {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'setUserOverrides',
                token: token,
                userId: userId,
                overrides: overrides
            })
        });
        const result = await response.json();
        trackApiCall('setUserOverrides', result);

        if (result.status === 'success') {
            showToast('Overrides updated', 'success');
            loadAdminUserOverrides();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}
// ==================== CONTENT EDITORS ====================

let adminContentCache = {};

async function loadAdminContentEditors() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_content&token=' + token);
        const result = await response.json();
        trackApiCall('get_content', result);

        if (result.status === 'success') {
            adminContentCache = result.content || {};
            populateContentEditor('getting_started', 'adminContentGettingStarted');
            populateContentEditor('safety_legal', 'adminContentSafetyLegal');

            // Build dynamic wiki editors
            var container = document.getElementById('dynamicWikiEditors');
            if (container) {
                container.innerHTML = '';
                Object.keys(adminContentCache).forEach(function(key) {
                    if (!key.startsWith('wiki_')) return;
                    var topic = key.replace('wiki_', '');
                    var capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
                    var data = adminContentCache[key];

                    var div = document.createElement('div');
                    div.style.cssText = 'margin-bottom:12px; padding:10px; background:#f9fafb; border-radius:8px;';
                    div.innerHTML =
                        '<input id="adminTitleWiki' + capTopic + '" value="' + escapeHtml(data.title || '') + '" placeholder="Title" style="width:100%; padding:4px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12px; margin-bottom:4px;">' +
                        '<input id="adminSubtitleWiki' + capTopic + '" value="' + escapeHtml(data.subtitle || '') + '" placeholder="Subtitle" style="width:100%; padding:4px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12px; margin-bottom:4px;">' +
                        '<textarea id="adminContentWiki' + capTopic + '" rows="5" style="width:100%; border:1px solid #d1d5db; border-radius:6px; padding:8px; font-size:12px; font-family:monospace; resize:vertical;" placeholder="Topic content (HTML)">' + escapeHtml(data.html || '') + '</textarea>' +
                        '<button onclick="saveWikiContent(\'' + key + '\')" style="margin-top:4px; padding:4px 12px; background:#2D5F3F; color:white; border:none; border-radius:6px; font-size:12px; cursor:pointer;">Save</button>';
                    container.appendChild(div);
                });
            }
        }
    } catch (error) {
        console.error('Content load error:', error);
    }
}
function populateContentEditor(key, textareaId) {
    var el = document.getElementById(textareaId);
    if (el && adminContentCache[key]) {
        el.value = adminContentCache[key].html || '';
    }
    if (key.startsWith('wiki_')) {
        var topic = key.replace('wiki_', '');
        var capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
        var titleEl = document.getElementById('adminTitleWiki' + capTopic);
        var subEl = document.getElementById('adminSubtitleWiki' + capTopic);
        if (titleEl && adminContentCache[key]) titleEl.value = adminContentCache[key].title || '';
        if (subEl && adminContentCache[key]) subEl.value = adminContentCache[key].subtitle || '';
    }
}

async function saveAdminContent(key, textareaId) {
    const html = document.getElementById(textareaId).value;
    const token = sessionStorage.getItem('rh_token');

    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateContent',
                token: token,
                contentKey: key,
                contentHtml: html,
                updatedBy: currentUser?.handle || 'admin'
            })
        });
        const result = await response.json();
        trackApiCall('updateContent', result);
        showToast(result.status === 'success' ? 'Saved!' : 'Failed', result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }
}
async function saveWikiContent(key) {
    var topic = key.replace('wiki_', '');
    var capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    var title = document.getElementById('adminTitleWiki' + capTopic).value;
    var subtitle = document.getElementById('adminSubtitleWiki' + capTopic).value;
    var html = document.getElementById('adminContentWiki' + capTopic).value;
    var token = sessionStorage.getItem('rh_token');

    try {
        var response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateContent',
                token: token,
                contentKey: key,
                contentHtml: html,
                contentTitle: title,
                contentSubtitle: subtitle,
                updatedBy: currentUser?.handle || 'admin'
            })
        });
        var result = await response.json();
        trackApiCall('updateContent', result);
        showToast(result.status === 'success' ? 'Saved!' : 'Failed', result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }
}
async function addNewWikiTopic() {
    var topicId = prompt('Topic ID (lowercase, no spaces, e.g. "recycling"):');
    if (!topicId) return;
    topicId = topicId.trim().toLowerCase().replace(/\s+/g, '_');

    var title = prompt('Display title (e.g. "♻️ Recycling Guide"):');
    if (!title) return;

    var subtitle = prompt('Subtitle (e.g. "How to recycle in Montgomery"):') || '';

    var key = 'wiki_' + topicId;
    var token = sessionStorage.getItem('rh_token');

    try {
        var response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateContent',
                token: token,
                contentKey: key,
                contentHtml: '',
                contentTitle: title,
                contentSubtitle: subtitle,
                updatedBy: currentUser?.handle || 'admin'
            })
        });
        var result = await response.json();
        trackApiCall('updateContent', result);

        if (result.status === 'success') {
            showToast('Topic created! Reload admin to see editor.', 'success');
            loadAdminContentEditors();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}
// Load content into modals on app start
async function loadDynamicContent() {
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_content');
        const result = await response.json();

        if (result.status !== 'success') return;
        const content = result.content || {};

        // Getting Started
        if (content.getting_started && content.getting_started.html) {
            const gs = document.querySelector('#gettingStartedModal .modal-content');
            if (gs) gs.innerHTML = content.getting_started.html;
        }

        // Safety/Legal — only replace the info part, keep checkbox
        if (content.safety_legal && content.safety_legal.html) {
            const sl = document.querySelector('#safetyLegalModal .modal-content');
            if (sl) {
                sl.innerHTML = content.safety_legal.html +
                    '<div class="safety-checkbox"><input type="checkbox" id="safetyLegalAck"><label for="safetyLegalAck">I understand and agree</label></div>';
                // Re-attach checkbox listener
                const ack = document.getElementById('safetyLegalAck');
                const acceptBtn = document.getElementById('acceptSafetyLegal');
                if (ack && acceptBtn) {
                    ack.addEventListener('change', function() { acceptBtn.disabled = !this.checked; });
                }
            }
        }

        // Wiki topics — store for showWikiTopic()
        window._wikiContent = {};
        window._wikiMeta = {};
        var wikiKeys = Object.keys(content).filter(function(k) { return k.startsWith('wiki_'); });
        wikiKeys.forEach(function(key) {
            if (content[key]) {
                var topic = key.replace('wiki_', '');
                if (content[key].html) window._wikiContent[topic] = content[key].html;
                window._wikiMeta[topic] = {
                    title: content[key].title || '',
                    subtitle: content[key].subtitle || ''
                };
            }
        });

        // Rebuild wiki index if we have metadata
        var wikiContainer = document.querySelector('#wikiModal .modal-content');
        if (wikiContainer && Object.keys(window._wikiMeta).length > 0) {
            var indexHtml = '<p style="color: #6b7280; font-style: italic;">A growing knowledge base for CHIMERA volunteers.</p>';
            wikiKeys.forEach(function(key) {
                var topic = key.replace('wiki_', '');
                var meta = window._wikiMeta[topic];
                var defaultTitles = { cpue: '📊 What is √CPUE?', zones: '🗺️ Montgomery Zones', validation: '✓ Scout Validation', safety: '⚠️ Safety Guidelines', privacy: '🔒 Privacy & Data' };
                var defaultSubs = { cpue: 'Understanding the efficiency metric', zones: 'How collection zones work', validation: 'How ratings get verified', safety: 'Stay safe while collecting', privacy: 'What we collect and why' };
                var title = meta.title || defaultTitles[topic] || topic;
                var subtitle = meta.subtitle || defaultSubs[topic] || '';
                indexHtml += '<div style="margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; cursor: pointer;" onclick="showWikiTopic(\'' + topic + '\')">' +
                    '<strong>' + title + '</strong>' +
                    '<div style="font-size: 12px; color: #6b7280;">' + subtitle + '</div></div>';
            });
            wikiContainer.innerHTML = indexHtml;
        }
    } catch (error) {
        console.error('Dynamic content load error:', error);
    }
}

// ==================== ZONE MANAGER (Leaflet Draw) ====================

let zoneMap = null;
let zoneDrawControl = null;
let zoneLayersGroup = null;
let zoneEditingId = null;
let zoneDrawnLayer = null;
let adminZonesList = [];

function initZoneManager() {
    if (zoneMap) return; // already initialized

    // Load Leaflet Draw CSS
    if (!document.querySelector('link[href*="leaflet.draw"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
        document.head.appendChild(link);
    }

    // Load Leaflet Draw JS
    if (!window.L || !window.L.Draw) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
        script.onload = function() { setupZoneMap(); };
        document.body.appendChild(script);
    } else {
        setupZoneMap();
    }
}

function setupZoneMap() {
    const container = document.getElementById('zoneMapContainer');
    if (!container) return;

    // Set explicit height
    container.style.height = '350px';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';

    zoneMap = L.map('zoneMapContainer').setView([32.356, -86.306], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM',
        maxZoom: 19
    }).addTo(zoneMap);

    zoneLayersGroup = new L.FeatureGroup();
    zoneMap.addLayer(zoneLayersGroup);

    zoneDrawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                shapeOptions: { color: '#2D5F3F', weight: 2 }
            },
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false
        },
        edit: {
            featureGroup: zoneLayersGroup,
            remove: true
        }
    });
    zoneMap.addControl(zoneDrawControl);

    // Handle new polygon drawn
    zoneMap.on(L.Draw.Event.CREATED, function(e) {
        if (zoneDrawnLayer) {
            zoneLayersGroup.removeLayer(zoneDrawnLayer);
        }
        zoneDrawnLayer = e.layer;
        zoneLayersGroup.addLayer(zoneDrawnLayer);

        // Extract coordinates [lon, lat] for backend
        const coords = zoneDrawnLayer.getLatLngs()[0].map(function(ll) {
            return [parseFloat(ll.lng.toFixed(4)), parseFloat(ll.lat.toFixed(4))];
        });

        document.getElementById('zonePolygonData').value = JSON.stringify(coords);
        document.getElementById('zoneEditorPanel').style.display = 'block';
        document.getElementById('zoneEditorTitle').textContent = 'New Zone';
        document.getElementById('zoneNameInput').value = '';
        document.getElementById('zoneActiveToggle').checked = true;
        document.getElementById('deleteZoneBtn').style.display = 'none';
        zoneEditingId = null;
    });

    // Handle polygon edited
    zoneMap.on(L.Draw.Event.EDITED, function(e) {
        e.layers.eachLayer(function(layer) {
            if (layer._chimeraZoneId) {
                const coords = layer.getLatLngs()[0].map(function(ll) {
                    return [parseFloat(ll.lng.toFixed(4)), parseFloat(ll.lat.toFixed(4))];
                });
                updateZonePolygon(layer._chimeraZoneId, coords);
            }
        });
    });

    // Handle polygon deleted
    zoneMap.on(L.Draw.Event.DELETED, function(e) {
        e.layers.eachLayer(function(layer) {
            if (layer._chimeraZoneId) {
                deleteZone(layer._chimeraZoneId);
            }
        });
    });

    // Fix map rendering in hidden containers
    setTimeout(function() { zoneMap.invalidateSize(); }, 300);

    loadZonesOnMap();
}

async function loadZonesOnMap() {
    const token = sessionStorage.getItem('rh_token');
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_zones&token=' + token);
        const result = await response.json();

        if (result.status !== 'success') return;

        adminZonesList = result.zones || [];
        zoneLayersGroup.clearLayers();

        const listEl = document.getElementById('zoneListItems');
        if (adminZonesList.length === 0) {
            listEl.innerHTML = '<div style="color:#9ca3af; text-align:center; font-size:13px; padding:10px;">No zones. Draw one on the map.</div>';
            return;
        }

        listEl.innerHTML = adminZonesList.map(function(zone) {
            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:#f9fafb; border-radius:6px; margin-bottom:4px; cursor:pointer;" onclick="focusZone(\'' + zone.id + '\')">' +
                '<div><span style="font-size:13px; font-weight:600; color:#374151;">' + escapeHtml(zone.name) + '</span>' +
                '<span style="font-size:10px; color:#9ca3af; margin-left:6px;">' + (zone.polygon ? zone.polygon.length + ' pts' : '?') + '</span></div>' +
                '<button onclick="event.stopPropagation(); editZone(\'' + zone.id + '\')" style="padding:2px 8px; background:#2D5F3F; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>' +
                '</div>';
        }).join('');

        // Add polygons to map
        adminZonesList.forEach(function(zone) {
            if (!zone.polygon || zone.polygon.length < 3) return;
            var coords = zone.polygon.map(function(p) { return [p[1], p[0]]; });
            var polygon = L.polygon(coords, {
                color: '#2D5F3F',
                weight: 2,
                fillColor: '#2D5F3F',
                fillOpacity: 0.15
            });
            polygon._chimeraZoneId = zone.id;
            polygon.bindTooltip(zone.name, { permanent: false });
            zoneLayersGroup.addLayer(polygon);
        });

    } catch (error) {
        console.error('Zone load error:', error);
    }
}

function focusZone(zoneId) {
    var zone = adminZonesList.find(function(z) { return z.id === zoneId; });
    if (!zone || !zone.polygon) return;
    var coords = zone.polygon.map(function(p) { return [p[1], p[0]]; });
    zoneMap.fitBounds(coords, { padding: [30, 30] });
}

function editZone(zoneId) {
    var zone = adminZonesList.find(function(z) { return z.id === zoneId; });
    if (!zone) return;

    zoneEditingId = zoneId;
    document.getElementById('zoneEditorPanel').style.display = 'block';
    document.getElementById('zoneEditorTitle').textContent = 'Edit: ' + zone.name;
    document.getElementById('zoneNameInput').value = zone.name;
    document.getElementById('zoneActiveToggle').checked = zone.active !== false;
    document.getElementById('zonePolygonData').value = JSON.stringify(zone.polygon);
    document.getElementById('deleteZoneBtn').style.display = 'inline-block';

    focusZone(zoneId);
}

function cancelZoneEdit() {
    document.getElementById('zoneEditorPanel').style.display = 'none';
    zoneEditingId = null;
    if (zoneDrawnLayer) {
        zoneLayersGroup.removeLayer(zoneDrawnLayer);
        zoneDrawnLayer = null;
    }
}

async function saveZone() {
    var name = document.getElementById('zoneNameInput').value.trim();
    if (!name) { showToast('Zone name required', 'error'); return; }

    var polygonStr = document.getElementById('zonePolygonData').value;
    var polygon;
    try { polygon = JSON.parse(polygonStr); } catch(e) { showToast('Invalid polygon data', 'error'); return; }

    var active = document.getElementById('zoneActiveToggle').checked;
    var token = sessionStorage.getItem('rh_token');

    var action, body;
    if (zoneEditingId) {
        action = 'updateZone';
        body = { action: action, token: token, zoneId: zoneEditingId, name: name, polygon: polygon, active: active };
    } else {
        action = 'createZone';
        body = { action: action, token: token, name: name, polygon: polygon };
    }

    try {
        var response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(body)
        });
        var result = await response.json();
        trackApiCall(action, result);

        if (result.status === 'success') {
            showToast(zoneEditingId ? 'Zone updated' : 'Zone created', 'success');
            cancelZoneEdit();
            loadZonesOnMap();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

async function updateZonePolygon(zoneId, polygon) {
    var token = sessionStorage.getItem('rh_token');
    try {
        await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'updateZone', token: token, zoneId: zoneId, polygon: polygon })
        });
        showToast('Zone boundary updated', 'success');
    } catch (error) {
        showToast('Failed to update zone', 'error');
    }
}

async function deleteZone(zoneId) {
    if (zoneId === undefined) zoneId = zoneEditingId;
    if (!zoneId) return;
    if (!confirm('Delete this zone? This cannot be undone.')) return;

    var token = sessionStorage.getItem('rh_token');
    try {
        var response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteZone', token: token, zoneId: zoneId })
        });
        var result = await response.json();
        trackApiCall('deleteZone', result);

        if (result.status === 'success') {
            showToast('Zone deleted', 'success');
            cancelZoneEdit();
            loadZonesOnMap();
        } else {
            showToast(result.message || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

async function recalculateAllZones() {
    var btn = document.getElementById('recalcZonesBtn');
    btn.disabled = true;
    btn.textContent = 'Recalculating...';

    var token = sessionStorage.getItem('rh_token');
    try {
        var response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'seedZones', token: token })
        });
        var result = await response.json();
        trackApiCall('seedZones', result);
        showToast(result.status === 'success' ? 'Zones recalculated' : 'Failed', result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Recalculate All Session Zones';
}
