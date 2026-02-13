// scout.js — Scout mode (single GPS capture + rating)

function showScoutMode() {
    hideAllScreens();
    document.getElementById('scoutScreen').classList.remove('hidden');

    // Reset state
    sessionState = { sessionId: 'scout_' + Date.now(), gpsPoints: [], ratingTouched: false, mode: 'scout-only' };
    document.getElementById('scoutRatingSlider').value = 5;
    document.getElementById('scoutRatingSlider').classList.add('untouched');
    document.getElementById('scoutRatingValue').textContent = '—';
    document.getElementById('scoutRatingValue').classList.add('untouched');
    document.getElementById('scoutRatingDesc').textContent = 'Tap the slider to rate';
    document.getElementById('scoutNotes').value = '';
    document.getElementById('scoutNotesCount').textContent = '0';
    document.getElementById('scoutGPSStatus').textContent = 'Capturing...';
    document.getElementById('scoutGPSStatus').style.color = '#1f2937';
    document.querySelectorAll('input[name="scoutFeed"]').forEach(r => r.checked = false);
    document.getElementById('submitScoutBtn').disabled = true;

    // Capture GPS once
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                sessionState.gpsPoints = [{ lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: new Date().toISOString() }];
                document.getElementById('scoutGPSStatus').textContent = 'Captured ✓';
                document.getElementById('scoutGPSStatus').style.color = '#10b981';
            },
            (err) => {
                console.error('GPS error:', err);
                document.getElementById('scoutGPSStatus').textContent = 'Error';
                document.getElementById('scoutGPSStatus').style.color = '#dc2626';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

function validateScoutSubmit() {
    const consentOk = document.querySelector('input[name="scoutFeed"]:checked');
    document.getElementById('submitScoutBtn').disabled = !consentOk;
}

function initScout() {
    document.getElementById('scoutRatingSlider').addEventListener('input', function () {
        sessionState.ratingTouched = true;
        this.classList.remove('untouched');
        document.getElementById('scoutRatingValue').textContent = this.value;
        document.getElementById('scoutRatingValue').classList.remove('untouched');
        document.getElementById('scoutRatingDesc').textContent = RATING_DESCRIPTIONS[this.value];
        validateScoutSubmit();
    });

    document.getElementById('scoutNotes').addEventListener('input', function () {
        document.getElementById('scoutNotesCount').textContent = this.value.length;
    });

    document.querySelectorAll('input[name="scoutFeed"]').forEach(r => r.addEventListener('change', validateScoutSubmit));

    document.getElementById('submitScoutBtn').addEventListener('click', async function () {
        if (sessionState.gpsPoints.length === 0) { showToast('No GPS captured', 'error'); return; }

        this.disabled = true;
        this.textContent = 'Submitting...';

        const rating = sessionState.ratingTouched ? parseInt(document.getElementById('scoutRatingSlider').value) : null;

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'submitSession', token: sessionStorage.getItem('rh_token'), mode: 'scout-only',
                    sessionId: sessionState.sessionId,
                    userId: currentUser.userId, volunteerName: currentUser.handle, organization: currentUser.organization,
                    gpsPoints: sessionState.gpsPoints,
                    startLat: sessionState.gpsPoints[0].lat, startLon: sessionState.gpsPoints[0].lon,
                    endLat: sessionState.gpsPoints[0].lat, endLon: sessionState.gpsPoints[0].lon,
                    rating: rating, notes: document.getElementById('scoutNotes').value.trim(),
                    activityFeedConsent: document.querySelector('input[name="scoutFeed"]:checked').value === 'yes',
                    timestamp: new Date().toISOString()
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                showToast('Scout submitted!', 'success');
                if (huntIntegration.fromHunt) {
                    setTimeout(() => { window.location.href = 'chimera-hunt.html?completed=scout&sessionId=' + sessionState.sessionId; }, 1500);
                } else {
                    setTimeout(() => showMainScreen(), 1500);
                }
            } else {
                showToast(result.message || 'Submission failed', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showToast('Connection error', 'error');
        }

        this.disabled = false;
        this.textContent = 'Submit Scout Report';
    });

    document.getElementById('cancelScoutBtn').addEventListener('click', () => {
        if (confirm('Cancel scout?')) showMainScreen();
    });
}
