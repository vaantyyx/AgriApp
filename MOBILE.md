# Sougra — application mobile (Capacitor)

L'app mobile réutilise **tel quel** le front web (`frontend/`) empaqueté dans une
coque native via [Capacitor](https://capacitorjs.com/). Même code, même design,
même temps réel.

## Prérequis

- Node 22, Android Studio (SDK + un AVD), JDK 21 (celui d'Android Studio suffit :
  `JAVA_HOME=".../Android Studio/jbr"`).
- Le chemin du projet contient un caractère non-ASCII (« Téléchargements ») :
  `frontend/android/gradle.properties` contient déjà
  `android.overridePathCheck=true` pour cette raison. En cas de souci de build
  natif, déplacer le projet vers un chemin ASCII.

## Workflow

```bash
cd frontend

npm run mobile:sync     # vite build --mode mobile  +  cap sync android
npm run mobile:open     # idem, puis ouvre Android Studio (bouton Run ▶)
```

Build APK en ligne de commande (sans Android Studio) :

```bash
cd frontend/android
JAVA_HOME=".../Android Studio/jbr" ./gradlew.bat assembleDebug -x lint
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Configuration réseau

Dans le WebView, l'origine de la page est l'app elle-même (`https://localhost`),
pas le site. Donc :

- **`frontend/.env.mobile`** fixe `VITE_BACKEND_URL=https://agriapp-mhbz.onrender.com`
  (utilisé uniquement par `--mode mobile`, le build web n'est pas touché).
- **Backend CORS** : `server.js` autorise désormais `https://localhost` et
  `capacitor://localhost` en plus des origines web. **Le backend doit être
  redéployé** pour que le captcha / login / Socket.IO fonctionnent depuis l'app.

## Ce qui est en place

| Élément | Détail |
|---|---|
| Icône + splash | Générés depuis `public/img/sougra-logo.png`. Sources 1024²/2732² dans `frontend/assets/`. Régénérer (outil non installé, tiré à la volée) : `npx @capacitor/assets@3 generate --android`. |
| Safe areas | `StatusBar.overlaysWebView(true)` + `frontend/src/mobile.css` (scopé `html.cap-native`, inerte sur le web). Couleur des icônes de la barre d'état suit le thème clair/sombre. |
| Bouton retour Android | `frontend/src/mobile/useAndroidBackButton.js` : ferme d'abord une modale ouverte, sinon `navigate(-1)`, sinon quitte l'app. |
| Splash | Masqué par `frontend/src/mobile/bridge.js` dès le premier rendu web. |

## Notifications push — étape manuelle restante

Le câblage est fait des deux côtés ; il manque **le projet Firebase** (que seul
le propriétaire du compte Google peut créer).

**Client** — `frontend/src/mobile/push.js` : demande la permission, enregistre le
token FCM auprès de `POST /api/push/register`, gère le tap sur une notif.
**Désactivé par défaut** (`VITE_ENABLE_PUSH=false` dans `.env.mobile`) : sans
Firebase, `PushNotifications.register()` fait planter l'app Android.

**Backend** — `routes/push.js` stocke les tokens (`pushTokens`), `services/pushService.js`
envoie via `firebase-admin` (déjà appelé sur « nouvelle enchère » et « nouvelle
offre » dans `server.js`). Tout est **no-op tant que Firebase n'est pas configuré**.

### Pour activer

1. Créer un projet sur <https://console.firebase.google.com>, ajouter une app
   Android avec le package **`com.sougra.app`**.
2. Télécharger **`google-services.json`** → le placer dans
   `frontend/android/app/google-services.json`.
3. Ajouter le plugin Gradle Google Services :
   - `frontend/android/build.gradle` → `classpath 'com.google.gms:google-services:4.4.2'`
   - `frontend/android/app/build.gradle` → `apply plugin: 'com.google.gms.google-services'` (en bas)
4. Passer **`VITE_ENABLE_PUSH=true`** dans `frontend/.env.mobile`.
5. Backend : générer une clé de compte de service (Firebase → Paramètres →
   Comptes de service → *Générer une nouvelle clé privée*) et la mettre dans la
   variable d'env **`FIREBASE_SERVICE_ACCOUNT`** (JSON en une ligne) sur Render.
6. Redéployer le backend, rebuild l'app. `firebase-admin` s'installe tout seul
   (`optionalDependencies`).

### Tester

`adb shell cmd notification post ...` ne teste pas FCM. Utiliser la console
Firebase → *Cloud Messaging* → *Envoyer un message test* avec le token loggé
par `[push] registration` (visible dans `adb logcat -s Capacitor/Console`).
