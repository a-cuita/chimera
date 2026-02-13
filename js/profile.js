// profile.js — Edit profile screen and address management

function showEditProfile() {
    hideAllScreens();
    document.getElementById('editProfileScreen').classList.remove('hidden');

    document.getElementById('editHandle').value = currentUser.handle;

    const orgSelect = document.getElementById('editOrgSelect');
    if (CONFIG.organizations.includes(currentUser.organization)) {
        orgSelect.value = currentUser.organization;
        document.getElementById('editCustomOrg').classList.remove('show');
    } else {
        orgSelect.value = 'other';
        document.getElementById('editCustomOrg').classList.add('show');
        document.getElementById('editCustomOrgText').value = currentUser.organization;
    }

    renderAddresses();
}

function renderAddresses() {
    const container = document.getElementById('addressesContainer');
    container.innerHTML = '';

    if (!currentUser.addresses || currentUser.addresses.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #9ca3af; font-size: 13px; padding: 20px;">No addresses saved</div>';
        return;
    }

    currentUser.addresses.forEach((addr, index) => {
        const card = document.createElement('div');
        card.className = 'address-card';
        card.innerHTML = `
            <div class="address-card-header">
                <span class="address-type-badge">${addr.type || 'Home'}</span>
                <div class="address-actions">
                    <span class="address-action" onclick="editAddress(${index})">Edit</span>
                    <span class="address-action delete" onclick="deleteAddress(${index})">Delete</span>
                </div>
            </div>
            <div class="address-text">
                ${addr.street || ''}${addr.street && addr.neighborhood ? ', ' : ''}${addr.neighborhood || ''}${(addr.street || addr.neighborhood) && addr.zip ? ' ' : ''}${addr.zip || ''}
            </div>
        `;
        container.appendChild(card);
    });
}

window.editAddress = function (index) {
    const addr = currentUser.addresses[index];
    document.getElementById('newAddressType').value = addr.type || 'Home';
    document.getElementById('newAddressStreet').value = addr.street || '';
    document.getElementById('newAddressNeighborhood').value = addr.neighborhood || '';
    document.getElementById('newAddressZip').value = addr.zip || '';

    currentUser.addresses.splice(index, 1);
    renderAddresses();
    document.getElementById('addAddressModal').classList.add('show');
};

window.deleteAddress = function (index) {
    if (confirm('Delete this address?')) {
        currentUser.addresses.splice(index, 1);
        renderAddresses();
    }
};

function initProfile() {
    document.getElementById('editOrgSelect').addEventListener('change', function () {
        document.getElementById('editCustomOrg').classList.toggle('show', this.value === 'other');
    });

    // Add address
    document.getElementById('addAddressBtn').addEventListener('click', () => {
        document.getElementById('newAddressType').value = 'Home';
        document.getElementById('newAddressStreet').value = '';
        document.getElementById('newAddressNeighborhood').value = '';
        document.getElementById('newAddressZip').value = '';
        document.getElementById('addAddressModal').classList.add('show');
    });

    document.getElementById('cancelNewAddress').addEventListener('click', () => {
        document.getElementById('addAddressModal').classList.remove('show');
    });

    document.getElementById('saveNewAddress').addEventListener('click', () => {
        const newAddr = {
            type: document.getElementById('newAddressType').value,
            street: document.getElementById('newAddressStreet').value.trim(),
            neighborhood: document.getElementById('newAddressNeighborhood').value.trim(),
            zip: document.getElementById('newAddressZip').value.trim()
        };

        if (!newAddr.street && !newAddr.neighborhood && !newAddr.zip) {
            showToast('Enter at least one field', 'error');
            return;
        }

        if (!currentUser.addresses) currentUser.addresses = [];
        currentUser.addresses.push(newAddr);
        renderAddresses();
        document.getElementById('addAddressModal').classList.remove('show');
        showToast('Address added', 'success');
    });

    // Save profile
    document.getElementById('saveProfileBtn').addEventListener('click', async function () {
        this.disabled = true;
        this.textContent = 'Saving...';

        const org = document.getElementById('editOrgSelect').value === 'other'
            ? document.getElementById('editCustomOrgText').value.trim()
            : document.getElementById('editOrgSelect').value;

        try {
            await fetch(CONFIG.appsScriptUrl, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updateProfile', token: sessionStorage.getItem('rh_token'), userId: currentUser.userId,
                    organization: org, addresses: currentUser.addresses
                })
            });

            currentUser.organization = org;
            saveSession();
            showToast('Profile updated!', 'success');
            setTimeout(() => showMainScreen(), 1000);
        } catch (error) {
            console.error('Profile update error:', error);
            showToast('Update failed', 'error');
        }

        this.disabled = false;
        this.textContent = 'Save Changes';
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => showMainScreen());
}
