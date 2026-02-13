// tracking.js — Live GPS collection tracking + post-tracking form + bag management

// ==================== LIVE TRACKING ====================

function startCollection() {
    hideAllScreens();
    document.getElementById('activeTrackingScreen').classList.remove('hidden');

    sessionState = {
        sessionId: 'collection_' + Date.now(), isTracking: true, startTime: Date.now(),
        gpsPoints: [], photos: [], totalDistance: 0, mode: 'collection', ratingTouched: false
    };

    captureGPSPoint();
    sessionState.gpsTimer = setInterval(captureGPSPoint, CONFIG.gpsInterval);
    sessionState.durationTimer = setInterval(updateTrackingDisplay, 1000);

    showToast('Tracking started!', 'success');
}

function captureGPSPoint() {
    if (!navigator.geolocation || !sessionState.isTracking) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const point = { lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: new Date().toISOString() };
            if (sessionState.gpsPoints.length > 0) {
                const last = sessionState.gpsPoints[sessionState.gpsPoints.length - 1];
                sessionState.totalDistance += calculateDistance(last.lat, last.lon, point.lat, point.lon);
            }
            sessionState.gpsPoints.push(point);
            document.getElementById('trackingDistance').textContent = sessionState.totalDistance.toFixed(2) + ' mi';
        },
        (err) => console.error('GPS error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function updateTrackingDisplay() {
    if (!sessionState.isTracking) return;
    const elapsed = Math.floor((Date.now() - sessionState.startTime) / 1000);
    document.getElementById('trackingDuration').textContent = formatDuration(elapsed);
}

// ==================== POST-TRACKING ====================

function showPostTrackingScreen() {
    hideAllScreens();
    document.getElementById('postTrackingScreen').classList.remove('hidden');

    const totalSeconds = Math.floor((Date.now() - sessionState.startTime) / 1000);
    document.getElementById('finalDuration').textContent = formatDuration(totalSeconds);
    document.getElementById('finalDistance').textContent = sessionState.totalDistance.toFixed(2) + ' mi';

    // Reset form
    document.getElementById('postRatingSlider').value = 5;
    document.getElementById('postRatingSlider').classList.add('untouched');
    document.getElementById('postRatingValue').textContent = '—';
    document.getElementById('postRatingValue').classList.add('untouched');
    document.getElementById('postRatingDesc').textContent = 'Tap the slider to rate';
    document.getElementById('postNotes').value = '';
    document.getElementById('postNotesCount').textContent = '0';
    document.getElementById('bagsContainer').innerHTML = '';
    bags = [];
    bagCounter = 0;
    addBag();

    document.querySelectorAll('input[name="postFeed"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="photoConsent"]').forEach(r => r.checked = false);
    document.getElementById('photoConsentQuestion').classList.toggle('hidden', sessionState.photos.length === 0);
    document.getElementById('submitCollectionBtn').disabled = true;
}

// ==================== BAG MANAGEMENT ====================

function addBag() {
    bagCounter++;
    const bagId = 'bag_' + bagCounter;
    bags.push(bagId);
    const bagDiv = document.createElement('div');
    bagDiv.className = 'bag-entry';
    bagDiv.id = bagId;
    bagDiv.innerHTML = `
        <div class="bag-header">
            <span class="bag-number">Bag ${bagCounter}</span>
            <span class="remove-bag" onclick="removeBag('${bagId}')">Remove</span>
        </div>
        <input type="number" class="form-input" placeholder="Weight (lbs)" step="0.1" min="0">
    `;
    document.getElementById('bagsContainer').appendChild(bagDiv);
}

window.removeBag = function (bagId) {
    document.getElementById(bagId)?.remove();
    bags = bags.filter(id => id !== bagId);
};

// ==================== VALIDATION ====================

function validateCollectionSubmit() {
    const feedOk = document.querySelector('input[name="postFeed"]:checked');
    const photoOk = sessionState.photos.length === 0 || document.querySelector('input[name="photoConsent"]:checked');
    document.getElementById('submitCollectionBtn').disabled = !(feedOk && photoOk);
}

// ==================== BIND EVENTS ====================

function initTracking() {
    // Photo capture
    document.getElementById('trackingPhotoInput').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        navigator.geolocation.getCurrentPosition((pos) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                sessionState.photos.push({ timestamp: new Date().toISOString(), lat: pos.coords.latitude, lon: pos.coords.longitude, data: event.target.result });
                document.getElementById('trackingPhotoCount').textContent =
                    sessionState.photos.length + ' photo' + (sessionState.photos.length !== 1 ? 's' : '') + ' captured';
                showToast('Photo captured!', 'success');
            };
            reader.readAsDataURL(file);
        });
        this.value = '';
    });

    // Stop tracking
    document.getElementById('stopTrackingBtn').addEventListener('click', function () {
        sessionState.isTracking = false;
        clearInterval(sessionState.gpsTimer);
        clearInterval(sessionState.durationTimer);
        captureGPSPoint();
        showPostTrackingScreen();
    });

    // Post-tracking rating
    document.getElementById('postRatingSlider').addEventListener('input', function () {
        sessionState.ratingTouched = true;
        this.classList.remove('untouched');
        document.getElementById('postRatingValue').textContent = this.value;
        document.getElementById('postRatingValue').classList.remove('untouched');
        document.getElementById('postRatingDesc').textContent = RATING_DESCRIPTIONS[this.value];
    });

    document.getElementById('postNotes').addEventListener('input', function () {
        document.getElementById('postNotesCount').textContent = this.value.length;
    });

    document.getElementById('addBagBtn').addEventListener('click', addBag);

    document.querySelectorAll('input[name="postFeed"]').forEach(r => r.addEventListener('change', validateCollectionSubmit));
    document.querySelectorAll('input[name="photoConsent"]').forEach(r => r.addEventListener('change', validateCollectionSubmit));

    // Submit collection
    document.getElementById('submitCollectionBtn').addEventListener('click', async function () {
        this.disabled = true;
        this.textContent = 'Submitting...';

        const bagWeights = [];
        document.querySelectorAll('#bagsContainer .form-input').forEach(input => {
            const w = parseFloat(input.value) || 0;
            if (w > 0) bagWeights.push(w);
        });
        const totalWeight = bagWeights.reduce((sum, w) => sum + w, 0);

        if (totalWeight === 0) {
            showToast('Enter at least one bag weight', 'error');
            this.disabled = false;
            this.textContent = 'Submit Report';
            return;
        }

        const rating = sessionState.ratingTouched ? parseInt(document.getElementById('postRatingSlider').value) : null;
        const duration = Math.floor((Date.now() - sessionState.startTime) / 1000);

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'submitSession', token: sessionStorage.getItem('rh_token'), mode: 'collection',
                    sessionId: sessionState.sessionId,
                    userId: currentUser.userId, volunteerName: currentUser.handle, organization: currentUser.organization,
                    gpsPoints: sessionState.gpsPoints,
                    startLat: sessionState.gpsPoints[0]?.lat, startLon: sessionState.gpsPoints[0]?.lon,
                    endLat: sessionState.gpsPoints[sessionState.gpsPoints.length - 1]?.lat,
                    endLon: sessionState.gpsPoints[sessionState.gpsPoints.length - 1]?.lon,
                    rating: rating, notes: document.getElementById('postNotes').value.trim(),
                    weight: totalWeight, bagCount: bagWeights.length,
                    duration: duration, distance: sessionState.totalDistance,
                    photoCount: sessionState.photos.length,
                    activityFeedConsent: document.querySelector('input[name="postFeed"]:checked').value === 'yes',
                    photoConsent: sessionState.photos.length > 0 && document.querySelector('input[name="photoConsent"]:checked')?.value === 'yes',
                    timestamp: new Date().toISOString()
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                showToast('Collection submitted!', 'success');
                if (huntIntegration.fromHunt) {
                    setTimeout(() => { window.location.href = 'chimera-hunt.html?completed=collection&sessionId=' + sessionState.sessionId; }, 1500);
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
        this.textContent = 'Submit Report';
    });

    document.getElementById('cancelCollectionBtn').addEventListener('click', () => {
        if (confirm('Discard collection data?')) showMainScreen();
    });
}
