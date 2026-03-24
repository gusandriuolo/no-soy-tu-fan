// Instagram Unfollowers Tracker - Background Service Worker

console.log('[BG] Background service worker loaded');

// Estado global para análisis
let analysisState = {
    unfollowers: [],
    totalFollowing: 0,
    totalFollowers: 0
};

// Escuchar mensajes del popup y content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BG] Mensaje recibido:', request.action);

    if (request.action === 'startAnalysis') {
        console.log('[BG] Iniciando análisis...');
        analysisState = { unfollowers: [], totalFollowing: 0 };
        analyzeUnfollowers();
        sendResponse({ success: true });
    } else if (request.action === 'updateUnfollowers') {
        console.log('[BG] Actualizando unfollowers:', request.unfollowers?.length || 0);
        analysisState.unfollowers = request.unfollowers || [];
        analysisState.totalFollowing = request.totalFollowing || 0;

        // Enviar actualización de progreso al popup
        const progressPercent = analysisState.totalFollowing > 0
            ? Math.min(Math.round((request.unfollowers.length / analysisState.totalFollowing) * 100), 95)
            : 0;
        sendMessageToPopup({
            action: 'updateProgress',
            progress: Math.max(progressPercent, 15),
            message: 'Analizando ' + request.unfollowers.length + ' perfiles...'
        });

        updateAnalysisResults();
        sendResponse({ success: true });
    }
});

async function analyzeUnfollowers() {
    try {
        console.log('[BG] analyzeUnfollowers iniciado');

        // Obtener la tab activa de Instagram
        const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
        console.log('[BG] Tabs encontradas:', tabs.length);

        if (tabs.length === 0) {
            sendMessageToPopup({
                action: 'analysisError',
                error: 'Abre Instagram primero'
            });
            return;
        }

        const instagramTab = tabs[0];
        console.log('[BG] Tab de Instagram:', instagramTab.url);

        // Obtener datos del content script (incluye cookies)
        let profileData;
        try {
            console.log('[BG] Intentando enviar getProfileData...');
            profileData = await chrome.tabs.sendMessage(instagramTab.id, {
                action: 'getProfileData'
            });
            console.log('[BG] Response recibida:', !!profileData);
        } catch (e) {
            console.log('[BG] Content script error (intento 1):', e.message);
            sendMessageToPopup({
                action: 'updateProgress',
                progress: 5,
                message: 'Preparando análisis...'
            });
            await new Promise(r => setTimeout(r, 1000));
            try {
                console.log('[BG] Intentando enviar getProfileData (intento 2)...');
                profileData = await chrome.tabs.sendMessage(instagramTab.id, {
                    action: 'getProfileData'
                });
                console.log('[BG] Response recibida (intento 2):', !!profileData);
            } catch (e2) {
                console.log('[BG] Content script error (intento 2):', e2.message);
                sendMessageToPopup({
                    action: 'analysisError',
                    error: 'No se pudo cargar la extensión en Instagram. Recarga la página e intenta de nuevo.'
                });
                return;
            }
        }

        if (!profileData || !profileData.userId || !profileData.cookies) {
            sendMessageToPopup({
                action: 'analysisError',
                error: 'No se encontró sesión. ¿Estás logeado en Instagram?'
            });
            return;
        }

        const userId = profileData.userId;

        // Obtener unfollowers desde el content script
        sendMessageToPopup({
            action: 'updateProgress',
            progress: 10,
            message: 'Analizando quién no te sigue...'
        });

        console.log('[BG] Pidiendo unfollowers al content script...');
        chrome.tabs.sendMessage(instagramTab.id, {
            action: 'getUnfollowers',
            userId: userId
        }).then(response => {
            console.log('[BG] Unfollowers completado:', response.unfollowers?.length || 0);
        }).catch(e => {
            console.error('[BG] Error al obtener unfollowers:', e.message);
        });

    } catch (error) {
        console.error('Error:', error);
        sendMessageToPopup({
            action: 'analysisError',
            error: error.message || 'Error desconocido'
        });
    }
}

function updateAnalysisResults() {
    const { unfollowers, totalFollowing } = analysisState;

    if (unfollowers.length === 0 || totalFollowing === 0) {
        return; // Aún no hay datos
    }

    console.log('[BG] Actualizando resultados - Unfollowers encontrados:', unfollowers.length, 'de', totalFollowing);

    const percentage = totalFollowing > 0 ? Math.round((unfollowers.length / totalFollowing) * 100) : 0;

    // Guardar resultados
    const stats = {
        unfollowers: unfollowers.length,
        totalFollowing: totalFollowing,
        percentage: percentage
    };

    chrome.storage.local.set({
        nonFollowers: unfollowers,
        lastStats: stats,
        timestamp: new Date().toISOString()
    });

    // Enviar resultados al popup
    sendMessageToPopup({
        action: 'analysisComplete',
        nonFollowers: unfollowers,
        stats: {
            unfollowers: unfollowers.length,
            totalFollowing: totalFollowing,
            percentage: percentage
        }
    });
}


function sendMessageToPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // El popup no está abierto
    });
}
