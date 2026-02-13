// feed.js — Activity feed loading and rendering

async function loadActivityFeed(isLoggedIn = true) {
    const scrollId = isLoggedIn ? 'feedScroll' : 'preLoginFeedScroll';
    const feedScroll = document.getElementById(scrollId);

    try {
        const [feedResponse, bannersResponse] = await Promise.all([
            fetch(CONFIG.appsScriptUrl + '?action=getActivityFeed'),
            fetch(CONFIG.appsScriptUrl + '?action=get_active_banners')
        ]);

        const result = await feedResponse.json();
        let bannersResult = { banners: [] };
        try { bannersResult = await bannersResponse.json(); } catch (e) { /* ignore */ }

        if (result.status !== 'success') {
            feedScroll.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 40px;">Failed to load</div>';
            return;
        }

        const data = result.data;
        let html = '';

        // Banners
        if (bannersResult.status === 'success' && bannersResult.banners && bannersResult.banners.length > 0) {
            const bannerIcons = { info: 'ℹ️', success: '🎉', warning: '⚠️', event: '📅' };
            bannersResult.banners.forEach(banner => {
                const icon = bannerIcons[banner.bannerType] || 'ℹ️';
                const type = banner.bannerType || 'info';
                html += `<div class="feed-banner ${type}">
                    <span class="feed-banner-icon">${icon}</span>
                    <span class="feed-banner-text">${banner.message}</span>
                </div>`;
            });
        }

        // Sticky: Awaiting Validation
        if (data.unvalidatedScouts > 0) {
            const sinceTime = data.oldestUnvalidated ? new Date(data.oldestUnvalidated) : new Date();
            const timeStr = isLoggedIn ? formatRelativeTime(sinceTime) : 'Since earlier today';
            const tpl = data.stickyTemplates || {};
            const headerText = (tpl.unvalidated_header || '')
                .replace('{count}', data.unvalidatedScouts)
                .replace('{s}', data.unvalidatedScouts !== 1 ? 's' : '');
            const detailText = (tpl.unvalidated_detail || '').replace('{time}', timeStr);

            if (headerText) {
                html += `<div class="feed-sticky-item">
                    <div class="feed-sticky-header"><span>⏳</span> ${headerText}</div>
                    ${detailText ? `<div class="feed-sticky-detail">${detailText}</div>` : ''}
                </div>`;
            }
        }

        // Sticky: Daily Accuracy
        if (data.dailyAccuracy !== undefined && data.dailyAccuracy !== null) {
            const tpl = data.stickyTemplates || {};
            const headerText = tpl.accuracy_header || '';
            const valueText = (tpl.accuracy_value || '').replace('{accuracy}', data.dailyAccuracy);
            const detailText = (tpl.accuracy_detail || '')
                .replace('{validated}', data.validatedToday || 0)
                .replace('{total}', data.scoutsToday || 0);

            if (headerText && valueText) {
                html += `<div class="feed-sticky-item accuracy">
                    <div class="feed-sticky-header"><span>📊</span> ${headerText}</div>
                    <div class="accuracy-value">${valueText}</div>
                    ${detailText ? `<div class="feed-sticky-detail">${detailText}</div>` : ''}
                </div>`;
            }
        }

        // Activity items
        if (!data.recentActivity || data.recentActivity.length === 0) {
            html += '<div style="text-align: center; color: #9ca3af; padding: 40px;">No recent activity</div>';
        } else {
            data.recentActivity.forEach(activity => {
                const time = new Date(activity.timestamp);
                const timeStr = isLoggedIn ? formatTimeShort(time) : formatTimeVague(time);
                const name = isLoggedIn ? activity.volunteer : 'Volunteer';
                const zoneBadge = activity.zoneName ? `<span class="district-badge">${activity.zoneName}</span>` : '';

                // Coordinator posts
                if (activity.type === 'coordinator_post') {
                    html += `<div class="activity-item" style="border-left: 3px solid #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);">
                        <div class="activity-header">
                            <span class="activity-icon">📢</span>
                            <span class="activity-text" style="color: #92400e; font-weight: 500;">${activity.generatedText || 'Event update'}</span>
                        </div>
                        <div style="font-size: 11px; color: #b45309; margin-top: 4px;">${timeStr}</div>
                    </div>`;
                    return;
                }

                // Skip scouts — they appear only when validated via collections
                if (activity.type === 'scout') return;

                // Collections
                if (activity.type !== 'collection') return;

                html += `<div class="activity-item">
                    <div class="activity-header">
                        <span class="activity-icon">🗑️</span>
                        <span class="activity-text">${name} collected ${activity.weight.toFixed(1)} lbs${activity.sqrtCpue ? ` (√CPUE: ${activity.sqrtCpue.toFixed(2)})` : ''} ${timeStr}</span>
                        ${zoneBadge}
                    </div>`;

                // Validation box
                const val = activity.validation || { accurate: [], close: [], off: [] };
                const totalValidated = val.accurate.length + val.close.length + val.off.length;

                if (totalValidated > 0) {
                    html += `<div class="validation-box">
                        <div class="validation-header">👀 SCOUT RATINGS VALIDATED</div>`;
                    if (isLoggedIn) {
                        if (val.accurate.length > 0) html += `<div class="validation-line spot-on"><strong>Spot on:</strong> ${val.accurate.join(', ')}</div>`;
                        if (val.close.length > 0) html += `<div class="validation-line under"><strong>Under:</strong> ${val.close.join(', ')}</div>`;
                        if (val.off.length > 0) html += `<div class="validation-line over"><strong>Over:</strong> ${val.off.join(', ')}</div>`;
                    } else {
                        const parts = [];
                        if (val.accurate.length > 0) parts.push(`${val.accurate.length} spot on`);
                        if (val.close.length > 0) parts.push(`${val.close.length} under`);
                        if (val.off.length > 0) parts.push(`${val.off.length} over`);
                        html += `<div class="validation-line">${parts.join(', ')}</div>`;
                    }
                    html += `</div>`;
                } else {
                    html += `<div class="no-validation">No scouts validated</div>`;
                }

                html += `</div>`;
            });
        }

        feedScroll.innerHTML = html;
    } catch (error) {
        console.error('Activity feed error:', error);
        feedScroll.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 40px;">Failed to load</div>';
    }
}
