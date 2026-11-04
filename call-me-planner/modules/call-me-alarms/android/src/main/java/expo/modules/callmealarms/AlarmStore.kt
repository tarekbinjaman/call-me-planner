package expo.modules.callmealarms

import android.content.Context
import org.json.JSONObject

/** One armed alarm. Mirrors a row of the app's `reminder` table plus what the notification shows. */
data class StoredAlarm(
  val id: String,
  val taskId: String,
  /** heads_up | voice | ring */
  val channel: String,
  val fireAtMs: Long,
  val title: String,
  val body: String
) {
  fun toJson(): String = JSONObject()
    .put("id", id)
    .put("taskId", taskId)
    .put("channel", channel)
    .put("fireAtMs", fireAtMs)
    .put("title", title)
    .put("body", body)
    .toString()

  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "taskId" to taskId,
    "channel" to channel,
    "fireAt" to isoUtc(fireAtMs),
    "title" to title
  )

  companion object {
    fun fromJson(json: String): StoredAlarm? = try {
      val o = JSONObject(json)
      StoredAlarm(
        o.getString("id"),
        o.getString("taskId"),
        o.getString("channel"),
        o.getLong("fireAtMs"),
        o.optString("title"),
        o.optString("body")
      )
    } catch (e: Exception) {
      null
    }

    fun isoUtc(ms: Long): String {
      val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
      f.timeZone = java.util.TimeZone.getTimeZone("UTC")
      return f.format(java.util.Date(ms))
    }
  }
}

/**
 * Armed alarms survive the app being closed, a phone restart and an app update, because
 * Android forgets alarms on restart. Kept in SharedPreferences, one entry per reminder id.
 */
object AlarmStore {
  private const val PREFS = "call_me_alarms"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(context: Context, alarm: StoredAlarm) {
    prefs(context).edit().putString(alarm.id, alarm.toJson()).apply()
  }

  fun get(context: Context, id: String): StoredAlarm? =
    prefs(context).getString(id, null)?.let { StoredAlarm.fromJson(it) }

  fun remove(context: Context, id: String) {
    prefs(context).edit().remove(id).apply()
  }

  fun all(context: Context): List<StoredAlarm> =
    prefs(context).all.values.mapNotNull { (it as? String)?.let(StoredAlarm::fromJson) }
}
