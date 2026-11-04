package expo.modules.callmealarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** An alarm went off: show its notification and tell the app, if it is running. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Alarms.ACTION_FIRE) return
    val id = intent.getStringExtra(Alarms.EXTRA_ID) ?: return
    val alarm = AlarmStore.get(context, id) ?: return
    AlarmStore.remove(context, id)
    Notifications.show(context, alarm)
    CallMeAlarmsModule.onFired?.invoke(alarm)
  }
}

/** Android forgets alarms on restart and app update; a clock change can move them. Re-arm. */
class RearmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> {
        Notifications.ensureChannels(context)
        Alarms.rearmAll(context)
      }
    }
  }
}
