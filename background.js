// Instagram Unfollowers Tracker - Background Service Worker

console.log('[BG] Background service worker loaded');

let analysisState = {
    unfollowers: [],
    totalFollowing: 0,
    totalProcessed: 0
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BG] Mensaje recibido:', request.action);

    if (request.action === 'startAnalysis') {
        analysisState = { unfollowers: [], totalFollowing: 0, totalProcessed: 0 };
        analyzeUnfollowers();
        sendResponse({ success: true });

    } else if (request.action === 'updateUnfollowers') {
        // Actualización parcial — SOLO actualizar progreso y resultados parciales
        analysisState.unfollowers = request.unfollowers || [];
        analysisState.totalFollowing = request.totalFollowing || 0;
        analysisState.totalProcessed = request.totalProcessed || 0;

        // Progreso real: usuarios procesados / total (no unfollowers / total)
        const progress = analysisState.totalFollowing > 0
            ? Math.min(Math.round((analysisState.totalProcessed / analysisState.totalFollowing) * 100), 95)
            : 10;

        sendMessageToPopup({
            action: 'partialUpdate',   // ← nuevo tipo: no cambia el estado a 'done'
            progress: Math.max(progress, 10),
            message: `Revisando ${analysisState.totalProcessed} de ${analysisState.totalFollowing}`,
            partialResults: analysisState.unfollowers,
            stats: {
                nonFollowers: analysisState.unfollowers.length,
                totalFollowing: analysisState.totalFollowing,
                percentage: analysisState.totalFollowing > 0
                    ? Math.round((analysisState.unfollowers.length / analysisState.totalFollowing) * 100)
                    : 0
            }
        });

        sendResponse({ success: true });

    } else if (request.action === 'scanComplete') {
        // El scan terminó de verdad — ahora sí mandamos analysisComplete
        analysisState.unfollowers = request.unfollowers || [];
        analysisState.totalFollowing = request.totalFollowing || 0;
        analysisState.totalProcessed = request.totalProcessed || 0;

        const percentage = analysisState.totalFollowing > 0
            ? Math.round((analysisState.unfollowers.length / analysisState.totalFollowing) * 100)
            : 0;

        const stats = {
            nonFollowers: analysisState.unfollowers.length,
            totalFollowing: analysisState.totalFollowing,
            percentage: percentage
        };

        chrome.storage.local.set({
            nonFollowers: analysisState.unfollowers,
            lastStats: stats,
            timestamp: new Date().toISOString()
        });

        sendMessageToPopup({
            action: 'analysisComplete',
            nonFollowers: analysisState.unfollowers,
            stats: stats
        });

        sendResponse({ success: true });
    }
});

async function analyzeUnfollowers() {
    try {
        const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });

        if (tabs.length === 0) {
            sendMessageToPopup({ action: 'analysisError', error: 'Abre Instagram primero' });
            return;
        }

        const instagramTab = tabs[0];

        let profileData;
        try {
            profileData = await chrome.tabs.sendMessage(instagramTab.id, { action: 'getProfileData' });
        } catch (e) {
            sendMessageToPopup({ action: 'updateProgress', progress: 5, message: 'Preparando...' });
            await new Promise(r => setTimeout(r, 1000));
            try {
                profileData = await chrome.tabs.sendMessage(instagramTab.id, { action: 'getProfileData' });
            } catch (e2) {
                sendMessageToPopup({
                    action: 'analysisError',
                    error: 'No se pudo cargar la extensión en Instagram. Recargá la página e intentá de nuevo.'
                });
                return;
            }
        }

        if (!profileData || !profileData.userId || !profileData.cookies) {
            sendMessageToPopup({ action: 'analysisError', error: 'No se encontró sesión. ¿Estás logueado en Instagram?' });
            return;
        }

        sendMessageToPopup({ action: 'updateProgress', progress: 10, message: 'Analizando quién no te sigue...' });

        chrome.tabs.sendMessage(instagramTab.id, {
            action: 'getUnfollowers',
            userId: profileData.userId
        }).catch(e => console.error('[BG] Error al iniciar getUnfollowers:', e.message));

    } catch (error) {
        console.error('Error:', error);
        sendMessageToPopup({ action: 'analysisError', error: error.message || 'Error desconocido' });
    }
}

function sendMessageToPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // El popup no está abierto, ignorar
    });
}
