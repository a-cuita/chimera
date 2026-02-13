// events.js — Coordinator event management, proposals, supplies, upcoming events

// ==================== COORDINATOR STATUS ====================

function checkCoordinatorStatus() {
    if (currentUser && currentUser.overrides && Array.isArray(currentUser.overrides)) {
        if (currentUser.overrides.includes('event_coordinator')) {
            document.getElementById('coordinatorMenuSection').style.display = 'block';
            document.getElementById('coordinatorDivider').style.display = 'block';
            return true;
        }
    }
    document.getElementById('coordinatorMenuSection').style.display = 'none';
    document.getElementById('coordinatorDivider').style.display = 'none';
    return false;
}

// ==================== EVENT MANAGER ====================

function showEventManager() {
    hideAllScreens();
    document.getElementById('eventManagerScreen').classList.remove('hidden');
    loadMyEvents();
}

async function loadMyEvents() {
    const list = document.getElementById('myEventsList');
    list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 30px;">Loading...</div>';

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_my_events&userId=' + currentUser.userId + '&token=' + sessionStorage.getItem('rh_token'));
        const result = await response.json();

        if (result.status !== 'success') {
            list.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 30px;">Failed to load events</div>';
            return;
        }

        const events = result.events || [];

        if (events.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 30px;">No events yet. Create one!</div>';
            return;
        }

        const statusColors = { 'pending': '#f59e0b', 'approved': '#22c55e', 'rejected': '#dc2626', 'cancelled': '#6b7280' };
        let html = '';
        events.forEach(event => {
            const dateStr = event.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'TBD';
            const statusColor = statusColors[event.status] || '#6b7280';

            html += `<div onclick="showEventDetail('${event.eventId}')" style="background: white; border-radius: 12px; padding: 14px; margin-bottom: 10px; border-left: 4px solid ${statusColor}; cursor: pointer; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'">
                <div style="font-weight: 600; color: #1f2937;">${event.title}</div>
                <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                    📅 ${dateStr} &nbsp;•&nbsp; 📍 ${event.locationName || 'TBD'}
                </div>
                <div style="margin-top: 8px;">
                    <span style="font-size: 11px; background: ${statusColor}20; color: ${statusColor}; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase;">
                        ${event.status}
                    </span>
                </div>
            </div>`;
        });

        list.innerHTML = html;
    } catch (error) {
        console.error('Load my events error:', error);
        list.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 30px;">Error loading events</div>';
    }
}

// ==================== EVENT DETAIL ====================

// Exposed to window for inline onclick
window.showEventDetail = async function (eventId) {
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_my_events&userId=' + currentUser.userId + '&token=' + sessionStorage.getItem('rh_token'));
        const result = await response.json();

        if (result.status !== 'success') { showToast('Failed to load event', 'error'); return; }

        const event = (result.events || []).find(e => e.eventId === eventId);
        if (!event) { showToast('Event not found', 'error'); return; }

        currentEventData = event;

        hideAllScreens();
        document.getElementById('eventDetailScreen').classList.remove('hidden');

        document.getElementById('eventDetailTitle').textContent = event.title;

        const statusColors = { 'pending': '#f59e0b', 'approved': '#22c55e', 'rejected': '#dc2626', 'cancelled': '#6b7280' };
        const statusColor = statusColors[event.status] || '#6b7280';
        document.getElementById('eventDetailStatus').innerHTML = `Status: <span style="color: ${statusColor}; font-weight: 600; text-transform: uppercase;">${event.status}</span>`;

        document.getElementById('eventDetailDate').textContent = event.eventDate
            ? new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'TBD';
        document.getElementById('eventDetailTime').textContent = event.startTime
            ? `${formatTime12Hour(event.startTime)}${event.endTime ? ' - ' + formatTime12Hour(event.endTime) : ''}` : 'TBD';
        document.getElementById('eventDetailLocation').textContent = event.locationName || 'TBD';

        if (event.description) {
            document.getElementById('eventDetailDescription').style.display = 'block';
            document.getElementById('eventDetailDescText').textContent = event.description;
        } else {
            document.getElementById('eventDetailDescription').style.display = 'none';
        }

        const isApproved = event.status === 'approved';
        const canCancel = event.status === 'pending' || event.status === 'approved';

        document.getElementById('postUpdateSection').style.display = isApproved ? 'block' : 'none';
        document.getElementById('suppliesSection').style.display = isApproved ? 'block' : 'none';
        document.getElementById('cancelEventBtn').style.display = canCancel ? 'inline-block' : 'none';

        if (isApproved) {
            currentSupplies = currentEventData.supplies || [];
            renderSupplies();
        }
    } catch (error) {
        console.error('Show event detail error:', error);
        showToast('Error loading event', 'error');
    }
};

// ==================== PROPOSE EVENT ====================

function showProposeEventScreen() {
    hideAllScreens();
    document.getElementById('proposeEventScreen').classList.remove('hidden');

    document.getElementById('eventTitleInput').value = '';
    document.getElementById('eventDateInput').value = '';
    document.getElementById('eventStartTimeInput').value = '';
    document.getElementById('eventEndTimeInput').value = '';
    document.getElementById('eventLocationInput').value = '';
    document.getElementById('eventAddressInput').value = '';
    document.getElementById('eventDescriptionInput').value = '';
    document.getElementById('eventContactName').value = '';
    document.getElementById('eventContactPhone').value = '';
    document.getElementById('eventContactEmail').value = '';
}

// ==================== SUPPLIES ====================

function renderSupplies() {
    const list = document.getElementById('suppliesList');

    if (currentSupplies.length === 0) {
        list.innerHTML = '<div style="font-size: 13px; color: #6b7280; padding: 10px 0;">No supplies listed yet.</div>';
        return;
    }

    let html = '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">';
    html += '<tr style="background: #f3f4f6; text-align: left;"><th style="padding: 8px;">Item</th><th style="padding: 8px;">Qty/$</th><th style="padding: 8px; text-align: center;">Got?</th><th></th></tr>';

    currentSupplies.forEach((supply, idx) => {
        const checkmark = supply.acquired ? '✅' : '⬜';
        html += `<tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px;">${supply.item}${supply.description ? '<br><span style="font-size: 11px; color: #6b7280;">' + supply.description + '</span>' : ''}</td>
            <td style="padding: 8px;">${supply.quantity || '-'}</td>
            <td style="padding: 8px; text-align: center; cursor: pointer;" onclick="toggleSupplyAcquired(${idx})">${checkmark}</td>
            <td style="padding: 4px;"><button onclick="removeSupply(${idx})" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 14px;">✕</button></td>
        </tr>`;
    });

    html += '</table>';
    list.innerHTML = html;
}

async function saveSupplies() {
    if (!currentEventData) return;
    try {
        await fetch(CONFIG.appsScriptUrl, {
            method: 'POST', headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateEventSupplies', token: sessionStorage.getItem('rh_token'),
                userId: currentUser.userId, eventId: currentEventData.eventId, supplies: currentSupplies
            })
        });
    } catch (e) { console.error('Save supplies error:', e); }
}

// Exposed to window for inline onclick
window.toggleSupplyAcquired = function (idx) {
    currentSupplies[idx].acquired = !currentSupplies[idx].acquired;
    renderSupplies();
    saveSupplies();
};

window.removeSupply = function (idx) {
    currentSupplies.splice(idx, 1);
    renderSupplies();
    saveSupplies();
};

// ==================== UPCOMING EVENTS ====================

function showUpcomingEvents() {
    hideAllScreens();
    document.getElementById('upcomingEventsScreen').classList.remove('hidden');
    loadUpcomingEvents();
}

async function loadUpcomingEvents() {
    const list = document.getElementById('upcomingEventsList');
    list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 30px;">Loading...</div>';

    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_upcoming_events');
        const result = await response.json();

        if (result.status !== 'success') {
            list.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 30px;">Failed to load events</div>';
            return;
        }

        const events = result.events || [];
        updateUpcomingBanner(events);

        if (events.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 30px;">No upcoming events scheduled.</div>';
            return;
        }

        let html = '';
        events.forEach(event => {
            const dateStr = event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
            const timeStr = event.startTime ? formatTime12Hour(event.startTime) : '';

            html += `<div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1px solid #bbf7d0;">
                <div style="font-weight: 600; color: #166534;">${event.title}</div>
                <div style="font-size: 13px; color: #15803d; margin-top: 6px;">
                    📅 ${dateStr} ${timeStr ? '• 🕐 ' + timeStr : ''} • 📍 ${event.locationName}
                </div>
                ${event.description ? `<div style="font-size: 12px; color: #166534; margin-top: 8px;">${event.description}</div>` : ''}
                <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">Organized by ${event.organization || event.coordinatorName || 'Unknown'}</div>
            </div>`;
        });

        list.innerHTML = html;
    } catch (error) {
        console.error('Load upcoming events error:', error);
        list.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 30px;">Error loading events</div>';
    }
}

function updateUpcomingBanner(events) {
    const banner = document.getElementById('upcomingBannerText');
    if (events && events.length > 0) {
        const next = events[0];
        const dateStr = next.eventDate ? new Date(next.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        banner.innerHTML = `<strong>${next.title}</strong> — ${dateStr} • Tap for details`;
    } else {
        banner.textContent = 'No upcoming events • Tap to view';
    }
}

async function loadUpcomingBanner() {
    try {
        const response = await fetch(CONFIG.appsScriptUrl + '?action=get_upcoming_events');
        const result = await response.json();
        if (result.status === 'success') {
            updateUpcomingBanner(result.events || []);
        }
    } catch (e) { console.error('Banner load error:', e); }
}

// ==================== BIND EVENTS ====================

function initEvents() {
    document.getElementById('proposeEventBtn').addEventListener('click', showProposeEventScreen);
    document.getElementById('cancelEventProposalBtn').addEventListener('click', showEventManager);
    document.getElementById('backFromEventManagerBtn').addEventListener('click', showMainScreen);
    document.getElementById('backFromEventDetailBtn').addEventListener('click', showEventManager);
    document.getElementById('backFromUpcomingBtn').addEventListener('click', showMainScreen);

    document.getElementById('eventOrgSelect').addEventListener('change', function () {
        document.getElementById('eventCustomOrg').classList.toggle('hidden', this.value !== 'other');
    });

    // Submit event proposal
    document.getElementById('submitEventProposalBtn').addEventListener('click', async () => {
        const title = document.getElementById('eventTitleInput').value.trim();
        const orgSelect = document.getElementById('eventOrgSelect').value;
        const customOrgText = document.getElementById('eventCustomOrgText').value.trim();
        const organization = orgSelect === 'other' ? customOrgText : orgSelect;
        const eventDate = document.getElementById('eventDateInput').value;
        const locationName = document.getElementById('eventLocationInput').value.trim();

        if (!title) { showToast('Event title required', 'error'); return; }
        if (!organization) { showToast('Organization required', 'error'); return; }
        if (!eventDate) { showToast('Event date required', 'error'); return; }
        if (!locationName) { showToast('Location required', 'error'); return; }

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'proposeEvent', token: sessionStorage.getItem('rh_token'),
                    userId: currentUser.userId, coordinatorName: currentUser.handle, organization, title, eventDate,
                    startTime: document.getElementById('eventStartTimeInput').value,
                    endTime: document.getElementById('eventEndTimeInput').value,
                    locationName,
                    locationAddress: document.getElementById('eventAddressInput').value.trim(),
                    description: document.getElementById('eventDescriptionInput').value.trim(),
                    contactName: document.getElementById('eventContactName').value.trim(),
                    contactPhone: document.getElementById('eventContactPhone').value.trim(),
                    contactEmail: document.getElementById('eventContactEmail').value.trim()
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                showToast('Event submitted for approval!', 'success');
                showEventManager();
            } else {
                showToast(result.message || 'Submission failed', 'error');
            }
        } catch (error) { showToast('Submission error', 'error'); }
    });

    // Post event update
    document.getElementById('postEventUpdateBtn').addEventListener('click', async () => {
        if (!currentEventData) return;
        const message = document.getElementById('eventUpdateText').value.trim();
        if (!message) { showToast('Enter a message', 'error'); return; }

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'postEventUpdate', token: sessionStorage.getItem('rh_token'),
                    userId: currentUser.userId, eventId: currentEventData.eventId, message
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('Update posted!', 'success');
                document.getElementById('eventUpdateText').value = '';
            } else { showToast(result.message || 'Post failed', 'error'); }
        } catch (error) { showToast('Post error', 'error'); }
    });

    // Cancel event
    document.getElementById('cancelEventBtn').addEventListener('click', async () => {
        if (!currentEventData) return;
        const reason = prompt('Why are you cancelling this event? (This will be posted to the activity feed)');
        if (reason === null) return;

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'cancelEvent', token: sessionStorage.getItem('rh_token'),
                    userId: currentUser.userId, eventId: currentEventData.eventId, reason: reason.trim()
                })
            });
            const result = await response.json();
            if (result.status === 'success') { showToast('Event cancelled', 'success'); showEventManager(); }
            else { showToast(result.message || 'Cancel failed', 'error'); }
        } catch (error) { showToast('Cancel error', 'error'); }
    });

    // Add supply
    document.getElementById('addSupplyBtn').addEventListener('click', () => {
        const item = prompt('Supply item name:');
        if (!item || !item.trim()) return;
        const description = prompt('Description (optional):') || '';
        const quantity = prompt('Quantity or $ needed:') || '';

        currentSupplies.push({ item: item.trim(), description: description.trim(), quantity: quantity.trim(), acquired: false });
        renderSupplies();
        saveSupplies();
        showToast('Supply added', 'success');
    });
}
