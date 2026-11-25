import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { flushAll } from "./store";
import { refreshWidget } from "./widgetData";

/**
 * Background refresh (iOS decides exactly when, usually every hour or two while the phone is charging or idle):
 * sends any workouts still waiting to sync and refreshes the widgets, so meals logged in Safari or a new
 * weigh-in show without opening the app.
 */
const TASK = "nicholasfit-refresh";

TaskManager.defineTask(TASK, async () => {
  try {
    await flushAll();
    await refreshWidget();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
  } catch {
    // Background refresh turned off for the app: the widgets still refresh whenever it opens.
  }
}
