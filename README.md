# nResto Mobile

React Native (CLI) app for **nResto POS** — BOLT Fusion Tech. Login and full POS (categories, food grid, cart, service charge, submit order).

## Stack

- **React Native** (CLI) 0.84
- **React Native Reanimated** 4
- **React Native Vector Icons** (Feather)
- **React Native SVG**
- **React Native Easy Grid**
- **React Navigation** (native-stack, bottom-tabs)
- **Redux Toolkit** + **React-Redux** + **WatermelonDB** (SQLite persistence)
- **react-native-size-matters** for responsive scaling

## Responsive design

The app scales layout and typography for all device sizes (phones and tablets). Base guideline is **375×812** (iPhone X).

- **Theme** (`src/theme`): `spacing`, `radius`, and `typography` are scaled at load from `src/utils/scaling.ts` (moderate factor 0.5 for text so it doesn’t blow up on tablets).
- **useResponsive()** (`src/hooks/useResponsive.ts`): Returns `width`, `height`, `scale`, `verticalScale`, `moderateScale`, `numColumns`, `horizontalPadding`, `cartSheetHeightRatio`, `maxContentWidth`, and breakpoint flags (`isTablet`, `isSmallDevice`, etc.).
- **useScaledTheme()** (`src/hooks/useScaledTheme.ts`): Returns scaled `spacing`, `radius`, `typography` that update when the window changes (e.g. orientation/split screen).
- **Scaling utils** (`src/utils/scaling.ts`): Re-exports `scale`, `verticalScale`, `moderateScale` from `react-native-size-matters` and provides `createScaledDesignSystem()` / `getScaledDesignSystem()`.

Use the theme for most UI; use `useResponsive()` for layout (columns, padding, sheet height) and `scale`/`moderateScale` for one-off dimensions.

## Features

- **Login**: Demo auth (e.g. `admin@demo.com` / `Pass@1234`). Redux stores user and token.
- **POS**: Category filters, order type (Dine In / Pick Up / Delivery), table number (Dine In), search, food grid (2 columns), cart with +/- and line total, **payment method** (Mobile / Card / Cash), order notes, service charge, subtotal/total, Pay with [method], Clear cart.
- **Orders**: Order list (persisted) and **chart** of payments by method (Mobile / Card / Cash); total sales; “New order” links to POS.
- **Persistence**: Auth and POS state (cart, order history, payment method, etc.) are persisted with **WatermelonDB** (SQLite) so data survives app restarts.
- **Logout**: Header right button on main tabs.

## Setup

1. Install dependencies (from repo root or `mobile/`):

   ```bash
   cd mobile
   yarn
   # or: npm install
   ```

2. **iOS**: Install pods and link vector icon fonts (fonts are in `react-native.config.js` assets; if not linked, run `npx react-native-asset` or add the Fonts folder to Xcode manually).

   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android**: Vector icons are applied via `apply from: .../fonts.gradle` in `android/app/build.gradle`. No extra step.

## Run

- **Metro**:
  ```bash
  yarn start
  ```
- **iOS** (simulator):
  ```bash
  yarn ios
  ```
- **Android** (emulator or device):
  ```bash
  yarn android
  ```

### Android: INSTALL_FAILED_INSUFFICIENT_STORAGE

If you see **`INSTALL_FAILED_INSUFFICIENT_STORAGE: Failed to override installation location`**, the build succeeded but the emulator (**My_ph (AVD)** or similar) has no free storage. Fix it:

1. **Wipe the emulator (fastest)**  
   - Quit the emulator completely.  
   - List AVDs: `emulator -list-avds`  
   - Start with wiped data (use the name from the list, e.g. `My_ph` or `Pixel_4_API_34`):  
     `emulator -avd My_ph -wipe-data`  
   - When the emulator is up, run `yarn android` again.

2. **From Android Studio**  
   - Device Manager → ⋮ on your AVD → **Wipe Data**, then run `yarn android`.

3. **Build only (no install)**  
   - `yarn android:build`  
   - APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Copy to a device/emulator with free space and install manually.

## Generate APK (release)

To build a **release APK** for distribution or sideloading:

```bash
cd mobile
yarn android:release
# or: yarn android:apk
```

- **Output:** `android/app/build/outputs/apk/release/app-release.apk`
- The release build is signed with the debug keystore (suitable for testing). For Play Store, configure a production keystore in `android/app/build.gradle` (see [signed APK docs](https://reactnative.dev/docs/signed-apk-android)).

4. **New AVD with more storage**  
   - Create a new Virtual Device with **internal storage** ≥ 2048 MB.

## Demo credentials

| Email              | Password  |
|--------------------|-----------|
| admin@demo.com     | Pass@1234 |
| staff@demo.com     | Pass@1234 |
| waiter@demo.com    | Pass@1234 |
| deliveryman@demo.com | Pass@1234 |

## Auth (best way to manage)

Auth is centralized so one place owns state, persistence, and API.

- **State:** `AuthState` (`user`, `accessToken`, `isAuthenticated`) lives in **AppContext** and is the single source of truth for the UI.
- **Persistence:** **authService** (`src/services/authService.ts`) is the only place that reads/writes auth. It uses WatermelonDB KeyValue under the key `auth`. Login and logout go through `setStoredAuth` / `clearStoredAuth`.
- **Flow:** On load, AppContext subscribes to the `key_value` table for `auth`; when the stored value changes, `parseAuth` turns it into `AuthState` and context updates. LoginScreen calls `login(user, accessToken)` → authService persists → subscription fires → navigator shows Main. Logout calls `logout()` → authService clears → subscription fires → navigator shows Login.
- **Usage:** Use `useApp()` for full context or `useAuth()` when you only need `{ user, accessToken, isAuthenticated, login, logout }` (e.g. LoginScreen, LogoutButton, RootNavigator).

**Files**

- `src/types/auth.ts` – `AuthState`, `StoredAuthPayload`, `INITIAL_AUTH`.
- `src/services/authService.ts` – `getStoredAuth()`, `setStoredAuth()`, `clearStoredAuth()`, `parseAuth()`.
- `src/context/AppContext.tsx` – holds auth state, subscribes to DB, exposes `login` / `logout` that delegate to authService.
- `src/hooks/useAuth.ts` – thin hook that returns auth + login + logout from context.

**Production**

- Store **accessToken** (and refreshToken if any) in **react-native-keychain** instead of KeyValue; keep `user` in KeyValue or in Keychain. Implement `getStoredAuth` / `setStoredAuth` / `clearStoredAuth` to read/write Keychain + KeyValue so the rest of the app stays unchanged.
- For real API login: add `loginWithCredentials(email, password)` in authService that calls your API, then `setStoredAuth({ user, accessToken, isAuthenticated: true })`. Optionally add token refresh and an API client that attaches the token and retries on 401 with refresh.

## Project structure

- `src/constants/demoData.ts` – Demo users, food items, categories, service charge constant.
- `src/context/AppContext.tsx` – Auth, POS session, orders; persists via WatermelonDB KeyValue and authService.
- `src/services/authService.ts` – Auth persistence (get/set/clear); single place for auth storage.
- `src/navigation/` – Root navigator (Login stack vs Main tabs), Main tabs (POS, Orders), Logout button.
- `src/screens/LoginScreen.tsx` – Email/password, Reanimated entrance.
- `src/screens/POS/POSScreen.tsx` – Categories, order type, search, food grid, cart, service charge, submit.
- `src/screens/OrdersScreen.tsx` – Placeholder.
- `App.tsx` – Redux Provider, SafeAreaProvider, RootNavigator.

## Responsive design

The app adapts to all device sizes:

- **Base design:** 375×812 (small phone). Scaling and breakpoints use `useResponsive()` and `src/utils/responsive.ts`.
- **POS:** Food grid shows 2 columns (phone), 3 (tablet ≥600px), 4 (large tablet ≥768px). Cart sheet height scales by screen (82–88%). Horizontal padding increases on larger screens. On tablet, content is centered with a max width.
- **Login:** Form is scrollable on small devices; on tablet the form is centered with a max width.
- **Orders:** List and cards use responsive horizontal padding; on tablet the list is centered with a max width.
- **Orientation / split screen:** `useWindowDimensions()` ensures layout updates when the window is resized or the device is rotated.

## Thermal printing

The app includes a **native thermal printer bridge** (ESC/POS) for 58mm/80mm receipt printers.

### Flow

1. After payment (Orders → Pay → complete payment), the **Invoice** modal opens.
2. Tap **Print** to send the receipt to the configured thermal printer.
3. The native module builds ESC/POS (bold store name, items table, totals, thank-you, paper feed & cut) and sends it over **Bluetooth** (Android) or **TCP** (iOS).

### Setup

- **Android**: Pair the Bluetooth printer in system Settings, then set the target once (e.g. from a future Settings screen):
  ```ts
  import { setPrinterTarget } from '../services/printerService';
  setPrinterTarget({ type: 'bluetooth', address: 'XX:XX:XX:XX:XX:XX' });
  ```
  Or pass `printerAddress` in the invoice payload when calling `printInvoice`. You may need to grant **Bluetooth** / **Nearby devices** at runtime on Android 12+.

- **iOS**: Set a TCP (LAN) printer before printing:
  ```ts
  setPrinterTarget({ type: 'tcp', host: '192.168.1.100', port: 9100 });
  ```
  Or pass `printerHost` and `printerPort` in the invoice payload. For Bluetooth on iOS you would need External Accessory or CoreBluetooth (not included in this bridge).

### Code

- `src/services/printerService.ts` – `printInvoice(invoice)`, `setPrinterTarget(config)`, `buildInvoiceFromOrder(...)`.
- `src/components/InvoiceButton.tsx` – Button that calls the printer service and shows success/error.
- `src/constants/exampleInvoice.ts` – Example payload for testing.
- **Android**: `ThermalPrinterModule.kt` (ESC/POS + Bluetooth SPP), `ThermalPrinterPackage.kt`; registered in `MainApplication.kt`.
- **iOS**: `ThermalPrinterModule.m` (ESC/POS + TCP socket); added to the Xcode target.

## Debugging: Database and image download

### Database Inspector shows "Nothing to show"

- **WatermelonDB** uses its own SQLite file (JSI/native). Android Studio’s **Database Inspector** may not list it, or the DB is created only after the app has run and completed init.
- Ensure the app has fully started (splash finished, then at least one screen loaded). In **Logcat** (filter by `NResto` or `ReactNativeJS`), look for:
  - `[NResto] DB seeded with demo data` or `[NResto] DB seeded (no API config)` → DB was populated.
  - `[NResto] loadMasterDataOnInit failed` or `[NResto] hasMasterData/seed failed` → init or seed failed (check stack trace).
- If you need to inspect data, query WatermelonDB from your code (e.g. a debug screen or `database.get('food_categories').query().fetch()` and log the result).

### Image download (background thread)

- Images are downloaded only when **master data comes from the API** (internet reachable and `graphqlApiBase` set) and the API returns items with `item_image` set.
- In Logcat look for:
  - `[NResto] Image download: starting N on native thread` → background download started.
  - `[NResto] Image download: native completed N saved` → N files saved under **Documents/NRestoMobile** (filename = item id).
- If you see `[NResto] Image download: no items with item_image` → API response has no image URLs; set `item_image` in your backend or use demo data.
- On a **physical device**, `graphqlApiBase: 'http://localhost:3399/graphql'` is not reachable; use your machine’s LAN IP (e.g. `http://192.168.1.x:3399/graphql`) and set `assetsBaseUrl` to the same base for image URLs.

## Branding

BOLT Fusion Tech · boltfusiontech.com (login footer and app identity).
