import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type PermissionStatus,
} from "@capacitor/local-notifications";

export const REMINDER_NOTIFICATION_ID = 1001;
export const REMINDER_CHANNEL_ID = "daily-reminder";

export function isNativePlatform() {
  // "web"이 아니면 native (android/ios)
  return Capacitor.getPlatform() !== "web";
}

export async function ensureLocalNotificationPermission(): Promise<PermissionStatus> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return current;
  return await LocalNotifications.requestPermissions();
}

export async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;

  // 채널이 이미 있으면 무시되거나 업데이트됩니다.
  await LocalNotifications.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: "Daily Reminder",
    description: "Daily reminder notification",
    importance: 4, // DEFAULT(3)~HIGH(4) 정도
    visibility: 1, // PUBLIC
    sound: undefined,
    vibration: true,
  });
}

export async function cancelDailyReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_NOTIFICATION_ID }] });
}

export async function scheduleReminderAt(opts: {
  at: Date;
  title?: string;
  body?: string;
}) {
  await ensureAndroidChannel();
  await cancelDailyReminder();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_NOTIFICATION_ID,
        title: opts.title ?? "오늘의 지식조각",
        body: opts.body ?? "오늘의 한 조각, 꺼내볼까요?",
        schedule: { at: opts.at },
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: "ic_stat_refill",
        extra: { deepLink: "/content" },
      },
    ],
  });
}

export async function scheduleDailyReminder(opts: {
  hour: number;
  minute: number;
  title?: string;
  body?: string;
}) {
  const { hour, minute } = opts;

  await ensureAndroidChannel();

  // 같은 id로 항상 1개만 유지
  await cancelDailyReminder();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_NOTIFICATION_ID,
        title: opts.title ?? "오늘의 지식조각",
        body: opts.body ?? "오늘의 한 조각, 꺼내볼까요?",
        // 매일 지정 시각
        schedule: { on: { hour, minute }, repeats: true },
        // Android 채널
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: "ic_stat_refill",
        // 탭했을 때 구분용(필요하면 확장)
        extra: { deepLink: "/content" },
      },
    ],
  });
}