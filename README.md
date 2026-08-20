# IPTV Manager

Application de bureau (Windows) pour **gérer des playlists M3U** et **regarder des chaînes IPTV**,
construite avec Electron + React. Les playlists sont téléchargées, parsées et stockées en local
dans une base SQLite ; la lecture se fait soit **dans l'application**, soit dans un **lecteur externe**
(VLC, MPC-HC, PotPlayer…).

---

## Fonctionnalités

- **Playlists M3U** — ajout par URL, rafraîchissement manuel, suppression. Une playlist déjà présente
  (même URL) est refusée pour éviter les doublons.
- **Rafraîchissement automatique** toutes les 6 heures, avec notification dans l'interface.
- **Parsing M3U / M3U8** — extraction de `tvg-id`, `tvg-name`, `tvg-logo` et `group-title`
  (groupe par défaut : « Général »).
- **Navigation** — recherche par nom, filtre par groupe, filtre par playlist, vue **Favoris**.
  Les favoris remontent en tête de liste.
- **Lecteur interne** — overlay vidéo intégré :
  - flux `.m3u8` → [hls.js](https://github.com/video-dev/hls.js)
  - flux `.ts` ou sans extension (typique Xtream Codes) → [mpegts.js](https://github.com/xqq/mpegts.js)
  - reprise automatique sur erreur réseau ou média
- **Lecteur externe** — détection automatique de VLC, MPC-HC, MPC-BE, PotPlayer et Windows Media Player,
  ou sélection manuelle d'un `.exe`. Repli sur le navigateur par défaut si aucun lecteur n'est trouvé.
- **Stockage local** — SQLite via [sql.js](https://sql.js.org) (WebAssembly, **aucune compilation
  native requise**), fichier `iptv-manager.db` dans le dossier `userData` d'Electron.

## Prérequis

- **Node.js** 18 ou plus
- **Windows** (le lanceur et la détection des lecteurs sont spécifiques à Windows)

## Installation

```bash
git clone https://github.com/ezakariaa/iptv-manager.git
cd iptv-manager
npm install
```

## Lancer l'application

```bash
npm start
```

Cette commande compile le renderer (webpack, mode production) puis démarre Electron via `launch.bat`.

> **Pourquoi `launch.bat` et pas `electron .` ?**
> Le script vide la variable d'environnement `ELECTRON_RUN_AS_NODE` avant de lancer Electron.
> Si elle est définie dans votre environnement, Electron démarre comme un simple runtime Node
> et aucune fenêtre ne s'ouvre.

### Mode développement

```bash
npm run dev
```

Lance webpack en `--watch` et Electron en parallèle. Recharger la fenêtre (`Ctrl+R`) prend en compte
les modifications du renderer ; toute modification de `main.js` ou `preload.js` nécessite un redémarrage.

### Compiler un installateur

```bash
npm run build
```

Produit un installateur NSIS dans `release/` via electron-builder.

## Utilisation

1. **Ajouter une playlist** — bouton « + », renseigner un nom et l'URL M3U. Les chaînes sont
   téléchargées et importées immédiatement ; si le téléchargement échoue, la playlist n'est pas conservée.
2. **Choisir le mode de lecture** — dans les réglages : *interne* (dans l'app) ou *externe*
   (lecteur installé sur la machine). En mode interne, un clic droit / action dédiée permet malgré tout
   d'ouvrir une chaîne dans le lecteur externe.
3. **Parcourir** — rechercher par nom, filtrer par groupe ou par playlist, marquer des chaînes en favori.

## Structure du projet

```
main.js              Processus principal Electron : fenêtre, IPC, téléchargement M3U,
                     détection des lecteurs, auto-refresh 6 h
preload.js           Pont contextIsolation → expose l'API `window.iptv` au renderer
db/database.js       Schéma et requêtes SQLite (sql.js), persistance sur disque
utils/m3uParser.js   Parseur M3U / EXTINF
src/
  index.jsx          Point d'entrée React
  App.jsx            État global, filtres, orchestration
  components/        Header, Sidebar, ChannelGrid, ChannelCard,
                     PlayerOverlay, AddPlaylistModal, SettingsModal, Toast
  styles/index.css   Thème sombre
webpack.config.js    Bundling du renderer → dist/
launch.bat           Lanceur Windows (neutralise ELECTRON_RUN_AS_NODE)
```

### Schéma de données

| Table       | Colonnes principales                                                        |
|-------------|-----------------------------------------------------------------------------|
| `playlists` | `id`, `name`, `url` (unique), `channel_count`, `last_updated`                |
| `channels`  | `id`, `playlist_id` (FK, cascade), `name`, `url`, `logo`, `group_title`, `tvg_id`, `is_favorite` |

Les requêtes de listage sont limitées à 2000 chaînes pour garder l'interface fluide sur de très
grosses playlists.

## Notes techniques

- `contextIsolation: true` et `nodeIntegration: false` — le renderer n'accède à Node que via
  l'API exposée dans `preload.js`.
- `webSecurity: false` est activé pour permettre la lecture de flux cross-origin ; l'application
  ne charge que du contenu local dans sa fenêtre.
- L'accélération matérielle est désactivée (`app.disableHardwareAcceleration()`) pour éviter les
  écrans noirs sur certaines configurations GPU Windows.
- Le dossier `dist/` (bundle compilé) n'est pas versionné : il est régénéré par
  `npm run build-renderer`.

## Avertissement

Ce logiciel ne fournit, n'héberge et ne distribue **aucun contenu**. C'est un lecteur de playlists :
vous devez fournir vos propres URLs M3U et vous assurer d'en avoir légalement le droit.
