// Instagram Unfollowers Tracker - Content Script
// Se ejecuta en el contexto de Instagram - HACE LOS REQUESTS DESDE AQUÍ

console.log('[IGTracker] Content script starting...');

let cachedUserId = null;
let cachedCookies = null;

function getCookies() {
    try {
        const cookies = document.cookie;
        if (cookies) {
            cachedCookies = cookies;
            return cookies;
        }
    } catch (e) {
        console.log('Error extrayendo cookies:', e);
    }
    return null;
}

function getUserIdFromPageData() {
    try {
        const scripts = document.querySelectorAll('script');

        for (let script of scripts) {
            const content = script.textContent;
            const match = content.match(/"appScopedIdentity":"(\d+)"/);
            if (match && match[1]) {
                console.log('ID encontrado:', match[1]);
                return match[1];
            }
        }
    } catch (e) {
        console.log('Error buscando ID:', e.message);
    }
    return null;
}

async function getUnfollowersFromPage(userId) {
    // Obtiene la lista de SEGUIDOS con el campo follows_viewer
    // Los unfollowers son: seguidos con follows_viewer=false (no te siguen)
    const unfollowers = [];
    let hasNextPage = true;
    let endCursor = null;

    const queryHash = '3dec7e2c57367ef3da3d987d89f9dbc8';

    while (hasNextPage) {
        try {
            const variables = {
                id: userId,
                include_reel: true,
                fetch_mutual: false,
                first: 24
            };

            if (endCursor) {
                variables.after = endCursor;
            }

            const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;

            console.log('[CS] Fetching following/unfollowers, page:', unfollowers.length / 24 + 1);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'accept': '*/*',
                    'accept-language': 'es-419;q=0.9,en;q=0.8',
                    'x-requested-with': 'XMLHttpRequest'
                }
            });

            console.log('[CS] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.log('[CS] Error response:', errorText.substring(0, 200));
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const userData = data.data?.user;
            const followingData = userData?.edge_follow;

            if (followingData) {
                const totalFollowing = followingData.count || 0;
                console.log('[CS] Found following data, total:', totalFollowing, 'edges count:', followingData.edges?.length || 0);

                if (followingData.edges && Array.isArray(followingData.edges)) {
                    followingData.edges.forEach(edge => {
                        if (edge.node) {
                            // El campo follows_viewer indica si la persona TE SIGUE
                            // Si es false, es un unfollower (lo sigues pero no te sigue)
                            if (!edge.node.follows_viewer) {
                                unfollowers.push({
                                    id: edge.node.id,
                                    username: edge.node.username,
                                    full_name: edge.node.full_name,
                                    is_verified: edge.node.is_verified,
                                    is_private: edge.node.is_private,
                                    profile_pic_url: edge.node.profile_pic_url
                                });
                            }
                        }
                    });
                }

                const pageInfo = followingData.page_info;
                hasNextPage = pageInfo?.has_next_page || false;
                endCursor = pageInfo?.end_cursor || null;

                console.log('[CS] Unfollowers found so far:', unfollowers.length, 'Next page:', hasNextPage);

                // Enviar actualización al background
                try {
                    chrome.runtime.sendMessage({
                        action: 'updateUnfollowers',
                        unfollowers: unfollowers,
                        totalFollowing: totalFollowing
                    }, (response) => {
                        console.log('[CS] updateUnfollowers enviado, respuesta:', !!response);
                    });
                } catch (err) {
                    console.error('[CS] Error enviando updateUnfollowers:', err);
                }

                // Delay para evitar rate limiting
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.log('[CS] No following data in response');
                hasNextPage = false;
            }
        } catch (error) {
            console.error('[CS] Error fetching unfollowers:', error.message);
            hasNextPage = false;
        }
    }

    return unfollowers;
}


// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === 'getProfileData') {
            const userId = getUserIdFromPageData();
            const cookies = getCookies();

            sendResponse({
                userId: userId,
                cookies: cookies,
                success: !!userId && !!cookies
            });
        } else if (request.action === 'getUnfollowers') {
            console.log('[CS] getUnfollowers solicitado para:', request.userId);
            getUnfollowersFromPage(request.userId).then(unfollowers => {
                console.log('[CS] Enviando', unfollowers.length, 'unfollowers');
                sendResponse({ unfollowers, success: true });
            }).catch(error => {
                console.error('[CS] Error en getUnfollowers:', error);
                sendResponse({ unfollowers: [], success: false, error: error.message });
            });
            return true; // indica que sendResponse será llamado asincronamente
        }
    } catch (error) {
        console.error('[CS] Error en onMessage:', error);
        sendResponse({ success: false, error: error.message });
    }
});

console.log('[IGTracker] Content script loaded');
