# ZIGO React Native WebView: Razorpay UPI Intent Integration

This document is for the Android/iOS mobile-app developer. The hosted ZIGO web app already creates Razorpay orders, opens Standard Checkout with `webview_intent: true`, verifies signatures, processes webhooks, and reconciles a pending payment when the WebView returns to the foreground.

Do not put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in the mobile app.

## 1. Dependency

Use the project's existing React Native version and install the WebView package if it is not already installed:

```bash
npm install react-native-webview
cd ios && pod install && cd ..
```

## 2. WebView Component

Replace the app's current WebView screen with the behavior below, or merge these handlers into it. Keep any existing authentication, splash-screen, notification, location, and back-navigation behavior.

```tsx
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';

const APP_URL = 'https://zigonow.in/admin/customer';

const PAYMENT_SCHEMES = new Set([
  'upi',
  'gpay',
  'tez',
  'phonepe',
  'paytm',
  'paytmmp',
  'bhim',
  'credpay',
  'mobikwik',
  'amazonpay',
  'navi',
  'intent',
]);

const SAFE_EXTERNAL_SCHEMES = new Set([
  ...PAYMENT_SCHEMES,
  'tel',
  'mailto',
  'sms',
]);

function schemeOf(url: string): string {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(String(url || '').trim());
  return match?.[1]?.toLowerCase() || '';
}

function isWebNavigation(url: string): boolean {
  return ['http', 'https', 'about', 'data', 'blob'].includes(schemeOf(url));
}

export default function ZigoWebApp(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const notifyWebPaymentResume = useCallback(() => {
    // Do not reload. The hosted app uses this event to reconcile the pending
    // Razorpay order with the backend and continue booking confirmation.
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new CustomEvent('zigo:native-resume', {
        detail: { source: 'react-native', platform: '${Platform.OS}' }
      }));
      true;
    `);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (/inactive|background/.test(previousState) && nextState === 'active') {
        // Give the UPI app/Checkout activity a moment to return control.
        setTimeout(notifyWebPaymentResume, 300);
      }
    });
    return () => subscription.remove();
  }, [notifyWebPaymentResume]);

  const openExternalUrl = useCallback(async (url: string) => {
    const scheme = schemeOf(url);
    if (!SAFE_EXTERNAL_SCHEMES.has(scheme)) {
      Alert.alert('Unable to open link', 'This link type is not supported.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        PAYMENT_SCHEMES.has(scheme) ? 'UPI app not available' : 'Unable to open link',
        PAYMENT_SCHEMES.has(scheme)
          ? 'Install or enable the selected UPI app and try again.'
          : 'No application is available to open this link.',
      );
    }
  }, []);

  const shouldStartLoad = useCallback((request: WebViewNavigation): boolean => {
    const url = String(request.url || '');
    if (isWebNavigation(url)) return true;

    const scheme = schemeOf(url);
    if (SAFE_EXTERNAL_SCHEMES.has(scheme)) {
      void openExternalUrl(url);
    }
    // A native/external URI must never be loaded as a WebView page.
    return false;
  }, [openExternalUrl]);

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: APP_URL }}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      javaScriptCanOpenWindowsAutomatically
      setSupportMultipleWindows={false}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={shouldStartLoad}
      onOpenWindow={({ nativeEvent }) => {
        const url = String(nativeEvent.targetUrl || '');
        if (!isWebNavigation(url)) void openExternalUrl(url);
      }}
      onContentProcessDidTerminate={() => {
        // iOS may terminate a WebContent process under memory pressure. This is
        // not called during an ordinary UPI app switch.
        webViewRef.current?.reload();
      }}
    />
  );
}
```

Do not reload the WebView in `AppState` when the UPI app returns. Reloading loses the active Checkout JavaScript context and can produce a false cancellation screen.

## 3. AndroidManifest.xml

In `android/app/src/main/AndroidManifest.xml`, retain the existing application configuration and add internet access plus package-visibility queries. Place `<queries>` directly under `<manifest>`, not inside `<application>`.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="upi" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="tez" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="phonepe" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="paytmmp" />
        </intent>
    </queries>

    <application
        android:usesCleartextTraffic="false">
        <!-- Keep the project's existing activities/providers here. -->
    </application>
</manifest>
```

Do not add ZIGO Razorpay secrets to `AndroidManifest.xml`, Gradle, JavaScript, or native resources.

## 4. iOS Info.plist

Merge the following schemes into the existing `LSApplicationQueriesSchemes` array in `ios/<AppName>/Info.plist`. Do not create a second key if it already exists.

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>upi</string>
    <string>gpay</string>
    <string>tez</string>
    <string>phonepe</string>
    <string>paytm</string>
    <string>paytmmp</string>
    <string>bhim</string>
    <string>credpay</string>
    <string>mobikwik</string>
    <string>amazonpay</string>
    <string>navi</string>
</array>
```

If the app has a custom `AppDelegate` that overrides URL opening, ensure it forwards URLs to React Native Linking. Adapt this to the React Native template/version already used by the app:

```swift
import React

override func application(
  _ app: UIApplication,
  open url: URL,
  options: [UIApplication.OpenURLOptionsKey: Any] = [:]
) -> Bool {
  return RCTLinkingManager.application(app, open: url, options: options)
}
```

Do not request an `Always` location permission or add unrelated native permissions for payments.

## 5. Required Behaviour

1. Keep ZIGO, Razorpay, bank, 3DS, and other `http/https` pages inside the WebView.
2. Open only approved payment/application schemes externally.
3. Do not reload or recreate the WebView when the app enters the background.
4. On foreground return, dispatch the `focus` event as shown above.
5. Do not mark a payment paid from a native return value. The ZIGO backend signature verification, webhook, and reconciliation endpoint are authoritative.
6. If a UPI app is unavailable, keep the pending booking/payment screen available so the customer can choose another method.

## 6. Acceptance Test

Build a fresh Android APK and iOS IPA, then test on physical devices:

1. Open ZIGO and create a booking using Online Payment.
2. Razorpay Checkout must show UPI apps along with other enabled methods.
3. Select Google Pay/PhonePe/Paytm; the selected app must open with amount and merchant prefilled.
4. Complete payment and return to ZIGO without a page reload.
5. The pending order must reconcile and the booking must confirm once only.
6. Cancel from the UPI app; ZIGO must remain unpaid and offer retry/change payment method.
7. Select an app that is not installed; show the friendly unavailable-app alert.
8. Verify cards, netbanking, and wallets still remain inside Checkout.
9. Verify Android Back and iOS return-to-app do not create duplicate bookings.

The hosted web application URL is `https://zigonow.in/admin/customer`. Test against HTTPS and a live Razorpay-enabled account on physical devices; desktop browsers use UPI QR rather than mobile UPI Intent.
