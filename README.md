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

## Project structure

- `src/constants/demoData.ts` – Demo users, food items, categories, service charge constant.
- `src/store/` – Redux store: `authSlice` (login/logout), `posSlice` (cart, order type, discount/charge/tax, totals).
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

## Branding

BOLT Fusion Tech · boltfusiontech.com (login footer and app identity).
