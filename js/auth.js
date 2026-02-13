// auth.js — Session persistence, login, profile creation

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

// ==================== LOGIN / CREATE BINDINGS ====================

function initAuth() {
    const loginHandle = document.getElementById('loginHandle');
    const loginPIN = document.getElementById('loginPIN');
    const loginBtn = document.getElementById('loginBtn');
    const createHandle = document.getElementById('createHandle');
    const createPIN = document.getElementById('createPIN');
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
        loginBtn.disabled = !(loginHandle.value.trim().length >= 2 && PIN_REGEX.test(loginPIN.value.trim()));
    }

    function validateCreate() {
        const handleOk = createHandle.value.trim().length >= 2;
        const pinOk = PIN_REGEX.test(createPIN.value.trim());
        const orgOk = createOrgSelect.value !== '' &&
                      (createOrgSelect.value !== 'other' || createCustomOrgText.value.trim() !== '');
        createProfileBtn.disabled = !(handleOk && pinOk && orgOk);
    }

    loginHandle.addEventListener('input', validateLogin);
    loginPIN.addEventListener('input', validateLogin);
    createHandle.addEventListener('input', validateCreate);
    createPIN.addEventListener('input', validateCreate);
    createOrgSelect.addEventListener('change', function () {
        document.getElementById('createCustomOrg').classList.toggle('show', this.value === 'other');
        validateCreate();
    });
    createCustomOrgText.addEventListener('input', validateCreate);

    // Login
    loginBtn.addEventListener('click', async function () {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'login', handle: loginHandle.value.trim(), pin: loginPIN.value.trim().toLowerCase() })
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
                body: JSON.stringify({ action: 'createProfile', handle: createHandle.value.trim(), pin: createPIN.value.trim().toLowerCase(), organization: org })
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
