import { useEffect } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  cancelDailyReminder,
  ensureLocalNotificationPermission,
  isNativePlatform,
  scheduleReminderAt,
} from "@/app/lib/localReminder";

export function useLocalReminder(opts: {
  enabled: boolean;
  timeHHmm: string; // "HH:mm"
  isReadToday: boolean;
  onOpenContent?: () => void; // 알림 탭 시 실행
}) {
  const { enabled, timeHHmm, isReadToday, onOpenContent } = opts;

  // 1) enabled/time 변경 시 스케줄 갱신
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;

    (async () => {
      try {
        if (!enabled) {
          await cancelDailyReminder();
          return;
        }

        const perm = await ensureLocalNotificationPermission();
        if (perm.display !== "granted") {
          // 권한 거부면 스케줄링 안 함 (기존 예약이 남아있지 않도록 취소)
          await cancelDailyReminder();
          return;
        }

        const [hh, mm] = timeHHmm.split(":").map((v) => Number(v));
        const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 21;
        const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;

        if (cancelled) return;

        const now = new Date();
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);

        // 오늘 읽었거나, 오늘 시간이 이미 지났으면 내일로
        if (isReadToday || next.getTime() <= now.getTime()) {
          next.setDate(next.getDate() + 1);
          next.setHours(hour, minute, 0, 0);
        }

        if (cancelled) return;
        await scheduleReminderAt({
          at: next,
          title: "오늘의 지식조각",
          body: "오늘의 한 조각, 꺼내볼까요?",
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, timeHHmm, isReadToday]);

  // 2) 알림 탭 이벤트
  useEffect(() => {
    if (!isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | null = null;
    let disposed = false;

    (async () => {
      try {
        const h = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          () => {
            onOpenContent?.();
          }
        );

        if (disposed) {
          await h.remove();
          return;
        }

        handle = h;
      } catch {
        // ignore
      }
    })();

    return () => {
      disposed = true;
      handle?.remove();
    };
  }, [onOpenContent]);
}