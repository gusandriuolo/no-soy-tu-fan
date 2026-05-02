// No soy tu Fan — Popup Logic

class PopupApp {
    constructor() {
        this.state = {
            status: 'idle',       // idle | analyzing | done | error
            isScanning: false,    // true mientras el scan sigue aunque ya haya resultados
            nonFollowers: [],
            stats: { nonFollowers: 0, totalFollowing: 0, percentage: 0 },
            progress: 0,
            message: '',
            scanMessage: '',
            filter: { showVerified: true, showPrivate: true, showWithoutPic: true },
            searchTerm: '',
            whitelist: [],
            currentTab: 'all'
        };
        this.app = document.getElementById('app');
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupMessages();
    }

    loadSavedData() {
        chrome.storage.local.get(['nonFollowers', 'whitelist', 'lastStats'], (result) => {
            if (result.nonFollowers && result.nonFollowers.length >= 0) {
                this.state.nonFollowers = result.nonFollowers;
                this.state.stats = {
                    nonFollowers: result.nonFollowers.length,
                    totalFollowing: result.lastStats?.totalFollowing || 0,
                    percentage: result.lastStats?.percentage || 0
                };
                this.state.status = 'done';
            }
            if (result.whitelist) this.state.whitelist = result.whitelist;
            this.render();
        });
    }

    setupMessages() {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.action === 'updateProgress') {
                this.state.progress = msg.progress;
                this.state.message = msg.message;
                this.render();

            } else if (msg.action === 'partialUpdate') {
                // Resultados parciales: mostrar lista pero con banner de "buscando"
                this.state.isScanning = true;
                this.state.progress = msg.progress;
                this.state.scanMessage = msg.message;
                this.state.nonFollowers = msg.partialResults || [];
                this.state.stats = msg.stats || this.state.stats;
                if (this.state.status === 'idle' || this.state.status === 'analyzing') {
                    this.state.status = 'done'; // mostrar resultados
                }
                this.render();

            } else if (msg.action === 'analysisComplete') {
                // Scan finalizado de verdad
                this.state.isScanning = false;
                this.state.status = 'done';
                this.state.nonFollowers = msg.nonFollowers || [];
                this.state.stats = {
                    nonFollowers: msg.nonFollowers?.length || 0,
                    totalFollowing: msg.stats?.totalFollowing || 0,
                    percentage: msg.stats?.percentage || 0
                };
                chrome.storage.local.set({ nonFollowers: msg.nonFollowers });
                this.render();

            } else if (msg.action === 'analysisError') {
                this.state.isScanning = false;
                this.state.status = 'error';
                this.state.message = msg.error;
                this.render();
            }
        });
    }

    startAnalysis() {
        this.state.status = 'analyzing';
        this.state.isScanning = true;
        this.state.progress = 0;
        this.state.message = 'Conectando con Instagram...';
        this.render();
        chrome.runtime.sendMessage({ action: 'startAnalysis' }).catch(() => {});
    }

    addToWhitelist(user) {
        if (!this.state.whitelist.some(u => u.id === user.id)) {
            this.state.whitelist.push(user);
            chrome.storage.local.set({ whitelist: this.state.whitelist });
            this.render();
        }
    }

    removeFromWhitelist(userId) {
        this.state.whitelist = this.state.whitelist.filter(u => u.id !== userId);
        chrome.storage.local.set({ whitelist: this.state.whitelist });
        this.render();
    }

    getFiltered() {
        const wlIds = new Set(this.state.whitelist.map(u => u.id));
        return this.state.nonFollowers.filter(user => {
            if (this.state.currentTab === 'whitelist') return wlIds.has(user.id);
            if (!this.state.filter.showVerified && user.is_verified) return false;
            if (!this.state.filter.showPrivate && user.is_private) return false;
            if (!this.state.filter.showWithoutPic && !user.profile_pic_url) return false;
            if (wlIds.has(user.id)) return false;
            if (this.state.searchTerm) {
                const t = this.state.searchTerm.toLowerCase();
                return user.username.toLowerCase().includes(t) || user.full_name.toLowerCase().includes(t);
            }
            return true;
        });
    }

    exportCSV() {
        const rows = this.getFiltered();
        let csv = 'username,full_name,is_verified,is_private\n';
        rows.forEach(u => { csv += `"${u.username}","${u.full_name}","${u.is_verified}","${u.is_private}"\n`; });
        this._download(new Blob([csv], { type: 'text/csv' }), `unfollowers_${this._today()}.csv`);
    }

    exportJSON() {
        this._download(new Blob([JSON.stringify(this.getFiltered(), null, 2)], { type: 'application/json' }), `unfollowers_${this._today()}.json`);
    }

    copyClipboard() {
        const text = this.getFiltered().map(u => u.username).join('\n');
        navigator.clipboard.writeText(text).then(() => alert(`✅ ${this.getFiltered().length} usernames copiados`));
    }

    _download(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    _today() { return new Date().toISOString().split('T')[0]; }

    // ─── RENDER ───

    renderHeader(showStats = false, showNewBtn = false) {
        const stats = this.state.stats;
        return `
            <div class="header">
                <div class="header-top">
                    <div class="logo">
                        <div class="logo-icon">🔍</div>
                        <div class="logo-text">No soy tu <span>Fan</span></div>
                    </div>
                    ${showNewBtn ? `<button class="btn-new" id="btn-new">↺ Nuevo análisis</button>` : ''}
                </div>
                ${showStats ? `
                <div class="stats-bar">
                    <div class="stat-item">
                        <span class="stat-num">${stats.nonFollowers}</span>
                        <span class="stat-label">No te siguen</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-num teal">${stats.totalFollowing}</span>
                        <span class="stat-label">Seguidos</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-num">${stats.percentage}%</span>
                        <span class="stat-label">Sin reciprocidad</span>
                    </div>
                </div>` : ''}
            </div>
        `;
    }

    renderScanBanner() {
        if (!this.state.isScanning) return '';
        return `
            <div class="scan-banner">
                <div class="scan-pulse"></div>
                <span class="scan-text">${this.state.scanMessage || 'Buscando...'}</span>
                <div class="scan-bar-wrap">
                    <div class="scan-bar-fill" style="width:${this.state.progress}%"></div>
                </div>
                <span class="scan-pct">${this.state.progress}%</span>
            </div>
        `;
    }

    render() {
        const s = this.state;

        if (s.status === 'idle' && s.nonFollowers.length === 0) {
            this.app.innerHTML = this.renderHeader() + `
                <div class="content">
                    <div class="idle-wrap">
                        <div class="idle-big-icon">🕵️</div>
                        <div class="idle-title">La verdad duele, pero hay que saber</div>
                        <div class="idle-sub">Analizamos a quiénes seguís y descubrimos quiénes no te siguen de vuelta.</div>
                        <button class="btn-start" id="btn-start">▶ Analizar ahora</button>
                        <div class="idle-note">⏱ Toma algunos minutos según cuántos seguís</div>
                    </div>
                </div>
            `;
            document.getElementById('btn-start')?.addEventListener('click', () => this.startAnalysis());
            return;
        }

        if (s.status === 'analyzing' && s.nonFollowers.length === 0) {
            this.app.innerHTML = this.renderHeader() + `
                <div class="content">
                    <div class="analyzing-wrap">
                        <div class="spinner-ring"></div>
                        <div class="analyzing-msg">${s.message}</div>
                        <div class="analyzing-pct">${s.progress}%</div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${s.progress}%"></div>
                        </div>
                        <div class="analyzing-hint">Esto puede tardar un poco, no cierres la extensión</div>
                    </div>
                </div>
            `;
            return;
        }

        if (s.status === 'error') {
            this.app.innerHTML = this.renderHeader() + `
                <div class="content">
                    <div class="error-box">❌ ${s.message}</div>
                    <button class="btn-retry" id="btn-retry">Intentar nuevamente</button>
                </div>
            `;
            document.getElementById('btn-retry')?.addEventListener('click', () => {
                this.state.status = 'idle';
                this.render();
            });
            return;
        }

        // Results (con o sin scan en curso)
        const filtered = this.getFiltered();
        const wlIds = new Set(s.whitelist.map(u => u.id));

        const userCards = filtered.length === 0
            ? `<div class="empty"><span class="empty-icon">✨</span>No hay resultados con estos filtros</div>`
            : filtered.map(u => `
                <div class="user-card">
                    ${u.profile_pic_url
                        ? `<img src="${u.profile_pic_url}" alt="${u.username}" class="avatar" crossorigin="anonymous">`
                        : `<div class="avatar-placeholder">👤</div>`}
                    <div class="user-info">
                        <a href="https://instagram.com/${u.username}" target="_blank" rel="noopener" class="user-handle">@${u.username}</a>
                        <div class="user-name">${u.full_name || '—'}</div>
                        <div class="badges">
                            ${u.is_verified ? '<span class="badge badge-verified">✔ Verificado</span>' : ''}
                            ${u.is_private  ? '<span class="badge badge-private">🔒 Privado</span>' : ''}
                        </div>
                    </div>
                    <button class="btn-star ${wlIds.has(u.id) ? 'saved' : ''}" data-id="${u.id}">
                        ${wlIds.has(u.id) ? '★' : '☆'}
                    </button>
                </div>
            `).join('');

        this.app.innerHTML =
            this.renderHeader(true, !s.isScanning) +
            this.renderScanBanner() +
            `<div class="content">
                <div class="toolbar">
                    <input class="search-input" type="text" placeholder="🔍 Buscar..." value="${s.searchTerm}" id="search">
                </div>
                <div class="tabs">
                    <button class="tab ${s.currentTab === 'all' ? 'active' : ''}" data-tab="all">
                        Todos (${s.currentTab === 'all' ? filtered.length : s.nonFollowers.length - s.whitelist.length})
                    </button>
                    <button class="tab ${s.currentTab === 'whitelist' ? 'active' : ''}" data-tab="whitelist">
                        ⭐ Guardados (${s.whitelist.length})
                    </button>
                </div>
                <div class="filters">
                    <label class="filter-chip"><input type="checkbox" data-f="showVerified" ${s.filter.showVerified ? 'checked' : ''}> ✔ Verificados</label>
                    <label class="filter-chip"><input type="checkbox" data-f="showPrivate" ${s.filter.showPrivate ? 'checked' : ''}> 🔒 Privados</label>
                    <label class="filter-chip"><input type="checkbox" data-f="showWithoutPic" ${s.filter.showWithoutPic ? 'checked' : ''}> 📸 Con foto</label>
                </div>
                <div class="actions">
                    <button class="btn-action" id="act-copy">📋 Copiar</button>
                    <button class="btn-action" id="act-json">📄 JSON</button>
                    <button class="btn-action" id="act-csv">📊 CSV</button>
                </div>
                <div class="users-list">${userCards}</div>
            </div>`;

        // Listeners
        document.getElementById('btn-new')?.addEventListener('click', () => {
            this.state.status = 'idle';
            this.state.isScanning = false;
            this.state.nonFollowers = [];
            this.state.stats = { nonFollowers: 0, totalFollowing: 0, percentage: 0 };
            chrome.storage.local.remove(['nonFollowers']);
            this.render();
        });

        document.getElementById('search')?.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.render();
        });

        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.state.currentTab = e.currentTarget.dataset.tab;
                this.state.searchTerm = '';
                this.render();
            });
        });

        document.querySelectorAll('.filter-chip input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                this.state.filter[e.target.dataset.f] = e.target.checked;
                this.render();
            });
        });

        document.getElementById('act-copy')?.addEventListener('click', () => this.copyClipboard());
        document.getElementById('act-json')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('act-csv')?.addEventListener('click', () => this.exportCSV());

        document.querySelectorAll('.btn-star').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const user = s.nonFollowers.find(u => u.id === id);
                if (wlIds.has(id)) this.removeFromWhitelist(id);
                else if (user) this.addToWhitelist(user);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => { new PopupApp(); });
