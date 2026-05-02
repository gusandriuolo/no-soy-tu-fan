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
    const unfollowers = [];
    let hasNextPage = true;
    let endCursor = null;
    let totalProcessed = 0;
    let totalFollowing = 0;

    const queryHash = '3dec7e2c57367ef3da3d987d89f9dbc8';

    while (hasNextPage) {
        try {
            const variables = {
                id: userId,
                include_reel: true,
                fetch_mutual: false,
                first: 24
            };
            if (endCursor) variables.after = endCursor;

            const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'accept': '*/*',
                    'accept-language': 'es-419;q=0.9,en;q=0.8',
                    'x-requested-with': 'XMLHttpRequest'
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const followingData = data.data?.user?.edge_follow;

            if (followingData) {
                totalFollowing = followingData.count || 0;
                const edges = followingData.edges || [];

                edges.forEach(edge => {
                    totalProcessed++;
                    if (edge.node && !edge.node.follows_viewer) {
                        unfollowers.push({
                            id: edge.node.id,
                            username: edge.node.username,
                            full_name: edge.node.full_name,
                            is_verified: edge.node.is_verified,
                            is_private: edge.node.is_private,
                            profile_pic_url: edge.node.profile_pic_url
                        });
                    }
                });

                const pageInfo = followingData.page_info;
                hasNextPage = pageInfo?.has_next_page || false;
                endCursor = pageInfo?.end_cursor || null;

                // Actualización parcial — no es el resultado final todavía
                chrome.runtime.sendMessage({
                    action: 'updateUnfollowers',
                    unfollowers: unfollowers,
                    totalFollowing: totalFollowing,
                    totalProcessed: totalProcessed   // <-- progreso real
                }).catch(() => {});

                await new Promise(r => setTimeout(r, 2000));
            } else {
                hasNextPage = false;
            }
        } catch (error) {
            console.error('[CS] Error:', error.message);
            hasNextPage = false;
        }
    }

    // Scan terminado de verdad
    chrome.runtime.sendMessage({
        action: 'scanComplete',
        unfollowers: unfollowers,
        totalFollowing: totalFollowing,
        totalProcessed: totalProcessed
    }).catch(() => {});

    return unfollowers;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === 'getProfileData') {
            const userId = getUserIdFromPageData();
            const cookies = getCookies();
            sendResponse({ userId, cookies, success: !!userId && !!cookies });
        } else if (request.action === 'getUnfollowers') {
            getUnfollowersFromPage(request.userId).then(unfollowers => {
                sendResponse({ unfollowers, success: true });
            }).catch(error => {
                sendResponse({ unfollowers: [], success: false, error: error.message });
            });
            return true;
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
});

console.log('[IGTracker] Content script loaded');
