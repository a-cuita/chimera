// recycling.js — Household recycling logging

function showRecycleScreen() {
    hideAllScreens();
    document.getElementById('recycleScreen').classList.remove('hidden');
    resetRecycleForm();
}

function resetRecycleForm() {
    document.getElementById('hrMaterialType').value = '';
    document.getElementById('hrDescription').value = '';
    document.getElementById('hrDescriptionWrap').classList.add('hidden');
    document.getElementById('hrWeight').value = '';
    document.getElementById('hrDateBagged').value = '';
    document.getElementById('hrDestination').value = '';
    document.getElementById('hrDestOther').value = '';
    document.getElementById('hrDestOtherWrap').classList.remove('show');
    document.getElementById('submitHRBtn').disabled = true;
}

function validateRecycleForm() {
    const material = document.getElementById('hrMaterialType').value;
    const needsDesc = material === 'Mixed' || material === 'Other';
    const descOk = !needsDesc || document.getElementById('hrDescription').value.trim() !== '';
    const weightOk = parseFloat(document.getElementById('hrWeight').value) > 0;
    const dateOk = document.getElementById('hrDateBagged').value !== '';
    const destOk = document.getElementById('hrDestination').value !== '';
    document.getElementById('submitHRBtn').disabled = !(material && descOk && weightOk && dateOk && destOk);
}

function initRecycling() {
    document.getElementById('hrInfoToggle').addEventListener('click', () => {
        document.getElementById('hrInfoPane').classList.toggle('show');
    });
    document.getElementById('dropoffToggle').addEventListener('click', () => {
        document.getElementById('dropoffPane').classList.toggle('show');
    });

    document.getElementById('hrMaterialType').addEventListener('change', function () {
        const needsDesc = this.value === 'Mixed' || this.value === 'Other';
        document.getElementById('hrDescriptionWrap').classList.toggle('hidden', !needsDesc);
        if (!needsDesc) document.getElementById('hrDescription').value = '';
        validateRecycleForm();
    });

    document.getElementById('hrDestination').addEventListener('change', function () {
        document.getElementById('hrDestOtherWrap').classList.toggle('show', this.value === 'Other');
        validateRecycleForm();
    });

    ['hrMaterialType', 'hrDescription', 'hrWeight', 'hrDateBagged', 'hrDestination', 'hrDestOther'].forEach(id => {
        document.getElementById(id).addEventListener('input', validateRecycleForm);
        document.getElementById(id).addEventListener('change', validateRecycleForm);
    });

    document.getElementById('submitHRBtn').addEventListener('click', async function () {
        this.disabled = true;
        this.textContent = 'Submitting...';

        const material = document.getElementById('hrMaterialType').value;
        let materialDesc = material;
        if (material === 'Mixed' || material === 'Other') {
            materialDesc += ': ' + document.getElementById('hrDescription').value.trim();
        }

        try {
            await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'submitHousehold', token: sessionStorage.getItem('rh_token'), userId: currentUser.userId,
                    materialType: materialDesc,
                    weightLbs: parseFloat(document.getElementById('hrWeight').value),
                    dateBagged: document.getElementById('hrDateBagged').value,
                    destination: document.getElementById('hrDestination').value,
                    destinationOther: document.getElementById('hrDestOther').value.trim()
                })
            });

            showToast('Recycling logged!', 'success');
            setTimeout(() => showMainScreen(), 1500);
        } catch (error) {
            console.error('HR submit error:', error);
            showToast('Submission failed', 'error');
        }

        this.disabled = false;
        this.textContent = 'Submit Recycling Log';
    });

    document.getElementById('cancelHRBtn').addEventListener('click', () => showMainScreen());
}
