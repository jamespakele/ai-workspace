// Cadence specs for scheduled tasks:
//   "hourly"            — top of every hour
//   "daily@HH:MM"       — every day at HH:MM local time
//   "weekly:<day>@HH:MM" — e.g. "weekly:mon@09:00"
//   "every:<N>m"        — every N minutes (N >= 1)

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function parseCadence(spec) {
  if (typeof spec !== "string") {
    return null;
  }

  const trimmed = spec.trim().toLowerCase();

  if (trimmed === "hourly") {
    return { kind: "hourly" };
  }

  const daily = trimmed.match(/^daily@(\d{1,2}):(\d{2})$/);
  if (daily) {
    const hour = Number(daily[1]);
    const minute = Number(daily[2]);
    if (hour > 23 || minute > 59) {
      return null;
    }
    return { kind: "daily", hour, minute };
  }

  const weekly = trimmed.match(/^weekly:([a-z]{3})@(\d{1,2}):(\d{2})$/);
  if (weekly) {
    const day = DAYS.indexOf(weekly[1]);
    const hour = Number(weekly[2]);
    const minute = Number(weekly[3]);
    if (day === -1 || hour > 23 || minute > 59) {
      return null;
    }
    return { kind: "weekly", day, hour, minute };
  }

  const every = trimmed.match(/^every:(\d+)m$/);
  if (every) {
    const minutes = Number(every[1]);
    if (minutes < 1) {
      return null;
    }
    return { kind: "every", minutes };
  }

  return null;
}

// Next run strictly after `after` (a Date), as a Date. Null for bad specs.
export function computeNextRun(spec, after) {
  const cadence = parseCadence(spec);
  if (!cadence) {
    return null;
  }

  const base = new Date(after.getTime());

  switch (cadence.kind) {
    case "hourly": {
      const next = new Date(base.getTime());
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    }
    case "every": {
      return new Date(base.getTime() + cadence.minutes * 60_000);
    }
    case "daily": {
      const next = new Date(base.getTime());
      next.setHours(cadence.hour, cadence.minute, 0, 0);
      if (next.getTime() <= base.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case "weekly": {
      const next = new Date(base.getTime());
      next.setHours(cadence.hour, cadence.minute, 0, 0);
      let dayDiff = (cadence.day - next.getDay() + 7) % 7;
      if (dayDiff === 0 && next.getTime() <= base.getTime()) {
        dayDiff = 7;
      }
      next.setDate(next.getDate() + dayDiff);
      return next;
    }
    default:
      return null;
  }
}

// A task is due when its next run (computed from last_run, or from epoch when
// it has never run) is at or before `now`.
export function isDue(task, now) {
  if (!task.enabled) {
    return false;
  }

  const reference = task.last_run
    ? new Date(task.last_run * 1000)
    : new Date(0);
  const next = computeNextRun(task.cadence, reference);
  if (!next) {
    return false;
  }

  return next.getTime() <= now.getTime();
}
