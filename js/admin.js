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
            return `<div class="admin-event-card">
                <div class="admin-event-title">${escapeHtml(ev.title)}</div>
                <div class="admin-event-meta">
                    ${escapeHtml(ev.coordinatorName)} · ${dateStr} · ${ev.locationName || 'No location'}
                </div>
                ${ev.description ? '<div style="font-size:12px; color:#6b7280; margin-top:6px;">' + escapeHtml(ev.description.substring(0, 120)) + '</div>' : ''}
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
                reviewedBy: currentUser?.handle || 'admin'
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
