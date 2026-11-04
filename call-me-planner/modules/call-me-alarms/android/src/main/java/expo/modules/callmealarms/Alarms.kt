package expo.modules.callmealarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/** Arms and disarms alarms with Android's AlarmManager. */
object Alarms {
  const val ACTION_FIRE = "expo.modules.callmealarms.FIRE"
  const val EXTRA_ID = "reminderId"

  private fun alarmManager(context: Context) =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  /** Android 12+ lets the user turn exact alarms off; below that they are always allowed. */
  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(context).canScheduleExactAlarms()

  private fun firePendingIntent(context: Context, id: String, flags: Int): PendingIntent? {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("callmealarms://alarm/$id"))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Opens the app at the ring screen: used by notifications and the full-screen alert. */
  fun ringScreenIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("callmeplanner://ring/$id"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /**
   * Uses the alarm-clock API: exact, allowed in Doze, and shows the alarm icon in the status bar.
   * Falls back to an inexact wake-up alarm if the user turned exact alarms off.
   */
  fun arm(context: Context, alarm: StoredAlarm) {
    AlarmStore.put(context, alarm)
    val operation = firePendingIntent(context, alarm.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    val manager = alarmManager(context)
    if (canScheduleExact(context)) {
      val show = ringScreenIntent(context, alarm.id)
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(alarm.fireAtMs, show), operation)
    } else {
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.fireAtMs, operation)
    }
  }

  fun disarm(context: Context, id: String) {
    firePendingIntent(context, id, PendingIntent.FLAG_NO_CREATE)?.let {
      alarmManager(context).cancel(it)
      it.cancel()
    }
    AlarmStore.remove(context, id)
  }

  /** After a restart, an app update or a clock change: arm everything still in the future. */
  fun rearmAll(context: Context) {
    val now = System.currentTimeMillis()
    for (alarm in AlarmStore.all(context)) {
      if (alarm.fireAtMs > now) arm(context, alarm) else AlarmStore.remove(context, alarm.id)
    }
  }
}
