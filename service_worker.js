const VERSION = "v1"; // Version actuelle du service worker
const HOST = location.protocol + '//' + location.host; // L'hôte de l'application
const FILECACHE = [ // Liste des fichiers à mettre en cache
    HOST + "/css/bootstrap.css",
    HOST + "/js/form.js",
    HOST + "/manifest.json",
    HOST + "/offline/games.html",
    HOST + "/details.html"
];

self.addEventListener("install", (e) => {
    self.skipWaiting(); // Permet à ce service worker de s'activer immédiatement sans attendre la fin de l'ancien
    console.log("Version:", VERSION); // Affiche la version actuelle lors de l'installation

    e.waitUntil(
        (async () => {
            const cache = await caches.open(VERSION); // Ouvre le cache correspondant à la version actuelle du service worker

            try {
                await Promise.all(
                    [...FILECACHE, './offline/index.html'].map(async (path) => {
                        try {
                            await cache.add(path); // Ajoute les fichiers à mettre en cache
                            console.log("Cached:", path); // Affiche les fichiers mis en cache avec succès
                        } catch (error) {
                            console.error("Cache add error:", error); // Affiche les erreurs rencontrées lors de l'ajout au cache
                        }
                    })
                );
            } catch (error) {
                console.error("Cache open error:", error); // Affiche les erreurs rencontrées lors de l'ouverture du cache
            }
        })()
    );
});


self.addEventListener('activate', (e) => {
    e.waitUntil(
        (async () => {
            const keys = await caches.keys(); // Récupère toutes les clés du cache
            await Promise.all(
                keys.map((k) => {
                    if (!k.includes(VERSION)) return caches.delete(k); // Supprime les anciennes versions du cache
                })
            );
        })()
    );
});


self.addEventListener("fetch", (e) => {
    console.log("Fetch:", e.request.url); // Affiche l'URL de la requête fetch

    if (e.request.mode === "navigate" && !e.request.url.endsWith('games.html') && !e.request.url.includes('details.html')) {
        e.respondWith(
            (async () => {
                try {
                    const preloadedResponse = await e.preloadResponse;
                    if (preloadedResponse) return preloadedResponse; // Utilise la réponse préchargée si disponible

                    return await fetch(e.request); // Sinon, effectue la requête fetch normale
                } catch (error) {
                    console.error("Fetch error:", error); // Affiche les erreurs rencontrées lors de la requête fetch
                    const cache = await caches.open(VERSION);
                    return await cache.match("/offline/index.html"); // Retourne la page hors ligne en cas d'erreur
                }
            })()
        );
    } else if (FILECACHE.includes(e.request.url)) {
        e.respondWith(caches.match(e.request)); // Répond avec le contenu du cache pour les fichiers spécifiés dans FILECACHE
    }

    if(e.request.url.endsWith('games.html')) {
        e.respondWith(caches.match("/offline/games.html")); // Répond avec la page de jeux hors ligne pour les requêtes games.html
    }

    if(e.request.url.includes('details.html')) {
        e.respondWith(handleDetailsRequest(e.request)); // Gère les requêtes details.html de manière spécifique
    }

    async function handleDetailsRequest(request) {
        const url = new URL(request.url);
        const searchParams = new URLSearchParams(url.search);
        const name = searchParams.get('name');
        const summary = searchParams.get('summary');
        const image = searchParams.get('image');
    
        const cache = await caches.open(VERSION);
        const cacheKey = `details-${name}-${summary}-${image}`;
    
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            return cachedResponse; // Retourne la réponse mise en cache si disponible
        } else {
            try {
                const response = await fetch(request); // Effectue la requête fetch pour récupérer les détails
                await cache.put(cacheKey, response.clone()); // Met en cache la réponse pour une utilisation ultérieure
                return response; // Retourne la réponse de la requête fetch
            } catch (error) {
                console.error("Fetch error:", error); // Affiche les erreurs rencontrées lors de la requête fetch
                return await cache.match("/details.html"); // Retourne la page de détails hors ligne en cas d'erreur
            }
        }
    }
    
});
