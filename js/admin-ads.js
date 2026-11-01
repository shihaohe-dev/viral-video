// Panel iklan (admin-ads.html)
import { supabase } from './config.js';
import { requireAdmin, signOut } from './auth.js';

// Hanya admin yang boleh membuka halaman ini
const auth = await requireAdmin();
if (!auth.ok) {
    window.location.replace('admin.html');
    await new Promise(() => {}); // hentikan eksekusi sambil menunggu redirect
}
document.getElementById('admin-panel').style.display = '';
window.logout = async () => {
    if (!confirm('Apakah Anda yakin ingin logout?')) return;
    await signOut();
    window.location.href = 'admin.html';
};

class AdminAdsManager {
    constructor() {
        this.ads = [];
        this.currentEditId = null;
        this.init();
    }

    async init() {
        await this.loadAds();
        this.setupEventListeners();
        this.updateStats();
    }

    async loadAds() {
        try {
            const { data: ads, error } = await supabase
                .from('ads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.ads = ads || [];
            this.displayAds();

        } catch (error) {
            console.error('Error loading ads:', error);
            this.showError('Gagal memuat data iklan');
        }
    }

    displayAds() {
        const tbody = document.getElementById('ads-table-body');
        if (!tbody) return;

        if (this.ads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">
                        <span class="no-data-icon">📭</span>
                        <p>Belum ada iklan</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.ads.map(ad => {
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00';
            
            return `
                <tr>
                    <td>
                        <div class="movie-title">${ad.ad_name}</div>
                    </td>
                    <td>
                        <span class="ad-platform-badge platform-${ad.platform}">
                            ${this.getPlatformName(ad.platform)}
                        </span>
                    </td>
                    <td>
                        <span class="ad-type-badge type-${ad.ad_type}">
                            ${ad.ad_type}
                        </span>
                    </td>
                    <td>${ad.position || '-'}</td>
                    <td>
                        <span class="status-${ad.is_active ? 'active' : 'inactive'}">
                            ${ad.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                    </td>
                    <td>${ad.impressions || 0}</td>
                    <td>${ad.clicks || 0}</td>
                    <td>${ctr}%</td>
                    <td>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="adminAds.editAd('${ad.id}')">
                                <span class="btn-icon">✏️</span> Edit
                            </button>
                            <button class="delete-btn" onclick="adminAds.deleteAd('${ad.id}')">
                                <span class="btn-icon">🗑️</span> Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getPlatformName(platform) {
        const platforms = {
            'adsterra': 'Adsterra',
            'rollerads': 'RollerAds',
            'google_adsense': 'Google Ads',
            'custom': 'Custom'
        };
        return platforms[platform] || platform;
    }

    updateStats() {
        const totalAds = this.ads.length;
        const activeAds = this.ads.filter(ad => ad.is_active).length;
        const totalImpressions = this.ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
        const totalClicks = this.ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);

        document.getElementById('total-ads').textContent = totalAds;
        document.getElementById('active-ads').textContent = activeAds;
        document.getElementById('total-impressions').textContent = totalImpressions;
        document.getElementById('total-clicks').textContent = totalClicks;
    }

    setupEventListeners() {
        // Add ad button
        document.getElementById('add-ad-btn').addEventListener('click', () => {
            this.openAdModal();
        });

        // Ad form submission
        document.getElementById('ad-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAd();
        });

        // Cancel button
        document.getElementById('cancel-ad-btn').addEventListener('click', () => {
            this.closeAdModal();
        });

        // Close modal
        document.querySelector('#ad-modal .close-modal').addEventListener('click', () => {
            this.closeAdModal();
        });

        // Search functionality
        document.getElementById('ads-search-btn').addEventListener('click', () => {
            this.handleSearch();
        });

        document.getElementById('ads-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Filters
        document.getElementById('platform-filter').addEventListener('change', () => {
            this.filterAds();
        });

        document.getElementById('status-filter').addEventListener('change', () => {
            this.filterAds();
        });
    }

    openAdModal(ad = null) {
        this.currentEditId = ad ? ad.id : null;
        const modal = document.getElementById('ad-modal');
        const title = document.getElementById('ad-modal-title');
        const form = document.getElementById('ad-form');

        if (ad) {
            title.textContent = '✏️ Edit Iklan';
            this.fillForm(ad);
        } else {
            title.textContent = '➕ Tambah Iklan Baru';
            form.reset();
        }

        modal.style.display = 'block';
    }

    fillForm(ad) {
        document.getElementById('ad-name').value = ad.ad_name;
        document.getElementById('ad-platform').value = ad.platform;
        document.getElementById('ad-type').value = ad.ad_type;
        document.getElementById('ad-position').value = ad.position || '';
        document.getElementById('ad-size').value = ad.ad_size || 'auto';
        document.getElementById('ad-code').value = ad.ad_code;
        document.getElementById('ad-status').value = ad.is_active.toString();
        
        if (ad.end_date) {
            const endDate = new Date(ad.end_date);
            document.getElementById('ad-end-date').value = endDate.toISOString().slice(0, 16);
        }
    }

    async saveAd() {
        const form = document.getElementById('ad-form');
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-btn');

        const adData = {
            ad_name: formData.get('ad_name'),
            platform: formData.get('platform'),
            ad_type: formData.get('ad_type'),
            position: formData.get('position') || null,
            ad_size: formData.get('ad_size'),
            ad_code: formData.get('ad_code'),
            is_active: formData.get('is_active') === 'true',
            end_date: formData.get('end_date') || null
        };

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Menyimpan...';

        try {
            let result;
            if (this.currentEditId) {
                result = await supabase
                    .from('ads')
                    .update(adData)
                    .eq('id', this.currentEditId);
            } else {
                result = await supabase
                    .from('ads')
                    .insert([adData]);
            }

            if (result.error) throw result.error;

            this.showNotification(
                `Iklan berhasil ${this.currentEditId ? 'diupdate' : 'ditambahkan'}!`, 
                'success'
            );
            
            this.closeAdModal();
            await this.loadAds();
            this.updateStats();

        } catch (error) {
            console.error('Error saving ad:', error);
            this.showNotification('Gagal menyimpan iklan', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="btn-icon">💾</span> Simpan Iklan';
        }
    }

    closeAdModal() {
        document.getElementById('ad-modal').style.display = 'none';
        this.currentEditId = null;
    }

    editAd(adId) {
        const ad = this.ads.find(a => a.id === adId);
        if (ad) {
            this.openAdModal(ad);
        }
    }

    async deleteAd(adId) {
        const ad = this.ads.find(a => a.id === adId);
        if (!ad) return;

        if (!confirm(`Apakah Anda yakin ingin menghapus iklan "${ad.ad_name}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('ads')
                .delete()
                .eq('id', adId);

            if (error) throw error;

            this.showNotification('Iklan berhasil dihapus!', 'success');
            await this.loadAds();
            this.updateStats();

        } catch (error) {
            console.error('Error deleting ad:', error);
            this.showNotification('Gagal menghapus iklan', 'error');
        }
    }

    handleSearch() {
        this.filterAds();
    }

    filterAds() {
        const searchTerm = document.getElementById('ads-search').value.toLowerCase();
        const platformFilter = document.getElementById('platform-filter').value;
        const statusFilter = document.getElementById('status-filter').value;

        let filteredAds = this.ads.filter(ad => {
            const matchesSearch = ad.ad_name.toLowerCase().includes(searchTerm);
            const matchesPlatform = platformFilter === 'all' || ad.platform === platformFilter;
            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === 'active' && ad.is_active) ||
                (statusFilter === 'inactive' && !ad.is_active);

            return matchesSearch && matchesPlatform && matchesStatus;
        });

        this.displayFilteredAds(filteredAds);
    }

    displayFilteredAds(ads) {
        const tbody = document.getElementById('ads-table-body');
        if (!tbody) return;

        if (ads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">
                        <span class="no-data-icon">🔍</span>
                        <p>Tidak ada iklan yang ditemukan</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ads.map(ad => {
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00';
            
            return `
                <tr>
                    <td>${ad.ad_name}</td>
                    <td>
                        <span class="ad-platform-badge platform-${ad.platform}">
                            ${this.getPlatformName(ad.platform)}
                        </span>
                    </td>
                    <td>
                        <span class="ad-type-badge type-${ad.ad_type}">
                            ${ad.ad_type}
                        </span>
                    </td>
                    <td>${ad.position || '-'}</td>
                    <td>
                        <span class="status-${ad.is_active ? 'active' : 'inactive'}">
                            ${ad.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                    </td>
                    <td>${ad.impressions || 0}</td>
                    <td>${ad.clicks || 0}</td>
                    <td>${ctr}%</td>
                    <td>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="adminAds.editAd('${ad.id}')">
                                <span class="btn-icon">✏️</span> Edit
                            </button>
                            <button class="delete-btn" onclick="adminAds.deleteAd('${ad.id}')">
                                <span class="btn-icon">🗑️</span> Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

// Initialize admin ads manager
const adminAds = new AdminAdsManager();
window.adminAds = adminAds;
