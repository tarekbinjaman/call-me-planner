package expo.modules.callmealarms

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Exact alarms for Call-Me Planner (plan 1.7, Android). The JavaScript side
 * (modules/call-me-alarms/index.ts) keeps these in step with the reminder table.
 */
class CallMeAlarmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CallMeAlarms")

    Events("onAlarm")

    OnCreate {
      appContext.reactContext?.let { Notifications.ensureChannels(it) }
      onFired = { alarm -> sendEvent("onAlarm", alarm.toMap()) }
    }

    OnDestroy {
      onFired = null
    }

    AsyncFunction("schedule") { id: String, taskId: String, channel: String, fireAtMs: Double, title: String, body: String ->
      Alarms.arm(context, StoredAlarm(id, taskId, channel, fireAtMs.toLong(), title, body))
    }

    AsyncFunction("cancel") { id: String ->
      Alarms.disarm(context, id)
      Notifications.dismiss(context, id)
    }

    AsyncFunction("cancelAllForTask") { taskId: String ->
      for (alarm in AlarmStore.all(context)) {
        if (alarm.taskId == taskId) Alarms.disarm(context, alarm.id)
      }
    }

    AsyncFunction("armed") {
      AlarmStore.all(context).map { it.toMap() }
    }

    /** The ring screen opened: stop the alarm sound for this reminder. */
    Function("stopRinging") { id: String ->
      Notifications.dismiss(context, id)
    }

    /** For the permission walkthrough (plan 1.8). */
    Function("status") {
      mapOf(
        "exactAlarms" to Alarms.canScheduleExact(context),
        "notifications" to Notifications.canPost(context),
        "fullScreen" to Notifications.canUseFullScreen(context)
      )
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }

  companion object {
    /** Set while the app is running, so a fired alarm can open the ring screen right away. */
    @Volatile
    var onFired: ((StoredAlarm) -> Unit)? = null
  }
}
