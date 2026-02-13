// ui.js — Toast notifications, hamburger menu, modals, wiki

// ==================== TOAST NOTIFICATIONS ====================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '⚠';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    container.classList.add('show');
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) container.classList.remove('show');
        }, 300);
    }, 3000);
}

// ==================== HAMBURGER MENU ====================

function openMenu() {
    document.getElementById('menuOverlay').classList.add('show');
    document.getElementById('slideMenu').classList.add('show');
}

function closeMenu() {
    document.getElementById('menuOverlay').classList.remove('show');
    document.getElementById('slideMenu').classList.remove('show');
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('hamburgerBadge');
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ==================== WIKI ====================

const wikiTopics = {
    cpue: {
        title: '📊 What is √CPUE?',
        content: `<p><strong>CPUE</strong> stands for <em>Catch Per Unit Effort</em> — a standard metric in environmental science.</p>
            <p>In CHIMERA, we calculate it as:</p>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 8px; font-family: monospace; text-align: center;">
                √CPUE = √(weight ÷ distance)
            </p>
            <p>The square root transformation normalizes the data and makes comparisons meaningful across different collection sessions.</p>
            <p><strong>Higher √CPUE</strong> = More litter collected per distance traveled</p>`
    },
    zones: {
        title: '🗺️ Montgomery Zones',
        content: `<p>Montgomery is divided into geographic zones for data collection and analysis.</p>
            <p>Zones help us:</p>
            <ul>
                <li>Track litter patterns by area</li>
                <li>Coordinate cleanup events</li>
                <li>Measure progress over time</li>
                <li>Identify priority areas</li>
            </ul>
            <p>Your zone is determined automatically by GPS when you submit a session.</p>`
    },
    validation: {
        title: '✓ Scout Validation',
        content: `<p>When you <strong>Rate a Location</strong>, your rating is stored as a prediction.</p>
            <p>When someone later <strong>Collects</strong> in that area, we compare:</p>
            <ul>
                <li>Your rating (0-10 scale)</li>
                <li>Actual √CPUE from collection</li>
            </ul>
            <p>The difference is your <strong>divergence score</strong>. Lower is better!</p>
            <p><strong>Spot On:</strong> ≤1 divergence<br>
            <strong>Close:</strong> ≤3 divergence<br>
            <strong>Off:</strong> >3 divergence</p>`
    },
    safety: {
        title: '⚠️ Safety Guidelines',
        content: `<ul>
                <li>Watch for traffic when crossing streets</li>
                <li>Wear gloves when handling litter</li>
                <li>Stay hydrated and take breaks</li>
                <li>Work in pairs when possible</li>
                <li><strong>Never operate a vehicle while tracking</strong></li>
                <li>Stay aware of your surroundings</li>
                <li>Avoid hazards (glass, sharp objects, wildlife)</li>
                <li>Don't enter private property without permission</li>
            </ul>`
    },
    privacy: {
        title: '🔒 Privacy & Data',
        content: `<p><strong>What we collect:</strong></p>
            <ul>
                <li>GPS coordinates during sessions</li>
                <li>Litter ratings and collection weights</li>
                <li>Photos (with your consent)</li>
                <li>Your handle (not your real name)</li>
            </ul>
            <p><strong>What we don't share:</strong></p>
            <ul>
                <li>Your email (if provided)</li>
                <li>Your exact home address</li>
                <li>Individual GPS tracks</li>
            </ul>
            <p>GPS data is archived after validation and deleted after 30 days.</p>`
    }
};

function showWikiTopic(topicId) {
    const topic = wikiTopics[topicId];
    if (!topic) return;
    document.getElementById('wikiTopicTitle').textContent = topic.title;
    document.getElementById('wikiTopicContent').innerHTML = topic.content;
    document.getElementById('wikiTopicModal').classList.add('show');
}

// ==================== BIND MENU & MODAL EVENTS ====================

function initUI() {
    // Hamburger
    document.getElementById('hamburgerBtn').addEventListener('click', openMenu);
    document.getElementById('menuOverlay').addEventListener('click', closeMenu);

    // Menu items
    document.getElementById('menuEditProfile').addEventListener('click', () => { closeMenu(); showEditProfile(); });
    document.getElementById('menuGettingStarted').addEventListener('click', () => { closeMenu(); document.getElementById('gettingStartedModal').classList.add('show'); });
    document.getElementById('menuWiki').addEventListener('click', () => { closeMenu(); document.getElementById('wikiModal').classList.add('show'); });
    document.getElementById('closeWiki').addEventListener('click', () => { document.getElementById('wikiModal').classList.remove('show'); });
    document.getElementById('menuFieldTest').addEventListener('click', () => { window.location.href = CONFIG.urls.fieldTestMap; });
    document.getElementById('menuDemo').addEventListener('click', () => { window.location.href = CONFIG.urls.demoGame; });

    document.getElementById('menuScout').addEventListener('click', () => {
        if (sunLocked) { showToast('Unavailable after sunset', 'warning'); return; }
        closeMenu(); showScoutMode();
    });
    document.getElementById('menuPin').addEventListener('click', () => showToast('Pin Location coming soon!', 'warning'));
    document.getElementById('menuTrack').addEventListener('click', () => {
        if (sunLocked) { showToast('Unavailable after sunset', 'warning'); return; }
        closeMenu(); startCollection();
    });
    document.getElementById('menuRecycle').addEventListener('click', () => { closeMenu(); showRecycleScreen(); });
    document.getElementById('menuLogout').addEventListener('click', () => { if (confirm('Log out?')) { clearSession(); location.reload(); } });

    document.getElementById('menuActivityFeed').addEventListener('click', () => { closeMenu(); showMainScreen(); });
    document.getElementById('menuEventManager').addEventListener('click', () => { closeMenu(); showEventManager(); });
    document.getElementById('menuUpcomingEvents').addEventListener('click', () => { closeMenu(); showUpcomingEvents(); });

    // Getting Started modal
    document.getElementById('closeGettingStarted').addEventListener('click', () => {
        document.getElementById('gettingStartedModal').classList.remove('show');
    });

    // Safety/Legal modal
    document.getElementById('safetyLegalAck').addEventListener('change', function () {
        document.getElementById('acceptSafetyLegal').disabled = !this.checked;
    });

    document.getElementById('acceptSafetyLegal').addEventListener('click', async () => {
        currentUser.safetyLegalAccepted = true;
        currentUser.lastSafetyLegalCheck = new Date().toISOString();
        saveSession();

        try {
            await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'updateProfile', token: sessionStorage.getItem('rh_token'), userId: currentUser.userId, safetyLegalAccepted: true })
            });
        } catch (e) { console.error('Safety save error:', e); }

        document.getElementById('safetyLegalModal').classList.remove('show');
        showToast('Safety guidelines acknowledged', 'success');
        showMainScreen();
    });
}
