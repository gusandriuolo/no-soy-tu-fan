// Instagram Unfollowers Tracker - Popup Logic (Vanilla JS)

class PopupApp {
    constructor() {
        this.state = {
            status: 'idle', // idle, analyzing, done, error
            nonFollowers: [],
            stats: { total: 0, nonFollowers: 0, percentage: 0 },
            progress: 0,
            message: '',
            filter: { showVerified: true, showPrivate: true, showWithoutPic: true },
            searchTerm: '',
            whitelist: [],
            currentTab: 'all'
        };
        this.appElement = document.getElementById('app');
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupMessageListener();
        this.render();
    }

    loadSavedData() {
        chrome.storage.local.get(['nonFollowers', 'whitelist', 'lastStats'], (result) => {
            if (result.nonFollowers) {
                this.state.nonFollowers = result.nonFollowers;
                this.state.stats = {
                    nonFollowers: result.nonFollowers.length,
                    totalFollowing: result.lastStats?.totalFollowing || 0,
                    percentage: result.lastStats?.percentage || 0
                };
                // Si hay datos guardados, mostrar como completado
                if (result.nonFollowers.length >= 0) {
                    this.state.status = 'done';
                }
            }
            if (result.whitelist) {
                this.state.whitelist = result.whitelist;
            }
            this.render();
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateProgress') {
                this.state.progress = request.progress;
                this.state.message = request.message;
                this.render();
            } else if (request.action === 'analysisComplete') {
                this.state.status = 'done';
                this.state.nonFollowers = request.nonFollowers;
                this.state.stats = {
                    nonFollowers: request.nonFollowers.length,
                    totalFollowing: request.stats.totalFollowing || 0,
                    percentage: request.stats.percentage || 0
                };
                this.state.message = '✅ Análisis completado';
                chrome.storage.local.set({ nonFollowers: request.nonFollowers });
                this.render();
            } else if (request.action === 'analysisError') {
                this.state.status = 'error';
                this.state.message = request.error;
                this.render();
            }
        });
    }

    startAnalysis = () => {
        console.log('[POPUP] startAnalysis called');
        this.state.status = 'analyzing';
        this.state.progress = 0;
        this.state.message = 'Obteniendo datos...';
        this.render();
        console.log('[POPUP] Enviando mensaje al background...');
        chrome.runtime.sendMessage({ action: 'startAnalysis' }, (response) => {
            console.log('[POPUP] Response:', response);
        }).catch(e => {
            console.log('[POPUP] Error:', e);
        });
    }

    addToWhitelist = (user) => {
        const exists = this.state.whitelist.some(u => u.id === user.id);
        if (!exists) {
            this.state.whitelist.push(user);
            chrome.storage.local.set({ whitelist: this.state.whitelist });
            this.render();
        }
    }

    removeFromWhitelist = (userId) => {
        this.state.whitelist = this.state.whitelist.filter(u => u.id !== userId);
        chrome.storage.local.set({ whitelist: this.state.whitelist });
        this.render();
    }

    getFilteredUsers() {
        const whitelistedIds = new Set(this.state.whitelist.map(u => u.id));
        return this.state.nonFollowers.filter(user => {
            if (this.state.currentTab === 'whitelist') {
                return whitelistedIds.has(user.id);
            }

            if (!this.state.filter.showVerified && user.is_verified) return false;
            if (!this.state.filter.showPrivate && user.is_private) return false;
            if (!this.state.filter.showWithoutPic && !user.profile_pic_url) return false;

            if (this.state.searchTerm) {
                const term = this.state.searchTerm.toLowerCase();
                return user.username.toLowerCase().includes(term) ||
                       user.full_name.toLowerCase().includes(term);
            }

            if (whitelistedIds.has(user.id) && this.state.currentTab !== 'whitelist') {
                return false;
            }

            return true;
        });
    }

    exportJSON = () => {
        const filtered = this.getFilteredUsers();
        const json = JSON.stringify(filtered, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this.downloadFile(blob, `unfollowers_${new Date().toISOString().split('T')[0]}.json`);
    }

    exportCSV = () => {
        const filtered = this.getFilteredUsers();
        let csv = 'username,full_name,is_verified,is_private\n';
        filtered.forEach(user => {
            csv += `"${user.username}","${user.full_name}","${user.is_verified}","${user.is_private}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadFile(blob, `unfollowers_${new Date().toISOString().split('T')[0]}.csv`);
    }

    copyToClipboard = () => {
        const filtered = this.getFilteredUsers();
        const text = filtered.map(u => u.username).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert(`✅ ${filtered.length} usernames copiados`);
        });
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    renderIdleState() {
        return `
            <div class="header">
                <h1>👋 No soy tu Fan</h1>
                <p>Descubre quién no te sigue</p>
            </div>
            <div class="content" style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <button id="btn-start-analysis" class="btn btn-primary" style="width: auto; padding: 16px 32px; font-size: 16px;">
                    ▶️ ANALIZAR AHORA
                </button>
                <p style="color: #888; margin-top: 16px; font-size: 12px;">⏱️ Toma algunos minutos según tus seguidores</p>
            </div>
        `;
    }

    attachIdleStateListeners() {
        const btn = document.getElementById('btn-start-analysis');
        if (btn) {
            btn.addEventListener('click', () => this.startAnalysis());
        }
    }

    renderAnalyzingState() {
        return `
            <div class="header">
                <h1>👋 No soy tu Fan</h1>
                <p>Analizando...</p>
            </div>
            <div class="content loading">
                <div class="spinner"></div>
                <p style="font-weight: bold; margin-bottom: 4px;">${this.state.message}</p>
                <p style="color: #0095f6; font-size: 28px; margin-bottom: 16px; font-weight: bold;">${this.state.progress}%</p>
                <div style="width: 100%; height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin-bottom: 16px;">
                    <div style="width: ${this.state.progress}%; height: 100%; background: linear-gradient(90deg, #0095f6, #00d4ff); transition: width 0.3s;"></div>
                </div>
                <p style="color: #888; font-size: 12px;">Esto puede tomar unos minutos...</p>
            </div>
        `;
    }

    renderErrorState() {
        return `
            <div class="header">
                <h1>📊 Unfollowers</h1>
            </div>
            <div class="content">
                <div class="error">❌ Error: ${this.state.message}</div>
                <button class="btn btn-primary">
                    Intentar nuevamente
                </button>
            </div>
        `;
    }

    renderResultsState() {
        const filtered = this.getFilteredUsers();
        const whitelistedIds = new Set(this.state.whitelist.map(u => u.id));

        const usersList = filtered.length === 0
            ? '<div class="empty">✅ No hay resultados</div>'
            : filtered.map(user => `
                <div class="user-item">
                    ${user.profile_pic_url ? `<img src="${user.profile_pic_url}" alt="${user.username}" class="user-pic" crossorigin="anonymous">` : '<div class="user-pic-placeholder">👤</div>'}
                    <div class="user-info">
                        <a href="https://instagram.com/${user.username}" target="_blank" rel="noopener noreferrer" class="username">@${user.username}</a>
                        <div class="fullname">${user.full_name}</div>
                        <div class="badges">
                            ${user.is_verified ? '<span class="badge badge-verified">✔️ Verificado</span>' : ''}
                            ${user.is_private ? '<span class="badge badge-private">🔒 Privado</span>' : ''}
                        </div>
                    </div>
                    <button class="btn btn-star ${whitelistedIds.has(user.id) ? 'active' : ''}"
                        data-user-id="${user.id}">
                        ${whitelistedIds.has(user.id) ? '★' : '☆'}
                    </button>
                </div>
            `).join('');

        return `
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 12px;">
                    <h1 style="margin-bottom: 0;"><span style="-webkit-text-fill-color: #fff; background: none; color: #fff;">👋</span> No soy tu Fan</h1>
                    <button id="btn-new-analysis" class="btn btn-secondary" style="font-size: 12px; padding: 8px 14px;">🔄 Nuevo Análisis</button>
                </div>
                <div class="stats-header">
                    <div class="stat-header-item">
                        <span class="stat-header-number">${this.state.stats.nonFollowers}</span>
                        <span class="stat-header-label">No te siguen</span>
                    </div>
                    <div class="stat-header-item">
                        <span class="stat-header-number">${this.state.stats.percentage}%</span>
                        <span class="stat-header-label">de ${this.state.stats.totalFollowing}</span>
                    </div>
                </div>
            </div>
            <div class="content">
                <input type="text" class="search-box" placeholder="🔍 Buscar usuario..."
                    value="${this.state.searchTerm}">

                <div class="tabs">
                    <button class="tab-btn ${this.state.currentTab === 'all' ? 'active' : ''}">
                        Todos (${filtered.length})
                    </button>
                    <button class="tab-btn ${this.state.currentTab === 'whitelist' ? 'active' : ''}">
                        ⭐ Guardados (${this.state.whitelist.length})
                    </button>
                </div>

                <div class="filters">
                    <label class="filter-label">
                        <input type="checkbox" ${this.state.filter.showVerified ? 'checked' : ''}>
                        ✓ Verificados
                    </label>
                    <label class="filter-label">
                        <input type="checkbox" ${this.state.filter.showPrivate ? 'checked' : ''}>
                        🔒 Privados
                    </label>
                    <label class="filter-label">
                        <input type="checkbox" ${this.state.filter.showWithoutPic ? 'checked' : ''}>
                        📸 Con foto
                    </label>
                </div>

                <div class="action-buttons">
                    <button class="btn btn-secondary">📋 Copiar</button>
                    <button class="btn btn-secondary">📄 JSON</button>
                    <button class="btn btn-secondary">📊 CSV</button>
                </div>

                <div class="users-container">
                    ${usersList}
                </div>
            </div>
        `;
    }

    attachResultsStateListeners() {
        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.textContent.includes('Whitelist') ? 'whitelist' : 'all';
                this.state.currentTab = tab;
                this.state.searchTerm = '';
                this.render();
            });
        });

        // Filter checkboxes
        document.querySelectorAll('.filter-label input').forEach((input, idx) => {
            input.addEventListener('change', (e) => {
                const filters = ['showVerified', 'showPrivate', 'showWithoutPic'];
                this.state.filter[filters[idx]] = e.target.checked;
                this.render();
            });
        });

        // Search input
        const searchInput = document.querySelector('.search-box');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                this.state.searchTerm = e.target.value;
                this.render();
            });
        }

        // Action buttons
        document.querySelectorAll('.action-buttons button').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                if (idx === 0) this.copyToClipboard();
                else if (idx === 1) this.exportJSON();
                else if (idx === 2) this.exportCSV();
            });
        });

        // User star buttons
        document.querySelectorAll('.btn-star').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = btn.getAttribute('data-user-id');
                const user = this.state.nonFollowers.find(u => u.id === userId);
                const isWhitelisted = this.state.whitelist.some(u => u.id === userId);

                if (isWhitelisted) {
                    this.removeFromWhitelist(userId);
                } else if (user) {
                    this.addToWhitelist(user);
                }
            });
        });

        // New analysis button
        const resetBtn = document.getElementById('btn-new-analysis');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.state.status = 'idle';
                this.state.nonFollowers = [];
                this.state.stats = { total: 0, nonFollowers: 0, percentage: 0, totalFollowing: 0 };
                chrome.storage.local.remove(['nonFollowers']);
                this.render();
            });
        }
    }

    attachErrorStateListeners() {
        const btn = document.querySelector('.content button');
        if (btn) {
            btn.addEventListener('click', () => {
                this.state.status = 'idle';
                this.render();
            });
        }
    }

    render() {
        let html = '';

        if (this.state.status === 'idle' && this.state.nonFollowers.length === 0) {
            html = this.renderIdleState();
        } else if (this.state.status === 'analyzing') {
            html = this.renderAnalyzingState();
        } else if (this.state.status === 'error') {
            html = this.renderErrorState();
        } else {
            html = this.renderResultsState();
        }

        this.appElement.innerHTML = html;

        // Attach event listeners después de renderizar
        if (this.state.status === 'idle' && this.state.nonFollowers.length === 0) {
            this.attachIdleStateListeners();
        } else if (this.state.status === 'error') {
            this.attachErrorStateListeners();
        } else if (this.state.status === 'done' || this.state.nonFollowers.length > 0) {
            this.attachResultsStateListeners();
        }
    }
}

// Hacer app global para onclick handlers
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PopupApp();
});
