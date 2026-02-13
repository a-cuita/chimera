// auth.js — Session persistence, login, profile creation, password upgrade

// ==================== SESSION STORAGE ====================

function restoreSession() {
    const saved = sessionStorage.getItem('chimera_user');
    if (saved && sessionStorage.getItem('rh_token')) {
        try { currentUser = JSON.parse(saved); return true; }
        catch (e) { return false; }
    }
    return false;
}

function saveSession() {
    sessionStorage.setItem('chimera_user', JSON.stringify(currentUser));
}

function clearSession() {
    currentUser = {
        userId: null, handle: null, organization: null,
        addresses: [], safetyLegalAccepted: false, lastSafetyLegalCheck: null
    };
    sessionStorage.removeItem('chimera_user');
    sessionStorage.removeItem('rh_token');
    sessionStorage.removeItem('rh_role');
}

// ==================== PASSWORD UPGRADE ====================

function showPasswordUpgradeModal() {
    document.getElementById('passwordUpgradeOverlay').classList.add('show');
    document.getElementById('upgradeNewPassword').value = '';
    document.getElementById('upgradeConfirmPassword').value = '';
    document.getElementById('upgradePasswordBtn').disabled = true;
    document.getElementById('upgradePasswordError').textContent = '';
}

function validateUpgradePasswords() {
    const pw = document.getElementById('upgradeNewPassword').value;
    const confirm = document.getElementById('upgradeConfirmPassword').value;
    const errorEl = document.getElementById('upgradePasswordError');
    const btn = document.getElementById('upgradePasswordBtn');

    if (pw.length > 0 && pw.length < 8) {
        errorEl.textContent = 'Password must be at least 8 characters';
        btn.disabled = true;
    } else if (confirm.length > 0 && pw !== confirm) {
        errorEl.textContent = 'Passwords don\'t match';
        btn.disabled = true;
    } else {
        errorEl.textContent = '';
        btn.disabled = !(pw.length >= 8 && pw === confirm);
    }
}

async function submitPasswordUpgrade() {
    const pw = document.getElementById('upgradeNewPassword').value;
    const confirm = document.getElementById('upgradeConfirmPassword').value;
    const btn = document.getElementById('upgradePasswordBtn');

    if (pw !== confirm || pw.length < 8) return;

    btn.disabled = true;
    btn.textContent = 'Upgrading...';

    try {
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'upgradePassword',
                token: sessionStorage.getItem('rh_token'),
                userId: currentUser.userId,
                newPassword: pw
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast('Password upgraded!', 'success');
            document.getElementById('passwordUpgradeOverlay').classList.remove('show');
        } else {
            showToast(result.message || 'Upgrade failed', 'error');
        }
    } catch (error) {
        console.error('Password upgrade error:', error);
        showToast('Connection error', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Set New Password';
}

// ==================== LOGIN / CREATE BINDINGS ====================

function initAuth() {
    const loginHandle = document.getElementById('loginHandle');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const createHandle = document.getElementById('createHandle');
    const createPassword = document.getElementById('createPassword');
    const createOrgSelect = document.getElementById('createOrgSelect');
    const createCustomOrgText = document.getElementById('createCustomOrgText');
    const createProfileBtn = document.getElementById('createProfileBtn');

    // Toggle between login / create
    document.getElementById('showCreateToggle').addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('createForm').classList.remove('hidden');
    });
    document.getElementById('showLoginToggle').addEventListener('click', () => {
        document.getElementById('createForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });

    // Validation
    function validateLogin() {
        loginBtn.disabled = !(loginHandle.value.trim().length >= 2 && loginPassword.value.length >= 4);
    }

    function validateCreate() {
        const handleOk = createHandle.value.trim().length >= 2;
        const passwordOk = PASSWORD_REGEX.test(createPassword.value);
        const orgOk = createOrgSelect.value !== '' &&
                      (createOrgSelect.value !== 'other' || createCustomOrgText.value.trim() !== '');
        createProfileBtn.disabled = !(handleOk && passwordOk && orgOk);
    }

    loginHandle.addEventListener('input', validateLogin);
    loginPassword.addEventListener('input', validateLogin);
    createHandle.addEventListener('input', validateCreate);
    createPassword.addEventListener('input', validateCreate);
    createOrgSelect.addEventListener('change', function () {
        document.getElementById('createCustomOrg').classList.toggle('show', this.value === 'other');
        validateCreate();
    });
    createCustomOrgText.addEventListener('input', validateCreate);

    // Password upgrade modal listeners
    document.getElementById('upgradeNewPassword')?.addEventListener('input', validateUpgradePasswords);
    document.getElementById('upgradeConfirmPassword')?.addEventListener('input', validateUpgradePasswords);
    document.getElementById('upgradePasswordBtn')?.addEventListener('click', submitPasswordUpgrade);
    document.getElementById('upgradeSkipBtn')?.addEventListener('click', function() {
        document.getElementById('passwordUpgradeOverlay').classList.remove('show');
    });

    // Login
    loginBtn.addEventListener('click', async function () {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'login', handle: loginHandle.value.trim(), password: loginPassword.value })
            });
            const result = await response.json();

            if (result.status === 'success') {
                sessionStorage.setItem('rh_token', result.token);
                sessionStorage.setItem('rh_role', result.role);
                currentUser = {
                    userId: result.userId, handle: result.handle, organization: result.organization,
                    addresses: result.addresses || [],
                    safetyLegalAccepted: result.safetyLegalAccepted || false,
                    lastSafetyLegalCheck: result.lastSafetyLegalCheck || null,
                    overrides: result.overrides || []
                };
                saveSession();
                enterApp();
                initAdminTab();

                if (result.passwordUpgradeRequired) {
                    showPasswordUpgradeModal();
                }
            } else {
                showToast(result.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Connection error', 'error');
        }

        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
    });

    // Create Profile
    createProfileBtn.addEventListener('click', async function () {
        createProfileBtn.disabled = true;
        createProfileBtn.textContent = 'Creating...';

        const org = createOrgSelect.value === 'other' ? createCustomOrgText.value.trim() : createOrgSelect.value;

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'createProfile', handle: createHandle.value.trim(), password: createPassword.value, organization: org })
            });
            const result = await response.json();

            if (result.status === 'success') {
                currentUser = {
                    userId: result.userId, handle: result.handle, organization: org,
                    addresses: [], safetyLegalAccepted: false, lastSafetyLegalCheck: null,
                    overrides: []
                };
                saveSession();
                showToast('Profile created!', 'success');
                enterApp();
            } else {
                showToast(result.message || 'Creation failed', 'error');
            }
        } catch (error) {
            console.error('Create error:', error);
            showToast('Connection error', 'error');
        }

        createProfileBtn.disabled = false;
        createProfileBtn.textContent = 'Create Profile';
    });
}
