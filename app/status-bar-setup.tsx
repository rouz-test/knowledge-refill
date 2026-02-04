'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

export default function StatusBarSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (Capacitor.getPlatform() === 'android') {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    }
  }, []);

  return null;
}