package expo.modules.callmealarms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

/** What the user sees and hears when an alarm fires. */
object Notifications {
  /** Channel settings can't change after creation, so the ids carry a version. */
  private const val CHANNEL_REMINDERS = "reminders_v1"
  private const val CHANNEL_ALARMS = "alarms_v1"

  /** A ring keeps sounding this long unless the ring screen is opened first. */
  const val RING_TIMEOUT_MS = 60_000L

  private fun manager(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val m = manager(context)
    m.createNotificationChannel(
      NotificationChannel(CHANNEL_REMINDERS, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Heads-up before a task is due"
      }
    )
    // The alarm channel plays on the alarm stream, so it rings even with media volume at zero.
    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    m.createNotificationChannel(
      NotificationChannel(CHANNEL_ALARMS, "Rings", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Must-do tasks that are due: rings until you answer"
        setSound(
          alarmSound,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 600, 800)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
      }
    )
  }

  private fun smallIcon(context: Context): Int =
    context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_idle_alarm

  @Suppress("DEPRECATION")
  private fun builder(context: Context, channel: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, channel)
    else Notification.Builder(context)

  /** Notification id per reminder, so the ring screen can stop exactly this one. */
  fun notificationId(reminderId: String) = reminderId.hashCode()

  fun show(context: Context, alarm: StoredAlarm) {
    ensureChannels(context)
    val open = Alarms.ringScreenIntent(context, alarm.id)
    val loud = alarm.channel == "voice" || alarm.channel == "ring"
    val b = builder(context, if (loud) CHANNEL_ALARMS else CHANNEL_REMINDERS)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(alarm.title)
      .setContentText(alarm.body)
      .setContentIntent(open)
      .setAutoCancel(true)
      .setShowWhen(true)

    if (loud) {
      // Opens the ring screen straight away over the lock screen; when the phone is in use,
      // Android shows it as a heads-up banner instead.
      b.setFullScreenIntent(open, true)
        .setCategory(Notification.CATEGORY_ALARM)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setOngoing(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) b.setTimeoutAfter(RING_TIMEOUT_MS)
    } else {
      b.setCategory(Notification.CATEGORY_REMINDER)
    }

    @Suppress("DEPRECATION")
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setPriority(Notification.PRIORITY_MAX)

    val notification = b.build()
    // Insistent: the alarm sound repeats until the notification is dismissed or times out.
    if (alarm.channel == "ring") notification.flags = notification.flags or Notification.FLAG_INSISTENT
    manager(context).notify(notificationId(alarm.id), notification)
  }

  /** Stops the ringing for this reminder (the ring screen takes over). */
  fun dismiss(context: Context, reminderId: String) {
    manager(context).cancel(notificationId(reminderId))
  }

  fun canPost(context: Context): Boolean = manager(context).areNotificationsEnabled()

  fun canUseFullScreen(context: Context): Boolean =
    Build.VERSION.SDK_INT < 34 || manager(context).canUseFullScreenIntent()
}
